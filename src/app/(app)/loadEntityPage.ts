import "server-only";
import { ENTITIES, entityModule } from "@/lib/entities";
import type { EntityKey, FieldOption } from "@/lib/masters";
import { parseListParams } from "@/lib/listParams";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { listMasters, masterOptions } from "@/server/services/masters/masterService";

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Loads everything MasterPage needs, or null when the user cannot view the list's module. */
export async function loadEntityPage(key: EntityKey, raw: RawSearchParams) {
  const def = ENTITIES[key];
  const moduleKey = entityModule(def);
  const user = await getUserContext();
  if (!can(user.permissions, moduleKey, "view")) return null;

  const ctx = await toServiceContext(user);
  const params = parseListParams(raw);

  const refFields = def.fields.filter((f) => f.type === "ref" && f.ref);
  const [list, ...options] = await Promise.all([
    listMasters(ctx, key, params),
    ...refFields.map((f) => masterOptions(ctx, f.ref!)),
  ]);

  const refOptions: Record<string, FieldOption[]> = {};
  refFields.forEach((f, i) => (refOptions[f.name] = options[i] ?? []));

  return {
    masterKey: key,
    rows: list.rows,
    total: list.total,
    params,
    refOptions,
    canCreate: can(user.permissions, moduleKey, "create"),
    canEdit: can(user.permissions, moduleKey, "edit"),
  };
}
