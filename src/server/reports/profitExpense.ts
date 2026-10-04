// Profit breakdowns (visa, group, ticket) and expense reports (PLAN.md
// section 7 "Profit/Loss" and "Expense").
import { Prisma } from "@prisma/client";
import type { ReportParams } from "@/lib/reports/params";
import type { ReportResult } from "@/lib/reports/types";
import { invoiceHref } from "@/lib/invoiceTypes";
import { tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "@/server/services/context";
import { LIVE, eq, money, page, paging, period, periodLabel, total, totals } from "./kit";

type Dec = Prisma.Decimal;

export async function visaProfit(ctx: ServiceContext, p: ReportParams): Promise<ReportResult> {
  const a = ctx.agencyId;
  const rows = await tenantDb(a).$queryRaw<
    { country: string; visaType: string | null; n: bigint; sales: Dec; cost: Dec; profit: Dec }[]
  >`
    SELECT v.country, vt.name AS "visaType", COUNT(*) AS n, SUM(v."clientPrice") AS sales,
           SUM(v."purchasePrice") AS cost, SUM(v.profit) AS profit
    FROM "InvoiceVisaLine" v JOIN "Invoice" i ON i.id = v."invoiceId"
    LEFT JOIN "VisaType" vt ON vt.id = v."visaTypeId"
    WHERE v."agencyId" = ${a} AND i.status::text IN ${LIVE} ${period(Prisma.sql`i.date`, p)}
    GROUP BY v.country, vt.name ORDER BY profit DESC`;
  const out = rows.map((r) => ({
    country: r.country,
    visaType: r.visaType ?? "-",
    visas: Number(r.n),
    sales: money(r.sales),
    cost: money(r.cost),
    profit: money(r.profit),
  }));
  return {
    key: "visa-profit",
    title: "Visa wise Profit",
    subtitle: periodLabel(p),
    columns: [
      { key: "country", title: "Country", width: 2 },
      { key: "visaType", title: "Visa type" },
      { key: "visas", title: "Visas", type: "number" },
      { key: "sales", title: "Sales", type: "money" },
      { key: "cost", title: "Cost", type: "money" },
      { key: "profit", title: "Profit", type: "money" },
    ],
    rows: out,
    totals: { country: "Total", ...totals(out, ["sales", "cost", "profit"]) },
    notes: ["Line figures before any refunds."],
  };
}

export async function groupProfit(ctx: ServiceContext, p: ReportParams): Promise<ReportResult> {
  const a = ctx.agencyId;
  const rows = await tenantDb(a).$queryRaw<
    { kind: string; name: string; n: bigint; sales: Dec; cost: Dec; profit: Dec }[]
  >`
    SELECT 'Tour group' AS kind, tg.name, COUNT(*) AS n,
           SUM(i."netTotal" - i."refundCredit") AS sales, SUM(i."totalCost" - i."refundCost") AS cost,
           SUM(i.profit - i."refundCredit" + i."refundCost") AS profit
    FROM "Invoice" i JOIN "TourGroup" tg ON tg.id = i."tourGroupId"
    WHERE i."agencyId" = ${a} AND i.status::text IN ${LIVE} ${period(Prisma.sql`i.date`, p)}
    GROUP BY tg.name
    UNION ALL
    SELECT initcap(g.type::text) || ' group', g.name, COUNT(*),
           SUM(i."netTotal" - i."refundCredit"), SUM(i."totalCost" - i."refundCost"),
           SUM(i.profit - i."refundCredit" + i."refundCost")
    FROM "Invoice" i JOIN "Group" g ON g.id = i."groupId"
    WHERE i."agencyId" = ${a} AND i.status::text IN ${LIVE} ${period(Prisma.sql`i.date`, p)}
    GROUP BY g.type, g.name
    ORDER BY profit DESC`;
  const out = rows.map((r) => ({
    kind: r.kind,
    name: r.name,
    invoices: Number(r.n),
    sales: money(r.sales),
    cost: money(r.cost),
    profit: money(r.profit),
  }));
  return {
    key: "group-profit",
    title: "Group wise Profit",
    subtitle: periodLabel(p),
    columns: [
      { key: "kind", title: "Kind" },
      { key: "name", title: "Group", width: 2 },
      { key: "invoices", title: "Invoices", type: "number" },
      { key: "sales", title: "Sales", type: "money" },
      { key: "cost", title: "Cost", type: "money" },
      { key: "profit", title: "Profit", type: "money" },
    ],
    rows: out,
    totals: { kind: "Total", ...totals(out, ["sales", "cost", "profit"]) },
    notes: ["Invoices with a tour group or a Hajj / Umrah group on their header."],
  };
}

export async function ticketProfit(
  ctx: ServiceContext,
  p: ReportParams,
  all = false,
): Promise<ReportResult> {
  const a = ctx.agencyId;
  const where = Prisma.sql`t."agencyId" = ${a} AND i.status::text IN ${LIVE} ${period(Prisma.sql`i.date`, p)}
    ${eq(Prisma.sql`t."airlineId"`, p.airlineId)} ${eq(Prisma.sql`i."clientId"`, p.clientId)}`;
  const db = tenantDb(a);
  const [rows, [agg]] = await Promise.all([
    db.$queryRaw<
      {
        invoiceId: string;
        type: string;
        number: string;
        date: Date;
        ticketNo: string;
        pax: string;
        route: string;
        iata: string | null;
        sales: Dec;
        cost: Dec;
        profit: Dec;
      }[]
    >`
      SELECT i.id AS "invoiceId", i.type::text AS type, i.number, i.date, t."ticketNo", t."passengerName" AS pax, t.route,
             al.iata, t."clientPrice" AS sales, t."purchasePrice" AS cost, t.profit
      FROM "InvoiceAirTicket" t JOIN "Invoice" i ON i.id = t."invoiceId" JOIN "Airline" al ON al.id = t."airlineId"
      WHERE ${where} ORDER BY i.date, i.number, t."sortOrder" ${page(p, all)}`,
    db.$queryRaw<{ n: bigint; sales: Dec; cost: Dec; profit: Dec }[]>`
      SELECT COUNT(*) AS n, SUM(t."clientPrice") AS sales, SUM(t."purchasePrice") AS cost, SUM(t.profit) AS profit
      FROM "InvoiceAirTicket" t JOIN "Invoice" i ON i.id = t."invoiceId" WHERE ${where}`,
  ]);
  return {
    key: "ticket-profit",
    title: "Ticket wise Profit",
    subtitle: periodLabel(p),
    columns: [
      { key: "date", title: "Date", type: "date" },
      { key: "invoice", title: "Invoice", link: true },
      { key: "ticket", title: "Ticket" },
      { key: "pax", title: "Passenger", width: 2 },
      { key: "route", title: "Route" },
      { key: "sales", title: "Client price", type: "money" },
      { key: "cost", title: "Purchase", type: "money" },
      { key: "profit", title: "Profit", type: "money" },
    ],
    rows: rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      invoice: r.number,
      ticket: r.ticketNo,
      pax: r.pax,
      route: `${r.iata ? `${r.iata} ` : ""}${r.route}`,
      sales: money(r.sales),
      cost: money(r.cost),
      profit: money(r.profit),
      _href: invoiceHref(r.type, r.invoiceId),
    })),
    totals: {
      invoice: `${Number(agg?.n ?? 0)} tickets`,
      sales: money(agg?.sales),
      cost: money(agg?.cost),
      profit: money(agg?.profit),
    },
    paging: paging(p, all, agg?.n ?? 0),
  };
}

