// New invoice form: a client created with the invoice, money received with
// it, and the new ticket fields (issue date, extra fee, flight segments).
import { beforeAll, describe, expect, it } from "vitest";
import { checkLedgerIntegrity } from "@/server/accounting/balances";
import { prisma } from "@/server/db/prisma";
import { tenantDb } from "@/server/db/tenant";
import { createMoneyAccount } from "@/server/services/accounts/moneyAccountService";
import { createAirInvoice, getAirInvoice } from "@/server/services/invoices/airInvoiceService";
import { saveMaster } from "@/server/services/masters/masterService";
import { makeAgency } from "@/tests/integration/helpers";

let A: Awaited<ReturnType<typeof makeAgency>>;
let vendorId: string;
let airlineId: string;
let cashId: string;

beforeAll(async () => {
  A = await makeAgency("form");
  vendorId = (
    await saveMaster(A.ctx, "vendors", null, {
      name: "Sky Consolidators",
      type: "AIRLINE_CONSOLIDATOR",
      commissionPercent: "7",
      openingBalanceType: "PAYABLE",
      openingBalance: "0",
    })
  ).id;
  airlineId = (await tenantDb(A.agency.id).airline.findFirstOrThrow({ where: { iata: "EK" } })).id;
  cashId = (await createMoneyAccount(A.ctx, { name: "Cash", kind: "CASH", openingBalance: "0" })).id;
});

const ticket = (ticketNo: string, extra: Record<string, unknown> = {}) => ({
  ticketNo,
  airlineId,
  vendorId,
  passengerName: "MD KARIM HOSSAIN",
  route: "DAC-DXB-DAC",
  journeyDate: "2026-11-12",
  returnDate: "2026-11-26",
  baseFare: "38000",
  taxes: [{ code: "YQ", amount: "8500" }],
  commissionPercent: "7",
  clientPrice: "48500",
  ...extra,
});

describe("invoice with a new client", () => {
  it("creates the client in the same transaction and stores the new ticket fields", async () => {
    const r = await createAirInvoice(A.ctx, {
      newClient: { name: "Karim Hossain", phone: "+8801711000111", type: "INDIVIDUAL" },
      date: "2026-10-25",
      reference: "PO-77",
      showPrevDue: true,
      tickets: [
        ticket("1761000000001", {
          issueDate: "2026-10-25",
          extraFee: "500",
          segments: [
            { from: "dac", to: "dxb", airline: "EK", flightNo: "EK585", date: "2026-11-12", departs: "10:35", arrives: "13:55" },
            { from: "DXB", to: "DAC", flightNo: "EK584", date: "2026-11-26" },
          ],
        }),
      ],
      post: true,
    });
    const inv = (await getAirInvoice(A.ctx, r.id))!;
    expect(inv.client.name).toBe("Karim Hossain");
    expect(inv.client.phone).toBe("01711000111"); // stored normalised
    expect(inv.client.code).toMatch(/^CL-\d{5}$/);
    expect([inv.reference, inv.showPrevDue, inv.showDiscount]).toEqual(["PO-77", true, true]);
    const t = inv.tickets[0]!;
    expect([t.issueDate, t.extraFee]).toEqual(["2026-10-25", "500.00"]);
    expect(t.segments).toHaveLength(2);
    expect(t.segments[0]).toMatchObject({ from: "DAC", to: "DXB", flightNo: "EK585", departs: "10:35" });
    const bal = await prisma.client.findUniqueOrThrow({ where: { id: inv.client.id } });
    expect(bal.balance.toFixed(2)).toBe("48500.00");
  });

  it("refuses a mobile number that already belongs to a client, and creates nothing", async () => {
    const before = await prisma.client.count({ where: { agencyId: A.agency.id } });
    await expect(
      createAirInvoice(A.ctx, {
        newClient: { name: "Someone Else", phone: "01711000111" },
        date: "2026-10-25",
        tickets: [ticket("1761000000002")],
        post: true,
      }),
    ).rejects.toThrow(/Karim Hossain .* already has this mobile number/);
    expect(await prisma.client.count({ where: { agencyId: A.agency.id } })).toBe(before);
  });

  it("needs either a client or a new client", async () => {
    await expect(
      createAirInvoice(A.ctx, { date: "2026-10-25", tickets: [ticket("1761000000003")], post: true }),
    ).rejects.toThrow(/Choose a client/);
  });

  it("rejects an extra fee larger than the client price", async () => {
    await expect(
      createAirInvoice(A.ctx, {
        newClient: { name: "Fee Test", phone: "01811000222" },
        date: "2026-10-25",
        tickets: [ticket("1761000000004", { extraFee: "60000" })],
        post: true,
      }),
    ).rejects.toThrow(/extra fee is part of the client price/);
  });
});

describe("invoice with money received", () => {
  it("writes a money receipt on the invoice in the same save", async () => {
    const r = await createAirInvoice(A.ctx, {
      newClient: { name: "Rahima Akter", phone: "01911000333" },
      date: "2026-10-25",
      discount: "500",
      tickets: [ticket("1761000000005")],
      payment: { moneyAccountId: cashId, paymentMethod: "CASH", amount: "20000" },
      post: true,
    });
    const inv = (await getAirInvoice(A.ctx, r.id))!;
    expect([inv.netTotal, inv.paidAmount, inv.due, inv.status]).toEqual([
      "48000.00",
      "20000.00",
      "28000.00",
      "PARTIAL",
    ]);
    expect(inv.payments).toHaveLength(1);
    const cash = await prisma.moneyAccount.findUniqueOrThrow({ where: { id: cashId } });
    expect(cash.balance.toFixed(2)).toBe("20000.00");
    const client = await prisma.client.findUniqueOrThrow({ where: { id: inv.client.id } });
    expect(client.balance.toFixed(2)).toBe("28000.00");
    const integrity = await checkLedgerIntegrity(tenantDb(A.agency.id), A.agency.id);
    expect(integrity.drift).toEqual([]);
    expect(integrity.unbalancedEntries).toEqual([]);
  });

  it("refuses a payment on a draft or above the total, and saves nothing", async () => {
    const count = await prisma.invoice.count({ where: { agencyId: A.agency.id } });
    await expect(
      createAirInvoice(A.ctx, {
        newClient: { name: "Draft Person", phone: "01611000444" },
        date: "2026-10-25",
        tickets: [ticket("1761000000006")],
        payment: { moneyAccountId: cashId, paymentMethod: "CASH", amount: "1000" },
        post: false,
      }),
    ).rejects.toThrow(/draft cannot take a payment/);
    await expect(
      createAirInvoice(A.ctx, {
        newClient: { name: "Over Payer", phone: "01611000555" },
        date: "2026-10-25",
        tickets: [ticket("1761000000007")],
        payment: { moneyAccountId: cashId, paymentMethod: "CASH", amount: "90000" },
        post: true,
      }),
    ).rejects.toThrow(/more than the invoice total/);
    expect(await prisma.invoice.count({ where: { agencyId: A.agency.id } })).toBe(count);
    expect(await prisma.client.count({ where: { agencyId: A.agency.id, phone: "01611000555" } })).toBe(0);
  });
});
