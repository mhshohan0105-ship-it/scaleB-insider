// Loans and received investments (PLAN.md 6.13).
//
//   Loan taken           Dr money / Cr Loans Taken (authority)
//   Loan given           Dr Loans Given (authority) / Cr money
//   Investment received  Dr money / Cr Received Investments (investor)
//   Payment on taken / investment:  Dr liability (principal), Dr Interest Expense (interest) / Cr money
//   Receipt on given:               Dr money / Cr Loans Given (principal), Cr Interest Income (interest)
//
// Authority balance (cached): positive = they owe the agency.
import { Prisma, type LoanKind } from "@prisma/client";
import { loanSchedule } from "@/lib/calc/loan";
import { dateToIso, isoToDate } from "@/lib/dates";
import type { ListParams } from "@/lib/listParams";
import { voidSchema } from "@/lib/schemas/accounts";
import { loanAuthoritySchema, loanPaymentSchema, loanSchema } from "@/lib/schemas/money";
import { systemAccounts } from "@/server/accounting/ledgers";
import {
  assertCanPayOut,
  lockMoneyAccount,
  requireActiveAccount,
} from "@/server/accounting/moneyGuard";
import { postEntry, reverseSource } from "@/server/accounting/post";
import type { LineInput } from "@/server/accounting/validate";
import { recordAudit } from "@/server/audit/audit";
import { tenantDb, type TenantTx } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { NotFoundError, ServiceError, isUniqueViolation } from "../errors";
import { documentNumber } from "../numbering/documentNumber";

export const LOAN_SOURCE = "LOAN";
export const LOAN_PAYMENT_SOURCE = "LOAN_PAYMENT";

export const LOAN_KIND_LABEL: Record<LoanKind, string> = {
  TAKEN: "Loan taken",
  GIVEN: "Loan given",
  INVESTMENT: "Investment received",
};

const LIABILITY = { TAKEN: "LOANS_TAKEN", INVESTMENT: "RECEIVED_INVESTMENT" } as const;
/** Money comes in when the loan is made (taken / investment received). */
const inflow = (kind: LoanKind) => kind !== "GIVEN";

// ─── Authorities ────────────────────────────────────────────────────────────

export async function saveLoanAuthority(ctx: ServiceContext, id: string | null, input: unknown) {
  const data = loanAuthoritySchema.parse(input);
  try {
    return await tenantDb(ctx.agencyId).$transaction(async (tx) => {
      if (id) {
        const before = await tx.loanAuthority.findFirst({ where: { id } });
        if (!before) throw new NotFoundError("Authority");
        const after = await tx.loanAuthority.update({ where: { id }, data });
        await recordAudit(tx, ctx, {
          action: "UPDATE",
          entity: "LoanAuthority",
          entityId: id,
          before,
          after,
        });
        return { id };
      }
      const row = await tx.loanAuthority.create({
        data: { ...data, agencyId: ctx.agencyId, createdById: ctx.userId },
      });
      await recordAudit(tx, ctx, {
        action: "CREATE",
        entity: "LoanAuthority",
        entityId: row.id,
        after: row,
      });
      return { id: row.id };
    });
  } catch (e) {
    if (isUniqueViolation(e))
      throw new ServiceError("This name exists already", { name: "Already exists" });
    throw e;
  }
}

export async function listLoanAuthorities(ctx: ServiceContext) {
  const rows = await tenantDb(ctx.agencyId).loanAuthority.findMany({ orderBy: { name: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    phone: r.phone,
    address: r.address,
    note: r.note,
    isActive: r.isActive,
    balance: r.balance.toFixed(2),
  }));
}

export async function loanAuthorityOptions(ctx: ServiceContext) {
  const rows = await tenantDb(ctx.agencyId).loanAuthority.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return rows.map((r) => ({ value: r.id, label: r.name }));
}

// ─── Loans ──────────────────────────────────────────────────────────────────

async function loanAccounts(tx: TenantTx) {
  return systemAccounts(tx, [
    "LOANS_TAKEN",
    "LOANS_GIVEN",
    "RECEIVED_INVESTMENT",
    "INTEREST_EXPENSE",
    "INTEREST_INCOME",
  ] as const);
}

function partyAccount(kind: LoanKind, acc: Awaited<ReturnType<typeof loanAccounts>>) {
  return kind === "GIVEN" ? acc.LOANS_GIVEN : acc[LIABILITY[kind]];
}

