-- AlterTable
ALTER TABLE `Agency` ADD COLUMN `signupPhone` VARCHAR(20) NULL;

-- CreateTable
CREATE TABLE `SignupRequest` (
    `id` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `codeHash` VARCHAR(64) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `ip` VARCHAR(64) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SignupRequest_phone_createdAt_idx`(`phone`, `createdAt`),
    INDEX `SignupRequest_ip_createdAt_idx`(`ip`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SubscriptionPayment` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(20) NOT NULL,
    `date` DATE NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `method` VARCHAR(10) NOT NULL,
    `reference` VARCHAR(80) NULL,
    `plan` VARCHAR(40) NOT NULL,
    `months` INTEGER NOT NULL,
    `periodFrom` DATE NOT NULL,
    `periodTo` DATE NOT NULL,
    `note` TEXT NULL,
    `status` VARCHAR(10) NOT NULL DEFAULT 'POSTED',
    `voidReason` TEXT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SubscriptionPayment_number_key`(`number`),
    INDEX `SubscriptionPayment_agencyId_date_idx`(`agencyId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SubscriptionPayment` ADD CONSTRAINT `SubscriptionPayment_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

