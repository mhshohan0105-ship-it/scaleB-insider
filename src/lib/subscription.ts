// Subscription rules (Step 9): what an agency may use under its plan and
// whether its trial or paid period has run out. Pure and shared by server
// and client; the server applies the result to every permission check.
import { addMonthsIso } from "./passport";
import { MODULE_KEYS, type ModuleKey, type PermissionMap } from "./permissions";

/** Days after `paidUntil` an agency keeps full use while the renewal is sorted out. */
export const GRACE_DAYS = 7;
/** Length of a self sign-up trial. */
export const TRIAL_DAYS = 14;
/** Days before the end when the agency starts seeing a reminder. */
export const REMIND_DAYS = 7;

/** Modules every plan includes: without them an agency cannot work at all. */
export const CORE_MODULES: readonly ModuleKey[] = ["dashboard", "configuration", "feedback"];

/** Modules a plan may leave out, in sidebar order. */
export const PLAN_MODULES: readonly ModuleKey[] = MODULE_KEYS.filter(
  (m) => !CORE_MODULES.includes(m),
);

const DAY_MS = 24 * 60 * 60 * 1000;

export type SubscriptionState =
  /** No end date, or more than REMIND_DAYS to go. */
  | "ok"
  /** Ends within REMIND_DAYS (or the trial is running): show a reminder. */
  | "ending"
  /** Paid period over but inside the grace days: full use, urgent reminder. */
  | "grace"
  /** Trial or paid period (and grace) over: read only. */
  | "expired";

export interface SubscriptionStatus {
  state: SubscriptionState;
  trial: boolean;
  /** When use stops (trial end, or paidUntil + grace); null when it never does. */
  endsAt: string | null;
  /** Whole days until `endsAt` (0 on the last day, negative after). */
  daysLeft: number | null;
}

export interface AgencyTerms {
  status: "ACTIVE" | "TRIAL" | "SUSPENDED";
  trialEndsAt: Date | null;
  paidUntil: Date | null;
}

function daysBetween(now: Date, end: Date): number {
  return Math.floor((end.getTime() - now.getTime()) / DAY_MS);
}

export function subscriptionStatus(a: AgencyTerms, now: Date): SubscriptionStatus {
  const trial = a.status === "TRIAL";
  const end = trial ? a.trialEndsAt : a.paidUntil;
  if (!end) return { state: "ok", trial, endsAt: null, daysLeft: null };

  const stop = trial ? end : new Date(end.getTime() + GRACE_DAYS * DAY_MS);
  const daysLeft = daysBetween(now, stop);
  let state: SubscriptionState;
  if (now >= stop) state = "expired";
  else if (!trial && now >= end) state = "grace";
  else if (trial || daysBetween(now, end) < REMIND_DAYS) state = "ending";
  else state = "ok";
  return { state, trial, endsAt: stop.toISOString(), daysLeft };
}

/** Plan.modules as stored (untrusted JSON) -> the optional modules it includes. */
export function parsePlanModules(raw: unknown): ModuleKey[] {
  if (!Array.isArray(raw)) return [];
  return PLAN_MODULES.filter((m) => raw.includes(m));
}

/**
 * The role's permissions cut down to the plan: modules outside the plan are
 * removed, and an expired subscription keeps only viewing and exporting, so
 * nothing is lost and the agency can still take its data out.
 */
export function planPermissions(
  role: PermissionMap,
  plan: { modules: ModuleKey[] },
  state: SubscriptionState,
): PermissionMap {
  const allowed = plan.modules.length
    ? new Set<ModuleKey>([...CORE_MODULES, ...plan.modules])
    : null;
  const out: PermissionMap = {};
  for (const [key, actions] of Object.entries(role) as [ModuleKey, PermissionMap[ModuleKey]][]) {
    if (!actions || (allowed && !allowed.has(key))) continue;
    const kept =
      state === "expired" ? actions.filter((a) => a === "view" || a === "export") : actions;
    // An empty list still means "may view" once the role had any access.
    out[key] = kept.length ? kept : ["view"];
  }
  return out;
}

/** "YYYY-MM-DD" -> the last moment of that day in Dhaka (UTC+6, no daylight saving). */
export function endOfDhakaDay(iso: string): Date {
  const d = new Date(`${iso}T23:59:59.999+06:00`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date "${iso}"`);
  return d;
}

/** True when one more active user still fits the plan (0 = no limit). */
export function userFits(maxUsers: number, activeUsers: number): boolean {
  return maxUsers === 0 || activeUsers < maxUsers;
}

const nextDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * The days a payment covers ("YYYY-MM-DD", both included): it continues an
 * unexpired paid period, otherwise it starts on the payment date.
 */
export function paymentPeriod(
  paidUntil: string | null,
  paidOn: string,
  months: number,
): { from: string; to: string } {
  const from = paidUntil && paidUntil >= paidOn ? nextDay(paidUntil) : paidOn;
  const end = new Date(`${addMonthsIso(from, months)}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() - 1);
  return { from, to: end.toISOString().slice(0, 10) };
}
