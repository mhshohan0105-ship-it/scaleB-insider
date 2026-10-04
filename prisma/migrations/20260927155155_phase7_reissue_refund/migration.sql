-- CreateEnum
CREATE TYPE "RefundType" AS ENUM ('AIR', 'OTHER', 'TOUR', 'PARTIAL', 'OTHER_PACKAGE_HAJJ');

-- CreateEnum
CREATE TYPE "RefundMethod" AS ENUM ('CASH_RETURN', 'ADJUST_TO_BALANCE');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('POSTED', 'VOID');

-- CreateEnum
CREATE TYPE "RefundLineKind" AS ENUM ('TICKET', 'REISSUE', 'ITEM', 'VISA');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "refundCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "refundCredit" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "InvoiceReissueLine" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "originalTicketId" TEXT NOT NULL,
    "ticketNo" TEXT,
    "pnr" TEXT,
    "passengerName" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "airlineId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "journeyDate" DATE NOT NULL,
    "returnDate" DATE,
    "penalty" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "fareDifference" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "serviceCharge" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "clientPrice" DECIMAL(14,2) NOT NULL,
    "purchasePrice" DECIMAL(14,2) NOT NULL,
    "profit" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceReissueLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "RefundType" NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "clientRefundAmount" DECIMAL(14,2) NOT NULL,
    "clientCharge" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vendorRefundAmount" DECIMAL(14,2) NOT NULL,
    "vendorCharge" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "method" "RefundMethod" NOT NULL,
    "returnAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "moneyAccountId" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'POSTED',
    "note" TEXT,
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundLine" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "refundId" TEXT NOT NULL,
    "lineKind" "RefundLineKind" NOT NULL,
    "lineId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "vendorId" TEXT,
    "clientAmount" DECIMAL(14,2) NOT NULL,
    "vendorAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vendorCharge" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "RefundLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceReissueLine_agencyId_createdAt_idx" ON "InvoiceReissueLine"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "InvoiceReissueLine_agencyId_originalTicketId_idx" ON "InvoiceReissueLine"("agencyId", "originalTicketId");

-- CreateIndex
CREATE INDEX "InvoiceReissueLine_agencyId_journeyDate_idx" ON "InvoiceReissueLine"("agencyId", "journeyDate");

-- CreateIndex
CREATE INDEX "InvoiceReissueLine_invoiceId_idx" ON "InvoiceReissueLine"("invoiceId");

-- CreateIndex
CREATE INDEX "Refund_agencyId_createdAt_idx" ON "Refund"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "Refund_agencyId_type_date_idx" ON "Refund"("agencyId", "type", "date");

-- CreateIndex
CREATE INDEX "Refund_agencyId_invoiceId_idx" ON "Refund"("agencyId", "invoiceId");

-- CreateIndex
CREATE INDEX "Refund_agencyId_clientId_idx" ON "Refund"("agencyId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_agencyId_number_key" ON "Refund"("agencyId", "number");

-- CreateIndex
CREATE INDEX "RefundLine_agencyId_lineId_idx" ON "RefundLine"("agencyId", "lineId");

-- CreateIndex
CREATE INDEX "RefundLine_refundId_idx" ON "RefundLine"("refundId");

-- AddForeignKey
ALTER TABLE "InvoiceReissueLine" ADD CONSTRAINT "InvoiceReissueLine_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceReissueLine" ADD CONSTRAINT "InvoiceReissueLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceReissueLine" ADD CONSTRAINT "InvoiceReissueLine_originalTicketId_fkey" FOREIGN KEY ("originalTicketId") REFERENCES "InvoiceAirTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceReissueLine" ADD CONSTRAINT "InvoiceReissueLine_airlineId_fkey" FOREIGN KEY ("airlineId") REFERENCES "Airline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceReissueLine" ADD CONSTRAINT "InvoiceReissueLine_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_moneyAccountId_fkey" FOREIGN KEY ("moneyAccountId") REFERENCES "MoneyAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundLine" ADD CONSTRAINT "RefundLine_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundLine" ADD CONSTRAINT "RefundLine_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundLine" ADD CONSTRAINT "RefundLine_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
