"use server";

import { runAction } from "@/server/actions/runAction";
import { requirePermission } from "@/server/auth/session";
import { saveRole } from "@/server/services/roles/roleService";
import { saveAppConfig, saveProfile } from "@/server/services/settings/settingsService";
import {
  createUser,
  resetUserPassword,
  setUserActive,
  updateUser,
} from "@/server/services/users/userService";

// ─── App config and profile ────────────────────────────────────────────────

export async function saveAppConfigAction(values: unknown) {
  return runAction(async () => {
    const ctx = await requirePermission("configuration", "edit");
    await saveAppConfig(ctx, values);
  });
}

export async function saveProfileAction(values: unknown) {
  return runAction(async () => {
    const ctx = await requirePermission("configuration", "edit");
    await saveProfile(ctx, values);
  });
}

// ─── Users ─────────────────────────────────────────────────────────────────

export async function createUserAction(values: unknown) {
  return runAction(async () => {
    const ctx = await requirePermission("configuration", "create");
    return createUser(ctx, values);
  });
}

export async function updateUserAction(id: string, values: unknown) {
  return runAction(async () => {
    const ctx = await requirePermission("configuration", "edit");
    await updateUser(ctx, id, values);
  });
}

export async function setUserActiveAction(id: string, active: boolean) {
  return runAction(async () => {
    const ctx = await requirePermission("configuration", "edit");
    await setUserActive(ctx, id, active);
  });
}

export async function resetUserPasswordAction(id: string, values: unknown) {
  return runAction(async () => {
    const ctx = await requirePermission("configuration", "edit");
    await resetUserPassword(ctx, id, values);
  });
}

// ─── Roles ─────────────────────────────────────────────────────────────────

export async function saveRoleAction(id: string | null, values: unknown) {
  return runAction(async () => {
    const ctx = await requirePermission("configuration", id ? "edit" : "create");
    return saveRole(ctx, id, values);
  });
}
