// Phase 5: core reports agree with a hand calculation.
//
// Scenario: cash opening 1,00,000; air invoice (sales 74,500, service charge
// 1,000, discount 500 → client owes 75,000; vendor cost 71,025); receipt of
// 30,000 with a 150 transaction charge; vendor payment 50,000.
//
//   Income   = 74,500 + 1,000                 = 75,500
//   Expenses = 71,025 + 500 + 150             = 71,675  → net profit 3,825
//   Assets   = cash 79,850 + receivable 45,000 = 1,24,850
//   Liab.    = payable 21,025
//   Equity   = opening 1,00,000 + profit 3,825 = 1,03,825
import { todayIso } from "@/lib/dates";
import { beforeAll, describe, expect, it } from "vitest";
import { cellText } from "@/lib/reports/format";
import { parseReportParams } from "@/lib/reports/params";
import { tenantDb } from "@/server/db/tenant";
import { createMoneyAccount } from "@/server/services/accounts/moneyAccountService";
import { createAirInvoice } from "@/server/services/invoices/airInvoiceService";
import { saveMaster } from "@/server/services/masters/masterService";
import { createMoneyReceipt } from "@/server/services/payments/receiptService";
import { createVendorPayment } from "@/server/services/payments/vendorPaymentService";
import { makeAgency } from "@/tests/integration/helpers";
import { REPORTS } from "./registry";

let A: Awaited<ReturnType<typeof makeAgency>>;
let clientId: string;
const day = "2026-09-28";
const params = (raw: Record<string, string> = {}) => parseReportParams(raw);

beforeAll(async () => {
  A = await makeAgency("rep");
  const cash = (
    await createMoneyAccount(A.ctx, { name: "Till", kind: "CASH", openingBalance: "100000" })
  ).id;
  clientId = (
    await saveMaster(A.ctx, "clients", null, {
      name: "Report Client",
      type: "INDIVIDUAL",
      creditLimit: "0",
      openingBalance: "0",
      openingBalanceType: "RECEIVABLE",
    })
  ).id;
  const vendorId = (
    await saveMaster(A.ctx, "vendors", null, {
      name: "Report Vendor",
      type: "OTHER",
      commissionPercent: "0",
      openingBalance: "0",
      openingBalanceType: "PAYABLE",
    })
  ).id;
  const airlineId = (
    await tenantDb(A.agency.id).airline.findFirstOrThrow({ where: { iata: "EK" } })
  ).id;
  const t = (no: string, base: string, tax: string, price: string) => ({
    ticketNo: no,
    airlineId,
    vendorId,
    passengerName: "REPORT PAX",
    route: "DAC-DXB",
    journeyDate: "2026-10-15",
    baseFare: base,
    taxes: [{ code: "BD", amount: tax }],
    commissionPercent: "7",
    clientPrice: price,
  });
  await createAirInvoice(A.ctx, {
    clientId,
    date: day,
    discount: "500",
    serviceCharge: "1000",
    tickets: [
      t("9990000000001", "40000", "10000", "49500"),
      t("9990000000002", "20000", "5000", "25000"),
    ],
  });
  await createMoneyReceipt(A.ctx, {
    clientId,
    date: day,
    moneyAccountId: cash,
    paymentMethod: "CASH",
    amount: "30000",
    transactionCharge: "150",
  });
  await createVendorPayment(A.ctx, {
    vendorId,
    date: day,
    moneyAccountId: cash,
    paymentMethod: "CASH",
    amount: "50000",
  });
});

const summary = (r: { summary?: { label: string; value: string }[] }) =>
  Object.fromEntries((r.summary ?? []).map((s) => [s.label, s.value]));

describe("statements", () => {
  it("profit & loss", async () => {
    const r = await REPORTS["profit-loss"](A.ctx, params({ from: "2026-09-01", to: "2026-09-30" }));
    const byName = Object.fromEntries(r.rows.map((x) => [x.account, x.amount]));
    expect(byName["Total income"]).toBe("75500.00");
    expect(byName["Total expenses"]).toBe("71675.00");
    expect(byName["Net profit"]).toBe("3825.00");
    expect(summary(r)).toMatchObject({ Sales: "74500.00", "Gross profit": "3475.00" });

    const empty = await REPORTS["profit-loss"](
      A.ctx,
      params({ from: "2026-10-01", to: "2026-10-31" }),
    );
    expect(empty.rows.find((x) => x._kind === "total")?.amount).toBe("0.00");
  });

  it("trial balance balances", async () => {
    const r = await REPORTS["trial-balance"](A.ctx, params({ asOf: day }));
    expect(r.totals?.debit).toBe(r.totals?.credit);
    expect(summary(r).Status).toBe("Balanced");
    // Before anything was posted, nothing shows.
    const before = await REPORTS["trial-balance"](A.ctx, params({ asOf: "2000-01-01" }));
    expect(before.rows).toEqual([]);
  });

  it("balance sheet balances with profit to date in equity", async () => {
    // Opening balances are dated the day the test runs, so look from whichever is later.
    const asOf = todayIso() > day ? todayIso() : day;
    const r = await REPORTS["balance-sheet"](A.ctx, params({ asOf }));
    const byName = Object.fromEntries(r.rows.map((x) => [x.account, x.amount]));
    expect(byName["Total assets"]).toBe("124850.00");
    expect(byName["Total liabilities"]).toBe("21025.00");
    expect(byName["Profit to date (not yet closed)"]).toBe("3825.00");
    expect(byName["Total equity"]).toBe("103825.00");
    expect(byName["Total liabilities and equity"]).toBe("124850.00");
    expect(summary(r).Status).toBe("Balanced");
  });
});

