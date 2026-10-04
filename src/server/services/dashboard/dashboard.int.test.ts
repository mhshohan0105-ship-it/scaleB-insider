import { beforeAll, describe, expect, it } from "vitest";
import { todayIso } from "@/lib/dates";
import { tenantDb } from "@/server/db/tenant";
import { createMoneyAccount } from "@/server/services/accounts/moneyAccountService";
import { createAirInvoice } from "@/server/services/invoices/airInvoiceService";
import { saveMaster } from "@/server/services/masters/masterService";
import { createMoneyReceipt } from "@/server/services/payments/receiptService";
import { makeAgency } from "@/tests/integration/helpers";
import { getDashboard } from "./dashboardService";

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
});
