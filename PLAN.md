# scaleB Insider: Build Plan

Travel agency management and accounting SaaS for Bangladesh based agencies (air ticketing, visa, tour, Hajj, Umrah). Functional scope is modelled on the category of product Trabill represents, but everything here (code, UI, text, branding) must be original. Do not copy any code, text, images or design assets from other products.

This file is the single source of truth for the build. Work through it phase by phase. Do not start a phase before the previous phase's acceptance checks pass.

---

## 1. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router), TypeScript strict | Full stack in one repo |
| UI | Ant Design v5 + @ant-design/nextjs-registry | Tables, forms, date pickers, layout out of the box |
| Charts | @ant-design/charts or Recharts | Dashboard and reports |
| Database | PostgreSQL 16 | Neon/Supabase in cloud, Docker locally |
| ORM | Prisma | Migrations + seed |
| Auth | Auth.js (next-auth v5), Credentials provider, bcryptjs | JWT session carrying userId, agencyId, roleId |
| Validation | Zod | Shared schemas for forms, server actions and API |
| Server logic | Server Actions for mutations, Route Handlers for exports and API | All business rules live in `src/server/services` |
| PDF | @react-pdf/renderer | Invoice, money receipt, reports |
| Excel | exceljs | Report export |
| File storage | S3 compatible (AWS S3 / Cloudflare R2) | Passport scans, logos, attachments |
| SMS | Pluggable provider interface (BD SMS gateway) | Due reminders, receipts |
| Tests | Vitest (unit, services), Playwright (e2e) | Accounting logic must have unit tests |
| Lint/format | ESLint + Prettier | |
| Deploy | Vercel + Neon, or VPS with Docker Compose | |

Money: always `Decimal(14,2)` in DB and `Prisma.Decimal` / decimal.js in code. Never use JS float for money. Currency default BDT, with optional foreign currency + exchange rate on invoices.

---

## 2. Architecture overview

```
Browser (React, Ant Design)
   |
Next.js App Router
   |  pages (server components)  -> read via services
   |  server actions             -> validate (Zod) -> services
   |  route handlers /api/*      -> exports, PDFs, webhooks
   |
src/server/services   (business logic, one module per domain)
   |
src/server/accounting (posting engine: the ONLY code that writes journal lines)
   |
Prisma -> PostgreSQL
```

### 2.1 Multi tenancy
* Every business table has `agencyId`. One database, row level tenant isolation.
* A Prisma client extension (`src/server/db/tenant.ts`) injects `agencyId` into every query from the session. No service may query without a tenant scoped client.
* Super admin area (`/admin`) manages agencies, subscription status, and can impersonate for support (logged in audit trail).

### 2.2 Accounting core (most important design decision)
Double entry bookkeeping underneath everything. Every business event (invoice, receipt, payment, refund, expense, payroll, loan, transfer) is converted into one `JournalEntry` with 2+ `JournalLine`s whose debits equal credits.

* `LedgerAccount` = chart of accounts (Assets, Liabilities, Income, Expense, Equity). System accounts are seeded per agency: Accounts Receivable, Accounts Payable, Sales (per product type), Cost of Sales (per product type), Commission Income, Discount Given, AIT Payable, Refund Charges Income, Salaries, etc.
* Cash/bank style accounts (`MoneyAccount`: Cash, Bank, Mobile Banking, Credit Card) each map to one asset `LedgerAccount`.
* Party sub ledgers: each `JournalLine` may carry `partyType` (CLIENT, VENDOR, AGENT, EMPLOYEE, LOAN_AUTHORITY) and `partyId`. Client ledger = all lines on Accounts Receivable for that client. Vendor ledger = all lines on Accounts Payable for that vendor.
* Source link: `JournalEntry.sourceType` + `sourceId` (e.g. INVOICE_AIR, MONEY_RECEIPT). Editing a source document reverses its old entry and posts a new one inside one DB transaction. Never mutate posted lines.
* Balances are derived from lines. Cached balances (`Client.balance`, `MoneyAccount.balance`) are updated in the same transaction and a nightly job recomputes and flags drift.

Posting examples (amounts illustrative):

