# Changelog

## Phase 0: Project setup (2026-09-27)

- Next.js 15 (App Router, TypeScript strict), Ant Design 5 (`@ant-design/nextjs-registry` pinned to 1.2.x, the last line on cssinjs v1 which antd 5 needs), React 19 compatibility patch.
- Prisma 6 + PostgreSQL. Initial models: `Agency` (with unique login `code`), `Role`, `User`, `LoginHistory`, `AuditLog`.
- Auth.js v5 credentials login (agency code + username + password, bcrypt). JWT session carries `userId`, `agencyId`, `roleId`. Role permissions are re-read from the DB on every request, so role changes apply without re-login. Deactivated users and suspended agencies are signed out.
- Login lockout: 5 consecutive failures within 15 minutes per agency + username (`src/server/services/auth/lockout.ts`). Every attempt is written to `LoginHistory`; successful logins also write an `AuditLog` row.
- RBAC primitives (`src/lib/permissions.ts`): module keys matching the sidebar, `can()`, and four default roles (Owner, Accountant, Sales Staff, Viewer).
- App shell: collapsible sidebar with all 26 modules (filtered by the user's `view` permission), header with menu search, notifications bell, Dhaka clock and user menu (profile, change password, sign out).
- Unbuilt pages render a placeholder naming their delivery phase (`src/app/(app)/[...slug]`); pages outside the user's role show a 403 card.
- Formatters: BDT money with lakh/crore grouping via decimal.js (no floats), dates in Asia/Dhaka.
- Tooling: ESLint (flat config, next + prettier), Prettier, Vitest, Playwright. `npm run check` runs lint, typecheck and unit tests.
- Seed: demo agency (code `demo`), default roles, users `admin` (Owner) and `viewer` (Viewer). Passwords are in `.env.example`.

Assumptions (PLAN.md section 14, to confirm):
- Built single agency first but fully multi-tenant ready (agency code at login).
- English UI first; next-intl will be wired when Bangla is scheduled.
- AIT rate/base and commission formula will be App Config values with placeholder defaults (Phase 1/4).
- Local dev uses native PostgreSQL 16; `docker-compose.yml` kept as an alternative.

Acceptance (verified): migration `init` applied on native PostgreSQL 16, seed loaded, `npm run check` green (24 unit tests), Playwright 5/5 (redirect when signed out, wrong password error, owner login + full sidebar + sign out, menu search, viewer login).

## Phase 1: Tenancy, users, RBAC, audit, configuration (2026-09-28)

- Tenant scoped Prisma client (`src/server/db/tenant.ts`): every model with `agencyId` is forced into the session's agency on reads, updates, deletes, creates and upserts; updates can never move a row to another agency. Services verify that referenced ids (roles, designations, cities, ...) belong to the tenant.
- Audit trail (`src/server/audit/audit.ts`): CREATE / UPDATE / ACTIVATE / DEACTIVATE / PASSWORD_RESET / PASSWORD_CHANGE / EXPORT rows with before/after JSON, written in the same transaction; secrets are stripped.
- Server action pattern: Zod validation → `requirePermission(module, action)` → service; `runAction` maps validation, business and unique-key errors to field errors for the forms.
- Configuration module: App Config (currency, fiscal year, AIT rate/base, commission base, document prefixes, invoice footer/terms, SMS switch), Agency Profile, Users (create, edit, reset password, activate/deactivate), Roles (permission matrix), Database Backup (tenant JSON export, passwords excluded), Change password.
- 24 configuration masters driven by one definition file (`src/lib/masters.ts`): client categories, countries, airports, airlines (with per-airline commission override), products, visa types, departments, designations, employees, room types, transport types, passport status, groups, maharam relations, companies, and the tour itinerary masters (tour groups, cities, places, accommodations, transports, other transports, guides, food, tour tickets). Server side paginated, searchable, deactivate instead of delete.
- Agency provisioning service (`provisionAgency`): new agency gets settings, default roles, owner user and starter reference data (40 airports, 28 airlines, 27 countries, products, visa types, etc.). The dev seed reuses it.
- Guards: the Owner role is locked to full access; users cannot deactivate themselves or change their own role.
- Shared UI: `DataTable` (URL driven pagination), `MoneyInput` (decimal strings, never floats), `PageHeader`.
- Tests: integration suite (`npm run test:int`, database `scaleb_insider_test`, schema applied with `prisma migrate deploy`, never wiped). `npm run check` now runs lint, typecheck, unit and integration tests. Playwright now runs against a production build in `.next-e2e` for stable timings.

Assumptions:
- Default AIT is 0.3% on total fare and commission is on base fare. These are placeholders; confirm the agency's rule (PLAN.md section 14 item 1).
- Logo is a URL field until file storage (S3/R2) is configured.
- "Agency" in the Configuration list is read as the agency's own profile.

Acceptance (verified): two agencies cannot see or change each other's data (`src/server/db/tenant.int.test.ts`, 14 tests); a Viewer cannot create, edit, deactivate, manage users/roles or change App Config, tested through the real server actions (`src/app/(app)/settings/actions.int.test.ts`) and in the UI (`e2e/settings.spec.ts`). `npm run check` green (44 unit + 19 integration), Playwright 7/7.

## Phase 2: Parties (2026-09-28)

- Models: `Client` (individual/corporate, category, company, walk-in flag, credit limit), `CombinedClient`, `Vendor` (type, contact person, bank details, default commission), `Agent` (commission %), each with `openingBalance` + `openingBalanceType` and a cached signed `balance` (positive = the party owes the agency).
- `DocumentSequence` + `nextSequence()` (`src/server/services/numbering/sequence.ts`): per agency counters incremented by one `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` inside the caller's transaction. Parties get codes CL-/CC-/VN-/AG-00001; the same helper will number documents (with year) from Phase 3.
- The generic list engine now covers parties as well as masters (`src/lib/parties.ts`, `src/lib/entities.ts`); each list is guarded by its own permission module (clients / vendors / agents / configuration). Server actions moved to `src/app/(app)/entityActions.ts`.
- Opening balance: the cached balance starts at the signed opening, and editing the opening moves it by the difference with an atomic increment (`openingDelta`). The opening journal entry is posted by the Phase 3 accounting engine.
- Pages: Clients, Combined Clients, Vendors, Agent Profiles lists (code, balance, search by name/code/phone/email) and profile pages with an Info tab plus Invoices / Receipts / Payments / Ledger / Passports tabs that show which phase fills them. Sidebar pages that share a parent path with a profile (e.g. `/vendors/payments`) still show their placeholder, which now names the page's own phase.
- `PartySelect` component: server side type-ahead picker for any party kind, ready for the invoice forms.
- Tour itinerary cost items now link their default vendor to a real `Vendor`.
- Seed adds demo clients, vendors, an agent and a combined client (created through the service).
- Tests: Playwright now uses its own database `scaleb_insider_e2e` (migrated and seeded before each run), so browser tests no longer write into the demo data.

Acceptance (verified): `npm run check` green (51 unit + 32 integration, including 25 concurrent creates with gap-free codes, opening balance math, cross-agency reads/links blocked, Sales Staff can create clients but not vendors, Viewer read-only). Playwright 10/10.

## Phase 3: Accounting engine (2026-09-28)

- Models: `LedgerAccount` (chart of accounts, `systemKey` for system accounts), `MoneyAccount` (cash / bank / mobile banking / card, each with its own asset ledger 1101-1199, account numbers stored masked), `JournalEntry` + `JournalLine` (party and money account tags), `AccountingPeriod` (closed months), `BalanceTransfer`.
- System chart of accounts (48 accounts: AR, AP, agent commission payable, AIT, VAT, loans, equity, sales and cost of sales per product, commission / refund charge / incentive / non-invoice income, discount, transaction charges, salaries, office expenses, ...) created for every agency with a default "Cash in Hand" account.
- Posting engine `src/server/accounting/post.ts`: `postEntry` validates (at least two lines, one positive side per line, max 2 decimals, debits = credits), refuses closed periods and any account or party outside the tenant, numbers the voucher (JV-YYYY-NNNNN), writes lines, and moves cached money-account and party balances by the same amounts with atomic increments. `reverseEntry` posts the mirror image (once only; reversals cannot be reversed); `reverseSource` / `repostSource` implement void and edit for documents. A guard test fails the build if any other file writes, updates or deletes journal rows.
- Opening balances are now real entries against Opening Balance Equity: parties (Client → AR, Vendor → AP, Agent → Agent Commission Payable, Combined → AR or AP) and money accounts. Editing an opening reverses and reposts it. Phase 2 parties are backfilled once by the seed (`backfillOpeningEntries`, idempotent).
- Ledger integrity check (`checkLedgerIntegrity`): totals, unbalanced entries, and cached vs derived balances for money accounts and all party kinds. Ready for a nightly job (Phase 12).
- Document numbers with configurable prefixes per year (`documentNumber`, adds JV and BT to App Config prefixes).
- Business dates: `@db.Date` columns, "YYYY-MM-DD" in Asia/Dhaka (`src/lib/dates.ts`).
- Pages: Accounts list (money accounts with live balances, add / edit / deactivate, chart of accounts tab with balances), Transaction History (filter by account, date range and type; running balance per account; server side paging), Balance Status (grouped by kind with totals), Balance Transfer (optional charge booked to Transaction Charges; cash and wallets cannot go negative; rows locked in a fixed order; void with reason). New shared `DateRangeFilter`.

Acceptance (verified): unit tests prove the double entry rules (debits = credits, exact decimals, reversal nets every account to zero); integration tests prove reversal restores money and party balances exactly, 30 concurrent postings get distinct gap-free numbers, closed periods and cross-agency accounts/parties are refused, opening balances post / repost / clear correctly, transfers and voids move balances correctly, and the golden rule holds (debits = credits, cached = derived). `npm run check` green (65 unit + 48 integration), Playwright 12/12. The demo database passes the integrity check.

Not yet: a UI to close / reopen accounting periods (the engine already enforces closed periods) and the nightly drift job; both are small and will come with Phase 5 reports or Phase 12.

## Phase 4: Air ticket invoice, money receipt, vendor payment (2026-09-28)

- Pricing rule (user: "use any normal rule"), all in `calcAirTicket()` (`src/lib/calc/airTicket.ts`), shared by the form preview and the server: total fare = base + taxes; commission = commission % of base fare (airline override, else App Config); AIT = 0.3% of total fare (App Config); purchase price = total fare - commission + AIT; profit = client price - purchase price. AIT is part of the ticket cost. Invoice totals in `calcInvoiceTotals()`: net = subtotal - discount + service charge + VAT; profit = net - VAT - cost - agent commission.
- Models: `Invoice` (shared header for every invoice type), `InvoiceAirTicket`, `MoneyReceipt` + `MoneyReceiptAllocation`, `VendorPayment`, `AdvanceReturn`.
- Air ticket invoice: many tickets per invoice, each with its own vendor, airline, route, dates, tax breakdown and commission; duplicate ticket numbers blocked across live invoices; save as draft or post; editing a posted invoice reverses and reposts (total cannot drop below what was received); void with reason (only after its receipts are voided). Posting: Dr AR (client) / Cr Sales-Air, Dr Discount, Cr Service Charge, Cr VAT, Dr Cost of Sales / Cr AP per vendor, Dr Agent Commission / Cr Agent Payable.
- Money receipt: allocated to the client's due invoices oldest first (editable per invoice), leftover kept as advance; invoice status Unpaid / Partly paid / Paid follows allocations; transaction charge booked to Transaction Charges; due invoices row-locked while allocating; void puts invoices back to due.
- Vendor payment (on account) with optional charge; client advance return and vendor advance return, each limited to the available advance; cash and wallets cannot go negative.
- PDFs (`@react-pdf/renderer`): invoice (client prices only; totals, amount in words, terms, footer, DRAFT/VOID stamp) and money receipt.
- Amount in words in the South Asian system (lakh / crore) with paisa.
- Profile tabs are live: client Ledger / Invoices / Money receipts, vendor Ledger / Purchases / Payments, agent Ledger / Referred invoices, combined client Ledger. Party ledger has opening, running and closing balance with links to the source documents. Profile headers have "New invoice", "Receive money" and "Pay vendor" shortcuts.
- Pages: Air ticket invoice list (search by invoice, client, ticket no., PNR or passenger; date and status filters; totals), new / edit / view; Money receipts list / new / view; Client advance return; Vendor payments; Vendor advance return.
- New App Config number series: ADV (advance return). Shared UI: `StatusTag`, `VoidButton`, `Notice`, `PaymentFormCard`.

Acceptance (verified): integration test creates an invoice (2 tickets, discount, service charge), receives a partial payment and pays the vendor; client ledger 75,000 Dr → 45,000 Dr, vendor ledger 71,025 Cr → 21,025 Cr and the P&L accounts match the hand calculation exactly; edit / void / draft / overpayment / advance return cases and the golden rule also pass. Playwright drives the same flow through the UI, including both PDFs. `npm run check` green (87 unit + 58 integration), Playwright 13/13. The demo database passes the integrity check.

Not in this phase: cheque receipts (Cheque Management, Phase 9), invoices for combined clients (Phase 6), applying an existing client advance to a new invoice automatically, and allocating vendor payments to individual tickets.

## Phase 5: Dashboard and core reports (2026-09-27)

- Dashboard: sales, collection and discount for today / this month / this fiscal year (fiscal year from App Config); total receivable, payable and client advances held; monthly sales / purchase / collection / profit chart for the fiscal year (Recharts); flights in the next 7 days; money account balances; best clients and salespeople (month / year); operating expense breakdown; ledger health warning for users who manage accounts. All figures are SQL aggregates.
- Report engine: one `ReportResult` shape (`src/lib/reports/types.ts`) rendered on screen by `ReportShell` (filters, summary, table, totals, paging) and exported by `/api/reports/<key>?format=pdf|xlsx` (react-pdf / exceljs). Exports need the Reports "export" permission and are audited.
- Reports: Party Ledger (clients, vendors, agents, combined; opening / running / closing), Due & Advance (as of a date; due only / advance only), Sales Report (period, client, salesman, airline filters; sales, cost, profit, received, due), Profit & Loss (defaults to fiscal year to date), Trial Balance and Balance Sheet (as of a date, with a balanced / not balanced check).
- Accounting periods: "Closed months" tab on Accounts to close / reopen past months (the posting engine already refuses closed dates).
- Nightly ledger check: `/api/cron/ledger-check` (Bearer `CRON_SECRET`) checks every agency and writes a `LEDGER_DRIFT` audit entry on any mismatch.
- Fixes found while building:
  - Raw SQL date filters sent JS Dates, which PostgreSQL compared in the server's time zone (UTC+6), dropping the first day of a range. All raw queries now use `sqlDate()` (`::date` literals); regression test added.
  - Postings serialise on the per-agency voucher counter, so under concurrent use a transaction could exceed Prisma's 5 s default and fail. Interactive transactions now allow 10 s to start and 20 s to finish.
  - Login reported every Auth.js failure as a wrong password; it now distinguishes, logs the real error, and does a full page load after signing in.
  - Money account pickers are searchable (long account lists).
- Tests: e2e helpers (`e2e/helpers.ts`) wait for hydration before interacting; the suite runs files in parallel as a concurrency check.

Acceptance (verified): reports match a hand calculation (net profit 3,825; balance sheet 1,24,850 = 1,24,850; trial balance balanced; due / advance and sales totals; ledger with opening row); dashboard figures match; `npm run check` green (89 unit + 66 integration); Playwright 17/17, twice in a row. The demo database passes the integrity check.

## Phase 6: Remaining invoice types (2026-09-27)

- Models: `InvoiceItem` (generic priced line: kind, qty, unit price, unit cost, vendor, optional passenger / passport / room type / group / product / itinerary source / service date) and `InvoiceVisaLine` (passenger, passport, country, visa type, vendor, price, cost, status with history, expected and delivery dates). `Invoice` gains tour group, group, travel date and return date.
- Shared save flow (`invoiceSave.ts`): every invoice type uses one create / update path (header checks, totals, numbering, draft or post, reverse and repost on edit, audit); each type only prepares its lines. `voidInvoice` now checks the invoice type, so one module's permission cannot void another module's invoice.
- Invoice types:
  - Non commission ticket: same ticket form, but the purchase price is entered directly (no commission or AIT); base fare optional.
  - Other services and Other package: item lines (qty × unit price, qty × unit cost); a line with a cost needs a vendor; a cost-only line is allowed (internal cost, not printed).
  - Tour package: item lines plus "Add a cost from the itinerary" (tour settings: accommodation, transport, guides, food, places, tickets) with tour group and travel dates.
  - Umrah: one line per pilgrim (name, passport, room type, package price, cost, vendor).
  - Visa: one line per passenger; status Pending → Submitted → Approved / Rejected → Delivered, with a timestamped history; editing the invoice keeps each visa's status.
- Visa Process board (`/invoices/visa/process`): columns per status with counts, search, days in current status, late expected dates flagged, one-click status buttons; delivered visas stay for 30 days.
- Every invoice type has list (server side paging, search, status filter, totals), new, view and edit pages built from shared renderers (`src/app/(app)/invoices/routes.tsx`) and shared components (`InvoiceShell`, `InvoiceHeaderCard`, `InvoiceTotalsCard`, `InvoiceList`).
- PDF: one invoice layout for every type (`invoiceDocument.ts` maps tickets, item lines and visa lines to a common printable shape); the PDF route checks the permission of the invoice's own module. Client prices only.
- Vendor Purchases tab now lists tickets, item lines and visa lines.
- UI: dense line rows hide the "(optional)" label hint; the e2e `choose` helper finds selects by accessible name.

Acceptance (verified): integration tests cover each type's posting (sales, cost per vendor, profit), validation (cost without vendor, empty lines), tour and umrah lines, visa status flow / edit keeps status / board / void, and the golden rule. Playwright creates an Other services invoice (profit preview, number, PDF, list separation) and a Visa invoice moved Pending → Delivered on the board. `npm run check` green (94 unit + 73 integration), Playwright 19/19. Demo and e2e databases pass the integrity check.

Not in this phase: invoices for combined clients (need a combined-client AR design; moved to Phase 7 with refunds), Hajj invoices (Phase 8), itinerary price lists per date.

## Phase 7: Reissue, refunds, void list (2026-09-27)

- Reissue (PLAN 6.3): new `InvoiceReissueLine`. Each line picks one of the client's posted air / non commission tickets (refunded ones excluded), with new ticket no., PNR, vendor, new journey / return date, airline penalty, fare difference and service charge. Client price = penalty + fare difference + service charge; vendor cost = penalty + fare difference; profit = service charge (`calcReissueLine`). Posts only the change to Sales - Reissue / Cost of Sales - Reissue / vendor payable. Numbered RIS-, list / new / view / edit / PDF like every invoice. The dashboard's upcoming flights use the reissued date.
- Refunds (PLAN 6.7): new `Refund` + `RefundLine` (numbered RF-). Types follow the sidebar: Air Ticket (air, non commission, reissue), Others (other, visa), Tour Package, Other Package & Hajj (other package, umrah, hajj) refund whole lines; Partial refunds part of any line.
  - Inputs: lines, client refund charge, vendor charge per line, and how the client gets the money: kept as credit on the account, or paid back now from a money account (limited to the client's credit after the refund, so unpaid invoices cannot be paid out; cash and wallets cannot go negative).
  - Posting (`src/server/accounting/refundPosting.ts`): Dr Sales / Cr client AR (amount refunded), Dr client AR / Cr Refund Charge Income (client charge), Dr vendor AP / Cr Cost of Sales (cost taken back), Dr Vendor Refund Charges / Cr vendor AP (vendor charge), and for cash back Dr client AR / Cr money account.
  - The invoice keeps its figures and gains `refundCredit` / `refundCost`; due = net total - refund credit - received. When every line is fully refunded the status becomes Refunded (a refund charge still owed on it can be collected by a money receipt). Invoices with live refunds cannot be edited or voided; void the refund first.
  - Void of a refund reverses its entry, returns cash to the account and restores the invoice.
  - Pages: Create and History per type (search, date range, totals), refund view with void; invoice pages get a Refund button and a Refunds card; the refund form previews credit to client, back from vendors and profit effect.
- Void List report (`/reports/voidlist`): every voided invoice, receipt, vendor payment, advance return, balance transfer and refund with when (Asia/Dhaka), who and why; PDF / Excel export like other reports.
- Refund-aware figures: invoice lists (Refunded total), Sales Report (Refunded column; cost and profit net of refunds; refunded invoices included), dashboard sales / chart / best clients.
- Tests: e2e URL checks after saving no longer match the `/new` page itself (they could pass before the save finished); save navigations allow 30 s because the suite runs files in parallel on one agency.

Acceptance (verified): unit tests for reissue pricing, refund totals and limits (full, partial, cash return, adjust), posting lines and type mapping; integration tests post a reissue and three refunds against hand calculations (client and vendor balances, cash, P&L accounts, invoice status Paid → Refunded → Paid after void), block edit / void of refunded invoices, show the voided refund on the Void List, net refunds in the Sales Report, and keep the golden rule. Playwright: ticket → reissue → refund with charges → void refund → void list. `npm run check` green (103 unit + 81 integration); Playwright 20/20 twice. Demo and e2e databases pass the integrity check.

Not in this phase: invoices for combined clients (still open; needs a decision on how their receivable and payable net), a printable refund voucher, reversing agent commission / VAT / discount on refunds (refunds work on line amounts only), and SMS on refund.

## Phase 8: Hajj (2026-09-30)

- Models: `Pilgrim` (paying client, Hajj year, passport, NID, tracking / pre registration / registration / voucher numbers, group, maharam relation and name, moallem, status), `PilgrimEvent` (history of every change), `HajjTransfer` + `HajjTransferLine` (numbered HTR-, keeps each pilgrim's previous value), `InvoiceItem.pilgrimId`. New App Config number series HTR.
- Pilgrim rules (`src/lib/hajj.ts`, unit tested): new pilgrims are pre registered; register only if not registered yet (pre registered, or transferred in without a registration number); cancel pre registration only before registration, cancel registration only after; moallem / group transfer and transfer out only for active pilgrims; nothing on cancelled or transferred out pilgrims. Tracking numbers are unique among pilgrims who are not cancelled.
- Pages:
  - Hajj Registration: pilgrims by stage (counts), search, stage / year / group filters, Add pilgrim, Register (registration no., date, voucher, tracking).
  - Pilgrim profile: details, invoices, history timeline; Edit, Register, Cancel; refund links once cancelled. Group and moallem change only through transfers so the history is kept.
  - Pre Registration Invoice and Hajj Invoice: one line per pilgrim record (once per invoice); name, passport and group come from the record; list / view / edit / PDF / refund like every invoice.
  - Hajji Management: Moallem Transfer + list, Group Transfer + list (filters by current group / moallem, add all shown), Transfer In (creates the arriving pilgrims), Transfer Out, Cancel Pre Registration, Cancel Registration. Cancelling shows the pilgrim's posted invoices with a Refund button (Other Package & Hajj refund), i.e. the refund wizard step.
- Transfer charge (optional, per pilgrim): Dr client AR / Cr Service Charge Income, per paying client. Void of a transfer puts every pilgrim back (only if nothing changed since), reverses the charge; voiding a transfer in cancels the pilgrims it created (they must not be on live invoices).
- Void List includes Hajj transfers. Ledger lines from refunds and Hajj transfer charges are now labelled; refund lines link to the refund (`/refunds/<id>` opens it under its type).
- Seed: a Hajj 2027 group, maharam relations and two demo pilgrims.
- Tests: two older integration tests (balance transfer history, balance sheet) depended on the day the suite ran, because opening balances are dated when created; they no longer do.

Acceptance (verified): unit tests for the pilgrim rules; integration tests cover pilgrims and duplicate tracking numbers, pre registration and Hajj invoices (sales / cost of sales, one line per pilgrim), registration rules, moallem and group transfers with charge and void, cancel with refund of the cancelled pilgrim's line, transfer in / out and void, and the golden rule. Playwright: pilgrim → pre registration invoice → register → moallem transfer → cancel registration → refund. `npm run check` green (107 unit + 88 integration); Playwright 21/21 twice. Demo and e2e databases pass the integrity check.

Not in this phase: pilgrim links for Umrah invoices (still free text), SMS to pilgrims, passport scans (Phase 10 passport management), invoices for combined clients (waiting for a decision).

## Phase 9: Expense, payroll, loans, cheques, other income (2026-09-30)

- Vouchers: one model and service (`Voucher`, `voucherService.ts`) for the simple two-sided documents, with posting rules as a pure, unit-tested function (`src/server/accounting/voucherPosting.ts`):
  - Expense (EXP): Dr the expense head's own ledger / Cr money. Heads (`ExpenseHead`) each get an expense ledger (codes 5601-5699), so the P&L shows spending per head. Bills can be attached (PDF / image, 2 MB, stored with the voucher).
  - Non Invoice Income (NII): Dr money / Cr Non Invoice Income.
  - Incentive Income (INC): from a vendor / airline, received in money or taken off what we owe them (Dr vendor AP).
  - Agent Payment (AGP): Dr Agent Commission Payable / Cr money, limited to what the agent is owed; agent profiles now show their commission payments.
  - Employee Advance (EAD): Dr Employee Advances (employee) / Cr money.
  - Bill Adjustment (BAJ): raise or lower a client's, combined client's, vendor's or agent's due, with a mandatory reason, against a new Bill Adjustments account; needs Accounts edit permission.
  - Investments (IVT / IVR): money invested and returns with any gain (Interest Income); a return cannot exceed what is still invested; an investment with returns cannot be voided.
- Payroll (PAY, `payrollService.ts`, `calcPayroll`): monthly salary per employee: basic + allowances - deductions = salary expense; advance adjusted (up to the outstanding advance) is recovered; the rest is paid from a money account. One payroll per employee per month. Payslip PDF.
- Loans (`loanService.ts`): Loan Authorities (bank / person / company, with a cached balance and their own party ledger); loans taken and given and investments received (LN), each with rate, term and an equal-installment schedule (`loanSchedule`, reducing balance); payments (LP) split into principal and interest (Interest Expense / Interest Income); a loan closes when the principal is repaid; loans with payments cannot be voided.
- Cheques (`chequeService.ts`): money receipts and vendor payments can be by cheque. A received cheque posts to Cheques in Hand, an issued one to a new Cheques Issued account; Cheque Management lists them by direction and status with Deposit, Clear (the money moves now; issued cheques check the balance) and Bounce (voids the receipt / payment, so the party owes or is owed again). A cleared cheque's document cannot be voided.
- New system accounts: Bill Adjustments (5330), Cheques Issued (2120). System accounts added in later versions are now created on first use. New number series: NII, INC, AGP, EAD, BAJ, IVT, IVR, LN, LP, PAY.
- Pages: Accounts (Bill Adjustment, Non Invoice Income, Investments, Incentive Income), Cheque Management, Payroll (Payroll, Employee Advance), Expense (Heads, Add Expense, History with head filter), Loan & Investments (Authority, Loan Information, Received Investment, Payments, loan detail with schedule), Agent Payment. Void List includes vouchers, loans, loan payments and payrolls; ledger lines from these documents are labelled and linked.
- Seed: common expense heads.

Acceptance (verified): unit tests for every voucher posting rule, payroll netting and advance limits, and the loan schedule (1,20,000 at 12% for 12 months = 10,661.85 a month, ending at zero). Integration tests: expense by head and void, overdraft guard, incentive both ways, agent payment limit, bill adjustment, employee advance recovered by payroll and restored on void, duplicate month refused, investment returns with gain, loans taken / given with interest and closing, cheques received (deposit, clear, bounce) and issued (clear), and the golden rule. Playwright: expense → history, receipt by cheque → cleared in Cheque Management, loan taken → schedule. `npm run check` green (117 unit + 99 integration); Playwright 22/22 twice. Demo and e2e databases pass the integrity check.

Not in this phase: bank charges on cheque clearing, post-dated cheque reminders, attachments on documents other than vouchers, payroll for many employees at once.

## Phase 10: Quotation, passport management (2026-09-30)

- Passports (`Passport`, `passportService.ts`): passport no. (unique per agency), name, client, gender, date of birth, nationality, place and date of issue, expiry, phone, status (Passport Status master) with a timestamped history, received by / returned to client dates, note, active flag. Scans (PDF / image, 2 MB each) are attached at creation or later; attachments are now shared by vouchers and passports (`attachmentService.ts`, `/api/attachments`), and downloads check the owning module's permission.
- Expiry rules (`src/lib/passport.ts`, unit tested): expired on or before today; warning within 6 months (many countries require 6 months of validity). Passport List filters by expiry, status, active and search; client profiles have a live Passports tab with "Add passport" for that client.
- Dashboard alerts (replacing the "coming up" note): passports expired / expiring (with the nearest ones), visas in process by status (linked to the Visa Process board), and cheques not cleared (received / issued, with amounts).
- Quotations (`Quotation` + `QuotationLine`, QT-): client, date, valid until, subject, lines (qty x price, optional internal cost and vendor), discount, note, terms (defaults to the invoice terms), and the invoice type it becomes (Other services, Other package, Tour package). Totals and margin via `calcQuotation` (unit tested). Status: Draft → Sent → Accepted / Rejected; open offers past their date show as Expired. Nothing is posted.
- Convert to invoice in one click: creates a draft invoice of the chosen type dated today, with the same lines, costs, vendors and discount, and opens it for review; the quotation is claimed first so two clicks cannot create two invoices; converting needs create permission on that invoice type. Converted quotations cannot be edited.
- Quotation PDF (client prices only) and a WhatsApp share link with the number, total and validity.
- Seed: two demo passports (one expiring within 6 months).

Acceptance (verified): unit tests for expiry states, month arithmetic and quotation totals; integration tests for passports (duplicate refused, status history, expiry filters, dashboard counts, scans and file-type check) and quotations (totals, expired display, status rules, nothing posted, conversion once to a draft invoice with the same figures, converted not editable). Playwright: passport with expiry warning; quotation → PDF → accepted → converted → draft invoice. `npm run check` green (121 unit + 102 integration); Playwright 23/23 twice. Demo and e2e databases pass the integrity check.

Not in this phase: expiry reminders by SMS (Phase 12), air ticket quotations converting to air ticket invoices, passports linked to invoice passengers.

## Phase 11: All remaining reports (2026-09-30)

- Report pages now hold groups of reports with a picker (`src/lib/reports/catalog.ts`, `renderReportGroup`): each report has its own filters and default period (this month, fiscal year to date, or none), and the same screen / Print-PDF / Excel output as before. New filters: vendor, group, user, Hajj year.
- New reports (38, all server side and paged where they list documents):
  - Sales: Sales & Earning (by invoice type), Airline wise Sales, Salesman & Product, Sales & Collection (per client, with balance now), Purchase & Payment (per vendor, from the vendor ledger), Salesman wise Collection (receipts allocated to their invoices), Daily Sales & Purchase, Salesman wise Client Due.
  - Profit & Loss: Visa wise, Group wise (tour groups and Hajj / Umrah groups), Ticket wise.
  - Expense: Office Expenses (by head, with share), Salaries.
  - Passport: Passport Status (with and expiry counts), Passport wise.
  - Passenger lists: Client wise (tickets, visas and pilgrim / package lines), Group wise Pilgrims.
  - Air ticket: Ticket Details, Tax Report (per tax code), AIT Report (per vendor), Client AIT, GDS Report.
  - Other: Daily and Monthly Summary (sales, cost, expenses, salaries, net, collected, paid, refunded), Accounts (opening / in / out / closing per money account), Client Discount, Vendor Payments, Vendor Purchases, Tour Packages, Journey Date wise (with the invoice's due), Country wise Visas, Payroll, Loans, Transaction Charges, Refunds, Pre Registration, User Login History and Audit Trail.
- Invoice based figures are net of refunds where the report is about sales or profit; ticket, visa and line reports show figures as issued (noted on the report).
- Login history and audit trail need Configuration view on top of Reports view (`canRunReport`), on screen and in exports.
- Fix: a totals label in a date or money column (e.g. "Total" under Date) crashed the report page and wrote invalid cells to Excel; labels are now shown as text on screen, in PDF and in Excel.
- Tests: e2e heading checks use exact names (the picker adds a "<group> reports" heading).

Acceptance (verified): every registered report runs on screen and for export and every cell formats (integration test over a hand-calculated invoice: Sales & Earning 75,000; airline fare 75,000 and client price 74,500; BD tax 15,000; AIT 225; daily summary and sales & collection 75,000 sold / 30,000 collected; client due 45,000; audit trail entries). Unit tests: catalog keys are unique and all registered, sensitive-report access, cell formatting of labels. Playwright: pick a report in a group, export Excel, open the audit trail. `npm run check` green (126 unit + 106 integration); Playwright 24/24 twice. Demo and e2e databases pass the integrity check.

## Phase 12: Notifications, SMS, super admin, search, security, deployment (2026-09-30)

- SMS (`SmsLog`, `src/server/sms/provider.ts`, `smsService.ts`): any HTTP gateway through `SMS_URL_TEMPLATE` (+ key, sender, method, success pattern); without one, messages are logged as "simulated". Bangladeshi numbers are normalised to 8801XXXXXXXXX and messages count their SMS parts (GSM / Unicode). Automatic messages only when SMS is on in App Config: visa approved / delivered to the client, passport expiry reminders (at most once per passport every 30 days). A failed send notifies the administrators. Page Configuration → SMS (`/settings/sms`): log with search and dates, counts, gateway status, "New SMS", "Passport reminders".
- In-app notifications (`Notification`, `notificationService.ts`): the header bell shows the unread count (refreshed every minute) and the latest notices; open one to go to its page, or mark all read. Sent to the users whose role can view the module concerned: visa approved / rejected, cheque bounced, SMS failed, new feedback, ledger mismatch (nightly check), passports expiring this month (Mondays). Read notices older than 60 days are removed.
- Daily job `/api/cron/daily` (passport reminders, Monday notice, pruning); cron routes share `cronAuthorised` (constant time comparison of `CRON_SECRET`).
- Global search in the header: pages from the menu plus records the user may view: invoices (number, ticket no., PNR, passenger, passport), clients and vendors (name, code, phone), money receipts, passports and pilgrims.
- Feedback page (`/feedback`): anyone with Feedback access sends a problem, idea or question; Configuration editors see all feedback, reply and close it; others see their own with the reply.
- Platform admin (`/admin`, users with `isSuperAdmin`, link in the user menu): all agencies with users / clients / invoices and last sign-in, create an agency with its owner, change plan (Starter / Standard / Premium), suspend / activate (never one's own), and "Open as owner" for support: a one-time 2 minute token (only its hash stored) signs in as the agency's owner, a banner names the admin on every page, and each action is audited in the agency concerned. The demo `admin` is a platform admin. Scripts: `scripts/create-agency.ts`, `scripts/make-superadmin.ts`.
- Tenant data export (Database Backup) already covers every tenant table, including the new ones.
- Performance: indexes for salesman invoices, airline ticket lookups, pilgrim invoice lines and investment vouchers.
- Security review (`SECURITY.md`): security headers (frame deny, nosniff, referrer policy, permissions policy, COOP, HSTS in production, no X-Powered-By); a unit test fails when any exported server action does not check the caller; docs of tenancy, sessions, impersonation, uploads and integrity checks.
- Deployment (`DEPLOYMENT.md`): environment variables, Docker image (standalone build, non-root, migrations on start), `docker-compose.prod.yml` with PostgreSQL and a nightly `pg_dump` (14 days kept), cron schedules, first agency and platform admin, updates.

Acceptance (verified): unit tests for phone normalisation, SMS parts and message texts, gateway provider (template, POST, success pattern), and the server action guard (71 actions). Integration tests: SMS off / invalid number refused, manual send and log, visa approval SMS + notification, reminders once per 30 days and failure notice, feedback reply, search by passenger / phone with permission filtering, platform admin (super admin only, create, duplicate code, plan, one-time impersonation, suspend blocks sign-in, own agency protected). Playwright: record search, feedback → bell → reply, SMS page, security headers, /admin refused for the viewer, create an agency and open it as owner with the banner. `npm run check` green (203 unit + 114 integration); Playwright 27/27 twice. Demo and e2e databases pass the integrity check.

Still open: combined-client invoices (waiting for a decision on how they post), refund voucher PDF.

## Combined-client invoices and set-off (2026-09-30)

Decision (owner, 2026-09-30): the receivable and the payable of a combined client stay separate in the books (AR and AP); pages show them together with the net.

- A combined client is linked to one **client account** and one **vendor account** (`CombinedClient.clientId` / `vendorId`, each used by one combined client only). Left empty on the form, they are created with the same name and contact details. Invoices and money receipts use the client account, purchases and vendor payments the vendor account, so every invoice type, receipt and payment works unchanged. The combined client's own row keeps only its opening balance. Existing combined clients are linked by the seed.
- Profile: the balance is the net of own opening + client account + vendor account, with each part shown (and linked) under it; tabs Ledger (all three, each line tagged Client a/c / Vendor a/c / Own), Invoices, Purchases, Money receipts, Payments and Set-offs; actions Receive money, Pay vendor and Set off. Client and vendor profiles say which combined client they belong to. The Combined Clients list shows the net.
- **Set-off** (`SOF-`, voucher kind SET_OFF, Accounts edit permission): settles what they owe us against what we owe them, at most the smaller of the two: Dr AP (vendor account) / Cr AR (client account), and the amount is allocated to the client account's open invoices oldest first (`VoucherAllocation`), so those invoices show as paid / partial. Void reverses the entry and the allocations. Not available from the generic voucher form.
- Reports: the Party Ledger of a combined client is the merged ledger; Due & Advance for combined clients shows each one's net (noted: their client and vendor accounts also appear in the Clients and Vendors reports). Balance Sheet and dashboard keep receivable and payable gross.

Acceptance (verified): unit test for the set-off lines (Dr AP vendor / Cr AR client). Integration test: accounts created and exclusive; a 50,000 sale and a 30,000 purchase give AR 50,000 / AP 30,000 and a net of 20,000 on the profile, merged ledger and due report; set-off limited to 30,000, allocated to the invoice (partial), void restores both sides and the invoice; books balance and cached balances match. Playwright: create a combined client, sell to it and buy from it, see the net and the parts, set off, see the Set-offs tab and the tagged ledger.
