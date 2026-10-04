-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('AIR', 'NON_COMMISSION', 'REISSUE', 'OTHER', 'OTHER_PACKAGE', 'VISA', 'TOUR', 'HAJJ_PRE_REG', 'HAJJ', 'UMRAH');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'POSTED', 'PARTIAL', 'PAID', 'VOID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PassengerType" AS ENUM ('ADT', 'CHD', 'INF');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK', 'MOBILE', 'CARD', 'CHEQUE');

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "InvoiceType" NOT NULL,
    "clientId" TEXT NOT NULL,
    "agentId" TEXT,
    "salesmanId" TEXT,
    "date" DATE NOT NULL,
    "dueDate" DATE,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "serviceCharge" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vat" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "profit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "agentCommission" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "exchangeRate" DECIMAL(14,6) NOT NULL DEFAULT 1,
    "reissueOfId" TEXT,
    "postedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceAirTicket" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "ticketNo" TEXT NOT NULL,
    "pnr" TEXT,
    "gdsPnr" TEXT,
    "gds" TEXT,
    "airlineId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "passengerName" TEXT NOT NULL,
    "passengerType" "PassengerType" NOT NULL DEFAULT 'ADT',
    "passportNo" TEXT,
    "route" TEXT NOT NULL,
    "segmentCount" INTEGER NOT NULL DEFAULT 1,
    "journeyDate" DATE NOT NULL,
    "returnDate" DATE,
    "cabinClass" TEXT,
    "baseFare" DECIMAL(14,2) NOT NULL,
    "taxes" JSONB NOT NULL DEFAULT '[]',
    "taxTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalFare" DECIMAL(14,2) NOT NULL,
    "commissionPercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "commissionAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "aitAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "clientPrice" DECIMAL(14,2) NOT NULL,
    "purchasePrice" DECIMAL(14,2) NOT NULL,
    "profit" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceAirTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyReceipt" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "moneyAccountId" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "transactionCharge" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "reference" TEXT,
    "note" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'POSTED',
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "MoneyReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyReceiptAllocation" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoneyReceiptAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorPayment" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "moneyAccountId" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'BANK',
    "transactionCharge" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "reference" TEXT,
    "note" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'POSTED',
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "VendorPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvanceReturn" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "partyType" "PartyType" NOT NULL,
    "partyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "moneyAccountId" TEXT NOT NULL,
    "note" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'POSTED',
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "AdvanceReturn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Invoice_agencyId_createdAt_idx" ON "Invoice"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "Invoice_agencyId_type_date_idx" ON "Invoice"("agencyId", "type", "date");

-- CreateIndex
CREATE INDEX "Invoice_agencyId_clientId_idx" ON "Invoice"("agencyId", "clientId");

-- CreateIndex
CREATE INDEX "Invoice_agencyId_status_idx" ON "Invoice"("agencyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_agencyId_number_key" ON "Invoice"("agencyId", "number");

-- CreateIndex
CREATE INDEX "InvoiceAirTicket_agencyId_ticketNo_idx" ON "InvoiceAirTicket"("agencyId", "ticketNo");

-- CreateIndex
CREATE INDEX "InvoiceAirTicket_agencyId_createdAt_idx" ON "InvoiceAirTicket"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "InvoiceAirTicket_agencyId_vendorId_idx" ON "InvoiceAirTicket"("agencyId", "vendorId");

-- CreateIndex
CREATE INDEX "InvoiceAirTicket_agencyId_journeyDate_idx" ON "InvoiceAirTicket"("agencyId", "journeyDate");

-- CreateIndex
CREATE INDEX "InvoiceAirTicket_invoiceId_idx" ON "InvoiceAirTicket"("invoiceId");

-- CreateIndex
CREATE INDEX "MoneyReceipt_agencyId_createdAt_idx" ON "MoneyReceipt"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "MoneyReceipt_agencyId_clientId_idx" ON "MoneyReceipt"("agencyId", "clientId");

-- CreateIndex
CREATE INDEX "MoneyReceipt_agencyId_date_idx" ON "MoneyReceipt"("agencyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyReceipt_agencyId_number_key" ON "MoneyReceipt"("agencyId", "number");

-- CreateIndex
CREATE INDEX "MoneyReceiptAllocation_agencyId_invoiceId_idx" ON "MoneyReceiptAllocation"("agencyId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyReceiptAllocation_receiptId_invoiceId_key" ON "MoneyReceiptAllocation"("receiptId", "invoiceId");

-- CreateIndex
CREATE INDEX "VendorPayment_agencyId_createdAt_idx" ON "VendorPayment"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "VendorPayment_agencyId_vendorId_idx" ON "VendorPayment"("agencyId", "vendorId");

-- CreateIndex
CREATE INDEX "VendorPayment_agencyId_date_idx" ON "VendorPayment"("agencyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "VendorPayment_agencyId_number_key" ON "VendorPayment"("agencyId", "number");

-- CreateIndex
CREATE INDEX "AdvanceReturn_agencyId_createdAt_idx" ON "AdvanceReturn"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "AdvanceReturn_agencyId_partyType_partyId_idx" ON "AdvanceReturn"("agencyId", "partyType", "partyId");

-- CreateIndex
CREATE UNIQUE INDEX "AdvanceReturn_agencyId_number_key" ON "AdvanceReturn"("agencyId", "number");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceAirTicket" ADD CONSTRAINT "InvoiceAirTicket_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceAirTicket" ADD CONSTRAINT "InvoiceAirTicket_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceAirTicket" ADD CONSTRAINT "InvoiceAirTicket_airlineId_fkey" FOREIGN KEY ("airlineId") REFERENCES "Airline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceAirTicket" ADD CONSTRAINT "InvoiceAirTicket_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyReceipt" ADD CONSTRAINT "MoneyReceipt_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyReceipt" ADD CONSTRAINT "MoneyReceipt_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyReceipt" ADD CONSTRAINT "MoneyReceipt_moneyAccountId_fkey" FOREIGN KEY ("moneyAccountId") REFERENCES "MoneyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyReceiptAllocation" ADD CONSTRAINT "MoneyReceiptAllocation_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyReceiptAllocation" ADD CONSTRAINT "MoneyReceiptAllocation_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "MoneyReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyReceiptAllocation" ADD CONSTRAINT "MoneyReceiptAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_moneyAccountId_fkey" FOREIGN KEY ("moneyAccountId") REFERENCES "MoneyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceReturn" ADD CONSTRAINT "AdvanceReturn_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceReturn" ADD CONSTRAINT "AdvanceReturn_moneyAccountId_fkey" FOREIGN KEY ("moneyAccountId") REFERENCES "MoneyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
