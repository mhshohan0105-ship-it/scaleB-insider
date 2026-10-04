// Monthly payroll (PLAN.md 6.11). One live payroll per employee per month.
//
//   Dr Salaries                  basic + allowances - deductions
//      Cr Employee Advances (emp)                 advance adjusted
//      Cr money account                           net paid
import { Prisma } from "@prisma/client";
import { calcPayroll } from "@/lib/calc/payroll";
import { dateToIso, isoToDate } from "@/lib/dates";
import type { ListParams } from "@/lib/listParams";
import { voidSchema } from "@/lib/schemas/accounts";
import { payrollSchema } from "@/lib/schemas/money";
import { systemAccounts } from "@/server/accounting/ledgers";
import {
  assertCanPayOut,
  lockMoneyAccount,
  requireActiveAccount,
} from "@/server/accounting/moneyGuard";
import { postEntry, reverseSource } from "@/server/accounting/post";
import type { LineInput } from "@/server/accounting/validate";
import { recordAudit } from "@/server/audit/audit";
import { tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { NotFoundError, ServiceError } from "../errors";
import { documentNumber } from "../numbering/documentNumber";
import { employeeAdvanceOutstanding } from "../vouchers/voucherService";

export const PAYROLL_SOURCE = "PAYROLL";

type PayLine = { name: string; amount: string };
const money = (v: Prisma.Decimal) => v.toFixed(2);

/** What the payroll form starts from: salary on file and advance outstanding. */
export async function payrollDefaults(ctx: ServiceContext, employeeId: string) {
  const db = tenantDb(ctx.agencyId);
  const emp = await db.employee.findFirst({ where: { id: employeeId }, select: { salary: true } });
  if (!emp) return null;
  return {
    salary: money(emp.salary),
    advanceOutstanding: money(await employeeAdvanceOutstanding(db, employeeId)),
  };
}

export async function createPayroll(
  ctx: ServiceContext,
  input: unknown,
): Promise<{ id: string; number: string }> {
  const data = payrollSchema.parse(input);
  return tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const emp = await tx.employee.findFirst({ where: { id: data.employeeId } });
    if (!emp)
      throw new ServiceError("Employee not found", { employeeId: "Choose a valid employee" });
    // One payroll per employee per month (locks the employee row).
    await tx.$queryRaw`SELECT id FROM "Employee" WHERE id = ${emp.id} AND "agencyId" = ${ctx.agencyId} FOR UPDATE`;
    const dup = await tx.payroll.findFirst({
      where: { employeeId: emp.id, month: data.month, status: "POSTED" },
      select: { number: true },
    });
    if (dup)
      throw new ServiceError(`${emp.name} is already paid for ${data.month} (${dup.number})`, {
        month: "Already paid",
      });

    const outstanding = await employeeAdvanceOutstanding(tx, emp.id);
    const r = calcPayroll({
      basic: data.basic,
      allowances: data.allowances,
      deductions: data.deductions,
      advanceAdjusted: data.advanceAdjusted,
      advanceOutstanding: outstanding,
    });
    if (r.errors.length) throw new ServiceError(r.errors[0]!, { advanceAdjusted: r.errors[0]! });
    const net = new Prisma.Decimal(r.netPaid.toFixed(2));
    const account = await requireActiveAccount(tx, ctx.agencyId, data.moneyAccountId);
    assertCanPayOut(account, net);

    const number = await documentNumber(tx, ctx, "PAYROLL", data.date);
    const payroll = await tx.payroll.create({
      data: {
        agencyId: ctx.agencyId,
        number,
        employeeId: emp.id,
        month: data.month,
        date: isoToDate(data.date),
        basic: new Prisma.Decimal(data.basic),
        allowances: data.allowances as PayLine[],
        allowanceTotal: new Prisma.Decimal(r.allowanceTotal.toFixed(2)),
        deductions: data.deductions as PayLine[],
        deductionTotal: new Prisma.Decimal(r.deductionTotal.toFixed(2)),
        advanceAdjusted: new Prisma.Decimal(data.advanceAdjusted),
        netPaid: net,
        moneyAccountId: account.id,
        note: data.note ?? null,
        createdById: ctx.userId,
      },
    });
    const acc = await systemAccounts(tx, ["SALARIES", "EMPLOYEE_ADVANCE"] as const);
    const expense = new Prisma.Decimal(r.salaryExpense.toFixed(2));
    const lines: LineInput[] = [
      { ledgerAccountId: acc.SALARIES, debit: expense, memo: data.month },
    ];
    if (payroll.advanceAdjusted.greaterThan(0))
      lines.push({
        ledgerAccountId: acc.EMPLOYEE_ADVANCE,
        credit: payroll.advanceAdjusted,
        partyType: "EMPLOYEE",
        partyId: emp.id,
      });
    if (net.greaterThan(0)) lines.push({ moneyAccountId: account.id, credit: net });
    if (expense.greaterThan(0))
      await postEntry(tx, ctx, {
        date: data.date,
        sourceType: PAYROLL_SOURCE,
        sourceId: payroll.id,
        narration: `Salary ${data.month}: ${emp.name} (${number})`,
        lines,
      });
    await recordAudit(tx, ctx, {
      action: "CREATE",
      entity: "Payroll",
      entityId: payroll.id,
      after: payroll,
    });
    return { id: payroll.id, number };
  });
}

