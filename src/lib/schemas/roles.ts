import { z } from "zod";
import { ACTIONS, MODULE_KEYS, type PermissionMap } from "@/lib/permissions";

export const roleSchema = z.object({
  name: z.string().trim().min(2, "Role name is required").max(60),
  permissions: z.record(z.string(), z.array(z.enum(ACTIONS))).transform((raw): PermissionMap => {
    const out: PermissionMap = {};
    for (const m of MODULE_KEYS) {
      const actions = raw[m];
      if (actions && actions.length > 0) out[m] = Array.from(new Set(actions));
    }
    return out;
  }),
});

export type RoleInput = z.input<typeof roleSchema>;

/** The Owner role always has every permission and cannot be edited. */
export const OWNER_ROLE_NAME = "Owner";
