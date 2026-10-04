// Air ticket reports (PLAN.md section 7 "Air ticket"). Ticket figures are as
// issued (before any refunds); invoices must be posted.
import { Prisma } from "@prisma/client";
import { invoiceHref } from "@/lib/invoiceTypes";
import type { ReportParams } from "@/lib/reports/params";
import type { ReportResult } from "@/lib/reports/types";
import { tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "@/server/services/context";
import { LIVE, eq, money, page, paging, period, periodLabel, totals } from "./kit";

type Dec = Prisma.Decimal;

function ticketWhere(ctx: ServiceContext, p: ReportParams) {
  return Prisma.sql`t."agencyId" = ${ctx.agencyId} AND i.status::text IN ${LIVE} ${period(Prisma.sql`i.date`, p)}
    ${eq(Prisma.sql`t."airlineId"`, p.airlineId)} ${eq(Prisma.sql`i."clientId"`, p.clientId)} ${eq(Prisma.sql`t."vendorId"`, p.vendorId)}`;
}

export async function ticketDetails(
  ctx: ServiceContext,
  p: ReportParams,
  all = false,
): Promise<ReportResult> {
  const where = ticketWhere(ctx, p);
  const db = tenantDb(ctx.agencyId);
  const [rows, [agg]] = await Promise.all([
    db.$queryRaw<
      {
        invoiceId: string;
        type: string;
        number: string;
        date: Date;
        ticketNo: string;
        pnr: string | null;
        pax: string;
        iata: string | null;
        route: string;
        journey: Date;
        base: Dec;
        tax: Dec;
        fare: Dec;
        commission: Dec;
        ait: Dec;
        sales: Dec;
        cost: Dec;
        profit: Dec;
        vendor: string;
        client: string;
      }[]
    >`
      SELECT i.id AS "invoiceId", i.type::text AS type, i.number, i.date, t."ticketNo", t.pnr, t."passengerName" AS pax, al.iata,
             t.route, t."journeyDate" AS journey, t."baseFare" AS base, t."taxTotal" AS tax, t."totalFare" AS fare,
             t."commissionAmount" AS commission, t."aitAmount" AS ait, t."clientPrice" AS sales, t."purchasePrice" AS cost, t.profit,
             v.name AS vendor, c.name AS client
      FROM "InvoiceAirTicket" t JOIN "Invoice" i ON i.id = t."invoiceId" JOIN "Airline" al ON al.id = t."airlineId"
      JOIN "Vendor" v ON v.id = t."vendorId" JOIN "Client" c ON c.id = i."clientId"
      WHERE ${where} ORDER BY i.date, i.number, t."sortOrder" ${page(p, all)}`,
    db.$queryRaw<
      {
        n: bigint;
        base: Dec;
        tax: Dec;
        fare: Dec;
        commission: Dec;
        ait: Dec;
        sales: Dec;
        cost: Dec;
        profit: Dec;
      }[]
    >`
      SELECT COUNT(*) AS n, SUM(t."baseFare") AS base, SUM(t."taxTotal") AS tax, SUM(t."totalFare") AS fare,
             SUM(t."commissionAmount") AS commission, SUM(t."aitAmount") AS ait, SUM(t."clientPrice") AS sales,
             SUM(t."purchasePrice") AS cost, SUM(t.profit) AS profit
      FROM "InvoiceAirTicket" t JOIN "Invoice" i ON i.id = t."invoiceId" WHERE ${where}`,
  ]);
  return {
    key: "ticket-details",
    title: "Ticket Details",
    subtitle: periodLabel(p),
    columns: [
      { key: "date", title: "Date", type: "date" },
      { key: "invoice", title: "Invoice", link: true },
      { key: "ticket", title: "Ticket / PNR" },
      { key: "pax", title: "Passenger", width: 2 },
      { key: "route", title: "Route" },
      { key: "journey", title: "Journey", type: "date" },
      { key: "client", title: "Client", width: 2 },
      { key: "vendor", title: "Vendor", width: 2 },
      { key: "base", title: "Base fare", type: "money" },
      { key: "tax", title: "Taxes", type: "money" },
      { key: "commission", title: "Commission", type: "money" },
      { key: "ait", title: "AIT", type: "money" },
      { key: "sales", title: "Client price", type: "money" },
      { key: "cost", title: "Purchase", type: "money" },
      { key: "profit", title: "Profit", type: "money" },
    ],
    rows: rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      invoice: r.number,
      ticket: r.pnr ? `${r.ticketNo} / ${r.pnr}` : r.ticketNo,
      pax: r.pax,
      route: `${r.iata ? `${r.iata} ` : ""}${r.route}`,
      journey: r.journey.toISOString().slice(0, 10),
      client: r.client,
      vendor: r.vendor,
      base: money(r.base),
      tax: money(r.tax),
      commission: money(r.commission),
      ait: money(r.ait),
      sales: money(r.sales),
      cost: money(r.cost),
      profit: money(r.profit),
      _href: invoiceHref(r.type, r.invoiceId),
    })),
    totals: {
      invoice: `${Number(agg?.n ?? 0)} tickets`,
      base: money(agg?.base),
      tax: money(agg?.tax),
      commission: money(agg?.commission),
      ait: money(agg?.ait),
      sales: money(agg?.sales),
      cost: money(agg?.cost),
      profit: money(agg?.profit),
    },
    paging: paging(p, all, agg?.n ?? 0),
  };
}

