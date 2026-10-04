-- AlterEnum
ALTER TYPE "VoucherKind" ADD VALUE 'SET_OFF';
-- AlterTable
ALTER TABLE "CombinedClient" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "vendorId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CombinedClient_agencyId_clientId_key" ON "CombinedClient"("agencyId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "CombinedClient_agencyId_vendorId_key" ON "CombinedClient"("agencyId", "vendorId");

-- AddForeignKey
ALTER TABLE "CombinedClient" ADD CONSTRAINT "CombinedClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CombinedClient" ADD CONSTRAINT "CombinedClient_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
