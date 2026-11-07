// Platform administration (PLAN.md Phase 12): agencies, plans, suspension and
// opening an agency as its owner ("impersonation"). Only users flagged
// isSuperAdmin may call these. This is platform level work across agencies,
// so it uses the base client with explicit filters (documented exception to
// the tenant-scoped rule), and writes an audit entry in every agency touched.
import { createHash, randomBytes } from "node:crypto";
import { Prisma, type AgencyStatus } from "@prisma/client";
import { todayIso } from "@/lib/dates";
import { planSchema, subscriptionSchema } from "@/lib/schemas/subscription";
import { endOfDhakaDay, parsePlanModules, subscriptionStatus } from "@/lib/subscription";
import { prisma } from "@/server/db/prisma";
import { provisionAgency, provisionSchema } from "../agency/provisionAgency";
import { ForbiddenError, NotFoundError, ServiceError, isUniqueViolation } from "../errors";

const IMPERSONATION_TTL_MS = 2 * 60 * 1000;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export interface AdminActor {
  userId: string;
  agencyId: string;
  name: string;
}

export async function assertSuperAdmin(userId: string) {
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
    trialEndsOn: a.trialEndsAt ? todayIso(a.trialEndsAt) : null,
    paidUntilOn: a.paidUntil ? todayIso(a.paidUntil) : null,
    subscription: subscriptionStatus(a, new Date()),
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
  // Activating again returns a never-paid trial agency to its trial, not to free use.
  const next: AgencyStatus =
    status === "SUSPENDED"
      ? "SUSPENDED"
      : before.trialEndsAt && !before.paidUntil
        ? "TRIAL"
        : "ACTIVE";
  await prisma.agency.update({ where: { id: agencyId }, data: { status: next } });
  await audit(agencyId, actor, next === "SUSPENDED" ? "DEACTIVATE" : "ACTIVATE", agencyId, {
    status: next,
  });
}

/**
 * Sets an agency's plan, trial or paid period. Dates are Dhaka calendar days;
 * the period runs to the end of that day. A paid date ends any trial.
 */
export async function setAgencySubscription(actor: AdminActor, agencyId: string, input: unknown) {
  await assertSuperAdmin(actor.userId);
  const data = subscriptionSchema.parse(input);
  if (!(await prisma.plan.findUnique({ where: { code: data.plan } })))
    throw new ServiceError("Choose a plan", { plan: "Unknown plan" });
  const before = await prisma.agency.findUnique({ where: { id: agencyId } });
  if (!before) throw new NotFoundError("Agency");
  if (before.status === "SUSPENDED") throw new ServiceError("Activate the agency first");
  const change = {
    plan: data.plan,
    status: data.status,
    trialEndsAt:
      data.status === "TRIAL" && data.trialEndsAt ? endOfDhakaDay(data.trialEndsAt) : null,
    paidUntil: data.paidUntil ? endOfDhakaDay(data.paidUntil) : null,
  };
  await prisma.agency.update({ where: { id: agencyId }, data: change });
  await audit(agencyId, actor, "UPDATE", agencyId, {
    subscription: {
      from: {
        plan: before.plan,
        status: before.status,
        trialEndsAt: before.trialEndsAt,
        paidUntil: before.paidUntil,
      },
      to: change,
    },
  });
}

// ─── Plans ──────────────────────────────────────────────────────────────────

export async function listPlans(actor: AdminActor) {
  await assertSuperAdmin(actor.userId);
  const [plans, used] = await Promise.all([
    prisma.plan.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.agency.groupBy({ by: ["plan"], _count: { _all: true } }),
  ]);
  return plans.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    priceMonthly: p.priceMonthly.toFixed(2),
    priceYearly: p.priceYearly.toFixed(2),
    maxUsers: p.maxUsers,
    modules: parsePlanModules(p.modules) as string[],
    isActive: p.isActive,
    sortOrder: p.sortOrder,
    agencies: used.find((u) => u.plan === p.code)?._count._all ?? 0,
  }));
}

export type PlanRow = Awaited<ReturnType<typeof listPlans>>[number];

/** Creates (id = null) or updates a plan. A plan in use keeps its code. */
export async function savePlan(actor: AdminActor, id: string | null, input: unknown) {
  await assertSuperAdmin(actor.userId);
  const data = planSchema.parse(input);
  const row = {
    ...data,
    priceMonthly: new Prisma.Decimal(data.priceMonthly),
    priceYearly: new Prisma.Decimal(data.priceYearly),
  };
  try {
    if (!id) {
      const created = await prisma.plan.create({ data: row });
      await audit(actor.agencyId, actor, "CREATE", created.id, { plan: data });
      return { id: created.id };
    }
    const before = await prisma.plan.findUnique({ where: { id } });
    if (!before) throw new NotFoundError("Plan");
    if (before.code !== data.code && (await prisma.agency.count({ where: { plan: before.code } })))
      throw new ServiceError("Agencies use this plan, so its code cannot change", {
        code: "In use",
      });
    await prisma.plan.update({ where: { id }, data: row });
    await audit(actor.agencyId, actor, "UPDATE", id, { plan: { from: before, to: data } });
    return { id };
  } catch (e) {
    if (isUniqueViolation(e))
      throw new ServiceError(`Plan code "${data.code}" is taken`, { code: "Taken" });
    throw e;
  }
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
