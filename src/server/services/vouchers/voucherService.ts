// Simple vouchers (PLAN.md 6.9, 6.12, 6.13): expense, non invoice income,
// incentive income, agent payment, employee advance, bill adjustment,
// investment and investment return. Posting rules: accounting/voucherPosting.ts.
import { Prisma, type PartyType, type VoucherKind } from "@prisma/client";
import { dateToIso, isoToDate } from "@/lib/dates";
import type { ListParams } from "@/lib/listParams";
import { voidSchema } from "@/lib/schemas/accounts";
import { voucherSchema, type VoucherKindKey } from "@/lib/schemas/money";
import { VOUCHER_KIND_INFO } from "@/lib/voucherKinds";
import { systemAccounts } from "@/server/accounting/ledgers";
import {
  assertCanPayOut,
  lockMoneyAccount,
  requireActiveAccount,
} from "@/server/accounting/moneyGuard";
import { postEntry, reverseSource } from "@/server/accounting/post";
import {
  VOUCHER_ACCOUNT_KEYS,
  VoucherRuleError,
  voucherLines,
} from "@/server/accounting/voucherPosting";
import { recordAudit } from "@/server/audit/audit";
import { tenantDb, type TenantTx } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { NotFoundError, ServiceError } from "../errors";
import { documentNumber } from "../numbering/documentNumber";

export const VOUCHER_SOURCE = "VOUCHER";

const PARTY_OF: Partial<Record<VoucherKind, PartyType>> = {
  INCENTIVE_INCOME: "VENDOR",
  AGENT_PAYMENT: "AGENT",
  EMPLOYEE_ADVANCE: "EMPLOYEE",
};

async function partyName(tx: TenantTx, type: PartyType, id: string): Promise<string | null> {
  const select = { name: true } as const;
  const row =
    type === "CLIENT"
      ? await tx.client.findFirst({ where: { id }, select })
      : type === "COMBINED"
        ? await tx.combinedClient.findFirst({ where: { id }, select })
        : type === "VENDOR"
          ? await tx.vendor.findFirst({ where: { id }, select })
          : type === "AGENT"
            ? await tx.agent.findFirst({ where: { id }, select })
            : type === "EMPLOYEE"
              ? await tx.employee.findFirst({ where: { id }, select })
              : null;
  return row?.name ?? null;
}

/** Principal of an investment not yet returned by live returns. */
async function investmentOutstanding(tx: TenantTx, investmentId: string) {
  const inv = await tx.voucher.findFirst({
    where: { id: investmentId, kind: "INVESTMENT", status: "POSTED" },
  });
  if (!inv) return null;
  const back = await tx.voucher.aggregate({
    where: { investmentId, kind: "INVESTMENT_RETURN", status: "POSTED" },
    _sum: { amount: true },
  });
  return { inv, left: inv.amount.minus(back._sum.amount ?? 0) };
}

