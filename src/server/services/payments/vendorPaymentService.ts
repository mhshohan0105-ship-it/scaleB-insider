// Vendor payments (PLAN.md 6.8): money out to a vendor, on account.
//
//   Dr Accounts Payable (vendor)   amount
//   Dr Transaction Charges         charge
//      Cr Money account                   amount + charge
//
// Paid by cheque: Cr Cheques Issued until it clears (chequeService.ts); a
// bounced cheque voids the payment.
import { Prisma } from "@prisma/client";
import { dateToIso, isoToDate } from "@/lib/dates";
import type { ListParams } from "@/lib/listParams";
import { voidSchema } from "@/lib/schemas/accounts";
import { vendorPaymentSchema } from "@/lib/schemas/invoices";
import { systemAccounts } from "@/server/accounting/ledgers";
import { assertCanPayOut, requireActiveAccount } from "@/server/accounting/moneyGuard";
import { postEntry, reverseSource, type LineInput } from "@/server/accounting/post";
import { recordAudit } from "@/server/audit/audit";
import { tenantDb, type TenantTx } from "@/server/db/tenant";
import { chequeHistory } from "../cheques/chequeHistory";
import type { ServiceContext } from "../context";
import { NotFoundError, ServiceError } from "../errors";
import { documentNumber } from "../numbering/documentNumber";

export const VENDOR_PAYMENT_SOURCE = "VENDOR_PAYMENT";

export async function createVendorPayment(
  ctx: ServiceContext,
  input: unknown,
): Promise<{ id: string; number: string }> {
  const data = vendorPaymentSchema.parse(input);
  const amount = new Prisma.Decimal(data.amount);
  const charge = new Prisma.Decimal(data.transactionCharge);

  return tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const vendor = await tx.vendor.findFirst({
      where: { id: data.vendorId },
      select: { id: true, name: true },
    });
    if (!vendor) throw new ServiceError("Vendor not found", { vendorId: "Choose a valid vendor" });
    const account = await requireActiveAccount(tx, ctx.agencyId, data.moneyAccountId);
    const cheque = data.paymentMethod === "CHEQUE" ? data.cheque : null;
    // A cheque takes the money when it clears, not now.
    if (!cheque) assertCanPayOut(account, amount.plus(charge));

    const number = await documentNumber(tx, ctx, "VENDOR_PAYMENT", data.date);
    const payment = await tx.vendorPayment.create({
      data: {
        agencyId: ctx.agencyId,
        number,
        vendorId: vendor.id,
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
    const acc = await systemAccounts(tx, ["AP", "TRANSACTION_CHARGE", "CHEQUES_ISSUED"] as const);
    if (cheque) {
      await tx.cheque.create({
        data: {
          agencyId: ctx.agencyId,
          direction: "ISSUED",
          chequeNo: cheque.chequeNo,
          bankName: cheque.bankName,
          chequeDate: isoToDate(cheque.chequeDate),
          amount,
          partyType: "VENDOR",
          partyId: vendor.id,
          vendorPaymentId: payment.id,
          moneyAccountId: account.id,
          history: chequeHistory([], "PENDING", ctx.userId, `With payment ${number}`),
          createdById: ctx.userId,
        },
      });
    }
    const lines: LineInput[] = [
      { ledgerAccountId: acc.AP, debit: amount, partyType: "VENDOR", partyId: vendor.id },
      cheque
        ? { ledgerAccountId: acc.CHEQUES_ISSUED, credit: amount, memo: `Cheque ${cheque.chequeNo}` }
        : { moneyAccountId: account.id, credit: amount.plus(charge), memo: data.reference ?? null },
    ];
    if (charge.greaterThan(0))
      lines.push({
        ledgerAccountId: acc.TRANSACTION_CHARGE,
        debit: charge,
        memo: "Payment charge",
      });
    await postEntry(tx, ctx, {
      date: data.date,
      sourceType: VENDOR_PAYMENT_SOURCE,
      sourceId: payment.id,
      narration: `Vendor payment ${number} to ${vendor.name}`,
      lines,
    });
    await recordAudit(tx, ctx, {
      action: "CREATE",
      entity: "VendorPayment",
      entityId: payment.id,
      after: payment,
    });
    return { id: payment.id, number };
  });
}

export async function voidVendorPayment(
  ctx: ServiceContext,
  id: string,
  input: unknown,
): Promise<void> {
  const { reason } = voidSchema.parse(input);
  await tenantDb(ctx.agencyId).$transaction((tx) => voidVendorPaymentInTx(tx, ctx, id, reason));
}

/** Voids a vendor payment inside a transaction (see voidReceiptInTx for cheques). */
export async function voidVendorPaymentInTx(
  tx: TenantTx,
  ctx: ServiceContext,
  id: string,
  reason: string,
  bounced?: { date: string },
): Promise<void> {
  const before = await tx.vendorPayment.findFirst({ where: { id }, include: { cheque: true } });
  if (!before) throw new NotFoundError("Vendor payment");
  if (before.status === "VOID") throw new ServiceError("This payment is already void");
  if (before.cheque) {
    if (before.cheque.status === "CLEARED")
      throw new ServiceError("Its cheque has cleared; the payment cannot be voided");
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
  }
  await reverseSource(tx, ctx, VENDOR_PAYMENT_SOURCE, id, {
    narration: `Void of ${before.number}: ${reason}`,
  });
  const after = await tx.vendorPayment.update({
    where: { id },
    data: { status: "VOID", voidReason: reason, voidedAt: new Date(), voidedById: ctx.userId },
  });
  await recordAudit(tx, ctx, {
    action: "VOID",
    entity: "VendorPayment",
    entityId: id,
    before,
    after,
  });
}

export interface VendorPaymentRow {
  id: string;
  number: string;
  date: string;
  vendorId: string;
  vendorName: string;
  account: string;
  paymentMethod: string;
  amount: string;
  transactionCharge: string;
  reference: string | null;
  note: string | null;
  status: "POSTED" | "VOID";
  voidReason: string | null;
}

export async function listVendorPayments(
  ctx: ServiceContext,
  params: ListParams & { vendorId?: string },
): Promise<{ rows: VendorPaymentRow[]; total: number; totalAmount: string }> {
  const db = tenantDb(ctx.agencyId);
  const where: Prisma.VendorPaymentWhereInput = {};
  if (params.vendorId) where.vendorId = params.vendorId;
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
      { vendor: { name: { contains: params.q, mode: "insensitive" } } },
    ];
  }
  const [rows, total, sum] = await Promise.all([
    db.vendorPayment.findMany({
      where,
      include: { vendor: { select: { name: true } }, moneyAccount: { select: { name: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    db.vendorPayment.count({ where }),
    db.vendorPayment.aggregate({ where: { ...where, status: "POSTED" }, _sum: { amount: true } }),
  ]);
  return {
    total,
    totalAmount: (sum._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
    rows: rows.map((r) => ({
      id: r.id,
      number: r.number,
      date: dateToIso(r.date),
      vendorId: r.vendorId,
      vendorName: r.vendor.name,
      account: r.moneyAccount.name,
      paymentMethod: r.paymentMethod,
      amount: r.amount.toFixed(2),
      transactionCharge: r.transactionCharge.toFixed(2),
      reference: r.reference,
      note: r.note,
      status: r.status,
      voidReason: r.voidReason,
    })),
  };
}
