"use server";

import { runAction } from "@/server/actions/runAction";
import { requirePermission } from "@/server/auth/session";
import {
  createAdvanceReturn,
  voidAdvanceReturn,
} from "@/server/services/payments/advanceReturnService";
import {
  createMoneyReceipt,
  listDueInvoices,
  voidMoneyReceipt,
} from "@/server/services/payments/receiptService";

export async function dueInvoicesAction(clientId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("money_receipt", "view");
    return listDueInvoices(ctx, clientId);
  });
}

export async function createMoneyReceiptAction(values: unknown) {
  return runAction(async () => {
    const ctx = await requirePermission("money_receipt", "create");
    return createMoneyReceipt(ctx, values);
  });
}

export async function voidMoneyReceiptAction(id: string, values: unknown) {
  return runAction(async () => {
    const ctx = await requirePermission("money_receipt", "void");
    await voidMoneyReceipt(ctx, id, values);
  });
}

export async function createClientAdvanceReturnAction(values: unknown) {
  return runAction(async () => {
    const ctx = await requirePermission("money_receipt", "create");
    return createAdvanceReturn(ctx, "CLIENT", values);
  });
}

export async function voidClientAdvanceReturnAction(id: string, values: unknown) {
  return runAction(async () => {
    const ctx = await requirePermission("money_receipt", "void");
    await voidAdvanceReturn(ctx, id, values);
  });
}