export async function createVoucher(
  ctx: ServiceContext,
  kind: VoucherKindKey,
  input: unknown,
): Promise<{ id: string; number: string }> {
  if (kind === "SET_OFF")
    throw new ServiceError("Set-offs are made from the combined client's page");
  const data = voucherSchema.parse(input);
  const info = VOUCHER_KIND_INFO[kind];
  const amount = new Prisma.Decimal(data.amount);

  return tenantDb(ctx.agencyId).$transaction(async (tx) => {
    // Party: fixed type for some kinds, chosen for bill adjustments.
    const partyType =
      kind === "BILL_ADJUSTMENT" ? (data.partyType ?? null) : (PARTY_OF[kind] ?? null);
    const partyId = partyType ? (data.partyId ?? null) : null;
    let name: string | null = null;
    if (partyType) {
      if (!partyId)
        throw new ServiceError(`Choose the ${partyType.toLowerCase()}`, { partyId: "Required" });
      name = await partyName(tx, partyType, partyId);
      if (!name) throw new ServiceError("Party not found", { partyId: "Choose a valid party" });
    }
    if (kind === "BILL_ADJUSTMENT" && (!data.note || data.note.length < 3))
      throw new ServiceError("Give the reason for the adjustment", { note: "Required" });
    if (kind === "INVESTMENT" && !data.title)
      throw new ServiceError("Name the investment", { title: "Required" });

    let expenseLedgerId: string | null = null;
    if (kind === "EXPENSE") {
      const head = await tx.expenseHead.findFirst({
        where: { id: data.expenseHeadId ?? "", isActive: true },
      });
      if (!head) throw new ServiceError("Choose the expense head", { expenseHeadId: "Required" });
      expenseLedgerId = head.ledgerAccountId;
    }
    if (kind === "INVESTMENT_RETURN") {
      const o = data.investmentId ? await investmentOutstanding(tx, data.investmentId) : null;
      if (!o) throw new ServiceError("Choose the investment", { investmentId: "Required" });
      if (amount.greaterThan(o.left))
        throw new ServiceError(`Only ${o.left.toFixed(2)} of this investment is still invested`, {
          amount: "More than invested",
        });
    }
    if (kind === "AGENT_PAYMENT") {
      const agent = await tx.agent.findFirst({
        where: { id: partyId! },
        select: { balance: true },
      });
      const payable = agent!.balance.negated();
      if (amount.greaterThan(payable))
        throw new ServiceError(
          `${name} is owed only ${Prisma.Decimal.max(payable, 0).toFixed(2)}`,
          {
            amount: "More than the commission payable",
          },
        );
    }

    const usesMoney =
      kind !== "BILL_ADJUSTMENT" && !(kind === "INCENTIVE_INCOME" && !data.moneyAccountId);
    let moneyAccountId: string | null = null;
    if (usesMoney) {
      if (!data.moneyAccountId)
        throw new ServiceError("Choose the account", { moneyAccountId: "Required" });
      const account = await requireActiveAccount(tx, ctx.agencyId, data.moneyAccountId);
      if (info.moneyOut) assertCanPayOut(account, amount);
      moneyAccountId = account.id;
    }

    let lines;
    try {
      lines = voucherLines(
        {
          kind,
          amount,
          profit: data.profit,
          moneyAccountId,
          partyType,
          partyId,
          direction: data.direction ?? null,
          expenseLedgerId,
          memo: data.reference ?? null,
        },
        await systemAccounts(tx, VOUCHER_ACCOUNT_KEYS),
      );
    } catch (e) {
      if (e instanceof VoucherRuleError) throw new ServiceError(e.message);
      throw e;
    }

    const number = await documentNumber(tx, ctx, kind, data.date);
    const voucher = await tx.voucher.create({
      data: {
        agencyId: ctx.agencyId,
        number,
        kind,
        date: isoToDate(data.date),
        amount,
        profit: kind === "INVESTMENT_RETURN" ? new Prisma.Decimal(data.profit) : 0,
        moneyAccountId,
        partyType,
        partyId,
        expenseHeadId: kind === "EXPENSE" ? data.expenseHeadId! : null,
        direction: kind === "BILL_ADJUSTMENT" ? data.direction! : null,
        investmentId: kind === "INVESTMENT_RETURN" ? data.investmentId! : null,
        title: data.title ?? null,
        reference: data.reference ?? null,
        note: data.note ?? null,
        createdById: ctx.userId,
      },
    });
    await postEntry(tx, ctx, {
      date: data.date,
      sourceType: VOUCHER_SOURCE,
      sourceId: voucher.id,
      narration: `${info.label} ${number}${name ? `: ${name}` : data.title ? `: ${data.title}` : ""}`,
      lines,
    });
    await recordAudit(tx, ctx, {
      action: "CREATE",
      entity: "Voucher",
      entityId: voucher.id,
      after: voucher,
    });
    return { id: voucher.id, number };
  });
}

