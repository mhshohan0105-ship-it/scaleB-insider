// Monthly payroll (PLAN.md 6.11). Pure, shared by the form and the server.
//
//   salary expense = basic + allowances - deductions
//   net paid       = salary expense - advance adjusted
//
// The advance adjusted cannot exceed the employee's outstanding advance or
// the salary itself.
import { d, sum, type Decimal, type DecimalInput } from "./money";

export interface PayrollInput {
  basic: DecimalInput;
  allowances: { amount: DecimalInput }[];
  deductions: { amount: DecimalInput }[];
  advanceAdjusted: DecimalInput;
  /** Employee's advance not yet recovered. */
  advanceOutstanding: DecimalInput;
}

export interface PayrollResult {
  allowanceTotal: Decimal;
  deductionTotal: Decimal;
  salaryExpense: Decimal;
  netPaid: Decimal;
  errors: string[];
}

export function calcPayroll(p: PayrollInput): PayrollResult {
  const allowanceTotal = sum(p.allowances.map((a) => d(a.amount)));
  const deductionTotal = sum(p.deductions.map((a) => d(a.amount)));
  const salaryExpense = d(p.basic).plus(allowanceTotal).minus(deductionTotal);
  const advance = d(p.advanceAdjusted);
  const netPaid = salaryExpense.minus(advance);
  const errors: string[] = [];
  if (d(p.basic).isNegative()) errors.push("Basic salary cannot be negative");
  if (salaryExpense.isNegative()) errors.push("Deductions are more than the salary");
  if (advance.isNegative()) errors.push("Advance adjusted cannot be negative");
  if (advance.greaterThan(d(p.advanceOutstanding)))
    errors.push(`Only ${d(p.advanceOutstanding).toFixed(2)} of advance is outstanding`);
  if (advance.greaterThan(salaryExpense) && !salaryExpense.isNegative())
    errors.push("Advance adjusted is more than the salary");
  return { allowanceTotal, deductionTotal, salaryExpense, netPaid, errors };
}
