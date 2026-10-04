"use server";

// Server actions for refunds (PLAN.md 6.7). Permission: the "refund" module.
import { REFUND_TYPE_KEYS, type RefundTypeKey } from "@/lib/refundTypes";
import { runAction } from "@/server/actions/runAction";
import { requirePermission } from "@/server/auth/session";
import { ServiceError } from "@/server/services/errors";
import {
  createRefund,
  refundTarget,
  refundableInvoices,
  voidRefund,
} from "@/server/services/refund/postRefund";

function typeOf(type: string): RefundTypeKey {
  if (!(REFUND_TYPE_KEYS as readonly string[]).includes(type))
    throw new ServiceError("Unknown refund type");
  return type as RefundTypeKey;
}

export async function refundableInvoicesAction(type: string, q: string) {
  return runAction(async () => {
    const ctx = await requirePermission("refund", "create");
    return refundableInvoices(ctx, typeOf(type), q);
  });
}

export async function refundTargetAction(type: string, invoiceId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("refund", "create");
    const target = await refundTarget(ctx, typeOf(type), invoiceId);
    if (!target) throw new ServiceError("This invoice cannot be refunded here");
    return target;
  });
}

export async function createRefundAction(type: string, values: unknown) {
  return runAction(async () => {
    const ctx = await requirePermission("refund", "create");
    return createRefund(ctx, typeOf(type), values);
  });
}

export async function voidRefundAction(id: string, values: unknown) {
  return runAction(async () => {
    const ctx = await requirePermission("refund", "void");
    await voidRefund(ctx, id, values);
  });
}
