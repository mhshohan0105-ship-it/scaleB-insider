// Phase 7: reissue and refunds post correctly and match hand calculations.
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma";
import { tenantDb } from "@/server/db/tenant";
import { checkLedgerIntegrity } from "@/server/accounting/balances";
import { saveMaster } from "@/server/services/masters/masterService";
import {
  chartOfAccounts,
  createMoneyAccount,
} from "@/server/services/accounts/moneyAccountService";
import { createMoneyReceipt, listDueInvoices } from "@/server/services/payments/receiptService";
import {
  createAirInvoice,
  getAirInvoice,
  toFormValues,
  updateAirInvoice,
} from "@/server/services/invoices/airInvoiceService";
import { voidInvoice } from "@/server/services/invoices/invoiceCommon";
import { createItemInvoice } from "@/server/services/invoices/itemInvoiceService";
import {
  createReissueInvoice,
  getReissueInvoice,
  reissuableTickets,
} from "@/server/services/invoices/reissueInvoiceService";
import { createRefund, getRefund, listRefunds, refundTarget, voidRefund } from "./postRefund";
import { makeAgency } from "@/tests/integration/helpers";
import { parseReportParams } from "@/lib/reports/params";
import { salesReport } from "@/server/reports/salesReport";
import { voidListReport } from "@/server/reports/voidList";

let A: Awaited<ReturnType<typeof makeAgency>>;
let clientId: string;
let v1: string;
let v2: string;
let cash: string;
let airlineId: string;
let invoiceId: string;
let t1: string;
let t2: string;
const day = "2026-09-20";

const balance = async (model: "client" | "vendor", id: string) =>
  (model === "client"
    ? await prisma.client.findUniqueOrThrow({ where: { id } })
    : await prisma.vendor.findUniqueOrThrow({ where: { id } })
  ).balance.toFixed(2);

const chart = async () => new Map((await chartOfAccounts(A.ctx)).map((l) => [l.name, l.balance]));
const invoice = () => prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });

const vendor = (name: string) =>
  saveMaster(A.ctx, "vendors", null, {
    name,
    type: "OTHER",
    commissionPercent: "0",
    openingBalance: "0",
    openingBalanceType: "PAYABLE",
  }).then((r) => r.id);

beforeAll(async () => {
  A = await makeAgency("ph7");
  clientId = (
    await saveMaster(A.ctx, "clients", null, {
      name: "Phase Seven Client",
      type: "INDIVIDUAL",
      creditLimit: "0",
      openingBalance: "0",
      openingBalanceType: "RECEIVABLE",
    })
  ).id;
  v1 = await vendor("Consolidator One");
  v2 = await vendor("Consolidator Two");
  cash = (await createMoneyAccount(A.ctx, { name: "Desk", kind: "CASH", openingBalance: "0" })).id;
  airlineId = (await tenantDb(A.agency.id).airline.findFirstOrThrow({ where: { iata: "BS" } })).id;

  // Two tickets: 20,000 (cost 18,000, vendor 1) and 10,000 (cost 9,000, vendor 2).
  const ticket = (no: string, vendorId: string, client: string, cost: string) => ({
    ticketNo: no,
    airlineId,
    vendorId,
    passengerName: `PAX ${no.slice(-1)}`,
    route: "DAC-DXB",
    journeyDate: "2026-10-10",
    baseFare: "0",
    purchasePrice: cost,
    clientPrice: client,
  });
  invoiceId = (
    await createAirInvoice(
      A.ctx,
      {
        clientId,
        date: day,
        tickets: [
          ticket("9990000000001", v1, "20000", "18000"),
          ticket("9990000000002", v2, "10000", "9000"),
        ],
      },
      "NON_COMMISSION",
    )
  ).id;
  const inv = (await getAirInvoice(A.ctx, invoiceId, "NON_COMMISSION"))!;
  t1 = inv.tickets[0]!.id;
  t2 = inv.tickets[1]!.id;
  await createMoneyReceipt(A.ctx, {
    clientId,
    date: day,
    moneyAccountId: cash,
    paymentMethod: "CASH",
    amount: "25000",
  });
});

