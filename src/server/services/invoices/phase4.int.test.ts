// Phase 4 acceptance: create an air ticket invoice, receive a partial payment,
// pay the vendor; ledgers and balances match a hand calculation.
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma";
import { tenantDb } from "@/server/db/tenant";
import { checkLedgerIntegrity } from "@/server/accounting/balances";
import {
  chartOfAccounts,
  createMoneyAccount,
} from "@/server/services/accounts/moneyAccountService";
import {
  createAirInvoice,
  getAirInvoice,
  postDraftAirInvoice,
  updateAirInvoice,
} from "@/server/services/invoices/airInvoiceService";
import { voidInvoice } from "@/server/services/invoices/invoiceCommon";
import { partyLedger } from "@/server/services/ledger/partyLedger";
import { createAdvanceReturn } from "@/server/services/payments/advanceReturnService";
import { createMoneyReceipt, voidMoneyReceipt } from "@/server/services/payments/receiptService";
import { createVendorPayment } from "@/server/services/payments/vendorPaymentService";
import { saveMaster } from "@/server/services/masters/masterService";
import { makeAgency } from "@/tests/integration/helpers";

let A: Awaited<ReturnType<typeof makeAgency>>;
let clientId: string;
let vendorId: string;
let cashId: string;
let airlineId: string;
let invoiceId: string;
let receiptId: string;
const day = "2026-09-28";

async function bal(model: "client" | "vendor" | "moneyAccount", id: string) {
  const row =
    model === "client"
      ? await prisma.client.findUniqueOrThrow({ where: { id } })
      : model === "vendor"
        ? await prisma.vendor.findUniqueOrThrow({ where: { id } })
        : await prisma.moneyAccount.findUniqueOrThrow({ where: { id } });
  return row.balance.toFixed(2);
}

const ticket = (ticketNo: string, baseFare: string, tax: string, clientPrice: string) => ({
  ticketNo,
  pnr: "ABC123",
  airlineId,
  vendorId,
  passengerName: "MD RAHIM UDDIN",
  passengerType: "ADT",
  route: "DAC-DXB-DAC",
  journeyDate: "2026-10-15",
  returnDate: "2026-10-30",
  baseFare,
  taxes: [{ code: "BD", amount: tax }],
  commissionPercent: "7",
  clientPrice,
});

beforeAll(async () => {
  A = await makeAgency("ph4");
  const opening = { openingBalance: "0" };
  clientId = (
    await saveMaster(A.ctx, "clients", null, {
      name: "Rahim Uddin",
      type: "INDIVIDUAL",
      creditLimit: "0",
      openingBalanceType: "RECEIVABLE",
      ...opening,
    })
  ).id;
  vendorId = (
    await saveMaster(A.ctx, "vendors", null, {
      name: "Sky Consolidators",
      type: "AIRLINE_CONSOLIDATOR",
      commissionPercent: "7",
      openingBalanceType: "PAYABLE",
      ...opening,
    })
  ).id;
  cashId = (
    await createMoneyAccount(A.ctx, { name: "Main Cash", kind: "CASH", openingBalance: "100000" })
  ).id;
  airlineId = (await tenantDb(A.agency.id).airline.findFirstOrThrow({ where: { iata: "EK" } })).id;
});

