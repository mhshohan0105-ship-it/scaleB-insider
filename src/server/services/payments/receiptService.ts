// Money receipts (PLAN.md 6.6): money in from a client, allocated to the
// client's due invoices (oldest first unless edited); anything left over is
// an advance on the client's account.
//
//   Dr Money account         amount - transaction charge
//   Dr Transaction Charges   transaction charge
//      Cr Accounts Receivable (client)   amount
//
// A cheque goes to Cheques in Hand instead of the money account until it
// clears (see chequeService.ts); a bounced cheque voids the receipt.
import { Prisma } from "@prisma/client";
import { allocationErrors, autoAllocate, type DueInvoice } from "@/lib/calc/allocation";
import { dateToIso, isoToDate } from "@/lib/dates";
import type { ListParams } from "@/lib/listParams";
import { voidSchema } from "@/lib/schemas/accounts";
import { moneyReceiptSchema } from "@/lib/schemas/invoices";
import { systemAccounts } from "@/server/accounting/ledgers";
import { assertCanPayOut, requireActiveAccount } from "@/server/accounting/moneyGuard";
import { postEntry, reverseSource, type LineInput } from "@/server/accounting/post";
import { recordAudit } from "@/server/audit/audit";
import { tenantDb, type TenantTx } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { NotFoundError, ServiceError } from "../errors";
import { statusAfterPayment } from "../invoices/invoiceCommon";
import { chequeHistory } from "../cheques/chequeHistory";
import { documentNumber } from "../numbering/documentNumber";

export const RECEIPT_SOURCE = "MONEY_RECEIPT";

export interface DueInvoiceRow extends DueInvoice {
  type: string;
  netTotal: string;
  paidAmount: string;
  due: string;
}

/** A client's posted invoices that still have something to pay. */
export async function dueInvoices(
  tx: TenantTx | ReturnType<typeof tenantDb>,
  clientId: string,
  lock = false,
) {
  const rows = await tx.invoice.findMany({
    // REFUNDED too: a refund charge may still be owed on a fully refunded invoice.
    where: { clientId, status: { in: ["POSTED", "PARTIAL", "REFUNDED"] } },
    orderBy: [{ date: "asc" }, { number: "asc" }],
    select: {
      id: true,
      number: true,
      type: true,
      date: true,
      netTotal: true,
      paidAmount: true,
      refundCredit: true,
    },
  });
  if (lock && rows.length) {
    await (tx as TenantTx).$queryRaw`
      SELECT id FROM "Invoice" WHERE id IN (${Prisma.join(rows.map((r) => r.id))}) ORDER BY id FOR UPDATE`;
  }
  return rows
    .map((r) => ({
      invoiceId: r.id,
      number: r.number,
      type: r.type,
      date: dateToIso(r.date),
      netTotal: r.netTotal.toFixed(2),
      paidAmount: r.paidAmount.toFixed(2),
      // Refund credit lowers what the client owes on the invoice.
      due: r.netTotal.minus(r.refundCredit).minus(r.paidAmount).toFixed(2),
    }))
    .filter((r) => new Prisma.Decimal(r.due).greaterThan(0));
}

export async function listDueInvoices(
  ctx: ServiceContext,
  clientId: string,
): Promise<DueInvoiceRow[]> {
  const db = tenantDb(ctx.agencyId);
  if (!(await db.client.findFirst({ where: { id: clientId }, select: { id: true } }))) return [];
  return dueInvoices(db, clientId);
}

