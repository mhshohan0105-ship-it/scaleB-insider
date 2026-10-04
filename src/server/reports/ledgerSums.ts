// Debit / credit totals per ledger account over a date range, straight from
// journal lines (the source of truth). Used by P&L, trial balance and
// balance sheet.
import { Prisma, type LedgerType } from "@prisma/client";
import { isoToDate } from "@/lib/dates";
import { tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "@/server/services/context";

export interface AccountSum {
  id: string;
  code: string;
  name: string;
  type: LedgerType;
  systemKey: string | null;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  /** debit - credit */
  net: Prisma.Decimal;
}

export async function ledgerSums(
  ctx: ServiceContext,
  range: { from?: string; to?: string },
): Promise<AccountSum[]> {
  const db = tenantDb(ctx.agencyId);
  const date =
    range.from || range.to
      ? {
          ...(range.from ? { gte: isoToDate(range.from) } : {}),
          ...(range.to ? { lte: isoToDate(range.to) } : {}),
        }
      : undefined;
  const [accounts, sums] = await Promise.all([
    db.ledgerAccount.findMany({ orderBy: { code: "asc" } }),
    db.journalLine.groupBy({
      by: ["ledgerAccountId"],
      where: date ? { entry: { date } } : undefined,
      _sum: { debit: true, credit: true },
    }),
  ]);
  const byId = new Map(sums.map((s) => [s.ledgerAccountId, s._sum]));
  return accounts.map((a) => {
    const s = byId.get(a.id);
    const debit = s?.debit ?? new Prisma.Decimal(0);
    const credit = s?.credit ?? new Prisma.Decimal(0);
    return {
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      systemKey: a.systemKey,
      debit,
      credit,
      net: debit.minus(credit),
    };
  });
}

/** Natural balance: debit side for assets and expenses, credit side otherwise. */
export function natural(a: Pick<AccountSum, "type" | "net">): Prisma.Decimal {
  return a.type === "ASSET" || a.type === "EXPENSE" ? a.net : a.net.negated();
}

export const ZERO = new Prisma.Decimal(0);

export function sumOf(values: Prisma.Decimal[]): Prisma.Decimal {
  return values.reduce((a, b) => a.plus(b), ZERO);
}
