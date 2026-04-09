CREATE TYPE "BillCompletionMode" AS ENUM ('PAY_AND_LOG', 'MARK_PAID_ONLY');

ALTER TABLE "Expense"
ADD COLUMN "billId" TEXT;

ALTER TABLE "AdminItem"
ADD COLUMN "expenseCategoryId" TEXT,
ADD COLUMN "completionMode" "BillCompletionMode";

UPDATE "AdminItem" AS "bill"
SET "expenseCategoryId" = "template"."expenseCategoryId"
FROM "RecurringExpenseTemplate" AS "template"
WHERE "bill"."recurringExpenseTemplateId" = "template"."id"
  AND "bill"."expenseCategoryId" IS NULL;

CREATE UNIQUE INDEX "Expense_billId_key" ON "Expense"("billId");

ALTER TABLE "Expense"
ADD CONSTRAINT "Expense_billId_fkey"
FOREIGN KEY ("billId") REFERENCES "AdminItem"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "AdminItem"
ADD CONSTRAINT "AdminItem_expenseCategoryId_fkey"
FOREIGN KEY ("expenseCategoryId") REFERENCES "ExpenseCategory"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
