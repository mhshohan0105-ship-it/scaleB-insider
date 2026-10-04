// The posting engine (PLAN.md 2.2). This is the ONLY module that writes
// JournalEntry / JournalLine rows. Every business event is turned into one
// balanced entry here, inside the caller's transaction, and the cached
// balances (money accounts, parties) are moved by the same amounts with
// atomic increments so they always equal the ledger.
import type { JournalEntry, PartyType } from "@prisma/client";
import { dateToIso, isoToDate, todayIso } from "@/lib/dates";
import type { TenantTx } from "@/server/db/tenant";
import type { ServiceContext } from "@/server/services/context";
import { documentNumber } from "@/server/services/numbering/documentNumber";
import { AccountingError, netBy, reverseLines, validateLines, type LineInput } from "./validate";

export { AccountingError } from "./validate";
export type { LineInput } from "./validate";

/** What created an entry; with sourceId it links back to the document. */
export type SourceType =
  "OPENING_BALANCE" | "MONEY_ACCOUNT_OPENING" | "BALANCE_TRANSFER" | "MANUAL" | (string & {});

export interface PostEntryInput {
  /** Business date "YYYY-MM-DD" (Dhaka calendar day). */
  date: string;
  sourceType: SourceType;
  sourceId?: string | null;
  narration: string;
  lines: LineInput[];
}

/** Prisma delegate per party type, for existence checks. */
const PARTY_MODELS: Partial<Record<PartyType, string>> = {
  CLIENT: "client",
  COMBINED: "combinedClient",
  VENDOR: "vendor",
  AGENT: "agent",
  EMPLOYEE: "employee",
  LOAN_AUTHORITY: "loanAuthority",
};

/** Party types whose model carries a cached `balance`. */
const PARTY_BALANCE_MODELS: Partial<Record<PartyType, string>> = {
  CLIENT: "client",
  COMBINED: "combinedClient",
  VENDOR: "vendor",
  AGENT: "agent",
  LOAN_AUTHORITY: "loanAuthority",
};

interface CountDelegate {
  count(args: unknown): Promise<number>;
  update(args: unknown): Promise<unknown>;
}

function model(tx: TenantTx, name: string): CountDelegate {
  return (tx as unknown as Record<string, CountDelegate>)[name]!;
}

const unique = <T>(xs: (T | null | undefined)[]) =>
  Array.from(new Set(xs.filter((x): x is T => x !== null && x !== undefined)));

async function assertPeriodOpen(tx: TenantTx, date: Date) {
  const closed = await tx.accountingPeriod.findFirst({
    where: { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, isClosed: true },
    select: { id: true },
  });
  if (closed) {
    throw new AccountingError(
      `The period ${dateToIso(date).slice(0, 7)} is closed. Reopen it or use a date in an open month.`,
    );
  }
}

async function writeEntry(
  tx: TenantTx,
  ctx: ServiceContext,
  input: PostEntryInput,
  reversalOfId: string | null,
): Promise<JournalEntry> {
  const { lines } = validateLines(input.lines);
  const narration = input.narration.trim().slice(0, 500);
  if (!narration) throw new AccountingError("Narration is required");
  const date = isoToDate(input.date);
  await assertPeriodOpen(tx, date);

  // Money accounts: must exist in this tenant; they supply their ledger account.
  const moneyIds = unique(lines.map((l) => l.moneyAccountId));
  const money = await tx.moneyAccount.findMany({
    where: { id: { in: moneyIds } },
    select: { id: true, ledgerAccountId: true },
  });
  if (money.length !== moneyIds.length) throw new AccountingError("Money account not found");
  const ledgerOfMoney = new Map(money.map((m) => [m.id, m.ledgerAccountId]));

  for (const l of lines) {
    if (!l.moneyAccountId) continue;
    const ledger = ledgerOfMoney.get(l.moneyAccountId)!;
    if (l.ledgerAccountId && l.ledgerAccountId !== ledger) {
      throw new AccountingError("Line ledger does not match its money account");
    }
    l.ledgerAccountId = ledger;
  }

  // Ledger accounts: must exist in this tenant. A money account's ledger is
  // always tagged with that money account so its cached balance stays right.
  const ledgerIds = unique(lines.map((l) => l.ledgerAccountId));
  const ledgers = await tx.ledgerAccount.findMany({
    where: { id: { in: ledgerIds } },
    select: { id: true, moneyAccount: { select: { id: true } } },
  });
  if (ledgers.length !== ledgerIds.length) throw new AccountingError("Ledger account not found");
  const moneyOfLedger = new Map(ledgers.map((a) => [a.id, a.moneyAccount?.id ?? null]));
  for (const l of lines) l.moneyAccountId = moneyOfLedger.get(l.ledgerAccountId!) ?? null;

  // Parties: must exist in this tenant.
  for (const type of unique(lines.map((l) => l.partyType))) {
    const name = PARTY_MODELS[type];
    if (!name) throw new AccountingError(`Party type ${type} is not supported yet`);
    const ids = unique(lines.filter((l) => l.partyType === type).map((l) => l.partyId));
    const found = await model(tx, name).count({ where: { id: { in: ids } } });
    if (found !== ids.length) throw new AccountingError(`${type.toLowerCase()} not found`);
  }

  const entry = await tx.journalEntry.create({
    data: {
      agencyId: ctx.agencyId,
      number: await documentNumber(tx, ctx, "JOURNAL", input.date),
      date,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      narration,
      isReversal: reversalOfId !== null,
      reversalOfId,
      createdById: ctx.userId,
    },
  });
  await tx.journalLine.createMany({
    data: lines.map((l) => ({
      agencyId: ctx.agencyId,
      entryId: entry.id,
      ledgerAccountId: l.ledgerAccountId!,
      moneyAccountId: l.moneyAccountId,
      debit: l.debit,
      credit: l.credit,
      partyType: l.partyType,
      partyId: l.partyId,
      memo: l.memo,
    })),
  });

  // Cached balances move by exactly the posted amounts (debit - credit).
  for (const [id, delta] of netBy(lines, (l) => l.moneyAccountId)) {
    if (!delta.isZero())
      await tx.moneyAccount.update({ where: { id }, data: { balance: { increment: delta } } });
  }
  for (const [key, delta] of netBy(lines, (l) =>
    l.partyType ? `${l.partyType}:${l.partyId}` : null,
  )) {
    const [type, id] = key.split(":") as [PartyType, string];
    const name = PARTY_BALANCE_MODELS[type];
    if (name && !delta.isZero()) {
      await model(tx, name).update({ where: { id }, data: { balance: { increment: delta } } });
    }
  }
  return entry;
}

