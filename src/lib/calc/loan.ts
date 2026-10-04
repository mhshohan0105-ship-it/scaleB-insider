// Loan repayment schedule (PLAN.md 6.13). Pure. Equal monthly installments on
// a reducing balance:
//   r = yearly rate / 12 / 100
//   installment = P * r / (1 - (1 + r)^-n)      (P / n when r = 0)
// Each month's interest = balance * r (rounded); the rest repays principal.
// The last installment takes whatever is left, so the balance ends at 0.
import { Decimal, d, round2, type DecimalInput } from "./money";

export interface ScheduleRow {
  no: number;
  /** "YYYY-MM" */
  month: string;
  installment: Decimal;
  principal: Decimal;
  interest: Decimal;
  balance: Decimal;
}

function addMonths(yyyyMm: string, n: number): string {
  const [y, m] = yyyyMm.split("-").map(Number) as [number, number];
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export function loanSchedule(
  principal: DecimalInput,
  yearlyRate: DecimalInput,
  months: number,
  /** Month of the loan, "YYYY-MM"; the first installment is due the month after. */
  startMonth: string,
): ScheduleRow[] {
  const p = d(principal);
  if (!p.greaterThan(0) || !Number.isInteger(months) || months < 1 || months > 600) return [];
  const r = d(yearlyRate).dividedBy(1200);
  const installment = r.isZero()
    ? round2(p.dividedBy(months))
    : round2(p.times(r).dividedBy(new Decimal(1).minus(r.plus(1).pow(-months))));

  const rows: ScheduleRow[] = [];
  let balance = p;
  for (let i = 1; i <= months; i++) {
    const interest = round2(balance.times(r));
    const last = i === months;
    const principalPart = last ? balance : Decimal.min(installment.minus(interest), balance);
    balance = balance.minus(principalPart);
    rows.push({
      no: i,
      month: addMonths(startMonth, i),
      installment: principalPart.plus(interest),
      principal: principalPart,
      interest,
      balance,
    });
  }
  return rows;
}
