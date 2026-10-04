-- CreateEnum
CREATE TYPE "PilgrimStatus" AS ENUM ('PRE_REGISTERED', 'REGISTERED', 'TRANSFERRED_IN', 'TRANSFERRED_OUT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "PilgrimEventType" AS ENUM ('CREATED', 'UPDATED', 'REGISTERED', 'MOALLEM_TRANSFER', 'GROUP_TRANSFER', 'TRANSFER_IN', 'TRANSFER_OUT', 'CANCELLED_PRE_REG', 'CANCELLED_REG', 'TRANSFER_VOIDED');

-- CreateEnum
CREATE TYPE "HajjTransferType" AS ENUM ('MOALLEM', 'GROUP', 'IN', 'OUT');

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "pilgrimId" TEXT;

-- CreateTable
CREATE TABLE "Pilgrim" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" "Gender",
    "dateOfBirth" DATE,
    "passportNo" TEXT,
    "passportExpiry" DATE,
    "nidNo" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "hajjYear" INTEGER NOT NULL,
    "trackingNo" TEXT,
    "preRegNo" TEXT,
    "preRegDate" DATE,
    "regNo" TEXT,
    "regDate" DATE,
    "voucherNo" TEXT,
    "groupId" TEXT,
    "maharamId" TEXT,
    "maharamName" TEXT,
    "moallem" TEXT,
    "status" "PilgrimStatus" NOT NULL DEFAULT 'PRE_REGISTERED',
    "transferredFrom" TEXT,
    "transferredTo" TEXT,
    "cancelledDate" DATE,
    "cancelReason" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Pilgrim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PilgrimEvent" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "pilgrimId" TEXT NOT NULL,
    "type" "PilgrimEventType" NOT NULL,
    "date" DATE NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "note" TEXT,
    "transferId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "PilgrimEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HajjTransfer" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "HajjTransferType" NOT NULL,
    "date" DATE NOT NULL,
    "toLabel" TEXT NOT NULL,
    "toGroupId" TEXT,
    "chargePerPilgrim" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalCharge" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "DocumentStatus" NOT NULL DEFAULT 'POSTED',
    "note" TEXT,
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "HajjTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HajjTransferLine" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "pilgrimId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fromValue" TEXT,
    "fromStatus" "PilgrimStatus",
    "charge" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "HajjTransferLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pilgrim_agencyId_createdAt_idx" ON "Pilgrim"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "Pilgrim_agencyId_hajjYear_status_idx" ON "Pilgrim"("agencyId", "hajjYear", "status");

-- CreateIndex
CREATE INDEX "Pilgrim_agencyId_trackingNo_idx" ON "Pilgrim"("agencyId", "trackingNo");

-- CreateIndex
CREATE INDEX "Pilgrim_agencyId_clientId_idx" ON "Pilgrim"("agencyId", "clientId");

-- CreateIndex
CREATE INDEX "PilgrimEvent_agencyId_createdAt_idx" ON "PilgrimEvent"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "PilgrimEvent_pilgrimId_idx" ON "PilgrimEvent"("pilgrimId");

-- CreateIndex
CREATE INDEX "HajjTransfer_agencyId_createdAt_idx" ON "HajjTransfer"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "HajjTransfer_agencyId_type_date_idx" ON "HajjTransfer"("agencyId", "type", "date");

-- CreateIndex
CREATE UNIQUE INDEX "HajjTransfer_agencyId_number_key" ON "HajjTransfer"("agencyId", "number");

-- CreateIndex
CREATE INDEX "HajjTransferLine_transferId_idx" ON "HajjTransferLine"("transferId");

-- CreateIndex
CREATE INDEX "HajjTransferLine_agencyId_pilgrimId_idx" ON "HajjTransferLine"("agencyId", "pilgrimId");

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_pilgrimId_fkey" FOREIGN KEY ("pilgrimId") REFERENCES "Pilgrim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pilgrim" ADD CONSTRAINT "Pilgrim_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pilgrim" ADD CONSTRAINT "Pilgrim_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pilgrim" ADD CONSTRAINT "Pilgrim_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pilgrim" ADD CONSTRAINT "Pilgrim_maharamId_fkey" FOREIGN KEY ("maharamId") REFERENCES "Maharam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilgrimEvent" ADD CONSTRAINT "PilgrimEvent_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilgrimEvent" ADD CONSTRAINT "PilgrimEvent_pilgrimId_fkey" FOREIGN KEY ("pilgrimId") REFERENCES "Pilgrim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HajjTransfer" ADD CONSTRAINT "HajjTransfer_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HajjTransfer" ADD CONSTRAINT "HajjTransfer_toGroupId_fkey" FOREIGN KEY ("toGroupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HajjTransferLine" ADD CONSTRAINT "HajjTransferLine_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HajjTransferLine" ADD CONSTRAINT "HajjTransferLine_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "HajjTransfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HajjTransferLine" ADD CONSTRAINT "HajjTransferLine_pilgrimId_fkey" FOREIGN KEY ("pilgrimId") REFERENCES "Pilgrim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
