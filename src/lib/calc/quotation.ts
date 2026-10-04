// Quotation totals (PLAN.md 6.15). Pure. Lines are qty x unit price; the
// discount comes off the subtotal. Costs, when given, show the margin.
import { calcItemLine } from "./items";
import { d, sum, type Decimal, type DecimalInput } from "./money";

export interface QuoteLineInput {
  qty: DecimalInput;
  unitPrice: DecimalInput;
  unitCost?: DecimalInput;
}

export interface QuoteTotals {
  lines: { amount: Decimal; cost: Decimal }[];
  subtotal: Decimal;
  discount: Decimal;
  netTotal: Decimal;
  cost: Decimal;
  margin: Decimal;
}

export function calcQuotation(lines: QuoteLineInput[], discount: DecimalInput): QuoteTotals {
  const priced = lines.map((l) => {
    const r = calcItemLine({ qty: l.qty, unitPrice: l.unitPrice, unitCost: l.unitCost ?? 0 });
    return { amount: r.clientPrice, cost: r.purchasePrice };
  });
  const subtotal = sum(priced.map((l) => l.amount));
  const disc = d(discount);
  const netTotal = subtotal.minus(disc);
  const cost = sum(priced.map((l) => l.cost));
  return { lines: priced, subtotal, discount: disc, netTotal, cost, margin: netTotal.minus(cost) };
}
