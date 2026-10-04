// SMS (PLAN.md Phase 12): sends through the configured gateway and keeps a log.
// Automatic messages (visa approved / delivered, passport expiry) go out only
// when SMS is on in App Config and never break the action that caused them.
import { Prisma } from "@prisma/client";
import { dateToIso, todayIso } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { addMonthsIso } from "@/lib/passport";
import type { ListParams } from "@/lib/listParams";
import { normalizeBdMobile, passportExpirySms, smsParts, visaSms } from "@/lib/sms";
import { z } from "zod";
import { recordAudit } from "@/server/audit/audit";
import { sqlDate } from "@/server/db/sqlDate";
import { tenantDb } from "@/server/db/tenant";
import { getSmsProvider, type SmsProvider } from "@/server/sms/provider";
import type { ServiceContext } from "../context";
import { ServiceError } from "../errors";
import { notify } from "../notifications/notificationService";
import { getAppConfig, getProfile } from "../settings/settingsService";

export const manualSmsSchema = z.object({
  to: z.string({ error: "Enter the mobile number" }).trim().min(1, "Enter the mobile number"),
  message: z.string({ error: "Write the message" }).trim().min(2, "Write the message").max(640),
});

interface SendInput {
  to: string;
  message: string;
  event: string;
  relatedType?: string | null;
  relatedId?: string | null;
}

let providerOverride: SmsProvider | null = null;
/** Tests: use a fake gateway. */
export function setSmsProviderForTests(p: SmsProvider | null) {
  providerOverride = p;
}

async function deliver(ctx: ServiceContext, input: SendInput) {
  const to = normalizeBdMobile(input.to);
  const provider = providerOverride ?? getSmsProvider();
  const result = to
    ? await provider.send(to, input.message)
    : { status: "FAILED" as const, error: `Not a mobile number: ${input.to}` };
  const log = await tenantDb(ctx.agencyId).smsLog.create({
    data: {
      agencyId: ctx.agencyId,
      to: to ?? input.to,
      message: input.message,
      event: input.event,
      status: result.status,
      providerRef: result.providerRef ?? null,
      error: result.error ?? null,
      relatedType: input.relatedType ?? null,
      relatedId: input.relatedId ?? null,
      createdById: ctx.userId,
    },
  });
  if (result.status === "FAILED")
    await notify(ctx.agencyId, {
      module: "configuration",
      kind: "SMS_FAILED",
      title: `SMS to ${input.to} failed`,
      body: result.error ?? null,
      link: "/settings/sms",
    });
  return log;
}

/** Sent by a user from the SMS page. */
export async function sendManualSms(ctx: ServiceContext, input: unknown) {
  const data = manualSmsSchema.parse(input);
  if (!(await getAppConfig(ctx)).smsEnabled)
    throw new ServiceError("SMS is turned off. Turn it on in App Config.");
  if (!normalizeBdMobile(data.to))
    throw new ServiceError("Enter a Bangladesh mobile number (01XXXXXXXXX)", {
      to: "Not a mobile number",
    });
  const log = await deliver(ctx, { to: data.to, message: data.message, event: "MANUAL" });
  await tenantDb(ctx.agencyId).$transaction((tx) =>
    recordAudit(tx, ctx, {
      action: "CREATE",
      entity: "SmsLog",
      entityId: log.id,
      after: { to: log.to, status: log.status },
    }),
  );
  return { id: log.id, status: log.status, error: log.error };
}

/** Automatic message for an event; skipped when SMS is off or there is no mobile. */
export async function sendEventSms(ctx: ServiceContext, input: SendInput): Promise<void> {
  try {
    if (!(await getAppConfig(ctx)).smsEnabled) return;
    if (!normalizeBdMobile(input.to)) return;
    await deliver(ctx, input);
  } catch (e) {
    console.error("event sms failed", e);
  }
}

