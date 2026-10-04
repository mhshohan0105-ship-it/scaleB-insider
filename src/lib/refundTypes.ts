// Refund types (PLAN.md 6.7, sidebar "Refund"): which invoices each one
// covers and where it lives. Every type except Partial refunds whole lines;
// Partial lets the amounts per line be lowered (e.g. an unused return sector).
import type { InvoiceTypeKey } from "./invoiceTypes";

export const REFUND_TYPE_KEYS = ["AIR", "OTHER", "TOUR", "PARTIAL", "OTHER_PACKAGE_HAJJ"] as const;
export type RefundTypeKey = (typeof REFUND_TYPE_KEYS)[number];

export interface RefundTypeInfo {
  type: RefundTypeKey;
  label: string;
  /** History page; create is `${path}/new`, view is `${path}/<id>`. */
  path: string;
  invoiceTypes: readonly InvoiceTypeKey[];
  /** Amounts per line may be lower than what is left on the line. */
  partial: boolean;
}

export const REFUND_TYPE_INFO: Record<RefundTypeKey, RefundTypeInfo> = {
  AIR: {
    type: "AIR",
    label: "Air Ticket",
    path: "/refunds/airticket",
    invoiceTypes: ["AIR", "NON_COMMISSION", "REISSUE"],
    partial: false,
  },
  OTHER: {
    type: "OTHER",
    label: "Others",
    path: "/refunds/other",
    invoiceTypes: ["OTHER", "VISA"],
    partial: false,
  },
  TOUR: {
    type: "TOUR",
    label: "Tour Package",
    path: "/refunds/tour",
    invoiceTypes: ["TOUR"],
    partial: false,
  },
  PARTIAL: {
    type: "PARTIAL",
    label: "Partial",
    path: "/refunds/partial",
    invoiceTypes: [
      "AIR",
      "NON_COMMISSION",
      "REISSUE",
      "OTHER",
      "OTHER_PACKAGE",
      "VISA",
      "TOUR",
      "HAJJ_PRE_REG",
      "HAJJ",
      "UMRAH",
    ],
    partial: true,
  },
  OTHER_PACKAGE_HAJJ: {
    type: "OTHER_PACKAGE_HAJJ",
    label: "Other Package & Hajj",
    path: "/refunds/otherpackagehajj",
    invoiceTypes: ["OTHER_PACKAGE", "UMRAH", "HAJJ_PRE_REG", "HAJJ"],
    partial: false,
  },
};

/** The full-line refund type for an invoice type. */
export function refundTypeFor(invoiceType: InvoiceTypeKey): RefundTypeKey {
  const hit = REFUND_TYPE_KEYS.find(
    (k) => !REFUND_TYPE_INFO[k].partial && REFUND_TYPE_INFO[k].invoiceTypes.includes(invoiceType),
  );
  return hit ?? "PARTIAL";
}

export const REFUND_METHOD_LABEL: Record<string, string> = {
  ADJUST_TO_BALANCE: "Kept as client credit",
  CASH_RETURN: "Paid back",
};
