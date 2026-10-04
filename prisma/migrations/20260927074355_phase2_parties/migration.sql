-- CreateEnum
CREATE TYPE "OpeningBalanceType" AS ENUM ('RECEIVABLE', 'PAYABLE');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('INDIVIDUAL', 'CORPORATE');

-- CreateEnum
CREATE TYPE "VendorType" AS ENUM ('AIRLINE', 'AIRLINE_CONSOLIDATOR', 'GDS', 'VISA', 'HOTEL', 'TRANSPORT', 'OTHER');

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ClientType" NOT NULL DEFAULT 'INDIVIDUAL',
    "categoryId" TEXT,
    "companyId" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "walkingCustomer" BOOLEAN NOT NULL DEFAULT false,
    "creditLimit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "openingBalanceType" "OpeningBalanceType" NOT NULL DEFAULT 'RECEIVABLE',
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CombinedClient" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "openingBalanceType" "OpeningBalanceType" NOT NULL DEFAULT 'RECEIVABLE',
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "CombinedClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "VendorType" NOT NULL DEFAULT 'OTHER',
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "bankInfo" TEXT,
    "commissionPercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "openingBalanceType" "OpeningBalanceType" NOT NULL DEFAULT 'PAYABLE',
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "commissionPercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "openingBalanceType" "OpeningBalanceType" NOT NULL DEFAULT 'PAYABLE',
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSequence" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Client_agencyId_createdAt_idx" ON "Client"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "Client_agencyId_name_idx" ON "Client"("agencyId", "name");

-- CreateIndex
CREATE INDEX "Client_agencyId_phone_idx" ON "Client"("agencyId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Client_agencyId_code_key" ON "Client"("agencyId", "code");

-- CreateIndex
CREATE INDEX "CombinedClient_agencyId_createdAt_idx" ON "CombinedClient"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "CombinedClient_agencyId_name_idx" ON "CombinedClient"("agencyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CombinedClient_agencyId_code_key" ON "CombinedClient"("agencyId", "code");

-- CreateIndex
CREATE INDEX "Vendor_agencyId_createdAt_idx" ON "Vendor"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "Vendor_agencyId_name_idx" ON "Vendor"("agencyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_agencyId_code_key" ON "Vendor"("agencyId", "code");

-- CreateIndex
CREATE INDEX "Agent_agencyId_createdAt_idx" ON "Agent"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "Agent_agencyId_name_idx" ON "Agent"("agencyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_agencyId_code_key" ON "Agent"("agencyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSequence_agencyId_docType_year_key" ON "DocumentSequence"("agencyId", "docType", "year");

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourTicket" ADD CONSTRAINT "TourTicket_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guide" ADD CONSTRAINT "Guide_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transport" ADD CONSTRAINT "Transport_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Food" ADD CONSTRAINT "Food_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accommodation" ADD CONSTRAINT "Accommodation_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtherTransport" ADD CONSTRAINT "OtherTransport_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ClientCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CombinedClient" ADD CONSTRAINT "CombinedClient_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSequence" ADD CONSTRAINT "DocumentSequence_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
