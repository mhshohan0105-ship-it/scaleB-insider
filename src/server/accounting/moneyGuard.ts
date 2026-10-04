// Row locks and overdraft rules for money going out of an account.
import { Prisma } from "@prisma/client";
import type { TenantTx } from "@/server/db/tenant";
import { ServiceError } from "@/server/services/errors";

export interface LockedAccount {
  id: string;
  name: string;
  kind: "CASH" | "BANK" | "MOBILE_BANKING" | "CREDIT_CARD";
  balance: Prisma.Decimal;
  isActive: boolean;
}

/** Cash and wallets cannot go below zero; banks and cards may (overdraft / credit). */
export const NO_OVERDRAFT = new Set(["CASH", "MOBILE_BANKING"]);

/**
 * Locks a money account row until the transaction ends and returns it (null
 * if it is not in this agency). Lock several accounts in a fixed (sorted)
 * order to avoid deadlocks.
 */
export async function lockMoneyAccount(
  tx: TenantTx,
  agencyId: string,
  id: string,
): Promise<LockedAccount | null> {
  const rows = await tx.$queryRaw<LockedAccount[]>`
    SELECT id, name, kind::text AS kind, balance, "isActive" FROM "MoneyAccount"
    WHERE id = ${id} AND "agencyId" = ${agencyId} FOR UPDATE`;
  const row = rows[0];
  return row ? { ...row, balance: new Prisma.Decimal(row.balance) } : null;
}

/** Throws unless `amount` may leave the (locked) account. */
export function assertCanPayOut(
  account: LockedAccount,
  amount: Prisma.Decimal,
  field = "amount",
): void {
  if (NO_OVERDRAFT.has(account.kind) && account.balance.lessThan(amount)) {
    throw new ServiceError(`${account.name} has only ${account.balance.toFixed(2)} available`, {
      [field]: "More than the available balance",
    });
  }
}

/** Locks an account and checks it is active; for money coming in or going out. */
export async function requireActiveAccount(
  tx: TenantTx,
  agencyId: string,
  id: string,
  field = "moneyAccountId",
): Promise<LockedAccount> {
  const account = await lockMoneyAccount(tx, agencyId, id);
  if (!account || !account.isActive) {
    throw new ServiceError("Account not found", { [field]: "Choose an active account" });
  }
  return account;
}
