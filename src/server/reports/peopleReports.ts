// Passport and passenger reports (PLAN.md section 7 "Passport", "Passenger
// list", and "Pre registration").
import { Prisma } from "@prisma/client";
import { todayIso } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { PILGRIM_STATUS_LABEL, type PilgrimStatusKey } from "@/lib/hajj";
import { invoiceHref } from "@/lib/invoiceTypes";
import { EXPIRY_LABEL, addMonthsIso, expiryState } from "@/lib/passport";
import type { ReportParams } from "@/lib/reports/params";
import type { ReportResult } from "@/lib/reports/types";
import { sqlDate } from "@/server/db/sqlDate";
import { tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "@/server/services/context";
import { LIVE, eq, page, paging, period, periodLabel } from "./kit";

export async function passportStatus(ctx: ServiceContext): Promise<ReportResult> {
  const a = ctx.agencyId;
  const today = todayIso();
  const warn = addMonthsIso(today, 6);
  const rows = await tenantDb(a).$queryRaw<
    { status: string | null; n: bigint; expired: bigint; soon: bigint; withUs: bigint }[]
  >`
    SELECT s.name AS status, COUNT(*) AS n,
           COUNT(*) FILTER (WHERE p."expiryDate" <= ${sqlDate(today)}) AS expired,
           COUNT(*) FILTER (WHERE p."expiryDate" > ${sqlDate(today)} AND p."expiryDate" < ${sqlDate(warn)}) AS soon,
           COUNT(*) FILTER (WHERE p."receivedDate" IS NOT NULL AND p."returnedDate" IS NULL) AS "withUs"
    FROM "Passport" p LEFT JOIN "PassportStatus" s ON s.id = p."statusId"
    WHERE p."agencyId" = ${a} AND p."isActive"
    GROUP BY s.name ORDER BY n DESC`;
  const out = rows.map((r) => ({
    status: r.status ?? "(no status)",
    passports: Number(r.n),
    withUs: Number(r.withUs),
    expired: Number(r.expired),
    soon: Number(r.soon),
  }));
  const sum = (k: "passports" | "withUs" | "expired" | "soon") =>
    String(out.reduce((s, r) => s + r[k], 0));
  return {
    key: "passport-status",
    title: "Passport Status",
    subtitle: `Active passports as of ${formatDate(today)}`,
    columns: [
      { key: "status", title: "Status", width: 3 },
      { key: "passports", title: "Passports", type: "number" },
      { key: "withUs", title: "With us", type: "number" },
      { key: "expired", title: "Expired", type: "number" },
      { key: "soon", title: "Expiring in 6 months", type: "number" },
    ],
    rows: out,
    totals: {
      status: "Total",
      passports: sum("passports"),
      withUs: sum("withUs"),
      expired: sum("expired"),
      soon: sum("soon"),
    },
  };
}

export async function passportList(
  ctx: ServiceContext,
  p: ReportParams,
  all = false,
): Promise<ReportResult> {
  const a = ctx.agencyId;
  const today = todayIso();
  const where = Prisma.sql`p."agencyId" = ${a} AND p."isActive" ${eq(Prisma.sql`p."clientId"`, p.clientId)}`;
  const db = tenantDb(a);
  const [rows, [agg]] = await Promise.all([
    db.$queryRaw<
      {
        id: string;
        passportNo: string;
        name: string;
        client: string | null;
        phone: string | null;
        expiry: Date;
        status: string | null;
      }[]
    >`
      SELECT p.id, p."passportNo", p.name, c.name AS client, p.phone, p."expiryDate" AS expiry, s.name AS status
      FROM "Passport" p LEFT JOIN "Client" c ON c.id = p."clientId" LEFT JOIN "PassportStatus" s ON s.id = p."statusId"
      WHERE ${where} ORDER BY p."expiryDate" ${page(p, all)}`,
    db.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "Passport" p WHERE ${where}`,
  ]);
  return {
    key: "passport-list",
    title: "Passport wise",
    subtitle: `Active passports, soonest expiry first`,
    columns: [
      { key: "passportNo", title: "Passport", link: true },
      { key: "name", title: "Name", width: 2 },
      { key: "client", title: "Client", width: 2 },
      { key: "phone", title: "Phone" },
      { key: "expiry", title: "Expiry", type: "date" },
      { key: "state", title: "Validity" },
      { key: "status", title: "Status" },
    ],
    rows: rows.map((r) => {
      const e = expiryState(r.expiry.toISOString().slice(0, 10), today);
      return {
        passportNo: r.passportNo,
        name: r.name,
        client: r.client,
        phone: r.phone,
        expiry: r.expiry.toISOString().slice(0, 10),
        state: e.state === "OK" ? EXPIRY_LABEL.OK : `${EXPIRY_LABEL[e.state]} (${e.days} days)`,
        status: r.status,
        _href: `/passports/${r.id}`,
      };
    }),
    totals: { passportNo: `${Number(agg?.n ?? 0)} passports` },
    paging: paging(p, all, agg?.n ?? 0),
  };
}

/** Everyone a client bought travel for: ticket, visa and pilgrim / package lines. */
export async function passengersClient(
  ctx: ServiceContext,
  p: ReportParams,
  all = false,
): Promise<ReportResult> {
  const a = ctx.agencyId;
  const inv = Prisma.sql`i.status::text IN ${LIVE} ${period(Prisma.sql`i.date`, p)} ${eq(Prisma.sql`i."clientId"`, p.clientId)}`;
  const base = Prisma.sql`
    WITH x AS (
      SELECT i.id AS "invoiceId", i.type::text AS type, i.number, i.date, c.name AS client,
             t."passengerName" AS pax, t."passportNo" AS passport, 'Ticket ' || t."ticketNo" || ' · ' || t.route AS service
      FROM "InvoiceAirTicket" t JOIN "Invoice" i ON i.id = t."invoiceId" JOIN "Client" c ON c.id = i."clientId"
      WHERE t."agencyId" = ${a} AND ${inv}
      UNION ALL
      SELECT i.id, i.type::text, i.number, i.date, c.name, v."passengerName", v."passportNo", v.country || ' visa'
      FROM "InvoiceVisaLine" v JOIN "Invoice" i ON i.id = v."invoiceId" JOIN "Client" c ON c.id = i."clientId"
      WHERE v."agencyId" = ${a} AND ${inv}
      UNION ALL
      SELECT i.id, i.type::text, i.number, i.date, c.name, it."passengerName", it."passportNo", it.description
      FROM "InvoiceItem" it JOIN "Invoice" i ON i.id = it."invoiceId" JOIN "Client" c ON c.id = i."clientId"
      WHERE it."agencyId" = ${a} AND it."passengerName" IS NOT NULL AND ${inv}
    )`;
  const db = tenantDb(a);
  const [rows, [agg]] = await Promise.all([
    db.$queryRaw<
      {
        invoiceId: string;
        type: string;
        number: string;
        date: Date;
        client: string;
        pax: string;
        passport: string | null;
        service: string;
      }[]
    >`
      ${base} SELECT * FROM x ORDER BY date, number, pax ${page(p, all)}`,
    db.$queryRaw<{ n: bigint }[]>`${base} SELECT COUNT(*) AS n FROM x`,
  ]);
  return {
    key: "passengers-client",
    title: "Client wise Passengers",
    subtitle: periodLabel(p),
    columns: [
      { key: "date", title: "Date", type: "date" },
      { key: "invoice", title: "Invoice", link: true },
      { key: "client", title: "Client", width: 2 },
      { key: "pax", title: "Passenger", width: 2 },
      { key: "passport", title: "Passport" },
      { key: "service", title: "Service", width: 3 },
    ],
    rows: rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      invoice: r.number,
      client: r.client,
      pax: r.pax,
      passport: r.passport,
      service: r.service,
      _href: invoiceHref(r.type, r.invoiceId),
    })),
    totals: { invoice: `${Number(agg?.n ?? 0)} passengers` },
    paging: paging(p, all, agg?.n ?? 0),
  };
}

async function pilgrimRows(ctx: ServiceContext, p: ReportParams, all: boolean, extra: Prisma.Sql) {
  const a = ctx.agencyId;
  const where = Prisma.sql`p."agencyId" = ${a} ${eq(Prisma.sql`p."groupId"`, p.groupId)} ${eq(Prisma.sql`p."hajjYear"`, p.year)} ${extra}`;
  const db = tenantDb(a);
  const [rows, [agg]] = await Promise.all([
    db.$queryRaw<
      {
        id: string;
        name: string;
        passportNo: string | null;
        trackingNo: string | null;
        preRegNo: string | null;
        preRegDate: Date | null;
        regNo: string | null;
        year: number;
        status: string;
        client: string;
        grp: string | null;
        moallem: string | null;
        phone: string | null;
      }[]
    >`
      SELECT p.id, p.name, p."passportNo", p."trackingNo", p."preRegNo", p."preRegDate", p."regNo", p."hajjYear" AS year,
             p.status::text AS status, c.name AS client, g.name AS grp, p.moallem, p.phone
      FROM "Pilgrim" p JOIN "Client" c ON c.id = p."clientId" LEFT JOIN "Group" g ON g.id = p."groupId"
      WHERE ${where} ORDER BY g.name NULLS LAST, p.name ${page(p, all)}`,
    db.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "Pilgrim" p WHERE ${where}`,
  ]);
  return { rows, total: agg?.n ?? 0 };
}

export async function passengersGroup(
  ctx: ServiceContext,
  p: ReportParams,
  all = false,
): Promise<ReportResult> {
  const { rows, total } = await pilgrimRows(ctx, p, all, Prisma.empty);
  return {
    key: "passengers-group",
    title: "Group wise Pilgrims",
    subtitle: p.year ? `Hajj ${p.year}` : "All Hajj years",
    columns: [
      { key: "group", title: "Group", width: 2 },
      { key: "name", title: "Pilgrim", width: 2, link: true },
      { key: "passportNo", title: "Passport" },
      { key: "trackingNo", title: "Tracking" },
      { key: "moallem", title: "Moallem" },
      { key: "phone", title: "Phone" },
      { key: "status", title: "Status" },
    ],
    rows: rows.map((r) => ({
      group: r.grp ?? "(no group)",
      name: r.name,
      passportNo: r.passportNo,
      trackingNo: r.trackingNo,
      moallem: r.moallem,
      phone: r.phone,
      status: PILGRIM_STATUS_LABEL[r.status as PilgrimStatusKey] ?? r.status,
      _href: `/hajj/pilgrims/${r.id}`,
    })),
    totals: { group: `${Number(total)} pilgrims` },
    paging: paging(p, all, total),
  };
}

export async function preRegistration(
  ctx: ServiceContext,
  p: ReportParams,
  all = false,
): Promise<ReportResult> {
  const { rows, total } = await pilgrimRows(
    ctx,
    p,
    all,
    Prisma.sql`AND p.status::text IN ('PRE_REGISTERED','REGISTERED','TRANSFERRED_IN')`,
  );
  return {
    key: "pre-registration",
    title: "Pre Registration",
    subtitle: `${p.year ? `Hajj ${p.year}` : "All Hajj years"} · active pilgrims`,
    columns: [
      { key: "name", title: "Pilgrim", width: 2, link: true },
      { key: "trackingNo", title: "Tracking" },
      { key: "preRegNo", title: "Pre reg. no." },
      { key: "preRegDate", title: "Pre reg. date", type: "date" },
      { key: "regNo", title: "Reg. no." },
      { key: "client", title: "Paying client", width: 2 },
      { key: "group", title: "Group" },
      { key: "status", title: "Status" },
    ],
    rows: rows.map((r) => ({
      name: r.name,
      trackingNo: r.trackingNo,
      preRegNo: r.preRegNo,
      preRegDate: r.preRegDate ? r.preRegDate.toISOString().slice(0, 10) : null,
      regNo: r.regNo,
      client: r.client,
      group: r.grp,
      status: PILGRIM_STATUS_LABEL[r.status as PilgrimStatusKey] ?? r.status,
      _href: `/hajj/pilgrims/${r.id}`,
    })),
    totals: { name: `${Number(total)} pilgrims` },
    paging: paging(p, all, total),
  };
}
