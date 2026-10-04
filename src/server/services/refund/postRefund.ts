// Refunds (PLAN.md 6.7). A refund takes chosen invoice lines (whole, or part
// of them for the Partial type) back off the client and the vendors:
//  - client: the sale is reversed; the refund charge is kept as income; the
//    rest is paid back now (cash return) or left on the client's account
//  - vendor: the cost is reversed; the vendor's charge stays as an expense
// The invoice keeps its own figures; `refundCredit` / `refundCost` carry the
// refunds and the status becomes REFUNDED once every line is fully refunded.
import { Prisma, type InvoiceType, type RefundLineKind } from "@prisma/client";
import { calcRefund, refundErrors, refundLineErrors } from "@/lib/calc/refund";
import { d } from "@/lib/calc/money";
import { dateToIso, isoToDate } from "@/lib/dates";
import { INVOICE_TYPE_INFO, type InvoiceTypeKey } from "@/lib/invoiceTypes";
import type { ListParams } from "@/lib/listParams";
import { REFUND_TYPE_INFO, type RefundTypeKey } from "@/lib/refundTypes";
import { voidSchema } from "@/lib/schemas/accounts";
import { refundSchema } from "@/lib/schemas/invoices";
import { COGS_ACCOUNT, SALES_ACCOUNT } from "@/server/accounting/invoicePosting";
import { systemAccounts } from "@/server/accounting/ledgers";
import {
  assertCanPayOut,
  lockMoneyAccount,
  requireActiveAccount,
} from "@/server/accounting/moneyGuard";
import { postEntry, reverseSource } from "@/server/accounting/post";
import { REFUND_ACCOUNT_KEYS, refundJournalLines } from "@/server/accounting/refundPosting";
import { recordAudit } from "@/server/audit/audit";
import { tenantDb, type TenantTx } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { NotFoundError, ServiceError } from "../errors";
import { lockInvoice, statusAfterPayment } from "../invoices/invoiceCommon";
import { documentNumber } from "../numbering/documentNumber";

export const REFUND_SOURCE = "REFUND";

type Db = TenantTx | ReturnType<typeof tenantDb>;
const zero = () => new Prisma.Decimal(0);

export interface RefundableLine {
  lineId: string;
  lineKind: RefundLineKind;
  description: string;
  detail: string | null;
  vendorId: string | null;
  vendorName: string | null;
  clientPrice: string;
  purchasePrice: string;
  clientLeft: string;
  vendorLeft: string;
}

interface RawLine {
  id: string;
  description: string;
  detail: string | null;
  vendorId: string | null;
  vendorName: string | null;
  clientPrice: Prisma.Decimal;
  purchasePrice: Prisma.Decimal;
}