describe("reissue", () => {
  it("charges penalty + fare difference + service charge and pays the vendor the airline part", async () => {
    const tickets = await reissuableTickets(A.ctx, clientId);
    expect(tickets.map((t) => t.id).sort()).toEqual([t1, t2].sort());

    const { id, number } = await createReissueInvoice(A.ctx, {
      clientId,
      date: "2026-09-25",
      lines: [
        {
          originalTicketId: t2,
          ticketNo: "9990000000102",
          vendorId: v2,
          journeyDate: "2026-10-20",
          penalty: "2000",
          fareDifference: "1000",
          serviceCharge: "500",
        },
      ],
      post: true,
    });
    expect(number).toMatch(/^RIS-2026-\d{5}$/);
    const r = (await getReissueInvoice(A.ctx, id))!;
    expect(r).toMatchObject({ netTotal: "3500.00", totalCost: "3000.00", profit: "500.00" });
    expect(r.lines[0]).toMatchObject({
      passengerName: "PAX 2",
      originalTicketNo: "9990000000002",
      journeyDate: "2026-10-20",
    });
    const c = await chart();
    expect(c.get("Sales - Reissue")).toBe("3500.00");
    expect(c.get("Cost of Sales - Reissue")).toBe("3000.00");
    // 30,000 + 3,500 invoiced - 25,000 received.
    expect(await balance("client", clientId)).toBe("8500.00");
    expect(await balance("vendor", v2)).toBe("-12000.00");
  });

  it("refuses a ticket of another client or an unknown ticket", async () => {
    await expect(
      createReissueInvoice(A.ctx, {
        clientId,
        date: day,
        lines: [{ originalTicketId: "nope", vendorId: v1, journeyDate: day, penalty: "100" }],
      }),
    ).rejects.toThrow(/unknown records/);
  });
});

