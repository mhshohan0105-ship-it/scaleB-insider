-- AlterTable
ALTER TABLE `Agency` ADD COLUMN `paidUntil` DATETIME(3) NULL,
    ADD COLUMN `trialEndsAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `Plan` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `priceMonthly` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `priceYearly` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `maxUsers` INTEGER NOT NULL DEFAULT 0,
    `modules` JSON NOT NULL DEFAULT (JSON_ARRAY()),
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Plan_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- The three plans agencies already point at. Every module and no price until
-- the platform admin sets them; only the user limits differ.
INSERT INTO `Plan` (`id`, `code`, `name`, `maxUsers`, `sortOrder`, `updatedAt`) VALUES
    ('plan_starter', 'starter', 'Starter', 3, 1, CURRENT_TIMESTAMP(3)),
    ('plan_standard', 'standard', 'Standard', 10, 2, CURRENT_TIMESTAMP(3)),
    ('plan_premium', 'premium', 'Premium', 0, 3, CURRENT_TIMESTAMP(3));