/** The invoice's lines of its own kind, as refund candidates. */
async function invoiceLines(
  db: Db,
  invoiceId: string,
  type: InvoiceType,
): Promise<{ kind: RefundLineKind; lines: RawLine[] }> {
  const vendor = { select: { name: true } } as const;
  switch (INVOICE_TYPE_INFO[type as InvoiceTypeKey].lines) {
    case "ticket": {
      const rows = await db.invoiceAirTicket.findMany({
        where: { invoiceId },
        orderBy: { sortOrder: "asc" },
        include: { vendor },
      });
      return {
        kind: "TICKET",
        lines: rows.map((t) => ({
          id: t.id,
          description: `${t.ticketNo} · ${t.passengerName}`,
          detail: t.route,
          vendorId: t.vendorId,
          vendorName: t.vendor.name,
          clientPrice: t.clientPrice,
          purchasePrice: t.purchasePrice,
        })),
      };
    }
    case "reissue": {
      const rows = await db.invoiceReissueLine.findMany({
        where: { invoiceId },
        orderBy: { sortOrder: "asc" },
        include: { vendor, originalTicket: { select: { ticketNo: true } } },
      });
      return {
        kind: "REISSUE",
        lines: rows.map((r) => ({
          id: r.id,
          description: `Reissue ${r.ticketNo ?? r.originalTicket.ticketNo} · ${r.passengerName}`,
          detail: r.route,
          vendorId: r.vendorId,
          vendorName: r.vendor.name,
          clientPrice: r.clientPrice,
          purchasePrice: r.purchasePrice,
        })),
      };
    }
    case "visa": {
      const rows = await db.invoiceVisaLine.findMany({
        where: { invoiceId },
        orderBy: { sortOrder: "asc" },
        include: { vendor },
      });
      return {
        kind: "VISA",
        lines: rows.map((v) => ({
          id: v.id,
          description: `${v.country} visa · ${v.passengerName}`,
          detail: v.passportNo,
          vendorId: v.vendorId,
          vendorName: v.vendor.name,
          clientPrice: v.clientPrice,
          purchasePrice: v.purchasePrice,
        })),
      };
    }
    default: {
      const rows = await db.invoiceItem.findMany({
        where: { invoiceId },
        orderBy: { sortOrder: "asc" },
        include: { vendor },
      });
      return {
        kind: "ITEM",
        lines: rows.map((it) => ({
          id: it.id,
          description: it.passengerName
            ? `${it.passengerName} · ${it.description}`
            : it.description,
          detail: it.passportNo,
          vendorId: it.vendorId,
          vendorName: it.vendor?.name ?? null,
          clientPrice: it.clientPrice,
          purchasePrice: it.purchasePrice,
        })),
      };
    }
  }
}

/** Every line of an invoice with what is still left to refund on it. */
export async function refundableLines(
  db: Db,
  invoiceId: string,
  type: InvoiceType,
): Promise<RefundableLine[]> {
  const { kind, lines } = await invoiceLines(db, invoiceId, type);
  const done = lines.length
    ? await db.refundLine.groupBy({
        by: ["lineId"],
        where: { lineId: { in: lines.map((l) => l.id) }, refund: { status: "POSTED" } },
        _sum: { clientAmount: true, vendorAmount: true },
      })
    : [];
  return lines.map((l) => {
    const r = done.find((x) => x.lineId === l.id);
    return {
      lineId: l.id,
      lineKind: kind,
      description: l.description,
      detail: l.detail,
      vendorId: l.vendorId,
      vendorName: l.vendorName,
      clientPrice: l.clientPrice.toFixed(2),
      purchasePrice: l.purchasePrice.toFixed(2),
      clientLeft: l.clientPrice.minus(r?._sum.clientAmount ?? zero()).toFixed(2),
      vendorLeft: l.purchasePrice.minus(r?._sum.vendorAmount ?? zero()).toFixed(2),
    };
  });
}

const OPEN_STATUSES = ["POSTED", "PARTIAL", "PAID"] as const;

/** An invoice as the refund form needs it, or null when it cannot be refunded here. */
export async function refundTarget(ctx: ServiceContext, type: RefundTypeKey, invoiceId: string) {
  const db = tenantDb(ctx.agencyId);
  const inv = await db.invoice.findFirst({
    where: {
      id: invoiceId,
      type: { in: [...REFUND_TYPE_INFO[type].invoiceTypes] },
      status: { in: [...OPEN_STATUSES] },
    },
    include: { client: { select: { id: true, name: true, code: true, balance: true } } },
  });
  if (!inv) return null;
  const lines = await refundableLines(db, inv.id, inv.type);
  return {
    id: inv.id,
    number: inv.number,
    type: inv.type,
    date: dateToIso(inv.date),
    status: inv.status,
    client: { ...inv.client, balance: inv.client.balance.toFixed(2) },
    netTotal: inv.netTotal.toFixed(2),
    paidAmount: inv.paidAmount.toFixed(2),
    refundCredit: inv.refundCredit.toFixed(2),
    lines,
  };
}

