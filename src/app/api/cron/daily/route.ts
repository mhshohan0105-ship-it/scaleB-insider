// Daily jobs (PLAN.md Phase 12), for every active agency:
//  - passport expiry reminders by SMS (when SMS is on; each passport at most
//    once every 30 days)
//  - on Mondays, an in-app notice of passports expiring within 30 days
//  - old read notifications are removed
// Call with: Authorization: Bearer <CRON_SECRET>.
import { NextResponse, type NextRequest } from "next/server";
import { todayIso } from "@/lib/dates";
import { addMonthsIso } from "@/lib/passport";
import { cronAuthorised } from "@/server/cron/auth";
import { prisma } from "@/server/db/prisma";
import { tenantDb } from "@/server/db/tenant";
import { notify, pruneNotifications } from "@/server/services/notifications/notificationService";
import { sendPassportReminders } from "@/server/services/sms/smsService";

export async function GET(req: NextRequest) {
  if (!cronAuthorised(req)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const today = todayIso();
  const monday = new Date(`${today}T00:00:00Z`).getUTCDay() === 1;
  const agencies = await prisma.agency.findMany({
    where: { status: { not: "SUSPENDED" } },
    select: { id: true, code: true, setting: { select: { smsEnabled: true } } },
  });
  const results: Record<string, unknown>[] = [];
  for (const a of agencies) {
    const ctx = { agencyId: a.id, userId: null, ip: null, userAgent: "cron" };
    const row: Record<string, unknown> = { agency: a.code };
    if (a.setting?.smsEnabled)
      row.sms = await sendPassportReminders(ctx, today).catch((e: Error) => e.message);
    if (monday) {
      const soon = await tenantDb(a.id).passport.count({
        where: {
          isActive: true,
          expiryDate: {
            gt: new Date(`${today}T00:00:00Z`),
            lt: new Date(`${addMonthsIso(today, 1)}T00:00:00Z`),
          },
        },
      });
      if (soon)
        row.notified = await notify(a.id, {
          module: "passport",
          kind: "PASSPORT_EXPIRY",
          title: `${soon} passport${soon === 1 ? "" : "s"} expire within 30 days`,
          link: "/passports?expiry=SOON",
        });
    }
    results.push(row);
  }
  const pruned = await pruneNotifications();
  return NextResponse.json({ today, agencies: results, pruned });
}
