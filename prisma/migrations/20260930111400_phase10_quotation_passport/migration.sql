-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CONVERTED');

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "passportId" TEXT;

-- CreateTable
CREATE TABLE "Passport" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "passportNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT,
    "gender" "Gender",
    "dateOfBirth" DATE,
    "nationality" TEXT NOT NULL DEFAULT 'Bangladeshi',
    "placeOfIssue" TEXT,
    "issueDate" DATE,
    "expiryDate" DATE NOT NULL,
    "phone" TEXT,
    "statusId" TEXT,
    "statusHistory" JSONB NOT NULL DEFAULT '[]',
    "receivedDate" DATE,
    "returnedDate" DATE,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Passport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "validUntil" DATE NOT NULL,
    "subject" TEXT,
    "invoiceType" "InvoiceType" NOT NULL DEFAULT 'OTHER',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "terms" TEXT,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "convertedInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationLine" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "qty" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vendorId" TEXT,
    "productId" TEXT,

    CONSTRAINT "QuotationLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Passport_agencyId_createdAt_idx" ON "Passport"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "Passport_agencyId_expiryDate_idx" ON "Passport"("agencyId", "expiryDate");

-- CreateIndex
CREATE INDEX "Passport_agencyId_clientId_idx" ON "Passport"("agencyId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Passport_agencyId_passportNo_key" ON "Passport"("agencyId", "passportNo");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_convertedInvoiceId_key" ON "Quotation"("convertedInvoiceId");

-- CreateIndex
CREATE INDEX "Quotation_agencyId_createdAt_idx" ON "Quotation"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "Quotation_agencyId_clientId_idx" ON "Quotation"("agencyId", "clientId");

-- CreateIndex
CREATE INDEX "Quotation_agencyId_status_idx" ON "Quotation"("agencyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_agencyId_number_key" ON "Quotation"("agencyId", "number");

-- CreateIndex
CREATE INDEX "QuotationLine_quotationId_idx" ON "QuotationLine"("quotationId");

-- CreateIndex
CREATE INDEX "Attachment_passportId_idx" ON "Attachment"("passportId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_passportId_fkey" FOREIGN KEY ("passportId") REFERENCES "Passport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passport" ADD CONSTRAINT "Passport_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passport" ADD CONSTRAINT "Passport_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passport" ADD CONSTRAINT "Passport_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "PassportStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_convertedInvoiceId_fkey" FOREIGN KEY ("convertedInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationLine" ADD CONSTRAINT "QuotationLine_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationLine" ADD CONSTRAINT "QuotationLine_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationLine" ADD CONSTRAINT "QuotationLine_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationLine" ADD CONSTRAINT "QuotationLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