| Event | Debit | Credit |
|---|---|---|
| Air ticket invoice, client price 50,000, vendor cost 47,000 | AR (client) 50,000 | Sales Air 50,000 |
| | Cost of Sales Air 47,000 | AP (vendor) 47,000 |
| Money receipt 30,000 cash | Cash 30,000 | AR (client) 30,000 |
| Vendor payment 47,000 bank | AP (vendor) 47,000 | Bank 47,000 |
| Refund: client refund 45,000, vendor refunds 44,000, charge 1,000 | Sales Air 50,000 / AP vendor 44,000 ... | reversal lines per refund rules (section 6.7) |
| Expense 2,000 cash | Office Expense 2,000 | Cash 2,000 |
| Balance transfer bank to cash 10,000 | Cash 10,000 | Bank 10,000 |

`src/server/accounting/post.ts` exposes `postEntry(tx, {date, sourceType, sourceId, narration, lines[]})` and throws if debits != credits or any line has a closed period date.

### 2.3 Numbering
Per agency, per document type, per year sequences: `AIT-2026-00001`, `MR-2026-00001`, etc. Stored in `DocumentSequence` and incremented inside the same transaction (row lock).

### 2.4 Soft delete, void and audit
* Business documents are never hard deleted. They are `VOID` (with reason) which reverses their journal entry.
* `AuditLog` row for every create/update/void/login: userId, action, entity, entityId, before JSON, after JSON, ip, userAgent, timestamp.

### 2.5 Permissions (RBAC)
* `Role` has a JSON permission map: `{ module: ["view","create","edit","void","export"] }`.
* Module keys match the sidebar (section 4). Middleware + a `can(session, module, action)` helper guard pages, actions and menu rendering.
* Seeded roles: Owner (all), Accountant, Sales/Ticketing Staff, Viewer.

---

## 3. Folder structure

```
scaleb_insider/
  prisma/
    schema.prisma
    seed.ts
  src/
    app/
      (auth)/login/
      (app)/layout.tsx            sidebar + header
      (app)/dashboard/
      (app)/invoices/airticket/  [list, new, [id], [id]/edit, [id]/print]
      (app)/invoices/noncommission/
      (app)/invoices/reissue/
      (app)/invoices/other/
      (app)/invoices/otherpackage/
      (app)/invoices/visa/
      (app)/invoices/tour/
      (app)/invoices/umrah/
      (app)/hajj/...
      (app)/refunds/...
      (app)/moneyreceipts/
      (app)/accounts/...
      (app)/cheques/
      (app)/payroll/
      (app)/expenses/
      (app)/loans/
      (app)/clients/  vendors/  agents/
      (app)/quotations/
      (app)/passports/
      (app)/reports/...
      (app)/settings/...          configuration module
      admin/                      super admin
      api/                        exports, pdf, cron
    components/                   shared UI (DataTable, MoneyInput, PartySelect, DateRangeFilter, PrintLayout)
    server/
      db/                         prisma client, tenant extension
      accounting/                 posting engine, balance helpers
      services/                   one folder per domain
      auth/                       Auth.js config, rbac
      audit/
    lib/                          zod schemas, formatters (BDT, dates), numbering
    tests/
  e2e/
```

---

## 4. Module map (sidebar)

1. Dashboard
2. Invoice (Air Ticket): New, View
3. Invoice (Non Commission): New, View
4. Reissue (Air Ticket): New, View
5. Invoice (Other): New, View
6. Invoice (Other Package): New, View
7. Invoice (Visa): New, View, Visa Process tracker
8. Invoice (Tour Package): New, View
9. Hajj: Pre Registration Invoice, Hajj Invoice, Hajj Registration
10. Hajji Management: Moallem transfer + list, Group transfer + list, Transfer In, Transfer Out, Cancel Pre Registration, Cancel Registration
11. Invoice (Umrah): New, View
12. Refund: Air Ticket, Others, Tour Package, Partial, Other Package & Hajj (each Create + History)
13. Money Receipt: Invoice Money Receipt, Advance Return
14. Accounts: Bill Adjustment, Accounts list, Transaction History, Balance Status, Balance Transfer, Non Invoice Income, Investments, Incentive Income
15. Cheque Management
16. Payroll: Payroll, Employee Advance
17. Expense: Expense Heads, Add Expense, Expense History
18. Loan & Received Investments: Authority, Loan Information, Received Investment, Payments
19. Clients: Client, Combined Client
20. Vendors: Vendors, Vendor Payment, Advance Return
21. Agents: Agent Profile, Agent Payment
22. Quotation: New, View
23. Passport Management: Add, List
24. Reports (section 7)
25. Configuration (section 8)
26. Feedback

