// Party ledger (PLAN.md 7 "Ledgers", 6.14): every journal line tagged with a
// party, with opening balance, running balance and closing balance.
// Positive balance = the party owes the agency.
import { Prisma, type PartyType } from "@prisma/client";
import { dateToIso } from "@/lib/dates";
import { sqlDate } from "@/server/db/sqlDate";
import { tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { combinedParties } from "../parties/combinedService";

export interface LedgerQuery {
  partyType: PartyType;
  partyId: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export interface LedgerLine {
  id: string;
  /** Whose line it is (a combined client's ledger mixes its client and vendor accounts). */
  side: PartyType;
  date: string;
  number: string;
  sourceType: string;
  sourceId: string | null;
  narration: string;
  memo: string | null;
  debit: string;
  credit: string;
  balance: string;
}

export interface PartyLedger {
  /** Balance before `from` (0 when no from). */
  opening: string;
  /** Balance after the last line in the range. */
  closing: string;
  totalDebit: string;
  totalCredit: string;
  total: number;
  /** Oldest first, like a printed statement. */
  rows: LedgerLine[];
}

export async function partyLedger(ctx: ServiceContext, q: LedgerQuery): Promise<PartyLedger> {
  const db = tenantDb(ctx.agencyId);
  // A combined client's ledger is its own lines plus its client and vendor accounts'.
  const parties =
    q.partyType === "COMBINED"
      ? await combinedParties(db, q.partyId)
      : [{ partyType: q.partyType, partyId: q.partyId }];
  const partyFilter = Prisma.join(
    parties.map(
      (p) =>
        Prisma.sql`(jl."partyType" = ${p.partyType}::"PartyType" AND jl."partyId" = ${p.partyId})`,
    ),
    " OR ",
  );
  const base = Prisma.sql`
    WITH l AS (
      SELECT jl.id, jl."partyType" AS side, je.date, je.number, je."sourceType", je."sourceId", je.narration, jl.memo,
             jl.debit, jl.credit, je."createdAt",
             SUM(jl.debit - jl.credit) OVER (ORDER BY je.date, je."createdAt", jl.id) AS running
      FROM "JournalLine" jl
      JOIN "JournalEntry" je ON je.id = jl."entryId"
      WHERE jl."agencyId" = ${ctx.agencyId}
        AND (${partyFilter})
    )`;
  const filters: Prisma.Sql[] = [];
  if (q.from) filters.push(Prisma.sql`date >= ${sqlDate(q.from)}`);
  if (q.to) filters.push(Prisma.sql`date <= ${sqlDate(q.to)}`);
  const where = filters.length ? Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}` : Prisma.empty;

  type Raw = {
    id: string;
    side: PartyType;
    date: Date;
    number: string;
    sourceType: string;
    sourceId: string | null;
    narration: string;
    memo: string | null;
    debit: Prisma.Decimal;
    credit: Prisma.Decimal;
    running: Prisma.Decimal;
  };
  const [rows, [agg], [openingRow]] = await Promise.all([
    db.$queryRaw<Raw[]>`${base}
      SELECT * FROM l ${where}
      ORDER BY date, "createdAt", id
      LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`,
    db.$queryRaw<
      {
        n: bigint;
        debit: Prisma.Decimal | null;
        credit: Prisma.Decimal | null;
        last: Prisma.Decimal | null;
      }[]
    >`${base}
      SELECT COUNT(*) AS n, SUM(debit) AS debit, SUM(credit) AS credit,
             (SELECT running FROM l ${where} ORDER BY date DESC, "createdAt" DESC, id DESC LIMIT 1) AS last
      FROM l ${where}`,
    q.from
      ? db.$queryRaw<{ v: Prisma.Decimal | null }[]>`${base}
          SELECT (SELECT running FROM l WHERE date < ${sqlDate(q.from)}
                  ORDER BY date DESC, "createdAt" DESC, id DESC LIMIT 1) AS v`
      : Promise.resolve([{ v: null }]),
  ]);

  const dec = (v: Prisma.Decimal | null | undefined) => new Prisma.Decimal(v ?? 0).toFixed(2);
  const opening = dec(openingRow?.v);
  return {
    opening,
    closing: agg?.last !== null && agg?.last !== undefined ? dec(agg.last) : opening,
    totalDebit: dec(agg?.debit),
    totalCredit: dec(agg?.credit),
    total: Number(agg?.n ?? 0),
    rows: rows.map((r) => ({
      id: r.id,
      side: r.side,
      date: dateToIso(r.date),
      number: r.number,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      narration: r.narration,
      memo: r.memo,
      debit: dec(r.debit),
      credit: dec(r.credit),
      balance: dec(r.running),
    })),
  };
}
