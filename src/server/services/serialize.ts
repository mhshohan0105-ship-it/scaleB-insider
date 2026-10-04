import { Prisma } from "@prisma/client";

/** Value after Decimal -> string and Date -> ISO string conversion (safe to send to the client). */
export type Plain<T> = T extends Prisma.Decimal
  ? string
  : T extends Date
    ? string
    : T extends (infer U)[]
      ? Plain<U>[]
      : T extends object
        ? { [K in keyof T]: Plain<T[K]> }
        : T;

/** Deeply converts Prisma Decimals to strings and Dates to ISO strings. */
export function toPlain<T>(value: T): Plain<T> {
  if (value === null || value === undefined) return value as Plain<T>;
  if (Prisma.Decimal.isDecimal(value)) return (value as Prisma.Decimal).toString() as Plain<T>;
  if (value instanceof Date) return value.toISOString() as Plain<T>;
  if (Array.isArray(value)) return value.map(toPlain) as Plain<T>;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = toPlain(v);
    return out as Plain<T>;
  }
  return value as Plain<T>;
}
