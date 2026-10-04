// Money accounts (Accounts list, Balance Status) and the chart of accounts view.
import { Prisma, type LedgerType, type MoneyAccountKind } from "@prisma/client";
import { maskAccountNo } from "@/lib/mask";
import { moneyAccountSchema } from "@/lib/schemas/accounts";
import { createMoneyAccountWithLedger } from "@/server/accounting/moneyLedger";
import { syncMoneyAccountOpening } from "@/server/accounting/opening";
import { recordAudit } from "@/server/audit/audit";
import { tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { NotFoundError, ServiceError, isUniqueViolation } from "../errors";

export interface MoneyAccountRow {
  id: string;
  name: string;
  kind: MoneyAccountKind;
  bankName: string | null;
  accountNoMasked: string | null;
  branch: string | null;
  openingBalance: string;
  balance: string;
  note: string | null;
  isActive: boolean;
  ledgerCode: string;
}

export async function listMoneyAccounts(
  ctx: ServiceContext,
  opts: { activeOnly?: boolean } = {},
): Promise<MoneyAccountRow[]> {
  const rows = await tenantDb(ctx.agencyId).moneyAccount.findMany({
    where: opts.activeOnly ? { isActive: true } : undefined,
    include: { ledgerAccount: { select: { code: true } } },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    bankName: r.bankName,
    accountNoMasked: r.accountNoMasked,
    branch: r.branch,
    openingBalance: r.openingBalance.toFixed(2),
    balance: r.balance.toFixed(2),
    note: r.note,
    isActive: r.isActive,
    ledgerCode: r.ledgerAccount.code,
  }));
}

function duplicateName(error: unknown): never {
  if (isUniqueViolation(error)) {
    throw new ServiceError("An account with this name already exists", {
      name: "Name already in use",
    });
  }
  throw error;
}

export async function createMoneyAccount(
  ctx: ServiceContext,
  input: unknown,
): Promise<{ id: string }> {
  const data = moneyAccountSchema.parse(input);
  try {
    return await tenantDb(ctx.agencyId).$transaction(async (tx) => {
      const account = await createMoneyAccountWithLedger(
        tx,
        ctx.agencyId,
        {
          name: data.name,
          kind: data.kind,
          bankName: data.bankName ?? null,
          accountNoMasked: maskAccountNo(data.accountNo),
          branch: data.branch ?? null,
          openingBalance: new Prisma.Decimal(data.openingBalance),
          note: data.note ?? null,
        },
        ctx.userId,
      );
      await syncMoneyAccountOpening(tx, ctx, account);
      await recordAudit(tx, ctx, {
        action: "CREATE",
        entity: "MoneyAccount",
        entityId: account.id,
        after: account,
      });
      return { id: account.id };
    });
  } catch (error) {
    duplicateName(error);
  }
}

export async function updateMoneyAccount(
  ctx: ServiceContext,
  id: string,
  input: unknown,
): Promise<void> {
  const data = moneyAccountSchema.parse(input);
  try {
    await tenantDb(ctx.agencyId).$transaction(async (tx) => {
      const before = await tx.moneyAccount.findFirst({ where: { id } });
      if (!before) throw new NotFoundError("Account");
      const after = await tx.moneyAccount.update({
        where: { id },
        data: {
          name: data.name,
          kind: data.kind,
          bankName: data.bankName ?? null,
          // Blank keeps the stored masked number.
          accountNoMasked: data.accountNo ? maskAccountNo(data.accountNo) : before.accountNoMasked,
          branch: data.branch ?? null,
          openingBalance: new Prisma.Decimal(data.openingBalance),
          note: data.note ?? null,
        },
      });
      if (before.name !== after.name) {
        await tx.ledgerAccount.update({
          where: { id: after.ledgerAccountId },
          data: { name: after.name },
        });
      }
      if (!before.openingBalance.equals(after.openingBalance)) {
        // Reverse the old opening entry and post the new one.
        await syncMoneyAccountOpening(tx, ctx, { ...after, createdAt: before.createdAt });
      }
      await recordAudit(tx, ctx, {
        action: "UPDATE",
        entity: "MoneyAccount",
        entityId: id,
        before,
        after,
      });
    });
  } catch (error) {
    duplicateName(error);
  }
}

export async function setMoneyAccountActive(ctx: ServiceContext, id: string, active: boolean) {
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const before = await tx.moneyAccount.findFirst({ where: { id } });
    if (!before) throw new NotFoundError("Account");
    if (before.isActive === active) return;
    if (!active && !before.balance.isZero()) {
      throw new ServiceError("Move the remaining balance out before deactivating this account");
    }
    const after = await tx.moneyAccount.update({ where: { id }, data: { isActive: active } });
    await recordAudit(tx, ctx, {
      action: active ? "ACTIVATE" : "DEACTIVATE",
      entity: "MoneyAccount",
      entityId: id,
      before,
      after,
    });
  });
}

export interface BalanceStatus {
  groups: { kind: MoneyAccountKind; total: string; accounts: MoneyAccountRow[] }[];
  total: string;
}

/** Active money accounts grouped by kind, with totals. */
export async function balanceStatus(ctx: ServiceContext): Promise<BalanceStatus> {
  const accounts = await listMoneyAccounts(ctx, { activeOnly: true });
  const kinds: MoneyAccountKind[] = ["CASH", "BANK", "MOBILE_BANKING", "CREDIT_CARD"];
  let total = new Prisma.Decimal(0);
  const groups = kinds
    .map((kind) => {
      const list = accounts.filter((a) => a.kind === kind);
      const sum = list.reduce((acc, a) => acc.plus(a.balance), new Prisma.Decimal(0));
      total = total.plus(sum);
      return { kind, total: sum.toFixed(2), accounts: list };
    })
    .filter((g) => g.accounts.length > 0);
  return { groups, total: total.toFixed(2) };
}

export interface LedgerRow {
  id: string;
  code: string;
  name: string;
  type: LedgerType;
  isSystem: boolean;
  /** Balance on the account's natural side (debit for assets/expenses, credit otherwise). */
  balance: string;
}

/** Chart of accounts with balances derived from journal lines. */
export async function chartOfAccounts(ctx: ServiceContext): Promise<LedgerRow[]> {
  const db = tenantDb(ctx.agencyId);
  const [accounts, sums] = await Promise.all([
    db.ledgerAccount.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    db.journalLine.groupBy({ by: ["ledgerAccountId"], _sum: { debit: true, credit: true } }),
  ]);
  const net = new Map(
    sums.map((s) => [
      s.ledgerAccountId,
      new Prisma.Decimal(s._sum.debit ?? 0).minus(s._sum.credit ?? 0),
    ]),
  );
  return accounts.map((a) => {
    const debitNet = net.get(a.id) ?? new Prisma.Decimal(0);
    const natural = a.type === "ASSET" || a.type === "EXPENSE" ? debitNet : debitNet.negated();
    return {
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      isSystem: a.isSystem,
      balance: natural.toFixed(2),
    };
  });
}