/** Visa approved / delivered: tells the client (PLAN.md 6.4). */
export async function visaStatusSms(ctx: ServiceContext, lineId: string, status: string) {
  if (status !== "APPROVED" && status !== "DELIVERED") return;
  const line = await tenantDb(ctx.agencyId).invoiceVisaLine.findFirst({
    where: { id: lineId },
    include: { invoice: { select: { client: { select: { phone: true } } } } },
  });
  const phone = line?.invoice.client.phone;
  if (!line || !phone) return;
  const agency = await getProfile(ctx);
  await sendEventSms(ctx, {
    to: phone,
    message: visaSms(status, {
      passengerName: line.passengerName,
      country: line.country,
      agencyName: agency.name,
    }),
    event: `VISA_${status}`,
    relatedType: "VISA_LINE",
    relatedId: lineId,
  });
}

/**
 * Reminds holders of passports expiring within 6 months (not yet expired),
 * at most once every 30 days per passport. Returns how many were sent.
 */
export async function sendPassportReminders(ctx: ServiceContext, today = todayIso()) {
  if (!(await getAppConfig(ctx)).smsEnabled)
    throw new ServiceError("SMS is turned off. Turn it on in App Config.");
  const db = tenantDb(ctx.agencyId);
  const due = await db.$queryRaw<
    { id: string; name: string; passportNo: string; expiry: Date; phone: string | null }[]
  >`
    SELECT p.id, p.name, p."passportNo", p."expiryDate" AS expiry, COALESCE(p.phone, c.phone) AS phone
    FROM "Passport" p LEFT JOIN "Client" c ON c.id = p."clientId"
    WHERE p."agencyId" = ${ctx.agencyId} AND p."isActive"
      AND p."expiryDate" > ${sqlDate(today)} AND p."expiryDate" < ${sqlDate(addMonthsIso(today, 6))}
      AND NOT EXISTS (
        SELECT 1 FROM "SmsLog" s WHERE s."agencyId" = p."agencyId" AND s."relatedType" = 'PASSPORT'
          AND s."relatedId" = p.id AND s.status <> 'FAILED' AND s."createdAt" > now() - interval '30 days')`;
  const agency = await getProfile(ctx);
  let sent = 0;
  let skipped = 0;
  for (const p of due) {
    if (!normalizeBdMobile(p.phone)) {
      skipped++;
      continue;
    }
    const log = await deliver(ctx, {
      to: p.phone!,
      message: passportExpirySms({
        name: p.name,
        passportNo: p.passportNo,
        expiry: formatDate(dateToIso(p.expiry)),
        agencyName: agency.name,
      }),
      event: "PASSPORT_EXPIRY",
      relatedType: "PASSPORT",
      relatedId: p.id,
    });
    if (log.status !== "FAILED") sent++;
  }
  return { sent, skipped, considered: due.length };
}

export async function listSmsLogs(ctx: ServiceContext, params: ListParams) {
  const db = tenantDb(ctx.agencyId);
  const where: Prisma.SmsLogWhereInput = {};
  const q = params.q?.trim();
  if (q) where.OR = [{ to: { contains: q } }, { message: { contains: q, mode: "insensitive" } }];
  if (params.from || params.to)
    where.createdAt = {
      ...(params.from ? { gte: new Date(`${params.from}T00:00:00+06:00`) } : {}),
      ...(params.to ? { lte: new Date(`${params.to}T23:59:59.999+06:00`) } : {}),
    };
  const [rows, total, counts] = await Promise.all([
    db.smsLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    db.smsLog.count({ where }),
    db.smsLog.groupBy({ by: ["status"], where, _count: { _all: true } }),
  ]);
  return {
    total,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Record<
      string,
      number
    >,
    provider: (providerOverride ?? getSmsProvider()).name,
    rows: rows.map((r) => ({
      id: r.id,
      at: r.createdAt.toISOString(),
      to: r.to,
      message: r.message,
      parts: smsParts(r.message),
      event: r.event,
      status: r.status,
      error: r.error,
    })),
  };
}

export type SmsLogList = Awaited<ReturnType<typeof listSmsLogs>>;
