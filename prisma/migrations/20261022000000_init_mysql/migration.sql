-- CreateTable
CREATE TABLE `Agency` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` TEXT NOT NULL,
    `logoUrl` TEXT NULL,
    `address` TEXT NULL,
    `phone` TEXT NULL,
    `email` TEXT NULL,
    `website` TEXT NULL,
    `tradeLicense` TEXT NULL,
    `iataNo` TEXT NULL,
    `currency` TEXT NOT NULL DEFAULT 'BDT',
    `fiscalYearStart` INTEGER NOT NULL DEFAULT 7,
    `invoiceFooter` TEXT NULL,
    `status` ENUM('ACTIVE', 'SUSPENDED', 'TRIAL') NOT NULL DEFAULT 'ACTIVE',
    `plan` TEXT NOT NULL DEFAULT 'standard',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Agency_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgencySetting` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `aitRatePercent` DECIMAL(7, 4) NOT NULL DEFAULT 0.3,
    `aitBase` ENUM('BASE_FARE', 'TOTAL_FARE') NOT NULL DEFAULT 'TOTAL_FARE',
    `commissionBase` ENUM('BASE_FARE', 'TOTAL_FARE') NOT NULL DEFAULT 'BASE_FARE',
    `invoicePrefixes` JSON NOT NULL,
    `invoiceTerms` TEXT NULL,
    `smsEnabled` BOOLEAN NOT NULL DEFAULT false,
    `defaultMoneyAccountId` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedById` TEXT NULL,

    UNIQUE INDEX `AgencySetting_agencyId_key`(`agencyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `permissions` JSON NOT NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `Role_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    UNIQUE INDEX `Role_agencyId_name_key`(`agencyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `name` TEXT NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `email` TEXT NULL,
    `phone` TEXT NULL,
    `passwordHash` TEXT NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isSuperAdmin` BOOLEAN NOT NULL DEFAULT false,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `User_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    UNIQUE INDEX `User_agencyId_username_key`(`agencyId`, `username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoginHistory` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `username` VARCHAR(191) NOT NULL,
    `ip` TEXT NULL,
    `userAgent` TEXT NULL,
    `success` BOOLEAN NOT NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LoginHistory_agencyId_at_idx`(`agencyId`, `at`),
    INDEX `LoginHistory_username_at_idx`(`username`, `at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `userId` TEXT NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `ip` TEXT NULL,
    `userAgent` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    INDEX `AuditLog_agencyId_entity_entityId_idx`(`agencyId`, `entity`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClientCategory` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `prefix` TEXT NULL,
    `note` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `ClientCategory_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    UNIQUE INDEX `ClientCategory_agencyId_name_key`(`agencyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Country` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `iso2` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `Country_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    UNIQUE INDEX `Country_agencyId_name_key`(`agencyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Airport` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `iata` VARCHAR(191) NOT NULL,
    `name` TEXT NOT NULL,
    `city` TEXT NULL,
    `country` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `Airport_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    UNIQUE INDEX `Airport_agencyId_iata_key`(`agencyId`, `iata`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Airline` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `iata` VARCHAR(191) NOT NULL,
    `name` TEXT NOT NULL,
    `commissionBase` ENUM('BASE_FARE', 'TOTAL_FARE') NULL,
    `commissionPercent` DECIMAL(7, 4) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `Airline_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    UNIQUE INDEX `Airline_agencyId_iata_key`(`agencyId`, `iata`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('AIR', 'VISA', 'TOUR', 'HAJJ', 'UMRAH', 'HOTEL', 'INSURANCE', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `Product_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    UNIQUE INDEX `Product_agencyId_name_key`(`agencyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VisaType` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `VisaType_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    UNIQUE INDEX `VisaType_agencyId_name_key`(`agencyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Department` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `Department_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    UNIQUE INDEX `Department_agencyId_name_key`(`agencyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Designation` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `Designation_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    UNIQUE INDEX `Designation_agencyId_name_key`(`agencyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Employee` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `designationId` VARCHAR(191) NULL,
    `departmentId` VARCHAR(191) NULL,
    `phone` TEXT NULL,
    `email` TEXT NULL,
    `address` TEXT NULL,
    `nid` TEXT NULL,
    `salary` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `commissionPercent` DECIMAL(7, 4) NOT NULL DEFAULT 0,
    `joinDate` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `Employee_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    INDEX `Employee_agencyId_name_idx`(`agencyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RoomType` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `RoomType_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    UNIQUE INDEX `RoomType_agencyId_name_key`(`agencyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TransportType` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `TransportType_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    UNIQUE INDEX `TransportType_agencyId_name_key`(`agencyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PassportStatus` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `PassportStatus_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    UNIQUE INDEX `PassportStatus_agencyId_name_key`(`agencyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Group` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('HAJJ', 'UMRAH', 'TOUR') NOT NULL DEFAULT 'HAJJ',
    `year` INTEGER NULL,
    `leaderName` TEXT NULL,
    `note` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `Group_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    UNIQUE INDEX `Group_agencyId_name_key`(`agencyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Maharam` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `Maharam_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    UNIQUE INDEX `Maharam_agencyId_name_key`(`agencyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Company` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `contactPerson` TEXT NULL,
    `phone` TEXT NULL,
    `email` TEXT NULL,
    `address` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `Company_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    UNIQUE INDEX `Company_agencyId_name_key`(`agencyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `City` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `country` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `City_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    UNIQUE INDEX `City_agencyId_name_key`(`agencyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Place` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `name` TEXT NOT NULL,
    `cityId` VARCHAR(191) NULL,
    `cost` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `vendorId` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `Place_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TourGroup` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `TourGroup_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    UNIQUE INDEX `TourGroup_agencyId_name_key`(`agencyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TourTicket` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `name` TEXT NOT NULL,
    `cost` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `vendorId` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `TourTicket_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Guide` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `name` TEXT NOT NULL,
    `phone` TEXT NULL,
    `cost` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `vendorId` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `Guide_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Transport` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `name` TEXT NOT NULL,
    `cost` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `vendorId` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `Transport_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Food` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `name` TEXT NOT NULL,
    `cost` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `vendorId` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `Food_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Accommodation` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `name` TEXT NOT NULL,
    `cityId` VARCHAR(191) NULL,
    `cost` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `vendorId` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `Accommodation_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OtherTransport` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `name` TEXT NOT NULL,
    `cost` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `vendorId` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `OtherTransport_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Client` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('INDIVIDUAL', 'CORPORATE') NOT NULL DEFAULT 'INDIVIDUAL',
    `categoryId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` TEXT NULL,
    `address` TEXT NULL,
    `walkingCustomer` BOOLEAN NOT NULL DEFAULT false,
    `creditLimit` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `openingBalance` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `openingBalanceType` ENUM('RECEIVABLE', 'PAYABLE') NOT NULL DEFAULT 'RECEIVABLE',
    `balance` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `note` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `Client_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    INDEX `Client_agencyId_name_idx`(`agencyId`, `name`),
    INDEX `Client_agencyId_phone_idx`(`agencyId`, `phone`),
    UNIQUE INDEX `Client_agencyId_code_key`(`agencyId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CombinedClient` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `contactPerson` TEXT NULL,
    `phone` TEXT NULL,
    `email` TEXT NULL,
    `address` TEXT NULL,
    `openingBalance` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `openingBalanceType` ENUM('RECEIVABLE', 'PAYABLE') NOT NULL DEFAULT 'RECEIVABLE',
    `balance` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `note` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,
    `clientId` VARCHAR(191) NULL,
    `vendorId` VARCHAR(191) NULL,

    INDEX `CombinedClient_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    INDEX `CombinedClient_agencyId_name_idx`(`agencyId`, `name`),
    UNIQUE INDEX `CombinedClient_agencyId_code_key`(`agencyId`, `code`),
    UNIQUE INDEX `CombinedClient_agencyId_clientId_key`(`agencyId`, `clientId`),
    UNIQUE INDEX `CombinedClient_agencyId_vendorId_key`(`agencyId`, `vendorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Vendor` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('AIRLINE', 'AIRLINE_CONSOLIDATOR', 'GDS', 'VISA', 'HOTEL', 'TRANSPORT', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `contactPerson` TEXT NULL,
    `phone` TEXT NULL,
    `email` TEXT NULL,
    `address` TEXT NULL,
    `bankInfo` TEXT NULL,
    `commissionPercent` DECIMAL(7, 4) NOT NULL DEFAULT 0,
    `openingBalance` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `openingBalanceType` ENUM('RECEIVABLE', 'PAYABLE') NOT NULL DEFAULT 'PAYABLE',
    `balance` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `note` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `Vendor_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    INDEX `Vendor_agencyId_name_idx`(`agencyId`, `name`),
    UNIQUE INDEX `Vendor_agencyId_code_key`(`agencyId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Agent` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` TEXT NULL,
    `email` TEXT NULL,
    `address` TEXT NULL,
    `commissionPercent` DECIMAL(7, 4) NOT NULL DEFAULT 0,
    `openingBalance` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `openingBalanceType` ENUM('RECEIVABLE', 'PAYABLE') NOT NULL DEFAULT 'PAYABLE',
    `balance` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `note` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `Agent_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    INDEX `Agent_agencyId_name_idx`(`agencyId`, `name`),
    UNIQUE INDEX `Agent_agencyId_code_key`(`agencyId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentSequence` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `docType` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `lastNumber` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DocumentSequence_agencyId_docType_year_key`(`agencyId`, `docType`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LedgerAccount` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` TEXT NOT NULL,
    `type` ENUM('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE') NOT NULL,
    `systemKey` VARCHAR(191) NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `parentId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `LedgerAccount_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    UNIQUE INDEX `LedgerAccount_agencyId_code_key`(`agencyId`, `code`),
    UNIQUE INDEX `LedgerAccount_agencyId_systemKey_key`(`agencyId`, `systemKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MoneyAccount` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `kind` ENUM('CASH', 'BANK', 'MOBILE_BANKING', 'CREDIT_CARD') NOT NULL DEFAULT 'CASH',
    `bankName` TEXT NULL,
    `accountNoMasked` TEXT NULL,
    `branch` TEXT NULL,
    `ledgerAccountId` VARCHAR(191) NOT NULL,
    `openingBalance` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `balance` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `note` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    UNIQUE INDEX `MoneyAccount_ledgerAccountId_key`(`ledgerAccountId`),
    INDEX `MoneyAccount_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    UNIQUE INDEX `MoneyAccount_agencyId_name_key`(`agencyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JournalEntry` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `sourceType` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NULL,
    `narration` TEXT NOT NULL,
    `isReversal` BOOLEAN NOT NULL DEFAULT false,
    `reversalOfId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` TEXT NULL,

    UNIQUE INDEX `JournalEntry_reversalOfId_key`(`reversalOfId`),
    INDEX `JournalEntry_agencyId_sourceType_sourceId_idx`(`agencyId`, `sourceType`, `sourceId`),
    INDEX `JournalEntry_agencyId_date_idx`(`agencyId`, `date`),
    INDEX `JournalEntry_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    UNIQUE INDEX `JournalEntry_agencyId_number_key`(`agencyId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JournalLine` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `entryId` VARCHAR(191) NOT NULL,
    `ledgerAccountId` VARCHAR(191) NOT NULL,
    `debit` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `credit` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `partyType` ENUM('CLIENT', 'COMBINED', 'VENDOR', 'AGENT', 'EMPLOYEE', 'LOAN_AUTHORITY') NULL,
    `partyId` VARCHAR(191) NULL,
    `moneyAccountId` VARCHAR(191) NULL,
    `memo` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `JournalLine_agencyId_ledgerAccountId_partyType_partyId_idx`(`agencyId`, `ledgerAccountId`, `partyType`, `partyId`),
    INDEX `JournalLine_agencyId_partyType_partyId_idx`(`agencyId`, `partyType`, `partyId`),
    INDEX `JournalLine_agencyId_moneyAccountId_idx`(`agencyId`, `moneyAccountId`),
    INDEX `JournalLine_entryId_idx`(`entryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AccountingPeriod` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `isClosed` BOOLEAN NOT NULL DEFAULT true,
    `closedAt` DATETIME(3) NULL,
    `closedById` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AccountingPeriod_agencyId_year_month_key`(`agencyId`, `year`, `month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BalanceTransfer` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `fromAccountId` VARCHAR(191) NOT NULL,
    `toAccountId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `charge` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `note` TEXT NULL,
    `status` ENUM('POSTED', 'VOID') NOT NULL DEFAULT 'POSTED',
    `voidReason` TEXT NULL,
    `voidedAt` DATETIME(3) NULL,
    `voidedById` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `BalanceTransfer_agencyId_date_idx`(`agencyId`, `date`),
    INDEX `BalanceTransfer_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    UNIQUE INDEX `BalanceTransfer_agencyId_number_key`(`agencyId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invoice` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `type` ENUM('AIR', 'NON_COMMISSION', 'REISSUE', 'OTHER', 'OTHER_PACKAGE', 'VISA', 'TOUR', 'HAJJ_PRE_REG', 'HAJJ', 'UMRAH') NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `agentId` VARCHAR(191) NULL,
    `salesmanId` VARCHAR(191) NULL,
    `date` DATE NOT NULL,
    `dueDate` DATE NULL,
    `subtotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `discount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `serviceCharge` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `vat` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `netTotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `totalCost` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `profit` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `agentCommission` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `paidAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `refundCredit` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `refundCost` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `status` ENUM('DRAFT', 'POSTED', 'PARTIAL', 'PAID', 'VOID', 'REFUNDED') NOT NULL DEFAULT 'DRAFT',
    `note` TEXT NULL,
    `currency` TEXT NOT NULL DEFAULT 'BDT',
    `exchangeRate` DECIMAL(14, 6) NOT NULL DEFAULT 1,
    `reissueOfId` TEXT NULL,
    `tourGroupId` VARCHAR(191) NULL,
    `groupId` VARCHAR(191) NULL,
    `travelDate` DATE NULL,
    `returnDate` DATE NULL,
    `postedAt` DATETIME(3) NULL,
    `voidReason` TEXT NULL,
    `voidedAt` DATETIME(3) NULL,
    `voidedById` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `Invoice_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    INDEX `Invoice_agencyId_type_date_idx`(`agencyId`, `type`, `date`),
    INDEX `Invoice_agencyId_clientId_idx`(`agencyId`, `clientId`),
    INDEX `Invoice_agencyId_status_idx`(`agencyId`, `status`),
    INDEX `Invoice_agencyId_salesmanId_idx`(`agencyId`, `salesmanId`),
    UNIQUE INDEX `Invoice_agencyId_number_key`(`agencyId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceAirTicket` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `ticketNo` VARCHAR(191) NOT NULL,
    `pnr` TEXT NULL,
    `gdsPnr` TEXT NULL,
    `gds` TEXT NULL,
    `airlineId` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `passengerName` TEXT NOT NULL,
    `passengerType` ENUM('ADT', 'CHD', 'INF') NOT NULL DEFAULT 'ADT',
    `passportNo` TEXT NULL,
    `route` TEXT NOT NULL,
    `segmentCount` INTEGER NOT NULL DEFAULT 1,
    `journeyDate` DATE NOT NULL,
    `returnDate` DATE NULL,
    `cabinClass` TEXT NULL,
    `baseFare` DECIMAL(14, 2) NOT NULL,
    `taxes` JSON NOT NULL,
    `taxTotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `totalFare` DECIMAL(14, 2) NOT NULL,
    `commissionPercent` DECIMAL(7, 4) NOT NULL DEFAULT 0,
    `commissionAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `aitAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `clientPrice` DECIMAL(14, 2) NOT NULL,
    `purchasePrice` DECIMAL(14, 2) NOT NULL,
    `profit` DECIMAL(14, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InvoiceAirTicket_agencyId_ticketNo_idx`(`agencyId`, `ticketNo`),
    INDEX `InvoiceAirTicket_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    INDEX `InvoiceAirTicket_agencyId_vendorId_idx`(`agencyId`, `vendorId`),
    INDEX `InvoiceAirTicket_agencyId_journeyDate_idx`(`agencyId`, `journeyDate`),
    INDEX `InvoiceAirTicket_invoiceId_idx`(`invoiceId`),
    INDEX `InvoiceAirTicket_agencyId_airlineId_idx`(`agencyId`, `airlineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MoneyReceipt` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `moneyAccountId` VARCHAR(191) NOT NULL,
    `paymentMethod` ENUM('CASH', 'BANK', 'MOBILE', 'CARD', 'CHEQUE') NOT NULL DEFAULT 'CASH',
    `transactionCharge` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `reference` TEXT NULL,
    `note` TEXT NULL,
    `status` ENUM('POSTED', 'VOID') NOT NULL DEFAULT 'POSTED',
    `voidReason` TEXT NULL,
    `voidedAt` DATETIME(3) NULL,
    `voidedById` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `MoneyReceipt_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    INDEX `MoneyReceipt_agencyId_clientId_idx`(`agencyId`, `clientId`),
    INDEX `MoneyReceipt_agencyId_date_idx`(`agencyId`, `date`),
    UNIQUE INDEX `MoneyReceipt_agencyId_number_key`(`agencyId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MoneyReceiptAllocation` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `receiptId` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MoneyReceiptAllocation_agencyId_invoiceId_idx`(`agencyId`, `invoiceId`),
    UNIQUE INDEX `MoneyReceiptAllocation_receiptId_invoiceId_key`(`receiptId`, `invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VendorPayment` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `moneyAccountId` VARCHAR(191) NOT NULL,
    `paymentMethod` ENUM('CASH', 'BANK', 'MOBILE', 'CARD', 'CHEQUE') NOT NULL DEFAULT 'BANK',
    `transactionCharge` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `reference` TEXT NULL,
    `note` TEXT NULL,
    `status` ENUM('POSTED', 'VOID') NOT NULL DEFAULT 'POSTED',
    `voidReason` TEXT NULL,
    `voidedAt` DATETIME(3) NULL,
    `voidedById` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `VendorPayment_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    INDEX `VendorPayment_agencyId_vendorId_idx`(`agencyId`, `vendorId`),
    INDEX `VendorPayment_agencyId_date_idx`(`agencyId`, `date`),
    UNIQUE INDEX `VendorPayment_agencyId_number_key`(`agencyId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdvanceReturn` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `partyType` ENUM('CLIENT', 'COMBINED', 'VENDOR', 'AGENT', 'EMPLOYEE', 'LOAN_AUTHORITY') NOT NULL,
    `partyId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `moneyAccountId` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `status` ENUM('POSTED', 'VOID') NOT NULL DEFAULT 'POSTED',
    `voidReason` TEXT NULL,
    `voidedAt` DATETIME(3) NULL,
    `voidedById` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `AdvanceReturn_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    INDEX `AdvanceReturn_agencyId_partyType_partyId_idx`(`agencyId`, `partyType`, `partyId`),
    UNIQUE INDEX `AdvanceReturn_agencyId_number_key`(`agencyId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceItem` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `kind` ENUM('SERVICE', 'PACKAGE', 'ACCOMMODATION', 'TRANSPORT', 'OTHER_TRANSPORT', 'GUIDE', 'FOOD', 'PLACE', 'TOUR_TICKET', 'PILGRIM') NOT NULL DEFAULT 'SERVICE',
    `productId` VARCHAR(191) NULL,
    `sourceId` TEXT NULL,
    `description` TEXT NOT NULL,
    `qty` DECIMAL(10, 2) NOT NULL DEFAULT 1,
    `unitPrice` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `unitCost` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `clientPrice` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `purchasePrice` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `profit` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `vendorId` VARCHAR(191) NULL,
    `passengerName` TEXT NULL,
    `passportNo` TEXT NULL,
    `groupId` VARCHAR(191) NULL,
    `roomTypeId` VARCHAR(191) NULL,
    `serviceDate` DATE NULL,
    `pilgrimId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InvoiceItem_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    INDEX `InvoiceItem_agencyId_vendorId_idx`(`agencyId`, `vendorId`),
    INDEX `InvoiceItem_invoiceId_idx`(`invoiceId`),
    INDEX `InvoiceItem_pilgrimId_idx`(`pilgrimId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceVisaLine` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `country` TEXT NOT NULL,
    `visaTypeId` VARCHAR(191) NULL,
    `passengerName` TEXT NOT NULL,
    `passportNo` TEXT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `clientPrice` DECIMAL(14, 2) NOT NULL,
    `purchasePrice` DECIMAL(14, 2) NOT NULL,
    `profit` DECIMAL(14, 2) NOT NULL,
    `status` ENUM('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'DELIVERED') NOT NULL DEFAULT 'PENDING',
    `statusChangedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `statusHistory` JSON NOT NULL,
    `expectedDate` DATE NULL,
    `deliveryDate` DATE NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InvoiceVisaLine_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    INDEX `InvoiceVisaLine_agencyId_status_idx`(`agencyId`, `status`),
    INDEX `InvoiceVisaLine_agencyId_vendorId_idx`(`agencyId`, `vendorId`),
    INDEX `InvoiceVisaLine_invoiceId_idx`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceReissueLine` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `originalTicketId` VARCHAR(191) NOT NULL,
    `ticketNo` TEXT NULL,
    `pnr` TEXT NULL,
    `passengerName` TEXT NOT NULL,
    `route` TEXT NOT NULL,
    `airlineId` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `journeyDate` DATE NOT NULL,
    `returnDate` DATE NULL,
    `penalty` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `fareDifference` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `serviceCharge` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `clientPrice` DECIMAL(14, 2) NOT NULL,
    `purchasePrice` DECIMAL(14, 2) NOT NULL,
    `profit` DECIMAL(14, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InvoiceReissueLine_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    INDEX `InvoiceReissueLine_agencyId_originalTicketId_idx`(`agencyId`, `originalTicketId`),
    INDEX `InvoiceReissueLine_agencyId_journeyDate_idx`(`agencyId`, `journeyDate`),
    INDEX `InvoiceReissueLine_invoiceId_idx`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Refund` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `type` ENUM('AIR', 'OTHER', 'TOUR', 'PARTIAL', 'OTHER_PACKAGE_HAJJ') NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `clientRefundAmount` DECIMAL(14, 2) NOT NULL,
    `clientCharge` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `vendorRefundAmount` DECIMAL(14, 2) NOT NULL,
    `vendorCharge` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `method` ENUM('CASH_RETURN', 'ADJUST_TO_BALANCE') NOT NULL,
    `returnAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `moneyAccountId` VARCHAR(191) NULL,
    `status` ENUM('POSTED', 'VOID') NOT NULL DEFAULT 'POSTED',
    `note` TEXT NULL,
    `voidReason` TEXT NULL,
    `voidedAt` DATETIME(3) NULL,
    `voidedById` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `Refund_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    INDEX `Refund_agencyId_type_date_idx`(`agencyId`, `type`, `date`),
    INDEX `Refund_agencyId_invoiceId_idx`(`agencyId`, `invoiceId`),
    INDEX `Refund_agencyId_clientId_idx`(`agencyId`, `clientId`),
    UNIQUE INDEX `Refund_agencyId_number_key`(`agencyId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefundLine` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `refundId` VARCHAR(191) NOT NULL,
    `lineKind` ENUM('TICKET', 'REISSUE', 'ITEM', 'VISA') NOT NULL,
    `lineId` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `vendorId` VARCHAR(191) NULL,
    `clientAmount` DECIMAL(14, 2) NOT NULL,
    `vendorAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `vendorCharge` DECIMAL(14, 2) NOT NULL DEFAULT 0,

    INDEX `RefundLine_agencyId_lineId_idx`(`agencyId`, `lineId`),
    INDEX `RefundLine_refundId_idx`(`refundId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Pilgrim` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `name` TEXT NOT NULL,
    `gender` ENUM('MALE', 'FEMALE') NULL,
    `dateOfBirth` DATE NULL,
    `passportNo` TEXT NULL,
    `passportExpiry` DATE NULL,
    `nidNo` TEXT NULL,
    `phone` TEXT NULL,
    `address` TEXT NULL,
    `hajjYear` INTEGER NOT NULL,
    `trackingNo` VARCHAR(191) NULL,
    `preRegNo` TEXT NULL,
    `preRegDate` DATE NULL,
    `regNo` TEXT NULL,
    `regDate` DATE NULL,
    `voucherNo` TEXT NULL,
    `groupId` VARCHAR(191) NULL,
    `maharamId` VARCHAR(191) NULL,
    `maharamName` TEXT NULL,
    `moallem` TEXT NULL,
    `status` ENUM('PRE_REGISTERED', 'REGISTERED', 'TRANSFERRED_IN', 'TRANSFERRED_OUT', 'CANCELLED') NOT NULL DEFAULT 'PRE_REGISTERED',
    `transferredFrom` TEXT NULL,
    `transferredTo` TEXT NULL,
    `cancelledDate` DATE NULL,
    `cancelReason` TEXT NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `Pilgrim_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    INDEX `Pilgrim_agencyId_hajjYear_status_idx`(`agencyId`, `hajjYear`, `status`),
    INDEX `Pilgrim_agencyId_trackingNo_idx`(`agencyId`, `trackingNo`),
    INDEX `Pilgrim_agencyId_clientId_idx`(`agencyId`, `clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PilgrimEvent` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `pilgrimId` VARCHAR(191) NOT NULL,
    `type` ENUM('CREATED', 'UPDATED', 'REGISTERED', 'MOALLEM_TRANSFER', 'GROUP_TRANSFER', 'TRANSFER_IN', 'TRANSFER_OUT', 'CANCELLED_PRE_REG', 'CANCELLED_REG', 'TRANSFER_VOIDED') NOT NULL,
    `date` DATE NOT NULL,
    `fromValue` TEXT NULL,
    `toValue` TEXT NULL,
    `note` TEXT NULL,
    `transferId` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` TEXT NULL,

    INDEX `PilgrimEvent_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    INDEX `PilgrimEvent_pilgrimId_idx`(`pilgrimId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HajjTransfer` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `type` ENUM('MOALLEM', 'GROUP', 'IN', 'OUT') NOT NULL,
    `date` DATE NOT NULL,
    `toLabel` TEXT NOT NULL,
    `toGroupId` VARCHAR(191) NULL,
    `chargePerPilgrim` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `totalCharge` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `status` ENUM('POSTED', 'VOID') NOT NULL DEFAULT 'POSTED',
    `note` TEXT NULL,
    `voidReason` TEXT NULL,
    `voidedAt` DATETIME(3) NULL,
    `voidedById` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `HajjTransfer_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    INDEX `HajjTransfer_agencyId_type_date_idx`(`agencyId`, `type`, `date`),
    UNIQUE INDEX `HajjTransfer_agencyId_number_key`(`agencyId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HajjTransferLine` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `transferId` VARCHAR(191) NOT NULL,
    `pilgrimId` VARCHAR(191) NOT NULL,
    `clientId` TEXT NOT NULL,
    `fromValue` TEXT NULL,
    `fromStatus` ENUM('PRE_REGISTERED', 'REGISTERED', 'TRANSFERRED_IN', 'TRANSFERRED_OUT', 'CANCELLED') NULL,
    `charge` DECIMAL(14, 2) NOT NULL DEFAULT 0,

    INDEX `HajjTransferLine_transferId_idx`(`transferId`),
    INDEX `HajjTransferLine_agencyId_pilgrimId_idx`(`agencyId`, `pilgrimId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExpenseHead` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `ledgerAccountId` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    UNIQUE INDEX `ExpenseHead_ledgerAccountId_key`(`ledgerAccountId`),
    INDEX `ExpenseHead_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    UNIQUE INDEX `ExpenseHead_agencyId_name_key`(`agencyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Voucher` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `kind` ENUM('EXPENSE', 'NON_INVOICE_INCOME', 'INCENTIVE_INCOME', 'AGENT_PAYMENT', 'EMPLOYEE_ADVANCE', 'BILL_ADJUSTMENT', 'INVESTMENT', 'INVESTMENT_RETURN', 'SET_OFF') NOT NULL,
    `date` DATE NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `profit` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `moneyAccountId` VARCHAR(191) NULL,
    `partyType` ENUM('CLIENT', 'COMBINED', 'VENDOR', 'AGENT', 'EMPLOYEE', 'LOAN_AUTHORITY') NULL,
    `partyId` VARCHAR(191) NULL,
    `expenseHeadId` VARCHAR(191) NULL,
    `direction` ENUM('INCREASE_DUE', 'DECREASE_DUE') NULL,
    `investmentId` VARCHAR(191) NULL,
    `title` TEXT NULL,
    `reference` TEXT NULL,
    `note` TEXT NULL,
    `status` ENUM('POSTED', 'VOID') NOT NULL DEFAULT 'POSTED',
    `voidReason` TEXT NULL,
    `voidedAt` DATETIME(3) NULL,
    `voidedById` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `Voucher_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    INDEX `Voucher_agencyId_kind_date_idx`(`agencyId`, `kind`, `date`),
    INDEX `Voucher_agencyId_partyType_partyId_idx`(`agencyId`, `partyType`, `partyId`),
    INDEX `Voucher_investmentId_idx`(`investmentId`),
    UNIQUE INDEX `Voucher_agencyId_number_key`(`agencyId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Attachment` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `voucherId` VARCHAR(191) NULL,
    `passportId` VARCHAR(191) NULL,
    `fileName` TEXT NOT NULL,
    `mimeType` TEXT NOT NULL,
    `size` INTEGER NOT NULL,
    `data` LONGBLOB NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` TEXT NULL,

    INDEX `Attachment_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    INDEX `Attachment_voucherId_idx`(`voucherId`),
    INDEX `Attachment_passportId_idx`(`passportId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoanAuthority` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('BANK', 'PERSON', 'COMPANY') NOT NULL DEFAULT 'BANK',
    `phone` TEXT NULL,
    `address` TEXT NULL,
    `note` TEXT NULL,
    `balance` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `LoanAuthority_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    UNIQUE INDEX `LoanAuthority_agencyId_name_key`(`agencyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Loan` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `kind` ENUM('TAKEN', 'GIVEN', 'INVESTMENT') NOT NULL,
    `authorityId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `principal` DECIMAL(14, 2) NOT NULL,
    `interestRate` DECIMAL(7, 4) NOT NULL DEFAULT 0,
    `termMonths` INTEGER NULL,
    `moneyAccountId` VARCHAR(191) NOT NULL,
    `repaid` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `note` TEXT NULL,
    `status` ENUM('ACTIVE', 'CLOSED', 'VOID') NOT NULL DEFAULT 'ACTIVE',
    `voidReason` TEXT NULL,
    `voidedAt` DATETIME(3) NULL,
    `voidedById` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `Loan_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    INDEX `Loan_agencyId_kind_date_idx`(`agencyId`, `kind`, `date`),
    UNIQUE INDEX `Loan_agencyId_number_key`(`agencyId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoanPayment` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `loanId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `principal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `interest` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `moneyAccountId` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `status` ENUM('POSTED', 'VOID') NOT NULL DEFAULT 'POSTED',
    `voidReason` TEXT NULL,
    `voidedAt` DATETIME(3) NULL,
    `voidedById` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `LoanPayment_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    INDEX `LoanPayment_loanId_idx`(`loanId`),
    UNIQUE INDEX `LoanPayment_agencyId_number_key`(`agencyId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payroll` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `month` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `basic` DECIMAL(14, 2) NOT NULL,
    `allowances` JSON NOT NULL,
    `allowanceTotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `deductions` JSON NOT NULL,
    `deductionTotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `advanceAdjusted` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `netPaid` DECIMAL(14, 2) NOT NULL,
    `moneyAccountId` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `status` ENUM('POSTED', 'VOID') NOT NULL DEFAULT 'POSTED',
    `voidReason` TEXT NULL,
    `voidedAt` DATETIME(3) NULL,
    `voidedById` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `Payroll_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    INDEX `Payroll_agencyId_employeeId_month_idx`(`agencyId`, `employeeId`, `month`),
    UNIQUE INDEX `Payroll_agencyId_number_key`(`agencyId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Cheque` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `direction` ENUM('RECEIVED', 'ISSUED') NOT NULL,
    `chequeNo` TEXT NOT NULL,
    `bankName` TEXT NOT NULL,
    `chequeDate` DATE NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `status` ENUM('PENDING', 'DEPOSITED', 'CLEARED', 'BOUNCED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `partyType` ENUM('CLIENT', 'COMBINED', 'VENDOR', 'AGENT', 'EMPLOYEE', 'LOAN_AUTHORITY') NOT NULL,
    `partyId` TEXT NOT NULL,
    `receiptId` VARCHAR(191) NULL,
    `vendorPaymentId` VARCHAR(191) NULL,
    `moneyAccountId` VARCHAR(191) NOT NULL,
    `depositedDate` DATE NULL,
    `clearedDate` DATE NULL,
    `bouncedDate` DATE NULL,
    `history` JSON NOT NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    UNIQUE INDEX `Cheque_receiptId_key`(`receiptId`),
    UNIQUE INDEX `Cheque_vendorPaymentId_key`(`vendorPaymentId`),
    INDEX `Cheque_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    INDEX `Cheque_agencyId_status_chequeDate_idx`(`agencyId`, `status`, `chequeDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Passport` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `passportNo` VARCHAR(191) NOT NULL,
    `name` TEXT NOT NULL,
    `clientId` VARCHAR(191) NULL,
    `gender` ENUM('MALE', 'FEMALE') NULL,
    `dateOfBirth` DATE NULL,
    `nationality` TEXT NOT NULL DEFAULT 'Bangladeshi',
    `placeOfIssue` TEXT NULL,
    `issueDate` DATE NULL,
    `expiryDate` DATE NOT NULL,
    `phone` TEXT NULL,
    `statusId` VARCHAR(191) NULL,
    `statusHistory` JSON NOT NULL,
    `receivedDate` DATE NULL,
    `returnedDate` DATE NULL,
    `note` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    INDEX `Passport_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    INDEX `Passport_agencyId_expiryDate_idx`(`agencyId`, `expiryDate`),
    INDEX `Passport_agencyId_clientId_idx`(`agencyId`, `clientId`),
    UNIQUE INDEX `Passport_agencyId_passportNo_key`(`agencyId`, `passportNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Quotation` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `validUntil` DATE NOT NULL,
    `subject` TEXT NULL,
    `invoiceType` ENUM('AIR', 'NON_COMMISSION', 'REISSUE', 'OTHER', 'OTHER_PACKAGE', 'VISA', 'TOUR', 'HAJJ_PRE_REG', 'HAJJ', 'UMRAH') NOT NULL DEFAULT 'OTHER',
    `subtotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `discount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `netTotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `note` TEXT NULL,
    `terms` TEXT NULL,
    `status` ENUM('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CONVERTED') NOT NULL DEFAULT 'DRAFT',
    `convertedInvoiceId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` TEXT NULL,

    UNIQUE INDEX `Quotation_convertedInvoiceId_key`(`convertedInvoiceId`),
    INDEX `Quotation_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    INDEX `Quotation_agencyId_clientId_idx`(`agencyId`, `clientId`),
    INDEX `Quotation_agencyId_status_idx`(`agencyId`, `status`),
    UNIQUE INDEX `Quotation_agencyId_number_key`(`agencyId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuotationLine` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `quotationId` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `description` TEXT NOT NULL,
    `qty` DECIMAL(10, 2) NOT NULL DEFAULT 1,
    `unitPrice` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `unitCost` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `vendorId` VARCHAR(191) NULL,
    `productId` VARCHAR(191) NULL,

    INDEX `QuotationLine_quotationId_idx`(`quotationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SmsLog` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `to` TEXT NOT NULL,
    `message` TEXT NOT NULL,
    `event` TEXT NOT NULL,
    `status` ENUM('SENT', 'FAILED', 'SIMULATED') NOT NULL,
    `providerRef` TEXT NULL,
    `error` TEXT NULL,
    `relatedType` VARCHAR(191) NULL,
    `relatedId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` TEXT NULL,

    INDEX `SmsLog_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    INDEX `SmsLog_agencyId_relatedType_relatedId_idx`(`agencyId`, `relatedType`, `relatedId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `kind` TEXT NOT NULL,
    `title` TEXT NOT NULL,
    `body` TEXT NULL,
    `link` TEXT NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_agencyId_userId_readAt_idx`(`agencyId`, `userId`, `readAt`),
    INDEX `Notification_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Feedback` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `kind` ENUM('BUG', 'IDEA', 'QUESTION', 'OTHER') NOT NULL DEFAULT 'IDEA',
    `message` TEXT NOT NULL,
    `page` TEXT NULL,
    `status` ENUM('OPEN', 'DONE') NOT NULL DEFAULT 'OPEN',
    `reply` TEXT NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Feedback_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    INDEX `Feedback_agencyId_status_idx`(`agencyId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ImpersonationToken` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `adminUserId` VARCHAR(191) NOT NULL,
    `targetUserId` TEXT NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ImpersonationToken_tokenHash_key`(`tokenHash`),
    INDEX `ImpersonationToken_adminUserId_createdAt_idx`(`adminUserId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VoucherAllocation` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `voucherId` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VoucherAllocation_agencyId_invoiceId_idx`(`agencyId`, `invoiceId`),
    UNIQUE INDEX `VoucherAllocation_voucherId_invoiceId_key`(`voucherId`, `invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AgencySetting` ADD CONSTRAINT `AgencySetting_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Role` ADD CONSTRAINT `Role_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoginHistory` ADD CONSTRAINT `LoginHistory_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoginHistory` ADD CONSTRAINT `LoginHistory_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientCategory` ADD CONSTRAINT `ClientCategory_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Country` ADD CONSTRAINT `Country_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Airport` ADD CONSTRAINT `Airport_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Airline` ADD CONSTRAINT `Airline_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisaType` ADD CONSTRAINT `VisaType_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Department` ADD CONSTRAINT `Department_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Designation` ADD CONSTRAINT `Designation_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_designationId_fkey` FOREIGN KEY (`designationId`) REFERENCES `Designation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoomType` ADD CONSTRAINT `RoomType_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransportType` ADD CONSTRAINT `TransportType_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PassportStatus` ADD CONSTRAINT `PassportStatus_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Group` ADD CONSTRAINT `Group_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Maharam` ADD CONSTRAINT `Maharam_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Company` ADD CONSTRAINT `Company_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `City` ADD CONSTRAINT `City_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Place` ADD CONSTRAINT `Place_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Place` ADD CONSTRAINT `Place_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Place` ADD CONSTRAINT `Place_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `City`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TourGroup` ADD CONSTRAINT `TourGroup_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TourTicket` ADD CONSTRAINT `TourTicket_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TourTicket` ADD CONSTRAINT `TourTicket_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Guide` ADD CONSTRAINT `Guide_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Guide` ADD CONSTRAINT `Guide_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transport` ADD CONSTRAINT `Transport_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transport` ADD CONSTRAINT `Transport_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Food` ADD CONSTRAINT `Food_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Food` ADD CONSTRAINT `Food_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Accommodation` ADD CONSTRAINT `Accommodation_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Accommodation` ADD CONSTRAINT `Accommodation_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Accommodation` ADD CONSTRAINT `Accommodation_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `City`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OtherTransport` ADD CONSTRAINT `OtherTransport_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OtherTransport` ADD CONSTRAINT `OtherTransport_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Client` ADD CONSTRAINT `Client_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Client` ADD CONSTRAINT `Client_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ClientCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Client` ADD CONSTRAINT `Client_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CombinedClient` ADD CONSTRAINT `CombinedClient_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CombinedClient` ADD CONSTRAINT `CombinedClient_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CombinedClient` ADD CONSTRAINT `CombinedClient_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Vendor` ADD CONSTRAINT `Vendor_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Agent` ADD CONSTRAINT `Agent_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentSequence` ADD CONSTRAINT `DocumentSequence_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LedgerAccount` ADD CONSTRAINT `LedgerAccount_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LedgerAccount` ADD CONSTRAINT `LedgerAccount_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `LedgerAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MoneyAccount` ADD CONSTRAINT `MoneyAccount_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MoneyAccount` ADD CONSTRAINT `MoneyAccount_ledgerAccountId_fkey` FOREIGN KEY (`ledgerAccountId`) REFERENCES `LedgerAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalEntry` ADD CONSTRAINT `JournalEntry_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalEntry` ADD CONSTRAINT `JournalEntry_reversalOfId_fkey` FOREIGN KEY (`reversalOfId`) REFERENCES `JournalEntry`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalLine` ADD CONSTRAINT `JournalLine_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalLine` ADD CONSTRAINT `JournalLine_entryId_fkey` FOREIGN KEY (`entryId`) REFERENCES `JournalEntry`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalLine` ADD CONSTRAINT `JournalLine_ledgerAccountId_fkey` FOREIGN KEY (`ledgerAccountId`) REFERENCES `LedgerAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalLine` ADD CONSTRAINT `JournalLine_moneyAccountId_fkey` FOREIGN KEY (`moneyAccountId`) REFERENCES `MoneyAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccountingPeriod` ADD CONSTRAINT `AccountingPeriod_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BalanceTransfer` ADD CONSTRAINT `BalanceTransfer_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BalanceTransfer` ADD CONSTRAINT `BalanceTransfer_fromAccountId_fkey` FOREIGN KEY (`fromAccountId`) REFERENCES `MoneyAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BalanceTransfer` ADD CONSTRAINT `BalanceTransfer_toAccountId_fkey` FOREIGN KEY (`toAccountId`) REFERENCES `MoneyAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `Agent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_salesmanId_fkey` FOREIGN KEY (`salesmanId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_tourGroupId_fkey` FOREIGN KEY (`tourGroupId`) REFERENCES `TourGroup`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceAirTicket` ADD CONSTRAINT `InvoiceAirTicket_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceAirTicket` ADD CONSTRAINT `InvoiceAirTicket_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceAirTicket` ADD CONSTRAINT `InvoiceAirTicket_airlineId_fkey` FOREIGN KEY (`airlineId`) REFERENCES `Airline`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceAirTicket` ADD CONSTRAINT `InvoiceAirTicket_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MoneyReceipt` ADD CONSTRAINT `MoneyReceipt_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MoneyReceipt` ADD CONSTRAINT `MoneyReceipt_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MoneyReceipt` ADD CONSTRAINT `MoneyReceipt_moneyAccountId_fkey` FOREIGN KEY (`moneyAccountId`) REFERENCES `MoneyAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MoneyReceiptAllocation` ADD CONSTRAINT `MoneyReceiptAllocation_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MoneyReceiptAllocation` ADD CONSTRAINT `MoneyReceiptAllocation_receiptId_fkey` FOREIGN KEY (`receiptId`) REFERENCES `MoneyReceipt`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MoneyReceiptAllocation` ADD CONSTRAINT `MoneyReceiptAllocation_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VendorPayment` ADD CONSTRAINT `VendorPayment_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VendorPayment` ADD CONSTRAINT `VendorPayment_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VendorPayment` ADD CONSTRAINT `VendorPayment_moneyAccountId_fkey` FOREIGN KEY (`moneyAccountId`) REFERENCES `MoneyAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdvanceReturn` ADD CONSTRAINT `AdvanceReturn_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdvanceReturn` ADD CONSTRAINT `AdvanceReturn_moneyAccountId_fkey` FOREIGN KEY (`moneyAccountId`) REFERENCES `MoneyAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceItem` ADD CONSTRAINT `InvoiceItem_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceItem` ADD CONSTRAINT `InvoiceItem_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceItem` ADD CONSTRAINT `InvoiceItem_pilgrimId_fkey` FOREIGN KEY (`pilgrimId`) REFERENCES `Pilgrim`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceItem` ADD CONSTRAINT `InvoiceItem_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceItem` ADD CONSTRAINT `InvoiceItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceItem` ADD CONSTRAINT `InvoiceItem_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceItem` ADD CONSTRAINT `InvoiceItem_roomTypeId_fkey` FOREIGN KEY (`roomTypeId`) REFERENCES `RoomType`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceVisaLine` ADD CONSTRAINT `InvoiceVisaLine_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceVisaLine` ADD CONSTRAINT `InvoiceVisaLine_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceVisaLine` ADD CONSTRAINT `InvoiceVisaLine_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceVisaLine` ADD CONSTRAINT `InvoiceVisaLine_visaTypeId_fkey` FOREIGN KEY (`visaTypeId`) REFERENCES `VisaType`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceReissueLine` ADD CONSTRAINT `InvoiceReissueLine_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceReissueLine` ADD CONSTRAINT `InvoiceReissueLine_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceReissueLine` ADD CONSTRAINT `InvoiceReissueLine_originalTicketId_fkey` FOREIGN KEY (`originalTicketId`) REFERENCES `InvoiceAirTicket`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceReissueLine` ADD CONSTRAINT `InvoiceReissueLine_airlineId_fkey` FOREIGN KEY (`airlineId`) REFERENCES `Airline`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceReissueLine` ADD CONSTRAINT `InvoiceReissueLine_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Refund` ADD CONSTRAINT `Refund_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Refund` ADD CONSTRAINT `Refund_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Refund` ADD CONSTRAINT `Refund_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Refund` ADD CONSTRAINT `Refund_moneyAccountId_fkey` FOREIGN KEY (`moneyAccountId`) REFERENCES `MoneyAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefundLine` ADD CONSTRAINT `RefundLine_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefundLine` ADD CONSTRAINT `RefundLine_refundId_fkey` FOREIGN KEY (`refundId`) REFERENCES `Refund`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefundLine` ADD CONSTRAINT `RefundLine_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pilgrim` ADD CONSTRAINT `Pilgrim_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pilgrim` ADD CONSTRAINT `Pilgrim_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pilgrim` ADD CONSTRAINT `Pilgrim_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pilgrim` ADD CONSTRAINT `Pilgrim_maharamId_fkey` FOREIGN KEY (`maharamId`) REFERENCES `Maharam`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PilgrimEvent` ADD CONSTRAINT `PilgrimEvent_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PilgrimEvent` ADD CONSTRAINT `PilgrimEvent_pilgrimId_fkey` FOREIGN KEY (`pilgrimId`) REFERENCES `Pilgrim`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HajjTransfer` ADD CONSTRAINT `HajjTransfer_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HajjTransfer` ADD CONSTRAINT `HajjTransfer_toGroupId_fkey` FOREIGN KEY (`toGroupId`) REFERENCES `Group`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HajjTransferLine` ADD CONSTRAINT `HajjTransferLine_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HajjTransferLine` ADD CONSTRAINT `HajjTransferLine_transferId_fkey` FOREIGN KEY (`transferId`) REFERENCES `HajjTransfer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HajjTransferLine` ADD CONSTRAINT `HajjTransferLine_pilgrimId_fkey` FOREIGN KEY (`pilgrimId`) REFERENCES `Pilgrim`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExpenseHead` ADD CONSTRAINT `ExpenseHead_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExpenseHead` ADD CONSTRAINT `ExpenseHead_ledgerAccountId_fkey` FOREIGN KEY (`ledgerAccountId`) REFERENCES `LedgerAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Voucher` ADD CONSTRAINT `Voucher_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Voucher` ADD CONSTRAINT `Voucher_moneyAccountId_fkey` FOREIGN KEY (`moneyAccountId`) REFERENCES `MoneyAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Voucher` ADD CONSTRAINT `Voucher_expenseHeadId_fkey` FOREIGN KEY (`expenseHeadId`) REFERENCES `ExpenseHead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Voucher` ADD CONSTRAINT `Voucher_investmentId_fkey` FOREIGN KEY (`investmentId`) REFERENCES `Voucher`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `Voucher`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_passportId_fkey` FOREIGN KEY (`passportId`) REFERENCES `Passport`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoanAuthority` ADD CONSTRAINT `LoanAuthority_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Loan` ADD CONSTRAINT `Loan_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Loan` ADD CONSTRAINT `Loan_authorityId_fkey` FOREIGN KEY (`authorityId`) REFERENCES `LoanAuthority`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Loan` ADD CONSTRAINT `Loan_moneyAccountId_fkey` FOREIGN KEY (`moneyAccountId`) REFERENCES `MoneyAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoanPayment` ADD CONSTRAINT `LoanPayment_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoanPayment` ADD CONSTRAINT `LoanPayment_loanId_fkey` FOREIGN KEY (`loanId`) REFERENCES `Loan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoanPayment` ADD CONSTRAINT `LoanPayment_moneyAccountId_fkey` FOREIGN KEY (`moneyAccountId`) REFERENCES `MoneyAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payroll` ADD CONSTRAINT `Payroll_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payroll` ADD CONSTRAINT `Payroll_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payroll` ADD CONSTRAINT `Payroll_moneyAccountId_fkey` FOREIGN KEY (`moneyAccountId`) REFERENCES `MoneyAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cheque` ADD CONSTRAINT `Cheque_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cheque` ADD CONSTRAINT `Cheque_receiptId_fkey` FOREIGN KEY (`receiptId`) REFERENCES `MoneyReceipt`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cheque` ADD CONSTRAINT `Cheque_vendorPaymentId_fkey` FOREIGN KEY (`vendorPaymentId`) REFERENCES `VendorPayment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cheque` ADD CONSTRAINT `Cheque_moneyAccountId_fkey` FOREIGN KEY (`moneyAccountId`) REFERENCES `MoneyAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Passport` ADD CONSTRAINT `Passport_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Passport` ADD CONSTRAINT `Passport_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Passport` ADD CONSTRAINT `Passport_statusId_fkey` FOREIGN KEY (`statusId`) REFERENCES `PassportStatus`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quotation` ADD CONSTRAINT `Quotation_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quotation` ADD CONSTRAINT `Quotation_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quotation` ADD CONSTRAINT `Quotation_convertedInvoiceId_fkey` FOREIGN KEY (`convertedInvoiceId`) REFERENCES `Invoice`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuotationLine` ADD CONSTRAINT `QuotationLine_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuotationLine` ADD CONSTRAINT `QuotationLine_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `Quotation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuotationLine` ADD CONSTRAINT `QuotationLine_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuotationLine` ADD CONSTRAINT `QuotationLine_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SmsLog` ADD CONSTRAINT `SmsLog_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Feedback` ADD CONSTRAINT `Feedback_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Feedback` ADD CONSTRAINT `Feedback_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VoucherAllocation` ADD CONSTRAINT `VoucherAllocation_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VoucherAllocation` ADD CONSTRAINT `VoucherAllocation_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `Voucher`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VoucherAllocation` ADD CONSTRAINT `VoucherAllocation_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

