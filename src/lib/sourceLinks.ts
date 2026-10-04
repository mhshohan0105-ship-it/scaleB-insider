// Where a journal entry's source document lives in the app.

import { INVOICE_TYPE_INFO, invoiceHref } from "./invoiceTypes";

export const SOURCE_LABELS: Record<string, string> = {
  OPENING_BALANCE: "Opening balance",
  MONEY_ACCOUNT_OPENING: "Account opening balance",
  BALANCE_TRANSFER: "Balance transfer",
  MANUAL: "Manual journal",
  ...Object.fromEntries(
    Object.values(INVOICE_TYPE_INFO).map((t) => [`INVOICE_${t.type}`, `${t.label} invoice`]),
  ),
  MONEY_RECEIPT: "Money receipt",
  VENDOR_PAYMENT: "Vendor payment",
  ADVANCE_RETURN: "Advance return",
  REFUND: "Refund",
  HAJJ_TRANSFER: "Hajj transfer charge",
  VOUCHER: "Voucher",
  LOAN: "Loan",
  LOAN_PAYMENT: "Loan payment",
  PAYROLL: "Payroll",
  CHEQUE_CLEAR: "Cheque cleared",
};

/** Link to the document behind a journal line, when there is a page for it. */
export function sourceHref(sourceType: string, sourceId: string | null): string | null {
  if (!sourceId) return null;
  if (sourceType.startsWith("INVOICE_")) return invoiceHref(sourceType.slice(8), sourceId);
  if (sourceType === "MONEY_RECEIPT") return `/moneyreceipts/${sourceId}`;
  if (sourceType === "BALANCE_TRANSFER") return "/accounts/balancetransfer";
  if (sourceType === "VENDOR_PAYMENT") return "/vendors/payments";
  if (sourceType === "REFUND") return `/refunds/${sourceId}`;
  if (sourceType === "VOUCHER") return `/vouchers/${sourceId}`;
  if (sourceType === "LOAN") return `/loans/${sourceId}`;
  if (sourceType === "LOAN_PAYMENT") return "/loans/payments";
  if (sourceType === "PAYROLL") return "/payroll";
  if (sourceType === "CHEQUE_CLEAR") return "/cheques";
  return null;
}
