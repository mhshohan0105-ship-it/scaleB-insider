-- CreateTable
CREATE TABLE "VoucherAllocation" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoucherAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoucherAllocation_agencyId_invoiceId_idx" ON "VoucherAllocation"("agencyId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "VoucherAllocation_voucherId_invoiceId_key" ON "VoucherAllocation"("voucherId", "invoiceId");

-- AddForeignKey
ALTER TABLE "VoucherAllocation" ADD CONSTRAINT "VoucherAllocation_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherAllocation" ADD CONSTRAINT "VoucherAllocation_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherAllocation" ADD CONSTRAINT "VoucherAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

