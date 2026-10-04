// Sidebar module map (PLAN.md section 4). Plain data so it can be shared by
// server components (permission filtering, placeholders) and the client shell.
import type { ModuleKey } from "./permissions";

export type NavIcon =
  | "dashboard"
  | "ticket"
  | "file"
  | "swap"
  | "visa"
  | "tour"
  | "hajj"
  | "team"
  | "umrah"
  | "refund"
  | "receipt"
  | "bank"
  | "cheque"
  | "payroll"
  | "expense"
  | "loan"
  | "client"
  | "vendor"
  | "agent"
  | "quote"
  | "passport"
  | "report"
  | "settings"
  | "feedback";

export interface NavLeaf {
  label: string;
  href: string;
  /** Build phase for this page when it differs from its module's. */
  phase?: number;
}

export interface NavModule {
  module: ModuleKey;
  label: string;
  icon: NavIcon;
  /** Build phase (PLAN.md section 11) that delivers this module. */
  phase: number;
  href?: string;
  children?: NavLeaf[];
}

const newView = (base: string, noun = "Invoice"): NavLeaf[] => [
  { label: `New ${noun}`, href: `${base}/new` },
  { label: `View ${noun}s`, href: base },
];

const createHistory = (label: string, base: string): NavLeaf[] => [
  { label: `${label}: Create`, href: `${base}/new` },
  { label: `${label}: History`, href: base },
];

