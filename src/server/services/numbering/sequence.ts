// Gap-free per agency counters (PLAN.md 2.3). The increment is a single
// INSERT ... ON CONFLICT DO UPDATE ... RETURNING, so concurrent callers each
// get a distinct number and the row lock is held until their transaction ends
// (a rolled back document does not consume a number).
import { randomUUID } from "node:crypto";
import type { TenantTx } from "@/server/db/tenant";

/** Formats a counter value, e.g. formatNumber("CL", 7) -> "CL-00007"; with year -> "MR-2026-00007". */
export function formatNumber(prefix: string, n: number, year?: number, width = 5): string {
  const num = String(n).padStart(width, "0");
  return year ? `${prefix}-${year}-${num}` : `${prefix}-${num}`;
}

/**
 * Returns the next number for (agency, docType, year). Must run inside the
 * transaction that saves the numbered row. Raw SQL binds agencyId explicitly.
 */
export async function nextSequence(
  tx: TenantTx,
  agencyId: string,
  docType: string,
  year = 0,
): Promise<number> {
  const rows = await tx.$queryRaw<{ lastNumber: number }[]>`
    INSERT INTO "DocumentSequence" ("id", "agencyId", "docType", "year", "lastNumber", "updatedAt")
    VALUES (${randomUUID()}, ${agencyId}, ${docType}, ${year}, 1, now())
    ON CONFLICT ("agencyId", "docType", "year")
    DO UPDATE SET "lastNumber" = "DocumentSequence"."lastNumber" + 1, "updatedAt" = now()
    RETURNING "lastNumber"`;
  const n = rows[0]?.lastNumber;
  if (typeof n !== "number") throw new Error("Sequence increment failed");
  return n;
}