export async function voidVoucher(
  ctx: ServiceContext,
  id: string,
  input: unknown,
  kinds?: readonly VoucherKind[],
): Promise<void> {
  const { reason } = voidSchema.parse(input);
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const before = await tx.voucher.findFirst({
      where: { id, ...(kinds ? { kind: { in: [...kinds] } } : {}) },
    });
    if (!before) throw new NotFoundError("Voucher");
    if (before.status === "VOID")
      throw new ServiceError(
        `This ${VOUCHER_KIND_INFO[before.kind].label.toLowerCase()} is already void`,
      );
    if (before.kind === "INVESTMENT") {
      const returns = await tx.voucher.count({
        where: { investmentId: id, kind: "INVESTMENT_RETURN", status: "POSTED" },
      });
      if (returns) throw new ServiceError("This investment has returns. Void them first.");
    }
    // Money that came in must still be there to take it back out.
    if (VOUCHER_KIND_INFO[before.kind].moneyIn && before.moneyAccountId) {
      const account = await lockMoneyAccount(tx, ctx.agencyId, before.moneyAccountId);
      if (account) assertCanPayOut(account, before.amount.plus(before.profit));
    }
    await reverseSource(tx, ctx, VOUCHER_SOURCE, id, {
      narration: `Void of ${before.number}: ${reason}`,
    });
    const after = await tx.voucher.update({
      where: { id },
      data: { status: "VOID", voidReason: reason, voidedAt: new Date(), voidedById: ctx.userId },
    });
    await recordAudit(tx, ctx, { action: "VOID", entity: "Voucher", entityId: id, before, after });
  });
}

export interface VoucherRow {
  id: string;
  number: string;
  kind: VoucherKind;
  date: string;
  amount: string;
  profit: string;
  moneyAccount: string | null;
  partyType: PartyType | null;
  partyId: string | null;
  partyName: string | null;
  expenseHead: string | null;
  direction: string | null;
  title: string | null;
  investmentNumber: string | null;
  /** Investments: principal still invested. */
  outstanding: string | null;
  reference: string | null;
  note: string | null;
  status: string;
  voidReason: string | null;
  attachments: { id: string; fileName: string }[];
}

export interface VoucherListQuery extends ListParams {
  expenseHeadId?: string;
  partyId?: string;
  moneyAccountId?: string;
}

