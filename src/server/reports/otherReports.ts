// "Other" reports (PLAN.md section 7): summaries, accounts, discounts, vendor
// payments and purchases, tours, journey dates, visas by country, payroll,
// loans, transaction charges, refunds, logins and the audit trail.
import { Prisma } from "@prisma/client";
import { todayIso } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { invoiceHref } from "@/lib/invoiceTypes";
import { REFUND_TYPE_INFO, REFUND_METHOD_LABEL, type RefundTypeKey } from "@/lib/refundTypes";
import type { ReportParams } from "@/lib/reports/params";
import type { ReportResult } from "@/lib/reports/types";
import { sqlDate } from "@/server/db/sqlDate";
import { tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "@/server/services/context";
import {
  LIVE,
  dhakaTime,
  eq,
  money,
  page,
  paging,
  period,
  periodLabel,
  periodTs,
  total,
  totals,
} from "./kit";

type Dec = Prisma.Decimal;
const iso = (d: Date) => d.toISOString().slice(0, 10);

// ─── Daily / monthly summary ────────────────────────────────────────────────

async function summary(
  ctx: ServiceContext,
  p: ReportParams,
  monthly: boolean,
): Promise<ReportResult> {
  const a = ctx.agencyId;
  const bucket = (col: Prisma.Sql) =>
    monthly ? Prisma.sql`to_char(${col}, 'YYYY-MM')` : Prisma.sql`to_char(${col}, 'YYYY-MM-DD')`;
  const rows = await tenantDb(a).$queryRaw<
    {
      b: string;
      sales: Dec;
      cost: Dec;
      collected: Dec;
      paid: Dec;
      expenses: Dec;
      salaries: Dec;
      refunds: Dec;
    }[]
  >`
    WITH m AS (
      SELECT ${bucket(Prisma.sql`date`)} AS b, "netTotal" - "refundCredit" AS sales, "totalCost" - "refundCost" AS cost,
             0::numeric AS collected, 0::numeric AS paid, 0::numeric AS expenses, 0::numeric AS salaries, 0::numeric AS refunds
      FROM "Invoice" WHERE "agencyId" = ${a} AND status::text IN ${LIVE} ${period(Prisma.sql`date`, p)}
      UNION ALL
      SELECT ${bucket(Prisma.sql`date`)}, 0, 0, amount, 0, 0, 0, 0 FROM "MoneyReceipt"
      WHERE "agencyId" = ${a} AND status = 'POSTED' ${period(Prisma.sql`date`, p)}
      UNION ALL
      SELECT ${bucket(Prisma.sql`date`)}, 0, 0, 0, amount, 0, 0, 0 FROM "VendorPayment"
      WHERE "agencyId" = ${a} AND status = 'POSTED' ${period(Prisma.sql`date`, p)}
      UNION ALL
      SELECT ${bucket(Prisma.sql`date`)}, 0, 0, 0, 0, amount, 0, 0 FROM "Voucher"
      WHERE "agencyId" = ${a} AND kind = 'EXPENSE' AND status = 'POSTED' ${period(Prisma.sql`date`, p)}
      UNION ALL
      SELECT ${bucket(Prisma.sql`date`)}, 0, 0, 0, 0, 0, basic + "allowanceTotal" - "deductionTotal", 0 FROM "Payroll"
      WHERE "agencyId" = ${a} AND status = 'POSTED' ${period(Prisma.sql`date`, p)}
      UNION ALL
      SELECT ${bucket(Prisma.sql`date`)}, 0, 0, 0, 0, 0, 0, "clientRefundAmount" - "clientCharge" FROM "Refund"
      WHERE "agencyId" = ${a} AND status = 'POSTED' ${period(Prisma.sql`date`, p)}
    )
    SELECT b, SUM(sales) AS sales, SUM(cost) AS cost, SUM(collected) AS collected, SUM(paid) AS paid,
           SUM(expenses) AS expenses, SUM(salaries) AS salaries, SUM(refunds) AS refunds
    FROM m GROUP BY b ORDER BY b`;
  const out = rows.map((r) => {
    const gross = new Prisma.Decimal(r.sales).minus(r.cost);
    return {
      period: r.b,
      sales: money(r.sales),
      cost: money(r.cost),
      grossProfit: money(gross),
      expenses: money(r.expenses),
      salaries: money(r.salaries),
      net: money(gross.minus(r.expenses).minus(r.salaries)),
      collected: money(r.collected),
      paid: money(r.paid),
      refunds: money(r.refunds),
    };
  });
  return {
    key: monthly ? "monthly-summary" : "daily-summary",
    title: monthly ? "Monthly Summary" : "Daily Summary",
    subtitle: periodLabel(p),
    columns: [
      { key: "period", title: monthly ? "Month" : "Date", type: monthly ? "text" : "date" },
      { key: "sales", title: "Sales", type: "money" },
      { key: "cost", title: "Cost", type: "money" },
      { key: "grossProfit", title: "Gross profit", type: "money" },
      { key: "expenses", title: "Expenses", type: "money" },
      { key: "salaries", title: "Salaries", type: "money" },
      { key: "net", title: "Net", type: "money" },
      { key: "collected", title: "Collected", type: "money" },
      { key: "paid", title: "Paid vendors", type: "money" },
      { key: "refunds", title: "Refunded", type: "money" },
    ],
    rows: out,
    totals: {
      period: "Total",
      ...totals(out, [
        "sales",
        "cost",
        "grossProfit",
        "expenses",
        "salaries",
        "net",
        "collected",
        "paid",
        "refunds",
      ]),
    },
    notes: [
      "Sales, cost and gross profit are by invoice date and net of refunds; Net takes off expenses and salaries.",
      "The Profit & Loss report (from the ledger) is the complete statement.",
    ],
  };
}

export const dailySummary = (ctx: ServiceContext, p: ReportParams) => summary(ctx, p, false);
export const monthlySummary = (ctx: ServiceContext, p: ReportParams) => summary(ctx, p, true);

// ─── Accounts ───────────────────────────────────────────────────────────────

export async function accountsSummary(ctx: ServiceContext, p: ReportParams): Promise<ReportResult> {
  const a = ctx.agencyId;
  const before = p.from ? Prisma.sql`je.date < ${sqlDate(p.from)}` : Prisma.sql`FALSE`;
  const inRange = Prisma.sql`TRUE ${period(Prisma.sql`je.date`, p)}`;
  const rows = await tenantDb(a).$queryRaw<
    { id: string; name: string; kind: string; opening: Dec; moneyIn: Dec; moneyOut: Dec }[]
  >`
    SELECT ma.id, ma.name, ma.kind::text AS kind,
           COALESCE(SUM(jl.debit - jl.credit) FILTER (WHERE ${before}), 0) AS opening,
           COALESCE(SUM(jl.debit) FILTER (WHERE ${inRange}), 0) AS "moneyIn",
           COALESCE(SUM(jl.credit) FILTER (WHERE ${inRange}), 0) AS "moneyOut"
    FROM "MoneyAccount" ma
    LEFT JOIN "JournalLine" jl ON jl."moneyAccountId" = ma.id
    LEFT JOIN "JournalEntry" je ON je.id = jl."entryId" AND (${p.to ? Prisma.sql`je.date <= ${sqlDate(p.to)}` : Prisma.sql`TRUE`})
    WHERE ma."agencyId" = ${a}
    GROUP BY ma.id, ma.name, ma.kind ORDER BY ma.name`;
  const out = rows.map((r) => ({
    account: r.name,
    kind: r.kind.replace("_", " ").toLowerCase(),
    opening: money(r.opening),
    moneyIn: money(r.moneyIn),
    moneyOut: money(r.moneyOut),
    closing: money(new Prisma.Decimal(r.opening).plus(r.moneyIn).minus(r.moneyOut)),
  }));
  return {
    key: "accounts-summary",
    title: "Accounts",
    subtitle: periodLabel(p),
    columns: [
      { key: "account", title: "Account", width: 2 },
      { key: "kind", title: "Kind" },
      { key: "opening", title: "Opening", type: "money" },
      { key: "moneyIn", title: "In", type: "money" },
      { key: "moneyOut", title: "Out", type: "money" },
      { key: "closing", title: "Closing", type: "money" },
    ],
    rows: out,
    totals: { account: "Total", ...totals(out, ["opening", "moneyIn", "moneyOut", "closing"]) },
  };
}

// ─── Invoice based lists ────────────────────────────────────────────────────

export async function clientDiscount(
  ctx: ServiceContext,
  p: ReportParams,
  all = false,
): Promise<ReportResult> {
  const a = ctx.agencyId;
  const where = Prisma.sql`i."agencyId" = ${a} AND i.status::text IN ${LIVE} AND i.discount > 0 ${period(Prisma.sql`i.date`, p)} ${eq(Prisma.sql`i."clientId"`, p.clientId)}`;
  const db = tenantDb(a);
  const [rows, [agg]] = await Promise.all([
    db.$queryRaw<
      {
        id: string;
        type: string;
        number: string;
        date: Date;
        client: string;
        subtotal: Dec;
        discount: Dec;
        net: Dec;
      }[]
    >`
      SELECT i.id, i.type::text AS type, i.number, i.date, c.name AS client, i.subtotal, i.discount, i."netTotal" AS net
      FROM "Invoice" i JOIN "Client" c ON c.id = i."clientId" WHERE ${where} ORDER BY i.date, i.number ${page(p, all)}`,
    db.$queryRaw<
      { n: bigint; discount: Dec }[]
    >`SELECT COUNT(*) AS n, SUM(i.discount) AS discount FROM "Invoice" i WHERE ${where}`,
  ]);
  return {
    key: "client-discount",
    title: "Client Discount",
    subtitle: periodLabel(p),
    columns: [
      { key: "date", title: "Date", type: "date" },
      { key: "invoice", title: "Invoice", link: true },
      { key: "client", title: "Client", width: 2 },
      { key: "subtotal", title: "Before discount", type: "money" },
      { key: "discount", title: "Discount", type: "money" },
      { key: "net", title: "Invoice total", type: "money" },
    ],
    rows: rows.map((r) => ({
      date: iso(r.date),
      invoice: r.number,
      client: r.client,
      subtotal: money(r.subtotal),
      discount: money(r.discount),
      net: money(r.net),
      _href: invoiceHref(r.type, r.id),
    })),
    totals: { invoice: `${Number(agg?.n ?? 0)} invoices`, discount: money(agg?.discount) },
    paging: paging(p, all, agg?.n ?? 0),
  };
}

export async function tourPackage(ctx: ServiceContext, p: ReportParams): Promise<ReportResult> {
  const a = ctx.agencyId;
  const rows = await tenantDb(a).$queryRaw<
    {
      id: string;
      number: string;
      date: Date;
      client: string;
      tour: string | null;
      travel: Date | null;
      sales: Dec;
      cost: Dec;
      profit: Dec;
      due: Dec;
    }[]
  >`
    SELECT i.id, i.number, i.date, c.name AS client, tg.name AS tour, i."travelDate" AS travel,
           i."netTotal" - i."refundCredit" AS sales, i."totalCost" - i."refundCost" AS cost,
           i.profit - i."refundCredit" + i."refundCost" AS profit,
           GREATEST(i."netTotal" - i."refundCredit" - i."paidAmount", 0) AS due
    FROM "Invoice" i JOIN "Client" c ON c.id = i."clientId" LEFT JOIN "TourGroup" tg ON tg.id = i."tourGroupId"
    WHERE i."agencyId" = ${a} AND i.type = 'TOUR' AND i.status::text IN ${LIVE} ${period(Prisma.sql`i.date`, p)}
    ORDER BY i.date, i.number`;
  const out = rows.map((r) => ({
    date: iso(r.date),
    invoice: r.number,
    client: r.client,
    tour: r.tour,
    travel: r.travel ? iso(r.travel) : null,
    sales: money(r.sales),
    cost: money(r.cost),
    profit: money(r.profit),
    due: money(r.due),
    _href: invoiceHref("TOUR", r.id),
  }));
  return {
    key: "tour-package",
    title: "Tour Packages",
    subtitle: periodLabel(p),
    columns: [
      { key: "date", title: "Date", type: "date" },
      { key: "invoice", title: "Invoice", link: true },
      { key: "client", title: "Client", width: 2 },
      { key: "tour", title: "Tour group", width: 2 },
      { key: "travel", title: "Travel", type: "date" },
      { key: "sales", title: "Sales", type: "money" },
      { key: "cost", title: "Cost", type: "money" },
      { key: "profit", title: "Profit", type: "money" },
      { key: "due", title: "Due", type: "money" },
    ],
    rows: out,
    totals: {
      invoice: `${out.length} invoices`,
      ...totals(out, ["sales", "cost", "profit", "due"]),
    },
  };
}

export async function journeyDate(
  ctx: ServiceContext,
  p: ReportParams,
  all = false,
): Promise<ReportResult> {
  const a = ctx.agencyId;
  const where = Prisma.sql`t."agencyId" = ${a} AND i.status::text IN ('POSTED','PARTIAL','PAID') ${period(Prisma.sql`t."journeyDate"`, p)}
    ${eq(Prisma.sql`t."airlineId"`, p.airlineId)} ${eq(Prisma.sql`i."clientId"`, p.clientId)}`;
  const db = tenantDb(a);
  const [rows, [agg]] = await Promise.all([
    db.$queryRaw<
      {
        id: string;
        type: string;
        number: string;
        journey: Date;
        pax: string;
        iata: string | null;
        route: string;
        pnr: string | null;
        client: string;
        phone: string | null;
        vendor: string;
        due: Dec;
      }[]
    >`
      SELECT i.id, i.type::text AS type, i.number, t."journeyDate" AS journey, t."passengerName" AS pax, al.iata, t.route, t.pnr,
             c.name AS client, c.phone, v.name AS vendor, GREATEST(i."netTotal" - i."refundCredit" - i."paidAmount", 0) AS due
      FROM "InvoiceAirTicket" t JOIN "Invoice" i ON i.id = t."invoiceId" JOIN "Airline" al ON al.id = t."airlineId"
      JOIN "Client" c ON c.id = i."clientId" JOIN "Vendor" v ON v.id = t."vendorId"
      WHERE ${where} ORDER BY t."journeyDate", t."passengerName" ${page(p, all)}`,
    db.$queryRaw<
      { n: bigint }[]
    >`SELECT COUNT(*) AS n FROM "InvoiceAirTicket" t JOIN "Invoice" i ON i.id = t."invoiceId" WHERE ${where}`,
  ]);
  return {
    key: "journey-date",
    title: "Journey Date wise",
    subtitle: periodLabel(p, "Journeys "),
    columns: [
      { key: "journey", title: "Journey", type: "date" },
      { key: "pax", title: "Passenger", width: 2 },
      { key: "route", title: "Flight" },
      { key: "pnr", title: "PNR" },
      { key: "client", title: "Client", width: 2 },
      { key: "phone", title: "Phone" },
      { key: "vendor", title: "Vendor", width: 2 },
      { key: "invoice", title: "Invoice", link: true },
      { key: "due", title: "Invoice due", type: "money" },
    ],
    rows: rows.map((r) => ({
      journey: iso(r.journey),
      pax: r.pax,
      route: `${r.iata ? `${r.iata} ` : ""}${r.route}`,
      pnr: r.pnr,
      client: r.client,
      phone: r.phone,
      vendor: r.vendor,
      invoice: r.number,
      due: money(r.due),
      _href: invoiceHref(r.type, r.id),
    })),
    totals: { journey: `${Number(agg?.n ?? 0)} tickets` },
    paging: paging(p, all, agg?.n ?? 0),
  };
}

export async function countryWise(ctx: ServiceContext, p: ReportParams): Promise<ReportResult> {
  const a = ctx.agencyId;
  const rows = await tenantDb(a).$queryRaw<
    {
      country: string;
      n: bigint;
      inProcess: bigint;
      delivered: bigint;
      rejected: bigint;
      sales: Dec;
      profit: Dec;
    }[]
  >`
    SELECT v.country, COUNT(*) AS n,
           COUNT(*) FILTER (WHERE v.status IN ('PENDING','SUBMITTED','APPROVED')) AS "inProcess",
           COUNT(*) FILTER (WHERE v.status = 'DELIVERED') AS delivered,
           COUNT(*) FILTER (WHERE v.status = 'REJECTED') AS rejected,
           SUM(v."clientPrice") AS sales, SUM(v.profit) AS profit
    FROM "InvoiceVisaLine" v JOIN "Invoice" i ON i.id = v."invoiceId"
    WHERE v."agencyId" = ${a} AND i.status::text IN ${LIVE} ${period(Prisma.sql`i.date`, p)}
    GROUP BY v.country ORDER BY n DESC`;
  const out = rows.map((r) => ({
    country: r.country,
    visas: Number(r.n),
    inProcess: Number(r.inProcess),
    delivered: Number(r.delivered),
    rejected: Number(r.rejected),
    sales: money(r.sales),
    profit: money(r.profit),
  }));
  return {
    key: "country-wise",
    title: "Country wise Visas",
    subtitle: periodLabel(p),
    columns: [
      { key: "country", title: "Country", width: 2 },
      { key: "visas", title: "Visas", type: "number" },
      { key: "inProcess", title: "In process", type: "number" },
      { key: "delivered", title: "Delivered", type: "number" },
      { key: "rejected", title: "Rejected", type: "number" },
      { key: "sales", title: "Sales", type: "money" },
      { key: "profit", title: "Profit", type: "money" },
    ],
    rows: out,
    totals: { country: "Total", ...totals(out, ["sales", "profit"]) },
  };
}

// ─── Vendors ────────────────────────────────────────────────────────────────

export async function vendorPayments(
  ctx: ServiceContext,
  p: ReportParams,
  all = false,
): Promise<ReportResult> {
  const a = ctx.agencyId;
  const where = Prisma.sql`vp."agencyId" = ${a} AND vp.status = 'POSTED' ${period(Prisma.sql`vp.date`, p)} ${eq(Prisma.sql`vp."vendorId"`, p.vendorId)}`;
  const db = tenantDb(a);
  const [rows, [agg]] = await Promise.all([
    db.$queryRaw<
      {
        number: string;
        date: Date;
        vendorId: string;
        vendor: string;
        account: string;
        method: string;
        amount: Dec;
        charge: Dec;
        reference: string | null;
      }[]
    >`
      SELECT vp.number, vp.date, v.id AS "vendorId", v.name AS vendor, ma.name AS account, vp."paymentMethod"::text AS method,
             vp.amount, vp."transactionCharge" AS charge, vp.reference
      FROM "VendorPayment" vp JOIN "Vendor" v ON v.id = vp."vendorId" JOIN "MoneyAccount" ma ON ma.id = vp."moneyAccountId"
      WHERE ${where} ORDER BY vp.date, vp.number ${page(p, all)}`,
    db.$queryRaw<{ n: bigint; amount: Dec; charge: Dec }[]>`
      SELECT COUNT(*) AS n, SUM(vp.amount) AS amount, SUM(vp."transactionCharge") AS charge FROM "VendorPayment" vp WHERE ${where}`,
  ]);
  return {
    key: "vendor-payments",
    title: "Vendor Payments",
    subtitle: periodLabel(p),
    columns: [
      { key: "date", title: "Date", type: "date" },
      { key: "number", title: "Payment" },
      { key: "vendor", title: "Vendor", width: 2, link: true },
      { key: "account", title: "From" },
      { key: "method", title: "Method" },
      { key: "reference", title: "Reference" },
      { key: "amount", title: "Amount", type: "money" },
      { key: "charge", title: "Charge", type: "money" },
    ],
    rows: rows.map((r) => ({
      date: iso(r.date),
      number: r.number,
      vendor: r.vendor,
      account: r.account,
      method: r.method.charAt(0) + r.method.slice(1).toLowerCase(),
      reference: r.reference,
      amount: money(r.amount),
      charge: money(r.charge),
      _href: `/vendors/${r.vendorId}`,
    })),
    totals: {
      number: `${Number(agg?.n ?? 0)} payments`,
      amount: money(agg?.amount),
      charge: money(agg?.charge),
    },
    paging: paging(p, all, agg?.n ?? 0),
  };
}

export async function vendorPurchases(
  ctx: ServiceContext,
  p: ReportParams,
  all = false,
): Promise<ReportResult> {
  const a = ctx.agencyId;
  const inv = Prisma.sql`i.status::text IN ${LIVE} ${period(Prisma.sql`i.date`, p)}`;
  const vf = (col: Prisma.Sql) => eq(col, p.vendorId);
  const base = Prisma.sql`
    WITH x AS (
      SELECT i.id AS "invoiceId", i.type::text AS type, i.number, i.date, t."vendorId", t."ticketNo" || ' · ' || t."passengerName" AS description, t."purchasePrice" AS cost
      FROM "InvoiceAirTicket" t JOIN "Invoice" i ON i.id = t."invoiceId" WHERE t."agencyId" = ${a} AND ${inv} ${vf(Prisma.sql`t."vendorId"`)}
      UNION ALL
      SELECT i.id, i.type::text, i.number, i.date, it."vendorId", it.description, it."purchasePrice"
      FROM "InvoiceItem" it JOIN "Invoice" i ON i.id = it."invoiceId"
      WHERE it."agencyId" = ${a} AND it."vendorId" IS NOT NULL AND it."purchasePrice" > 0 AND ${inv} ${vf(Prisma.sql`it."vendorId"`)}
      UNION ALL
      SELECT i.id, i.type::text, i.number, i.date, v."vendorId", v.country || ' visa · ' || v."passengerName", v."purchasePrice"
      FROM "InvoiceVisaLine" v JOIN "Invoice" i ON i.id = v."invoiceId" WHERE v."agencyId" = ${a} AND v."purchasePrice" > 0 AND ${inv} ${vf(Prisma.sql`v."vendorId"`)}
      UNION ALL
      SELECT i.id, i.type::text, i.number, i.date, r."vendorId", 'Reissue · ' || r."passengerName", r."purchasePrice"
      FROM "InvoiceReissueLine" r JOIN "Invoice" i ON i.id = r."invoiceId" WHERE r."agencyId" = ${a} AND r."purchasePrice" > 0 AND ${inv} ${vf(Prisma.sql`r."vendorId"`)}
    )`;
  const db = tenantDb(a);
  const [rows, [agg]] = await Promise.all([
    db.$queryRaw<
      {
        invoiceId: string;
        type: string;
        number: string;
        date: Date;
        vendor: string;
        description: string;
        cost: Dec;
      }[]
    >`
      ${base} SELECT x.*, vd.name AS vendor FROM x JOIN "Vendor" vd ON vd.id = x."vendorId" ORDER BY x.date, x.number ${page(p, all)}`,
    db.$queryRaw<
      { n: bigint; cost: Dec }[]
    >`${base} SELECT COUNT(*) AS n, SUM(cost) AS cost FROM x`,
  ]);
  return {
    key: "vendor-purchases",
    title: "Vendor Purchases",
    subtitle: periodLabel(p),
    columns: [
      { key: "date", title: "Date", type: "date" },
      { key: "invoice", title: "Invoice", link: true },
      { key: "vendor", title: "Vendor", width: 2 },
      { key: "description", title: "Item", width: 3 },
      { key: "cost", title: "Cost", type: "money" },
    ],
    rows: rows.map((r) => ({
      date: iso(r.date),
      invoice: r.number,
      vendor: r.vendor,
      description: r.description,
      cost: money(r.cost),
      _href: invoiceHref(r.type, r.invoiceId),
    })),
    totals: { invoice: `${Number(agg?.n ?? 0)} lines`, cost: money(agg?.cost) },
    paging: paging(p, all, agg?.n ?? 0),
    notes: ["Line costs as invoiced, before any refunds."],
  };
}

// ─── Payroll, loans, charges, refunds ───────────────────────────────────────

export async function payrollSummary(ctx: ServiceContext, p: ReportParams): Promise<ReportResult> {
  const a = ctx.agencyId;
  const rows = await tenantDb(a).$queryRaw<
    { employee: string; months: bigint; gross: Dec; advance: Dec; net: Dec; advanced: Dec }[]
  >`
    WITH pay AS (
      SELECT "employeeId" AS id, COUNT(*) AS months, SUM(basic + "allowanceTotal" - "deductionTotal") AS gross,
             SUM("advanceAdjusted") AS advance, SUM("netPaid") AS net
      FROM "Payroll" WHERE "agencyId" = ${a} AND status = 'POSTED' ${period(Prisma.sql`date`, p)} GROUP BY "employeeId"
    ), adv AS (
      SELECT "partyId" AS id, SUM(amount) AS advanced FROM "Voucher"
      WHERE "agencyId" = ${a} AND kind = 'EMPLOYEE_ADVANCE' AND status = 'POSTED' ${period(Prisma.sql`date`, p)} GROUP BY "partyId"
    )
    SELECT e.name AS employee, COALESCE(pay.months, 0) AS months, COALESCE(pay.gross, 0) AS gross,
           COALESCE(pay.advance, 0) AS advance, COALESCE(pay.net, 0) AS net, COALESCE(adv.advanced, 0) AS advanced
    FROM "Employee" e LEFT JOIN pay ON pay.id = e.id LEFT JOIN adv ON adv.id = e.id
    WHERE e."agencyId" = ${a} AND (pay.id IS NOT NULL OR adv.id IS NOT NULL)
    ORDER BY e.name`;
  const out = rows.map((r) => ({
    employee: r.employee,
    months: Number(r.months),
    gross: money(r.gross),
    advanced: money(r.advanced),
    advance: money(r.advance),
    net: money(r.net),
  }));
  return {
    key: "payroll-summary",
    title: "Payroll",
    subtitle: periodLabel(p),
    columns: [
      { key: "employee", title: "Employee", width: 2 },
      { key: "months", title: "Salaries paid", type: "number" },
      { key: "gross", title: "Salary", type: "money" },
      { key: "advanced", title: "Advances given", type: "money" },
      { key: "advance", title: "Advance recovered", type: "money" },
      { key: "net", title: "Net paid", type: "money" },
    ],
    rows: out,
    totals: { employee: "Total", ...totals(out, ["gross", "advanced", "advance", "net"]) },
  };
}

export async function loanReport(ctx: ServiceContext): Promise<ReportResult> {
  const a = ctx.agencyId;
  const rows = await tenantDb(a).$queryRaw<
    {
      id: string;
      number: string;
      kind: string;
      date: Date;
      authority: string;
      principal: Dec;
      rate: Dec;
      repaid: Dec;
      interest: Dec;
      status: string;
    }[]
  >`
    SELECT l.id, l.number, l.kind::text AS kind, l.date, la.name AS authority, l.principal, l."interestRate" AS rate, l.repaid,
           COALESCE((SELECT SUM(interest) FROM "LoanPayment" lp WHERE lp."loanId" = l.id AND lp.status = 'POSTED'), 0) AS interest,
           l.status::text AS status
    FROM "Loan" l JOIN "LoanAuthority" la ON la.id = l."authorityId"
    WHERE l."agencyId" = ${a} AND l.status <> 'VOID'
    ORDER BY l.kind, l.date`;
  const KIND: Record<string, string> = {
    TAKEN: "Taken",
    GIVEN: "Given",
    INVESTMENT: "Investment received",
  };
  const out = rows.map((r) => ({
    number: r.number,
    kind: KIND[r.kind] ?? r.kind,
    date: iso(r.date),
    authority: r.authority,
    principal: money(r.principal),
    rate: `${new Prisma.Decimal(r.rate).toFixed(2)}%`,
    repaid: money(r.repaid),
    outstanding: money(new Prisma.Decimal(r.principal).minus(r.repaid)),
    interest: money(r.interest),
    status: r.status === "CLOSED" ? "Repaid" : "Active",
    _href: `/loans/${r.id}`,
  }));
  return {
    key: "loan-report",
    title: "Loans",
    subtitle: `As of ${formatDate(todayIso())}`,
    columns: [
      { key: "number", title: "Loan", link: true },
      { key: "kind", title: "Kind" },
      { key: "date", title: "Date", type: "date" },
      { key: "authority", title: "Authority", width: 2 },
      { key: "principal", title: "Principal", type: "money" },
      { key: "rate", title: "Rate" },
      { key: "repaid", title: "Repaid", type: "money" },
      { key: "outstanding", title: "Outstanding", type: "money" },
      { key: "interest", title: "Interest paid / received", type: "money" },
      { key: "status", title: "Status" },
    ],
    rows: out,
    totals: {
      number: `${out.length} loans`,
      ...totals(out, ["principal", "repaid", "outstanding", "interest"]),
    },
  };
}

export async function transactionCharges(
  ctx: ServiceContext,
  p: ReportParams,
): Promise<ReportResult> {
  const a = ctx.agencyId;
  const rows = await tenantDb(a).$queryRaw<
    {
      kind: string;
      number: string;
      date: Date;
      party: string;
      account: string;
      amount: Dec;
      charge: Dec;
    }[]
  >`
    SELECT 'Money receipt' AS kind, r.number, r.date, c.name AS party, ma.name AS account, r.amount, r."transactionCharge" AS charge
    FROM "MoneyReceipt" r JOIN "Client" c ON c.id = r."clientId" JOIN "MoneyAccount" ma ON ma.id = r."moneyAccountId"
    WHERE r."agencyId" = ${a} AND r.status = 'POSTED' AND r."transactionCharge" > 0 ${period(Prisma.sql`r.date`, p)}
    UNION ALL
    SELECT 'Vendor payment', vp.number, vp.date, v.name, ma.name, vp.amount, vp."transactionCharge"
    FROM "VendorPayment" vp JOIN "Vendor" v ON v.id = vp."vendorId" JOIN "MoneyAccount" ma ON ma.id = vp."moneyAccountId"
    WHERE vp."agencyId" = ${a} AND vp.status = 'POSTED' AND vp."transactionCharge" > 0 ${period(Prisma.sql`vp.date`, p)}
    UNION ALL
    SELECT 'Balance transfer', bt.number, bt.date, f.name || ' → ' || t.name, f.name, bt.amount, bt.charge
    FROM "BalanceTransfer" bt JOIN "MoneyAccount" f ON f.id = bt."fromAccountId" JOIN "MoneyAccount" t ON t.id = bt."toAccountId"
    WHERE bt."agencyId" = ${a} AND bt.status = 'POSTED' AND bt.charge > 0 ${period(Prisma.sql`bt.date`, p)}
    ORDER BY date, number`;
  const out = rows.map((r) => ({
    date: iso(r.date),
    kind: r.kind,
    number: r.number,
    party: r.party,
    account: r.account,
    amount: money(r.amount),
    charge: money(r.charge),
  }));
  return {
    key: "transaction-charge",
    title: "Transaction Charges",
    subtitle: periodLabel(p),
    columns: [
      { key: "date", title: "Date", type: "date" },
      { key: "kind", title: "Document" },
      { key: "number", title: "Number" },
      { key: "party", title: "Party", width: 2 },
      { key: "account", title: "Account" },
      { key: "amount", title: "Amount", type: "money" },
      { key: "charge", title: "Charge", type: "money" },
    ],
    rows: out,
    totals: { date: "Total", charge: total(out, "charge") },
  };
}

export async function refundReport(
  ctx: ServiceContext,
  p: ReportParams,
  all = false,
): Promise<ReportResult> {
  const a = ctx.agencyId;
  const where = Prisma.sql`rf."agencyId" = ${a} AND rf.status = 'POSTED' ${period(Prisma.sql`rf.date`, p)} ${eq(Prisma.sql`rf."clientId"`, p.clientId)}`;
  const db = tenantDb(a);
  const [rows, [agg]] = await Promise.all([
    db.$queryRaw<
      {
        id: string;
        number: string;
        type: string;
        date: Date;
        client: string;
        invoice: string;
        refunded: Dec;
        charge: Dec;
        vendorCredit: Dec;
        method: string;
        returned: Dec;
      }[]
    >`
      SELECT rf.id, rf.number, rf.type::text AS type, rf.date, c.name AS client, i.number AS invoice,
             rf."clientRefundAmount" AS refunded, rf."clientCharge" AS charge,
             rf."vendorRefundAmount" - rf."vendorCharge" AS "vendorCredit", rf.method::text AS method, rf."returnAmount" AS returned
      FROM "Refund" rf JOIN "Client" c ON c.id = rf."clientId" JOIN "Invoice" i ON i.id = rf."invoiceId"
      WHERE ${where} ORDER BY rf.date, rf.number ${page(p, all)}`,
    db.$queryRaw<{ n: bigint; refunded: Dec; charge: Dec; vendorCredit: Dec; returned: Dec }[]>`
      SELECT COUNT(*) AS n, SUM(rf."clientRefundAmount") AS refunded, SUM(rf."clientCharge") AS charge,
             SUM(rf."vendorRefundAmount" - rf."vendorCharge") AS "vendorCredit", SUM(rf."returnAmount") AS returned
      FROM "Refund" rf WHERE ${where}`,
  ]);
  return {
    key: "refund-report",
    title: "Refunds",
    subtitle: periodLabel(p),
    columns: [
      { key: "date", title: "Date", type: "date" },
      { key: "number", title: "Refund", link: true },
      { key: "type", title: "Type" },
      { key: "client", title: "Client", width: 2 },
      { key: "invoice", title: "Invoice" },
      { key: "refunded", title: "Refunded", type: "money" },
      { key: "charge", title: "Charge kept", type: "money" },
      { key: "vendorCredit", title: "Back from vendors", type: "money" },
      { key: "method", title: "Method" },
      { key: "returned", title: "Paid back", type: "money" },
    ],
    rows: rows.map((r) => ({
      date: iso(r.date),
      number: r.number,
      type: REFUND_TYPE_INFO[r.type as RefundTypeKey]?.label ?? r.type,
      client: r.client,
      invoice: r.invoice,
      refunded: money(r.refunded),
      charge: money(r.charge),
      vendorCredit: money(r.vendorCredit),
      method: REFUND_METHOD_LABEL[r.method] ?? r.method,
      returned: money(r.returned),
      _href: `/refunds/${r.id}`,
    })),
    totals: {
      number: `${Number(agg?.n ?? 0)} refunds`,
      refunded: money(agg?.refunded),
      charge: money(agg?.charge),
      vendorCredit: money(agg?.vendorCredit),
      returned: money(agg?.returned),
    },
    paging: paging(p, all, agg?.n ?? 0),
  };
}

// ─── Users ──────────────────────────────────────────────────────────────────

export async function loginHistory(
  ctx: ServiceContext,
  p: ReportParams,
  all = false,
): Promise<ReportResult> {
  const a = ctx.agencyId;
  const where = Prisma.sql`lh."agencyId" = ${a} ${periodTs(Prisma.sql`lh."at"`, p)} ${eq(Prisma.sql`lh."userId"`, p.userId)}`;
  const db = tenantDb(a);
  const [rows, [agg]] = await Promise.all([
    db.$queryRaw<
      {
        at: Date;
        username: string;
        name: string | null;
        success: boolean;
        ip: string | null;
        userAgent: string | null;
      }[]
    >`
      SELECT lh."at", lh.username, u.name, lh.success, lh.ip, lh."userAgent"
      FROM "LoginHistory" lh LEFT JOIN "User" u ON u.id = lh."userId"
      WHERE ${where} ORDER BY lh."at" DESC ${page(p, all)}`,
    db.$queryRaw<{ n: bigint; failed: bigint }[]>`
      SELECT COUNT(*) AS n, COUNT(*) FILTER (WHERE NOT lh.success) AS failed FROM "LoginHistory" lh WHERE ${where}`,
  ]);
  return {
    key: "login-history",
    title: "User Login History",
    subtitle: periodLabel(p),
    columns: [
      { key: "at", title: "When (Dhaka)" },
      { key: "user", title: "User", width: 2 },
      { key: "result", title: "Result" },
      { key: "ip", title: "IP" },
      { key: "device", title: "Browser", width: 3 },
    ],
    rows: rows.map((r) => ({
      at: dhakaTime(r.at),
      user: r.name ? `${r.name} (${r.username})` : r.username,
      result: r.success ? "Signed in" : "Failed",
      ip: r.ip,
      device: r.userAgent ? r.userAgent.slice(0, 90) : null,
    })),
    totals: { at: `${Number(agg?.n ?? 0)} attempts, ${Number(agg?.failed ?? 0)} failed` },
    paging: paging(p, all, agg?.n ?? 0),
  };
}

const ACTION_LABEL: Record<string, string> = {
  CREATE: "Created",
  UPDATE: "Changed",
  VOID: "Voided",
  ACTIVATE: "Activated",
  DEACTIVATE: "Deactivated",
  EXPORT: "Exported",
  PASSWORD_RESET: "Password reset",
  PASSWORD_CHANGE: "Password changed",
  LEDGER_DRIFT: "Ledger check",
};

export async function auditTrail(
  ctx: ServiceContext,
  p: ReportParams,
  all = false,
): Promise<ReportResult> {
  const a = ctx.agencyId;
  const where = Prisma.sql`al."agencyId" = ${a} ${periodTs(Prisma.sql`al."createdAt"`, p)} ${eq(Prisma.sql`al."userId"`, p.userId)}`;
  const db = tenantDb(a);
  const [rows, [agg]] = await Promise.all([
    db.$queryRaw<
      {
        at: Date;
        user: string | null;
        action: string;
        entity: string;
        entityId: string | null;
        number: string | null;
      }[]
    >`
      SELECT al."createdAt" AS at, u.name AS user, al.action, al.entity, al."entityId",
             COALESCE(al.after->>'number', al.before->>'number', al.after->>'name', al.before->>'name') AS number
      FROM "AuditLog" al LEFT JOIN "User" u ON u.id = al."userId"
      WHERE ${where} ORDER BY al."createdAt" DESC ${page(p, all)}`,
    db.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "AuditLog" al WHERE ${where}`,
  ]);
  return {
    key: "audit-trail",
    title: "Audit Trail",
    subtitle: periodLabel(p),
    columns: [
      { key: "at", title: "When (Dhaka)" },
      { key: "user", title: "User", width: 2 },
      { key: "action", title: "Action" },
      { key: "entity", title: "Record" },
      { key: "number", title: "Number / name", width: 2 },
    ],
    rows: rows.map((r) => ({
      at: dhakaTime(r.at),
      user: r.user ?? "System",
      action: ACTION_LABEL[r.action] ?? r.action,
      entity: r.entity.replace(/([a-z])([A-Z])/g, "$1 $2"),
      number: r.number ?? r.entityId,
    })),
    totals: { at: `${Number(agg?.n ?? 0)} entries` },
    paging: paging(p, all, agg?.n ?? 0),
  };
}
