// Every invoice type in one place: where it lives, who may use it, how it is
// numbered and what kind of lines it has.
import type { DocumentTypeKey } from "./documentPrefixes";
import type { ModuleKey } from "./permissions";

export const INVOICE_TYPES = [
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
] as const;

export type InvoiceTypeKey = (typeof INVOICE_TYPES)[number];

/** Which line table an invoice type uses. */
export type LineKind = "ticket" | "reissue" | "item" | "visa";

export interface InvoiceTypeInfo {
  type: InvoiceTypeKey;
  label: string;
  /** List page; view is `${path}/<id>`, new is `${path}/new`. */
  path: string;
  module: ModuleKey;
  docType: DocumentTypeKey;
  lines: LineKind;
}

export const INVOICE_TYPE_INFO: Record<InvoiceTypeKey, InvoiceTypeInfo> = {
  AIR: {
    type: "AIR",
    label: "Air ticket",
    path: "/invoices/airticket",
    module: "invoice_air",
    docType: "AIR",
    lines: "ticket",
  },
  NON_COMMISSION: {
    type: "NON_COMMISSION",
    label: "Non commission ticket",
    path: "/invoices/noncommission",
    module: "invoice_noncommission",
    docType: "NON_COMMISSION",
    lines: "ticket",
  },
  REISSUE: {
    type: "REISSUE",
    label: "Reissue",
    path: "/invoices/reissue",
    module: "reissue",
    docType: "REISSUE",
    lines: "reissue",
  },
  OTHER: {
    type: "OTHER",
    label: "Other services",
    path: "/invoices/other",
    module: "invoice_other",
    docType: "OTHER",
    lines: "item",
  },
  OTHER_PACKAGE: {
    type: "OTHER_PACKAGE",
    label: "Other package",
    path: "/invoices/otherpackage",
    module: "invoice_otherpackage",
    docType: "OTHER_PACKAGE",
    lines: "item",
  },
  VISA: {
    type: "VISA",
    label: "Visa",
    path: "/invoices/visa",
    module: "invoice_visa",
    docType: "VISA",
    lines: "visa",
  },
  TOUR: {
    type: "TOUR",
    label: "Tour package",
    path: "/invoices/tour",
    module: "invoice_tour",
    docType: "TOUR",
    lines: "item",
  },
  HAJJ_PRE_REG: {
    type: "HAJJ_PRE_REG",
    label: "Hajj pre registration",
    path: "/hajj/preregistration",
    module: "hajj",
    docType: "HAJJ_PRE_REG",
    lines: "item",
  },
  HAJJ: {
    type: "HAJJ",
    label: "Hajj",
    path: "/hajj/invoices",
    module: "hajj",
    docType: "HAJJ",
    lines: "item",
  },
  UMRAH: {
    type: "UMRAH",
    label: "Umrah",
    path: "/invoices/umrah",
    module: "invoice_umrah",
    docType: "UMRAH",
    lines: "item",
  },
};

export function invoiceHref(type: string, id: string): string | null {
  const info = INVOICE_TYPE_INFO[type as InvoiceTypeKey];
  return info ? `${info.path}/${id}` : null;
}