Header: global search (sidebar item search + invoice/ticket/client search), notifications bell, user menu (profile, change password, logout), current date/time.

---

## 5. Data model (Prisma, core entities)

Every model below also has `id (cuid)`, `agencyId`, `createdAt`, `updatedAt`, `createdById` unless stated. Only key fields are listed; Claude Code should flesh out the rest.

**Tenancy and users**
* `Agency`: name, logo, address, phone, email, tradeLicense, iataNo, currency, fiscalYearStart, invoiceFooter, status, plan
* `User`: name, username (unique per agency), email, phone, passwordHash, roleId, employeeId?, isActive, lastLoginAt
* `Role`: name, permissions Json
* `LoginHistory`: userId, ip, userAgent, success, at
* `AuditLog`: see 2.4

**Master data (Configuration)**
* `ClientCategory`, `Airport` (iata, name, city, country), `Airline` (iata, name), `Product` (name, type), `VisaType`, `Department`, `Designation`, `Employee` (name, designationId, departmentId, phone, salary, joinDate, commissionRate), `RoomType`, `TransportType`, `PassportStatus`, `Group` (Hajj/Umrah groups), `Maharam` relations, `Company` (corporate clients), `Country`
* Tour itinerary: `TourGroup`, `TourTicket`, `Guide`, `Transport`, `Food`, `Accommodation`, `City`, `Place`, `OtherTransport` (each with cost + vendor)

**Parties**
* `Client`: code, name, type (INDIVIDUAL/CORPORATE), categoryId, phone, email, address, walkingCustomer bool, creditLimit, openingBalance, balance (cached), isActive
* `CombinedClient`: a party that is both client and vendor (single ledger view)
* `Vendor`: code, name, type (AIRLINE_CONSOLIDATOR, GDS, VISA, HOTEL, OTHER), phone, email, bankInfo, openingBalance, balance, commissionRate
* `Agent`: name, phone, commissionRate, openingBalance, balance

**Accounting**
* `LedgerAccount`: code, name, type (ASSET, LIABILITY, INCOME, EXPENSE, EQUITY), isSystem, parentId
* `MoneyAccount`: name, kind (CASH, BANK, MOBILE_BANKING, CREDIT_CARD), bankName, accountNo (store masked), branch, ledgerAccountId, openingBalance, balance
* `JournalEntry`: date, number, sourceType, sourceId, narration, isReversal, reversedEntryId
* `JournalLine`: entryId, ledgerAccountId, debit, credit, partyType?, partyId?, moneyAccountId?, memo
* `DocumentSequence`: docType, year, next
* `AccountingPeriod`: month, isClosed

**Invoices (shared header + type specific lines)**
* `Invoice`: number, type (AIR, NON_COMMISSION, REISSUE, OTHER, OTHER_PACKAGE, VISA, TOUR, HAJJ_PRE_REG, HAJJ, UMRAH), clientId, agentId?, salesmanId (Employee), date, dueDate, subtotal, discount, serviceCharge, vat, netTotal, totalCost, profit, agentCommission, paidAmount, status (DRAFT, POSTED, PARTIAL, PAID, VOID, REFUNDED), note, currency, exchangeRate, reissueOfId?
* `InvoiceAirTicket` (line): ticketNo, pnr, gdsPnr, airlineId, vendorId, passengerName, passengerType (ADT/CHD/INF), passportId?, route (from/to airport ids, multi segment json), journeyDate, returnDate, class, baseFare, taxes Json (per tax code), totalFare, commissionPercent, commissionAmount, aitAmount, clientPrice, purchasePrice, profit, gds, segmentCount
* `InvoiceVisaLine`: country, visaTypeId, passengerName, passportId, vendorId, clientPrice, purchasePrice, status (PENDING, SUBMITTED, APPROVED, REJECTED, DELIVERED), deliveryDate
* `InvoiceOtherLine`: productId, description, qty, vendorId, unitClientPrice, unitCost
* `InvoiceTourLine`: tourGroupId, itinerary items (hotel, transport, guide, food), pax, vendor costs per item
* `InvoiceHajjLine` / `InvoiceUmrahLine`: pilgrimId, trackingNo, groupId, maharamId, package, roomType, clientPrice, cost, vendorId
* `InvoicePassenger`: reusable passenger rows linked to Passport

