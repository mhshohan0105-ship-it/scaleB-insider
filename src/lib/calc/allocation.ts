// Money receipt allocation (PLAN.md 6.6): a receipt pays off a client's due
// invoices, oldest first by default; whatever is left is an advance.
import { Decimal, d, type DecimalInput } from "./money";

export interface DueInvoice {
  invoiceId: string;
  /** Business date "YYYY-MM-DD"; older invoices are paid first. */
  date: string;
  number: string;
  due: DecimalInput;
}

export interface Allocation {
  invoiceId: string;
  amount: Decimal;
}

/** Oldest-first allocation of `amount` across due invoices. */
export function autoAllocate(
  amount: DecimalInput,
  dues: DueInvoice[],
): { allocations: Allocation[]; advance: Decimal } {
  let left = d(amount);
  const allocations: Allocation[] = [];
  const ordered = [...dues].sort((a, b) =>
    a.date === b.date ? a.number.localeCompare(b.number) : a.date.localeCompare(b.date),
  );
  for (const inv of ordered) {
    if (left.lessThanOrEqualTo(0)) break;
    const due = d(inv.due);
    if (due.lessThanOrEqualTo(0)) continue;
    const take = Decimal.min(due, left);
    allocations.push({ invoiceId: inv.invoiceId, amount: take });
    left = left.minus(take);
  }
  return { allocations, advance: left };
}

/**
 * Checks hand-edited allocations. Returns an error message per problem:
 * unknown invoice, more than the invoice's due, negative / zero, or a total
 * above the receipt amount. Empty array = valid.
 */
export function allocationErrors(
  amount: DecimalInput,
  allocations: { invoiceId: string; amount: DecimalInput }[],
  dues: DueInvoice[],
): string[] {
  const errors: string[] = [];
  const byId = new Map(dues.map((x) => [x.invoiceId, x]));
  const seen = new Set<string>();
  let total = d(0);
  for (const a of allocations) {
    const inv = byId.get(a.invoiceId);
    const amt = d(a.amount);
    if (!inv) {
      errors.push("An allocated invoice is not a due invoice of this client");
      continue;
    }
    if (seen.has(a.invoiceId)) errors.push(`${inv.number} is allocated twice`);
    seen.add(a.invoiceId);
    if (amt.lessThanOrEqualTo(0)) errors.push(`${inv.number}: allocation must be more than 0`);
    if (amt.greaterThan(d(inv.due))) errors.push(`${inv.number}: allocation is more than its due`);
    total = total.plus(amt);
  }
  if (total.greaterThan(d(amount)))
    errors.push("Allocations add up to more than the amount received");
  return errors;
}