export type RefundTarget = NonNullable<Awaited<ReturnType<typeof refundTarget>>>;

/** Invoices that can be refunded with this refund type, for the picker. */
export async function refundableInvoices(ctx: ServiceContext, type: RefundTypeKey, q?: string) {
  const text = q?.trim();
  const rows = await tenantDb(ctx.agencyId).invoice.findMany({
    where: {
      type: { in: [...REFUND_TYPE_INFO[type].invoiceTypes] },
      status: { in: [...OPEN_STATUSES] },
      ...(text
        ? {
            OR: [
              { number: { contains: text, mode: "insensitive" } },
              { client: { name: { contains: text, mode: "insensitive" } } },
              { airTickets: { some: { ticketNo: { contains: text, mode: "insensitive" } } } },
              { airTickets: { some: { passengerName: { contains: text, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 30,
    select: {
      id: true,
      number: true,
      date: true,
      netTotal: true,
      client: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    date: dateToIso(r.date),
    netTotal: r.netTotal.toFixed(2),
    clientName: r.client.name,
  }));
}

async function lockClient(tx: TenantTx, agencyId: string, id: string) {
  const rows = await tx.$queryRaw<{ id: string; name: string; balance: Prisma.Decimal }[]>`
    SELECT id, name, balance FROM "Client" WHERE id = ${id} AND "agencyId" = ${agencyId} FOR UPDATE`;
  const row = rows[0];
  return row ? { ...row, balance: new Prisma.Decimal(row.balance) } : null;
}

async function refundAccounts(tx: TenantTx, type: InvoiceType) {
  return systemAccounts(tx, [...REFUND_ACCOUNT_KEYS, SALES_ACCOUNT[type], COGS_ACCOUNT[type]]);
}

export async function createRefund(
  ctx: ServiceContext,
  type: RefundTypeKey,
  input: unknown,
): Promise<{ id: string; number: string }> {
  const data = refundSchema.parse(input);
  const info = REFUND_TYPE_INFO[type];

  return tenantDb(ctx.agencyId).$transaction(async (tx) => {
    await lockInvoice(tx, ctx.agencyId, data.invoiceId);
    const inv = await tx.invoice.findFirst({
      where: { id: data.invoiceId, type: { in: [...info.invoiceTypes] } },
    });
    if (!inv) throw new ServiceError("Invoice not found", { invoiceId: "Choose a valid invoice" });
    if (!(OPEN_STATUSES as readonly string[]).includes(inv.status)) {
      throw new ServiceError(`A ${inv.status.toLowerCase()} invoice cannot be refunded`);
    }
    if (data.date < dateToIso(inv.date)) {
      throw new ServiceError("The refund cannot be dated before the invoice", {
        date: "Before the invoice date",
      });
    }
    const client = await lockClient(tx, ctx.agencyId, inv.clientId);
    if (!client) throw new NotFoundError("Client");

    const available = await refundableLines(tx, inv.id, inv.type);
    const fieldErrors: Record<string, string> = {};
    const seen = new Set<string>();
    const chosen = data.lines.map((l, i) => {
      const line = available.find((a) => a.lineId === l.lineId);
      if (!line || seen.has(l.lineId)) {
        fieldErrors[`lines.${i}.lineId`] = "Not a line of this invoice";
        return null;
      }
      seen.add(l.lineId);
      // Whole-line types always refund everything left on the line.
      const amounts = {
        clientAmount: info.partial ? l.clientAmount : line.clientLeft,
        vendorAmount: info.partial ? l.vendorAmount : line.vendorLeft,
        vendorCharge: l.vendorCharge,
      };
      const errors = refundLineErrors(amounts, line);
      if (!line.vendorId && d(amounts.vendorAmount).greaterThan(0))
        errors.push("This line has no vendor");
      if (errors.length) fieldErrors[`lines.${i}.clientAmount`] = errors.join("; ");
      return { line, ...amounts };
    });
    if (Object.keys(fieldErrors).length) {
      throw new ServiceError(Object.values(fieldErrors)[0]!, fieldErrors);
    }
    const lines = chosen.map((c) => c!);
    const totals = calcRefund(lines, data.clientCharge);
    const cash = data.method === "CASH_RETURN";
    // Balance: positive = the client owes us; after this refund it drops by the credit.
    const creditAfter = client.balance.minus(totals.clientCredit.toFixed(2)).negated();
    const errors = refundErrors(
      totals,
      cash ? { returnAmount: data.returnAmount, available: creditAfter.toFixed(2) } : null,
    );
    if (errors.length) {
      throw new ServiceError(errors[0]!, {
        [errors[0]!.startsWith("Client charge") ? "clientCharge" : "returnAmount"]: errors[0]!,
      });
    }
    const returnAmount = cash ? new Prisma.Decimal(data.returnAmount) : zero();
    let moneyAccountId: string | null = null;
    if (cash) {
      const account = await requireActiveAccount(tx, ctx.agencyId, data.moneyAccountId!);
      assertCanPayOut(account, returnAmount, "returnAmount");
      moneyAccountId = account.id;
    }

    const dec = (v: { toFixed(n: number): string }) => new Prisma.Decimal(v.toFixed(2));
    const number = await documentNumber(tx, ctx, "REFUND", data.date);
    const refund = await tx.refund.create({
      data: {
        agencyId: ctx.agencyId,
        number,
        type,
        invoiceId: inv.id,
        clientId: inv.clientId,
        date: isoToDate(data.date),
        clientRefundAmount: dec(totals.clientRefundAmount),
        clientCharge: dec(totals.clientCharge),
        vendorRefundAmount: dec(totals.vendorRefundAmount),
        vendorCharge: dec(totals.vendorCharge),
        method: data.method,
        returnAmount,
        moneyAccountId,
        note: data.note ?? null,
        createdById: ctx.userId,
      },
    });
    await tx.refundLine.createMany({
      data: lines.map((l) => ({
        agencyId: ctx.agencyId,
        refundId: refund.id,
        lineKind: l.line.lineKind,
        lineId: l.line.lineId,
        description: l.line.description,
        vendorId: l.line.vendorId,
        clientAmount: new Prisma.Decimal(l.clientAmount),
        vendorAmount: new Prisma.Decimal(l.vendorAmount),
        vendorCharge: new Prisma.Decimal(l.vendorCharge),
      })),
    });

    await postEntry(tx, ctx, {
      date: data.date,
      sourceType: REFUND_SOURCE,
      sourceId: refund.id,
      narration: `Refund ${number} on invoice ${inv.number}`,
      lines: refundJournalLines(
        {
          invoiceType: inv.type,
          clientId: inv.clientId,
          clientRefundAmount: totals.clientRefundAmount,
          clientCharge: totals.clientCharge,
          lines: lines.map((l) => ({
            vendorId: l.line.vendorId,
            vendorAmount: l.vendorAmount,
            vendorCharge: l.vendorCharge,
          })),
          returnAmount,
          moneyAccountId,
          memo: number,
        },
        await refundAccounts(tx, inv.type),
      ),
    });

    // Fully refunded once nothing is left on any line.
    const left = available.map((a) => {
      const c = lines.find((l) => l.line.lineId === a.lineId);
      return {
        client: d(a.clientLeft).minus(d(c?.clientAmount)),
        vendor: d(a.vendorLeft).minus(d(c?.vendorAmount)),
      };
    });
    const fully = left.every((x) => x.client.isZero() && x.vendor.isZero());
    const refundCredit = inv.refundCredit.plus(dec(totals.clientCredit));
    const after = await tx.invoice.update({
      where: { id: inv.id },
      data: {
        refundCredit,
        refundCost: inv.refundCost.plus(dec(totals.vendorCredit)),
        status: fully ? "REFUNDED" : statusAfterPayment(inv.netTotal, inv.paidAmount, refundCredit),
      },
    });
    await recordAudit(tx, ctx, {
      action: "CREATE",
      entity: "Refund",
      entityId: refund.id,
      after: { ...refund, lines, invoiceStatus: after.status },
    });
    return { id: refund.id, number };
  });
}

/** Voids a refund: reverses its entry and puts the invoice back as it was. */
export async function voidRefund(ctx: ServiceContext, id: string, input: unknown): Promise<void> {
  const { reason } = voidSchema.parse(input);
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const found = await tx.refund.findFirst({ where: { id }, select: { invoiceId: true } });
    if (!found) throw new NotFoundError("Refund");
    await lockInvoice(tx, ctx.agencyId, found.invoiceId);
    const before = await tx.refund.findFirst({ where: { id } });
    if (!before) throw new NotFoundError("Refund");
    if (before.status === "VOID") throw new ServiceError("This refund is already void");
    // Money paid back returns to the account; nothing to check for an overdraft.
    if (before.moneyAccountId) await lockMoneyAccount(tx, ctx.agencyId, before.moneyAccountId);

    await reverseSource(tx, ctx, REFUND_SOURCE, id, {
      narration: `Void of refund ${before.number}: ${reason}`,
    });
    const after = await tx.refund.update({
      where: { id },
      data: { status: "VOID", voidReason: reason, voidedAt: new Date(), voidedById: ctx.userId },
    });
    const inv = await tx.invoice.findFirstOrThrow({ where: { id: before.invoiceId } });
    const refundCredit = inv.refundCredit.minus(
      before.clientRefundAmount.minus(before.clientCharge),
    );
    await tx.invoice.update({
      where: { id: inv.id },
      data: {
        refundCredit,
        refundCost: inv.refundCost.minus(before.vendorRefundAmount.minus(before.vendorCharge)),
        status:
          inv.status === "VOID"
            ? inv.status
            : statusAfterPayment(inv.netTotal, inv.paidAmount, refundCredit),
      },
    });
    await recordAudit(tx, ctx, { action: "VOID", entity: "Refund", entityId: id, before, after });
  });
}

export interface RefundListRow {
  id: string;
  number: string;
  type: RefundTypeKey;
  date: string;
  clientId: string;
  clientName: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceType: string;
  clientRefundAmount: string;
  clientCharge: string;
  clientCredit: string;
  vendorCredit: string;
  method: string;
  returnAmount: string;
  status: string;
}

export async function listRefunds(
  ctx: ServiceContext,
  type: RefundTypeKey | null,
  params: ListParams & { from?: string; to?: string },
) {
  const db = tenantDb(ctx.agencyId);
  const where: Prisma.RefundWhereInput = {};
  if (type) where.type = type;
  if (params.from || params.to) {
    where.date = {
      ...(params.from ? { gte: isoToDate(params.from) } : {}),
      ...(params.to ? { lte: isoToDate(params.to) } : {}),
    };
  }
  const q = params.q?.trim();
  if (q) {
    where.OR = [
      { number: { contains: q, mode: "insensitive" } },
      { client: { name: { contains: q, mode: "insensitive" } } },
      { invoice: { number: { contains: q, mode: "insensitive" } } },
      { lines: { some: { description: { contains: q, mode: "insensitive" } } } },
    ];
  }
  const [rows, total, sums] = await Promise.all([
    db.refund.findMany({
      where,
      include: {
        client: { select: { name: true } },
        invoice: { select: { number: true, type: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    db.refund.count({ where }),
    db.refund.aggregate({
      where: { ...where, status: "POSTED" },
      _sum: {
        clientRefundAmount: true,
        clientCharge: true,
        vendorRefundAmount: true,
        vendorCharge: true,
        returnAmount: true,
      },
    }),
  ]);
  const s = sums._sum;
  const z = zero();
  return {
    total,
    totals: {
      refunded: (s.clientRefundAmount ?? z).toFixed(2),
      clientCharge: (s.clientCharge ?? z).toFixed(2),
      clientCredit: (s.clientRefundAmount ?? z).minus(s.clientCharge ?? z).toFixed(2),
      vendorCredit: (s.vendorRefundAmount ?? z).minus(s.vendorCharge ?? z).toFixed(2),
      paidBack: (s.returnAmount ?? z).toFixed(2),
    },
    rows: rows.map((r): RefundListRow => ({
      id: r.id,
      number: r.number,
      type: r.type,
      date: dateToIso(r.date),
      clientId: r.clientId,
      clientName: r.client.name,
      invoiceId: r.invoiceId,
      invoiceNumber: r.invoice.number,
      invoiceType: r.invoice.type,
      clientRefundAmount: r.clientRefundAmount.toFixed(2),
      clientCharge: r.clientCharge.toFixed(2),
      clientCredit: r.clientRefundAmount.minus(r.clientCharge).toFixed(2),
      vendorCredit: r.vendorRefundAmount.minus(r.vendorCharge).toFixed(2),
      method: r.method,
      returnAmount: r.returnAmount.toFixed(2),
      status: r.status,
    })),
  };
}

export type RefundList = Awaited<ReturnType<typeof listRefunds>>;

export async function getRefund(ctx: ServiceContext, id: string, type?: RefundTypeKey) {
  const r = await tenantDb(ctx.agencyId).refund.findFirst({
    where: { id, ...(type ? { type } : {}) },
    include: {
      client: { select: { id: true, name: true, code: true } },
      invoice: { select: { id: true, number: true, type: true, date: true } },
      moneyAccount: { select: { name: true } },
      lines: { include: { vendor: { select: { id: true, name: true } } } },
    },
  });
  if (!r) return null;
  const money = (v: Prisma.Decimal) => v.toFixed(2);
  return {
    id: r.id,
    number: r.number,
    type: r.type,
    date: dateToIso(r.date),
    status: r.status,
    client: r.client,
    invoice: { ...r.invoice, date: dateToIso(r.invoice.date) },
    clientRefundAmount: money(r.clientRefundAmount),
    clientCharge: money(r.clientCharge),
    clientCredit: money(r.clientRefundAmount.minus(r.clientCharge)),
    vendorRefundAmount: money(r.vendorRefundAmount),
    vendorCharge: money(r.vendorCharge),
    vendorCredit: money(r.vendorRefundAmount.minus(r.vendorCharge)),
    profitEffect: money(
      r.vendorRefundAmount.minus(r.vendorCharge).minus(r.clientRefundAmount.minus(r.clientCharge)),
    ),
    method: r.method,
    returnAmount: money(r.returnAmount),
    moneyAccount: r.moneyAccount?.name ?? null,
    note: r.note,
    voidReason: r.voidReason,
    lines: r.lines.map((l) => ({
      id: l.id,
      lineKind: l.lineKind,
      description: l.description,
      vendor: l.vendor,
      clientAmount: money(l.clientAmount),
      vendorAmount: money(l.vendorAmount),
      vendorCharge: money(l.vendorCharge),
    })),
  };
}

export type RefundView = NonNullable<Awaited<ReturnType<typeof getRefund>>>;

/** Live refunds of one invoice, for the invoice page. */
export async function invoiceRefunds(ctx: ServiceContext, invoiceId: string) {
  const rows = await tenantDb(ctx.agencyId).refund.findMany({
    where: { invoiceId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      number: true,
      type: true,
      date: true,
      status: true,
      clientRefundAmount: true,
      clientCharge: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    type: r.type,
    date: dateToIso(r.date),
    status: r.status,
    clientCredit: r.clientRefundAmount.minus(r.clientCharge).toFixed(2),
  }));
}

export type InvoiceRefundRow = Awaited<ReturnType<typeof invoiceRefunds>>[number];
