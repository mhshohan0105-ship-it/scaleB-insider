import type { ReactNode } from "react";
import { PermissionsProvider } from "@/components/PermissionsProvider";
import { SubscriptionBanner } from "@/components/subscription/SubscriptionBanner";
import { AppShell } from "@/components/shell/AppShell";
import { NAV } from "@/lib/nav";
import { MODULE_KEYS, can } from "@/lib/permissions";
import { getUserContext } from "@/server/auth/session";
import { logoutAction } from "./actions";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await getUserContext();
  const nav = NAV.filter((m) => can(ctx.permissions, m.module, "view"));

  return (
    <AppShell
      nav={nav}
      creatable={MODULE_KEYS.filter((m) => can(ctx.permissions, m, "create"))}
      user={{
        name: ctx.name,
        username: ctx.username,
        roleName: ctx.roleName,
        agencyName: ctx.agencyName,
        isSuperAdmin: ctx.isSuperAdmin,
        impersonatedBy: ctx.impersonatedBy,
      }}
      logoutAction={logoutAction}
    >
      <SubscriptionBanner
        status={ctx.subscription.status}
        canManage={can(ctx.permissions, "configuration", "view")}
      />
      <PermissionsProvider permissions={ctx.permissions}>{children}</PermissionsProvider>
    </AppShell>
  );
}