**Hajj**
* `Pilgrim` (Hajji): name, passportId, trackingNo, preRegNo, regNo, voucherNo, groupId, maharamId, moallem, status (PRE_REGISTERED, REGISTERED, TRANSFERRED_IN, TRANSFERRED_OUT, CANCELLED)
* `HajjTransfer`: type (MOALLEM_TO_MOALLEM, GROUP_TO_GROUP, IN, OUT), from, to, pilgrimIds, date, charge

**Refund / Reissue / Void**
* `Refund`: type (AIR, OTHER, TOUR, PARTIAL, OTHER_PACKAGE_HAJJ), invoiceId, lines Json, clientRefundAmount, clientCharge, vendorRefundAmount, vendorCharge, refundMethod (CASH_RETURN, ADJUST_TO_BALANCE), moneyAccountId?, date, note

**Money movement**
* `MoneyReceipt`: number, clientId, date, amount, moneyAccountId, paymentMethod (CASH, BANK, CHEQUE, MOBILE, CARD), chequeId?, transactionCharge, allocations (invoiceId + amount, or advance), note
* `AdvanceReturn`: party (client or vendor), amount, moneyAccountId, date
* `VendorPayment`: number, vendorId, date, amount, moneyAccountId, method, chequeId?, allocations (invoice lines or on account)
* `AgentPayment`: agentId, amount, invoiceIds, moneyAccountId
* `Cheque`: number, bank, date, amount, direction (RECEIVED, ISSUED), partyType, partyId, status (PENDING, DEPOSITED, CLEARED, BOUNCED), linked document
* `BalanceTransfer`: fromAccountId, toAccountId, amount, charge, date
* `BillAdjustment`: partyType, partyId, amount, direction (INCREASE_DUE, DECREASE_DUE), reason
* `NonInvoiceIncome`, `IncentiveIncome` (from airline/vendor), `Investment`

**Expense, payroll, loan**
* `ExpenseHead`, `Expense` (headId, amount, moneyAccountId, date, note, attachment)
* `Payroll` (employeeId, month, basic, allowances Json, deductions Json, advanceAdjusted, netPaid, moneyAccountId), `EmployeeAdvance`
* `LoanAuthority` (bank/person), `Loan` (type TAKEN/GIVEN, principal, interestRate, startDate, schedule), `ReceivedInvestment`, `LoanPayment`

**Others**
* `Quotation` (client, lines, validity, status, convertToInvoiceId)
* `Passport` (passportNo, name, dob, nationality, issueDate, expiryDate, scanUrl, statusId, clientId, reminder when expiry < 6 months)
* `Notification`, `SmsLog`, `Feedback`

Indexes: every table `(agencyId, createdAt)`, invoices `(agencyId, number)` unique, air tickets `(agencyId, ticketNo)`, journal lines `(agencyId, ledgerAccountId, partyType, partyId)`.

---

## 6. Business rules per module

### 6.1 Air ticket invoice
* One invoice, many tickets. Each ticket has its own vendor.
* Commission: `commissionAmount = baseFare * commissionPercent` (config: on base fare or on total fare, per airline).
* AIT: configurable rate (default per current Bangladesh rule, set in App Config), calculated on the configured base, shown per ticket and posted to AIT Payable/Receivable as configured.
* `purchasePrice = totalFare - commissionAmount + aitAmount` (formula configurable in App Config; keep it in one function `calcAirTicket()` with unit tests).
* `profit = clientPrice - purchasePrice`. Invoice level discount and service charge adjust profit.
* Duplicate ticket number check within agency.
* Print/PDF: agency header, client, ticket table, totals, amount in words (BDT), paid, due, footer terms.
* Save as DRAFT (no posting) or POST (journal posted).

### 6.2 Non commission invoice
Same as air ticket but no commission/AIT fields; client price and purchase price entered directly.

### 6.3 Reissue
Links to original ticket. Fields: new journey date, penalty (airline), fare difference, service charge. Posts only the difference: client charged `penalty + fareDiff + serviceCharge`, vendor payable `penalty + fareDiff`.

### 6.4 Visa invoice + Visa Process
Visa process board shows every visa line by status; status change timestamps; SMS to client on APPROVED/DELIVERED (optional).

### 6.5 Other, Other Package, Tour Package, Umrah, Hajj invoices
Generic line based invoices; Tour pulls itinerary items from Configuration with default costs; Hajj/Umrah link to Pilgrim records.

