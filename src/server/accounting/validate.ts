// Pure checks for a journal entry before it is written. Kept free of I/O so
// the double entry rules can be unit tested exhaustively.
import { Prisma, type PartyType } from "@prisma/client";
import { ServiceError } from "@/server/services/errors";

/** A broken accounting rule; shown to the user like any other ServiceError. */
export class AccountingError extends ServiceError {
  constructor(message: string) {
    super(message);
    this.name = "AccountingError";
  }
}

export type Amount = Prisma.Decimal | string | number;

export interface LineInput {
  /** Ledger account. Optional when moneyAccountId is given (its ledger is used). */
  ledgerAccountId?: string;
  moneyAccountId?: string | null;
  debit?: Amount | null;
  credit?: Amount | null;
  partyType?: PartyType | null;
  partyId?: string | null;
  memo?: string | null;
}

export interface NormalizedLine {
  ledgerAccountId?: string;
  moneyAccountId: string | null;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  partyType: PartyType | null;
  partyId: string | null;
  memo: string | null;
}

const ZERO = new Prisma.Decimal(0);

function toAmount(v: Amount | null | undefined, where: string): Prisma.Decimal {
  if (v === null || v === undefined || v === "") return ZERO;
  if (typeof v === "number" && !Number.isFinite(v))
    throw new AccountingError(`${where}: invalid amount`);
  let d: Prisma.Decimal;
  try {
    d = new Prisma.Decimal(v);
  } catch {
    throw new AccountingError(`${where}: invalid amount`);
  }
  if (d.isNegative()) throw new AccountingError(`${where}: amounts cannot be negative`);
  if (d.decimalPlaces() > 2)
    throw new AccountingError(`${where}: amounts may have at most 2 decimals`);
  if (d.greaterThanOrEqualTo("1e12")) throw new AccountingError(`${where}: amount too large`);
  return d;
}

/**
 * Validates and normalises lines. Throws AccountingError unless:
 * - there are at least two lines,
 * - each line has exactly one positive side (debit or credit),
 * - each line names a ledger account or a money account,
 * - party lines carry both partyType and partyId,
 * - total debits equal total credits.
 */
export function validateLines(lines: LineInput[]): {
  lines: NormalizedLine[];
  total: Prisma.Decimal;
} {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new AccountingError("A journal entry needs at least two lines");
  }
  let debits = ZERO;
  let credits = ZERO;
  const out = lines.map((line, i) => {
    const where = `Line ${i + 1}`;
    const debit = toAmount(line.debit, where);
    const credit = toAmount(line.credit, where);
    if (debit.isZero() === credit.isZero()) {
      throw new AccountingError(`${where}: enter either a debit or a credit, not both or neither`);
    }
    if (!line.ledgerAccountId && !line.moneyAccountId) {
      throw new AccountingError(`${where}: no account`);
    }
    if (!!line.partyType !== !!line.partyId) {
      throw new AccountingError(`${where}: party type and party id go together`);
    }
    debits = debits.plus(debit);
    credits = credits.plus(credit);
    return {
      ledgerAccountId: line.ledgerAccountId,
      moneyAccountId: line.moneyAccountId ?? null,
      debit,
      credit,
      partyType: line.partyType ?? null,
      partyId: line.partyId ?? null,
      memo: line.memo?.trim() ? line.memo.trim().slice(0, 500) : null,
    };
  });
  if (!debits.equals(credits)) {
    throw new AccountingError(
      `Debits (${debits.toFixed(2)}) must equal credits (${credits.toFixed(2)})`,
    );
  }
  return { lines: out, total: debits };
}

/** Swaps debit and credit on every line (used to reverse an entry). */
export function reverseLines<T extends { debit: Prisma.Decimal; credit: Prisma.Decimal }>(
  lines: T[],
): T[] {
  return lines.map((l) => ({ ...l, debit: l.credit, credit: l.debit }));
}

/** Net effect (debit - credit) of lines, grouped by a key. */
export function netBy<T extends { debit: Prisma.Decimal; credit: Prisma.Decimal }>(
  lines: T[],
  key: (line: T) => string | null,
): Map<string, Prisma.Decimal> {
  const map = new Map<string, Prisma.Decimal>();
  for (const l of lines) {
    const k = key(l);
    if (!k) continue;
    map.set(k, (map.get(k) ?? ZERO).plus(l.debit).minus(l.credit));
  }
  return map;
}
