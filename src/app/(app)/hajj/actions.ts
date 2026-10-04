"use server";

// Server actions for pilgrims (module "hajj") and Hajji management
// (module "hajji_management"): transfers and cancellations.
import { todayIso } from "@/lib/dates";
import { runAction } from "@/server/actions/runAction";
import { requirePermission } from "@/server/auth/session";
import { ServiceError } from "@/server/services/errors";
import {
  cancelPilgrim,
  createPilgrim,
  registerPilgrim,
  updatePilgrim,
} from "@/server/services/hajj/pilgrimService";
import {
  createTransfer,
  createTransferIn,
  voidTransfer,
} from "@/server/services/hajj/transferService";

export async function savePilgrimAction(id: string | null, values: unknown) {
  return runAction(async () => {
    const ctx = await requirePermission("hajj", id ? "edit" : "create");
    if (id) {
      await updatePilgrim(ctx, id, values, todayIso());
      return { id };
    }
    return createPilgrim(ctx, values, todayIso());
  });
}

export async function registerPilgrimAction(id: string, values: unknown) {
  return runAction(async () => {
    const ctx = await requirePermission("hajj", "edit");
    await registerPilgrim(ctx, id, values);
  });
}

export async function cancelPilgrimAction(stage: string, values: unknown) {
  return runAction(async () => {
    if (stage !== "PRE_REG" && stage !== "REG") throw new ServiceError("Unknown cancel");
    const ctx = await requirePermission("hajji_management", "create");
    return cancelPilgrim(ctx, stage, values);
  });
}

export async function createTransferAction(type: string, values: unknown) {
  return runAction(async () => {
    const ctx = await requirePermission("hajji_management", "create");
    if (type === "IN") return createTransferIn(ctx, values);
    if (type === "MOALLEM" || type === "GROUP" || type === "OUT")
      return createTransfer(ctx, type, values);
    throw new ServiceError("Unknown transfer type");
  });
}

export async function voidTransferAction(id: string, values: unknown) {
  return runAction(async () => {
    const ctx = await requirePermission("hajji_management", "void");
    await voidTransfer(ctx, id, values, todayIso());
  });
}