### 6.6 Money receipt
* Pick client, see all due invoices, allocate amount to invoices (auto allocate oldest first, editable). Unallocated amount becomes client advance.
* Transaction charge (bank/bKash) posts to Transaction Charge expense.
* Cheque method creates a `Cheque` in PENDING; journal to "Cheques in Hand" until CLEARED; BOUNCED reverses.
* Print receipt.

### 6.7 Refund
* Select invoice, then lines to refund (full or partial).
* Inputs: client refund charge, vendor refund charge.
* Client side: reduce AR by original client price, then charge the refund charge as income; refund method either cash return (money out) or keep as client advance.
* Vendor side: reduce AP by original purchase price, add vendor charge.
* Invoice status becomes REFUNDED or PARTIAL.
* All of this in `services/refund/postRefund.ts` with unit tests for full, partial, cash return and adjust cases.

### 6.8 Vendor payment and advance return
Mirror of money receipt for vendors. Advance return pays back a party's credit balance.

### 6.9 Accounts
* Accounts list with live balances.
* Transaction history: filter by account, date range, type; running balance.
* Balance Status: all money accounts + total.
* Balance transfer with optional charge.
* Bill adjustment: manual increase/decrease of a party's due with mandatory reason (Owner/Accountant only).

### 6.10 Cheque management
List all cheques by status; actions: Deposit, Clear, Bounce (each posts correct entries).

### 6.11 Payroll
Monthly payroll per employee, adjust outstanding advance, pay from money account; payslip PDF.

### 6.12 Expense
Heads, add expense with attachment, history with filters.

### 6.13 Loan & investment
Loan taken/given, schedule, payments, interest to expense/income.

### 6.14 Clients / Vendors / Agents
List with search, balance, status; profile page with tabs: Info, Invoices, Receipts/Payments, Ledger, Passports. Opening balance posts an opening journal entry.

### 6.15 Quotation
Build quote with lines, PDF/share, convert to invoice in one click.

### 6.16 Passport management
Add passport with scan upload, status tracking, expiry alerts on dashboard.

### 6.17 Hajji management
Transfers change pilgrim group/moallem with history; cancel flows trigger refund wizard.

---

## 7. Reports

All reports: date range filter, relevant filters (client, vendor, salesman, airline, product), on screen table with totals, print, PDF, Excel export. Built on SQL views or Prisma raw queries against journal lines + source tables.

* Ledgers: Client, Vendor, Combined, Agent (opening balance, each transaction, running balance, closing)
* Total Due/Advance: Clients, Vendors, Combined, Agents
* Sales: Sales Report, Sales & Earning, Airline wise, Salesman & Product, Sales & Collection, Purchase & Payment, Salesman wise Collection, Daily Sales & Purchase, Salesman wise Client Due
* Profit/Loss: Overall P&L (income statement from ledger), Visa wise, Group wise, Ticket wise
* Expense: Salaries, Office
* Passport: Status report, Passport wise
* Passenger list: Client wise, Group wise
* Air ticket: Ticket details, Tax report, AIT report, Client AIT, GDS report
* Others: Client discount, Vendor payment, Vendor purchase, Tour package, Journey date wise (due, clients, vendors), Country wise, Accounts, Payroll, Loan, Transaction charge, Refund, Daily & Monthly summary, Pre registration, Void list, User login history, Audit trail
* Accounting (extra, cheap because of double entry): Trial Balance, Balance Sheet

---

## 8. Configuration module

App Config (currency, fiscal year, AIT rate and base, commission base, invoice prefixes, invoice footer/terms, SMS on/off, default money account), Profile Setting (agency info, logo), Client Category, Airports, Airlines, Products, Visa Types, Departments, Room Types, Transport Types, Designations, Employees, Users (list, create, reset password, activate), Roles (permission matrix UI), Tour Itinerary masters, Passport Status, Groups, Maharam, Agency, Companies, Database Backup (download tenant data as JSON/Excel export; full DB backups handled at infra level).

Seed: Bangladeshi and common international airports, major airlines, default products, default expense heads, system ledger accounts, default roles, one demo agency with demo data.

---

## 9. Dashboard

* Cards: Today/Month/Year Sales, Collection, Discount, Total Receivable, Total Payable, Advance Collection
* Chart: yearly sales, purchase, collection, profit by quarter/month
* Flight schedule: upcoming journey dates (next 7 days)
* Account balances table
* Best clients and best salesmen (monthly/yearly)
* Expense breakdown donut
* Passport expiry alerts, pending visa processes, pending cheques

