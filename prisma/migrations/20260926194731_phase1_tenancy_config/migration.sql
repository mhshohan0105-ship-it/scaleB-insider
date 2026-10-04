-- CreateEnum
CREATE TYPE "AitBase" AS ENUM ('BASE_FARE', 'TOTAL_FARE');

-- CreateEnum
CREATE TYPE "CommissionBase" AS ENUM ('BASE_FARE', 'TOTAL_FARE');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('AIR', 'VISA', 'TOUR', 'HAJJ', 'UMRAH', 'HOTEL', 'INSURANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "GroupType" AS ENUM ('HAJJ', 'UMRAH', 'TOUR');

-- AlterTable
ALTER TABLE "Agency" ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "createdById" TEXT;

-- CreateTable
CREATE TABLE "AgencySetting" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "aitRatePercent" DECIMAL(7,4) NOT NULL DEFAULT 0.3,
    "aitBase" "AitBase" NOT NULL DEFAULT 'TOTAL_FARE',
    "commissionBase" "CommissionBase" NOT NULL DEFAULT 'BASE_FARE',
    "invoicePrefixes" JSONB NOT NULL DEFAULT '{}',
    "invoiceTerms" TEXT,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultMoneyAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "AgencySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientCategory" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "ClientCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "iso2" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Airport" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "iata" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "country" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Airport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Airline" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "iata" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commissionBase" "CommissionBase",
    "commissionPercent" DECIMAL(7,4),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Airline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProductType" NOT NULL DEFAULT 'OTHER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisaType" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "VisaType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Designation" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Designation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designationId" TEXT,
    "departmentId" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "nid" TEXT,
    "salary" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "commissionPercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "joinDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomType" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "RoomType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportType" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "TransportType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassportStatus" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "PassportStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "GroupType" NOT NULL DEFAULT 'HAJJ',
    "year" INTEGER,
    "leaderName" TEXT,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Maharam" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Maharam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cityId" TEXT,
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vendorId" TEXT,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TourGroup" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "TourGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TourTicket" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vendorId" TEXT,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "TourTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guide" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vendorId" TEXT,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Guide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transport" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vendorId" TEXT,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Transport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Food" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vendorId" TEXT,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Food_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Accommodation" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cityId" TEXT,
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vendorId" TEXT,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Accommodation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtherTransport" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vendorId" TEXT,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "OtherTransport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgencySetting_agencyId_key" ON "AgencySetting"("agencyId");

-- CreateIndex
CREATE INDEX "ClientCategory_agencyId_createdAt_idx" ON "ClientCategory"("agencyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientCategory_agencyId_name_key" ON "ClientCategory"("agencyId", "name");

-- CreateIndex
CREATE INDEX "Country_agencyId_createdAt_idx" ON "Country"("agencyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Country_agencyId_name_key" ON "Country"("agencyId", "name");

-- CreateIndex
CREATE INDEX "Airport_agencyId_createdAt_idx" ON "Airport"("agencyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Airport_agencyId_iata_key" ON "Airport"("agencyId", "iata");

-- CreateIndex
CREATE INDEX "Airline_agencyId_createdAt_idx" ON "Airline"("agencyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Airline_agencyId_iata_key" ON "Airline"("agencyId", "iata");

-- CreateIndex
CREATE INDEX "Product_agencyId_createdAt_idx" ON "Product"("agencyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Product_agencyId_name_key" ON "Product"("agencyId", "name");

-- CreateIndex
CREATE INDEX "VisaType_agencyId_createdAt_idx" ON "VisaType"("agencyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VisaType_agencyId_name_key" ON "VisaType"("agencyId", "name");

-- CreateIndex
CREATE INDEX "Department_agencyId_createdAt_idx" ON "Department"("agencyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Department_agencyId_name_key" ON "Department"("agencyId", "name");

-- CreateIndex
CREATE INDEX "Designation_agencyId_createdAt_idx" ON "Designation"("agencyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Designation_agencyId_name_key" ON "Designation"("agencyId", "name");

-- CreateIndex
CREATE INDEX "Employee_agencyId_createdAt_idx" ON "Employee"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "Employee_agencyId_name_idx" ON "Employee"("agencyId", "name");

-- CreateIndex
CREATE INDEX "RoomType_agencyId_createdAt_idx" ON "RoomType"("agencyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RoomType_agencyId_name_key" ON "RoomType"("agencyId", "name");

-- CreateIndex
CREATE INDEX "TransportType_agencyId_createdAt_idx" ON "TransportType"("agencyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TransportType_agencyId_name_key" ON "TransportType"("agencyId", "name");

-- CreateIndex
CREATE INDEX "PassportStatus_agencyId_createdAt_idx" ON "PassportStatus"("agencyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PassportStatus_agencyId_name_key" ON "PassportStatus"("agencyId", "name");

-- CreateIndex
CREATE INDEX "Group_agencyId_createdAt_idx" ON "Group"("agencyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Group_agencyId_name_key" ON "Group"("agencyId", "name");

-- CreateIndex
CREATE INDEX "Maharam_agencyId_createdAt_idx" ON "Maharam"("agencyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Maharam_agencyId_name_key" ON "Maharam"("agencyId", "name");

-- CreateIndex
CREATE INDEX "Company_agencyId_createdAt_idx" ON "Company"("agencyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Company_agencyId_name_key" ON "Company"("agencyId", "name");

-- CreateIndex
CREATE INDEX "City_agencyId_createdAt_idx" ON "City"("agencyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "City_agencyId_name_key" ON "City"("agencyId", "name");

-- CreateIndex
CREATE INDEX "Place_agencyId_createdAt_idx" ON "Place"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "TourGroup_agencyId_createdAt_idx" ON "TourGroup"("agencyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TourGroup_agencyId_name_key" ON "TourGroup"("agencyId", "name");

-- CreateIndex
CREATE INDEX "TourTicket_agencyId_createdAt_idx" ON "TourTicket"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "Guide_agencyId_createdAt_idx" ON "Guide"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "Transport_agencyId_createdAt_idx" ON "Transport"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "Food_agencyId_createdAt_idx" ON "Food"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "Accommodation_agencyId_createdAt_idx" ON "Accommodation"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "OtherTransport_agencyId_createdAt_idx" ON "OtherTransport"("agencyId", "createdAt");

-- AddForeignKey
ALTER TABLE "AgencySetting" ADD CONSTRAINT "AgencySetting_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCategory" ADD CONSTRAINT "ClientCategory_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Country" ADD CONSTRAINT "Country_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Airport" ADD CONSTRAINT "Airport_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Airline" ADD CONSTRAINT "Airline_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisaType" ADD CONSTRAINT "VisaType_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Designation" ADD CONSTRAINT "Designation_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomType" ADD CONSTRAINT "RoomType_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportType" ADD CONSTRAINT "TransportType_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassportStatus" ADD CONSTRAINT "PassportStatus_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maharam" ADD CONSTRAINT "Maharam_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourGroup" ADD CONSTRAINT "TourGroup_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourTicket" ADD CONSTRAINT "TourTicket_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guide" ADD CONSTRAINT "Guide_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transport" ADD CONSTRAINT "Transport_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Food" ADD CONSTRAINT "Food_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accommodation" ADD CONSTRAINT "Accommodation_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accommodation" ADD CONSTRAINT "Accommodation_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtherTransport" ADD CONSTRAINT "OtherTransport_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
