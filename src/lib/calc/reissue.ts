// Reissue pricing (PLAN.md 6.3). Only the change is charged:
//   client price   = penalty + fare difference + service charge
//   purchase price = penalty + fare difference   (payable to the vendor)
//   profit         = service charge
import { d, type Decimal, type DecimalInput } from "./money";

export interface ReissueLineInput {
  penalty: DecimalInput;
  fareDifference: DecimalInput;
  serviceCharge: DecimalInput;
}

export interface ReissueLineResult {
  clientPrice: Decimal;
  purchasePrice: Decimal;
  profit: Decimal;
}

export function calcReissueLine(line: ReissueLineInput): ReissueLineResult {
  const purchasePrice = d(line.penalty).plus(d(line.fareDifference));
  const clientPrice = purchasePrice.plus(d(line.serviceCharge));
  return { clientPrice, purchasePrice, profit: clientPrice.minus(purchasePrice) };
}
