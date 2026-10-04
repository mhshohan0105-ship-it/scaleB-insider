// Display formatters. Money never passes through a JS float: values are
// handled as Decimal or decimal strings and grouped as text.
import Decimal from "decimal.js";

export const APP_TIME_ZONE = "Asia/Dhaka";

export type MoneyLike = Decimal | string | number | { toString(): string };

/** Groups an integer digit string the South Asian way: 12,34,56,789. */
function groupLakh(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest},${last3}`;
}

/**
 * Formats money with 2 decimals and lakh/crore grouping, e.g. 1234567.5 -> "12,34,567.50".
 * Pass `currency` to prefix a code, e.g. "BDT 1,000.00".
 */
export function formatMoney(value: MoneyLike, currency?: string): string {
  const d = new Decimal(value.toString());
  const fixed = d.abs().toFixed(2, Decimal.ROUND_HALF_UP);
  const [intPart, frac] = fixed.split(".") as [string, string];
  const sign = d.isNegative() && fixed !== "0.00" ? "-" : "";
  const body = `${sign}${groupLakh(intPart)}.${frac}`;
  return currency ? `${currency} ${body}` : body;
}

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

/** "27 Sept 2026" style date in Dhaka time. */
export function formatDate(value: Date | string): string {
  return dateFmt.format(new Date(value));
}

/** Date and time in Dhaka time. */
export function formatDateTime(value: Date | string): string {
  return dateTimeFmt.format(new Date(value));
}
