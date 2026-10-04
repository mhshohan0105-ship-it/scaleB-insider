// Quotations (PLAN.md 6.15): priced offers to a client that post nothing.
// Once accepted they convert, in one click, to a draft line-based invoice.
import { Prisma, type QuotationStatus } from "@prisma/client";
import { calcQuotation } from "@/lib/calc/quotation";
import { dateToIso, isoToDate } from "@/lib/dates";
import type { ListParams } from "@/lib/listParams";
import { quotationSchema, quotationStatusSchema } from "@/lib/schemas/documents";
import { recordAudit } from "@/server/audit/audit";
import { tenantDb, type TenantTx } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { NotFoundError, ServiceError } from "../errors";
import { createItemInvoice } from "../invoices/itemInvoiceService";
import { documentNumber } from "../numbering/documentNumber";

type Parsed = ReturnType<typeof quotationSchema.parse>;
const money = (v: Prisma.Decimal) => v.toFixed(2);
const dec = (v: { toFixed(n: number): string }) => new Prisma.Decimal(v.toFixed(2));

/** Status shown to people: an offer past its date is Expired. */
export function effectiveStatus(
  status: QuotationStatus,
  validUntil: string,
  today: string,
): string {
  return (status === "DRAFT" || status === "SENT") && validUntil < today ? "EXPIRED" : status;
}

async function assertRefs(tx: TenantTx, data: Parsed) {
  if (!(await tx.client.findFirst({ where: { id: data.clientId }, select: { id: true } })))
    throw new ServiceError("Client not found", { clientId: "Choose a valid client" });
  const ids = (k: "vendorId" | "productId") => [
    ...new Set(data.lines.map((l) => l[k]).filter((x): x is string => !!x)),
  ];
  const [vendors, products] = await Promise.all([
    tx.vendor.findMany({ where: { id: { in: ids("vendorId") } }, select: { id: true } }),
    tx.product.findMany({ where: { id: { in: ids("productId") } }, select: { id: true } }),
  ]);
  if (vendors.length !== ids("vendorId").length) throw new ServiceError("A vendor was not found");
  if (products.length !== ids("productId").length)
    throw new ServiceError("A product was not found");
}

function priced(data: Parsed) {
  const t = calcQuotation(data.lines, data.discount);
  if (t.netTotal.isNegative())
    throw new ServiceError("The discount is larger than the quotation", { discount: "Too large" });
  return t;
}

export async function saveQuotation(
  ctx: ServiceContext,
  id: string | null,
  input: unknown,
): Promise<{ id: string; number: string }> {
  const data = quotationSchema.parse(input);
  const t = priced(data);
  return tenantDb(ctx.agencyId).$transaction(async (tx) => {
    await assertRefs(tx, data);
    const header = {
      clientId: data.clientId,
      date: isoToDate(data.date),
      validUntil: isoToDate(data.validUntil),
      subject: data.subject ?? null,
      invoiceType: data.invoiceType,
      subtotal: dec(t.subtotal),
      discount: dec(t.discount),
      netTotal: dec(t.netTotal),
      note: data.note ?? null,
      terms: data.terms ?? null,
    };
    const lines = data.lines.map((l, i) => ({
      agencyId: ctx.agencyId,
      sortOrder: i,
      description: l.description,
      qty: new Prisma.Decimal(l.qty),
      unitPrice: new Prisma.Decimal(l.unitPrice),
      amount: dec(t.lines[i]!.amount),
      unitCost: new Prisma.Decimal(l.unitCost),
      vendorId: l.vendorId ?? null,
      productId: l.productId ?? null,
    }));
    if (id) {
      const before = await tx.quotation.findFirst({ where: { id } });
      if (!before) throw new NotFoundError("Quotation");
      if (before.status === "CONVERTED")
        throw new ServiceError("A converted quotation cannot be edited");
      const after = await tx.quotation.update({ where: { id }, data: header });
      await tx.quotationLine.deleteMany({ where: { quotationId: id } });
      await tx.quotationLine.createMany({ data: lines.map((l) => ({ ...l, quotationId: id })) });
      await recordAudit(tx, ctx, {
        action: "UPDATE",
        entity: "Quotation",
        entityId: id,
        before,
        after: { ...after, lines },
      });
      return { id, number: before.number };
    }
    const number = await documentNumber(tx, ctx, "QUOTATION", data.date);
    const q = await tx.quotation.create({
      data: { agencyId: ctx.agencyId, number, ...header, createdById: ctx.userId },
    });
    await tx.quotationLine.createMany({ data: lines.map((l) => ({ ...l, quotationId: q.id })) });
    await recordAudit(tx, ctx, {
      action: "CREATE",
      entity: "Quotation",
      entityId: q.id,
      after: { ...q, lines },
    });
    return { id: q.id, number };
  });
}

