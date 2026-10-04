// One shape for every report, so the screen (ReportShell), PDF and Excel
// exports can all render any report (PLAN.md section 7).

export type ColumnType = "text" | "money" | "date" | "number" | "balance";

export interface ReportColumn {
  key: string;
  title: string;
  type?: ColumnType;
  /** Relative width used by the PDF. */
  width?: number;
  /** This column carries the row link (`_href`). Default: the first text column. */
  link?: boolean;
}

export type RowKind = "row" | "section" | "subtotal" | "total";

export type ReportRow = Record<string, string | number | null | undefined> & {
  _kind?: RowKind;
  /** Indentation level for grouped statements. */
  _level?: number;
  /** Link for the row's first text column. */
  _href?: string | null;
};

export interface ReportResult {
  key: string;
  title: string;
  /** e.g. the date range or party the report is for. */
  subtitle?: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  /** Footer totals keyed by column. */
  totals?: Record<string, string>;
  /** Headline figures shown above the table. */
  summary?: { label: string; value: string; tone?: "good" | "bad" }[];
  notes?: string[];
  /** Present when the screen shows one page of a longer list. */
  paging?: { total: number; page: number; pageSize: number };
}
