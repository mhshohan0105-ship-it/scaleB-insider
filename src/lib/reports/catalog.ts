// Every report page and the reports it offers (PLAN.md section 7). Shared by
// the pages (report picker, filters) and the server (extra permissions).
import type { ModuleKey } from "@/lib/permissions";

export type ReportFilter =
  | "dateRange"
  | "asOf"
  | "party"
  | "partyId"
  | "show"
  | "client"
  | "salesman"
  | "airline"
  | "vendor"
  | "group"
  | "user"
  | "year";

/** Which period a report opens with when none is chosen. */
export type DefaultPeriod = "month" | "fiscalYear" | "none";

export interface ReportInfo {
  key: string;
  label: string;
  filters: ReportFilter[];
  period?: DefaultPeriod;
  /** Label of the period filter when it is not the document date. */
  periodLabel?: string;
  description?: string;
  /** Needed on top of Reports view (sensitive reports). */
  requires?: { module: ModuleKey; action: "view" | "edit" };
}

export interface ReportGroup {
  key: string;
  title: string;
  path: string;
  reports: ReportInfo[];
}

export const REPORT_GROUPS: ReportGroup[] = [
  {
    key: "sales",
    title: "Sales",
    path: "/reports/sales",
    reports: [
      {
        key: "sales",
        label: "Sales Report",
        filters: ["dateRange", "client", "salesman", "airline"],
        period: "month",
      },
      {
        key: "sales-earning",
        label: "Sales & Earning",
        filters: ["dateRange"],
        period: "month",
        description: "Sales, cost and profit by invoice type (net of refunds).",
      },
      {
        key: "airline-sales",
        label: "Airline wise Sales",
        filters: ["dateRange", "airline"],
        period: "month",
      },
      {
        key: "salesman-product",
        label: "Salesman & Product",
        filters: ["dateRange", "salesman"],
        period: "month",
      },
      {
        key: "sales-collection",
        label: "Sales & Collection",
        filters: ["dateRange", "client"],
        period: "month",
        description: "What each client bought and paid in the period, and what they owe now.",
      },
      {
        key: "purchase-payment",
        label: "Purchase & Payment",
        filters: ["dateRange", "vendor"],
        period: "month",
        description:
          "What was bought from and paid to each vendor in the period, and the balance now.",
      },
      {
        key: "salesman-collection",
        label: "Salesman wise Collection",
        filters: ["dateRange", "salesman"],
        period: "month",
        description: "Money received against each salesperson's invoices.",
      },
      {
        key: "daily-sales-purchase",
        label: "Daily Sales & Purchase",
        filters: ["dateRange"],
        period: "month",
      },
      {
        key: "salesman-client-due",
        label: "Salesman wise Client Due",
        filters: ["salesman"],
        period: "none",
        description: "What clients still owe on each salesperson's invoices, today.",
      },
    ],
  },
  {
    key: "profit",
    title: "Profit & Loss",
    path: "/reports/profitloss",
    reports: [
      {
        key: "profit-loss",
        label: "Overall Profit & Loss",
        filters: ["dateRange"],
        period: "fiscalYear",
      },
      { key: "visa-profit", label: "Visa wise Profit", filters: ["dateRange"], period: "month" },
      {
        key: "group-profit",
        label: "Group wise Profit",
        filters: ["dateRange"],
        period: "fiscalYear",
      },
      {
        key: "ticket-profit",
        label: "Ticket wise Profit",
        filters: ["dateRange", "airline", "client"],
        period: "month",
      },
    ],
  },
  {
    key: "expense",
    title: "Expense",
    path: "/reports/expense",
    reports: [
      { key: "expense-heads", label: "Office Expenses", filters: ["dateRange"], period: "month" },
      {
        key: "salaries",
        label: "Salaries",
        filters: ["dateRange"],
        period: "month",
        periodLabel: "Paid between",
      },
    ],
  },
  {
    key: "passport",
    title: "Passport",
    path: "/reports/passport",
    reports: [
      { key: "passport-status", label: "Passport Status", filters: [], period: "none" },
      { key: "passport-list", label: "Passport wise", filters: ["client"], period: "none" },
    ],
  },
  {
    key: "passengers",
    title: "Passenger Lists",
    path: "/reports/passengers",
    reports: [
      {
        key: "passengers-client",
        label: "Client wise Passengers",
        filters: ["dateRange", "client"],
        period: "month",
      },
      {
        key: "passengers-group",
        label: "Group wise Pilgrims",
        filters: ["group", "year"],
        period: "none",
      },
    ],
  },
  {
    key: "airticket",
    title: "Air Ticket",
    path: "/reports/airticket",
    reports: [
      {
        key: "ticket-details",
        label: "Ticket Details",
        filters: ["dateRange", "airline", "client", "vendor"],
        period: "month",
      },
      {
        key: "tax-report",
        label: "Tax Report",
        filters: ["dateRange", "airline"],
        period: "month",
      },
      { key: "ait-report", label: "AIT Report", filters: ["dateRange"], period: "month" },
      { key: "client-ait", label: "Client AIT", filters: ["dateRange", "client"], period: "month" },
      { key: "gds-report", label: "GDS Report", filters: ["dateRange"], period: "month" },
    ],
  },
  {
    key: "other",
    title: "Other Reports",
    path: "/reports/other",
    reports: [
      { key: "daily-summary", label: "Daily Summary", filters: ["dateRange"], period: "month" },
      {
        key: "monthly-summary",
        label: "Monthly Summary",
        filters: ["dateRange"],
        period: "fiscalYear",
      },
      {
        key: "accounts-summary",
        label: "Accounts",
        filters: ["dateRange"],
        period: "month",
        description: "Money in and out of each account.",
      },
      {
        key: "client-discount",
        label: "Client Discount",
        filters: ["dateRange", "client"],
        period: "month",
      },
      {
        key: "vendor-payments",
        label: "Vendor Payments",
        filters: ["dateRange", "vendor"],
        period: "month",
      },
      {
        key: "vendor-purchases",
        label: "Vendor Purchases",
        filters: ["dateRange", "vendor"],
        period: "month",
      },
      { key: "tour-package", label: "Tour Packages", filters: ["dateRange"], period: "month" },
      {
        key: "journey-date",
        label: "Journey Date wise",
        filters: ["dateRange", "airline", "client"],
        period: "month",
        periodLabel: "Journey dates",
        description: "Tickets by journey date, with what the client still owes on the invoice.",
      },
      { key: "country-wise", label: "Country wise Visas", filters: ["dateRange"], period: "month" },
      { key: "payroll-summary", label: "Payroll", filters: ["dateRange"], period: "fiscalYear" },
      { key: "loan-report", label: "Loans", filters: [], period: "none" },
      {
        key: "transaction-charge",
        label: "Transaction Charges",
        filters: ["dateRange"],
        period: "month",
      },
      { key: "refund-report", label: "Refunds", filters: ["dateRange", "client"], period: "month" },
      {
        key: "pre-registration",
        label: "Pre Registration",
        filters: ["year", "group"],
        period: "none",
      },
      {
        key: "login-history",
        label: "User Login History",
        filters: ["dateRange", "user"],
        period: "month",
        requires: { module: "configuration", action: "view" },
      },
      {
        key: "audit-trail",
        label: "Audit Trail",
        filters: ["dateRange", "user"],
        period: "month",
        requires: { module: "configuration", action: "view" },
      },
    ],
  },
];

export const REPORT_INFO: Record<string, ReportInfo> = Object.fromEntries(
  REPORT_GROUPS.flatMap((g) => g.reports.map((r) => [r.key, r])),
);
