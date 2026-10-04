// Cheque Management (PLAN.md 6.10).
//
// Received (with a money receipt): the receipt posted Dr Cheques in Hand.
//   Deposit  → no entry, just the status and date
//   Clear    → Dr bank account / Cr Cheques in Hand
//   Bounce   → the receipt is voided (client owes again, invoices due again)
// Issued (with a vendor payment): the payment posted Cr Cheques Issued.
//   Clear    → Dr Cheques Issued / Cr bank account (the money leaves now)
//   Bounce   → the payment is voided (we owe the vendor again)
import { Prisma, type ChequeDirection, type ChequeStatus } from "@prisma/client";
import { dateToIso, isoToDate } from "@/lib/dates";
import type { ListParams } from "@/lib/listParams";
import { chequeActionSchema } from "@/lib/schemas/money";
import { systemAccounts } from "@/server/accounting/ledgers";
import { assertCanPayOut, requireActiveAccount } from "@/server/accounting/moneyGuard";
import { postEntry } from "@/server/accounting/post";
import { recordAudit } from "@/server/audit/audit";
import { tenantDb, type TenantTx } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { NotFoundError, ServiceError } from "../errors";
import { voidReceiptInTx } from "../payments/receiptService";
import { voidVendorPaymentInTx } from "../payments/vendorPaymentService";
import { chequeHistory, type ChequeHistoryEntry } from "./chequeHistory";
import { notify } from "../notifications/notificationService";

export const CHEQUE_CLEAR_SOURCE = "CHEQUE_CLEAR";

async function lockCheque(tx: TenantTx, agencyId: string, id: string) {
  await tx.$queryRaw`SELECT id FROM "Cheque" WHERE id = ${id} AND "agencyId" = ${agencyId} FOR UPDATE`;
  const c = await tx.cheque.findFirst({
    where: { id },
    include: {
      receipt: { select: { number: true, date: true } },
      vendorPayment: { select: { number: true, date: true } },
    },
  });
  if (!c) throw new NotFoundError("Cheque");
  return c;
}

const OPEN: ChequeStatus[] = ["PENDING", "DEPOSITED"];

export async function depositCheque(ctx: ServiceContext, id: string, input: unknown) {
  const data = chequeActionSchema.parse(input);
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const before = await lockCheque(tx, ctx.agencyId, id);
    if (before.direction !== "RECEIVED")
      throw new ServiceError("Only received cheques are deposited");
    if (before.status !== "PENDING")
      throw new ServiceError(`This cheque is ${before.status.toLowerCase()}`);
    const after = await tx.cheque.update({
      where: { id },
      data: {
        status: "DEPOSITED",
        depositedDate: isoToDate(data.date),
        history: chequeHistory(before.history, "DEPOSITED", ctx.userId, data.note),
      },
    });
    await recordAudit(tx, ctx, { action: "UPDATE", entity: "Cheque", entityId: id, before, after });
  });
}

export async function clearCheque(ctx: ServiceContext, id: string, input: unknown) {
  const data = chequeActionSchema.parse(input);
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const before = await lockCheque(tx, ctx.agencyId, id);
    if (!OPEN.includes(before.status))
      throw new ServiceError(`This cheque is ${before.status.toLowerCase()}`);
    const docDate = dateToIso((before.receipt ?? before.vendorPayment)!.date);
    if (data.date < docDate)
      throw new ServiceError("A cheque cannot clear before it was received / issued", {
        date: "Too early",
      });
    const account = await requireActiveAccount(tx, ctx.agencyId, before.moneyAccountId);
    const acc = await systemAccounts(tx, ["CHEQUES_IN_HAND", "CHEQUES_ISSUED"] as const);
    const memo = `Cheque ${before.chequeNo}`;
    if (before.direction === "ISSUED") assertCanPayOut(account, before.amount);
    await postEntry(tx, ctx, {
      date: data.date,
      sourceType: CHEQUE_CLEAR_SOURCE,
      sourceId: id,
      narration: `Cheque ${before.chequeNo} cleared (${(before.receipt ?? before.vendorPayment)!.number})`,
      lines:
        before.direction === "RECEIVED"
          ? [
              { moneyAccountId: account.id, debit: before.amount, memo },
              { ledgerAccountId: acc.CHEQUES_IN_HAND, credit: before.amount, memo },
            ]
          : [
              { ledgerAccountId: acc.CHEQUES_ISSUED, debit: before.amount, memo },
              { moneyAccountId: account.id, credit: before.amount, memo },
            ],
    });
    const after = await tx.cheque.update({
      where: { id },
      data: {
        status: "CLEARED",
        clearedDate: isoToDate(data.date),
        history: chequeHistory(before.history, "CLEARED", ctx.userId, data.note),
      },
    });
    await recordAudit(tx, ctx, { action: "UPDATE", entity: "Cheque", entityId: id, before, after });
  });
}

