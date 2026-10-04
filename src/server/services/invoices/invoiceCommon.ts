// Behaviour shared by every invoice type: posting to the ledger, payment
// state, void, and loading headers.
import { Prisma, type InvoiceType } from "@prisma/client";
import { paymentState } from "@/lib/calc/invoiceTotals";
import { dateToIso, isoToDate } from "@/lib/dates";
import { voidSchema } from "@/lib/schemas/accounts";
import {
  COGS_ACCOUNT,
  INVOICE_ACCOUNT_KEYS,
  SALES_ACCOUNT,
  invoiceJournalLines,
  type InvoicePostingInput,
} from "@/server/accounting/invoicePosting";
import { systemAccounts } from "@/server/accounting/ledgers";
import { postEntry, repostSource, reverseSource } from "@/server/accounting/post";
import { recordAudit } from "@/server/audit/audit";
import { sqlDate } from "@/server/db/sqlDate";
import { tenantDb, type TenantTx } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { NotFoundError, ServiceError } from "../errors";

/** Journal sourceType per invoice type, e.g. "INVOICE_AIR". */
export function invoiceSource(type: InvoiceType): string {
  return `INVOICE_${type}`;
}

async function invoiceAccounts(tx: TenantTx, type: InvoiceType) {
  return systemAccounts(tx, [...INVOICE_ACCOUNT_KEYS, SALES_ACCOUNT[type], COGS_ACCOUNT[type]]);
}

export interface PostableInvoice extends Omit<InvoicePostingInput, "memo"> {
  id: string;
  number: string;
  date: Date;
}

function entryFor(inv: PostableInvoice, accounts: Awaited<ReturnType<typeof invoiceAccounts>>) {
  return {
    date: dateToIso(inv.date),
    narration: `Invoice ${inv.number}`,
    lines: invoiceJournalLines({ ...inv, memo: inv.number }, accounts),
  };
}

/** First posting of an invoice. */
export async function postInvoice(tx: TenantTx, ctx: ServiceContext, inv: PostableInvoice) {
  const accounts = await invoiceAccounts(tx, inv.type);
  await postEntry(tx, ctx, {
    ...entryFor(inv, accounts),
    sourceType: invoiceSource(inv.type),
    sourceId: inv.id,
  });
}

/** Edit of a posted invoice: reverse the old entry and post the new figures. */
export async function repostInvoice(tx: TenantTx, ctx: ServiceContext, inv: PostableInvoice) {
  const accounts = await invoiceAccounts(tx, inv.type);
  await repostSource(tx, ctx, invoiceSource(inv.type), inv.id, entryFor(inv, accounts));
}

/**
 * Status after posting / payment / refund changes (DRAFT, VOID and REFUNDED
 * are left alone). The client owes the net total less any refund credit.
 */
export function statusAfterPayment(
  netTotal: Prisma.Decimal,
  paid: Prisma.Decimal,
  refundCredit: Prisma.Decimal = new Prisma.Decimal(0),
) {
  return paymentState(netTotal.minus(refundCredit).toString(), paid.toString());
}

/** What the client still owes on an invoice (never below zero). */
export function invoiceDue(inv: {
  netTotal: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  refundCredit: Prisma.Decimal;
}): Prisma.Decimal {
  const due = inv.netTotal.minus(inv.refundCredit).minus(inv.paidAmount);
  return due.isNegative() ? new Prisma.Decimal(0) : due;
}

