// Every voucher kind in one place: label, page, permission module and which
// way money moves. Shared by pages and server actions.
import type { ModuleKey } from "./permissions";
import type { VoucherKindKey } from "./schemas/money";

export interface VoucherKindInfo {
  kind: VoucherKindKey;
  label: string;
  /** History page (the form lives on the same page, or at `newPath`). */
  path: string;
  module: ModuleKey;
  /** Money leaves an account (checked against cash / wallet overdraft). */
  moneyOut: boolean;
  /** Money comes in; its void takes money out again. */
  moneyIn: boolean;
}

export const VOUCHER_KIND_INFO: Record<VoucherKindKey, VoucherKindInfo> = {
  EXPENSE: {
    kind: "EXPENSE",
    label: "Expense",
    path: "/expenses",
    module: "expense",
    moneyOut: true,
    moneyIn: false,
  },
  NON_INVOICE_INCOME: {
    kind: "NON_INVOICE_INCOME",
    label: "Non Invoice Income",
    path: "/accounts/noninvoiceincome",
    module: "accounts",
    moneyOut: false,
    moneyIn: true,
  },
  INCENTIVE_INCOME: {
    kind: "INCENTIVE_INCOME",
    label: "Incentive Income",
    path: "/accounts/incentiveincome",
    module: "accounts",
    moneyOut: false,
    moneyIn: true,
  },
  AGENT_PAYMENT: {
    kind: "AGENT_PAYMENT",
    label: "Agent Payment",
    path: "/agents/payments",
    module: "agents",
    moneyOut: true,
    moneyIn: false,
  },
  EMPLOYEE_ADVANCE: {
    kind: "EMPLOYEE_ADVANCE",
    label: "Employee Advance",
    path: "/payroll/advances",
    module: "payroll",
    moneyOut: true,
    moneyIn: false,
  },
  BILL_ADJUSTMENT: {
    kind: "BILL_ADJUSTMENT",
    label: "Bill Adjustment",
    path: "/accounts/billadjustment",
    module: "accounts",
    moneyOut: false,
    moneyIn: false,
  },
  INVESTMENT: {
    kind: "INVESTMENT",
    label: "Investment",
    path: "/accounts/investments",
    module: "accounts",
    moneyOut: true,
    moneyIn: false,
  },
  INVESTMENT_RETURN: {
    kind: "INVESTMENT_RETURN",
    label: "Investment Return",
    path: "/accounts/investments",
    module: "accounts",
    moneyOut: false,
    moneyIn: true,
  },
  SET_OFF: {
    kind: "SET_OFF",
    label: "Set-off",
    path: "/clients/combined",
    module: "accounts",
    moneyOut: false,
    moneyIn: false,
  },
};

export const ADJUST_DIRECTION_LABEL: Record<string, string> = {
  INCREASE_DUE: "Increase due",
  DECREASE_DUE: "Decrease due",
};
