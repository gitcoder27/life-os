ALTER TABLE "FinanceTransaction"
ADD COLUMN IF NOT EXISTS "recurringIncomeTemplateId" TEXT;

CREATE INDEX IF NOT EXISTS "FinanceTransaction_recurringIncomeTemplateId_occurredOn_idx"
ON "FinanceTransaction"("recurringIncomeTemplateId", "occurredOn");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinanceTransaction_recurringIncomeTemplateId_fkey') THEN
    ALTER TABLE "FinanceTransaction"
    ADD CONSTRAINT "FinanceTransaction_recurringIncomeTemplateId_fkey"
    FOREIGN KEY ("recurringIncomeTemplateId") REFERENCES "RecurringIncomeTemplate"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
