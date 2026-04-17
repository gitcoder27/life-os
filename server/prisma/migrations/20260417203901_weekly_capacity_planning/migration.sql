-- DropForeignKey
ALTER TABLE "FinanceMonthPlanCategoryWatch" DROP CONSTRAINT "FinanceMonthPlanCategoryWatch_expenseCategoryId_fkey";

-- AddForeignKey
ALTER TABLE "FinanceMonthPlanCategoryWatch" ADD CONSTRAINT "FinanceMonthPlanCategoryWatch_expenseCategoryId_fkey" FOREIGN KEY ("expenseCategoryId") REFERENCES "ExpenseCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "FinanceMonthPlanCategoryWatch_financeMonthPlanId_expenseCategor" RENAME TO "FinanceMonthPlanCategoryWatch_financeMonthPlanId_expenseCat_key";
