// Balance transfer between money accounts (PLAN.md 6.9), optional charge
// paid from the source account and booked as Transaction Charges.
import { Prisma } from "@prisma/client";
import { dateToIso, isoToDate } from "@/lib/dates";
import type { ListParams } from "@/lib/listParams";
import { balanceTransferSchema, voidSchema } from "@/lib/schemas/accounts";
import { systemAccounts } from "@/server/accounting/ledgers";
import { NO_OVERDRAFT, lockMoneyAccount } from "@/server/accounting/moneyGuard";
import { postEntry, reverseSource, type LineInput } from "@/server/accounting/post";
import { recordAudit } from "@/server/audit/audit";
import { tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { NotFoundError, ServiceError } from "../errors";
import { documentNumber } from "../numbering/documentNumber";

export const TRANSFER_SOURCE = "BALANCE_TRANSFER";

export async function createBalanceTransfer(
  ctx: ServiceContext,
  input: unknown,
): Promise<{ id: string; number: string }> {
  const data = balanceTransferSchema.parse(input);
  const amount = new Prisma.Decimal(data.amount);
  const charge = new Prisma.Decimal(data.charge);

  return tenantDb(ctx.agencyId).$transaction(async (tx) => {
    // Lock both rows in a fixed order to avoid deadlocks between opposite transfers.
    const [firstId, secondId] = [data.fromAccountId, data.toAccountId].sort();
    const first = await lockMoneyAccount(tx, ctx.agencyId, firstId!);
    const second = await lockMoneyAccount(tx, ctx.agencyId, secondId!);
    const from = first?.id === data.fromAccountId ? first : second;
    const to = first?.id === data.toAccountId ? first : second;
    if (!from || !from.isActive)
      throw new ServiceError("Source account not found", {
        fromAccountId: "Choose an active account",
      });
    if (!to || !to.isActive)
      throw new ServiceError("Destination account not found", {
        toAccountId: "Choose an active account",
      });

    const outgoing = amount.plus(charge);
    if (NO_OVERDRAFT.has(from.kind) && new Prisma.Decimal(from.balance).lessThan(outgoing)) {
      throw new ServiceError(
        `${from.name} has only ${new Prisma.Decimal(from.balance).toFixed(2)} available`,
        { amount: "More than the available balance" },
      );
    }

    const number = await documentNumber(tx, ctx, "BALANCE_TRANSFER", data.date);
    const transfer = await tx.balanceTransfer.create({
      data: {
        agencyId: ctx.agencyId,
        number,
        date: isoToDate(data.date),
        fromAccountId: from.id,
        toAccountId: to.id,
        amount,
        charge,
        note: data.note ?? null,
        createdById: ctx.userId,
      },
    });

    const lines: LineInput[] = [
      { moneyAccountId: to.id, debit: amount, memo: `From ${from.name}` },
      { moneyAccountId: from.id, credit: outgoing, memo: `To ${to.name}` },
    ];
    if (!charge.isZero()) {
      const { TRANSACTION_CHARGE } = await systemAccounts(tx, ["TRANSACTION_CHARGE"] as const);
      lines.push({
        ledgerAccountId: TRANSACTION_CHARGE,
        debit: charge,
        memo: "Transfer charge",
      });
    }
    await postEntry(tx, ctx, {
      date: data.date,
      sourceType: TRANSFER_SOURCE,
      sourceId: transfer.id,
      narration: `Balance transfer ${number}: ${from.name} to ${to.name}${data.note ? ` (${data.note})` : ""}`,
      lines,
    });
    await recordAudit(tx, ctx, {
      action: "CREATE",
      entity: "BalanceTransfer",
      entityId: transfer.id,
      after: transfer,
    });
    return { id: transfer.id, number };
  });
}

/** Voids a transfer: reverses its journal entry and keeps the record with the reason. */
export async function voidBalanceTransfer(
  ctx: ServiceContext,
  id: string,
  input: unknown,
): Promise<void> {
  const { reason } = voidSchema.parse(input);
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const before = await tx.balanceTransfer.findFirst({ where: { id } });
    if (!before) throw new NotFoundError("Transfer");
    if (before.status === "VOID") throw new ServiceError("This transfer is already void");

    // Money that arrived must still be there to take back out of cash / wallets.
    const to = await lockMoneyAccount(tx, ctx.agencyId, before.toAccountId);
    if (to && NO_OVERDRAFT.has(to.kind) && new Prisma.Decimal(to.balance).lessThan(before.amount)) {
      throw new ServiceError(
        `${to.name} no longer holds ${before.amount.toFixed(2)}; voiding would make it negative`,
      );
    }

    await reverseSource(tx, ctx, TRANSFER_SOURCE, id, {
      narration: `Void of ${before.number}: ${reason}`,
    });
    const after = await tx.balanceTransfer.update({
      where: { id },
      data: { status: "VOID", voidReason: reason, voidedAt: new Date(), voidedById: ctx.userId },
    });
    await recordAudit(tx, ctx, {
      action: "VOID",
      entity: "BalanceTransfer",
      entityId: id,
      before,
      after,
    });
  });
}

export interface TransferRow {
  id: string;
  number: string;
  date: string;
  fromName: string;
  toName: string;
  amount: string;
  charge: string;
  note: string | null;
  status: "POSTED" | "VOID";
  voidReason: string | null;
}

export async function listBalanceTransfers(
  ctx: ServiceContext,
  params: ListParams & { from?: string; to?: string },
): Promise<{ rows: TransferRow[]; total: number }> {
  const db = tenantDb(ctx.agencyId);
  const where: Prisma.BalanceTransferWhereInput = {};
  if (params.from || params.to) {
    where.date = {
      ...(params.from ? { gte: isoToDate(params.from) } : {}),
      ...(params.to ? { lte: isoToDate(params.to) } : {}),
    };
  }
  if (params.q) where.number = { contains: params.q, mode: "insensitive" };
  const [rows, total] = await Promise.all([
    db.balanceTransfer.findMany({
      where,
      include: { fromAccount: { select: { name: true } }, toAccount: { select: { name: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    db.balanceTransfer.count({ where }),
  ]);
  return {
    total,
    rows: rows.map((r) => ({
      id: r.id,
      number: r.number,
      date: dateToIso(r.date),
      fromName: r.fromAccount.name,
      toName: r.toAccount.name,
      amount: r.amount.toFixed(2),
      charge: r.charge.toFixed(2),
      note: r.note,
      status: r.status,
      voidReason: r.voidReason,
    })),
  };
}
