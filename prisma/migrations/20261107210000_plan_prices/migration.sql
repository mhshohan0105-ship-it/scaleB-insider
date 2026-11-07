-- Starting prices (BDT) for the three plans, yearly = 10 months. Only plans
-- still without a price are changed, so prices set by the admin are kept.
UPDATE `Plan` SET `priceMonthly` = 1500, `priceYearly` = 15000 WHERE `code` = 'starter' AND `priceMonthly` = 0 AND `priceYearly` = 0;
UPDATE `Plan` SET `priceMonthly` = 3000, `priceYearly` = 30000 WHERE `code` = 'standard' AND `priceMonthly` = 0 AND `priceYearly` = 0;
UPDATE `Plan` SET `priceMonthly` = 5500, `priceYearly` = 55000 WHERE `code` = 'premium' AND `priceMonthly` = 0 AND `priceYearly` = 0;
