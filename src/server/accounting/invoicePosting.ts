// Journal lines for a posted invoice (PLAN.md 2.2 posting examples). Pure:
// account ids are passed in, so the rules can be unit tested.
//
//   Dr Accounts Receivable (client)     netTotal
//   Dr Discount Given                   discount
//      Cr Sales (by invoice type)                   subtotal
//      Cr Service Charge Income                     serviceCharge
//      Cr VAT Payable                               vat
//   Dr Cost of Sales (by type)          per vendor purchase
//      Cr Accounts Payable (vendor)                 per vendor purchase
//   Dr Agent Commission                 agentCommission
//      Cr Agent Commission Payable (agent)          agentCommission
import type { InvoiceType } from "@prisma/client";
import { d, sum, type DecimalInput } from "@/lib/calc/money";
import type { SystemAccountKey } from "./chartOfAccounts";
import type { LineInput } from "./validate";

export const SALES_ACCOUNT: Record<InvoiceType, SystemAccountKey> = {
  AIR: "SALES_AIR",
  NON_COMMISSION: "SALES_NON_COMMISSION",
  REISSUE: "SALES_REISSUE",
  OTHER: "SALES_OTHER",
  OTHER_PACKAGE: "SALES_OTHER_PACKAGE",
  VISA: "SALES_VISA",
  TOUR: "SALES_TOUR",
  HAJJ_PRE_REG: "SALES_HAJJ",
  HAJJ: "SALES_HAJJ",
  UMRAH: "SALES_UMRAH",
};

export const COGS_ACCOUNT: Record<InvoiceType, SystemAccountKey> = {
  AIR: "COGS_AIR",
  NON_COMMISSION: "COGS_NON_COMMISSION",
  REISSUE: "COGS_REISSUE",
  OTHER: "COGS_OTHER",
  OTHER_PACKAGE: "COGS_OTHER_PACKAGE",
  VISA: "COGS_VISA",
  TOUR: "COGS_TOUR",
  HAJJ_PRE_REG: "COGS_HAJJ",
  HAJJ: "COGS_HAJJ",
  UMRAH: "COGS_UMRAH",
};

/** Keys every invoice posting may need. */
export const INVOICE_ACCOUNT_KEYS = [
  "AR",
  "AP",
  "DISCOUNT_GIVEN",
  "SERVICE_CHARGE_INCOME",
  "VAT_PAYABLE",
  "AGENT_COMMISSION",
  "AGENT_PAYABLE",
] as const;

export interface InvoicePostingInput {
  type: InvoiceType;
  clientId: string;
  agentId?: string | null;
  subtotal: DecimalInput;
  discount: DecimalInput;
  serviceCharge: DecimalInput;
  vat: DecimalInput;
  netTotal: DecimalInput;
  agentCommission: DecimalInput;
  /** One entry per line; lines with the same vendor are combined. */
  costs: { vendorId: string; amount: DecimalInput }[];
  memo?: string;
}

export function invoiceJournalLines(
  inv: InvoicePostingInput,
  accounts: Record<(typeof INVOICE_ACCOUNT_KEYS)[number] | SystemAccountKey, string>,
): LineInput[] {
  const lines: LineInput[] = [];
  const add = (line: LineInput, amount: DecimalInput) => {
    if (d(amount).greaterThan(0)) lines.push(line);
  };
  const netTotal = d(inv.netTotal);
  const client = { partyType: "CLIENT" as const, partyId: inv.clientId };

  add({ ledgerAccountId: accounts.AR, debit: netTotal, ...client, memo: inv.memo }, netTotal);
  add({ ledgerAccountId: accounts.DISCOUNT_GIVEN, debit: d(inv.discount) }, inv.discount);
  add(
    { ledgerAccountId: accounts[SALES_ACCOUNT[inv.type]], credit: d(inv.subtotal) },
    inv.subtotal,
  );
  add(
    { ledgerAccountId: accounts.SERVICE_CHARGE_INCOME, credit: d(inv.serviceCharge) },
    inv.serviceCharge,
  );
  add({ ledgerAccountId: accounts.VAT_PAYABLE, credit: d(inv.vat) }, inv.vat);

  const byVendor = new Map<string, ReturnType<typeof d>>();
  for (const c of inv.costs)
    byVendor.set(c.vendorId, (byVendor.get(c.vendorId) ?? d(0)).plus(d(c.amount)));
  for (const [vendorId, amount] of byVendor) {
    add({ ledgerAccountId: accounts[COGS_ACCOUNT[inv.type]], debit: amount }, amount);
    add(
      { ledgerAccountId: accounts.AP, credit: amount, partyType: "VENDOR", partyId: vendorId },
      amount,
    );
  }

  const commission = d(inv.agentCommission);
  if (commission.greaterThan(0)) {
    if (!inv.agentId) throw new Error("Agent commission without an agent");
    lines.push({ ledgerAccountId: accounts.AGENT_COMMISSION, debit: commission });
    lines.push({
      ledgerAccountId: accounts.AGENT_PAYABLE,
      credit: commission,
      partyType: "AGENT",
      partyId: inv.agentId,
    });
  }
  return lines;
}

export function totalOf(values: DecimalInput[]) {
  return sum(values.map(d));
}