export async function listVouchers(
  ctx: ServiceContext,
  kinds: readonly VoucherKind[],
  q: VoucherListQuery,
) {
  const db = tenantDb(ctx.agencyId);
  const where: Prisma.VoucherWhereInput = { kind: { in: [...kinds] } };
  if (q.from || q.to)
    where.date = {
      ...(q.from ? { gte: isoToDate(q.from) } : {}),
      ...(q.to ? { lte: isoToDate(q.to) } : {}),
    };
  if (q.expenseHeadId) where.expenseHeadId = q.expenseHeadId;
  if (q.partyId) where.partyId = q.partyId;
  if (q.moneyAccountId) where.moneyAccountId = q.moneyAccountId;
  const text = q.q?.trim();
  if (text)
    where.OR = [
      { number: { contains: text, mode: "insensitive" } },
      { note: { contains: text, mode: "insensitive" } },
      { reference: { contains: text, mode: "insensitive" } },
      { title: { contains: text, mode: "insensitive" } },
    ];

  const [rows, total, sums] = await Promise.all([
    db.voucher.findMany({
      where,
      include: {
        moneyAccount: { select: { name: true } },
        expenseHead: { select: { name: true } },
        investment: { select: { number: true } },
        attachments: { select: { id: true, fileName: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    db.voucher.count({ where }),
    db.voucher.aggregate({
      where: { ...where, status: "POSTED" },
      _sum: { amount: true, profit: true },
    }),
  ]);

  // Party names, one query per type.
  const names = new Map<string, string>();
  const byType = new Map<PartyType, string[]>();
  for (const r of rows)
    if (r.partyType && r.partyId)
      byType.set(r.partyType, [...(byType.get(r.partyType) ?? []), r.partyId]);
  const select = { id: true, name: true } as const;
  for (const [type, ids] of byType) {
    const where = { id: { in: ids } };
    const found =
      type === "CLIENT"
        ? await db.client.findMany({ where, select })
        : type === "COMBINED"
          ? await db.combinedClient.findMany({ where, select })
          : type === "VENDOR"
            ? await db.vendor.findMany({ where, select })
            : type === "AGENT"
              ? await db.agent.findMany({ where, select })
              : type === "EMPLOYEE"
                ? await db.employee.findMany({ where, select })
                : [];
    for (const f of found) names.set(f.id, f.name);
  }

  // Investments: what is still invested.
  const investIds = rows.filter((r) => r.kind === "INVESTMENT").map((r) => r.id);
  const returned = investIds.length
    ? await db.voucher.groupBy({
        by: ["investmentId"],
        where: { investmentId: { in: investIds }, status: "POSTED" },
        _sum: { amount: true },
      })
    : [];

  const z = new Prisma.Decimal(0);
  return {
    total,
    totals: {
      amount: (sums._sum.amount ?? z).toFixed(2),
      profit: (sums._sum.profit ?? z).toFixed(2),
    },
    rows: rows.map((r): VoucherRow => ({
      id: r.id,
      number: r.number,
      kind: r.kind,
      date: dateToIso(r.date),
      amount: r.amount.toFixed(2),
      profit: r.profit.toFixed(2),
      moneyAccount: r.moneyAccount?.name ?? null,
      partyType: r.partyType,
      partyId: r.partyId,
      partyName: r.partyId ? (names.get(r.partyId) ?? null) : null,
      expenseHead: r.expenseHead?.name ?? null,
      direction: r.direction,
      title: r.title,
      investmentNumber: r.investment?.number ?? null,
      outstanding:
        r.kind === "INVESTMENT" && r.status === "POSTED"
          ? r.amount
              .minus(returned.find((x) => x.investmentId === r.id)?._sum.amount ?? 0)
              .toFixed(2)
          : null,
      reference: r.reference,
      note: r.note,
      status: r.status,
      voidReason: r.voidReason,
      attachments: r.attachments,
    })),
  };
}

export type VoucherList = Awaited<ReturnType<typeof listVouchers>>;

/** Live investments with something still invested, for the return form. */
export async function openInvestments(ctx: ServiceContext) {
  const db = tenantDb(ctx.agencyId);
  const rows = await db.voucher.findMany({
    where: { kind: "INVESTMENT", status: "POSTED" },
    orderBy: { date: "desc" },
    include: { returns: { where: { status: "POSTED" }, select: { amount: true } } },
  });
  return rows
    .map((r) => ({
      value: r.id,
      left: r.amount.minus(r.returns.reduce((s, x) => s.plus(x.amount), new Prisma.Decimal(0))),
      label: `${r.number} · ${r.title ?? ""}`,
    }))
    .filter((r) => r.left.greaterThan(0))
    .map((r) => ({
      value: r.value,
      label: `${r.label} · ${r.left.toFixed(2)} invested`,
      left: r.left.toFixed(2),
    }));
}

/** Sum of a party's line amounts on one ledger (for employee advances). */
export async function employeeAdvanceOutstanding(
  tx: TenantTx | ReturnType<typeof tenantDb>,
  employeeId: string,
): Promise<Prisma.Decimal> {
  const { EMPLOYEE_ADVANCE } = await systemAccounts(tx as TenantTx, ["EMPLOYEE_ADVANCE"] as const);
  const s = await tx.journalLine.aggregate({
    where: { ledgerAccountId: EMPLOYEE_ADVANCE, partyType: "EMPLOYEE", partyId: employeeId },
    _sum: { debit: true, credit: true },
  });
  return (s._sum.debit ?? new Prisma.Decimal(0)).minus(s._sum.credit ?? 0);
}
