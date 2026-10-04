// Lookups of system ledger accounts by key (never by code or name).
import type { TenantTx } from "@/server/db/tenant";
import { SYSTEM_ACCOUNTS, type SystemAccountKey } from "./chartOfAccounts";
import { AccountingError } from "./validate";

/**
 * Ids of the requested system accounts in the current tenant. System accounts
 * added in a later version are created on first use.
 */
export async function systemAccounts<K extends SystemAccountKey>(
  tx: TenantTx,
  keys: readonly K[],
): Promise<Record<K, string>> {
  const find = () =>
    tx.ledgerAccount.findMany({
      where: { systemKey: { in: [...keys] } },
      select: { id: true, systemKey: true },
    });
  let rows = await find();
  const missing = SYSTEM_ACCOUNTS.filter(
    (a) => (keys as readonly string[]).includes(a.key) && !rows.some((r) => r.systemKey === a.key),
  );
  if (missing.length) {
    await tx.ledgerAccount.createMany({
      data: missing.map((a) => ({
        agencyId: "",
        code: a.code,
        name: a.name,
        type: a.type,
        systemKey: a.key,
        isSystem: true,
      })),
      skipDuplicates: true,
    });
    rows = await find();
  }
  const out = {} as Record<K, string>;
  for (const k of keys) {
    const row = rows.find((r) => r.systemKey === k);
    if (!row) throw new AccountingError(`System account ${k} is missing for this agency`);
    out[k] = row.id;
  }
  return out;
}
