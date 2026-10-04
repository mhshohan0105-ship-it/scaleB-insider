// Party reports: ledger statement and total due / advance (PLAN.md section 7
// "Ledgers" and "Total Due/Advance"). Raw SQL binds agencyId explicitly.
import { Prisma, type PartyType } from "@prisma/client";
import { formatDate } from "@/lib/format";
import type { PartyKey } from "@/lib/masters";
import { PARTIES } from "@/lib/parties";
import type { ReportParams } from "@/lib/reports/params";
import type { ReportResult, ReportRow } from "@/lib/reports/types";
import { SOURCE_LABELS, sourceHref } from "@/lib/sourceLinks";
import { todayIso } from "@/lib/dates";
import { sqlDate } from "@/server/db/sqlDate";
import { tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "@/server/services/context";
import { ServiceError } from "@/server/services/errors";
import { partyLedger } from "@/server/services/ledger/partyLedger";
import { getEntity } from "@/server/services/masters/masterService";

export const PARTY_TYPES: Record<PartyKey, PartyType> = {
  clients: "CLIENT",
  combinedclients: "COMBINED",
  vendors: "VENDOR",
  agents: "AGENT",
};

const TABLES: Record<PartyKey, string> = {
  clients: '"Client"',
  combinedclients: '"CombinedClient"',
  vendors: '"Vendor"',
  agents: '"Agent"',
};

const money = (v: Prisma.Decimal | string) => new Prisma.Decimal(v).toFixed(2);

/** Ledger statement of one party. `all` = every line (exports); otherwise one page. */
export async function partyLedgerReport(
  ctx: ServiceContext,
  p: ReportParams,
  all = false,
): Promise<ReportResult> {
  const def = PARTIES[p.party];
  const base: ReportResult = {
    key: "party-ledger",
    title: `${def.singular} Ledger`,
    columns: [
      { key: "date", title: "Date", type: "date" },
      { key: "voucher", title: "Voucher" },
      { key: "details", title: "Details", width: 3, link: true },
      { key: "debit", title: "Debit", type: "money" },
      { key: "credit", title: "Credit", type: "money" },
      { key: "balance", title: "Balance", type: "balance" },
    ],
    rows: [],
  };
  if (!p.partyId)
    return { ...base, notes: [`Choose a ${def.singular.toLowerCase()} to see the ledger.`] };

  const party = await getEntity(ctx, p.party, p.partyId);
  if (!party) throw new ServiceError(`${def.singular} not found`);
  const page = all ? { page: 1, pageSize: 100_000 } : { page: p.page, pageSize: p.pageSize };
  const ledger = await partyLedger(ctx, {
    partyType: PARTY_TYPES[p.party],
    partyId: p.partyId,
    from: p.from,
    to: p.to,
    ...page,
  });

  const rows: ReportRow[] = [];
  if (p.from && page.page === 1) {
    rows.push({
      date: p.from,
      details: "Opening balance",
      balance: ledger.opening,
      _kind: "subtotal",
    });
  }
  for (const l of ledger.rows) {
    rows.push({
      date: l.date,
      voucher: l.number,
      details: `${l.narration}${l.memo && l.memo !== l.narration ? ` (${l.memo})` : ""} · ${SOURCE_LABELS[l.sourceType] ?? l.sourceType}`,
      debit: l.debit === "0.00" ? null : l.debit,
      credit: l.credit === "0.00" ? null : l.credit,
      balance: l.balance,
      _href: sourceHref(l.sourceType, l.sourceId),
    });
  }
  return {
    ...base,
    title: `${def.singular} Ledger: ${party.name}`,
    subtitle: `${party.code} · ${p.from || p.to ? `${p.from ? formatDate(p.from) : "Start"} to ${p.to ? formatDate(p.to) : "today"}` : "All dates"}`,
    rows,
    totals: {
      details: "Total for the period",
      debit: ledger.totalDebit,
      credit: ledger.totalCredit,
      balance: ledger.closing,
    },
    summary: [
      { label: "Opening", value: ledger.opening },
      { label: "Debits", value: ledger.totalDebit },
      { label: "Credits", value: ledger.totalCredit },
      { label: "Closing", value: ledger.closing },
    ],
    paging: all ? undefined : { total: ledger.total, page: page.page, pageSize: page.pageSize },
    notes: ["Balance: positive = they owe you (Dr), negative = you owe them / advance (Cr)."],
  };
}

/**
 * Every party of a kind with a non-zero balance as of a date, split into due
 * (they owe you) and advance (you owe them).
 */
export async function dueAdvanceReport(
  ctx: ServiceContext,
  p: ReportParams,
): Promise<ReportResult> {
  const def = PARTIES[p.party];
  const asOf = p.asOf ?? todayIso();
  const table = Prisma.raw(TABLES[p.party]);
  // Combined clients: own lines plus their linked client and vendor accounts (net).
  const partyJoin =
    p.party === "combinedclients"
      ? Prisma.sql`((jl."partyType" = 'COMBINED'::"PartyType" AND jl."partyId" = pt.id)
          OR (jl."partyType" = 'CLIENT'::"PartyType" AND jl."partyId" = pt."clientId")
          OR (jl."partyType" = 'VENDOR'::"PartyType" AND jl."partyId" = pt."vendorId"))`
      : Prisma.sql`jl."partyId" = pt.id AND jl."partyType" = ${PARTY_TYPES[p.party]}::"PartyType"`;
  const rows = await tenantDb(ctx.agencyId).$queryRaw<
    { id: string; code: string; name: string; phone: string | null; balance: Prisma.Decimal }[]
  >`
    SELECT pt.id, pt.code, pt.name, pt.phone, SUM(jl.debit - jl.credit) AS balance
    FROM ${table} pt
    JOIN "JournalLine" jl
      ON ${partyJoin} AND jl."agencyId" = pt."agencyId"
    JOIN "JournalEntry" je ON je.id = jl."entryId"
    WHERE pt."agencyId" = ${ctx.agencyId} AND je.date <= ${sqlDate(asOf)}
    GROUP BY pt.id
    HAVING SUM(jl.debit - jl.credit) <> 0
    ORDER BY pt.name`;

  const filtered = rows.filter((r) => {
    const b = new Prisma.Decimal(r.balance);
    return p.show === "all" || (p.show === "due" ? b.greaterThan(0) : b.lessThan(0));
  });
  let due = new Prisma.Decimal(0);
  let advance = new Prisma.Decimal(0);
  const out: ReportRow[] = filtered.map((r) => {
    const b = new Prisma.Decimal(r.balance);
    if (b.greaterThan(0)) due = due.plus(b);
    else advance = advance.plus(b.negated());
    return {
      code: r.code,
      name: r.name,
      phone: r.phone,
      due: b.greaterThan(0) ? money(b) : null,
      advance: b.lessThan(0) ? money(b.negated()) : null,
      _href: `${def.profileBase}/${r.id}?tab=ledger`,
    };
  });
  const dueLabel = p.party === "vendors" ? "Advance paid (they owe you)" : "Due (they owe you)";
  const advLabel = p.party === "vendors" ? "Payable (you owe them)" : "Advance (you owe them)";
  return {
    key: "due-advance",
    title: `${def.title}: Due & Advance`,
    subtitle: `As of ${formatDate(asOf)}`,
    columns: [
      { key: "code", title: "Code" },
      { key: "name", title: "Name", width: 2.5, link: true },
      { key: "phone", title: "Phone" },
      { key: "due", title: dueLabel, type: "money" },
      { key: "advance", title: advLabel, type: "money" },
    ],
    rows: out,
    totals: { name: `Total (${out.length})`, due: money(due), advance: money(advance) },
    summary: [
      { label: dueLabel, value: money(due) },
      { label: advLabel, value: money(advance) },
      { label: "Net", value: money(due.minus(advance)) },
    ],
    notes:
      p.party === "combinedclients"
        ? [
            "Net of each party's own opening and its client and vendor accounts, which also appear in the Clients and Vendors reports.",
          ]
        : undefined,
  };
}
