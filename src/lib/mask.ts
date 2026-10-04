/**
 * Masks a bank / card / wallet number, keeping only the last 4 characters,
 * e.g. "0123-4567-8901" -> "••••8901". Only the masked form is ever stored.
 */
export function maskAccountNo(raw: string | null | undefined): string | null {
  const compact = (raw ?? "").replace(/[\s-]/g, "");
  if (!compact) return null;
  if (compact.length <= 4) return `••••${compact}`;
  return `••••${compact.slice(-4)}`;
}
