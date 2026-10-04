// Invoice header totals (PLAN.md 5 "Invoice", 6.1).
//   subtotal   = sum of line client prices
//   netTotal   = subtotal - discount + serviceCharge + vat        (client owes)
//   totalCost  = sum of line purchase prices                      (vendors are owed)
//   profit     = netTotal - vat - totalCost - agentCommission     (VAT is passed on)
import { d, round2, sum, type Decimal, type DecimalInput } from "./money";

export interface InvoiceTotalsInput {
  lines: { clientPrice: DecimalInput; purchasePrice: DecimalInput }[];
  discount?: DecimalInput;
  serviceCharge?: DecimalInput;
  vat?: DecimalInput;
  agentCommission?: DecimalInput;
}

export interface InvoiceTotals {
  subtotal: Decimal;
  discount: Decimal;
  serviceCharge: Decimal;
  vat: Decimal;
  netTotal: Decimal;
  totalCost: Decimal;
  agentCommission: Decimal;
  profit: Decimal;
}

export function calcInvoiceTotals(input: InvoiceTotalsInput): InvoiceTotals {
  const subtotal = round2(sum(input.lines.map((l) => d(l.clientPrice))));
  const totalCost = round2(sum(input.lines.map((l) => d(l.purchasePrice))));
  const discount = round2(d(input.discount));
  const serviceCharge = round2(d(input.serviceCharge));
  const vat = round2(d(input.vat));
  const agentCommission = round2(d(input.agentCommission));
  const netTotal = subtotal.minus(discount).plus(serviceCharge).plus(vat);
  const profit = netTotal.minus(vat).minus(totalCost).minus(agentCommission);
  return { subtotal, discount, serviceCharge, vat, netTotal, totalCost, agentCommission, profit };
}

export type PaymentState = "POSTED" | "PARTIAL" | "PAID";

/** Payment state of a posted invoice from what has been allocated to it. */
export function paymentState(netTotal: DecimalInput, paid: DecimalInput): PaymentState {
  const p = d(paid);
  if (p.lessThanOrEqualTo(0)) return "POSTED";
  return p.greaterThanOrEqualTo(d(netTotal)) ? "PAID" : "PARTIAL";
}
