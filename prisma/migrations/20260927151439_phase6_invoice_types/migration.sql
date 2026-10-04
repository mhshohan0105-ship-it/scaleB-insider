-- CreateEnum
CREATE TYPE "ItemKind" AS ENUM ('SERVICE', 'PACKAGE', 'ACCOMMODATION', 'TRANSPORT', 'OTHER_TRANSPORT', 'GUIDE', 'FOOD', 'PLACE', 'TOUR_TICKET', 'PILGRIM');

-- CreateEnum
CREATE TYPE "VisaStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'DELIVERED');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "returnDate" DATE,
ADD COLUMN     "tourGroupId" TEXT,
ADD COLUMN     "travelDate" DATE;

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "kind" "ItemKind" NOT NULL DEFAULT 'SERVICE',
    "productId" TEXT,
    "sourceId" TEXT,
    "description" TEXT NOT NULL,
    "qty" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "clientPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "purchasePrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "profit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vendorId" TEXT,
    "passengerName" TEXT,
    "passportNo" TEXT,
    "groupId" TEXT,
    "roomTypeId" TEXT,
    "serviceDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceVisaLine" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "country" TEXT NOT NULL,
    "visaTypeId" TEXT,
    "passengerName" TEXT NOT NULL,
    "passportNo" TEXT,
    "vendorId" TEXT NOT NULL,
    "clientPrice" DECIMAL(14,2) NOT NULL,
    "purchasePrice" DECIMAL(14,2) NOT NULL,
    "profit" DECIMAL(14,2) NOT NULL,
    "status" "VisaStatus" NOT NULL DEFAULT 'PENDING',
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusHistory" JSONB NOT NULL DEFAULT '[]',
    "expectedDate" DATE,
    "deliveryDate" DATE,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceVisaLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceItem_agencyId_createdAt_idx" ON "InvoiceItem"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "InvoiceItem_agencyId_vendorId_idx" ON "InvoiceItem"("agencyId", "vendorId");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceVisaLine_agencyId_createdAt_idx" ON "InvoiceVisaLine"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "InvoiceVisaLine_agencyId_status_idx" ON "InvoiceVisaLine"("agencyId", "status");

-- CreateIndex
CREATE INDEX "InvoiceVisaLine_agencyId_vendorId_idx" ON "InvoiceVisaLine"("agencyId", "vendorId");

-- CreateIndex
CREATE INDEX "InvoiceVisaLine_invoiceId_idx" ON "InvoiceVisaLine"("invoiceId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tourGroupId_fkey" FOREIGN KEY ("tourGroupId") REFERENCES "TourGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceVisaLine" ADD CONSTRAINT "InvoiceVisaLine_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceVisaLine" ADD CONSTRAINT "InvoiceVisaLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceVisaLine" ADD CONSTRAINT "InvoiceVisaLine_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceVisaLine" ADD CONSTRAINT "InvoiceVisaLine_visaTypeId_fkey" FOREIGN KEY ("visaTypeId") REFERENCES "VisaType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
