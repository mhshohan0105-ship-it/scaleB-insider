// Document number prefixes (PLAN.md 2.3), editable per agency in App Config.
import { z } from "zod";

export const DOCUMENT_TYPES = [
  { key: "AIR", label: "Air ticket invoice", prefix: "AIT" },
  { key: "NON_COMMISSION", label: "Non commission invoice", prefix: "NCI" },
  { key: "REISSUE", label: "Reissue", prefix: "RIS" },
  { key: "OTHER", label: "Other invoice", prefix: "OTH" },
  { key: "OTHER_PACKAGE", label: "Other package invoice", prefix: "OPK" },
  { key: "VISA", label: "Visa invoice", prefix: "VIS" },
  { key: "TOUR", label: "Tour package invoice", prefix: "TUR" },
  { key: "HAJJ_PRE_REG", label: "Hajj pre registration", prefix: "HPR" },
  { key: "HAJJ", label: "Hajj invoice", prefix: "HAJ" },
  { key: "UMRAH", label: "Umrah invoice", prefix: "UMR" },
  { key: "HAJJ_TRANSFER", label: "Hajj transfer", prefix: "HTR" },
  { key: "MONEY_RECEIPT", label: "Money receipt", prefix: "MR" },
  { key: "VENDOR_PAYMENT", label: "Vendor payment", prefix: "VP" },
  { key: "REFUND", label: "Refund", prefix: "RF" },
  { key: "ADVANCE_RETURN", label: "Advance return", prefix: "ADV" },
  { key: "EXPENSE", label: "Expense", prefix: "EXP" },
  { key: "NON_INVOICE_INCOME", label: "Non invoice income", prefix: "NII" },
  { key: "INCENTIVE_INCOME", label: "Incentive income", prefix: "INC" },
  { key: "AGENT_PAYMENT", label: "Agent payment", prefix: "AGP" },
  { key: "EMPLOYEE_ADVANCE", label: "Employee advance", prefix: "EAD" },
  { key: "BILL_ADJUSTMENT", label: "Bill adjustment", prefix: "BAJ" },
  { key: "SET_OFF", label: "Set-off (combined client)", prefix: "SOF" },
  { key: "INVESTMENT", label: "Investment", prefix: "IVT" },
  { key: "INVESTMENT_RETURN", label: "Investment return", prefix: "IVR" },
  { key: "LOAN", label: "Loan", prefix: "LN" },
  { key: "LOAN_PAYMENT", label: "Loan payment", prefix: "LP" },
  { key: "PAYROLL", label: "Payroll", prefix: "PAY" },
  { key: "QUOTATION", label: "Quotation", prefix: "QT" },
  { key: "BALANCE_TRANSFER", label: "Balance transfer", prefix: "BT" },
  { key: "JOURNAL", label: "Journal voucher", prefix: "JV" },
] as const;

export type DocumentTypeKey = (typeof DOCUMENT_TYPES)[number]["key"];

export const DEFAULT_PREFIXES: Record<DocumentTypeKey, string> = Object.fromEntries(
  DOCUMENT_TYPES.map((d) => [d.key, d.prefix]),
) as Record<DocumentTypeKey, string>;

export const prefixSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]{1,6}$/, "Use 1 to 6 letters or digits")
  .transform((s) => s.toUpperCase());

/** Merges stored prefixes over the defaults, ignoring junk. */
export function resolvePrefixes(stored: unknown): Record<DocumentTypeKey, string> {
  const out = { ...DEFAULT_PREFIXES };
  if (stored && typeof stored === "object" && !Array.isArray(stored)) {
    for (const d of DOCUMENT_TYPES) {
      const parsed = prefixSchema.safeParse((stored as Record<string, unknown>)[d.key]);
      if (parsed.success) out[d.key] = parsed.data;
    }
  }
  return out;
}