export const NAV: NavModule[] = [
  { module: "dashboard", label: "Dashboard", icon: "dashboard", phase: 5, href: "/dashboard" },
  {
    module: "invoice_air",
    label: "Invoice (Air Ticket)",
    icon: "ticket",
    phase: 4,
    children: newView("/invoices/airticket"),
  },
  {
    module: "invoice_noncommission",
    label: "Invoice (Non Commission)",
    icon: "file",
    phase: 6,
    children: newView("/invoices/noncommission"),
  },
  {
    module: "reissue",
    label: "Reissue (Air Ticket)",
    icon: "swap",
    phase: 7,
    children: newView("/invoices/reissue", "Reissue"),
  },
  {
    module: "invoice_other",
    label: "Invoice (Other)",
    icon: "file",
    phase: 6,
    children: newView("/invoices/other"),
  },
  {
    module: "invoice_otherpackage",
    label: "Invoice (Other Package)",
    icon: "file",
    phase: 6,
    children: newView("/invoices/otherpackage"),
  },
  {
    module: "invoice_visa",
    label: "Invoice (Visa)",
    icon: "visa",
    phase: 6,
    children: [
      ...newView("/invoices/visa"),
      { label: "Visa Process", href: "/invoices/visa/process", phase: 6 },
    ],
  },
  {
    module: "invoice_tour",
    label: "Invoice (Tour Package)",
    icon: "tour",
    phase: 6,
    children: newView("/invoices/tour"),
  },
  {
    module: "hajj",
    label: "Hajj",
    icon: "hajj",
    phase: 8,
    children: [
      { label: "Pre Registration Invoice", href: "/hajj/preregistration" },
      { label: "Hajj Invoice", href: "/hajj/invoices" },
      { label: "Hajj Registration", href: "/hajj/registration" },
    ],
  },
  {
    module: "hajji_management",
    label: "Hajji Management",
    icon: "team",
    phase: 8,
    children: [
      { label: "Moallem Transfer", href: "/hajj/management/moallemtransfer" },
      { label: "Moallem Transfer List", href: "/hajj/management/moallemtransfers" },
      { label: "Group Transfer", href: "/hajj/management/grouptransfer" },
      { label: "Group Transfer List", href: "/hajj/management/grouptransfers" },
      { label: "Transfer In", href: "/hajj/management/transferin" },
      { label: "Transfer Out", href: "/hajj/management/transferout" },
      { label: "Cancel Pre Registration", href: "/hajj/management/cancelpreregistration" },
      { label: "Cancel Registration", href: "/hajj/management/cancelregistration" },
    ],
  },
  {
    module: "invoice_umrah",
    label: "Invoice (Umrah)",
    icon: "umrah",
    phase: 6,
    children: newView("/invoices/umrah"),
  },
  {
    module: "refund",
    label: "Refund",
    icon: "refund",
    phase: 7,
    children: [
      ...createHistory("Air Ticket", "/refunds/airticket"),
      ...createHistory("Others", "/refunds/other"),
      ...createHistory("Tour Package", "/refunds/tour"),
      ...createHistory("Partial", "/refunds/partial"),
      ...createHistory("Other Package & Hajj", "/refunds/otherpackagehajj"),
    ],
  },
  {
    module: "money_receipt",
    label: "Money Receipt",
    icon: "receipt",
    phase: 4,
    children: [
      { label: "Invoice Money Receipt", href: "/moneyreceipts" },
      { label: "Advance Return", href: "/moneyreceipts/advancereturn" },
    ],
  },
  {
    module: "accounts",
    label: "Accounts",
    icon: "bank",
    phase: 3,
    children: [
      { label: "Bill Adjustment", href: "/accounts/billadjustment", phase: 9 },
      { label: "Accounts List", href: "/accounts" },
      { label: "Transaction History", href: "/accounts/transactions" },
      { label: "Balance Status", href: "/accounts/balancestatus" },
      { label: "Balance Transfer", href: "/accounts/balancetransfer" },
      { label: "Non Invoice Income", href: "/accounts/noninvoiceincome", phase: 9 },
      { label: "Investments", href: "/accounts/investments", phase: 9 },
      { label: "Incentive Income", href: "/accounts/incentiveincome", phase: 9 },
    ],
  },
  { module: "cheques", label: "Cheque Management", icon: "cheque", phase: 9, href: "/cheques" },
  {
    module: "payroll",
    label: "Payroll",
    icon: "payroll",
    phase: 9,
    children: [
      { label: "Payroll", href: "/payroll" },
      { label: "Employee Advance", href: "/payroll/advances" },
    ],
  },
  {
    module: "expense",
    label: "Expense",
    icon: "expense",
    phase: 9,
    children: [
      { label: "Expense Heads", href: "/expenses/heads" },
      { label: "Add Expense", href: "/expenses/new" },
      { label: "Expense History", href: "/expenses" },
    ],
  },
  {
    module: "loan",
    label: "Loan & Investments",
    icon: "loan",
    phase: 9,
    children: [
      { label: "Authority", href: "/loans/authorities" },
      { label: "Loan Information", href: "/loans" },
      { label: "Received Investment", href: "/loans/investments" },
      { label: "Payments", href: "/loans/payments" },
    ],
  },
  {
    module: "clients",
    label: "Clients",
    icon: "client",
    phase: 2,
    children: [
      { label: "Clients", href: "/clients" },
      { label: "Combined Clients", href: "/clients/combined" },
    ],
  },
  {
    module: "vendors",
    label: "Vendors",
    icon: "vendor",
    phase: 2,
    children: [
      { label: "Vendors", href: "/vendors" },
      { label: "Vendor Payment", href: "/vendors/payments", phase: 4 },
      { label: "Advance Return", href: "/vendors/advancereturn", phase: 4 },
    ],
  },
  {
    module: "agents",
    label: "Agents",
    icon: "agent",
    phase: 2,
    children: [
      { label: "Agent Profiles", href: "/agents" },
      { label: "Agent Payment", href: "/agents/payments", phase: 9 },
    ],
  },
  {
    module: "quotation",
    label: "Quotation",
    icon: "quote",
    phase: 10,
    children: newView("/quotations", "Quotation"),
  },
  {
    module: "passport",
    label: "Passport Management",
    icon: "passport",
    phase: 10,
    children: [
      { label: "Add Passport", href: "/passports/new" },
      { label: "Passport List", href: "/passports" },
    ],
  },
  {
    module: "reports",
    label: "Reports",
    icon: "report",
    phase: 5,
    children: [
      { label: "Ledgers", href: "/reports/ledgers" },
      { label: "Due & Advance", href: "/reports/due" },
      { label: "Sales", href: "/reports/sales" },
      { label: "Profit & Loss", href: "/reports/profitloss" },
      { label: "Expense", href: "/reports/expense", phase: 11 },
      { label: "Passport", href: "/reports/passport", phase: 11 },
      { label: "Passenger Lists", href: "/reports/passengers", phase: 11 },
      { label: "Air Ticket", href: "/reports/airticket", phase: 11 },
      { label: "Void List", href: "/reports/voidlist" },
      { label: "Other Reports", href: "/reports/other", phase: 11 },
      { label: "Trial Balance & Balance Sheet", href: "/reports/accounting" },
    ],
  },
  {
    module: "configuration",
    label: "Configuration",
    icon: "settings",
    phase: 1,
    children: [
      { label: "App Config", href: "/settings/app" },
      { label: "Agency Profile", href: "/settings/profile" },
      { label: "Users", href: "/settings/users" },
      { label: "Roles", href: "/settings/roles" },
      { label: "Employees", href: "/settings/employees" },
      { label: "Departments", href: "/settings/departments" },
      { label: "Designations", href: "/settings/designations" },
      { label: "Client Categories", href: "/settings/clientcategories" },
      { label: "Companies", href: "/settings/companies" },
      { label: "Countries", href: "/settings/countries" },
      { label: "Airports", href: "/settings/airports" },
      { label: "Airlines", href: "/settings/airlines" },
      { label: "Products", href: "/settings/products" },
      { label: "Visa Types", href: "/settings/visatypes" },
      { label: "Room Types", href: "/settings/roomtypes" },
      { label: "Transport Types", href: "/settings/transporttypes" },
      { label: "Tour Itinerary", href: "/settings/tour" },
      { label: "Passport Status", href: "/settings/passportstatus" },
      { label: "Groups", href: "/settings/groups" },
      { label: "Maharam", href: "/settings/maharam" },
      { label: "SMS", href: "/settings/sms", phase: 12 },
      { label: "Database Backup", href: "/settings/backup" },
    ],
  },
  { module: "feedback", label: "Feedback", icon: "feedback", phase: 12, href: "/feedback" },
];

