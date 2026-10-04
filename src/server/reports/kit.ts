// Small helpers shared by the report runners. Reports read with raw SQL that
// binds agencyId explicitly (tenant rule), and sum money with Decimal only.
import { Prisma } from "@prisma/client";
import { formatDate } from "@/lib/format";
import type { ReportParams } from "@/lib/reports/params";
import type { ReportRow } from "@/lib/reports/types";
import { sqlDate } from "@/server/db/sqlDate";

export const money = (v: Prisma.Decimal | string | number | null | undefined) =>
  new Prisma.Decimal(v ?? 0).toFixed(2);

/** Decimal sum of a money column over report rows. */
export function total(rows: ReportRow[], key: string): string {
  return rows
    .reduce(
      (s, r) => s.plus(new Prisma.Decimal((r[key] as string | number | null) ?? 0)),
      new Prisma.Decimal(0),
    )
    .toFixed(2);
}

/** Totals for several money columns. */
export function totals(rows: ReportRow[], keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, total(rows, k)]));
}

/** "AND col >= from AND col <= to" for the report period (dates only). */
export function period(col: Prisma.Sql, p: ReportParams): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  if (p.from) parts.push(Prisma.sql`AND ${col} >= ${sqlDate(p.from)}`);
  if (p.to) parts.push(Prisma.sql`AND ${col} <= ${sqlDate(p.to)}`);
  return parts.length ? Prisma.join(parts, " ") : Prisma.empty;
}

/** Same, for timestamp columns compared by their Asia/Dhaka day. */
export function periodTs(col: Prisma.Sql, p: ReportParams): Prisma.Sql {
  return period(Prisma.sql`(${col} AT TIME ZONE 'Asia/Dhaka')::date`, p);
}

export function periodLabel(p: ReportParams, label = ""): string {
  if (!p.from && !p.to) return `${label}All dates`.trim();
  return `${label}${p.from ? formatDate(p.from) : "Start"} to ${p.to ? formatDate(p.to) : "today"}`;
}

/** LIMIT / OFFSET for list reports; exports get everything. */
export function page(p: ReportParams, all: boolean): Prisma.Sql {
  return all
    ? Prisma.sql`LIMIT 50000`
    : Prisma.sql`LIMIT ${p.pageSize} OFFSET ${(p.page - 1) * p.pageSize}`;
}

export function paging(p: ReportParams, all: boolean, total: number | bigint) {
  return all ? undefined : { total: Number(total), page: p.page, pageSize: p.pageSize };
}

/** Invoices that count as sales (posted, including refunded ones). */
export const LIVE = Prisma.sql`('POSTED','PARTIAL','PAID','REFUNDED')`;

/** "AND expr = value" when a filter is set. */
export function eq(col: Prisma.Sql, value: string | number | undefined | null): Prisma.Sql {
  return value === undefined || value === null || value === ""
    ? Prisma.empty
    : Prisma.sql`AND ${col} = ${value}`;
}

export const dhakaTime = (d: Date) =>
  d.toLocaleString("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
