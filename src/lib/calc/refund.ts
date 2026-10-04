// Refund figures (PLAN.md 6.7). Pure, shared by the refund form preview and
// the server.
//
// For each refunded line the agency takes back:
//   clientAmount  - sales reversed off the client (at most what is left of the line's client price)
//   vendorAmount  - cost reversed off the vendor (at most what is left of the line's purchase price)
//   vendorCharge  - what the vendor keeps (at most vendorAmount)
// and at refund level:
//   clientCharge  - what the agency keeps from the client (at most the total client amount)
//
//   client credit = total client amount - client charge   (owed back to the client)
//   vendor credit = total vendor amount - vendor charges  (owed back to us by the vendor)
//   profit effect = vendor credit - client credit          (usually the charges difference)
import { Decimal, d, sum, type DecimalInput } from "./money";

export interface RefundLineAmounts {
  clientAmount: DecimalInput;
  vendorAmount: DecimalInput;
  vendorCharge: DecimalInput;
}

export interface RefundLineLimits {
  /** Client price not yet refunded. */
  clientLeft: DecimalInput;
  /** Purchase price not yet refunded. */
  vendorLeft: DecimalInput;
}

export interface RefundTotals {
  clientRefundAmount: Decimal;
  clientCharge: Decimal;
  vendorRefundAmount: Decimal;
  vendorCharge: Decimal;
  clientCredit: Decimal;
  vendorCredit: Decimal;
  profitEffect: Decimal;
}

export function calcRefund(lines: RefundLineAmounts[], clientCharge: DecimalInput): RefundTotals {
  const clientRefundAmount = sum(lines.map((l) => d(l.clientAmount)));
  const vendorRefundAmount = sum(lines.map((l) => d(l.vendorAmount)));
  const vendorCharge = sum(lines.map((l) => d(l.vendorCharge)));
  const charge = d(clientCharge);
  const clientCredit = clientRefundAmount.minus(charge);
  const vendorCredit = vendorRefundAmount.minus(vendorCharge);
  return {
    clientRefundAmount,
    clientCharge: charge,
    vendorRefundAmount,
    vendorCharge,
    clientCredit,
    vendorCredit,
    profitEffect: vendorCredit.minus(clientCredit),
  };
}

/** Problems with one line's amounts, as messages (empty when fine). */
export function refundLineErrors(line: RefundLineAmounts, limits: RefundLineLimits): string[] {
  const errors: string[] = [];
  const client = d(line.clientAmount);
  const vendor = d(line.vendorAmount);
  const vCharge = d(line.vendorCharge);
  if (client.isNegative() || vendor.isNegative() || vCharge.isNegative())
    errors.push("Amounts cannot be negative");
  if (client.greaterThan(d(limits.clientLeft)))
    errors.push(`Client amount is more than the ${d(limits.clientLeft).toFixed(2)} left to refund`);
  if (vendor.greaterThan(d(limits.vendorLeft)))
    errors.push(`Vendor amount is more than the ${d(limits.vendorLeft).toFixed(2)} left to refund`);
  if (vCharge.greaterThan(vendor)) errors.push("Vendor charge cannot exceed the vendor amount");
  if (client.isZero() && vendor.isZero()) errors.push("Nothing to refund on this line");
  return errors;
}

/** Problems with the refund as a whole (after the line checks). */
export function refundErrors(
  totals: RefundTotals,
  cash: { returnAmount: DecimalInput; available: DecimalInput } | null,
): string[] {
  const errors: string[] = [];
  if (totals.clientCharge.isNegative()) errors.push("Client charge cannot be negative");
  if (totals.clientCharge.greaterThan(totals.clientRefundAmount))
    errors.push("Client charge cannot exceed the amount refunded");
  if (cash) {
    const ret = d(cash.returnAmount);
    if (!ret.greaterThan(0)) errors.push("Enter the amount to pay back");
    else if (ret.greaterThan(totals.clientCredit))
      errors.push(`Cash return is more than the ${totals.clientCredit.toFixed(2)} refunded`);
    else if (ret.greaterThan(d(cash.available)))
      errors.push(
        `The client only has ${Decimal.max(d(cash.available), 0).toFixed(2)} in credit after this refund (the rest of the invoice is unpaid)`,
      );
  }
  return errors;
}

/** How much of a refund can be paid back in cash: the client's credit after it, capped at the credit. */
export function cashReturnable(clientBalance: DecimalInput, clientCredit: DecimalInput): Decimal {
  // Balance: positive = client owes us. After the refund it drops by the credit.
  const after = d(clientBalance).minus(d(clientCredit));
  const available = after.negated();
  if (!available.greaterThan(0)) return d(0);
  return available.lessThan(d(clientCredit)) ? available : d(clientCredit);
}
