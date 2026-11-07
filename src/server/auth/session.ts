// Server side session helpers for pages, layouts and server actions.
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/server/db/prisma";
import {
  can,
  parsePermissions,
  type Action,
  type ModuleKey,
  type PermissionMap,
} from "@/lib/permissions";
import { planPermissions } from "@/lib/subscription";
import type { ServiceContext } from "@/server/services/context";
import {
  subscriptionOf,
  type AgencySubscription,
} from "@/server/services/subscription/subscriptionService";
import { ForbiddenError } from "@/server/services/errors";

export interface UserContext {
  userId: string;
  agencyId: string;
  name: string;
  username: string;
  roleId: string;
  roleName: string;
  agencyName: string;
  permissions: PermissionMap;
  /** Platform operator (may use /admin). */
  isSuperAdmin: boolean;
  /** Name of the platform admin who opened this session, if any. */
  impersonatedBy: string | null;
  /** The agency's plan and trial / paid period. */
  subscription: AgencySubscription;
}

/**
 * Loads the signed in user with fresh role permissions (once per request),
 * cut down to the agency's plan; read only once its trial or paid period ends.
 * Redirects to sign out when the session is missing or the user was deactivated.
 */
export const getUserContext = cache(async (): Promise<UserContext> => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Pre-tenant lookup: identity comes from the signed session.
  const user = await prisma.user.findFirst({
    where: { id: session.user.id, agencyId: session.user.agencyId },
    include: { role: true, agency: true },
  });
  if (!user || !user.isActive || user.agency.status === "SUSPENDED") redirect("/signout");
  const subscription = await subscriptionOf(user.agency);

  return {
    userId: user.id,
    agencyId: user.agencyId,
    name: user.name,
    username: user.username,
    roleId: user.roleId,
    roleName: user.role.name,
    agencyName: user.agency.name,
    permissions: planPermissions(
      parsePermissions(user.role.permissions),
      subscription.plan,
      subscription.status.state,
    ),
    isSuperAdmin: user.isSuperAdmin,
    impersonatedBy: session.user.impersonatorName ?? null,
    subscription,
  };
});

/** Builds the ServiceContext (tenant, user, request metadata) for service calls. */
export async function toServiceContext(ctx: UserContext): Promise<ServiceContext> {
  const h = await headers();
  return {
    agencyId: ctx.agencyId,
    userId: ctx.userId,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent"),
  };
}

/** Pages: true when the current user may perform the action. */
export async function userCan(module: ModuleKey, action: Action): Promise<boolean> {
  const ctx = await getUserContext();
  return can(ctx.permissions, module, action);
}

/**
 * Server actions: checks the permission and returns a ServiceContext.
 * Throws ForbiddenError (reported to the client by runAction) when not allowed.
 */
export async function requirePermission(
  module: ModuleKey,
  action: Action,
): Promise<ServiceContext & { user: UserContext }> {
  const ctx = await getUserContext();
  if (!can(ctx.permissions, module, action)) {
    if (ctx.subscription.status.state === "expired" && action !== "view" && action !== "export")
      throw new ForbiddenError(
        "Your subscription has ended, so records cannot be added or changed. Renew it to continue; viewing and exporting still work.",
      );
    throw new ForbiddenError();
  }
  return { ...(await toServiceContext(ctx)), user: ctx };
}
