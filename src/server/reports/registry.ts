// Report registry: one entry per report, used by the report pages and by the
// PDF / Excel export route.
import type { ReportParams } from "@/lib/reports/params";
import type { ReportResult } from "@/lib/reports/types";
import type { ServiceContext } from "@/server/services/context";
import { dueAdvanceReport, partyLedgerReport } from "./partyReports";
import { salesReport } from "./salesReport";
import { balanceSheet, profitAndLoss, trialBalance } from "./statements";
import { voidListReport } from "./voidList";
import { aitReport, clientAit, gdsReport, taxReport, ticketDetails } from "./airReports";
import {
  accountsSummary,
  auditTrail,
  clientDiscount,
  countryWise,
  dailySummary,
  journeyDate,
  loanReport,
  loginHistory,
  monthlySummary,
  payrollSummary,
  refundReport,
  tourPackage,
  transactionCharges,
  vendorPayments,
  vendorPurchases,
} from "./otherReports";
import {
  passengersClient,
  passengersGroup,
  passportList,
  passportStatus,
  preRegistration,
} from "./peopleReports";
import { expenseHeads, groupProfit, salaries, ticketProfit, visaProfit } from "./profitExpense";
import {
  airlineSales,
  dailySalesPurchase,
  purchasePayment,
  salesCollection,
  salesEarning,
  salesmanClientDue,
  salesmanCollection,
  salesmanProduct,
} from "./salesGroup";

export type ReportRunner = (
  ctx: ServiceContext,
  p: ReportParams,
  all?: boolean,
) => Promise<ReportResult>;

export const REPORTS = {
  "party-ledger": partyLedgerReport,
  "due-advance": dueAdvanceReport,
  sales: salesReport,
  "profit-loss": profitAndLoss,
  "trial-balance": trialBalance,
  "balance-sheet": balanceSheet,
  "void-list": voidListReport,
  "sales-earning": salesEarning,
  "airline-sales": airlineSales,
  "salesman-product": salesmanProduct,
  "sales-collection": salesCollection,
  "purchase-payment": purchasePayment,
  "salesman-collection": salesmanCollection,
  "daily-sales-purchase": dailySalesPurchase,
  "salesman-client-due": salesmanClientDue,
  "visa-profit": visaProfit,
  "group-profit": groupProfit,
  "ticket-profit": ticketProfit,
  "expense-heads": expenseHeads,
  salaries,
  "passport-status": passportStatus,
  "passport-list": passportList,
  "passengers-client": passengersClient,
  "passengers-group": passengersGroup,
  "ticket-details": ticketDetails,
  "tax-report": taxReport,
  "ait-report": aitReport,
  "client-ait": clientAit,
  "gds-report": gdsReport,
  "daily-summary": dailySummary,
  "monthly-summary": monthlySummary,
  "accounts-summary": accountsSummary,
  "client-discount": clientDiscount,
  "vendor-payments": vendorPayments,
  "vendor-purchases": vendorPurchases,
  "tour-package": tourPackage,
  "journey-date": journeyDate,
  "country-wise": countryWise,
  "payroll-summary": payrollSummary,
  "loan-report": loanReport,
  "transaction-charge": transactionCharges,
  "refund-report": refundReport,
  "pre-registration": preRegistration,
  "login-history": loginHistory,
  "audit-trail": auditTrail,
} satisfies Record<string, ReportRunner>;

export type ReportKey = keyof typeof REPORTS;

export function isReportKey(k: string): k is ReportKey {
  return k in REPORTS;
}
