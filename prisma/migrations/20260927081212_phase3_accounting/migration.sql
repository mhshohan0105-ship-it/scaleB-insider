-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "MoneyAccountKind" AS ENUM ('CASH', 'BANK', 'MOBILE_BANKING', 'CREDIT_CARD');

-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('CLIENT', 'COMBINED', 'VENDOR', 'AGENT', 'EMPLOYEE', 'LOAN_AUTHORITY');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('POSTED', 'VOID');

-- CreateTable
CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LedgerType" NOT NULL,
    "systemKey" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyAccount" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "MoneyAccountKind" NOT NULL DEFAULT 'CASH',
    "bankName" TEXT,
    "accountNoMasked" TEXT,
    "branch" TEXT,
    "ledgerAccountId" TEXT NOT NULL,
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "MoneyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "narration" TEXT NOT NULL,
    "isReversal" BOOLEAN NOT NULL DEFAULT false,
    "reversalOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "ledgerAccountId" TEXT NOT NULL,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "partyType" "PartyType",
    "partyId" TEXT,
    "moneyAccountId" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingPeriod" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT true,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalanceTransfer" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "fromAccountId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "charge" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'POSTED',
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "BalanceTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LedgerAccount_agencyId_createdAt_idx" ON "LedgerAccount"("agencyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_agencyId_code_key" ON "LedgerAccount"("agencyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_agencyId_systemKey_key" ON "LedgerAccount"("agencyId", "systemKey");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyAccount_ledgerAccountId_key" ON "MoneyAccount"("ledgerAccountId");

-- CreateIndex
CREATE INDEX "MoneyAccount_agencyId_createdAt_idx" ON "MoneyAccount"("agencyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyAccount_agencyId_name_key" ON "MoneyAccount"("agencyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_reversalOfId_key" ON "JournalEntry"("reversalOfId");

-- CreateIndex
CREATE INDEX "JournalEntry_agencyId_sourceType_sourceId_idx" ON "JournalEntry"("agencyId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "JournalEntry_agencyId_date_idx" ON "JournalEntry"("agencyId", "date");

-- CreateIndex
CREATE INDEX "JournalEntry_agencyId_createdAt_idx" ON "JournalEntry"("agencyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_agencyId_number_key" ON "JournalEntry"("agencyId", "number");

-- CreateIndex
CREATE INDEX "JournalLine_agencyId_ledgerAccountId_partyType_partyId_idx" ON "JournalLine"("agencyId", "ledgerAccountId", "partyType", "partyId");

-- CreateIndex
CREATE INDEX "JournalLine_agencyId_partyType_partyId_idx" ON "JournalLine"("agencyId", "partyType", "partyId");

-- CreateIndex
CREATE INDEX "JournalLine_agencyId_moneyAccountId_idx" ON "JournalLine"("agencyId", "moneyAccountId");

-- CreateIndex
CREATE INDEX "JournalLine_entryId_idx" ON "JournalLine"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriod_agencyId_year_month_key" ON "AccountingPeriod"("agencyId", "year", "month");

-- CreateIndex
CREATE INDEX "BalanceTransfer_agencyId_date_idx" ON "BalanceTransfer"("agencyId", "date");

-- CreateIndex
CREATE INDEX "BalanceTransfer_agencyId_createdAt_idx" ON "BalanceTransfer"("agencyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BalanceTransfer_agencyId_number_key" ON "BalanceTransfer"("agencyId", "number");

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "LedgerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyAccount" ADD CONSTRAINT "MoneyAccount_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyAccount" ADD CONSTRAINT "MoneyAccount_ledgerAccountId_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_ledgerAccountId_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_moneyAccountId_fkey" FOREIGN KEY ("moneyAccountId") REFERENCES "MoneyAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceTransfer" ADD CONSTRAINT "BalanceTransfer_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceTransfer" ADD CONSTRAINT "BalanceTransfer_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "MoneyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceTransfer" ADD CONSTRAINT "BalanceTransfer_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "MoneyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
