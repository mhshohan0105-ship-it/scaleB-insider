// Journal lines for the simple vouchers (PLAN.md 6.9, 6.12, 6.13). Pure:
// account ids are passed in, so the rules are unit tested.
//
//   Expense               Dr expense head           / Cr money account
//   Non invoice income    Dr money account          / Cr Non Invoice Income
//   Incentive income      Dr money account          / Cr Incentive Income
//                         (or, kept by the vendor:  Dr vendor AP / Cr Incentive Income)
//   Agent payment         Dr Agent Payable (agent)  / Cr money account
//   Employee advance      Dr Employee Advances (emp)/ Cr money account
//   Investment            Dr Investments            / Cr money account
//   Investment return     Dr money (amount + gain)  / Cr Investments (amount), Cr Interest Income (gain)
//   Bill adjustment       client / combined due up:  Dr AR (party)       / Cr Bill Adjustments
//                         client / combined due down: Dr Bill Adjustments / Cr AR (party)
//                         vendor / agent due up (we owe more): Dr Bill Adjustments / Cr AP or Agent Payable
//                         vendor / agent due down:   Dr AP or Agent Payable / Cr Bill Adjustments
//   Set-off (combined)    Dr AP (linked vendor)     / Cr AR (linked client)
import type { PartyType, VoucherKind } from "@prisma/client";
import { d, type DecimalInput } from "@/lib/calc/money";
import type { LineInput } from "./validate";

export const VOUCHER_ACCOUNT_KEYS = [
  "AR",
  "AP",
  "AGENT_PAYABLE",
  "EMPLOYEE_ADVANCE",
  "NON_INVOICE_INCOME",
  "INCENTIVE_INCOME",
  "INVESTMENTS",
  "INTEREST_INCOME",
  "BILL_ADJUSTMENT",
] as const;
export type VoucherAccounts = Record<(typeof VOUCHER_ACCOUNT_KEYS)[number], string>;

export interface VoucherPostingInput {
  kind: VoucherKind;
  amount: DecimalInput;
  profit?: DecimalInput;
  moneyAccountId?: string | null;
  partyType?: PartyType | null;
  partyId?: string | null;
  direction?: "INCREASE_DUE" | "DECREASE_DUE" | null;
  /** Expense head's ledger account (expense only). */
  expenseLedgerId?: string | null;
  /** Set-off: the combined client's linked client and vendor. */
  setOff?: { clientId: string; vendorId: string } | null;
  memo?: string | null;
}

export class VoucherRuleError extends Error {}

function need<T>(v: T | null | undefined, what: string): T {
  if (v === null || v === undefined || v === "") throw new VoucherRuleError(`${what} is required`);
  return v;
}

export function voucherLines(v: VoucherPostingInput, acc: VoucherAccounts): LineInput[] {
  const amount = d(v.amount);
  if (!amount.greaterThan(0)) throw new VoucherRuleError("Amount must be more than 0");
  const memo = v.memo ?? null;
  const money = () => need(v.moneyAccountId, "Money account");
  const party = (type: PartyType) => {
    if (v.partyType !== type) throw new VoucherRuleError(`Choose the ${type.toLowerCase()}`);
    return { partyType: type, partyId: need(v.partyId, "Party") };
  };
  const pair = (debit: LineInput, credit: LineInput): LineInput[] => [
    { ...debit, debit: amount, memo },
    { ...credit, credit: amount, memo },
  ];

  switch (v.kind) {
    case "EXPENSE":
      return pair(
        { ledgerAccountId: need(v.expenseLedgerId, "Expense head") },
        { moneyAccountId: money() },
      );
    case "NON_INVOICE_INCOME":
      return pair({ moneyAccountId: money() }, { ledgerAccountId: acc.NON_INVOICE_INCOME });
    case "INCENTIVE_INCOME":
      return v.moneyAccountId
        ? pair({ moneyAccountId: v.moneyAccountId }, { ledgerAccountId: acc.INCENTIVE_INCOME })
        : pair(
            { ledgerAccountId: acc.AP, ...party("VENDOR") },
            { ledgerAccountId: acc.INCENTIVE_INCOME },
          );
    case "AGENT_PAYMENT":
      return pair(
        { ledgerAccountId: acc.AGENT_PAYABLE, ...party("AGENT") },
        { moneyAccountId: money() },
      );
    case "EMPLOYEE_ADVANCE":
      return pair(
        { ledgerAccountId: acc.EMPLOYEE_ADVANCE, ...party("EMPLOYEE") },
        { moneyAccountId: money() },
      );
    case "INVESTMENT":
      return pair({ ledgerAccountId: acc.INVESTMENTS }, { moneyAccountId: money() });
    case "INVESTMENT_RETURN": {
      const gain = d(v.profit);
      if (gain.isNegative()) throw new VoucherRuleError("Gain cannot be negative");
      const lines: LineInput[] = [
        { moneyAccountId: money(), debit: amount.plus(gain), memo },
        { ledgerAccountId: acc.INVESTMENTS, credit: amount, memo },
      ];
      if (gain.greaterThan(0))
        lines.push({ ledgerAccountId: acc.INTEREST_INCOME, credit: gain, memo });
      return lines;
    }
    case "BILL_ADJUSTMENT": {
      const type = need(v.partyType, "Party");
      const partyId = need(v.partyId, "Party");
      const direction = need(v.direction, "Direction");
      const adj = { ledgerAccountId: acc.BILL_ADJUSTMENT };
      if (type === "CLIENT" || type === "COMBINED") {
        const ar = { ledgerAccountId: acc.AR, partyType: type, partyId };
        return direction === "INCREASE_DUE" ? pair(ar, adj) : pair(adj, ar);
      }
      if (type === "VENDOR" || type === "AGENT") {
        const payable = {
          ledgerAccountId: type === "VENDOR" ? acc.AP : acc.AGENT_PAYABLE,
          partyType: type,
          partyId,
        };
        return direction === "INCREASE_DUE" ? pair(adj, payable) : pair(payable, adj);
      }
      throw new VoucherRuleError(
        "Bill adjustment is for clients, combined clients, vendors and agents",
      );
    }
    case "SET_OFF": {
      const s = need(v.setOff, "Linked client and vendor");
      return pair(
        { ledgerAccountId: acc.AP, partyType: "VENDOR", partyId: need(s.vendorId, "Vendor") },
        { ledgerAccountId: acc.AR, partyType: "CLIENT", partyId: need(s.clientId, "Client") },
      );
    }
    default:
      throw new VoucherRuleError(`Unknown voucher kind ${String(v.kind)}`);
  }
}
