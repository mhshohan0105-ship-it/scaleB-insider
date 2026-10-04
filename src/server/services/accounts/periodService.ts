// Closing and reopening accounting months. The posting engine refuses any
// entry dated in a closed month (src/server/accounting/post.ts).
import { z } from "zod";
import { fiscalMonths, fiscalYear, todayIso } from "@/lib/dates";
import { recordAudit } from "@/server/audit/audit";
import { tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { ServiceError } from "../errors";
import { getAppConfig } from "../settings/settingsService";

export interface PeriodRow {
  /** "YYYY-MM" */
  month: string;
  isClosed: boolean;
  closedAt: string | null;
  entries: number;
}

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Invalid month");

/** Months of the current and previous fiscal year, newest first. */
export async function listPeriods(ctx: ServiceContext): Promise<PeriodRow[]> {
  const db = tenantDb(ctx.agencyId);
  const config = await getAppConfig(ctx);
  const current = fiscalYear(todayIso(), config.fiscalYearStart);
  const previous = fiscalYear(
    new Date(Date.parse(`${current.from}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10),
    config.fiscalYearStart,
  );
  const thisMonth = todayIso().slice(0, 7);
  const months = [...fiscalMonths(previous.from), ...fiscalMonths(current.from)]
    .filter((m) => m <= thisMonth)
    .reverse();

  const [periods, counts] = await Promise.all([
    db.accountingPeriod.findMany({ where: { isClosed: true } }),
    db.$queryRaw<{ m: string; n: bigint }[]>`
      SELECT to_char(date, 'YYYY-MM') AS m, COUNT(*) AS n FROM "JournalEntry"
      WHERE "agencyId" = ${ctx.agencyId} GROUP BY m`,
  ]);
  const closed = new Map(periods.map((p) => [`${p.year}-${String(p.month).padStart(2, "0")}`, p]));
  const n = new Map(counts.map((c) => [c.m, Number(c.n)]));
  return months.map((m) => ({
    month: m,
    isClosed: closed.has(m),
    closedAt: closed.get(m)?.closedAt?.toISOString() ?? null,
    entries: n.get(m) ?? 0,
  }));
}

export async function setPeriodClosed(
  ctx: ServiceContext,
  month: string,
  closed: boolean,
): Promise<void> {
  const m = monthSchema.parse(month);
  if (closed && m >= todayIso().slice(0, 7)) {
    throw new ServiceError("Only past months can be closed");
  }
  const [year, mon] = m.split("-").map(Number) as [number, number];
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const before = await tx.accountingPeriod.findFirst({ where: { year, month: mon } });
    const after = await tx.accountingPeriod.upsert({
      where: { agencyId_year_month: { agencyId: ctx.agencyId, year, month: mon } },
      update: {
        isClosed: closed,
        closedAt: closed ? new Date() : null,
        closedById: closed ? ctx.userId : null,
      },
      create: {
        agencyId: ctx.agencyId,
        year,
        month: mon,
        isClosed: closed,
        closedAt: closed ? new Date() : null,
        closedById: closed ? ctx.userId : null,
      },
    });
    await recordAudit(tx, ctx, {
      action: "UPDATE",
      entity: "AccountingPeriod",
      entityId: after.id,
      before,
      after,
    });
  });
}
