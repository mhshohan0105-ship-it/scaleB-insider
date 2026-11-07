"use client";

import { createContext, useContext, type ReactNode } from "react";
import { can, type Action, type ModuleKey, type PermissionMap } from "@/lib/permissions";

const PermissionsContext = createContext<PermissionMap>({});

/**
 * The signed-in user's permissions, for hiding controls they cannot use.
 * Only a convenience: every server action checks permission again.
 */
export function PermissionsProvider({
  permissions,
  children,
}: {
  permissions: PermissionMap;
  children: ReactNode;
}) {
  return <PermissionsContext.Provider value={permissions}>{children}</PermissionsContext.Provider>;
}

export function useCan(module: ModuleKey, action: Action): boolean {
  return can(useContext(PermissionsContext), module, action);
}
