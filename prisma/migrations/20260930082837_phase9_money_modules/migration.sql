-- CreateEnum
CREATE TYPE "VoucherKind" AS ENUM ('EXPENSE', 'NON_INVOICE_INCOME', 'INCENTIVE_INCOME', 'AGENT_PAYMENT', 'EMPLOYEE_ADVANCE', 'BILL_ADJUSTMENT', 'INVESTMENT', 'INVESTMENT_RETURN');

-- CreateEnum
CREATE TYPE "AdjustDirection" AS ENUM ('INCREASE_DUE', 'DECREASE_DUE');

-- CreateEnum
CREATE TYPE "LoanAuthorityType" AS ENUM ('BANK', 'PERSON', 'COMPANY');

-- CreateEnum
CREATE TYPE "LoanKind" AS ENUM ('TAKEN', 'GIVEN', 'INVESTMENT');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'CLOSED', 'VOID');

-- CreateEnum
CREATE TYPE "ChequeDirection" AS ENUM ('RECEIVED', 'ISSUED');

-- CreateEnum
CREATE TYPE "ChequeStatus" AS ENUM ('PENDING', 'DEPOSITED', 'CLEARED', 'BOUNCED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ExpenseHead" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ledgerAccountId" TEXT NOT NULL,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "ExpenseHead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "kind" "VoucherKind" NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "profit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "moneyAccountId" TEXT,
    "partyType" "PartyType",
    "partyId" TEXT,
    "expenseHeadId" TEXT,
    "direction" "AdjustDirection",
    "investmentId" TEXT,
    "title" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'POSTED',
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "voucherId" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanAuthority" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LoanAuthorityType" NOT NULL DEFAULT 'BANK',
    "phone" TEXT,
    "address" TEXT,
    "note" TEXT,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "LoanAuthority_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "kind" "LoanKind" NOT NULL,
    "authorityId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "principal" DECIMAL(14,2) NOT NULL,
    "interestRate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "termMonths" INTEGER,
    "moneyAccountId" TEXT NOT NULL,
    "repaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanPayment" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "principal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "interest" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "moneyAccountId" TEXT NOT NULL,
    "note" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'POSTED',
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "LoanPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payroll" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "basic" DECIMAL(14,2) NOT NULL,
    "allowances" JSONB NOT NULL DEFAULT '[]',
    "allowanceTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "deductions" JSONB NOT NULL DEFAULT '[]',
    "deductionTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "advanceAdjusted" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netPaid" DECIMAL(14,2) NOT NULL,
    "moneyAccountId" TEXT NOT NULL,
    "note" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'POSTED',
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cheque" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "direction" "ChequeDirection" NOT NULL,
    "chequeNo" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "chequeDate" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "ChequeStatus" NOT NULL DEFAULT 'PENDING',
    "partyType" "PartyType" NOT NULL,
    "partyId" TEXT NOT NULL,
    "receiptId" TEXT,
    "vendorPaymentId" TEXT,
    "moneyAccountId" TEXT NOT NULL,
    "depositedDate" DATE,
    "clearedDate" DATE,
    "bouncedDate" DATE,
    "history" JSONB NOT NULL DEFAULT '[]',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Cheque_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseHead_ledgerAccountId_key" ON "ExpenseHead"("ledgerAccountId");

-- CreateIndex
CREATE INDEX "ExpenseHead_agencyId_createdAt_idx" ON "ExpenseHead"("agencyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseHead_agencyId_name_key" ON "ExpenseHead"("agencyId", "name");

-- CreateIndex
CREATE INDEX "Voucher_agencyId_createdAt_idx" ON "Voucher"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "Voucher_agencyId_kind_date_idx" ON "Voucher"("agencyId", "kind", "date");

-- CreateIndex
CREATE INDEX "Voucher_agencyId_partyType_partyId_idx" ON "Voucher"("agencyId", "partyType", "partyId");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_agencyId_number_key" ON "Voucher"("agencyId", "number");

-- CreateIndex
CREATE INDEX "Attachment_agencyId_createdAt_idx" ON "Attachment"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "Attachment_voucherId_idx" ON "Attachment"("voucherId");

-- CreateIndex
CREATE INDEX "LoanAuthority_agencyId_createdAt_idx" ON "LoanAuthority"("agencyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoanAuthority_agencyId_name_key" ON "LoanAuthority"("agencyId", "name");

-- CreateIndex
CREATE INDEX "Loan_agencyId_createdAt_idx" ON "Loan"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "Loan_agencyId_kind_date_idx" ON "Loan"("agencyId", "kind", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Loan_agencyId_number_key" ON "Loan"("agencyId", "number");

-- CreateIndex
CREATE INDEX "LoanPayment_agencyId_createdAt_idx" ON "LoanPayment"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "LoanPayment_loanId_idx" ON "LoanPayment"("loanId");

-- CreateIndex
CREATE UNIQUE INDEX "LoanPayment_agencyId_number_key" ON "LoanPayment"("agencyId", "number");

-- CreateIndex
CREATE INDEX "Payroll_agencyId_createdAt_idx" ON "Payroll"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "Payroll_agencyId_employeeId_month_idx" ON "Payroll"("agencyId", "employeeId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_agencyId_number_key" ON "Payroll"("agencyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Cheque_receiptId_key" ON "Cheque"("receiptId");

-- CreateIndex
CREATE UNIQUE INDEX "Cheque_vendorPaymentId_key" ON "Cheque"("vendorPaymentId");

-- CreateIndex
CREATE INDEX "Cheque_agencyId_createdAt_idx" ON "Cheque"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "Cheque_agencyId_status_chequeDate_idx" ON "Cheque"("agencyId", "status", "chequeDate");

-- AddForeignKey
ALTER TABLE "ExpenseHead" ADD CONSTRAINT "ExpenseHead_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseHead" ADD CONSTRAINT "ExpenseHead_ledgerAccountId_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_moneyAccountId_fkey" FOREIGN KEY ("moneyAccountId") REFERENCES "MoneyAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_expenseHeadId_fkey" FOREIGN KEY ("expenseHeadId") REFERENCES "ExpenseHead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanAuthority" ADD CONSTRAINT "LoanAuthority_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_authorityId_fkey" FOREIGN KEY ("authorityId") REFERENCES "LoanAuthority"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_moneyAccountId_fkey" FOREIGN KEY ("moneyAccountId") REFERENCES "MoneyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanPayment" ADD CONSTRAINT "LoanPayment_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanPayment" ADD CONSTRAINT "LoanPayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanPayment" ADD CONSTRAINT "LoanPayment_moneyAccountId_fkey" FOREIGN KEY ("moneyAccountId") REFERENCES "MoneyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_moneyAccountId_fkey" FOREIGN KEY ("moneyAccountId") REFERENCES "MoneyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cheque" ADD CONSTRAINT "Cheque_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cheque" ADD CONSTRAINT "Cheque_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "MoneyReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cheque" ADD CONSTRAINT "Cheque_vendorPaymentId_fkey" FOREIGN KEY ("vendorPaymentId") REFERENCES "VendorPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cheque" ADD CONSTRAINT "Cheque_moneyAccountId_fkey" FOREIGN KEY ("moneyAccountId") REFERENCES "MoneyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
