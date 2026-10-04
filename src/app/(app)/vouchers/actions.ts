"use server";

// Server actions for vouchers, expense heads, loans, payroll and cheques
// (PLAN.md 6.9 to 6.13). Permission comes from the owning module.
import { VOUCHER_KINDS, type VoucherKindKey } from "@/lib/schemas/money";
import { VOUCHER_KIND_INFO } from "@/lib/voucherKinds";
import { runAction } from "@/server/actions/runAction";
import { requirePermission } from "@/server/auth/session";
import { ServiceError } from "@/server/services/errors";
import { bounceCheque, clearCheque, depositCheque } from "@/server/services/cheques/chequeService";
import {
  saveExpenseHead,
  setExpenseHeadActive,
} from "@/server/services/expense/expenseHeadService";
import {
  createLoan,
  createLoanPayment,
  saveLoanAuthority,
  voidLoan,
  voidLoanPayment,
} from "@/server/services/loans/loanService";
import {
  createPayroll,
  payrollDefaults,
  voidPayroll,
} from "@/server/services/payroll/payrollService";
import { createVoucher, voidVoucher } from "@/server/services/vouchers/voucherService";

function kindOf(kind: string): VoucherKindKey {
  if (!(VOUCHER_KINDS as readonly string[]).includes(kind))
    throw new ServiceError("Unknown voucher");
  return kind as VoucherKindKey;
}

/** Bill adjustments change a party's due by hand: editors of Accounts only. */
const actionFor = (k: VoucherKindKey) => (k === "BILL_ADJUSTMENT" ? "edit" : "create");

export async function createVoucherAction(kind: string, values: unknown) {
  return runAction(async () => {
    const k = kindOf(kind);
    const ctx = await requirePermission(VOUCHER_KIND_INFO[k].module, actionFor(k));
    return createVoucher(ctx, k, values);
  });
}

export async function voidVoucherAction(kind: string, id: string, values: unknown) {
  return runAction(async () => {
    const k = kindOf(kind);
    const ctx = await requirePermission(VOUCHER_KIND_INFO[k].module, "void");
    // Investments and their returns share a page.
    const kinds =
      k === "INVESTMENT" || k === "INVESTMENT_RETURN"
        ? (["INVESTMENT", "INVESTMENT_RETURN"] as const)
        : [k];
    await voidVoucher(ctx, id, values, kinds);
  });
}

export async function saveExpenseHeadAction(id: string | null, values: unknown) {
  return runAction(async () => {
    const ctx = await requirePermission("expense", id ? "edit" : "create");
    return saveExpenseHead(ctx, id, values);
  });
}

export async function setExpenseHeadActiveAction(id: string, active: boolean) {
  return runAction(async () => {
    const ctx = await requirePermission("expense", "edit");
    await setExpenseHeadActive(ctx, id, active);
  });
}

export async function saveLoanAuthorityAction(id: string | null, values: unknown) {
  return runAction(async () => {
    const ctx = await requirePermission("loan", id ? "edit" : "create");
    return saveLoanAuthority(ctx, id, values);
  });
}

export async function createLoanAction(values: unknown) {
  return runAction(async () => createLoan(await requirePermission("loan", "create"), values));
}

export async function voidLoanAction(id: string, values: unknown) {
  return runAction(async () => voidLoan(await requirePermission("loan", "void"), id, values));
}

export async function createLoanPaymentAction(values: unknown) {
  return runAction(async () =>
    createLoanPayment(await requirePermission("loan", "create"), values),
  );
}

export async function voidLoanPaymentAction(id: string, values: unknown) {
  return runAction(async () =>
    voidLoanPayment(await requirePermission("loan", "void"), id, values),
  );
}

export async function payrollDefaultsAction(employeeId: string) {
  return runAction(async () =>
    payrollDefaults(await requirePermission("payroll", "create"), employeeId),
  );
}

export async function createPayrollAction(values: unknown) {
  return runAction(async () => createPayroll(await requirePermission("payroll", "create"), values));
}

export async function voidPayrollAction(id: string, values: unknown) {
  return runAction(async () => voidPayroll(await requirePermission("payroll", "void"), id, values));
}

export async function chequeAction(action: string, id: string, values: unknown) {
  return runAction(async () => {
    const ctx = await requirePermission("cheques", "edit");
    if (action === "deposit") return depositCheque(ctx, id, values);
    if (action === "clear") return clearCheque(ctx, id, values);
    if (action === "bounce") return bounceCheque(ctx, id, values);
    throw new ServiceError("Unknown cheque action");
  });
}