export async function taxReport(ctx: ServiceContext, p: ReportParams): Promise<ReportResult> {
  const where = ticketWhere(ctx, p);
  const rows = await tenantDb(ctx.agencyId).$queryRaw<{ code: string; n: bigint; amount: Dec }[]>`
    SELECT upper(x->>'code') AS code, COUNT(*) AS n, SUM((x->>'amount')::numeric) AS amount
    FROM "InvoiceAirTicket" t JOIN "Invoice" i ON i.id = t."invoiceId",
         jsonb_array_elements(t.taxes::jsonb) AS x
    WHERE ${where}
    GROUP BY upper(x->>'code') ORDER BY amount DESC`;
  const out = rows.map((r) => ({ code: r.code, tickets: Number(r.n), amount: money(r.amount) }));
  return {
    key: "tax-report",
    title: "Tax Report",
    subtitle: periodLabel(p),
    columns: [
      { key: "code", title: "Tax code" },
      { key: "tickets", title: "Tickets", type: "number" },
      { key: "amount", title: "Amount", type: "money" },
    ],
    rows: out,
    totals: { code: "Total", ...totals(out, ["amount"]) },
  };
}

async function aitBy(ctx: ServiceContext, p: ReportParams, by: "vendor" | "client") {
  const where = ticketWhere(ctx, p);
  const col = by === "vendor" ? Prisma.sql`v.name` : Prisma.sql`c.name`;
  const idCol = by === "vendor" ? Prisma.sql`v.id` : Prisma.sql`c.id`;
  return tenantDb(ctx.agencyId).$queryRaw<
    { id: string; name: string; n: bigint; fare: Dec; ait: Dec }[]
  >`
    SELECT ${idCol} AS id, ${col} AS name, COUNT(*) AS n, SUM(t."totalFare") AS fare, SUM(t."aitAmount") AS ait
    FROM "InvoiceAirTicket" t JOIN "Invoice" i ON i.id = t."invoiceId"
    JOIN "Vendor" v ON v.id = t."vendorId" JOIN "Client" c ON c.id = i."clientId"
    WHERE ${where} GROUP BY ${idCol}, ${col} ORDER BY ait DESC`;
}

export async function aitReport(ctx: ServiceContext, p: ReportParams): Promise<ReportResult> {
  const rows = await aitBy(ctx, p, "vendor");
  const out = rows.map((r) => ({
    vendor: r.name,
    tickets: Number(r.n),
    fare: money(r.fare),
    ait: money(r.ait),
    _href: `/vendors/${r.id}`,
  }));
  return {
    key: "ait-report",
    title: "AIT Report",
    subtitle: periodLabel(p),
    columns: [
      { key: "vendor", title: "Vendor", width: 3, link: true },
      { key: "tickets", title: "Tickets", type: "number" },
      { key: "fare", title: "Total fare", type: "money" },
      { key: "ait", title: "AIT", type: "money" },
    ],
    rows: out,
    totals: { vendor: "Total", ...totals(out, ["fare", "ait"]) },
    notes: ["AIT is part of each ticket's cost (App Config rate on the total fare)."],
  };
}

export async function clientAit(ctx: ServiceContext, p: ReportParams): Promise<ReportResult> {
  const rows = await aitBy(ctx, p, "client");
  const out = rows.map((r) => ({
    client: r.name,
    tickets: Number(r.n),
    fare: money(r.fare),
    ait: money(r.ait),
    _href: `/clients/${r.id}`,
  }));
  return {
    key: "client-ait",
    title: "Client AIT",
    subtitle: periodLabel(p),
    columns: [
      { key: "client", title: "Client", width: 3, link: true },
      { key: "tickets", title: "Tickets", type: "number" },
      { key: "fare", title: "Total fare", type: "money" },
      { key: "ait", title: "AIT", type: "money" },
    ],
    rows: out,
    totals: { client: "Total", ...totals(out, ["fare", "ait"]) },
  };
}

export async function gdsReport(ctx: ServiceContext, p: ReportParams): Promise<ReportResult> {
  const where = ticketWhere(ctx, p);
  const rows = await tenantDb(ctx.agencyId).$queryRaw<
    { gds: string | null; n: bigint; segments: bigint; fare: Dec; sales: Dec; profit: Dec }[]
  >`
    SELECT NULLIF(trim(t.gds), '') AS gds, COUNT(*) AS n, SUM(t."segmentCount") AS segments, SUM(t."totalFare") AS fare,
           SUM(t."clientPrice") AS sales, SUM(t.profit) AS profit
    FROM "InvoiceAirTicket" t JOIN "Invoice" i ON i.id = t."invoiceId"
    WHERE ${where} GROUP BY NULLIF(trim(t.gds), '') ORDER BY n DESC`;
  const out = rows.map((r) => ({
    gds: r.gds ?? "(not set)",
    tickets: Number(r.n),
    segments: Number(r.segments),
    fare: money(r.fare),
    sales: money(r.sales),
    profit: money(r.profit),
  }));
  return {
    key: "gds-report",
    title: "GDS Report",
    subtitle: periodLabel(p),
    columns: [
      { key: "gds", title: "GDS", width: 2 },
      { key: "tickets", title: "Tickets", type: "number" },
      { key: "segments", title: "Segments", type: "number" },
      { key: "fare", title: "Total fare", type: "money" },
      { key: "sales", title: "Client price", type: "money" },
      { key: "profit", title: "Profit", type: "money" },
    ],
    rows: out,
    totals: { gds: "Total", ...totals(out, ["fare", "sales", "profit"]) },
  };
}
