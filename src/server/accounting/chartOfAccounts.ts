// System chart of accounts seeded into every agency (PLAN.md 2.2). Services
// find accounts by systemKey, never by code or name, so agencies may rename
// them freely.
import type { LedgerType, Prisma } from "@prisma/client";

export const SYSTEM_ACCOUNTS = [
  // Assets. Money accounts get their own ledgers under 1100.
  { key: "AR", code: "1200", name: "Accounts Receivable", type: "ASSET" },
  { key: "CHEQUES_IN_HAND", code: "1210", name: "Cheques in Hand", type: "ASSET" },
  { key: "AIT_RECEIVABLE", code: "1220", name: "AIT Receivable", type: "ASSET" },
  { key: "EMPLOYEE_ADVANCE", code: "1300", name: "Employee Advances", type: "ASSET" },
  { key: "LOANS_GIVEN", code: "1400", name: "Loans Given", type: "ASSET" },
  { key: "INVESTMENTS", code: "1500", name: "Investments", type: "ASSET" },
  // Liabilities.
  { key: "AP", code: "2100", name: "Accounts Payable", type: "LIABILITY" },
  { key: "AGENT_PAYABLE", code: "2110", name: "Agent Commission Payable", type: "LIABILITY" },
  {
    key: "CHEQUES_ISSUED",
    code: "2120",
    name: "Cheques Issued (not cleared)",
    type: "LIABILITY",
  },
  { key: "AIT_PAYABLE", code: "2200", name: "AIT Payable", type: "LIABILITY" },
  { key: "VAT_PAYABLE", code: "2210", name: "VAT Payable", type: "LIABILITY" },
  { key: "SALARIES_PAYABLE", code: "2300", name: "Salaries Payable", type: "LIABILITY" },
  { key: "LOANS_TAKEN", code: "2400", name: "Loans Taken", type: "LIABILITY" },
  { key: "RECEIVED_INVESTMENT", code: "2500", name: "Received Investments", type: "LIABILITY" },
  // Equity.
  { key: "CAPITAL", code: "3100", name: "Owner's Capital", type: "EQUITY" },
  { key: "OPENING_EQUITY", code: "3200", name: "Opening Balance Equity", type: "EQUITY" },
  { key: "RETAINED_EARNINGS", code: "3300", name: "Retained Earnings", type: "EQUITY" },
  // Income.
  { key: "SALES_AIR", code: "4100", name: "Sales - Air Ticket", type: "INCOME" },
  {
    key: "SALES_NON_COMMISSION",
    code: "4110",
    name: "Sales - Non Commission Ticket",
    type: "INCOME",
  },
  { key: "SALES_REISSUE", code: "4120", name: "Sales - Reissue", type: "INCOME" },
  { key: "SALES_OTHER", code: "4130", name: "Sales - Other Services", type: "INCOME" },
  { key: "SALES_OTHER_PACKAGE", code: "4140", name: "Sales - Other Package", type: "INCOME" },
  { key: "SALES_VISA", code: "4150", name: "Sales - Visa", type: "INCOME" },
  { key: "SALES_TOUR", code: "4160", name: "Sales - Tour Package", type: "INCOME" },
  { key: "SALES_HAJJ", code: "4170", name: "Sales - Hajj", type: "INCOME" },
  { key: "SALES_UMRAH", code: "4180", name: "Sales - Umrah", type: "INCOME" },
  { key: "SERVICE_CHARGE_INCOME", code: "4300", name: "Service Charge Income", type: "INCOME" },
  { key: "COMMISSION_INCOME", code: "4310", name: "Commission Income", type: "INCOME" },
  { key: "REFUND_CHARGE_INCOME", code: "4400", name: "Refund Charge Income", type: "INCOME" },
  { key: "INCENTIVE_INCOME", code: "4500", name: "Incentive Income", type: "INCOME" },
  { key: "NON_INVOICE_INCOME", code: "4600", name: "Non Invoice Income", type: "INCOME" },
  { key: "INTEREST_INCOME", code: "4700", name: "Interest Income", type: "INCOME" },
  // Expenses.
  { key: "COGS_AIR", code: "5100", name: "Cost of Sales - Air Ticket", type: "EXPENSE" },
  {
    key: "COGS_NON_COMMISSION",
    code: "5110",
    name: "Cost of Sales - Non Commission Ticket",
    type: "EXPENSE",
  },
  { key: "COGS_REISSUE", code: "5120", name: "Cost of Sales - Reissue", type: "EXPENSE" },
  { key: "COGS_OTHER", code: "5130", name: "Cost of Sales - Other Services", type: "EXPENSE" },
  {
    key: "COGS_OTHER_PACKAGE",
    code: "5140",
    name: "Cost of Sales - Other Package",
    type: "EXPENSE",
  },
  { key: "COGS_VISA", code: "5150", name: "Cost of Sales - Visa", type: "EXPENSE" },
  { key: "COGS_TOUR", code: "5160", name: "Cost of Sales - Tour Package", type: "EXPENSE" },
  { key: "COGS_HAJJ", code: "5170", name: "Cost of Sales - Hajj", type: "EXPENSE" },
  { key: "COGS_UMRAH", code: "5180", name: "Cost of Sales - Umrah", type: "EXPENSE" },
  { key: "DISCOUNT_GIVEN", code: "5300", name: "Discount Given", type: "EXPENSE" },
  { key: "AGENT_COMMISSION", code: "5310", name: "Agent Commission", type: "EXPENSE" },
  { key: "REFUND_CHARGE_EXPENSE", code: "5320", name: "Vendor Refund Charges", type: "EXPENSE" },
  { key: "BILL_ADJUSTMENT", code: "5330", name: "Bill Adjustments", type: "EXPENSE" },
  { key: "TRANSACTION_CHARGE", code: "5400", name: "Transaction Charges", type: "EXPENSE" },
  { key: "SALARIES", code: "5500", name: "Salaries", type: "EXPENSE" },
  { key: "OFFICE_EXPENSE", code: "5600", name: "Office Expenses", type: "EXPENSE" },
  { key: "INTEREST_EXPENSE", code: "5700", name: "Interest Expense", type: "EXPENSE" },
] as const satisfies readonly { key: string; code: string; name: string; type: LedgerType }[];

export type SystemAccountKey = (typeof SYSTEM_ACCOUNTS)[number]["key"];

/** First code for money account ledgers; each new one takes the next free code up to 1199. */
export const MONEY_LEDGER_CODE_START = 1101;
export const MONEY_LEDGER_CODE_END = 1199;

/** Codes for expense head ledgers (under Office Expenses). */
export const EXPENSE_HEAD_CODE_START = 5601;
export const EXPENSE_HEAD_CODE_END = 5699;

/** Creates any missing system accounts for an agency (idempotent). */
export async function ensureChartOfAccounts(tx: Prisma.TransactionClient, agencyId: string) {
  await tx.ledgerAccount.createMany({
    data: SYSTEM_ACCOUNTS.map((a) => ({
      agencyId,
      code: a.code,
      name: a.name,
      type: a.type,
      systemKey: a.key,
      isSystem: true,
    })),
    skipDuplicates: true,
  });
}
