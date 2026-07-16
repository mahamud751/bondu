ALTER TABLE "Payment" ADD COLUMN "currencyAmountMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "conversionMinorPerPoint" INTEGER NOT NULL DEFAULT 100;
UPDATE "Payment" SET "currencyAmountMinor" = "amount" * 100 WHERE "currencyAmountMinor" = 0;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_currencyAmountMinor_positive" CHECK ("currencyAmountMinor" > 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_conversionMinorPerPoint_positive" CHECK ("conversionMinorPerPoint" > 0);