/** Locks an invoice row for the rest of the transaction. */
export async function lockInvoice(tx: TenantTx, agencyId: string, id: string) {
  await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${id} AND "agencyId" = ${agencyId} FOR UPDATE`;
}

/**
 * Voids an invoice: reverses its journal entry and keeps it with the reason.
 * Payments must be voided first so the client's receipts stay consistent.
 */
export async function voidInvoice(
  ctx: ServiceContext,
  id: string,
  input: unknown,
  /** When given, the invoice must be of this type (permission is per type). */
  type?: InvoiceType,
): Promise<void> {
  const { reason } = voidSchema.parse(input);
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    await lockInvoice(tx, ctx.agencyId, id);
    const before = await tx.invoice.findFirst({ where: { id, ...(type ? { type } : {}) } });
    if (!before) throw new NotFoundError("Invoice");
    if (before.status === "VOID") throw new ServiceError("This invoice is already void");
    if (before.status === "REFUNDED") throw new ServiceError("A refunded invoice cannot be voided");
    if (await tx.refund.count({ where: { invoiceId: id, status: "POSTED" } })) {
      throw new ServiceError("This invoice has refunds. Void the refunds first.");
    }
    if (before.paidAmount.greaterThan(0)) {
      throw new ServiceError(
        `This invoice has ${before.paidAmount.toFixed(2)} received against it. Void those money receipts first.`,
      );
    }
    if (before.status !== "DRAFT") {
      await reverseSource(tx, ctx, invoiceSource(before.type), id, {
        narration: `Void of invoice ${before.number}: ${reason}`,
      });
    }
    const after = await tx.invoice.update({
      where: { id },
      data: { status: "VOID", voidReason: reason, voidedAt: new Date(), voidedById: ctx.userId },
    });
    await recordAudit(tx, ctx, { action: "VOID", entity: "Invoice", entityId: id, before, after });
  });
}

export interface InvoiceListRow {
  id: string;
  type: string;
  number: string;
  date: string;
  clientId: string;
  clientName: string;
  clientCode: string;
  netTotal: string;
  paidAmount: string;
  refundCredit: string;
  due: string;
  profit: string;
  status: string;
  lineCount: number;
}

export interface InvoiceListQuery {
  page: number;
  pageSize: number;
  q?: string;
  from?: string;
  to?: string;
  status?: string;
  clientId?: string;
  agentId?: string;
}

const LIST_STATUSES = ["DRAFT", "POSTED", "PARTIAL", "PAID", "VOID", "REFUNDED"] as const;

export async function listInvoices(
  ctx: ServiceContext,
  /** null = every invoice type (e.g. a client's profile). */
  type: InvoiceType | null,
  query: InvoiceListQuery,
): Promise<{
  rows: InvoiceListRow[];
  total: number;
  totals: { net: string; paid: string; refunded: string; due: string };
}> {
  const db = tenantDb(ctx.agencyId);
  const where: Prisma.InvoiceWhereInput = type ? { type } : {};
  if (query.clientId) where.clientId = query.clientId;
  if (query.agentId) where.agentId = query.agentId;
  if (query.status && (LIST_STATUSES as readonly string[]).includes(query.status)) {
    where.status = query.status as (typeof LIST_STATUSES)[number];
  } else if (query.status === "DUE") {
    where.status = { in: ["POSTED", "PARTIAL"] };
  }
  if (query.from || query.to) {
    where.date = {
      ...(query.from ? { gte: isoToDate(query.from) } : {}),
      ...(query.to ? { lte: isoToDate(query.to) } : {}),
    };
  }
  const q = query.q?.trim();
  if (q) {
    where.OR = [
      { number: { contains: q, mode: "insensitive" } },
      { client: { name: { contains: q, mode: "insensitive" } } },
      { client: { code: { contains: q, mode: "insensitive" } } },
      { airTickets: { some: { ticketNo: { contains: q, mode: "insensitive" } } } },
      { airTickets: { some: { pnr: { contains: q, mode: "insensitive" } } } },
      { airTickets: { some: { passengerName: { contains: q, mode: "insensitive" } } } },
      { reissueLines: { some: { ticketNo: { contains: q, mode: "insensitive" } } } },
      { reissueLines: { some: { passengerName: { contains: q, mode: "insensitive" } } } },
      { items: { some: { passengerName: { contains: q, mode: "insensitive" } } } },
      { visaLines: { some: { passengerName: { contains: q, mode: "insensitive" } } } },
    ];
  }
  const liveWhere: Prisma.InvoiceWhereInput = {
    ...where,
    status: where.status ?? { notIn: ["VOID", "DRAFT"] },
  };
  const [rows, total, sums] = await Promise.all([
    db.invoice.findMany({
      where,
      include: {
        client: { select: { name: true, code: true } },
        _count: {
          select: { airTickets: true, items: true, visaLines: true, reissueLines: true },
        },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    db.invoice.count({ where }),
    db.invoice.aggregate({
      where: liveWhere,
      _sum: { netTotal: true, paidAmount: true, refundCredit: true },
    }),
  ]);
  const zero = new Prisma.Decimal(0);
  const net = sums._sum.netTotal ?? zero;
  const paid = sums._sum.paidAmount ?? zero;
  const refunded = sums._sum.refundCredit ?? zero;
  return {
    total,
    totals: {
      net: net.toFixed(2),
      paid: paid.toFixed(2),
      refunded: refunded.toFixed(2),
      due: net.minus(refunded).minus(paid).toFixed(2),
    },
    rows: rows.map((r) => ({
      id: r.id,
      type: r.type,
      number: r.number,
      date: dateToIso(r.date),
      clientId: r.clientId,
      clientName: r.client.name,
      clientCode: r.client.code,
      netTotal: r.netTotal.toFixed(2),
      paidAmount: r.paidAmount.toFixed(2),
      refundCredit: r.refundCredit.toFixed(2),
      due: r.status === "VOID" || r.status === "DRAFT" ? "0.00" : invoiceDue(r).toFixed(2),
      profit: r.profit.toFixed(2),
      status: r.status,
      lineCount: r._count.airTickets + r._count.items + r._count.visaLines + r._count.reissueLines,
    })),
  };
}

export interface VendorPurchaseRow {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceType: string;
  date: string;
  description: string;
  detail: string | null;
  cost: string;
}

/**
 * Everything bought from a vendor on posted invoices (tickets, service lines,
 * visas, reissues), newest first. Raw SQL (UNION ALL) binds agencyId explicitly.
 */
export async function listVendorPurchases(
  ctx: ServiceContext,
  vendorId: string,
  params: { page: number; pageSize: number; from?: string; to?: string },
): Promise<{ rows: VendorPurchaseRow[]; total: number; totalCost: string }> {
  const db = tenantDb(ctx.agencyId);
  const filters = [Prisma.sql`i.status::text NOT IN ('DRAFT', 'VOID')`];
  if (params.from) filters.push(Prisma.sql`i.date >= ${sqlDate(params.from)}`);
  if (params.to) filters.push(Prisma.sql`i.date <= ${sqlDate(params.to)}`);
  const where = Prisma.join(filters, " AND ");
  const base = Prisma.sql`
    WITH p AS (
      SELECT t.id, i.id AS "invoiceId", i.number, i.type::text AS type, i.date, i."createdAt",
             t."ticketNo" || ' · ' || t."passengerName" AS description, t.route AS detail, t."purchasePrice" AS cost
      FROM "InvoiceAirTicket" t JOIN "Invoice" i ON i.id = t."invoiceId"
      WHERE t."agencyId" = ${ctx.agencyId} AND t."vendorId" = ${vendorId} AND ${where}
      UNION ALL
      SELECT it.id, i.id, i.number, i.type::text, i.date, i."createdAt",
             it.description, it."passengerName", it."purchasePrice"
      FROM "InvoiceItem" it JOIN "Invoice" i ON i.id = it."invoiceId"
      WHERE it."agencyId" = ${ctx.agencyId} AND it."vendorId" = ${vendorId} AND it."purchasePrice" > 0 AND ${where}
      UNION ALL
      SELECT v.id, i.id, i.number, i.type::text, i.date, i."createdAt",
             v.country || ' visa · ' || v."passengerName", v."passportNo", v."purchasePrice"
      FROM "InvoiceVisaLine" v JOIN "Invoice" i ON i.id = v."invoiceId"
      WHERE v."agencyId" = ${ctx.agencyId} AND v."vendorId" = ${vendorId} AND v."purchasePrice" > 0 AND ${where}
      UNION ALL
      SELECT r.id, i.id, i.number, i.type::text, i.date, i."createdAt",
             'Reissue · ' || r."passengerName", r.route, r."purchasePrice"
      FROM "InvoiceReissueLine" r JOIN "Invoice" i ON i.id = r."invoiceId"
      WHERE r."agencyId" = ${ctx.agencyId} AND r."vendorId" = ${vendorId} AND r."purchasePrice" > 0 AND ${where}
    )`;
  type Raw = {
    id: string;
    invoiceId: string;
    number: string;
    type: string;
    date: Date;
    description: string;
    detail: string | null;
    cost: Prisma.Decimal;
  };
  const [rows, [agg]] = await Promise.all([
    db.$queryRaw<Raw[]>`${base}
      SELECT * FROM p ORDER BY date DESC, "createdAt" DESC, id
      LIMIT ${params.pageSize} OFFSET ${(params.page - 1) * params.pageSize}`,
    db.$queryRaw<{ n: bigint; cost: Prisma.Decimal | null }[]>`${base}
      SELECT COUNT(*) AS n, SUM(cost) AS cost FROM p`,
  ]);
  return {
    total: Number(agg?.n ?? 0),
    totalCost: new Prisma.Decimal(agg?.cost ?? 0).toFixed(2),
    rows: rows.map((r) => ({
      id: r.id,
      invoiceId: r.invoiceId,
      invoiceNumber: r.number,
      invoiceType: r.type,
      date: dateToIso(r.date),
      description: r.description,
      detail: r.detail,
      cost: new Prisma.Decimal(r.cost).toFixed(2),
    })),
  };
}

/** The type of an invoice in this agency, or null when it does not exist. */
export async function invoiceTypeOf(ctx: ServiceContext, id: string): Promise<InvoiceType | null> {
  const row = await tenantDb(ctx.agencyId).invoice.findFirst({
    where: { id },
    select: { type: true },
  });
  return row?.type ?? null;
}