describe("refunds", () => {
  it("full air ticket refund with charges, kept as client credit", async () => {
    const target = (await refundTarget(A.ctx, "AIR", invoiceId))!;
    expect(target.lines.map((l) => l.clientLeft)).toEqual(["20000.00", "10000.00"]);

    const { number } = await createRefund(A.ctx, "AIR", {
      invoiceId,
      date: "2026-09-26",
      clientCharge: "1000",
      method: "ADJUST_TO_BALANCE",
      // Amounts sent by a client are ignored for whole-line refunds.
      lines: [{ lineId: t1, clientAmount: "1", vendorAmount: "1", vendorCharge: "500" }],
    });
    expect(number).toMatch(/^RF-2026-\d{5}$/);

    // Client credit 19,000; vendor credit 17,500.
    expect(await balance("client", clientId)).toBe("-10500.00");
    expect(await balance("vendor", v1)).toBe("-500.00");
    const c = await chart();
    expect(c.get("Sales - Non Commission Ticket")).toBe("10000.00");
    expect(c.get("Cost of Sales - Non Commission Ticket")).toBe("9000.00");
    expect(c.get("Refund Charge Income")).toBe("1000.00");
    expect(c.get("Vendor Refund Charges")).toBe("500.00");

    const inv = await invoice();
    expect(inv.refundCredit.toFixed(2)).toBe("19000.00");
    expect(inv.refundCost.toFixed(2)).toBe("17500.00");
    expect(inv.status).toBe("PAID"); // owes 11,000, paid 25,000

    await expect(
      createRefund(A.ctx, "AIR", {
        invoiceId,
        date: "2026-09-26",
        method: "ADJUST_TO_BALANCE",
        lines: [{ lineId: t1 }],
      }),
    ).rejects.toThrow(/Nothing to refund|more than/);
    // A refunded ticket cannot be reissued.
    expect((await reissuableTickets(A.ctx, clientId)).map((t) => t.id)).toEqual([t2]);
  });

  it("partial refund with cash back, limited to the client's credit", async () => {
    await expect(
      createRefund(A.ctx, "PARTIAL", {
        invoiceId,
        date: "2026-09-27",
        method: "CASH_RETURN",
        returnAmount: "15000",
        moneyAccountId: cash,
        lines: [{ lineId: t2, clientAmount: "4000", vendorAmount: "3600" }],
      }),
    ).rejects.toThrow(/Cash return is more than the 4000.00 refunded/);

    await createRefund(A.ctx, "PARTIAL", {
      invoiceId,
      date: "2026-09-27",
      method: "CASH_RETURN",
      returnAmount: "4000",
      moneyAccountId: cash,
      lines: [{ lineId: t2, clientAmount: "4000", vendorAmount: "3600" }],
    });
    expect(await balance("client", clientId)).toBe("-10500.00");
    const desk = await prisma.moneyAccount.findUniqueOrThrow({ where: { id: cash } });
    expect(desk.balance.toFixed(2)).toBe("21000.00");
    const inv = await invoice();
    expect(inv.refundCredit.toFixed(2)).toBe("23000.00");
    expect(inv.status).toBe("PAID");
  });

  it("refunding what is left marks the invoice refunded; void puts it back", async () => {
    const { id } = await createRefund(A.ctx, "PARTIAL", {
      invoiceId,
      date: "2026-09-27",
      method: "ADJUST_TO_BALANCE",
      lines: [{ lineId: t2, clientAmount: "6000", vendorAmount: "5400" }],
    });
    expect((await invoice()).status).toBe("REFUNDED");
    expect(await refundTarget(A.ctx, "PARTIAL", invoiceId)).toBeNull();

    // Edit and void of the invoice are blocked while it has refunds.
    const form = toFormValues((await getAirInvoice(A.ctx, invoiceId, "NON_COMMISSION"))!);
    await expect(
      updateAirInvoice(A.ctx, invoiceId, { ...form, post: true }, "NON_COMMISSION"),
    ).rejects.toThrow(/refunds|refunded/);
    await expect(voidInvoice(A.ctx, invoiceId, { reason: "test" })).rejects.toThrow();

    await voidRefund(A.ctx, id, { reason: "Entered twice" });
    const inv = await invoice();
    expect(inv.status).toBe("PAID");
    expect(inv.refundCredit.toFixed(2)).toBe("23000.00");
    expect((await getRefund(A.ctx, id))!.status).toBe("VOID");
    await expect(voidRefund(A.ctx, id, { reason: "again" })).rejects.toThrow(/already void/);

    const list = await listRefunds(A.ctx, null, { page: 1, pageSize: 20 } as never);
    expect(list.total).toBe(3);
    expect(list.totals.refunded).toBe("24000.00"); // live refunds only
  });

  it("a fully refunded unpaid invoice still collects the refund charge", async () => {
    const { id } = await createItemInvoice(A.ctx, "OTHER", {
      clientId,
      date: day,
      items: [
        {
          kind: "SERVICE",
          qty: "1",
          description: "Hotel",
          unitPrice: "5000",
          unitCost: "4500",
          vendorId: v1,
        },
      ],
      post: true,
    });
    const line = (await refundTarget(A.ctx, "OTHER", id))!.lines[0]!;
    // Nothing paid on it, so no cash can go back for it beyond the client's other credit.
    await createRefund(A.ctx, "OTHER", {
      invoiceId: id,
      date: day,
      clientCharge: "300",
      method: "ADJUST_TO_BALANCE",
      lines: [{ lineId: line.lineId }],
    });
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id } });
    expect(inv.status).toBe("REFUNDED");
    const due = (await listDueInvoices(A.ctx, clientId)).find((d) => d.invoiceId === id);
    expect(due?.due).toBe("300.00");
  });

  it("sales report nets refunds; void list shows the voided refund", async () => {
    const sales = await salesReport(A.ctx, parseReportParams({ from: day, to: day }));
    const row = sales.rows.find((r) => r._href?.endsWith(invoiceId))!;
    // 30,000 sold; 23,000 credited back; cost 27,000 - (17,500 + 3,600); paid 25,000.
    expect(row).toMatchObject({
      sales: "30000.00",
      refunded: "23000.00",
      cost: "5900.00",
      profit: "1100.00",
      due: "-18000.00",
    });

    const voids = await voidListReport(A.ctx, parseReportParams({}));
    expect(voids.rows).toHaveLength(1);
    expect(voids.rows[0]).toMatchObject({ kind: "Partial refund", reason: "Entered twice" });
  });

  it("keeps the ledger balanced", async () => {
    const integrity = await checkLedgerIntegrity(tenantDb(A.agency.id), A.agency.id);
    expect(integrity.drift).toEqual([]);
    expect(integrity.unbalancedEntries).toEqual([]);
    expect(integrity.totalDebit).toBe(integrity.totalCredit);
  });
});
