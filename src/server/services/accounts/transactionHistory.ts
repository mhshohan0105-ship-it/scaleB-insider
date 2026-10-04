// Transaction history for money accounts (PLAN.md 6.9): every journal line
// that touched a cash/bank/wallet/card account, newest first, with the
// account's running balance. Raw SQL (window function) binds agencyId explicitly.
import { Prisma } from "@prisma/client";
import { dateToIso } from "@/lib/dates";
import { sqlDate } from "@/server/db/sqlDate";
import { tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "../context";

export interface TransactionQuery {
  page: number;
  pageSize: number;
  moneyAccountId?: string;
  from?: string;
  to?: string;
  sourceType?: string;
}

export interface TransactionRow {
  id: string;
  date: string;
  number: string;
  sourceType: string;
  narration: string;
  memo: string | null;
  account: string;
  moneyIn: string;
  moneyOut: string;
  /** Balance of this line's account after it (all history, not just the filter). */
  runningBalance: string;
}

export interface TransactionHistory {
  rows: TransactionRow[];
  total: number;
  totalIn: string;
  totalOut: string;
}

export async function transactionHistory(
  ctx: ServiceContext,
  q: TransactionQuery,
): Promise<TransactionHistory> {
  const db = tenantDb(ctx.agencyId);
  const account = q.moneyAccountId
    ? Prisma.sql`AND jl."moneyAccountId" = ${q.moneyAccountId}`
    : Prisma.empty;
  const filters: Prisma.Sql[] = [];
  if (q.from) filters.push(Prisma.sql`date >= ${sqlDate(q.from)}`);
  if (q.to) filters.push(Prisma.sql`date <= ${sqlDate(q.to)}`);
  if (q.sourceType) filters.push(Prisma.sql`"sourceType" = ${q.sourceType}`);
  const where = filters.length ? Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}` : Prisma.empty;

  const base = Prisma.sql`
    WITH l AS (
      SELECT jl.id, je.date, je.number, je."sourceType", je.narration, jl.memo,
             jl.debit, jl.credit, ma.name AS account, je."createdAt",
             SUM(jl.debit - jl.credit) OVER (
               PARTITION BY jl."moneyAccountId" ORDER BY je.date, je."createdAt", jl.id
             ) AS running
      FROM "JournalLine" jl
      JOIN "JournalEntry" je ON je.id = jl."entryId"
      JOIN "MoneyAccount" ma ON ma.id = jl."moneyAccountId"
      WHERE jl."agencyId" = ${ctx.agencyId} AND jl."moneyAccountId" IS NOT NULL ${account}
    )`;

  type Raw = {
    id: string;
    date: Date;
    number: string;
    sourceType: string;
    narration: string;
    memo: string | null;
    debit: Prisma.Decimal;
    credit: Prisma.Decimal;
    account: string;
    running: Prisma.Decimal;
  };
  const [rows, [agg]] = await Promise.all([
    db.$queryRaw<Raw[]>`${base}
      SELECT * FROM l ${where}
      ORDER BY date DESC, "createdAt" DESC, id DESC
      LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`,
    db.$queryRaw<
      { n: bigint; debit: Prisma.Decimal | null; credit: Prisma.Decimal | null }[]
    >`${base}
      SELECT COUNT(*) AS n, SUM(debit) AS debit, SUM(credit) AS credit FROM l ${where}`,
  ]);

  return {
    total: Number(agg?.n ?? 0),
    totalIn: new Prisma.Decimal(agg?.debit ?? 0).toFixed(2),
    totalOut: new Prisma.Decimal(agg?.credit ?? 0).toFixed(2),
    rows: rows.map((r) => ({
      id: r.id,
      date: dateToIso(r.date),
      number: r.number,
      sourceType: r.sourceType,
      narration: r.narration,
      memo: r.memo,
      account: r.account,
      moneyIn: new Prisma.Decimal(r.debit).toFixed(2),
      moneyOut: new Prisma.Decimal(r.credit).toFixed(2),
      runningBalance: new Prisma.Decimal(r.running).toFixed(2),
    })),
  };
}

export { SOURCE_LABELS as SOURCE_TYPE_LABELS } from "@/lib/sourceLinks";