export async function createMoneyReceipt(
  ctx: ServiceContext,
  input: unknown,
): Promise<{ id: string; number: string }> {
  const data = moneyReceiptSchema.parse(input);
  const amount = new Prisma.Decimal(data.amount);
  const charge = new Prisma.Decimal(data.transactionCharge);

  return tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const client = await tx.client.findFirst({
      where: { id: data.clientId },
      select: { id: true, name: true },
    });
    if (!client) throw new ServiceError("Client not found", { clientId: "Choose a valid client" });
    const account = await requireActiveAccount(tx, ctx.agencyId, data.moneyAccountId);

    // Lock the client's due invoices so two receipts cannot over-pay the same one.
    const dues = await dueInvoices(tx, client.id, true);
    let allocations: { invoiceId: string; amount: Prisma.Decimal }[];
    if (data.allocations) {
      const errors = allocationErrors(amount.toString(), data.allocations, dues);
      if (errors.length) throw new ServiceError(errors[0]!, { allocations: errors.join("; ") });
      allocations = data.allocations.map((a) => ({
        invoiceId: a.invoiceId,
        amount: new Prisma.Decimal(a.amount),
      }));
    } else {
      allocations = autoAllocate(amount.toString(), dues).allocations.map((a) => ({
        invoiceId: a.invoiceId,
        amount: new Prisma.Decimal(a.amount.toFixed(2)),
      }));
    }

    const number = await documentNumber(tx, ctx, "MONEY_RECEIPT", data.date);
    const receipt = await tx.moneyReceipt.create({
      data: {
        agencyId: ctx.agencyId,
        number,
        clientId: client.id,
        date: isoToDate(data.date),
        amount,
        moneyAccountId: account.id,
        paymentMethod: data.paymentMethod,
        transactionCharge: charge,
        reference: data.reference ?? null,
        note: data.note ?? null,
        createdById: ctx.userId,
      },
    });
    for (const a of allocations) {
      await tx.moneyReceiptAllocation.create({
        data: {
          agencyId: ctx.agencyId,
          receiptId: receipt.id,
          invoiceId: a.invoiceId,
          amount: a.amount,
        },
      });
      await applyPayment(tx, a.invoiceId, a.amount);
    }

    const cheque = data.paymentMethod === "CHEQUE" ? data.cheque : null;
    if (cheque) {
      await tx.cheque.create({
        data: {
          agencyId: ctx.agencyId,
          direction: "RECEIVED",
          chequeNo: cheque.chequeNo,
          bankName: cheque.bankName,
          chequeDate: isoToDate(cheque.chequeDate),
          amount,
          partyType: "CLIENT",
          partyId: client.id,
          receiptId: receipt.id,
          moneyAccountId: account.id,
          history: chequeHistory([], "PENDING", ctx.userId, `With receipt ${number}`),
          createdById: ctx.userId,
        },
      });
    }
    const lines: LineInput[] = [
      cheque
        ? {
            ledgerAccountId: (await systemAccounts(tx, ["CHEQUES_IN_HAND"] as const))
              .CHEQUES_IN_HAND,
            debit: amount,
            memo: `Cheque ${cheque.chequeNo}`,
          }
        : { moneyAccountId: account.id, debit: amount.minus(charge), memo: data.reference ?? null },
      {
        ledgerAccountId: (await systemAccounts(tx, ["AR"] as const)).AR,
        credit: amount,
        partyType: "CLIENT",
        partyId: client.id,
      },
    ];
    if (charge.greaterThan(0)) {
      const { TRANSACTION_CHARGE } = await systemAccounts(tx, ["TRANSACTION_CHARGE"] as const);
      lines.push({ ledgerAccountId: TRANSACTION_CHARGE, debit: charge, memo: "Collection charge" });
    }
    await postEntry(tx, ctx, {
      date: data.date,
      sourceType: RECEIPT_SOURCE,
      sourceId: receipt.id,
      narration: `Money receipt ${number} from ${client.name}`,
      lines,
    });
    await recordAudit(tx, ctx, {
      action: "CREATE",
      entity: "MoneyReceipt",
      entityId: receipt.id,
      after: { ...receipt, allocations },
    });
    return { id: receipt.id, number };
  });
}

/** Adds (or with a negative amount removes) a payment on an invoice and refreshes its status. */
export async function applyPayment(tx: TenantTx, invoiceId: string, amount: Prisma.Decimal) {
  const inv = await tx.invoice.update({
    where: { id: invoiceId },
    data: { paidAmount: { increment: amount } },
    select: { netTotal: true, paidAmount: true, refundCredit: true, status: true },
  });
  // A refund may leave an invoice paid beyond what is now owed; removing a
  // payment is always fine, adding one must stay within what is owed.
  const owed = inv.netTotal.minus(inv.refundCredit);
  if (inv.paidAmount.isNegative() || (amount.greaterThan(0) && inv.paidAmount.greaterThan(owed))) {
    throw new ServiceError("Payment would take the invoice outside its total");
  }
  if (inv.status === "POSTED" || inv.status === "PARTIAL" || inv.status === "PAID") {
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: statusAfterPayment(inv.netTotal, inv.paidAmount, inv.refundCredit) },
    });
  }
}

/** Voids a receipt: reverses its entry and takes its allocations off the invoices. */
export async function voidMoneyReceipt(
  ctx: ServiceContext,
  id: string,
  input: unknown,
): Promise<void> {
  const { reason } = voidSchema.parse(input);
  await tenantDb(ctx.agencyId).$transaction((tx) => voidReceiptInTx(tx, ctx, id, reason));
}

/**
 * Voids a receipt inside a transaction. With `bounced`, its cheque is marked
 * bounced (Cheque Management); otherwise a pending cheque is cancelled. A
 * cleared cheque's receipt cannot be voided.
 */
