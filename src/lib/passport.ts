// Passport expiry (PLAN.md 6.16). Pure. Many countries refuse entry with less
// than 6 months of validity left, so that is the warning window.

export type ExpiryState = "EXPIRED" | "SOON" | "OK";

export const EXPIRY_WARNING_MONTHS = 6;

/** Adds calendar months to "YYYY-MM-DD", clamping to the month's last day. */
export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000,
  );
}

/** Expired (on or before today), expiring within 6 months, or fine. */
export function expiryState(
  expiryIso: string,
  todayIso: string,
): { state: ExpiryState; days: number } {
  const days = daysBetween(todayIso, expiryIso);
  if (days <= 0) return { state: "EXPIRED", days };
  if (expiryIso < addMonthsIso(todayIso, EXPIRY_WARNING_MONTHS)) return { state: "SOON", days };
  return { state: "OK", days };
}

export const EXPIRY_LABEL: Record<ExpiryState, string> = {
  EXPIRED: "Expired",
  SOON: "Expires soon",
  OK: "Valid",
};

export const EXPIRY_COLOR: Record<ExpiryState, string> = {
  EXPIRED: "red",
  SOON: "orange",
  OK: "green",
};
