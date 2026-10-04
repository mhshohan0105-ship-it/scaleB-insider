// Sales reports (PLAN.md section 7 "Sales"), besides the Sales Report itself.
// Invoice figures are net of refunds (refundCredit / refundCost).
import { Prisma } from "@prisma/client";
import { todayIso } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { INVOICE_TYPE_INFO, type InvoiceTypeKey } from "@/lib/invoiceTypes";
import type { ReportParams } from "@/lib/reports/params";
import type { ReportResult } from "@/lib/reports/types";
import { tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "@/server/services/context";
import { LIVE, eq, money, period, periodLabel, total, totals } from "./kit";

const D = Prisma.Decimal;
type Dec = Prisma.Decimal;
const typeLabel = (t: string) => INVOICE_TYPE_INFO[t as InvoiceTypeKey]?.label ?? t;
const pct = (profit: Dec, sales: Dec) =>
  sales.isZero() ? "-" : `${profit.dividedBy(sales).times(100).toFixed(1)}%`;

export async function salesEarning(ctx: ServiceContext, p: ReportParams): Promise<ReportResult> {
  const a = ctx.agencyId;
  const rows = await tenantDb(a).$queryRaw<
    { type: string; n: bigint; sales: Dec; cost: Dec; profit: Dec; discount: Dec }[]
  >`
    SELECT type::text AS type, COUNT(*) AS n,
           SUM("netTotal" - "refundCredit") AS sales,
           SUM("totalCost" - "refundCost") AS cost,
           SUM(profit - "refundCredit" + "refundCost") AS profit,
           SUM(discount) AS discount
    FROM "Invoice" WHERE "agencyId" = ${a} AND status::text IN ${LIVE} ${period(Prisma.sql`date`, p)}
    GROUP BY type ORDER BY sales DESC`;
  const out = rows.map((r) => ({
    type: typeLabel(r.type),
    invoices: Number(r.n),
    sales: money(r.sales),
    cost: money(r.cost),
    discount: money(r.discount),
    profit: money(r.profit),
    margin: pct(new D(r.profit), new D(r.sales)),
  }));
  const t = totals(out, ["sales", "cost", "discount", "profit"]);
  return {
    key: "sales-earning",
    title: "Sales & Earning",
    subtitle: periodLabel(p),
    columns: [
      { key: "type", title: "Invoice type", width: 2 },
      { key: "invoices", title: "Invoices", type: "number" },
      { key: "sales", title: "Sales", type: "money" },
      { key: "cost", title: "Cost", type: "money" },
      { key: "discount", title: "Discount", type: "money" },
      { key: "profit", title: "Profit", type: "money" },
      { key: "margin", title: "Margin" },
    ],
    rows: out,
    totals: { type: "Total", ...t, margin: pct(new D(t.profit!), new D(t.sales!)) },
    summary: [
      { label: "Sales", value: t.sales! },
      { label: "Profit", value: t.profit!, tone: t.profit!.startsWith("-") ? "bad" : "good" },
    ],
  };
}

export async function airlineSales(ctx: ServiceContext, p: ReportParams): Promise<ReportResult> {
  const a = ctx.agencyId;
  const rows = await tenantDb(a).$queryRaw<
    {
      airline: string;
      iata: string | null;
      n: bigint;
      fare: Dec;
      sales: Dec;
      cost: Dec;
      profit: Dec;
      commission: Dec;
    }[]
  >`
    SELECT al.name AS airline, al.iata, COUNT(*) AS n, SUM(t."totalFare") AS fare, SUM(t."clientPrice") AS sales,
           SUM(t."purchasePrice") AS cost, SUM(t.profit) AS profit, SUM(t."commissionAmount") AS commission
    FROM "InvoiceAirTicket" t
    JOIN "Invoice" i ON i.id = t."invoiceId"
    JOIN "Airline" al ON al.id = t."airlineId"
    WHERE t."agencyId" = ${a} AND i.status::text IN ${LIVE} ${period(Prisma.sql`i.date`, p)} ${eq(Prisma.sql`t."airlineId"`, p.airlineId)}
    GROUP BY al.name, al.iata ORDER BY sales DESC`;
  const out = rows.map((r) => ({
    airline: r.iata ? `${r.iata}  ${r.airline}` : r.airline,
    tickets: Number(r.n),
    fare: money(r.fare),
    commission: money(r.commission),
    sales: money(r.sales),
    cost: money(r.cost),
    profit: money(r.profit),
  }));
  return {
    key: "airline-sales",
    title: "Airline wise Sales",
    subtitle: periodLabel(p),
    columns: [
      { key: "airline", title: "Airline", width: 2 },
      { key: "tickets", title: "Tickets", type: "number" },
      { key: "fare", title: "Total fare", type: "money" },
      { key: "commission", title: "Commission", type: "money" },
      { key: "sales", title: "Client price", type: "money" },
      { key: "cost", title: "Purchase", type: "money" },
      { key: "profit", title: "Profit", type: "money" },
    ],
    rows: out,
    totals: {
      airline: "Total",
      tickets: String(out.reduce((s, r) => s + r.tickets, 0)),
      ...totals(out, ["fare", "commission", "sales", "cost", "profit"]),
    },
    notes: ["Ticket figures before any refunds."],
  };
}

export async function salesmanProduct(ctx: ServiceContext, p: ReportParams): Promise<ReportResult> {
  const a = ctx.agencyId;
  const rows = await tenantDb(a).$queryRaw<
    { salesman: string | null; type: string; n: bigint; sales: Dec; profit: Dec }[]
  >`
    SELECT e.name AS salesman, i.type::text AS type, COUNT(*) AS n,
           SUM(i."netTotal" - i."refundCredit") AS sales,
           SUM(i.profit - i."refundCredit" + i."refundCost") AS profit
    FROM "Invoice" i LEFT JOIN "Employee" e ON e.id = i."salesmanId"
    WHERE i."agencyId" = ${a} AND i.status::text IN ${LIVE} ${period(Prisma.sql`i.date`, p)} ${eq(Prisma.sql`i."salesmanId"`, p.salesmanId)}
    GROUP BY e.name, i.type ORDER BY e.name NULLS LAST, sales DESC`;
  const out = rows.map((r) => ({
    salesman: r.salesman ?? "(no salesperson)",
    type: typeLabel(r.type),
    invoices: Number(r.n),
    sales: money(r.sales),
    profit: money(r.profit),
  }));
  return {
    key: "salesman-product",
    title: "Salesman & Product",
    subtitle: periodLabel(p),
    columns: [
      { key: "salesman", title: "Sold by", width: 2 },
      { key: "type", title: "Product", width: 2 },
      { key: "invoices", title: "Invoices", type: "number" },
      { key: "sales", title: "Sales", type: "money" },
      { key: "profit", title: "Profit", type: "money" },
    ],
    rows: out,
    totals: { salesman: "Total", ...totals(out, ["sales", "profit"]) },
  };
}

export async function salesCollection(ctx: ServiceContext, p: ReportParams): Promise<ReportResult> {
  const a = ctx.agencyId;
  const rows = await tenantDb(a).$queryRaw<
    { id: string; name: string; code: string; sales: Dec; received: Dec; balance: Dec }[]
  >`
    WITH s AS (
      SELECT "clientId" AS id, SUM("netTotal" - "refundCredit") AS sales FROM "Invoice"
      WHERE "agencyId" = ${a} AND status::text IN ${LIVE} ${period(Prisma.sql`date`, p)} GROUP BY "clientId"
    ), r AS (
      SELECT "clientId" AS id, SUM(amount) AS received FROM "MoneyReceipt"
      WHERE "agencyId" = ${a} AND status = 'POSTED' ${period(Prisma.sql`date`, p)} GROUP BY "clientId"
    )
    SELECT c.id, c.name, c.code, COALESCE(s.sales, 0) AS sales, COALESCE(r.received, 0) AS received, c.balance
    FROM "Client" c LEFT JOIN s ON s.id = c.id LEFT JOIN r ON r.id = c.id
    WHERE c."agencyId" = ${a} AND (s.id IS NOT NULL OR r.id IS NOT NULL) ${eq(Prisma.sql`c.id`, p.clientId)}
    ORDER BY sales DESC, c.name`;
  const out = rows.map((r) => ({
    client: `${r.name} (${r.code})`,
    sales: money(r.sales),
    received: money(r.received),
    balance: money(r.balance),
    _href: `/clients/${r.id}`,
  }));
  return {
    key: "sales-collection",
    title: "Sales & Collection",
    subtitle: periodLabel(p),
    columns: [
      { key: "client", title: "Client", width: 3, link: true },
      { key: "sales", title: "Sales", type: "money" },
      { key: "received", title: "Collected", type: "money" },
      { key: "balance", title: "Balance now", type: "balance" },
    ],
    rows: out,
    totals: { client: `${out.length} clients`, ...totals(out, ["sales", "received", "balance"]) },
  };
}

export async function purchasePayment(ctx: ServiceContext, p: ReportParams): Promise<ReportResult> {
  const a = ctx.agencyId;
  // From the vendor ledger: credits from invoices are purchases, debits from payments are payments.
  const rows = await tenantDb(a).$queryRaw<
    { id: string; name: string; code: string; purchases: Dec; paid: Dec; balance: Dec }[]
  >`
    WITH l AS (
      SELECT jl."partyId" AS id,
             SUM(CASE WHEN je."sourceType" LIKE 'INVOICE_%' THEN jl.credit - jl.debit ELSE 0 END) AS purchases,
             SUM(CASE WHEN je."sourceType" = 'VENDOR_PAYMENT' THEN jl.debit - jl.credit ELSE 0 END) AS paid
      FROM "JournalLine" jl JOIN "JournalEntry" je ON je.id = jl."entryId"
      WHERE jl."agencyId" = ${a} AND jl."partyType" = 'VENDOR' ${period(Prisma.sql`je.date`, p)}
      GROUP BY jl."partyId"
    )
    SELECT v.id, v.name, v.code, COALESCE(l.purchases, 0) AS purchases, COALESCE(l.paid, 0) AS paid, v.balance
    FROM "Vendor" v JOIN l ON l.id = v.id
    WHERE v."agencyId" = ${a} ${eq(Prisma.sql`v.id`, p.vendorId)}
    ORDER BY purchases DESC, v.name`;
  const out = rows.map((r) => ({
    vendor: `${r.name} (${r.code})`,
    purchases: money(r.purchases),
    paid: money(r.paid),
    payable: money(new D(r.balance).negated()),
    _href: `/vendors/${r.id}`,
  }));
  return {
    key: "purchase-payment",
    title: "Purchase & Payment",
    subtitle: periodLabel(p),
    columns: [
      { key: "vendor", title: "Vendor", width: 3, link: true },
      { key: "purchases", title: "Purchases", type: "money" },
      { key: "paid", title: "Paid", type: "money" },
      { key: "payable", title: "Payable now", type: "balance" },
    ],
    rows: out,
    totals: { vendor: `${out.length} vendors`, ...totals(out, ["purchases", "paid", "payable"]) },
    notes: ["Purchases are net of refunds and reversals in the period."],
  };
}

export async function salesmanCollection(
  ctx: ServiceContext,
  p: ReportParams,
): Promise<ReportResult> {
  const a = ctx.agencyId;
  const rows = await tenantDb(a).$queryRaw<
    { salesman: string | null; receipts: bigint; amount: Dec }[]
  >`
    SELECT e.name AS salesman, COUNT(DISTINCT r.id) AS receipts, SUM(al.amount) AS amount
    FROM "MoneyReceiptAllocation" al
    JOIN "MoneyReceipt" r ON r.id = al."receiptId"
    JOIN "Invoice" i ON i.id = al."invoiceId"
    LEFT JOIN "Employee" e ON e.id = i."salesmanId"
    WHERE al."agencyId" = ${a} AND r.status = 'POSTED' ${period(Prisma.sql`r.date`, p)} ${eq(Prisma.sql`i."salesmanId"`, p.salesmanId)}
    GROUP BY e.name ORDER BY amount DESC`;
  const out = rows.map((r) => ({
    salesman: r.salesman ?? "(no salesperson)",
    receipts: Number(r.receipts),
    amount: money(r.amount),
  }));
  return {
    key: "salesman-collection",
    title: "Salesman wise Collection",
    subtitle: periodLabel(p),
    columns: [
      { key: "salesman", title: "Sold by", width: 3 },
      { key: "receipts", title: "Receipts", type: "number" },
      { key: "amount", title: "Collected on their invoices", type: "money" },
    ],
    rows: out,
    totals: { salesman: "Total", amount: total(out, "amount") },
    notes: ["Advances not allocated to an invoice are not included."],
  };
}

export async function dailySalesPurchase(
  ctx: ServiceContext,
  p: ReportParams,
): Promise<ReportResult> {
  const a = ctx.agencyId;
  const rows = await tenantDb(a).$queryRaw<
    { day: Date; n: bigint; sales: Dec; cost: Dec; profit: Dec }[]
  >`
    SELECT date AS day, COUNT(*) AS n, SUM("netTotal" - "refundCredit") AS sales,
           SUM("totalCost" - "refundCost") AS cost, SUM(profit - "refundCredit" + "refundCost") AS profit
    FROM "Invoice" WHERE "agencyId" = ${a} AND status::text IN ${LIVE} ${period(Prisma.sql`date`, p)}
    GROUP BY date ORDER BY date`;
  const out = rows.map((r) => ({
    date: r.day.toISOString().slice(0, 10),
    invoices: Number(r.n),
    sales: money(r.sales),
    purchase: money(r.cost),
    profit: money(r.profit),
  }));
  return {
    key: "daily-sales-purchase",
    title: "Daily Sales & Purchase",
    subtitle: periodLabel(p),
    columns: [
      { key: "date", title: "Date", type: "date" },
      { key: "invoices", title: "Invoices", type: "number" },
      { key: "sales", title: "Sales", type: "money" },
      { key: "purchase", title: "Purchase", type: "money" },
      { key: "profit", title: "Profit", type: "money" },
    ],
    rows: out,
    totals: { date: "Total", ...totals(out, ["sales", "purchase", "profit"]) },
  };
}

export async function salesmanClientDue(
  ctx: ServiceContext,
  p: ReportParams,
): Promise<ReportResult> {
  const a = ctx.agencyId;
  const rows = await tenantDb(a).$queryRaw<
    {
      salesman: string | null;
      clientId: string;
      client: string;
      n: bigint;
      due: Dec;
      oldest: Date;
    }[]
  >`
    SELECT e.name AS salesman, c.id AS "clientId", c.name AS client, COUNT(*) AS n,
           SUM(GREATEST(i."netTotal" - i."refundCredit" - i."paidAmount", 0)) AS due, MIN(i.date) AS oldest
    FROM "Invoice" i JOIN "Client" c ON c.id = i."clientId" LEFT JOIN "Employee" e ON e.id = i."salesmanId"
    WHERE i."agencyId" = ${a} AND i.status::text IN ${LIVE}
      AND i."netTotal" - i."refundCredit" - i."paidAmount" > 0 ${eq(Prisma.sql`i."salesmanId"`, p.salesmanId)}
    GROUP BY e.name, c.id, c.name ORDER BY e.name NULLS LAST, due DESC`;
  const out = rows.map((r) => ({
    salesman: r.salesman ?? "(no salesperson)",
    client: r.client,
    invoices: Number(r.n),
    oldest: r.oldest.toISOString().slice(0, 10),
    due: money(r.due),
    _href: `/clients/${r.clientId}`,
  }));
  return {
    key: "salesman-client-due",
    title: "Salesman wise Client Due",
    subtitle: `As of today, ${formatDate(todayIso())}`,
    columns: [
      { key: "salesman", title: "Sold by", width: 2 },
      { key: "client", title: "Client", width: 2, link: true },
      { key: "invoices", title: "Invoices due", type: "number" },
      { key: "oldest", title: "Oldest", type: "date" },
      { key: "due", title: "Due", type: "money" },
    ],
    rows: out,
    totals: { salesman: "Total", due: total(out, "due") },
  };
}
