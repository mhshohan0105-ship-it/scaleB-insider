-- AlterTable
ALTER TABLE `Agency` ADD COLUMN `facebook` TEXT NULL;

-- AlterTable
ALTER TABLE `AgencySetting` ADD COLUMN `pdfShowPassports` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `pdfShowPoweredBy` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `pdfShowQr` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `pdfShowStamp` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `Invoice` ADD COLUMN `publicToken` VARCHAR(32) NULL;

-- CreateTable
CREATE TABLE `AgencyImage` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(16) NOT NULL,
    `mimeType` VARCHAR(64) NOT NULL,
    `size` INTEGER NOT NULL,
    `data` MEDIUMBLOB NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedById` TEXT NULL,

    UNIQUE INDEX `AgencyImage_agencyId_kind_key`(`agencyId`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Invoice_publicToken_key` ON `Invoice`(`publicToken`);

-- AddForeignKey
ALTER TABLE `AgencyImage` ADD CONSTRAINT `AgencyImage_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

