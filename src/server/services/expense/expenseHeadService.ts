// Expense heads (PLAN.md 6.12). Each head owns an expense ledger account
// (codes 5601-5699) so the P&L shows spending per head. Renaming a head
// renames its ledger; heads are deactivated, never deleted.
import { Prisma } from "@prisma/client";
import {
  EXPENSE_HEAD_CODE_END,
  EXPENSE_HEAD_CODE_START,
} from "@/server/accounting/chartOfAccounts";
import { expenseHeadSchema } from "@/lib/schemas/money";
import { recordAudit } from "@/server/audit/audit";
import { tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { NotFoundError, ServiceError, isUniqueViolation } from "../errors";
import { nextSequence } from "../numbering/sequence";

export async function saveExpenseHead(
  ctx: ServiceContext,
  id: string | null,
  input: unknown,
): Promise<{ id: string }> {
  const data = expenseHeadSchema.parse(input);
  try {
    return await tenantDb(ctx.agencyId).$transaction(async (tx) => {
      if (id) {
        const before = await tx.expenseHead.findFirst({ where: { id } });
        if (!before) throw new NotFoundError("Expense head");
        const after = await tx.expenseHead.update({ where: { id }, data });
        await tx.ledgerAccount.update({
          where: { id: before.ledgerAccountId },
          data: { name: `Expense - ${data.name}` },
        });
        await recordAudit(tx, ctx, {
          action: "UPDATE",
          entity: "ExpenseHead",
          entityId: id,
          before,
          after,
        });
        return { id };
      }
      const n = await nextSequence(tx, ctx.agencyId, "EXPENSE_HEAD_LEDGER");
      const code = EXPENSE_HEAD_CODE_START + n - 1;
      if (code > EXPENSE_HEAD_CODE_END) throw new ServiceError("Too many expense heads");
      const ledger = await tx.ledgerAccount.create({
        data: {
          agencyId: ctx.agencyId,
          code: String(code),
          name: `Expense - ${data.name}`,
          type: "EXPENSE",
          createdById: ctx.userId,
        },
      });
      const head = await tx.expenseHead.create({
        data: {
          agencyId: ctx.agencyId,
          name: data.name,
          note: data.note ?? null,
          ledgerAccountId: ledger.id,
          createdById: ctx.userId,
        },
      });
      await recordAudit(tx, ctx, {
        action: "CREATE",
        entity: "ExpenseHead",
        entityId: head.id,
        after: head,
      });
      return { id: head.id };
    });
  } catch (e) {
    if (isUniqueViolation(e))
      throw new ServiceError("An expense head with this name exists", { name: "Already exists" });
    throw e;
  }
}

export async function setExpenseHeadActive(ctx: ServiceContext, id: string, active: boolean) {
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const before = await tx.expenseHead.findFirst({ where: { id } });
    if (!before) throw new NotFoundError("Expense head");
    const after = await tx.expenseHead.update({ where: { id }, data: { isActive: active } });
    await recordAudit(tx, ctx, {
      action: active ? "ACTIVATE" : "DEACTIVATE",
      entity: "ExpenseHead",
      entityId: id,
      before,
      after,
    });
  });
}

/** Heads with this fiscal year's spending, for the Expense Heads page. */
export async function listExpenseHeads(ctx: ServiceContext, fromIso?: string) {
  const db = tenantDb(ctx.agencyId);
  const heads = await db.expenseHead.findMany({ orderBy: { name: "asc" } });
  const sums = await db.voucher.groupBy({
    by: ["expenseHeadId"],
    where: {
      kind: "EXPENSE",
      status: "POSTED",
      ...(fromIso ? { date: { gte: new Date(`${fromIso}T00:00:00Z`) } } : {}),
    },
    _sum: { amount: true },
    _count: { _all: true },
  });
  return heads.map((h) => {
    const s = sums.find((x) => x.expenseHeadId === h.id);
    return {
      id: h.id,
      name: h.name,
      note: h.note,
      isActive: h.isActive,
      spent: (s?._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
      count: s?._count._all ?? 0,
    };
  });
}

export async function expenseHeadOptions(ctx: ServiceContext) {
  const rows = await tenantDb(ctx.agencyId).expenseHead.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return rows.map((r) => ({ value: r.id, label: r.name }));
}
