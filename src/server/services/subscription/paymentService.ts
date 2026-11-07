// Subscription payments (Step 9): money an agency pays for its plan. Recorded
// by the platform admin (base client, documented platform exception); each
// payment moves the agency's paidUntil on and can be voided, never deleted.
// This is the platform's income, not an entry in the agency's own books.
import { Prisma } from "@prisma/client";
import { dateToIso, isoToDate, todayIso } from "@/lib/dates";
import { subscriptionPaymentSchema, voidPaymentSchema } from "@/lib/schemas/subscriptionPayment";
import { endOfDhakaDay, paymentPeriod } from "@/lib/subscription";
import { prisma } from "@/server/db/prisma";
import { tenantDb } from "@/server/db/tenant";
import { assertSuperAdmin, audit, type AdminActor } from "../admin/adminService";
import { NotFoundError, ServiceError } from "../errors";
import { notify } from "../notifications/notificationService";

function toRow(p: {
  id: string;
  number: string;
  date: Date;
  amount: Prisma.Decimal;
  method: string;
  reference: string | null;
  plan: string;
  months: number;
  periodFrom: Date;
  periodTo: Date;
  note: string | null;
  status: string;
  voidReason: string | null;
}) {
  return {
    id: p.id,
    number: p.number,
    date: dateToIso(p.date),
    amount: p.amount.toFixed(2),
    method: p.method,
    reference: p.reference,
    plan: p.plan,
    months: p.months,
    periodFrom: dateToIso(p.periodFrom),
    periodTo: dateToIso(p.periodTo),
    note: p.note,
    status: p.status,
    voidReason: p.voidReason,
  };
}

export type SubscriptionPaymentRow = ReturnType<typeof toRow>;

/** Records a payment, moves the agency onto the plan and extends its paid period. */
export async function recordSubscriptionPayment(
  actor: AdminActor,
  agencyId: string,
  input: unknown,
) {
  await assertSuperAdmin(actor.userId);
  const data = subscriptionPaymentSchema.parse(input);
  if (!(await prisma.plan.findUnique({ where: { code: data.plan } })))
    throw new ServiceError("Choose a plan", { plan: "Unknown plan" });

  const result = await prisma.$transaction(async (tx) => {
    const agency = await tx.agency.findUnique({ where: { id: agencyId } });
    if (!agency) throw new NotFoundError("Agency");
    if (agency.status === "SUSPENDED") throw new ServiceError("Activate the agency first");

    const period = paymentPeriod(
      agency.status === "ACTIVE" && agency.paidUntil ? todayIso(agency.paidUntil) : null,
      data.date,
      data.months,
    );
    const year = data.date.slice(0, 4);
    const count = await tx.subscriptionPayment.count({
      where: { number: { startsWith: `SUB-${year}-` } },
    });
    const payment = await tx.subscriptionPayment.create({
      data: {
        agencyId,
        number: `SUB-${year}-${String(count + 1).padStart(5, "0")}`,
        date: isoToDate(data.date),
        amount: new Prisma.Decimal(data.amount),
        method: data.method,
        reference: data.reference ?? null,
        plan: data.plan,
        months: data.months,
        periodFrom: isoToDate(period.from),
        periodTo: isoToDate(period.to),
        note: data.note ?? null,
        createdById: actor.userId,
      },
    });
    await tx.agency.update({
      where: { id: agencyId },
      data: {
        plan: data.plan,
        status: "ACTIVE",
        trialEndsAt: null,
        paidUntil: endOfDhakaDay(period.to),
      },
    });
    return { payment, agencyName: agency.name };
  });

  await audit(agencyId, actor, "CREATE", result.payment.id, {
    subscriptionPayment: toRow(result.payment),
  });
  await notify(agencyId, {
    module: "configuration",
    kind: "SUBSCRIPTION_PAID",
    title: `Payment received: plan renewed to ${result.payment.periodTo.toISOString().slice(0, 10)}`,
    body: `${result.payment.number} · BDT ${result.payment.amount.toFixed(2)}`,
    link: "/settings/subscription",
  });
  return { id: result.payment.id, number: result.payment.number };
}

/** Voids a payment; the paid period falls back to the remaining payments. */
export async function voidSubscriptionPayment(actor: AdminActor, id: string, input: unknown) {
  await assertSuperAdmin(actor.userId);
  const { reason } = voidPaymentSchema.parse(input);
  const voided = await prisma.$transaction(async (tx) => {
    const p = await tx.subscriptionPayment.findUnique({ where: { id } });
    if (!p) throw new NotFoundError("Payment");
    if (p.status === "VOID") throw new ServiceError("This payment is already void");
    const after = await tx.subscriptionPayment.update({
      where: { id },
      data: { status: "VOID", voidReason: reason },
    });
    const last = await tx.subscriptionPayment.findFirst({
      where: { agencyId: p.agencyId, status: "POSTED" },
      orderBy: { periodTo: "desc" },
    });
    // With no payment left, the period ends the day before this one began.
    const until = last
      ? dateToIso(last.periodTo)
      : dateToIso(new Date(p.periodFrom.getTime() - 24 * 60 * 60 * 1000));
    await tx.agency.update({
      where: { id: p.agencyId },
      data: { paidUntil: endOfDhakaDay(until) },
    });
    return after;
  });
  await audit(voided.agencyId, actor, "VOID", id, { subscriptionPayment: toRow(voided) });
}

/** Platform admin: an agency's payments, newest first. */
export async function adminSubscriptionPayments(actor: AdminActor, agencyId: string) {
  await assertSuperAdmin(actor.userId);
  const rows = await prisma.subscriptionPayment.findMany({
    where: { agencyId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toRow);
}

/** The agency's own payments (Subscription page). */
export async function mySubscriptionPayments(agencyId: string) {
  const rows = await tenantDb(agencyId).subscriptionPayment.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toRow);
}

/** One payment for its receipt: the agency's own, or any for a platform admin. */
export async function subscriptionPaymentForReceipt(
  agencyId: string,
  id: string,
  isSuperAdmin: boolean,
) {
  const p = isSuperAdmin
    ? await prisma.subscriptionPayment.findUnique({ where: { id }, include: { agency: true } })
    : await tenantDb(agencyId).subscriptionPayment.findFirst({
        where: { id },
        include: { agency: true },
      });
  if (!p) return null;
  return {
    ...toRow(p),
    agency: {
      name: p.agency.name,
      code: p.agency.code,
      phone: p.agency.phone,
      address: p.agency.address,
    },
  };
}

export type SubscriptionReceipt = NonNullable<
  Awaited<ReturnType<typeof subscriptionPaymentForReceipt>>
>;
