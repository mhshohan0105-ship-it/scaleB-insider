// Any ReportResult as an .xlsx workbook. Money cells are written as numbers
// (Excel needs them to sum) from the exact 2-decimal strings.
import ExcelJS from "exceljs";
import { formatDateTime } from "@/lib/format";
import type { ReportColumn, ReportResult, ReportRow } from "@/lib/reports/types";

const numeric = (c: ReportColumn) =>
  c.type === "money" || c.type === "number" || c.type === "balance";

function cellValue(col: ReportColumn, v: ReportRow[string]): string | number | Date | null {
  if (v === null || v === undefined || v === "") return null;
  const raw = String(v);
  // Totals rows may carry a label in a money or date column; keep it as text.
  if (numeric(col)) return /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
  if (col.type === "date")
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00Z`) : raw;
  return raw;
}

export async function reportToExcel(report: ReportResult, agencyName: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = agencyName;
  wb.created = new Date();
  const ws = wb.addWorksheet(report.title.slice(0, 31).replace(/[\\/*?:[\]]/g, " "));

  ws.addRow([agencyName]).font = { bold: true, size: 14 };
  ws.addRow([report.title]).font = { bold: true, size: 12 };
  if (report.subtitle) ws.addRow([report.subtitle]);
  ws.addRow([`Printed ${formatDateTime(new Date())}`]).font = {
    italic: true,
    color: { argb: "FF6B7280" },
  };
  ws.addRow([]);

  const header = ws.addRow(report.columns.map((c) => c.title));
  header.font = { bold: true };
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F4F1" } };
    cell.border = { bottom: { style: "thin" } };
  });

  for (const r of report.rows) {
    const row = ws.addRow(report.columns.map((c) => cellValue(c, r[c.key])));
    if (r._kind && r._kind !== "row") row.font = { bold: true };
    if (r._level) row.getCell(1).alignment = { indent: r._level };
  }
  if (report.totals) {
    const t = ws.addRow(report.columns.map((c) => cellValue(c, report.totals![c.key])));
    t.font = { bold: true };
    t.eachCell((cell) => (cell.border = { top: { style: "thin" } }));
  }

  report.columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = Math.max(10, Math.min(48, c.title.length + 4, (c.width ?? 1) * 16));
    if (c.type === "money" || c.type === "balance") col.numFmt = "#,##0.00;[Red]-#,##0.00";
    if (c.type === "date") col.numFmt = "dd mmm yyyy";
    if (c.type === "text" || !c.type) col.width = Math.max(col.width ?? 10, (c.width ?? 1) * 18);
  });
  for (const n of report.notes ?? []) ws.addRow([n]).font = { italic: true };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
