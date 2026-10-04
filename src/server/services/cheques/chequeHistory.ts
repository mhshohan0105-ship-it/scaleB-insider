// A cheque's status history, kept as JSON on the cheque.
import type { Prisma } from "@prisma/client";

export interface ChequeHistoryEntry {
  status: string;
  at: string;
  by: string | null;
  note?: string | null;
}

export function chequeHistory(
  previous: unknown,
  status: string,
  by: string | null,
  note?: string | null,
): Prisma.InputJsonValue {
  const list = Array.isArray(previous) ? (previous as ChequeHistoryEntry[]) : [];
  return [
    ...list,
    { status, at: new Date().toISOString(), by, note: note ?? null },
  ] as unknown as Prisma.InputJsonValue;
}
