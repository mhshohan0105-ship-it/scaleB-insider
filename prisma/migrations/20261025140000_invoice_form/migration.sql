-- AlterTable
ALTER TABLE `Invoice` ADD COLUMN `reference` TEXT NULL,
    ADD COLUMN `showDiscount` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `showExtraFee` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `showPrevDue` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `InvoiceAirTicket` ADD COLUMN `extraFee` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `issueDate` DATE NULL,
    ADD COLUMN `segments` JSON NOT NULL DEFAULT (JSON_ARRAY());

