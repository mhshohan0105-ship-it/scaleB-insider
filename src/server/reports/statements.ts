// Financial statements from the ledger: Overall Profit & Loss, Trial Balance
// and Balance Sheet (PLAN.md section 7 "Profit/Loss" and "Accounting").
import { formatDate } from "@/lib/format";
import type { ReportParams } from "@/lib/reports/params";
import type { ReportResult, ReportRow } from "@/lib/reports/types";
import { todayIso } from "@/lib/dates";
import type { ServiceContext } from "@/server/services/context";
import { ledgerSums, natural, sumOf, type AccountSum } from "./ledgerSums";

const money = (v: { toFixed(n: number): string }) => v.toFixed(2);

function rangeLabel(from?: string, to?: string) {
  if (from && to) return `${formatDate(from)} to ${formatDate(to)}`;
  if (from) return `From ${formatDate(from)}`;
  if (to) return `Up to ${formatDate(to)}`;
  return "All dates";
}

function accountRows(accounts: AccountSum[], valueKey = "amount"): ReportRow[] {
  return accounts
    .filter((a) => !natural(a).isZero())
    .map((a) => ({ account: `${a.code}  ${a.name}`, [valueKey]: money(natural(a)), _level: 1 }));
}

export async function profitAndLoss(ctx: ServiceContext, p: ReportParams): Promise<ReportResult> {
  const sums = await ledgerSums(ctx, { from: p.from, to: p.to });
  const income = sums.filter((a) => a.type === "INCOME");
  const expense = sums.filter((a) => a.type === "EXPENSE");
  const totalIncome = sumOf(income.map(natural));
  const totalExpense = sumOf(expense.map(natural));
  const net = totalIncome.minus(totalExpense);
  const cogs = sumOf(expense.filter((a) => a.systemKey?.startsWith("COGS_")).map(natural));
  const sales = sumOf(income.filter((a) => a.systemKey?.startsWith("SALES_")).map(natural));

  return {
    key: "profit-loss",
    title: "Profit & Loss",
    subtitle: rangeLabel(p.from, p.to),
    columns: [
      { key: "account", title: "Account", width: 3 },
      { key: "amount", title: "Amount", type: "money" },
    ],
    rows: [
      { account: "Income", _kind: "section" },
      ...accountRows(income),
      { account: "Total income", amount: money(totalIncome), _kind: "subtotal" },
      { account: "Expenses", _kind: "section" },
      ...accountRows(expense),
      { account: "Total expenses", amount: money(totalExpense), _kind: "subtotal" },
      { account: net.isNegative() ? "Net loss" : "Net profit", amount: money(net), _kind: "total" },
    ],
    summary: [
      { label: "Sales", value: money(sales) },
      { label: "Gross profit", value: money(sales.minus(cogs)) },
      {
        label: net.isNegative() ? "Net loss" : "Net profit",
        value: money(net),
        tone: net.isNegative() ? "bad" : "good",
      },
    ],
  };
}

export async function trialBalance(ctx: ServiceContext, p: ReportParams): Promise<ReportResult> {
  const asOf = p.asOf ?? todayIso();
  const sums = await ledgerSums(ctx, { to: asOf });
  const rows: ReportRow[] = sums
    .filter((a) => !a.net.isZero())
    .map((a) => ({
      code: a.code,
      account: a.name,
      type: a.type.charAt(0) + a.type.slice(1).toLowerCase(),
      debit: a.net.greaterThan(0) ? money(a.net) : null,
      credit: a.net.lessThan(0) ? money(a.net.negated()) : null,
    }));
  const totalDebit = sumOf(sums.filter((a) => a.net.greaterThan(0)).map((a) => a.net));
  const totalCredit = sumOf(sums.filter((a) => a.net.lessThan(0)).map((a) => a.net.negated()));
  const balanced = totalDebit.equals(totalCredit);
  return {
    key: "trial-balance",
    title: "Trial Balance",
    subtitle: `As of ${formatDate(asOf)}`,
    columns: [
      { key: "code", title: "Code", width: 0.7 },
      { key: "account", title: "Account", width: 3 },
      { key: "type", title: "Type" },
      { key: "debit", title: "Debit", type: "money" },
      { key: "credit", title: "Credit", type: "money" },
    ],
    rows,
    totals: { account: "Total", debit: money(totalDebit), credit: money(totalCredit) },
    summary: [
      { label: "Total debits", value: money(totalDebit) },
      { label: "Total credits", value: money(totalCredit) },
      {
        label: "Status",
        value: balanced ? "Balanced" : "NOT balanced",
        tone: balanced ? "good" : "bad",
      },
    ],
  };
}

export async function balanceSheet(ctx: ServiceContext, p: ReportParams): Promise<ReportResult> {
  const asOf = p.asOf ?? todayIso();
  const sums = await ledgerSums(ctx, { to: asOf });
  const of = (t: AccountSum["type"]) => sums.filter((a) => a.type === t);
  const assets = of("ASSET");
  const liabilities = of("LIABILITY");
  const equity = of("EQUITY");
  const profit = sumOf(of("INCOME").map(natural)).minus(sumOf(of("EXPENSE").map(natural)));

  const totalAssets = sumOf(assets.map(natural));
  const totalLiabilities = sumOf(liabilities.map(natural));
  const totalEquity = sumOf(equity.map(natural)).plus(profit);
  const balanced = totalAssets.equals(totalLiabilities.plus(totalEquity));

  return {
    key: "balance-sheet",
    title: "Balance Sheet",
    subtitle: `As of ${formatDate(asOf)}`,
    columns: [
      { key: "account", title: "Account", width: 3 },
      { key: "amount", title: "Amount", type: "money" },
    ],
    rows: [
      { account: "Assets", _kind: "section" },
      ...accountRows(assets),
      { account: "Total assets", amount: money(totalAssets), _kind: "subtotal" },
      { account: "Liabilities", _kind: "section" },
      ...accountRows(liabilities),
      { account: "Total liabilities", amount: money(totalLiabilities), _kind: "subtotal" },
      { account: "Equity", _kind: "section" },
      ...accountRows(equity),
      { account: "Profit to date (not yet closed)", amount: money(profit), _level: 1 },
      { account: "Total equity", amount: money(totalEquity), _kind: "subtotal" },
      {
        account: "Total liabilities and equity",
        amount: money(totalLiabilities.plus(totalEquity)),
        _kind: "total",
      },
    ],
    summary: [
      { label: "Assets", value: money(totalAssets) },
      { label: "Liabilities + equity", value: money(totalLiabilities.plus(totalEquity)) },
      {
        label: "Status",
        value: balanced ? "Balanced" : "NOT balanced",
        tone: balanced ? "good" : "bad",
      },
    ],
  };
}
