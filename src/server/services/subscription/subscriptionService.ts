// An agency's plan and subscription period (Step 9). Plans are platform level
// rows (no agencyId), so they are read with the base client; the agency itself
// is always looked up by the caller's own agencyId.
import { Prisma } from "@prisma/client";
import { todayIso } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import {
  parsePlanModules,
  subscriptionStatus,
  userFits,
  type SubscriptionStatus,
} from "@/lib/subscription";
import type { ModuleKey } from "@/lib/permissions";
import { prisma } from "@/server/db/prisma";
import { tenantDb, type TenantTx } from "@/server/db/tenant";
import { ServiceError } from "../errors";

export interface AgencyPlan {
  code: string;
  name: string;
  maxUsers: number;
  /** Optional modules included; empty means every module. */
  modules: ModuleKey[];
  priceMonthly: string;
  priceYearly: string;
}

export interface AgencySubscription {
  plan: AgencyPlan;
  status: SubscriptionStatus;
  /** "YYYY-MM-DD" in Dhaka; shown to the agency. */
  trialEndsOn: string | null;
  paidUntilOn: string | null;
}

/** A plan code with no row (e.g. deleted): every module, no limit, no price. */
function fallbackPlan(code: string): AgencyPlan {
  return { code, name: code, maxUsers: 0, modules: [], priceMonthly: "0.00", priceYearly: "0.00" };
}

export async function planByCode(code: string): Promise<AgencyPlan> {
  const p = await prisma.plan.findUnique({ where: { code } });
  if (!p) return fallbackPlan(code);
  return {
    code: p.code,
    name: p.name,
    maxUsers: p.maxUsers,
    modules: parsePlanModules(p.modules),
    priceMonthly: p.priceMonthly.toFixed(2),
    priceYearly: p.priceYearly.toFixed(2),
  };
}

/** Plan and period for an agency row already loaded by the caller. */
export async function subscriptionOf(
  agency: {
    plan: string;
    status: "ACTIVE" | "TRIAL" | "SUSPENDED";
    trialEndsAt: Date | null;
    paidUntil: Date | null;
  },
  now = new Date(),
): Promise<AgencySubscription> {
  return {
    plan: await planByCode(agency.plan),
    status: subscriptionStatus(agency, now),
    trialEndsOn: agency.trialEndsAt ? todayIso(agency.trialEndsAt) : null,
    paidUntilOn: agency.paidUntil ? todayIso(agency.paidUntil) : null,
  };
}

/**
 * Refuses one more active user when the plan's limit is reached. Runs inside
 * the caller's transaction, before the user is created or switched on.
 */
export async function assertUserFits(tx: TenantTx, agencyId: string) {
  const agency = await prisma.agency.findUniqueOrThrow({
    where: { id: agencyId },
    select: { plan: true },
  });
  const plan = await planByCode(agency.plan);
  const active = await tx.user.count({ where: { isActive: true } });
  if (!userFits(plan.maxUsers, active))
    throw new ServiceError(
      `Your ${plan.name} plan allows ${plan.maxUsers} active users. Deactivate a user or ask us to move you to a bigger plan.`,
    );
}

/** What the agency sees on its Subscription page. */
export async function subscriptionPage(agencyId: string) {
  const agency = await prisma.agency.findUniqueOrThrow({ where: { id: agencyId } });
  const [sub, activeUsers, plans, platform] = await Promise.all([
    subscriptionOf(agency),
    tenantDb(agencyId).user.count({ where: { isActive: true } }),
    prisma.plan.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }] }),
    // Whoever runs this installation: the first agency with a platform administrator.
    prisma.agency.findFirst({
      where: { users: { some: { isSuperAdmin: true, isActive: true } } },
      orderBy: { createdAt: "asc" },
      select: { name: true, phone: true, email: true },
    }),
  ]);
  return {
    ...sub,
    activeUsers,
    priceLine: priceLine(sub.plan),
    plans: plans.map((p) => {
      const plan = {
        code: p.code,
        name: p.name,
        maxUsers: p.maxUsers,
        modules: parsePlanModules(p.modules),
        priceMonthly: p.priceMonthly.toFixed(2),
        priceYearly: p.priceYearly.toFixed(2),
      };
      return { ...plan, priceLine: priceLine(plan) };
    }),
    contact: platform,
  };
}

export type SubscriptionPageData = Awaited<ReturnType<typeof subscriptionPage>>;

/** One line for the plan's price, e.g. "BDT 1,500.00 a month or BDT 15,000.00 a year". */
export function priceLine(plan: AgencyPlan): string {
  const parts = [];
  if (new Prisma.Decimal(plan.priceMonthly).gt(0))
    parts.push(`BDT ${formatMoney(plan.priceMonthly)} a month`);
  if (new Prisma.Decimal(plan.priceYearly).gt(0))
    parts.push(`BDT ${formatMoney(plan.priceYearly)} a year`);
  return parts.join(" or ");
}