/**
 * Posts a balanced journal entry. Throws AccountingError when debits != credits,
 * the date is in a closed period, or any account/party is not in this tenant.
 * Must be called inside the transaction that saves the source document.
 */
export function postEntry(
  tx: TenantTx,
  ctx: ServiceContext,
  input: PostEntryInput,
): Promise<JournalEntry> {
  return writeEntry(tx, ctx, input, null);
}

/**
 * Cancels an entry by posting its mirror image (debits and credits swapped).
 * The original lines are never touched. An entry can be reversed only once
 * and a reversal cannot itself be reversed.
 */
export async function reverseEntry(
  tx: TenantTx,
  ctx: ServiceContext,
  entryId: string,
  opts: { date?: string; narration?: string } = {},
): Promise<JournalEntry> {
  const entry = await tx.journalEntry.findFirst({
    where: { id: entryId },
    include: { lines: true, reversedBy: { select: { id: true } } },
  });
  if (!entry) throw new AccountingError("Journal entry not found");
  if (entry.isReversal) throw new AccountingError("A reversal cannot be reversed");
  if (entry.reversedBy) throw new AccountingError(`Entry ${entry.number} is already reversed`);

  return writeEntry(
    tx,
    ctx,
    {
      date: opts.date ?? todayIso(),
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      narration: opts.narration ?? `Reversal of ${entry.number}: ${entry.narration}`,
      lines: reverseLines(entry.lines),
    },
    entry.id,
  );
}

/** Entries for a source document that are still in effect (not reversal, not reversed). */
export function activeEntries(tx: TenantTx, sourceType: SourceType, sourceId: string) {
  return tx.journalEntry.findMany({
    where: { sourceType, sourceId, isReversal: false, reversedBy: { is: null } },
    orderBy: { createdAt: "asc" },
  });
}

/** Reverses every active entry of a source document (used by void and edit). */
export async function reverseSource(
  tx: TenantTx,
  ctx: ServiceContext,
  sourceType: SourceType,
  sourceId: string,
  opts: { date?: string; narration?: string } = {},
): Promise<number> {
  const entries = await activeEntries(tx, sourceType, sourceId);
  for (const e of entries) await reverseEntry(tx, ctx, e.id, opts);
  return entries.length;
}

/**
 * Edit of a posted document: reverse what it posted before, then post the new
 * version (PLAN.md 2.2). Pass `null` to only reverse (e.g. amount became zero).
 */
export async function repostSource(
  tx: TenantTx,
  ctx: ServiceContext,
  sourceType: SourceType,
  sourceId: string,
  next: Omit<PostEntryInput, "sourceType" | "sourceId"> | null,
): Promise<JournalEntry | null> {
  await reverseSource(tx, ctx, sourceType, sourceId, next ? { date: next.date } : {});
  return next ? postEntry(tx, ctx, { ...next, sourceType, sourceId }) : null;
}
