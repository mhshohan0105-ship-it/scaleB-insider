// Single registry of every list handled by the generic entity engine.
import { MASTERS, MASTER_KEYS, PARTY_KEYS, type EntityKey, type MasterDef } from "./masters";
import { PARTIES } from "./parties";
import type { ModuleKey } from "./permissions";

export const ENTITIES: Record<EntityKey, MasterDef> = { ...MASTERS, ...PARTIES };

const ALL_KEYS: readonly string[] = [...MASTER_KEYS, ...PARTY_KEYS];

export function isEntityKey(value: string): value is EntityKey {
  return ALL_KEYS.includes(value);
}

export function entityModule(def: MasterDef): ModuleKey {
  return def.module ?? "configuration";
}
