// Advance returns (PLAN.md 6.6 / 6.8):
//  - client: pay back money a client has in advance with us
//      Dr Accounts Receivable (client)  /  Cr Money account
//  - vendor: a vendor pays back an advance we had paid them
//      Dr Money account  /  Cr Accounts Payable (vendor)
import { Prisma } from "@prisma/client";
import { dateToIso, isoToDate } from "@/lib/dates";
import type { ListParams } from "@/lib/listParams";
import { voidSchema } from "@/lib/schemas/accounts";
import { advanceReturnSchema } from "@/lib/schemas/invoices";
import { systemAccounts } from "@/server/accounting/ledgers";
import {
  assertCanPayOut,
  lockMoneyAccount,
  requireActiveAccount,
} from "@/server/accounting/moneyGuard";
import { postEntry, reverseSource } from "@/server/accounting/post";
import { recordAudit } from "@/server/audit/audit";
import { tenantDb, type TenantTx } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { NotFoundError, ServiceError } from "../errors";
import { documentNumber } from "../numbering/documentNumber";

export const ADVANCE_RETURN_SOURCE = "ADVANCE_RETURN";
export type AdvanceParty = "CLIENT" | "VENDOR";

/** Locks the party row and returns its name and cached balance. */
async function lockParty(tx: TenantTx, agencyId: string, party: AdvanceParty, id: string) {
  const table = party === "CLIENT" ? Prisma.raw('"Client"') : Prisma.raw('"Vendor"');
  const rows = await tx.$queryRaw<{ id: string; name: string; balance: Prisma.Decimal }[]>`
    SELECT id, name, balance FROM ${table} WHERE id = ${id} AND "agencyId" = ${agencyId} FOR UPDATE`;
  const row = rows[0];
  return row ? { ...row, balance: new Prisma.Decimal(row.balance) } : null;
}

export async function createAdvanceReturn(
  ctx: ServiceContext,
  party: AdvanceParty,
  input: unknown,
): Promise<{ id: string; number: string }> {
  const data = advanceReturnSchema.parse(input);
  const amount = new Prisma.Decimal(data.amount);

  return tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const p = await lockParty(tx, ctx.agencyId, party, data.partyId);
    if (!p)
      throw new ServiceError("Not found", { partyId: `Choose a valid ${party.toLowerCase()}` });
    const account = await requireActiveAccount(tx, ctx.agencyId, data.moneyAccountId);

    // Client advance = negative balance; vendor advance = positive balance.
    const available = party === "CLIENT" ? p.balance.negated() : p.balance;
    if (available.lessThan(amount)) {
      throw new ServiceError(
        `${p.name} has only ${Prisma.Decimal.max(available, 0).toFixed(2)} in advance`,
        { amount: "More than the advance" },
      );
    }
    if (party === "CLIENT") assertCanPayOut(account, amount);

    const number = await documentNumber(tx, ctx, "ADVANCE_RETURN", data.date);
    const doc = await tx.advanceReturn.create({
      data: {
        agencyId: ctx.agencyId,
        number,
        partyType: party,
        partyId: p.id,
        date: isoToDate(data.date),
        amount,
        moneyAccountId: account.id,
        note: data.note ?? null,
        createdById: ctx.userId,
      },
    });
    const acc = await systemAccounts(tx, ["AR", "AP"] as const);
    const partyLine =
      party === "CLIENT"
        ? { ledgerAccountId: acc.AR, partyType: "CLIENT" as const, partyId: p.id }
        : { ledgerAccountId: acc.AP, partyType: "VENDOR" as const, partyId: p.id };
    await postEntry(tx, ctx, {
      date: data.date,
      sourceType: ADVANCE_RETURN_SOURCE,
      sourceId: doc.id,
      narration: `Advance return ${number}: ${p.name}`,
      lines:
        party === "CLIENT"
          ? [
              { ...partyLine, debit: amount },
              { moneyAccountId: account.id, credit: amount },
            ]
          : [
              { moneyAccountId: account.id, debit: amount },
              { ...partyLine, credit: amount },
            ],
    });
    await recordAudit(tx, ctx, {
      action: "CREATE",
      entity: "AdvanceReturn",
      entityId: doc.id,
      after: doc,
    });
    return { id: doc.id, number };
  });
}

export async function voidAdvanceReturn(
  ctx: ServiceContext,
  id: string,
  input: unknown,
): Promise<void> {
  const { reason } = voidSchema.parse(input);
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const before = await tx.advanceReturn.findFirst({ where: { id } });
    if (!before) throw new NotFoundError("Advance return");
    if (before.status === "VOID") throw new ServiceError("This advance return is already void");
    if (before.partyType === "VENDOR") {
      // Money that came in must still be there to reverse it.
      const account = await lockMoneyAccount(tx, ctx.agencyId, before.moneyAccountId);
      if (account) assertCanPayOut(account, before.amount);
    }
    await reverseSource(tx, ctx, ADVANCE_RETURN_SOURCE, id, {
      narration: `Void of ${before.number}: ${reason}`,
    });
    const after = await tx.advanceReturn.update({
      where: { id },
      data: { status: "VOID", voidReason: reason, voidedAt: new Date(), voidedById: ctx.userId },
    });
    await recordAudit(tx, ctx, {
      action: "VOID",
      entity: "AdvanceReturn",
      entityId: id,
      before,
      after,
    });
  });
}

export interface AdvanceReturnRow {
  id: string;
  number: string;
  date: string;
  partyId: string;
  partyName: string;
  account: string;
  amount: string;
  note: string | null;
  status: "POSTED" | "VOID";
  voidReason: string | null;
}

export async function listAdvanceReturns(
  ctx: ServiceContext,
  party: AdvanceParty,
  params: ListParams,
): Promise<{ rows: AdvanceReturnRow[]; total: number }> {
  const db = tenantDb(ctx.agencyId);
  const where: Prisma.AdvanceReturnWhereInput = { partyType: party };
  if (params.from || params.to) {
    where.date = {
      ...(params.from ? { gte: isoToDate(params.from) } : {}),
      ...(params.to ? { lte: isoToDate(params.to) } : {}),
    };
  }
  if (params.q) where.number = { contains: params.q, mode: "insensitive" };
  const [rows, total] = await Promise.all([
    db.advanceReturn.findMany({
      where,
      include: { moneyAccount: { select: { name: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    db.advanceReturn.count({ where }),
  ]);
  const ids = [...new Set(rows.map((r) => r.partyId))];
  const names =
    party === "CLIENT"
      ? await db.client.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
      : await db.vendor.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  const nameOf = new Map(names.map((n) => [n.id, n.name]));
  return {
    total,
    rows: rows.map((r) => ({
      id: r.id,
      number: r.number,
      date: dateToIso(r.date),
      partyId: r.partyId,
      partyName: nameOf.get(r.partyId) ?? "-",
      account: r.moneyAccount.name,
      amount: r.amount.toFixed(2),
      note: r.note,
      status: r.status,
      voidReason: r.voidReason,
    })),
  };
}