---

## 10. Non functional requirements

* Performance: list pages server side paginated, sorted, filtered; reports under 3s for 50k invoices (use indexes, SQL aggregation).
* Security: bcrypt passwords, rate limited login, CSRF safe server actions, tenant isolation tested, no secrets in client bundle, masked bank account numbers, file upload type/size limits.
* Every money mutation inside `prisma.$transaction` with serializable or row locks where balances change.
* Timezone: store UTC, display Asia/Dhaka. Number format with BDT and Bangla/English amount in words.
* Responsive enough for tablet; primary target desktop.
* i18n ready (English first, Bangla later) using next-intl.

---

## 11. Build phases (do them in order)

Each phase ends with: migrations applied, seed updated, unit tests green, one Playwright happy path, and a short CHANGELOG entry.

**Phase 0. Project setup**
Next.js + TS + Ant Design + Prisma + Postgres (docker compose) + Auth.js + ESLint/Prettier + Vitest + Playwright. App shell: login page, sidebar with all modules from section 4 (placeholders), header.
Accept: login works with seeded user, sidebar renders, CI script `npm run check` runs lint, typecheck, tests.

**Phase 1. Tenancy, users, RBAC, audit, configuration masters**
Agency, User, Role, permissions UI, tenant Prisma extension, audit log, login history, all Configuration master CRUDs (section 8).
Accept: two agencies cannot see each other's data (automated test); a Viewer cannot create.

**Phase 2. Parties**
Clients, Combined Clients, Vendors, Agents with profile pages (ledger tab placeholder).

**Phase 3. Accounting engine**
LedgerAccount seeding, MoneyAccount, JournalEntry/Line, `postEntry`, reversal, document sequences, opening balances, balance transfer, transaction history, balance status.
Accept: unit tests prove debits = credits, reversal restores balances, concurrent numbering has no duplicates.

**Phase 4. Air ticket invoice, money receipt, vendor payment**
Full 6.1, 6.6, 6.8 with PDFs. Client and vendor ledger tabs now live.
Accept: create invoice, receive partial payment, pay vendor; ledgers and balances match hand calculation in a test.

**Phase 5. Dashboard + core reports**
Section 9 plus Ledgers, Total Due/Advance, Sales Report, Overall P&L, Trial Balance.

**Phase 6. Remaining invoice types**
Non commission, Other, Other Package, Visa (+ process board), Tour Package (+ itinerary masters), Umrah.

**Phase 7. Reissue, refunds, void**
6.3, 6.7, all refund types, void with reason, void list report.

**Phase 8. Hajj**
Pilgrims, pre registration and Hajj invoices, registration, transfers, cancellations.

**Phase 9. Expense, payroll, loan, cheque, other income**
6.10 to 6.13, Non Invoice Income, Incentive Income, Investments, Bill Adjustment, Agent Payment.

**Phase 10. Quotation, passport management**
6.15, 6.16, expiry alerts.

**Phase 11. All remaining reports**
Everything left in section 7, each with print/PDF/Excel.

**Phase 12. Notifications, SMS, backup, super admin, polish**
SMS provider interface + logs, in app notifications, tenant data export, super admin (agencies, plans, impersonation), global search, performance pass, security review, deployment docs.

---

## 12. Testing strategy

* Unit (Vitest): `calcAirTicket`, refund math, posting engine, allocation logic, sequence generator, report aggregations with fixtures.
* Integration: services against a test Postgres (docker), reset per test file.
* E2E (Playwright): login, create client, air ticket invoice, money receipt, refund, check ledger totals.
* Golden rule test: after any test scenario, sum of all debits = sum of all credits per agency, and cached balances = derived balances.

---

## 13. Deployment

* Env vars: `DATABASE_URL`, `AUTH_SECRET`, `S3_*`, `SMS_*`, `APP_URL`.
* Vercel + Neon (easy) or VPS: Docker Compose (app, postgres, nginx, daily pg_dump to S3).
* `prisma migrate deploy` on release. Seed only for new agency creation (via service, not raw seed).

---

## 14. Open decisions (confirm before or during Phase 1)

1. Exact AIT rate/base and commission formula your agency uses.
2. Which SMS gateway.
3. Single agency first or SaaS with signup from day one.
4. Bangla UI needed at launch or later.
5. Hosting choice.
