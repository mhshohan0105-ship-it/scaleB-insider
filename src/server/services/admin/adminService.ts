// Platform administration (PLAN.md Phase 12): agencies, plans, suspension and
// opening an agency as its owner ("impersonation"). Only users flagged
// isSuperAdmin may call these. This is platform level work across agencies,
// so it uses the base client with explicit filters (documented exception to
// the tenant-scoped rule), and writes an audit entry in every agency touched.
import { createHash, randomBytes } from "node:crypto";
import type { AgencyStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { provisionAgency, provisionSchema } from "../agency/provisionAgency";
import { ForbiddenError, NotFoundError, ServiceError, isUniqueViolation } from "../errors";

export const PLANS = [
  { value: "starter", label: "Starter" },
  { value: "standard", label: "Standard" },
  { value: "premium", label: "Premium" },
] as const;

const IMPERSONATION_TTL_MS = 2 * 60 * 1000;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export interface AdminActor {
  userId: string;
  agencyId: string;
  name: string;
}

async function assertSuperAdmin(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true, isActive: true },
  });
  if (!u?.isSuperAdmin || !u.isActive) throw new ForbiddenError("Platform administrators only");
}

async function audit(
  agencyId: string,
  actor: AdminActor,
  action: string,
  entityId: string,
  after?: unknown,
) {
  await prisma.auditLog.create({
    data: {
      agencyId,
      userId: actor.userId,
      action,
      entity: "Agency",
      entityId,
      after: after === undefined ? undefined : JSON.parse(JSON.stringify(after)),
    },
  });
}

export async function listAgencies(actor: AdminActor) {
  await assertSuperAdmin(actor.userId);
  const agencies = await prisma.agency.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { users: true, invoices: true, clients: true } } },
  });
  const lastLogins = await prisma.loginHistory.groupBy({
    by: ["agencyId"],
    where: { success: true },
    _max: { at: true },
  });
  return agencies.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    status: a.status,
    plan: a.plan,
    phone: a.phone,
    email: a.email,
    users: a._count.users,
    clients: a._count.clients,
    invoices: a._count.invoices,
    createdAt: a.createdAt.toISOString(),
    lastLoginAt: lastLogins.find((l) => l.agencyId === a.id)?._max.at?.toISOString() ?? null,
    isOwn: a.id === actor.agencyId,
  }));
}

export type AgencyRow = Awaited<ReturnType<typeof listAgencies>>[number];

export async function createAgency(actor: AdminActor, input: unknown) {
  await assertSuperAdmin(actor.userId);
  const data = provisionSchema.parse(input);
  try {
    const { agency } = await provisionAgency(data);
    await audit(actor.agencyId, actor, "CREATE", agency.id, {
      code: agency.code,
      name: agency.name,
    });
    return { id: agency.id, code: agency.code };
  } catch (e) {
    if (isUniqueViolation(e))
      throw new ServiceError(`Agency code "${data.code}" is taken`, { code: "Taken" });
    throw e;
  }
}

export async function setAgencyStatus(actor: AdminActor, agencyId: string, status: AgencyStatus) {
  await assertSuperAdmin(actor.userId);
  if (agencyId === actor.agencyId && status === "SUSPENDED")
    throw new ServiceError("You cannot suspend your own agency");
  const before = await prisma.agency.findUnique({ where: { id: agencyId } });
  if (!before) throw new NotFoundError("Agency");
  await prisma.agency.update({ where: { id: agencyId }, data: { status } });
  await audit(agencyId, actor, status === "SUSPENDED" ? "DEACTIVATE" : "ACTIVATE", agencyId, {
    status,
  });
}

export async function setAgencyPlan(actor: AdminActor, agencyId: string, plan: string) {
  await assertSuperAdmin(actor.userId);
  const p = z.enum(PLANS.map((x) => x.value) as [string, ...string[]]).parse(plan);
  const before = await prisma.agency.findUnique({ where: { id: agencyId } });
  if (!before) throw new NotFoundError("Agency");
  await prisma.agency.update({ where: { id: agencyId }, data: { plan: p } });
  await audit(agencyId, actor, "UPDATE", agencyId, { plan: { from: before.plan, to: p } });
}

/**
 * Issues a one-time token (valid 2 minutes) to open the agency as its first
 * active owner. The raw token is returned once; only its hash is stored.
 */
export async function startImpersonation(actor: AdminActor, agencyId: string): Promise<string> {
  await assertSuperAdmin(actor.userId);
  const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
  if (!agency) throw new NotFoundError("Agency");
  if (agency.status === "SUSPENDED") throw new ServiceError("Activate the agency first");
  const owner = await prisma.user.findFirst({
    where: { agencyId, isActive: true, role: { name: "Owner" } },
    orderBy: { createdAt: "asc" },
  });
  if (!owner) throw new ServiceError("This agency has no active owner");
  const token = randomBytes(32).toString("hex");
  await prisma.impersonationToken.create({
    data: {
      tokenHash: hash(token),
      adminUserId: actor.userId,
      targetUserId: owner.id,
      expiresAt: new Date(Date.now() + IMPERSONATION_TTL_MS),
    },
  });
  await audit(actor.agencyId, actor, "IMPERSONATE", agencyId, {
    agency: agency.code,
    as: owner.username,
  });
  return token;
}

/** Used by the sign-in provider: exchanges a token for the owner's session. */
export async function consumeImpersonation(token: string) {
  const row = await prisma.impersonationToken.findUnique({ where: { tokenHash: hash(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;
  const used = await prisma.impersonationToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (!used.count) return null;
  const [user, admin] = await Promise.all([
    prisma.user.findUnique({ where: { id: row.targetUserId }, include: { agency: true } }),
    prisma.user.findUnique({
      where: { id: row.adminUserId },
      select: { id: true, name: true, isSuperAdmin: true },
    }),
  ]);
  if (!user || !user.isActive || user.agency.status === "SUSPENDED" || !admin?.isSuperAdmin)
    return null;
  await prisma.auditLog.create({
    data: {
      agencyId: user.agencyId,
      userId: admin.id,
      action: "IMPERSONATE",
      entity: "User",
      entityId: user.id,
      after: { openedBy: admin.name },
    },
  });
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    agencyId: user.agencyId,
    roleId: user.roleId,
    impersonatorId: admin.id,
    impersonatorName: admin.name,
  };
}