export async function createLoan(
  ctx: ServiceContext,
  input: unknown,
): Promise<{ id: string; number: string }> {
  const data = loanSchema.parse(input);
  const principal = new Prisma.Decimal(data.principal);
  return tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const authority = await tx.loanAuthority.findFirst({ where: { id: data.authorityId } });
    if (!authority)
      throw new ServiceError("Not found", { authorityId: "Choose a valid authority" });
    const account = await requireActiveAccount(tx, ctx.agencyId, data.moneyAccountId);
    if (!inflow(data.kind)) assertCanPayOut(account, principal);

    const number = await documentNumber(tx, ctx, "LOAN", data.date);
    const loan = await tx.loan.create({
      data: {
        agencyId: ctx.agencyId,
        number,
        kind: data.kind,
        authorityId: authority.id,
        date: isoToDate(data.date),
        principal,
        interestRate: new Prisma.Decimal(data.interestRate),
        termMonths: data.termMonths ?? null,
        moneyAccountId: account.id,
        note: data.note ?? null,
        createdById: ctx.userId,
      },
    });
    const acc = await loanAccounts(tx);
    const party = {
      ledgerAccountId: partyAccount(data.kind, acc),
      partyType: "LOAN_AUTHORITY" as const,
      partyId: authority.id,
    };
    const money = { moneyAccountId: account.id };
    const lines: LineInput[] = inflow(data.kind)
      ? [
          { ...money, debit: principal },
          { ...party, credit: principal },
        ]
      : [
          { ...party, debit: principal },
          { ...money, credit: principal },
        ];
    await postEntry(tx, ctx, {
      date: data.date,
      sourceType: LOAN_SOURCE,
      sourceId: loan.id,
      narration: `${LOAN_KIND_LABEL[data.kind]} ${number}: ${authority.name}`,
      lines,
    });
    await recordAudit(tx, ctx, {
      action: "CREATE",
      entity: "Loan",
      entityId: loan.id,
      after: loan,
    });
    return { id: loan.id, number };
  });
}

export async function voidLoan(ctx: ServiceContext, id: string, input: unknown) {
  const { reason } = voidSchema.parse(input);
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Loan" WHERE id = ${id} AND "agencyId" = ${ctx.agencyId} FOR UPDATE`;
    const before = await tx.loan.findFirst({ where: { id } });
    if (!before) throw new NotFoundError("Loan");
    if (before.status === "VOID") throw new ServiceError("This loan is already void");
    if (await tx.loanPayment.count({ where: { loanId: id, status: "POSTED" } }))
      throw new ServiceError("This loan has payments. Void them first.");
    if (inflow(before.kind)) {
      const account = await lockMoneyAccount(tx, ctx.agencyId, before.moneyAccountId);
      if (account) assertCanPayOut(account, before.principal);
    }
    await reverseSource(tx, ctx, LOAN_SOURCE, id, {
      narration: `Void of ${before.number}: ${reason}`,
    });
    const after = await tx.loan.update({
      where: { id },
      data: { status: "VOID", voidReason: reason, voidedAt: new Date(), voidedById: ctx.userId },
    });
    await recordAudit(tx, ctx, { action: "VOID", entity: "Loan", entityId: id, before, after });
  });
}

export async function createLoanPayment(
  ctx: ServiceContext,
  input: unknown,
): Promise<{ id: string; number: string }> {
  const data = loanPaymentSchema.parse(input);
  const principal = new Prisma.Decimal(data.principal);
  const interest = new Prisma.Decimal(data.interest);
  const total = principal.plus(interest);
  return tenantDb(ctx.agencyId).$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Loan" WHERE id = ${data.loanId} AND "agencyId" = ${ctx.agencyId} FOR UPDATE`;
    const loan = await tx.loan.findFirst({
      where: { id: data.loanId },
      include: { authority: true },
    });
    if (!loan) throw new ServiceError("Loan not found", { loanId: "Choose a valid loan" });
    if (loan.status !== "ACTIVE")
      throw new ServiceError(`This loan is ${loan.status.toLowerCase()}`);
    if (data.date < dateToIso(loan.date))
      throw new ServiceError("The payment cannot be dated before the loan", {
        date: "Before the loan",
      });
    const left = loan.principal.minus(loan.repaid);
    if (principal.greaterThan(left))
      throw new ServiceError(`Only ${left.toFixed(2)} of principal is outstanding`, {
        principal: "Too much",
      });
    const account = await requireActiveAccount(tx, ctx.agencyId, data.moneyAccountId);
    if (inflow(loan.kind)) assertCanPayOut(account, total);

    const number = await documentNumber(tx, ctx, "LOAN_PAYMENT", data.date);
    const payment = await tx.loanPayment.create({
      data: {
        agencyId: ctx.agencyId,
        number,
        loanId: loan.id,
        date: isoToDate(data.date),
        principal,
        interest,
        moneyAccountId: account.id,
        note: data.note ?? null,
        createdById: ctx.userId,
      },
    });
    const acc = await loanAccounts(tx);
    const party = {
      ledgerAccountId: partyAccount(loan.kind, acc),
      partyType: "LOAN_AUTHORITY" as const,
      partyId: loan.authorityId,
    };
    const lines: LineInput[] = [];
    if (inflow(loan.kind)) {
      if (principal.greaterThan(0)) lines.push({ ...party, debit: principal });
      if (interest.greaterThan(0))
        lines.push({ ledgerAccountId: acc.INTEREST_EXPENSE, debit: interest });
      lines.push({ moneyAccountId: account.id, credit: total });
    } else {
      lines.push({ moneyAccountId: account.id, debit: total });
      if (principal.greaterThan(0)) lines.push({ ...party, credit: principal });
      if (interest.greaterThan(0))
        lines.push({ ledgerAccountId: acc.INTEREST_INCOME, credit: interest });
    }
    await postEntry(tx, ctx, {
      date: data.date,
      sourceType: LOAN_PAYMENT_SOURCE,
      sourceId: payment.id,
      narration: `${loan.kind === "GIVEN" ? "Received on" : "Paid on"} ${loan.number}: ${loan.authority.name}`,
      lines,
    });
    const repaid = loan.repaid.plus(principal);
    await tx.loan.update({
      where: { id: loan.id },
      data: { repaid, status: repaid.equals(loan.principal) ? "CLOSED" : "ACTIVE" },
    });
    await recordAudit(tx, ctx, {
      action: "CREATE",
      entity: "LoanPayment",
      entityId: payment.id,
      after: payment,
    });
    return { id: payment.id, number };
  });
}

