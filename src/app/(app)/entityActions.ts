"use server";

// Server actions for every list handled by the generic entity engine
// (configuration masters and parties). Permission comes from the list's module.
import { ENTITIES, entityModule, isEntityKey } from "@/lib/entities";
import type { EntityKey } from "@/lib/masters";
import { runAction } from "@/server/actions/runAction";
import { requirePermission } from "@/server/auth/session";
import { ServiceError } from "@/server/services/errors";
import {
  saveMaster,
  searchEntityOptions,
  setMasterActive,
} from "@/server/services/masters/masterService";

function assertKey(key: string): asserts key is EntityKey {
  if (!isEntityKey(key)) throw new ServiceError("Unknown list");
}

export async function saveEntityAction(key: string, id: string | null, values: unknown) {
  return runAction(async () => {
    assertKey(key);
    const ctx = await requirePermission(entityModule(ENTITIES[key]), id ? "edit" : "create");
    return saveMaster(ctx, key, id, values);
  });
}

export async function setEntityActiveAction(key: string, id: string, active: boolean) {
  return runAction(async () => {
    assertKey(key);
    const ctx = await requirePermission(entityModule(ENTITIES[key]), "edit");
    await setMasterActive(ctx, key, id, active);
  });
}

/** Type-ahead options for PartySelect and other large lists. */
export async function searchEntityAction(key: string, q: string, includeId?: string | null) {
  return runAction(async () => {
    assertKey(key);
    const ctx = await requirePermission(entityModule(ENTITIES[key]), "view");
    return searchEntityOptions(ctx, key, q.slice(0, 100), includeId);
  });
}
