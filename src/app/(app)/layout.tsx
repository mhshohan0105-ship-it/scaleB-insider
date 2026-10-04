import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { NAV } from "@/lib/nav";
import { can } from "@/lib/permissions";
import { getUserContext } from "@/server/auth/session";
import { logoutAction } from "./actions";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await getUserContext();
  const nav = NAV.filter((m) => can(ctx.permissions, m.module, "view"));

  return (
    <AppShell
      nav={nav}
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
      {children}
    </AppShell>
  );
}