export async function voidLoanPayment(ctx: ServiceContext, id: string, input: unknown) {
  const { reason } = voidSchema.parse(input);
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const found = await tx.loanPayment.findFirst({ where: { id }, select: { loanId: true } });
    if (!found) throw new NotFoundError("Payment");
    await tx.$queryRaw`SELECT id FROM "Loan" WHERE id = ${found.loanId} AND "agencyId" = ${ctx.agencyId} FOR UPDATE`;
    const before = await tx.loanPayment.findFirst({ where: { id }, include: { loan: true } });
    if (!before) throw new NotFoundError("Payment");
    if (before.status === "VOID") throw new ServiceError("This payment is already void");
    if (!inflow(before.loan.kind)) {
      const account = await lockMoneyAccount(tx, ctx.agencyId, before.moneyAccountId);
      if (account) assertCanPayOut(account, before.principal.plus(before.interest));
    }
    await reverseSource(tx, ctx, LOAN_PAYMENT_SOURCE, id, {
      narration: `Void of ${before.number}: ${reason}`,
    });
    const after = await tx.loanPayment.update({
      where: { id },
      data: { status: "VOID", voidReason: reason, voidedAt: new Date(), voidedById: ctx.userId },
    });
    await tx.loan.update({
      where: { id: before.loanId },
      data: { repaid: before.loan.repaid.minus(before.principal), status: "ACTIVE" },
    });
    await recordAudit(tx, ctx, {
      action: "VOID",
      entity: "LoanPayment",
      entityId: id,
      before,
      after,
    });
  });
}

export interface LoanRow {
  id: string;
  number: string;
  kind: LoanKind;
  date: string;
  authorityId: string;
  authority: string;
  principal: string;
  repaid: string;
  outstanding: string;
  interestRate: string;
  termMonths: number | null;
  interestPaid: string;
  moneyAccount: string;
  status: string;
  note: string | null;
  voidReason: string | null;
}

