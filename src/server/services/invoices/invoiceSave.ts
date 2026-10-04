// Create / edit for every invoice type. Each type prepares its lines (prices,
// costs per vendor, how to write them); this module does the rest: header
// checks, totals, numbering, draft vs post, reverse + repost on edit, audit.
import { Prisma, type InvoiceType } from "@prisma/client";
import { calcInvoiceTotals } from "@/lib/calc/invoiceTotals";
import { isoToDate } from "@/lib/dates";
import { INVOICE_TYPE_INFO } from "@/lib/invoiceTypes";
import { recordAudit } from "@/server/audit/audit";
import { tenantDb, type TenantTx } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { NotFoundError, ServiceError } from "../errors";
import { documentNumber } from "../numbering/documentNumber";
import { lockInvoice, postInvoice, repostInvoice, statusAfterPayment } from "./invoiceCommon";

/** Header fields as parsed by `invoiceHeaderFields` (src/lib/schemas/invoices.ts). */
export interface InvoiceHeaderInput {
  clientId: string;
  date: string;
  dueDate?: string | null;
  salesmanId?: string | null;
  agentId?: string | null;
  agentCommission: string;
  discount: string;
  serviceCharge: string;
  vat: string;
  note?: string | null;
  tourGroupId?: string | null;
  groupId?: string | null;
  travelDate?: string | null;
  returnDate?: string | null;
  post: boolean;
}

/** What an invoice type contributes: priced lines and how to store them. */
export interface PreparedLines {
  totals: { clientPrice: Prisma.Decimal; purchasePrice: Prisma.Decimal }[];
  costs: { vendorId: string; amount: Prisma.Decimal }[];
  /** Writes the lines of a (new or emptied) invoice. */
  write(tx: TenantTx, invoiceId: string): Promise<void>;
  /** Replaces the lines of an existing invoice (default: delete all, then write). */
  replace?(tx: TenantTx, invoiceId: string): Promise<void>;
  /** Snapshot for the audit trail. */
  audit: unknown;
}

export type PrepareLines = (tx: TenantTx, invoiceId: string | null) => Promise<PreparedLines>;

async function assertHeaderRefs(tx: TenantTx, h: InvoiceHeaderInput) {
  const checks: [string | null | undefined, () => Promise<unknown>, string, string][] = [
    [
      h.clientId,
      () => tx.client.findFirst({ where: { id: h.clientId }, select: { id: true } }),
      "clientId",
      "client",
    ],
    [
      h.agentId,
      () => tx.agent.findFirst({ where: { id: h.agentId! }, select: { id: true } }),
      "agentId",
      "agent",
    ],
    [
      h.salesmanId,
      () => tx.employee.findFirst({ where: { id: h.salesmanId! }, select: { id: true } }),
      "salesmanId",
      "employee",
    ],
    [
      h.tourGroupId,
      () => tx.tourGroup.findFirst({ where: { id: h.tourGroupId! }, select: { id: true } }),
      "tourGroupId",
      "tour group",
    ],
    [
      h.groupId,
      () => tx.group.findFirst({ where: { id: h.groupId! }, select: { id: true } }),
      "groupId",
      "group",
    ],
  ];
  for (const [value, find, field, what] of checks) {
    if (value && !(await find()))
      throw new ServiceError(`${what} not found`, { [field]: `Choose a valid ${what}` });
  }
}

function header(h: InvoiceHeaderInput, lines: PreparedLines) {
  const totals = calcInvoiceTotals({
    lines: lines.totals,
    discount: h.discount,
    serviceCharge: h.serviceCharge,
    vat: h.vat,
    agentCommission: h.agentCommission,
  });
  if (totals.netTotal.isNegative()) {
    throw new ServiceError("The discount is larger than the invoice", { discount: "Too large" });
  }
  const dec = (v: { toFixed(n: number): string }) => new Prisma.Decimal(v.toFixed(2));
  const date = (v?: string | null) => (v ? isoToDate(v) : null);
  return {
    clientId: h.clientId,
    agentId: h.agentId ?? null,
    salesmanId: h.salesmanId ?? null,
    date: isoToDate(h.date),
    dueDate: date(h.dueDate),
    tourGroupId: h.tourGroupId ?? null,
    groupId: h.groupId ?? null,
    travelDate: date(h.travelDate),
    returnDate: date(h.returnDate),
    subtotal: dec(totals.subtotal),
    discount: dec(totals.discount),
    serviceCharge: dec(totals.serviceCharge),
    vat: dec(totals.vat),
    netTotal: dec(totals.netTotal),
    totalCost: dec(totals.totalCost),
    agentCommission: dec(totals.agentCommission),
    profit: dec(totals.profit),
    note: h.note ?? null,
  };
}

