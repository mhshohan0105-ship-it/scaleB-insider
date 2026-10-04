// Ledger integrity (PLAN.md 2.2 and 12 "golden rule"): every entry balances,
// total debits equal total credits, and every cached balance equals the
// balance derived from journal lines. Raw SQL binds agencyId explicitly.
import { Prisma } from "@prisma/client";
import type { TenantDb, TenantTx } from "@/server/db/tenant";

export interface BalanceDrift {
  kind: "MONEY_ACCOUNT" | "CLIENT" | "COMBINED" | "VENDOR" | "AGENT" | "LOAN_AUTHORITY";
  id: string;
  name: string;
  cached: string;
  derived: string;
}

export interface LedgerIntegrity {
  totalDebit: string;
  totalCredit: string;
  unbalancedEntries: string[];
  drift: BalanceDrift[];
}

const PARTY_TABLES = [
  { kind: "CLIENT", table: "Client" },
  { kind: "COMBINED", table: "CombinedClient" },
  { kind: "VENDOR", table: "Vendor" },
  { kind: "AGENT", table: "Agent" },
  { kind: "LOAN_AUTHORITY", table: "LoanAuthority" },
] as const;

type Row = { id: string; name: string; cached: Prisma.Decimal; derived: Prisma.Decimal };

export async function checkLedgerIntegrity(
  db: TenantDb | TenantTx,
  agencyId: string,
): Promise<LedgerIntegrity> {
  const [totals] = await db.$queryRaw<{ d: Prisma.Decimal; c: Prisma.Decimal }[]>`
    SELECT COALESCE(SUM(debit), 0) AS d, COALESCE(SUM(credit), 0) AS c
    FROM "JournalLine" WHERE "agencyId" = ${agencyId}`;

  const unbalanced = await db.$queryRaw<{ entryId: string }[]>`
    SELECT "entryId" FROM "JournalLine" WHERE "agencyId" = ${agencyId}
    GROUP BY "entryId" HAVING SUM(debit) <> SUM(credit)`;

  const drift: BalanceDrift[] = [];
  const money = await db.$queryRaw<Row[]>`
    SELECT ma.id, ma.name, ma.balance AS cached, COALESCE(SUM(jl.debit - jl.credit), 0) AS derived
    FROM "MoneyAccount" ma
    LEFT JOIN "JournalLine" jl ON jl."moneyAccountId" = ma.id AND jl."agencyId" = ma."agencyId"
    WHERE ma."agencyId" = ${agencyId}
    GROUP BY ma.id
    HAVING ma.balance <> COALESCE(SUM(jl.debit - jl.credit), 0)`;
  drift.push(...money.map((r) => toDrift("MONEY_ACCOUNT", r)));

  for (const { kind, table } of PARTY_TABLES) {
    const rows = await db.$queryRaw<Row[]>`
      SELECT p.id, p.name, p.balance AS cached, COALESCE(SUM(jl.debit - jl.credit), 0) AS derived
      FROM ${Prisma.raw(`"${table}"`)} p
      LEFT JOIN "JournalLine" jl
        ON jl."partyId" = p.id AND jl."partyType" = ${kind}::"PartyType" AND jl."agencyId" = p."agencyId"
      WHERE p."agencyId" = ${agencyId}
      GROUP BY p.id
      HAVING p.balance <> COALESCE(SUM(jl.debit - jl.credit), 0)`;
    drift.push(...rows.map((r) => toDrift(kind, r)));
  }

  return {
    totalDebit: new Prisma.Decimal(totals?.d ?? 0).toFixed(2),
    totalCredit: new Prisma.Decimal(totals?.c ?? 0).toFixed(2),
    unbalancedEntries: unbalanced.map((u) => u.entryId),
    drift,
  };
}

function toDrift(kind: BalanceDrift["kind"], r: Row): BalanceDrift {
  return {
    kind,
    id: r.id,
    name: r.name,
    cached: new Prisma.Decimal(r.cached).toFixed(2),
    derived: new Prisma.Decimal(r.derived).toFixed(2),
  };
}

export function isHealthy(i: LedgerIntegrity): boolean {
  return i.totalDebit === i.totalCredit && i.unbalancedEntries.length === 0 && i.drift.length === 0;
}
