// Decimal helpers shared by the calculation functions (client and server).
import Decimal from "decimal.js";

export type DecimalInput = Decimal | string | number | { toString(): string } | null | undefined;

/** Parses a money-ish value; blank / null is 0. */
export function d(v: DecimalInput): Decimal {
  if (v === null || v === undefined || v === "") return new Decimal(0);
  return new Decimal(typeof v === "number" || typeof v === "string" ? v : v.toString());
}

/** Rounds to 2 decimals, half up (the usual invoice rounding). */
export function round2(v: Decimal): Decimal {
  return v.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Percentage of an amount, rounded to 2 decimals: pct(40000, 7) = 2800.00. */
export function pct(amount: Decimal, percent: Decimal): Decimal {
  return round2(amount.times(percent).dividedBy(100));
}

export function sum(values: Decimal[]): Decimal {
  return values.reduce((a, b) => a.plus(b), new Decimal(0));
}

export { Decimal };