describe("party reports", () => {
  it("due & advance for clients and vendors", async () => {
    const clients = await REPORTS["due-advance"](A.ctx, params({ party: "clients", asOf: day }));
    expect(clients.totals).toMatchObject({ due: "45000.00", advance: "0.00" });
    const vendors = await REPORTS["due-advance"](A.ctx, params({ party: "vendors", asOf: day }));
    expect(vendors.totals).toMatchObject({ due: "0.00", advance: "21025.00" });
    const onlyDue = await REPORTS["due-advance"](
      A.ctx,
      params({ party: "vendors", show: "due", asOf: day }),
    );
    expect(onlyDue.rows).toEqual([]);
    // As of before the documents, nobody owed anything.
    const early = await REPORTS["due-advance"](
      A.ctx,
      params({ party: "clients", asOf: "2026-01-01" }),
    );
    expect(early.rows).toEqual([]);
  });

  it("client ledger statement", async () => {
    const r = await REPORTS["party-ledger"](A.ctx, params({ party: "clients", partyId: clientId }));
    expect(r.rows.map((x) => [x.debit ?? null, x.credit ?? null, x.balance])).toEqual([
      ["75000.00", null, "75000.00"],
      [null, "30000.00", "45000.00"],
    ]);
    expect(r.totals).toMatchObject({ debit: "75000.00", credit: "30000.00", balance: "45000.00" });
    const withOpening = await REPORTS["party-ledger"](
      A.ctx,
      params({ party: "clients", partyId: clientId, from: "2026-09-29" }),
    );
    expect(withOpening.rows[0]).toMatchObject({ details: "Opening balance", balance: "45000.00" });
  });
});

describe("sales report", () => {
  it("totals and filters", async () => {
    const r = await REPORTS.sales(A.ctx, params({ from: "2026-09-01", to: "2026-09-30" }));
    expect(r.totals).toMatchObject({
      sales: "75000.00",
      cost: "71025.00",
      profit: "3975.00",
      received: "30000.00",
      due: "45000.00",
    });
    const other = await REPORTS.sales(A.ctx, params({ clientId: "nobody000000000000000000" }));
    expect(other.rows).toEqual([]);
  });
});

describe("date boundaries in raw SQL", () => {
  it("a range starting or ending on the document date includes it", async () => {
    // Regression: dates sent as timestamps were shifted by the DB time zone
    // (UTC+6), which dropped documents on the first day of a range.
    const same = await REPORTS["party-ledger"](
      A.ctx,
      params({ party: "clients", partyId: clientId, from: day, to: day }),
    );
    expect(same.rows.filter((r) => r._kind !== "subtotal")).toHaveLength(2);
    expect(same.rows[0]).toMatchObject({ details: "Opening balance", balance: "0.00" });
    const dueOnDay = await REPORTS["due-advance"](A.ctx, params({ party: "clients", asOf: day }));
    expect(dueOnDay.totals?.due).toBe("45000.00");
  });
});

describe("phase 11 reports", () => {
  const sep = params({ from: "2026-09-01", to: "2026-09-30" });

  it("every report runs, on screen and for export", async () => {
    for (const [key, run] of Object.entries(REPORTS)) {
      const screen = await run(A.ctx, sep);
      const all = await run(A.ctx, sep, true);
      expect(screen.columns.length, key).toBeGreaterThan(0);
      expect(all.paging, key).toBeUndefined();
      // Every cell and total must format (as the screen, PDF and Excel do).
      for (const row of [...all.rows, all.totals ?? {}])
        for (const c of all.columns)
          expect(() => cellText(c, row[c.key]), `${key}.${c.key}`).not.toThrow();
    }
  });

  it("sales, airline and tax figures match the invoice", async () => {
    const earning = await REPORTS["sales-earning"](A.ctx, sep);
    expect(earning.rows[0]).toMatchObject({ type: "Air ticket", invoices: 1, sales: "75000.00" });
    const airline = await REPORTS["airline-sales"](A.ctx, sep);
    expect(airline.rows[0]).toMatchObject({ tickets: 2, fare: "75000.00", sales: "74500.00" });
    const tax = await REPORTS["tax-report"](A.ctx, sep);
    expect(tax.rows).toEqual([{ code: "BD", tickets: 2, amount: "15000.00" }]);
    // AIT 0.3% of each total fare: 150 + 75.
    const ait = await REPORTS["ait-report"](A.ctx, sep);
    expect(ait.totals?.ait).toBe("225.00");
    const tickets = await REPORTS["ticket-details"](A.ctx, sep);
    expect(tickets.totals).toMatchObject({ invoice: "2 tickets", sales: "74500.00" });
  });

  it("daily summary and collections line up", async () => {
    const daily = await REPORTS["daily-summary"](A.ctx, sep);
    expect(daily.rows.find((r) => r.period === day)).toMatchObject({
      sales: "75000.00",
      collected: "30000.00",
    });
    const collection = await REPORTS["sales-collection"](A.ctx, sep);
    expect(collection.rows[0]).toMatchObject({ sales: "75000.00", received: "30000.00" });
    const due = await REPORTS["salesman-client-due"](A.ctx, sep);
    expect(due.totals?.due).toBe("45000.00");
  });

  it("the audit trail shows what happened", async () => {
    const audit = await REPORTS["audit-trail"](A.ctx, params({}));
    expect(audit.rows.some((r) => r.action === "Created" && r.entity === "Invoice")).toBe(true);
  });
});
