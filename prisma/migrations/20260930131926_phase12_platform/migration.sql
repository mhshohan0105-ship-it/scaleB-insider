-- CreateEnum
CREATE TYPE "SmsStatus" AS ENUM ('SENT', 'FAILED', 'SIMULATED');

-- CreateEnum
CREATE TYPE "FeedbackKind" AS ENUM ('BUG', 'IDEA', 'QUESTION', 'OTHER');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('OPEN', 'DONE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SmsLog" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "status" "SmsStatus" NOT NULL,
    "providerRef" TEXT,
    "error" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "SmsLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "userId" TEXT,
    "kind" "FeedbackKind" NOT NULL DEFAULT 'IDEA',
    "message" TEXT NOT NULL,
    "page" TEXT,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'OPEN',
    "reply" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpersonationToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImpersonationToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsLog_agencyId_createdAt_idx" ON "SmsLog"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "SmsLog_agencyId_relatedType_relatedId_idx" ON "SmsLog"("agencyId", "relatedType", "relatedId");

-- CreateIndex
CREATE INDEX "Notification_agencyId_userId_readAt_idx" ON "Notification"("agencyId", "userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_agencyId_createdAt_idx" ON "Notification"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_agencyId_createdAt_idx" ON "Feedback"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_agencyId_status_idx" ON "Feedback"("agencyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ImpersonationToken_tokenHash_key" ON "ImpersonationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ImpersonationToken_adminUserId_createdAt_idx" ON "ImpersonationToken"("adminUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Invoice_agencyId_salesmanId_idx" ON "Invoice"("agencyId", "salesmanId");

-- CreateIndex
CREATE INDEX "InvoiceAirTicket_agencyId_airlineId_idx" ON "InvoiceAirTicket"("agencyId", "airlineId");

-- CreateIndex
CREATE INDEX "InvoiceItem_pilgrimId_idx" ON "InvoiceItem"("pilgrimId");

-- CreateIndex
CREATE INDEX "Voucher_investmentId_idx" ON "Voucher"("investmentId");

-- AddForeignKey
ALTER TABLE "SmsLog" ADD CONSTRAINT "SmsLog_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