export async function createInvoice(
  ctx: ServiceContext,
  type: InvoiceType,
  h: InvoiceHeaderInput,
  prepare: PrepareLines,
): Promise<{ id: string; number: string }> {
  return tenantDb(ctx.agencyId).$transaction(async (tx) => {
    await assertHeaderRefs(tx, h);
    const lines = await prepare(tx, null);
    const data = header(h, lines);
    const number = await documentNumber(tx, ctx, INVOICE_TYPE_INFO[type].docType, h.date);
    const invoice = await tx.invoice.create({
      data: {
        agencyId: ctx.agencyId,
        number,
        type,
        ...data,
        status: h.post ? "POSTED" : "DRAFT",
        postedAt: h.post ? new Date() : null,
        createdById: ctx.userId,
      },
    });
    await lines.write(tx, invoice.id);
    if (h.post)
      await postInvoice(tx, ctx, { ...data, id: invoice.id, number, type, costs: lines.costs });
    await recordAudit(tx, ctx, {
      action: "CREATE",
      entity: "Invoice",
      entityId: invoice.id,
      after: { ...invoice, lines: lines.audit },
    });
    return { id: invoice.id, number };
  });
}

/**
 * Edits an invoice. Draft: saved (and posted if asked). Posted: the old entry
 * is reversed and the new figures posted; the total may not drop below what
 * has been received, and the client cannot change once money came in.
 */
export async function updateInvoice(
  ctx: ServiceContext,
  type: InvoiceType,
  id: string,
  h: InvoiceHeaderInput,
  prepare: PrepareLines,
): Promise<void> {
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    await lockInvoice(tx, ctx.agencyId, id);
    const before = await tx.invoice.findFirst({ where: { id, type } });
    if (!before) throw new NotFoundError("Invoice");
    if (before.status === "VOID" || before.status === "REFUNDED") {
      throw new ServiceError(`A ${before.status.toLowerCase()} invoice cannot be edited`);
    }
    if (await tx.refund.count({ where: { invoiceId: id, status: "POSTED" } })) {
      throw new ServiceError("This invoice has refunds. Void the refunds before editing it.");
    }
    if (before.clientId !== h.clientId && before.paidAmount.greaterThan(0)) {
      throw new ServiceError("The client cannot change once money has been received", {
        clientId: "Locked",
      });
    }
    await assertHeaderRefs(tx, h);
    const lines = await prepare(tx, id);
    const data = header(h, lines);
    if (data.netTotal.lessThan(before.paidAmount)) {
      throw new ServiceError(
        `${before.paidAmount.toFixed(2)} has already been received; the invoice total cannot be lower than that`,
      );
    }
    const wasPosted = before.status !== "DRAFT";
    const posting = wasPosted || h.post;
    const after = await tx.invoice.update({
      where: { id },
      data: {
        ...data,
        status: posting ? statusAfterPayment(data.netTotal, before.paidAmount) : "DRAFT",
        postedAt: posting ? (before.postedAt ?? new Date()) : null,
      },
    });
    if (lines.replace) await lines.replace(tx, id);
    else {
      await deleteLines(tx, id);
      await lines.write(tx, id);
    }
    const inv = { ...data, id, number: before.number, type, costs: lines.costs };
    if (wasPosted) await repostInvoice(tx, ctx, inv);
    else if (h.post) await postInvoice(tx, ctx, inv);
    await recordAudit(tx, ctx, {
      action: "UPDATE",
      entity: "Invoice",
      entityId: id,
      before,
      after: { ...after, lines: lines.audit },
    });
  });
}

/** Removes an invoice's own lines (not journal lines) before they are rewritten. */
async function deleteLines(tx: TenantTx, invoiceId: string) {
  await tx.invoiceAirTicket.deleteMany({ where: { invoiceId } });
  await tx.invoiceItem.deleteMany({ where: { invoiceId } });
  await tx.invoiceVisaLine.deleteMany({ where: { invoiceId } });
  await tx.invoiceReissueLine.deleteMany({ where: { invoiceId } });
}
