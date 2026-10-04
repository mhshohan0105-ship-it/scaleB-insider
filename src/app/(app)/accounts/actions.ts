"use server";

import { runAction } from "@/server/actions/runAction";
import { requirePermission } from "@/server/auth/session";
import {
  createMoneyAccount,
  setMoneyAccountActive,
  updateMoneyAccount,
} from "@/server/services/accounts/moneyAccountService";
import { setPeriodClosed } from "@/server/services/accounts/periodService";
import {
  createBalanceTransfer,
  voidBalanceTransfer,
} from "@/server/services/accounts/transferService";

export async function saveMoneyAccountAction(id: string | null, values: unknown) {
  return runAction(async () => {
    const ctx = await requirePermission("accounts", id ? "edit" : "create");
    if (id) {
      await updateMoneyAccount(ctx, id, values);
      return { id };
    }
    return createMoneyAccount(ctx, values);
  });
}

export async function setMoneyAccountActiveAction(id: string, active: boolean) {
  return runAction(async () => {
    const ctx = await requirePermission("accounts", "edit");
    await setMoneyAccountActive(ctx, id, active);
  });
}

export async function createBalanceTransferAction(values: unknown) {
  return runAction(async () => {
    const ctx = await requirePermission("accounts", "create");
    return createBalanceTransfer(ctx, values);
  });
}

export async function voidBalanceTransferAction(id: string, values: unknown) {
  return runAction(async () => {
    const ctx = await requirePermission("accounts", "void");
    await voidBalanceTransfer(ctx, id, values);
  });
}

export async function setPeriodClosedAction(month: string, closed: boolean) {
  return runAction(async () => {
    const ctx = await requirePermission("accounts", "edit");
    await setPeriodClosed(ctx, month, closed);
  });
}
