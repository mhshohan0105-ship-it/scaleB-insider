// Visa invoice and visa processing (PLAN.md 6.4). Each passenger line tracks
// its own status (Pending → Submitted → Approved / Rejected → Delivered) with
// a timestamped history; editing the invoice keeps existing lines' status.
import { Prisma } from "@prisma/client";
import { d } from "@/lib/calc/money";
import { dateToIso, isoToDate, todayIso } from "@/lib/dates";
import { visaInvoiceSchema, visaStatusSchema } from "@/lib/schemas/invoices";
import { recordAudit } from "@/server/audit/audit";
import { tenantDb, type TenantTx } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { NotFoundError, ServiceError } from "../errors";
import { createInvoice, updateInvoice, type PreparedLines } from "./invoiceSave";
import { notify } from "../notifications/notificationService";
import { visaStatusSms } from "../sms/smsService";

type Parsed = ReturnType<typeof visaInvoiceSchema.parse>;
type ParsedLine = Parsed["lines"][number];

export interface VisaHistoryEntry {
  status: string;
  at: string;
  by: string | null;
  note?: string | null;
}

const dec = (v: string) => new Prisma.Decimal(v);

async function assertVisaRefs(tx: TenantTx, lines: ParsedLine[]) {
  const vendorIds = [...new Set(lines.map((l) => l.vendorId))];
  const typeIds = [...new Set(lines.map((l) => l.visaTypeId).filter((x): x is string => !!x))];
  const [vendors, types] = await Promise.all([
    tx.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true } }),
    tx.visaType.findMany({ where: { id: { in: typeIds } }, select: { id: true } }),
  ]);
  const fieldErrors: Record<string, string> = {};
  lines.forEach((l, i) => {
    if (!vendors.some((v) => v.id === l.vendorId))
      fieldErrors[`lines.${i}.vendorId`] = "Choose a valid vendor";
    if (l.visaTypeId && !types.some((t) => t.id === l.visaTypeId)) {
      fieldErrors[`lines.${i}.visaTypeId`] = "Choose a valid visa type";
    }
  });
  if (Object.keys(fieldErrors).length)
    throw new ServiceError("Some lines refer to unknown records", fieldErrors);
}

function rowOf(l: ParsedLine, i: number) {
  return {
    sortOrder: i,
    country: l.country,
    visaTypeId: l.visaTypeId ?? null,
    passengerName: l.passengerName,
    passportNo: l.passportNo ?? null,
    vendorId: l.vendorId,
    clientPrice: dec(l.clientPrice),
    purchasePrice: dec(l.purchasePrice),
    profit: new Prisma.Decimal(d(l.clientPrice).minus(d(l.purchasePrice)).toFixed(2)),
    expectedDate: l.expectedDate ? isoToDate(l.expectedDate) : null,
    note: l.note ?? null,
  };
}

function prepareVisa(ctx: ServiceContext, lines: ParsedLine[]) {
  return async (tx: TenantTx): Promise<PreparedLines> => {
    await assertVisaRefs(tx, lines);
    const rows = lines.map(rowOf);
    const initialHistory = (): Prisma.InputJsonValue => [
      { status: "PENDING", at: new Date().toISOString(), by: ctx.userId },
    ];
    return {
      totals: rows,
      costs: rows
        .filter((r) => r.purchasePrice.greaterThan(0))
        .map((r) => ({ vendorId: r.vendorId, amount: r.purchasePrice })),
      write: async (t, id) => {
        await t.invoiceVisaLine.createMany({
          data: rows.map((r) => ({
            ...r,
            agencyId: ctx.agencyId,
            invoiceId: id,
            statusHistory: initialHistory(),
          })),
        });
      },
      // Keep existing lines (and their processing status); add new, drop removed.
      replace: async (t, id) => {
        const existing = await t.invoiceVisaLine.findMany({
          where: { invoiceId: id },
          select: { id: true },
        });
        const keep = new Set(lines.map((l) => l.id).filter((x): x is string => !!x));
        const removed = existing.filter((e) => !keep.has(e.id)).map((e) => e.id);
        if (removed.length)
          await t.invoiceVisaLine.deleteMany({ where: { id: { in: removed }, invoiceId: id } });
        for (const [i, l] of lines.entries()) {
          const row = rows[i]!;
          if (l.id && existing.some((e) => e.id === l.id)) {
            await t.invoiceVisaLine.update({ where: { id: l.id }, data: row });
          } else {
            await t.invoiceVisaLine.create({
              data: {
                ...row,
                agencyId: ctx.agencyId,
                invoiceId: id,
                statusHistory: initialHistory(),
              },
            });
          }
        }
      },
      audit: rows,
    };
  };
}

