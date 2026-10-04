// Air ticket pricing (PLAN.md 6.1). The one place the formula lives; used by
// the invoice form (live preview) and the server (what gets saved and posted).
//
//   totalFare       = baseFare + taxes
//   commission      = commission% x (baseFare or totalFare, per airline / App Config)
//   AIT             = AIT% x (baseFare or totalFare, per App Config)
//   purchasePrice   = totalFare - commission + AIT     (what the vendor is owed)
//   profit          = clientPrice - purchasePrice
import { d, pct, round2, sum, type Decimal, type DecimalInput } from "./money";

export type FareBase = "BASE_FARE" | "TOTAL_FARE";

export interface TaxLine {
  code: string;
  amount: DecimalInput;
}

export interface AirTicketInput {
  baseFare: DecimalInput;
  taxes?: TaxLine[];
  commissionPercent: DecimalInput;
  commissionBase: FareBase;
  aitRatePercent: DecimalInput;
  aitBase: FareBase;
  clientPrice: DecimalInput;
}

export interface AirTicketResult {
  taxTotal: Decimal;
  totalFare: Decimal;
  commissionAmount: Decimal;
  aitAmount: Decimal;
  purchasePrice: Decimal;
  profit: Decimal;
}

export function calcAirTicket(input: AirTicketInput): AirTicketResult {
  const baseFare = round2(d(input.baseFare));
  const taxTotal = round2(sum((input.taxes ?? []).map((t) => d(t.amount))));
  const totalFare = baseFare.plus(taxTotal);
  const on = (base: FareBase) => (base === "BASE_FARE" ? baseFare : totalFare);

  const commissionAmount = pct(on(input.commissionBase), d(input.commissionPercent));
  const aitAmount = pct(on(input.aitBase), d(input.aitRatePercent));
  const purchasePrice = totalFare.minus(commissionAmount).plus(aitAmount);
  const profit = round2(d(input.clientPrice)).minus(purchasePrice);
  return { taxTotal, totalFare, commissionAmount, aitAmount, purchasePrice, profit };
}