const NEXT: Record<string, readonly QuotationStatus[]> = {
  DRAFT: ["SENT", "ACCEPTED", "REJECTED"],
  SENT: ["ACCEPTED", "REJECTED"],
  ACCEPTED: ["REJECTED"],
  REJECTED: ["SENT"],
  CONVERTED: [],
};

export async function setQuotationStatus(ctx: ServiceContext, id: string, input: unknown) {
  const { status } = quotationStatusSchema.parse(input);
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const before = await tx.quotation.findFirst({ where: { id } });
    if (!before) throw new NotFoundError("Quotation");
    if (!NEXT[before.status]!.includes(status))
      throw new ServiceError(
        `A ${before.status.toLowerCase()} quotation cannot be marked ${status.toLowerCase()}`,
      );
    const after = await tx.quotation.update({ where: { id }, data: { status } });
    await recordAudit(tx, ctx, {
      action: "UPDATE",
      entity: "Quotation",
      entityId: id,
      before,
      after,
    });
  });
}

/**
 * Converts to a draft invoice of the quotation's invoice type, dated today.
 * The quotation is claimed first so two clicks cannot make two invoices.
 */
export async function convertQuotation(
  ctx: ServiceContext,
  id: string,
  today: string,
): Promise<{ invoiceId: string; invoiceType: string }> {
  const db = tenantDb(ctx.agencyId);
  const q = await db.quotation.findFirst({
    where: { id },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!q) throw new NotFoundError("Quotation");
  if (q.status === "CONVERTED" || q.status === "REJECTED")
    throw new ServiceError(`A ${q.status.toLowerCase()} quotation cannot be converted`);
  const claimed = await db.quotation.updateMany({
    where: { id, status: q.status, convertedInvoiceId: null },
    data: { status: "CONVERTED" },
  });
  if (!claimed.count) throw new ServiceError("This quotation was just converted");
  try {
    const kind = q.invoiceType === "TOUR" ? "PACKAGE" : "SERVICE";
    const inv = await createItemInvoice(ctx, q.invoiceType as "OTHER" | "OTHER_PACKAGE" | "TOUR", {
      clientId: q.clientId,
      date: today,
      discount: q.discount.toFixed(2),
      note: [`From quotation ${q.number}`, q.subject].filter(Boolean).join(": "),
      items: q.lines.map((l) => ({
        kind,
        description: l.description,
        qty: l.qty.toString(),
        unitPrice: l.unitPrice.toFixed(2),
        unitCost: l.unitCost.toFixed(2),
        vendorId: l.vendorId,
        productId: l.productId,
      })),
      post: false,
    });
    await db.$transaction(async (tx) => {
      const after = await tx.quotation.update({
        where: { id },
        data: { convertedInvoiceId: inv.id },
      });
      await recordAudit(tx, ctx, {
        action: "UPDATE",
        entity: "Quotation",
        entityId: id,
        before: q,
        after,
      });
    });
    return { invoiceId: inv.id, invoiceType: q.invoiceType };
  } catch (e) {
    await db.quotation.update({ where: { id }, data: { status: q.status } });
    throw e;
  }
}

export interface QuotationRow {
  id: string;
  number: string;
  date: string;
  validUntil: string;
  clientId: string;
  clientName: string;
  subject: string | null;
  netTotal: string;
  status: string;
  convertedInvoice: { id: string; number: string; type: string } | null;
}

export async function listQuotations(
  ctx: ServiceContext,
  params: ListParams & { quoteStatus?: string; clientId?: string },
  today: string,
) {
  const db = tenantDb(ctx.agencyId);
  const where: Prisma.QuotationWhereInput = {};
  if (params.clientId) where.clientId = params.clientId;
  if (params.quoteStatus === "EXPIRED")
    Object.assign(where, {
      status: { in: ["DRAFT", "SENT"] },
      validUntil: { lt: isoToDate(today) },
    });
  else if (params.quoteStatus === "OPEN")
    Object.assign(where, {
      status: { in: ["DRAFT", "SENT", "ACCEPTED"] },
      validUntil: { gte: isoToDate(today) },
    });
  else if (params.quoteStatus) where.status = params.quoteStatus as QuotationStatus;
  if (params.from || params.to)
    where.date = {
      ...(params.from ? { gte: isoToDate(params.from) } : {}),
      ...(params.to ? { lte: isoToDate(params.to) } : {}),
    };
  const text = params.q?.trim();
  if (text)
    where.OR = [
      { number: { contains: text, mode: "insensitive" } },
      { subject: { contains: text, mode: "insensitive" } },
      { client: { name: { contains: text, mode: "insensitive" } } },
    ];
  const [rows, total] = await Promise.all([
    db.quotation.findMany({
      where,
      include: {
        client: { select: { name: true } },
        convertedInvoice: { select: { id: true, number: true, type: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    db.quotation.count({ where }),
  ]);
  return {
    total,
    rows: rows.map((q): QuotationRow => ({
      id: q.id,
      number: q.number,
      date: dateToIso(q.date),
      validUntil: dateToIso(q.validUntil),
      clientId: q.clientId,
      clientName: q.client.name,
      subject: q.subject,
      netTotal: money(q.netTotal),
      status: effectiveStatus(q.status, dateToIso(q.validUntil), today),
      convertedInvoice: q.convertedInvoice,
    })),
  };
}

export type QuotationList = Awaited<ReturnType<typeof listQuotations>>;

export async function getQuotation(ctx: ServiceContext, id: string, today: string) {
  const q = await tenantDb(ctx.agencyId).quotation.findFirst({
    where: { id },
    include: {
      client: {
        select: { id: true, name: true, code: true, phone: true, email: true, address: true },
      },
      convertedInvoice: { select: { id: true, number: true, type: true } },
      lines: {
        orderBy: { sortOrder: "asc" },
        include: { vendor: { select: { name: true } }, product: { select: { name: true } } },
      },
    },
  });
  if (!q) return null;
  const t = calcQuotation(
    q.lines.map((l) => ({
      qty: l.qty.toString(),
      unitPrice: l.unitPrice.toFixed(2),
      unitCost: l.unitCost.toFixed(2),
    })),
    q.discount.toFixed(2),
  );
  return {
    id: q.id,
    number: q.number,
    date: dateToIso(q.date),
    validUntil: dateToIso(q.validUntil),
    subject: q.subject,
    invoiceType: q.invoiceType,
    client: q.client,
    subtotal: money(q.subtotal),
    discount: money(q.discount),
    netTotal: money(q.netTotal),
    cost: t.cost.toFixed(2),
    margin: t.margin.toFixed(2),
    note: q.note,
    terms: q.terms,
    status: q.status,
    shownStatus: effectiveStatus(q.status, dateToIso(q.validUntil), today),
    convertedInvoice: q.convertedInvoice,
    lines: q.lines.map((l) => ({
      id: l.id,
      description: l.description,
      qty: l.qty.toString(),
      unitPrice: money(l.unitPrice),
      amount: money(l.amount),
      unitCost: money(l.unitCost),
      vendorId: l.vendorId,
      vendor: l.vendor?.name ?? null,
      productId: l.productId,
      product: l.product?.name ?? null,
    })),
  };
}

export type QuotationView = NonNullable<Awaited<ReturnType<typeof getQuotation>>>;

export function quotationFormValues(q: QuotationView) {
  return {
    clientId: q.client.id,
    date: q.date,
    validUntil: q.validUntil,
    subject: q.subject,
    invoiceType: q.invoiceType,
    discount: q.discount,
    note: q.note,
    terms: q.terms,
    lines: q.lines.map((l) => ({
      description: l.description,
      qty: l.qty,
      unitPrice: l.unitPrice,
      unitCost: l.unitCost,
      vendorId: l.vendorId,
      productId: l.productId,
    })),
  };
}

/** The invoice type a quotation converts to (null when it does not exist). */
export async function quotationInvoiceType(ctx: ServiceContext, id: string) {
  const q = await tenantDb(ctx.agencyId).quotation.findFirst({
    where: { id },
    select: { invoiceType: true },
  });
  return q?.invoiceType ?? null;
}