export async function voidReceiptInTx(
  tx: TenantTx,
  ctx: ServiceContext,
  id: string,
  reason: string,
  bounced?: { date: string },
): Promise<void> {
  const before = await tx.moneyReceipt.findFirst({
    where: { id },
    include: { allocations: true, cheque: true },
  });
  if (!before) throw new NotFoundError("Money receipt");
  if (before.status === "VOID") throw new ServiceError("This receipt is already void");

  if (before.cheque) {
    if (before.cheque.status === "CLEARED")
      throw new ServiceError("Its cheque has cleared; the receipt cannot be voided");
    await tx.cheque.update({
      where: { id: before.cheque.id },
      data: {
        status: bounced ? "BOUNCED" : "CANCELLED",
        bouncedDate: bounced ? isoToDate(bounced.date) : null,
        history: chequeHistory(
          before.cheque.history,
          bounced ? "BOUNCED" : "CANCELLED",
          ctx.userId,
          reason,
        ),
      },
    });
  } else {
    // The money must still be there to take back out of cash / wallets.
    const account = await requireActiveAccount(tx, ctx.agencyId, before.moneyAccountId).catch(
      () => null,
    );
    if (account) assertCanPayOut(account, before.amount.minus(before.transactionCharge));
  }

  for (const a of before.allocations) await applyPayment(tx, a.invoiceId, a.amount.negated());
  await reverseSource(tx, ctx, RECEIPT_SOURCE, id, {
    narration: `Void of ${before.number}: ${reason}`,
  });
  const after = await tx.moneyReceipt.update({
    where: { id },
    data: { status: "VOID", voidReason: reason, voidedAt: new Date(), voidedById: ctx.userId },
  });
  await recordAudit(tx, ctx, {
    action: "VOID",
    entity: "MoneyReceipt",
    entityId: id,
    before,
    after,
  });
}

export interface ReceiptRow {
  id: string;
  number: string;
  date: string;
  clientId: string;
  clientName: string;
  account: string;
  paymentMethod: string;
  amount: string;
  allocated: string;
  advance: string;
  status: "POSTED" | "VOID";
}

export async function listMoneyReceipts(
  ctx: ServiceContext,
  params: ListParams & { clientId?: string },
): Promise<{ rows: ReceiptRow[]; total: number; totalAmount: string }> {
  const db = tenantDb(ctx.agencyId);
  const where: Prisma.MoneyReceiptWhereInput = {};
  if (params.clientId) where.clientId = params.clientId;
  if (params.from || params.to) {
    where.date = {
      ...(params.from ? { gte: isoToDate(params.from) } : {}),
      ...(params.to ? { lte: isoToDate(params.to) } : {}),
    };
  }
  if (params.q) {
    where.OR = [
      { number: { contains: params.q, mode: "insensitive" } },
      { reference: { contains: params.q, mode: "insensitive" } },
      { client: { name: { contains: params.q, mode: "insensitive" } } },
      { client: { code: { contains: params.q, mode: "insensitive" } } },
    ];
  }
  const [rows, total, sum] = await Promise.all([
    db.moneyReceipt.findMany({
      where,
      include: {
        client: { select: { name: true } },
        moneyAccount: { select: { name: true } },
        allocations: { select: { amount: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    db.moneyReceipt.count({ where }),
    db.moneyReceipt.aggregate({ where: { ...where, status: "POSTED" }, _sum: { amount: true } }),
  ]);
  return {
    total,
    totalAmount: (sum._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
    rows: rows.map((r) => {
      const allocated = r.allocations.reduce((s, a) => s.plus(a.amount), new Prisma.Decimal(0));
      return {
        id: r.id,
        number: r.number,
        date: dateToIso(r.date),
        clientId: r.clientId,
        clientName: r.client.name,
        account: r.moneyAccount.name,
        paymentMethod: r.paymentMethod,
        amount: r.amount.toFixed(2),
        allocated: allocated.toFixed(2),
        advance: r.amount.minus(allocated).toFixed(2),
        status: r.status,
      };
    }),
  };
}

export async function getMoneyReceipt(ctx: ServiceContext, id: string) {
  const r = await tenantDb(ctx.agencyId).moneyReceipt.findFirst({
    where: { id },
    include: {
      client: {
        select: { id: true, name: true, code: true, phone: true, address: true, balance: true },
      },
      moneyAccount: { select: { name: true, kind: true } },
      allocations: {
        include: {
          invoice: { select: { id: true, number: true, type: true, date: true, netTotal: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!r) return null;
  const allocated = r.allocations.reduce((s, a) => s.plus(a.amount), new Prisma.Decimal(0));
  return {
    id: r.id,
    number: r.number,
    date: dateToIso(r.date),
    status: r.status,
    voidReason: r.voidReason,
    client: { ...r.client, balance: r.client.balance.toFixed(2) },
    account: r.moneyAccount.name,
    paymentMethod: r.paymentMethod,
    amount: r.amount.toFixed(2),
    transactionCharge: r.transactionCharge.toFixed(2),
    reference: r.reference,
    note: r.note,
    allocated: allocated.toFixed(2),
    advance: r.amount.minus(allocated).toFixed(2),
    allocations: r.allocations.map((a) => ({
      invoiceId: a.invoice.id,
      number: a.invoice.number,
      type: a.invoice.type,
      date: dateToIso(a.invoice.date),
      netTotal: a.invoice.netTotal.toFixed(2),
      amount: a.amount.toFixed(2),
    })),
  };
}

export type MoneyReceiptView = NonNullable<Awaited<ReturnType<typeof getMoneyReceipt>>>;
