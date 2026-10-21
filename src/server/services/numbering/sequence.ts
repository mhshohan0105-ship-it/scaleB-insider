// Gap-free per agency counters (PLAN.md 2.3). The increment is a single
// INSERT ... ON DUPLICATE KEY UPDATE, so concurrent callers each get a
// distinct number and the row lock is held until their transaction ends (a
// rolled back document does not consume a number). LAST_INSERT_ID(expr) hands
// the new value back on the same connection (the caller's transaction).
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
  await tx.$executeRaw`
    INSERT INTO \`DocumentSequence\` (\`id\`, \`agencyId\`, \`docType\`, \`year\`, \`lastNumber\`, \`updatedAt\`)
    VALUES (${randomUUID()}, ${agencyId}, ${docType}, ${year}, LAST_INSERT_ID(1), UTC_TIMESTAMP(3))
    ON DUPLICATE KEY UPDATE
      \`lastNumber\` = LAST_INSERT_ID(\`lastNumber\` + 1), \`updatedAt\` = UTC_TIMESTAMP(3)`;
  const rows = await tx.$queryRaw<{ n: bigint | number }[]>`SELECT LAST_INSERT_ID() AS n`;
  const n = Number(rows[0]?.n);
  if (!Number.isInteger(n) || n < 1) throw new Error("Sequence increment failed");
  return n;
}
