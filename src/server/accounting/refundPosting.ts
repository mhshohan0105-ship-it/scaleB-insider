// Journal lines for a refund (PLAN.md 6.7). Pure: account ids are passed in.
//
//   Dr Sales (invoice type)               client amount        sale taken back
//      Cr Accounts Receivable (client)                 client amount
//   Dr Accounts Receivable (client)       client charge        kept from the client
//      Cr Refund Charge Income                         client charge
//   Dr Accounts Payable (vendor)          vendor amount        cost taken back
//      Cr Cost of Sales (invoice type)                 vendor amount
//   Dr Vendor Refund Charges              vendor charge        kept by the vendor
//      Cr Accounts Payable (vendor)                    vendor charge
//   Cash return only:
//   Dr Accounts Receivable (client)       return amount        paid back now
//      Cr Money account                                return amount
//
// With "adjust to balance" the client credit stays on the client's account as
// an advance (or reduces what they still owe).
import type { InvoiceType } from "@prisma/client";
import { d, type DecimalInput } from "@/lib/calc/money";
import type { SystemAccountKey } from "./chartOfAccounts";
import { COGS_ACCOUNT, SALES_ACCOUNT } from "./invoicePosting";
import type { LineInput } from "./validate";

export const REFUND_ACCOUNT_KEYS = [
  "AR",
  "AP",
  "REFUND_CHARGE_INCOME",
  "REFUND_CHARGE_EXPENSE",
] as const;

export interface RefundPostingInput {
  invoiceType: InvoiceType;
  clientId: string;
  clientRefundAmount: DecimalInput;
  clientCharge: DecimalInput;
  lines: { vendorId: string | null; vendorAmount: DecimalInput; vendorCharge: DecimalInput }[];
  returnAmount: DecimalInput;
  moneyAccountId: string | null;
  memo?: string;
}

export function refundJournalLines(
  r: RefundPostingInput,
  accounts: Record<(typeof REFUND_ACCOUNT_KEYS)[number] | SystemAccountKey, string>,
): LineInput[] {
  const lines: LineInput[] = [];
  const client = { partyType: "CLIENT" as const, partyId: r.clientId, memo: r.memo };
  const pair = (debit: LineInput, credit: LineInput, amount: DecimalInput) => {
    const a = d(amount);
    if (!a.greaterThan(0)) return;
    lines.push({ ...debit, debit: a }, { ...credit, credit: a });
  };

  pair(
    { ledgerAccountId: accounts[SALES_ACCOUNT[r.invoiceType]] },
    { ledgerAccountId: accounts.AR, ...client },
    r.clientRefundAmount,
  );
  pair(
    { ledgerAccountId: accounts.AR, ...client },
    { ledgerAccountId: accounts.REFUND_CHARGE_INCOME },
    r.clientCharge,
  );

  // Combine by vendor so each vendor gets one line per side.
  const byVendor = new Map<
    string,
    { amount: ReturnType<typeof d>; charge: ReturnType<typeof d> }
  >();
  for (const l of r.lines) {
    if (!l.vendorId) {
      if (d(l.vendorAmount).greaterThan(0) || d(l.vendorCharge).greaterThan(0))
        throw new Error("Vendor amount on a line without a vendor");
      continue;
    }
    const v = byVendor.get(l.vendorId) ?? { amount: d(0), charge: d(0) };
    byVendor.set(l.vendorId, {
      amount: v.amount.plus(d(l.vendorAmount)),
      charge: v.charge.plus(d(l.vendorCharge)),
    });
  }
  for (const [vendorId, v] of byVendor) {
    const vendor = {
      ledgerAccountId: accounts.AP,
      partyType: "VENDOR" as const,
      partyId: vendorId,
    };
    pair(vendor, { ledgerAccountId: accounts[COGS_ACCOUNT[r.invoiceType]] }, v.amount);
    pair({ ledgerAccountId: accounts.REFUND_CHARGE_EXPENSE }, vendor, v.charge);
  }

  if (d(r.returnAmount).greaterThan(0)) {
    if (!r.moneyAccountId) throw new Error("Cash return without a money account");
    pair(
      { ledgerAccountId: accounts.AR, ...client },
      { moneyAccountId: r.moneyAccountId },
      r.returnAmount,
    );
  }
  return lines;
}
