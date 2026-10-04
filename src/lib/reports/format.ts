// Text for a report cell; shared by the screen, the PDF and tests.
import { formatDate, formatMoney } from "@/lib/format";
import type { ReportColumn, ReportRow } from "./types";

export function isNumericColumn(c: ReportColumn): boolean {
  return c.type === "money" || c.type === "number" || c.type === "balance";
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER = /^-?\d+(\.\d+)?$/;

/**
 * Text for a cell. Totals rows may put a label (e.g. "Total", "3 tickets")
 * in a date or money column; labels are shown as they are.
 */
export function cellText(col: ReportColumn, v: ReportRow[string]): string {
  if (v === null || v === undefined || v === "") return "";
  const raw = String(v);
  if ((col.type === "date" && !ISO_DAY.test(raw)) || (isNumericColumn(col) && !NUMBER.test(raw)))
    return raw;
  switch (col.type) {
    case "money":
      return formatMoney(String(v));
    case "balance": {
      const s = String(v);
      if (/^-?0(\.0+)?$/.test(s)) return "0.00";
      return s.startsWith("-") ? `${formatMoney(s.slice(1))} Cr` : `${formatMoney(s)} Dr`;
    }
    case "date":
      return formatDate(String(v));
    default:
      return String(v);
  }
}