export interface NavMatch {
  module: NavModule;
  leaf: NavLeaf;
}

/** Build phase that delivers a nav entry's page. */
export function entryPhase(entry: NavMatch): number {
  return entry.leaf.phase ?? entry.module.phase;
}

/** Flattens the nav into clickable entries (used by search and route lookup). */
export function navEntries(nav: NavModule[] = NAV): NavMatch[] {
  return nav.flatMap((m) => {
    if (m.children) return m.children.map((leaf) => ({ module: m, leaf }));
    return m.href ? [{ module: m, leaf: { label: m.label, href: m.href } }] : [];
  });
}

/** Finds the nav entry whose href exactly matches `pathname`. */
export function findNavEntry(pathname: string, nav: NavModule[] = NAV): NavMatch | undefined {
  const clean = pathname.replace(/\/+$/, "") || "/";
  return navEntries(nav).find((e) => e.leaf.href === clean);
}

/** The module that owns `pathname`, by longest href prefix. */
export function findModuleForPath(pathname: string, nav: NavModule[] = NAV): NavModule | undefined {
  let best: { module: NavModule; len: number } | undefined;
  for (const { module, leaf } of navEntries(nav)) {
    if (pathname === leaf.href || pathname.startsWith(`${leaf.href}/`)) {
      if (!best || leaf.href.length > best.len) best = { module, len: leaf.href.length };
    }
  }
  return best?.module;
}
