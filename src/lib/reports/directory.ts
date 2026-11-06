// The Reports home page: every report the user may run, in sections, with one
// line on what it shows and where to open it.
import type { PermissionMap } from "@/lib/permissions";
import { canRunReport } from "./access";
import { REPORT_GROUPS } from "./catalog";

export interface DirectoryEntry {
  key: string;
  label: string;
  description: string;
  href: string;
}

export interface DirectorySection {
  key: string;
  title: string;
  entries: DirectoryEntry[];
}

/** Used when the catalog has no description of its own for a report. */
const WHAT_IT_SHOWS: Record<string, string> = {
  sales: "Every invoice in the period, filtered by client, salesperson or airline.",
  "airline-sales": "Ticket sales and profit for each airline.",
  "salesman-product": "What each salesperson sold, by product.",
  "daily-sales-purchase": "Sales and purchases day by day.",
  "profit-loss": "Income, costs, expenses and net profit for the period.",
  "visa-profit": "Profit on each visa line.",
  "group-profit": "Profit on each Hajj or Umrah group.",
  "ticket-profit": "Profit on each air ticket.",
  "expense-heads": "Office expenses by expense head.",
  salaries: "Salaries paid to each employee.",
  "passport-status": "How many passports are at each status.",
  "passport-list": "Every passport, by client.",
  "passengers-client": "The passengers of each client.",
  "passengers-group": "The pilgrims of each group.",
  "ticket-details": "Full details of each ticket sold.",
  "tax-report": "Ticket taxes by tax code.",
  "ait-report": "AIT on tickets in the period.",
  "client-ait": "AIT by client.",
  "gds-report": "Tickets by reservation system.",
  "daily-summary": "Sales, collection and expenses for each day.",
  "monthly-summary": "Sales, collection and expenses for each month.",
  "client-discount": "Discounts given to each client.",
  "vendor-payments": "Payments made to vendors.",
  "vendor-purchases": "Purchases from vendors, line by line.",
  "tour-package": "Tour package sales and profit.",
  "country-wise": "Visas by country.",
  "payroll-summary": "Payroll for each month.",
  "loan-report": "Loans and what is left to pay.",
  "transaction-charge": "Charges paid on money received.",
  "refund-report": "Every refund with its charges.",
  "pre-registration": "Hajj pre registrations.",
  "login-history": "Who signed in, when and from where.",
  "audit-trail": "Every create, change and void, and who did it.",
};

const FIRST: DirectorySection = {
  key: "balances",
  title: "Balances",
  entries: [
    {
      key: "party-ledger",
      label: "Ledgers",
      description: "Full statement of a client, vendor, agent or combined client.",
      href: "/reports/ledgers",
    },
    {
      key: "due-advance",
      label: "Due & Advance",
      description: "Who owes you, whom you owe, and advances held, on any date.",
      href: "/reports/due",
    },
  ],
};

const LAST: DirectorySection = {
  key: "accounting",
  title: "Accounting",
  entries: [
    {
      key: "trial-balance",
      label: "Trial Balance",
      description: "Debits and credits of every account on a date.",
      href: "/reports/accounting",
    },
    {
      key: "balance-sheet",
      label: "Balance Sheet",
      description: "Assets, liabilities and equity on a date.",
      href: "/reports/accounting?report=balance-sheet",
    },
    {
      key: "void-list",
      label: "Void List",
      description: "Every voided document and why it was voided.",
      href: "/reports/voidlist",
    },
  ],
};

export function reportDirectory(permissions: PermissionMap): DirectorySection[] {
  const groups: DirectorySection[] = REPORT_GROUPS.map((g) => ({
    key: g.key,
    title: g.title,
    entries: g.reports.map((r) => ({
      key: r.key,
      label: r.label,
      description: r.description ?? WHAT_IT_SHOWS[r.key] ?? "",
      href: `${g.path}?report=${r.key}`,
    })),
  }));
  return [FIRST, ...groups, LAST]
    .map((s) => ({ ...s, entries: s.entries.filter((e) => canRunReport(permissions, e.key)) }))
    .filter((s) => s.entries.length > 0);
}
