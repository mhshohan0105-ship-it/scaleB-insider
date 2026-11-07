"use server";

// Server actions for SMS (module "configuration"), Feedback (module "feedback")
// and platform administration (super admins only, checked by the service).
import type { AgencyStatus } from "@prisma/client";
import { signIn } from "@/auth";
import { todayIso } from "@/lib/dates";
import { runAction } from "@/server/actions/runAction";
import { getUserContext, requirePermission } from "@/server/auth/session";
import {
  createAgency,
  savePlan,
  setAgencyStatus,
  setAgencySubscription,
  startImpersonation,
  type AdminActor,
} from "@/server/services/admin/adminService";
import {
  backupNow,
  disconnectGoogle,
  saveGoogleClient,
} from "@/server/services/backup/platformBackup";
import { replyFeedback, sendFeedback } from "@/server/services/feedback/feedbackService";
import {
  adminSubscriptionPayments,
  recordSubscriptionPayment,
  voidSubscriptionPayment,
} from "@/server/services/subscription/paymentService";
import { sendManualSms, sendPassportReminders } from "@/server/services/sms/smsService";

export async function sendSmsAction(values: unknown) {
  return runAction(async () => {
    const log = await sendManualSms(await requirePermission("configuration", "create"), values);
    return { status: log.status, error: log.error };
  });
}

export async function passportRemindersAction() {
  return runAction(async () =>
    sendPassportReminders(await requirePermission("configuration", "create"), todayIso()),
  );
}

export async function sendFeedbackAction(values: unknown) {
  return runAction(async () => sendFeedback(await requirePermission("feedback", "create"), values));
}

export async function replyFeedbackAction(id: string, values: unknown) {
  return runAction(async () =>
    replyFeedback(await requirePermission("configuration", "edit"), id, values),
  );
}

async function actor(): Promise<AdminActor> {
  const u = await getUserContext();
  return { userId: u.userId, agencyId: u.agencyId, name: u.name };
}

export async function createAgencyAction(values: unknown) {
  return runAction(async () => createAgency(await actor(), values));
}

export async function setAgencyStatusAction(id: string, status: AgencyStatus) {
  return runAction(async () =>
    setAgencyStatus(await actor(), id, status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE"),
  );
}

export async function setAgencySubscriptionAction(id: string, values: unknown) {
  return runAction(async () => setAgencySubscription(await actor(), id, values));
}

export async function savePlanAction(id: string | null, values: unknown) {
  return runAction(async () => savePlan(await actor(), id, values));
}

/** Replaces this session with one signed in as the agency's owner. */
export async function openAgencyAction(id: string) {
  return runAction(async () => {
    const token = await startImpersonation(await actor(), id);
    await signIn("impersonate", { token, redirectTo: "/dashboard" });
  });
}

export async function backupNowAction() {
  return runAction(async () => backupNow(await actor()));
}

export async function saveGoogleClientAction(values: unknown) {
  return runAction(async () => saveGoogleClient(await actor(), values));
}

export async function disconnectGoogleAction() {
  return runAction(async () => disconnectGoogle(await actor()));
}

export async function agencyPaymentsAction(agencyId: string) {
  return runAction(async () => adminSubscriptionPayments(await actor(), agencyId));
}

export async function recordSubscriptionPaymentAction(agencyId: string, values: unknown) {
  return runAction(async () => recordSubscriptionPayment(await actor(), agencyId, values));
}

export async function voidSubscriptionPaymentAction(id: string, values: unknown) {
  return runAction(async () => voidSubscriptionPayment(await actor(), id, values));
}