export async function listLoans(
  ctx: ServiceContext,
  kinds: readonly LoanKind[],
  params: ListParams,
) {
  const db = tenantDb(ctx.agencyId);
  const where: Prisma.LoanWhereInput = { kind: { in: [...kinds] } };
  const text = params.q?.trim();
  if (text)
    where.OR = [
      { number: { contains: text, mode: "insensitive" } },
      { authority: { name: { contains: text, mode: "insensitive" } } },
    ];
  const [rows, total, sums] = await Promise.all([
    db.loan.findMany({
      where,
      include: {
        authority: { select: { name: true } },
        moneyAccount: { select: { name: true } },
        payments: { where: { status: "POSTED" }, select: { interest: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    db.loan.count({ where }),
    db.loan.aggregate({
      where: { ...where, status: { not: "VOID" } },
      _sum: { principal: true, repaid: true },
    }),
  ]);
  const z = new Prisma.Decimal(0);
  const principal = sums._sum.principal ?? z;
  const repaid = sums._sum.repaid ?? z;
  return {
    total,
    totals: {
      principal: principal.toFixed(2),
      repaid: repaid.toFixed(2),
      outstanding: principal.minus(repaid).toFixed(2),
    },
    rows: rows.map((r): LoanRow => ({
      id: r.id,
      number: r.number,
      kind: r.kind,
      date: dateToIso(r.date),
      authorityId: r.authorityId,
      authority: r.authority.name,
      principal: r.principal.toFixed(2),
      repaid: r.repaid.toFixed(2),
      outstanding: r.status === "VOID" ? "0.00" : r.principal.minus(r.repaid).toFixed(2),
      interestRate: r.interestRate.toFixed(2),
      termMonths: r.termMonths,
      interestPaid: r.payments.reduce((s, p) => s.plus(p.interest), z).toFixed(2),
      moneyAccount: r.moneyAccount.name,
      status: r.status,
      note: r.note,
      voidReason: r.voidReason,
    })),
  };
}

export type LoanList = Awaited<ReturnType<typeof listLoans>>;

export async function getLoan(ctx: ServiceContext, id: string) {
  const r = await tenantDb(ctx.agencyId).loan.findFirst({
    where: { id },
    include: {
      authority: { select: { id: true, name: true } },
      moneyAccount: { select: { name: true } },
      payments: { orderBy: { date: "asc" }, include: { moneyAccount: { select: { name: true } } } },
    },
  });
  if (!r) return null;
  const schedule = r.termMonths
    ? loanSchedule(r.principal, r.interestRate, r.termMonths, dateToIso(r.date).slice(0, 7)).map(
        (s) => ({
          no: s.no,
          month: s.month,
          installment: s.installment.toFixed(2),
          principal: s.principal.toFixed(2),
          interest: s.interest.toFixed(2),
          balance: s.balance.toFixed(2),
        }),
      )
    : [];
  return {
    id: r.id,
    number: r.number,
    kind: r.kind,
    date: dateToIso(r.date),
    authority: r.authority,
    principal: r.principal.toFixed(2),
    repaid: r.repaid.toFixed(2),
    outstanding: r.principal.minus(r.repaid).toFixed(2),
    interestRate: r.interestRate.toFixed(2),
    termMonths: r.termMonths,
    moneyAccount: r.moneyAccount.name,
    status: r.status,
    note: r.note,
    voidReason: r.voidReason,
    schedule,
    payments: r.payments.map((p) => ({
      id: p.id,
      number: p.number,
      date: dateToIso(p.date),
      principal: p.principal.toFixed(2),
      interest: p.interest.toFixed(2),
      moneyAccount: p.moneyAccount.name,
      status: p.status,
      note: p.note,
      voidReason: p.voidReason,
    })),
  };
}

export type LoanView = NonNullable<Awaited<ReturnType<typeof getLoan>>>;

/** Active loans for the payment form. */
export async function activeLoanOptions(ctx: ServiceContext) {
  const rows = await tenantDb(ctx.agencyId).loan.findMany({
    where: { status: "ACTIVE" },
    orderBy: { date: "desc" },
    include: { authority: { select: { name: true } } },
  });
  return rows.map((r) => ({
    value: r.id,
    kind: r.kind,
    label: `${r.number} · ${LOAN_KIND_LABEL[r.kind]} · ${r.authority.name} · ${r.principal.minus(r.repaid).toFixed(2)} left`,
    outstanding: r.principal.minus(r.repaid).toFixed(2),
  }));
}

export async function listLoanPayments(ctx: ServiceContext, params: ListParams) {
  const db = tenantDb(ctx.agencyId);
  const where: Prisma.LoanPaymentWhereInput = {};
  if (params.from || params.to)
    where.date = {
      ...(params.from ? { gte: isoToDate(params.from) } : {}),
      ...(params.to ? { lte: isoToDate(params.to) } : {}),
    };
  const text = params.q?.trim();
  if (text)
    where.OR = [
      { number: { contains: text, mode: "insensitive" } },
      { loan: { number: { contains: text, mode: "insensitive" } } },
      { loan: { authority: { name: { contains: text, mode: "insensitive" } } } },
    ];
  const [rows, total] = await Promise.all([
    db.loanPayment.findMany({
      where,
      include: {
        loan: {
          select: { id: true, number: true, kind: true, authority: { select: { name: true } } },
        },
        moneyAccount: { select: { name: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    db.loanPayment.count({ where }),
  ]);
  return {
    total,
    rows: rows.map((p) => ({
      id: p.id,
      number: p.number,
      date: dateToIso(p.date),
      loanId: p.loan.id,
      loanNumber: p.loan.number,
      loanKind: p.loan.kind,
      authority: p.loan.authority.name,
      principal: p.principal.toFixed(2),
      interest: p.interest.toFixed(2),
      moneyAccount: p.moneyAccount.name,
      status: p.status,
      voidReason: p.voidReason,
    })),
  };
}

export type LoanPaymentList = Awaited<ReturnType<typeof listLoanPayments>>;
