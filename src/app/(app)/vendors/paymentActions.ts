"use server";

import { runAction } from "@/server/actions/runAction";
import { requirePermission } from "@/server/auth/session";
import {
  createAdvanceReturn,
  voidAdvanceReturn,
} from "@/server/services/payments/advanceReturnService";
import {
  createVendorPayment,
  voidVendorPayment,
} from "@/server/services/payments/vendorPaymentService";

export async function createVendorPaymentAction(values: unknown) {
  return runAction(async () => {
    const ctx = await requirePermission("vendors", "create");
    return createVendorPayment(ctx, values);
  });
}

export async function voidVendorPaymentAction(id: string, values: unknown) {
  return runAction(async () => {
    const ctx = await requirePermission("vendors", "void");
    await voidVendorPayment(ctx, id, values);
  });
}

export async function createVendorAdvanceReturnAction(values: unknown) {
  return runAction(async () => {
    const ctx = await requirePermission("vendors", "create");
    return createAdvanceReturn(ctx, "VENDOR", values);
  });
}

export async function voidVendorAdvanceReturnAction(id: string, values: unknown) {
  return runAction(async () => {
    const ctx = await requirePermission("vendors", "void");
    await voidAdvanceReturn(ctx, id, values);
  });
}
