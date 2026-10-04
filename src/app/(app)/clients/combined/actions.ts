"use server";

// Combined client set-offs (receivable settled against payable). Same
// permission as bill adjustments: Accounts edit.
import { runAction } from "@/server/actions/runAction";
import { requirePermission } from "@/server/auth/session";
import { createSetOff, setOffLimit, voidSetOff } from "@/server/services/parties/combinedService";

export async function setOffLimitAction(combinedId: string) {
  return runAction(async () =>
    setOffLimit(await requirePermission("accounts", "edit"), combinedId),
  );
}

export async function setOffAction(combinedId: string, values: unknown) {
  return runAction(async () =>
    createSetOff(await requirePermission("accounts", "edit"), combinedId, values),
  );
}

export async function voidSetOffAction(id: string, values: unknown) {
  return runAction(async () => voidSetOff(await requirePermission("accounts", "edit"), id, values));
}