export async function createVisaInvoice(ctx: ServiceContext, input: unknown) {
  const data = visaInvoiceSchema.parse(input);
  return createInvoice(ctx, "VISA", data, prepareVisa(ctx, data.lines));
}

export async function updateVisaInvoice(ctx: ServiceContext, id: string, input: unknown) {
  const data = visaInvoiceSchema.parse(input);
  await updateInvoice(ctx, "VISA", id, data, prepareVisa(ctx, data.lines));
}

export async function postDraftVisaInvoice(ctx: ServiceContext, id: string) {
  const inv = await getVisaInvoice(ctx, id);
  if (!inv) throw new NotFoundError("Invoice");
  if (inv.status !== "DRAFT") throw new ServiceError("Only a draft can be posted");
  await updateVisaInvoice(ctx, id, { ...visaFormValues(inv), post: true });
}

/** Moves one passenger's visa to a new processing status (process board). */
export async function setVisaStatus(
  ctx: ServiceContext,
  lineId: string,
  input: unknown,
): Promise<void> {
  const data = visaStatusSchema.parse(input);
  const changed = await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const before = await tx.invoiceVisaLine.findFirst({
      where: { id: lineId },
      include: { invoice: { select: { status: true, number: true } } },
    });
    if (!before) throw new NotFoundError("Visa");
    if (before.invoice.status === "VOID") throw new ServiceError("This invoice is void");
    if (before.status === data.status) return null;
    const history = [
      ...((before.statusHistory as unknown as VisaHistoryEntry[]) ?? []),
      {
        status: data.status,
        at: new Date().toISOString(),
        by: ctx.userId,
        note: data.note ?? null,
      },
    ];
    const after = await tx.invoiceVisaLine.update({
      where: { id: lineId },
      data: {
        status: data.status,
        statusChangedAt: new Date(),
        statusHistory: history as unknown as Prisma.InputJsonValue,
        ...(data.status === "DELIVERED"
          ? { deliveryDate: isoToDate(data.deliveryDate ?? todayIso()) }
          : data.deliveryDate
            ? { deliveryDate: isoToDate(data.deliveryDate) }
            : {}),
      },
    });
    await recordAudit(tx, ctx, {
      action: "UPDATE",
      entity: "VisaProcess",
      entityId: lineId,
      before: { status: before.status },
      after: { status: after.status, note: data.note, invoice: before.invoice.number },
    });
    return after;
  });
  if (!changed) return;
  // After the change is saved: tell the client by SMS (if on) and the team in the app.
  await visaStatusSms(ctx, lineId, data.status);
  if (data.status === "APPROVED" || data.status === "REJECTED")
    await notify(ctx.agencyId, {
      module: "invoice_visa",
      kind: `VISA_${data.status}`,
      title: `Visa ${data.status === "APPROVED" ? "approved" : "rejected"}: ${changed.passengerName} (${changed.country})`,
      link: `/invoices/visa/${changed.invoiceId}`,
    });
}

