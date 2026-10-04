// Line pricing for item based invoices (Other, Other Package, Tour, Umrah):
//   client price = qty x unit price, cost = qty x unit cost, profit = the difference.
import { d, round2, type Decimal, type DecimalInput } from "./money";

export interface ItemLineInput {
  qty: DecimalInput;
  unitPrice: DecimalInput;
  unitCost: DecimalInput;
}

export interface ItemLineResult {
  clientPrice: Decimal;
  purchasePrice: Decimal;
  profit: Decimal;
}

export function calcItemLine(line: ItemLineInput): ItemLineResult {
  const qty = d(line.qty);
  const clientPrice = round2(qty.times(d(line.unitPrice)));
  const purchasePrice = round2(qty.times(d(line.unitCost)));
  return { clientPrice, purchasePrice, profit: clientPrice.minus(purchasePrice) };
}
