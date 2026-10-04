// In-app notifications (PLAN.md Phase 12). Events notify every active user
// whose role can view the module concerned; each user reads their own.
import { can, parsePermissions, type ModuleKey } from "@/lib/permissions";
import { prisma } from "@/server/db/prisma";
import { tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "../context";

export interface NotifyInput {
  module: ModuleKey;
  kind: string;
  title: string;
  body?: string | null;
  link?: string | null;
}

/**
 * Notifies the agency's users who can view `module`. Never throws: a
 * notification must not undo the business action that caused it.
 */
export async function notify(agencyId: string, n: NotifyInput): Promise<number> {
  try {
    const users = await tenantDb(agencyId).user.findMany({
      where: { isActive: true },
      select: { id: true, role: { select: { permissions: true } } },
    });
    const to = users.filter((u) => can(parsePermissions(u.role.permissions), n.module, "view"));
    if (!to.length) return 0;
    await tenantDb(agencyId).notification.createMany({
      data: to.map((u) => ({
        agencyId,
        userId: u.id,
        kind: n.kind,
        title: n.title.slice(0, 200),
        body: n.body?.slice(0, 500) ?? null,
        link: n.link ?? null,
      })),
    });
    return to.length;
  } catch (e) {
    console.error("notify failed", e);
    return 0;
  }
}

export async function myNotifications(ctx: ServiceContext, take = 15) {
  const db = tenantDb(ctx.agencyId);
  const [rows, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId: ctx.userId! },
      orderBy: { createdAt: "desc" },
      take,
    }),
    db.notification.count({ where: { userId: ctx.userId!, readAt: null } }),
  ]);
  return {
    unread,
    rows: rows.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      link: n.link,
      read: !!n.readAt,
      at: n.createdAt.toISOString(),
    })),
  };
}

export type MyNotifications = Awaited<ReturnType<typeof myNotifications>>;

/** Marks one (or, without id, all) of the user's notifications read. */
export async function markRead(ctx: ServiceContext, id?: string) {
  await tenantDb(ctx.agencyId).notification.updateMany({
    where: { userId: ctx.userId!, readAt: null, ...(id ? { id } : {}) },
    data: { readAt: new Date() },
  });
}

/** Old read notifications are removed after 90 days (nightly job). */
export async function pruneNotifications(): Promise<number> {
  const r = await prisma.notification.deleteMany({
    where: { readAt: { lt: new Date(Date.now() - 90 * 86_400_000) } },
  });
  return r.count;
}
