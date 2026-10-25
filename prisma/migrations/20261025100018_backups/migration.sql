-- CreateTable
CREATE TABLE `BackupRun` (
    `id` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(16) NOT NULL,
    `status` VARCHAR(16) NOT NULL,
    `fileName` VARCHAR(191) NULL,
    `sizeBytes` INTEGER NULL,
    `sha256` VARCHAR(64) NULL,
    `tables` INTEGER NULL,
    `rows` INTEGER NULL,
    `savedLocal` BOOLEAN NOT NULL DEFAULT false,
    `driveFileId` VARCHAR(191) NULL,
    `error` TEXT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,

    INDEX `BackupRun_startedAt_idx`(`startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BackupConfig` (
    `id` VARCHAR(191) NOT NULL,
    `encryptionKey` TEXT NOT NULL,
    `googleClientId` TEXT NULL,
    `googleClientSecret` TEXT NULL,
    `googleRefreshToken` TEXT NULL,
    `googleEmail` TEXT NULL,
    `driveFolderId` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
