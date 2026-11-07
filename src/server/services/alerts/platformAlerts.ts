// Alerts for whoever runs this installation (Step 9): an in-app notification
// for every platform administrator, and an SMS to the platform agency's phone
// when a real SMS gateway is set up. Never throws: an alert must not break the
// job that raised it.
import { normalizeBdMobile } from "@/lib/sms";
import { subscriptionStatus } from "@/lib/subscription";
import { prisma } from "@/server/db/prisma";
import { getSmsProvider } from "@/server/sms/provider";
import { notify } from "../notifications/notificationService";
import { platformAgency } from "../subscription/subscriptionService";

export async function alertPlatform(alert: {
  kind: string;
  title: string;
  body?: string | null;
  link?: string | null;
  /** Also text the platform phone (only for things that need action today). */
  sms?: boolean;
}) {
  try {
    const admins = await prisma.user.findMany({
      where: { isSuperAdmin: true, isActive: true },
      select: { agencyId: true },
      distinct: ["agencyId"],
    });
    for (const a of admins)
      await notify(a.agencyId, {
        module: "configuration",
        kind: alert.kind,
        title: alert.title,
        body: alert.body ?? null,
        link: alert.link ?? null,
      });
    if (alert.sms && process.env.SMS_URL_TEMPLATE?.trim()) {
      const to = normalizeBdMobile((await platformAgency())?.phone);
      if (to) await getSmsProvider().send(to, `scaleB Insider: ${alert.title}`.slice(0, 300));
    }
  } catch (e) {
    console.error("Platform alert failed:", (e as Error).message);
  }
}

const HOUR_MS = 60 * 60 * 1000;

/** Daily: raises an alert when no nightly backup has succeeded for over a day. */
export async function checkNightlyBackup(now = new Date()) {
  const last = await prisma.backupRun.findFirst({
    where: { status: { in: ["OK", "PARTIAL"] } },
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  });
  if (last && now.getTime() - last.startedAt.getTime() < 30 * HOUR_MS) return { ok: true };
  await alertPlatform({
    kind: "BACKUP_MISSING",
    title: "No database backup in the last day",
    body: last
      ? `The last good backup started ${last.startedAt.toISOString()}. Check the 2 AM cron job and Admin > Database backups.`
      : "No backup has ever succeeded. Check the 2 AM cron job and Admin > Database backups.",
    link: "/admin/backups",
    sms: true,
  });
  return { ok: false };
}

/** Days before the end on which the agency and the platform are reminded. */
const REMIND_ON = new Set([7, 3, 1]);

/**
 * Daily: reminds agencies whose trial or paid period ends in 7, 3 or 1 days,
 * or ended yesterday, and sends the platform admin one list of them.
 */
export async function subscriptionReminders(now = new Date()) {
  const agencies = await prisma.agency.findMany({
    where: { status: { in: ["TRIAL", "ACTIVE"] } },
    select: { id: true, name: true, code: true, status: true, trialEndsAt: true, paidUntil: true },
  });
  const listed: string[] = [];
  for (const a of agencies) {
    const s = subscriptionStatus(a, now);
    if (s.daysLeft === null) continue;
    const endedYesterday = s.state === "expired" && s.daysLeft === -1;
    if (!REMIND_ON.has(s.daysLeft) && !endedYesterday) continue;
    const what = s.trial ? "Your free trial" : "Your subscription";
    await notify(a.id, {
      module: "configuration",
      kind: "SUBSCRIPTION_REMINDER",
      title: endedYesterday
        ? `${what} has ended. The account is now view only.`
        : `${what} ends in ${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"}.`,
      body: "Renew to keep adding records. Nothing is deleted.",
      link: "/settings/subscription",
    });
    listed.push(
      `${a.name} (${a.code}): ${s.trial ? "trial" : "paid"} ${endedYesterday ? "ended" : `${s.daysLeft}d left`}`,
    );
  }
  if (listed.length)
    await alertPlatform({
      kind: "SUBSCRIPTIONS_DUE",
      title: `${listed.length} agenc${listed.length === 1 ? "y" : "ies"} due for renewal`,
      body: listed.join("\n").slice(0, 480),
      link: "/admin",
    });
  return listed;
}