export async function expenseHeads(ctx: ServiceContext, p: ReportParams): Promise<ReportResult> {
  const a = ctx.agencyId;
  const rows = await tenantDb(a).$queryRaw<{ head: string; n: bigint; amount: Dec }[]>`
    SELECT h.name AS head, COUNT(*) AS n, SUM(v.amount) AS amount
    FROM "Voucher" v JOIN "ExpenseHead" h ON h.id = v."expenseHeadId"
    WHERE v."agencyId" = ${a} AND v.kind = 'EXPENSE' AND v.status = 'POSTED' ${period(Prisma.sql`v.date`, p)}
    GROUP BY h.name ORDER BY amount DESC`;
  const out = rows.map((r) => ({ head: r.head, entries: Number(r.n), amount: money(r.amount) }));
  const sum = total(out, "amount");
  const withShare = out.map((r) => ({
    ...r,
    share:
      sum === "0.00"
        ? "-"
        : `${new Prisma.Decimal(r.amount).dividedBy(sum).times(100).toFixed(1)}%`,
  }));
  return {
    key: "expense-heads",
    title: "Office Expenses",
    subtitle: periodLabel(p),
    columns: [
      { key: "head", title: "Expense head", width: 3 },
      { key: "entries", title: "Entries", type: "number" },
      { key: "amount", title: "Amount", type: "money" },
      { key: "share", title: "Share" },
    ],
    rows: withShare,
    totals: { head: "Total", amount: sum },
    notes: ["Salaries are in the Salaries report."],
  };
}

export async function salaries(ctx: ServiceContext, p: ReportParams): Promise<ReportResult> {
  const a = ctx.agencyId;
  const rows = await tenantDb(a).$queryRaw<
    {
      number: string;
      month: string;
      employee: string;
      basic: Dec;
      allowances: Dec;
      deductions: Dec;
      advance: Dec;
      net: Dec;
      date: Date;
    }[]
  >`
    SELECT pr.number, pr.month, e.name AS employee, pr.basic, pr."allowanceTotal" AS allowances,
           pr."deductionTotal" AS deductions, pr."advanceAdjusted" AS advance, pr."netPaid" AS net, pr.date
    FROM "Payroll" pr JOIN "Employee" e ON e.id = pr."employeeId"
    WHERE pr."agencyId" = ${a} AND pr.status = 'POSTED' ${period(Prisma.sql`pr.date`, p)}
    ORDER BY pr.month, e.name`;
  const out = rows.map((r) => ({
    month: r.month,
    employee: r.employee,
    number: r.number,
    basic: money(r.basic),
    allowances: money(r.allowances),
    deductions: money(r.deductions),
    advance: money(r.advance),
    net: money(r.net),
    paid: r.date.toISOString().slice(0, 10),
  }));
  return {
    key: "salaries",
    title: "Salaries",
    subtitle: periodLabel(p, "Paid "),
    columns: [
      { key: "month", title: "Month" },
      { key: "employee", title: "Employee", width: 2 },
      { key: "number", title: "Payroll" },
      { key: "basic", title: "Basic", type: "money" },
      { key: "allowances", title: "Allowances", type: "money" },
      { key: "deductions", title: "Deductions", type: "money" },
      { key: "advance", title: "Advance recovered", type: "money" },
      { key: "net", title: "Net paid", type: "money" },
      { key: "paid", title: "Paid on", type: "date" },
    ],
    rows: out,
    totals: {
      month: "Total",
      ...totals(out, ["basic", "allowances", "deductions", "advance", "net"]),
    },
  };
}