export async function voidPayroll(ctx: ServiceContext, id: string, input: unknown) {
  const { reason } = voidSchema.parse(input);
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const before = await tx.payroll.findFirst({ where: { id } });
    if (!before) throw new NotFoundError("Payroll");
    if (before.status === "VOID") throw new ServiceError("This payroll is already void");
    await lockMoneyAccount(tx, ctx.agencyId, before.moneyAccountId);
    if (await tx.journalEntry.count({ where: { sourceType: PAYROLL_SOURCE, sourceId: id } }))
      await reverseSource(tx, ctx, PAYROLL_SOURCE, id, {
        narration: `Void of ${before.number}: ${reason}`,
      });
    const after = await tx.payroll.update({
      where: { id },
      data: { status: "VOID", voidReason: reason, voidedAt: new Date(), voidedById: ctx.userId },
    });
    await recordAudit(tx, ctx, { action: "VOID", entity: "Payroll", entityId: id, before, after });
  });
}

export interface PayrollListQuery extends ListParams {
  month?: string;
  employeeId?: string;
}

export async function listPayrolls(ctx: ServiceContext, q: PayrollListQuery) {
  const db = tenantDb(ctx.agencyId);
  const where: Prisma.PayrollWhereInput = {};
  if (q.month) where.month = q.month;
  if (q.employeeId) where.employeeId = q.employeeId;
  const text = q.q?.trim();
  if (text)
    where.OR = [
      { number: { contains: text, mode: "insensitive" } },
      { employee: { name: { contains: text, mode: "insensitive" } } },
    ];
  const [rows, total, sums] = await Promise.all([
    db.payroll.findMany({
      where,
      include: { employee: { select: { name: true } }, moneyAccount: { select: { name: true } } },
      orderBy: [{ month: "desc" }, { createdAt: "desc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    db.payroll.count({ where }),
    db.payroll.aggregate({
      where: { ...where, status: "POSTED" },
      _sum: {
        basic: true,
        allowanceTotal: true,
        deductionTotal: true,
        advanceAdjusted: true,
        netPaid: true,
      },
    }),
  ]);
  const z = new Prisma.Decimal(0);
  const s = sums._sum;
  return {
    total,
    totals: {
      gross: (s.basic ?? z)
        .plus(s.allowanceTotal ?? z)
        .minus(s.deductionTotal ?? z)
        .toFixed(2),
      advance: (s.advanceAdjusted ?? z).toFixed(2),
      net: (s.netPaid ?? z).toFixed(2),
    },
    rows: rows.map((p) => ({
      id: p.id,
      number: p.number,
      month: p.month,
      date: dateToIso(p.date),
      employeeId: p.employeeId,
      employee: p.employee.name,
      basic: money(p.basic),
      allowanceTotal: money(p.allowanceTotal),
      deductionTotal: money(p.deductionTotal),
      advanceAdjusted: money(p.advanceAdjusted),
      netPaid: money(p.netPaid),
      moneyAccount: p.moneyAccount.name,
      status: p.status,
      voidReason: p.voidReason,
    })),
  };
}

export type PayrollList = Awaited<ReturnType<typeof listPayrolls>>;

export async function getPayroll(ctx: ServiceContext, id: string) {
  const p = await tenantDb(ctx.agencyId).payroll.findFirst({
    where: { id },
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          phone: true,
          designation: { select: { name: true } },
          department: { select: { name: true } },
        },
      },
      moneyAccount: { select: { name: true } },
    },
  });
  if (!p) return null;
  return {
    id: p.id,
    number: p.number,
    month: p.month,
    date: dateToIso(p.date),
    status: p.status,
    voidReason: p.voidReason,
    employee: {
      id: p.employee.id,
      name: p.employee.name,
      phone: p.employee.phone,
      designation: p.employee.designation?.name ?? null,
      department: p.employee.department?.name ?? null,
    },
    basic: money(p.basic),
    allowances: (p.allowances as PayLine[]) ?? [],
    allowanceTotal: money(p.allowanceTotal),
    deductions: (p.deductions as PayLine[]) ?? [],
    deductionTotal: money(p.deductionTotal),
    advanceAdjusted: money(p.advanceAdjusted),
    gross: money(p.basic.plus(p.allowanceTotal)),
    totalDeductions: money(p.deductionTotal.plus(p.advanceAdjusted)),
    netPaid: money(p.netPaid),
    moneyAccount: p.moneyAccount.name,
    note: p.note,
  };
}

export type PayrollView = NonNullable<Awaited<ReturnType<typeof getPayroll>>>;