/** A bounced cheque voids the receipt / payment it came with. */
export async function bounceCheque(ctx: ServiceContext, id: string, input: unknown) {
  const data = chequeActionSchema.parse(input);
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const before = await lockCheque(tx, ctx.agencyId, id);
    if (!OPEN.includes(before.status))
      throw new ServiceError(`This cheque is ${before.status.toLowerCase()}`);
    const reason = `Cheque ${before.chequeNo} bounced${data.note ? `: ${data.note}` : ""}`;
    if (before.receiptId)
      await voidReceiptInTx(tx, ctx, before.receiptId, reason, { date: data.date });
    else if (before.vendorPaymentId)
      await voidVendorPaymentInTx(tx, ctx, before.vendorPaymentId, reason, { date: data.date });
    else throw new ServiceError("This cheque has no document");
  });
  const c = await tenantDb(ctx.agencyId).cheque.findFirst({
    where: { id },
    select: { chequeNo: true, amount: true },
  });
  if (c)
    await notify(ctx.agencyId, {
      module: "cheques",
      kind: "CHEQUE_BOUNCED",
      title: `Cheque ${c.chequeNo} bounced (${c.amount.toFixed(2)})`,
      body: data.note ?? null,
      link: "/cheques?chequeStatus=BOUNCED",
    });
}

export interface ChequeRow {
  id: string;
  direction: ChequeDirection;
  chequeNo: string;
  bankName: string;
  chequeDate: string;
  amount: string;
  status: ChequeStatus;
  partyType: string;
  partyId: string;
  partyName: string;
  document: { kind: "RECEIPT" | "VENDOR_PAYMENT"; id: string; number: string } | null;
  moneyAccount: string;
  depositedDate: string | null;
  clearedDate: string | null;
  bouncedDate: string | null;
  history: ChequeHistoryEntry[];
}

export interface ChequeListQuery extends ListParams {
  direction?: ChequeDirection;
  chequeStatus?: ChequeStatus;
}

export async function listCheques(ctx: ServiceContext, q: ChequeListQuery) {
  const db = tenantDb(ctx.agencyId);
  const where: Prisma.ChequeWhereInput = {};
  if (q.direction) where.direction = q.direction;
  if (q.chequeStatus) where.status = q.chequeStatus;
  if (q.from || q.to)
    where.chequeDate = {
      ...(q.from ? { gte: isoToDate(q.from) } : {}),
      ...(q.to ? { lte: isoToDate(q.to) } : {}),
    };
  const text = q.q?.trim();
  if (text)
    where.OR = [
      { chequeNo: { contains: text, mode: "insensitive" } },
      { bankName: { contains: text, mode: "insensitive" } },
      { receipt: { number: { contains: text, mode: "insensitive" } } },
      { vendorPayment: { number: { contains: text, mode: "insensitive" } } },
    ];
  const [rows, total, counts] = await Promise.all([
    db.cheque.findMany({
      where,
      include: {
        receipt: { select: { id: true, number: true, client: { select: { name: true } } } },
        vendorPayment: { select: { id: true, number: true, vendor: { select: { name: true } } } },
        moneyAccount: { select: { name: true } },
      },
      orderBy: [{ chequeDate: "asc" }, { createdAt: "asc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    db.cheque.count({ where }),
    db.cheque.groupBy({
      by: ["direction", "status"],
      where: { ...where, status: undefined },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);
  const summary = counts.map((c) => ({
    direction: c.direction,
    status: c.status,
    count: c._count._all,
    amount: (c._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
  }));
  const open = (direction: ChequeDirection, statuses: ChequeStatus[]) =>
    counts
      .filter((c) => c.direction === direction && statuses.includes(c.status))
      .reduce(
        (acc, c) => ({
          count: acc.count + c._count._all,
          amount: acc.amount.plus(c._sum.amount ?? 0),
        }),
        { count: 0, amount: new Prisma.Decimal(0) },
      );
  const received = open("RECEIVED", ["PENDING", "DEPOSITED"]);
  const issued = open("ISSUED", ["PENDING"]);
  return {
    total,
    summary,
    receivedOpen: { count: received.count, amount: received.amount.toFixed(2) },
    issuedOpen: { count: issued.count, amount: issued.amount.toFixed(2) },
    rows: rows.map((c): ChequeRow => ({
      id: c.id,
      direction: c.direction,
      chequeNo: c.chequeNo,
      bankName: c.bankName,
      chequeDate: dateToIso(c.chequeDate),
      amount: c.amount.toFixed(2),
      status: c.status,
      partyType: c.partyType,
      partyId: c.partyId,
      partyName: c.receipt?.client.name ?? c.vendorPayment?.vendor.name ?? "-",
      document: c.receipt
        ? { kind: "RECEIPT", id: c.receipt.id, number: c.receipt.number }
        : c.vendorPayment
          ? { kind: "VENDOR_PAYMENT", id: c.vendorPayment.id, number: c.vendorPayment.number }
          : null,
      moneyAccount: c.moneyAccount.name,
      depositedDate: c.depositedDate ? dateToIso(c.depositedDate) : null,
      clearedDate: c.clearedDate ? dateToIso(c.clearedDate) : null,
      bouncedDate: c.bouncedDate ? dateToIso(c.bouncedDate) : null,
      history: (c.history as unknown as ChequeHistoryEntry[]) ?? [],
    })),
  };
}

export type ChequeList = Awaited<ReturnType<typeof listCheques>>;
