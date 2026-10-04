// Business dates (invoice date, journal date, ...) are calendar days in
// Asia/Dhaka. They are stored in @db.Date columns as UTC midnight of that day
// and exchanged as "YYYY-MM-DD" strings.
import { z } from "zod";
import { APP_TIME_ZONE } from "./format";

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const dhakaDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's calendar date in Dhaka as "YYYY-MM-DD". */
export function todayIso(now: Date = new Date()): string {
  return dhakaDay.format(now);
}

/** "YYYY-MM-DD" -> Date at UTC midnight (the @db.Date representation). */
export function isoToDate(iso: string): Date {
  if (!ISO_DATE_RE.test(iso)) throw new Error(`Invalid date "${iso}"`);
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) {
    throw new Error(`Invalid date "${iso}"`);
  }
  return d;
}

/** @db.Date value (UTC midnight) -> "YYYY-MM-DD". */
export function dateToIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Zod schema for a business date sent as "YYYY-MM-DD". */
export const businessDate = (label = "Date") =>
  z
    .string({ error: `${label} is required` })
    .regex(ISO_DATE_RE, `${label} must be a valid date`)
    .refine((s) => {
      try {
        isoToDate(s);
        return true;
      } catch {
        return false;
      }
    }, `${label} must be a valid date`);

/** First day of the month of `iso` ("YYYY-MM-01"). */
export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/**
 * Fiscal year containing `iso`, given the month it starts in (Bangladesh: 7 = July).
 * Returns inclusive "YYYY-MM-DD" bounds and a label like "2026-27".
 */
export function fiscalYear(
  iso: string,
  startMonth: number,
): { from: string; to: string; label: string } {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const startYear = m >= startMonth ? y : y - 1;
  const from = `${startYear}-${String(startMonth).padStart(2, "0")}-01`;
  const end = new Date(Date.UTC(startYear + 1, startMonth - 1, 0)); // day before next start
  const to = end.toISOString().slice(0, 10);
  const label =
    startMonth === 1 ? String(startYear) : `${startYear}-${String(startYear + 1).slice(2)}`;
  return { from, to, label };
}

/** The 12 month keys ("YYYY-MM") of a fiscal year, in order. */
export function fiscalMonths(from: string): string[] {
  const y = Number(from.slice(0, 4));
  const m = Number(from.slice(5, 7)) - 1;
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m + i, 1));
    return d.toISOString().slice(0, 7);
  });
}