export async function getVisaInvoice(ctx: ServiceContext, id: string) {
  const inv = await tenantDb(ctx.agencyId).invoice.findFirst({
    where: { id, type: "VISA" },
    include: {
      client: {
        select: { id: true, name: true, code: true, phone: true, email: true, address: true },
      },
      agent: { select: { id: true, name: true, code: true } },
      salesman: { select: { id: true, name: true } },
      visaLines: {
        orderBy: { sortOrder: "asc" },
        include: { vendor: { select: { name: true } }, visaType: { select: { name: true } } },
      },
      allocations: {
        where: { receipt: { status: "POSTED" } },
        include: { receipt: { select: { id: true, number: true, date: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!inv) return null;
  const money = (v: Prisma.Decimal) => v.toFixed(2);
  return {
    id: inv.id,
    type: inv.type,
    number: inv.number,
    status: inv.status,
    date: dateToIso(inv.date),
    dueDate: inv.dueDate ? dateToIso(inv.dueDate) : null,
    client: inv.client,
    agent: inv.agent,
    salesman: inv.salesman,
    subtotal: money(inv.subtotal),
    discount: money(inv.discount),
    serviceCharge: money(inv.serviceCharge),
    vat: money(inv.vat),
    netTotal: money(inv.netTotal),
    totalCost: money(inv.totalCost),
    agentCommission: money(inv.agentCommission),
    profit: money(inv.profit),
    paidAmount: money(inv.paidAmount),
    refundCredit: money(inv.refundCredit),
    due: money(inv.netTotal.minus(inv.refundCredit).minus(inv.paidAmount)),
    note: inv.note,
    voidReason: inv.voidReason,
    lines: inv.visaLines.map((l) => ({
      id: l.id,
      country: l.country,
      visaTypeId: l.visaTypeId,
      visaType: l.visaType?.name ?? null,
      passengerName: l.passengerName,
      passportNo: l.passportNo,
      vendorId: l.vendorId,
      vendor: l.vendor.name,
      clientPrice: money(l.clientPrice),
      purchasePrice: money(l.purchasePrice),
      profit: money(l.profit),
      status: l.status,
      statusChangedAt: l.statusChangedAt.toISOString(),
      history: (l.statusHistory as unknown as VisaHistoryEntry[]) ?? [],
      expectedDate: l.expectedDate ? dateToIso(l.expectedDate) : null,
      deliveryDate: l.deliveryDate ? dateToIso(l.deliveryDate) : null,
      note: l.note,
    })),
    payments: inv.allocations.map((a) => ({
      receiptId: a.receipt.id,
      number: a.receipt.number,
      date: dateToIso(a.receipt.date),
      amount: money(a.amount),
    })),
  };
}

export type VisaInvoiceView = NonNullable<Awaited<ReturnType<typeof getVisaInvoice>>>;

export function visaFormValues(inv: VisaInvoiceView) {
  return {
    clientId: inv.client.id,
    date: inv.date,
    dueDate: inv.dueDate,
    salesmanId: inv.salesman?.id ?? null,
    agentId: inv.agent?.id ?? null,
    agentCommission: inv.agentCommission,
    discount: inv.discount,
    serviceCharge: inv.serviceCharge,
    vat: inv.vat,
    note: inv.note,
    lines: inv.lines.map((l) => ({
      id: l.id,
      country: l.country,
      visaTypeId: l.visaTypeId,
      passengerName: l.passengerName,
      passportNo: l.passportNo,
      vendorId: l.vendorId,
      clientPrice: l.clientPrice,
      purchasePrice: l.purchasePrice,
      expectedDate: l.expectedDate,
      note: l.note,
    })),
  };
}

export interface VisaBoardCard {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  passengerName: string;
  passportNo: string | null;
  country: string;
  visaType: string | null;
  vendor: string;
  status: string;
  statusChangedAt: string;
  expectedDate: string | null;
  deliveryDate: string | null;
}

/** All visa lines of posted invoices for the process board (delivered: last 30 days). */
export async function visaBoard(ctx: ServiceContext, q?: string): Promise<VisaBoardCard[]> {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const term = q?.trim();
  const rows = await tenantDb(ctx.agencyId).invoiceVisaLine.findMany({
    where: {
      invoice: { status: { notIn: ["VOID", "DRAFT"] } },
      OR: [{ status: { not: "DELIVERED" } }, { statusChangedAt: { gte: since } }],
      ...(term
        ? {
            AND: [
              {
                OR: [
                  { passengerName: { contains: term, mode: "insensitive" } },
                  { passportNo: { contains: term, mode: "insensitive" } },
                  { country: { contains: term, mode: "insensitive" } },
                  { invoice: { number: { contains: term, mode: "insensitive" } } },
                  { invoice: { client: { name: { contains: term, mode: "insensitive" } } } },
                ],
              },
            ],
          }
        : {}),
    },
    include: {
      invoice: { select: { id: true, number: true, client: { select: { name: true } } } },
      vendor: { select: { name: true } },
      visaType: { select: { name: true } },
    },
    orderBy: [{ statusChangedAt: "asc" }],
    take: 1000,
  });
  return rows.map((r) => ({
    id: r.id,
    invoiceId: r.invoice.id,
    invoiceNumber: r.invoice.number,
    clientName: r.invoice.client.name,
    passengerName: r.passengerName,
    passportNo: r.passportNo,
    country: r.country,
    visaType: r.visaType?.name ?? null,
    vendor: r.vendor.name,
    status: r.status,
    statusChangedAt: r.statusChangedAt.toISOString(),
    expectedDate: r.expectedDate ? dateToIso(r.expectedDate) : null,
    deliveryDate: r.deliveryDate ? dateToIso(r.deliveryDate) : null,
  }));
}
