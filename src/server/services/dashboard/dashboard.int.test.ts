import { beforeAll, describe, expect, it } from "vitest";
import { todayIso } from "@/lib/dates";
import { tenantDb } from "@/server/db/tenant";
import { createMoneyAccount } from "@/server/services/accounts/moneyAccountService";
import { createAirInvoice } from "@/server/services/invoices/airInvoiceService";
import { saveMaster } from "@/server/services/masters/masterService";
import { createMoneyReceipt } from "@/server/services/payments/receiptService";
import { makeAgency } from "@/tests/integration/helpers";
import { getDashboard, redactDashboard } from "./dashboardService";

let A: Awaited<ReturnType<typeof makeAgency>>;
const today = todayIso();
const inDays = (n: number) =>
  new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

beforeAll(async () => {
  A = await makeAgency("dash");
  const cash = (
    await createMoneyAccount(A.ctx, { name: "Cash box", kind: "CASH", openingBalance: "5000" })
  ).id;
  const clientId = (
    await saveMaster(A.ctx, "clients", null, {
      name: "Top Client",
      type: "INDIVIDUAL",
      creditLimit: "0",
      openingBalance: "0",
      openingBalanceType: "RECEIVABLE",
    })
  ).id;
  const vendorId = (
    await saveMaster(A.ctx, "vendors", null, {
      name: "Dash Vendor",
      type: "OTHER",
      commissionPercent: "0",
      openingBalance: "0",
      openingBalanceType: "PAYABLE",
    })
  ).id;
  const salesmanId = (
    await saveMaster(A.ctx, "employees", null, {
      name: "Sadia",
      salary: "0",
      commissionPercent: "0",
    })
  ).id;
  const airlineId = (
    await tenantDb(A.agency.id).airline.findFirstOrThrow({ where: { iata: "QR" } })
  ).id;
  await createAirInvoice(A.ctx, {
    clientId,
    salesmanId,
    date: today,
    discount: "100",
    tickets: [
      {
        ticketNo: "1570000000001",
        airlineId,
        vendorId,
        passengerName: "DASH PAX",
        route: "DAC-DOH",
        journeyDate: inDays(3),
        baseFare: "30000",
        taxes: [],
        commissionPercent: "0",
        clientPrice: "32000",
      },
    ],
  });
  await createMoneyReceipt(A.ctx, {
    clientId,
    date: today,
    moneyAccountId: cash,
    paymentMethod: "CASH",
    amount: "12000",
  });
});

describe("dashboard", () => {
  it("adds up today's business", async () => {
    const d = await getDashboard(A.ctx, { checkLedger: true });
    expect(d.sales).toEqual({ today: "31900.00", month: "31900.00", year: "31900.00" });
    expect(d.discount.today).toBe("100.00");
    expect(d.collection.today).toBe("12000.00");
    expect(d.receivable).toBe("19900.00");
    expect(d.payable).toBe("30090.00"); // 30,000 + 0.3% AIT on 30,000
    expect(d.accountsTotal).toBe("17000.00");
    expect(d.flights.map((f) => [f.passengerName, f.route, f.airline])).toEqual([
      ["DASH PAX", "DAC-DOH", "QR"],
    ]);
    expect(d.bestClients.month[0]).toMatchObject({
      name: "Top Client",
      amount: "31900.00",
      count: 1,
    });
    expect(d.bestSalesmen.year[0]).toMatchObject({ name: "Sadia" });
    expect(d.chart.find((c) => c.month === today.slice(0, 7))).toMatchObject({
      sales: "31900.00",
      purchase: "30090.00",
      collection: "12000.00",
      profit: "1810.00",
    });
    expect(d.ledgerHealthy).toBe(true);
  });

  it("gives the 30 day trend, comparisons, top dues and recent invoices", async () => {
    const d = await getDashboard(A.ctx, { checkLedger: false });
    expect(d.daily).toHaveLength(30);
    expect(d.daily[29]).toEqual({ date: today, sales: "31900.00", collection: "12000.00" });
    expect(d.daily[0]!.date).toBe(inDays(-29));
    expect(d.previous).toEqual({
      salesYesterday: "0.00",
      collectionYesterday: "0.00",
      salesLastMonth: "0.00",
      collectionLastMonth: "0.00",
    });
    expect(d.topDues).toHaveLength(1);
    expect(d.topDues[0]).toMatchObject({ name: "Top Client", balance: "19900.00" });
    expect(d.recent[0]).toMatchObject({ clientName: "Top Client", netTotal: "31900.00" });
    expect(d.overdue).toEqual({ count: 0, amount: "0.00", list: [] });
  });

  it("lists invoices past their due date", async () => {
    const db = tenantDb(A.agency.id);
    const client = await db.client.findFirstOrThrow({ where: { name: "Top Client" } });
    const vendor = await db.vendor.findFirstOrThrow({ where: { name: "Dash Vendor" } });
    const airline = await db.airline.findFirstOrThrow({ where: { iata: "QR" } });
    const r = await createAirInvoice(A.ctx, {
      clientId: client.id,
      date: inDays(-10),
      dueDate: inDays(-2),
      tickets: [
        {
          ticketNo: "1570000000002",
          airlineId: airline.id,
          vendorId: vendor.id,
          passengerName: "LATE PAX",
          route: "DAC-DOH",
          journeyDate: inDays(30),
          baseFare: "1000",
          taxes: [],
          commissionPercent: "0",
          clientPrice: "1500",
        },
      ],
    });
    const d = await getDashboard(A.ctx, { checkLedger: false });
    expect(d.overdue.count).toBe(1);
    expect(d.overdue.amount).toBe("1500.00");
    expect(d.overdue.list[0]).toMatchObject({ number: r.number, due: "1500.00" });
  });

  it("removes what a role may not see", async () => {
    const d = await getDashboard(A.ctx, { checkLedger: false });
    const none = redactDashboard(d, { accounts: false, expense: false, clients: false });
    expect(none.accounts).toEqual([]);
    expect(none.accountsTotal).toBe("0.00");
    expect(none.expenses).toEqual([]);
    expect(none.topDues).toEqual([]);
    expect(redactDashboard(d, { accounts: true, expense: true, clients: true })).toEqual(d);
  });
});