describe("air ticket invoice → partial receipt → vendor payment", () => {
  it("prices tickets with the default rule and posts the invoice", async () => {
    const r = await createAirInvoice(A.ctx, {
      clientId,
      date: day,
      discount: "500",
      serviceCharge: "1000",
      tickets: [
        ticket("1762345678901", "40000", "10000", "49500"),
        ticket("1762345678902", "20000", "5000", "25000"),
      ],
      post: true,
    });
    invoiceId = r.id;
    expect(r.number).toMatch(/^AIT-2026-\d{5}$/);

    const inv = (await getAirInvoice(A.ctx, invoiceId))!;
    // Ticket 1: total 50,000; commission 7% of 40,000 = 2,800; AIT 0.3% of 50,000 = 150 → purchase 47,350.
    // Ticket 2: total 25,000; commission 1,400; AIT 75 → purchase 23,675.
    expect(inv.tickets.map((t) => [t.commissionAmount, t.aitAmount, t.purchasePrice])).toEqual([
      ["2800.00", "150.00", "47350.00"],
      ["1400.00", "75.00", "23675.00"],
    ]);
    // Net = 74,500 - 500 + 1,000 = 75,000; cost = 71,025; profit = 3,975.
    expect([inv.subtotal, inv.netTotal, inv.totalCost, inv.profit, inv.status]).toEqual([
      "74500.00",
      "75000.00",
      "71025.00",
      "3975.00",
      "POSTED",
    ]);
    expect(await bal("client", clientId)).toBe("75000.00");
    expect(await bal("vendor", vendorId)).toBe("-71025.00");
  });

  it("receives a partial payment and allocates it to the invoice", async () => {
    const r = await createMoneyReceipt(A.ctx, {
      clientId,
      date: day,
      moneyAccountId: cashId,
      paymentMethod: "CASH",
      amount: "30000",
    });
    receiptId = r.id;
    expect(r.number).toMatch(/^MR-2026-\d{5}$/);
    const inv = (await getAirInvoice(A.ctx, invoiceId))!;
    expect([inv.paidAmount, inv.due, inv.status]).toEqual(["30000.00", "45000.00", "PARTIAL"]);
    expect(await bal("client", clientId)).toBe("45000.00");
    expect(await bal("moneyAccount", cashId)).toBe("130000.00");
  });

  it("pays the vendor", async () => {
    await createVendorPayment(A.ctx, {
      vendorId,
      date: day,
      moneyAccountId: cashId,
      paymentMethod: "CASH",
      amount: "50000",
    });
    expect(await bal("vendor", vendorId)).toBe("-21025.00");
    expect(await bal("moneyAccount", cashId)).toBe("80000.00");
  });

  it("client and vendor ledgers match the hand calculation", async () => {
    const client = await partyLedger(A.ctx, {
      partyType: "CLIENT",
      partyId: clientId,
      page: 1,
      pageSize: 50,
    });
    expect(client.rows.map((r) => [r.debit, r.credit, r.balance])).toEqual([
      ["75000.00", "0.00", "75000.00"],
      ["0.00", "30000.00", "45000.00"],
    ]);
    expect(client.closing).toBe("45000.00");

    const vendor = await partyLedger(A.ctx, {
      partyType: "VENDOR",
      partyId: vendorId,
      page: 1,
      pageSize: 50,
    });
    expect(vendor.rows.map((r) => [r.debit, r.credit, r.balance])).toEqual([
      ["0.00", "71025.00", "-71025.00"],
      ["50000.00", "0.00", "-21025.00"],
    ]);

    // Profit and loss from the ledger: sales 74,500 + service charge 1,000 - discount 500 - cost 71,025 = 3,975.
    const chart = new Map((await chartOfAccounts(A.ctx)).map((l) => [l.name, l.balance]));
    expect(chart.get("Sales - Air Ticket")).toBe("74500.00");
    expect(chart.get("Service Charge Income")).toBe("1000.00");
    expect(chart.get("Discount Given")).toBe("500.00");
    expect(chart.get("Cost of Sales - Air Ticket")).toBe("71025.00");
  });

  it("an edit reverses and reposts, keeping payments", async () => {
    const inv = (await getAirInvoice(A.ctx, invoiceId))!;
    await updateAirInvoice(A.ctx, invoiceId, {
      clientId,
      date: day,
      discount: "500",
      serviceCharge: "1000",
      tickets: [
        ticket("1762345678901", "40000", "10000", "49500"),
        ticket("1762345678902", "20000", "5000", "26000"),
      ],
      post: true,
    });
    const after = (await getAirInvoice(A.ctx, invoiceId))!;
    expect([after.netTotal, after.paidAmount, after.status, after.number]).toEqual([
      "76000.00",
      "30000.00",
      "PARTIAL",
      inv.number,
    ]);
    expect(await bal("client", clientId)).toBe("46000.00");
    expect(await bal("vendor", vendorId)).toBe("-21025.00");

    await expect(
      updateAirInvoice(A.ctx, invoiceId, {
        clientId,
        date: day,
        tickets: [ticket("1762345678901", "10000", "0", "20000")],
      }),
    ).rejects.toThrow(/cannot be lower/);
  });

  it("refuses duplicate ticket numbers on another live invoice", async () => {
    await expect(
      createAirInvoice(A.ctx, {
        clientId,
        date: day,
        tickets: [ticket("1762345678901", "1000", "0", "1200")],
      }),
    ).rejects.toThrow(/already on another invoice/);
  });

  it("will not void a paid invoice until its receipt is voided", async () => {
    await expect(voidInvoice(A.ctx, invoiceId, { reason: "Customer cancelled" })).rejects.toThrow(
      /Void those money receipts/,
    );
    await voidMoneyReceipt(A.ctx, receiptId, { reason: "Bounced" });
    const inv = (await getAirInvoice(A.ctx, invoiceId))!;
    expect([inv.paidAmount, inv.status]).toEqual(["0.00", "POSTED"]);
    expect(await bal("client", clientId)).toBe("76000.00");
    expect(await bal("moneyAccount", cashId)).toBe("50000.00");

    await voidInvoice(A.ctx, invoiceId, { reason: "Customer cancelled" });
    expect(await bal("client", clientId)).toBe("0.00");
    expect(await bal("vendor", vendorId)).toBe("50000.00"); // our payment is now an advance with the vendor

    // The ticket numbers are free again once the invoice is void.
    const again = await createAirInvoice(A.ctx, {
      clientId,
      date: day,
      tickets: [ticket("1762345678901", "1000", "0", "1200")],
      post: false,
    });
    expect((await getAirInvoice(A.ctx, again.id))!.status).toBe("DRAFT");
  });

  it("drafts post nothing until posted", async () => {
    const draft = await createAirInvoice(A.ctx, {
      clientId,
      date: day,
      tickets: [ticket("1762345670001", "10000", "2000", "12500")],
      post: false,
    });
    expect(await prisma.journalEntry.count({ where: { sourceId: draft.id } })).toBe(0);
    expect(await bal("client", clientId)).toBe("0.00");
    await postDraftAirInvoice(A.ctx, draft.id);
    expect(await bal("client", clientId)).toBe("12500.00");
  });

  it("an overpayment becomes an advance that can be returned", async () => {
    // Due now: 12,500 (posted draft). Receive 20,000 → 7,500 advance... net balance -7,500.
    const r = await createMoneyReceipt(A.ctx, {
      clientId,
      date: day,
      moneyAccountId: cashId,
      paymentMethod: "MOBILE",
      amount: "20000",
      transactionCharge: "185",
    });
    expect(await bal("client", clientId)).toBe("-7500.00");
    expect(await bal("moneyAccount", cashId)).toBe("69815.00"); // 50,000 + 20,000 - 185
    const receipt = await prisma.moneyReceiptAllocation.findMany({ where: { receiptId: r.id } });
    expect(receipt.map((a) => a.amount.toFixed(2))).toEqual(["12500.00"]);

    await expect(
      createAdvanceReturn(A.ctx, "CLIENT", {
        partyId: clientId,
        date: day,
        moneyAccountId: cashId,
        amount: "8000",
      }),
    ).rejects.toThrow(/only 7500.00 in advance/);
    await createAdvanceReturn(A.ctx, "CLIENT", {
      partyId: clientId,
      date: day,
      moneyAccountId: cashId,
      amount: "7500",
    });
    expect(await bal("client", clientId)).toBe("0.00");
    expect(await bal("moneyAccount", cashId)).toBe("62315.00");

    // Vendor held our 50,000 advance, less the 11,336 now owed for the posted
    // draft ticket (12,000 - 700 commission + 36 AIT): 38,664 comes back.
    expect(await bal("vendor", vendorId)).toBe("38664.00");
    await createAdvanceReturn(A.ctx, "VENDOR", {
      partyId: vendorId,
      date: day,
      moneyAccountId: cashId,
      amount: "38664",
    });
    expect(await bal("vendor", vendorId)).toBe("0.00");
  });

  it("the golden rule still holds", async () => {
    const integrity = await checkLedgerIntegrity(tenantDb(A.agency.id), A.agency.id);
    expect(integrity.drift).toEqual([]);
    expect(integrity.unbalancedEntries).toEqual([]);
    expect(integrity.totalDebit).toBe(integrity.totalCredit);
  });
});
