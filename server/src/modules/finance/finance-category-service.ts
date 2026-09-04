import { Prisma, type ExpenseCategory } from "@prisma/client";

import { AppError } from "../../lib/errors/app-error.js";
import type { ExpenseCategoryItem } from "@life-os/contracts";

type FinanceCategoryClient = Pick<Prisma.TransactionClient, "expenseCategory">;

export function serializeExpenseCategory(category: ExpenseCategory): ExpenseCategoryItem {
  return {
    id: category.id,
    name: category.name,
    color: category.color,
    sortOrder: category.sortOrder,
    createdAt: category.createdAt.toISOString(),
    archivedAt: category.archivedAt?.toISOString() ?? null,
  };
}

export async function assertOwnedExpenseCategory(
  prisma: FinanceCategoryClient,
  userId: string,
  expenseCategoryId: string | null | undefined,
) {
  if (!expenseCategoryId) {
    return;
  }

  const category = await prisma.expenseCategory.findFirst({
    where: {
      id: expenseCategoryId,
      userId,
      archivedAt: null,
    },
  });

  if (!category) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Expense category not found",
    });
  }
}

export async function findOwnedExpenseCategory(
  prisma: FinanceCategoryClient,
  userId: string,
  expenseCategoryId: string,
) {
  const category = await prisma.expenseCategory.findFirst({
    where: {
      id: expenseCategoryId,
      userId,
    },
  });

  if (!category) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Expense category not found",
    });
  }

  return category;
}
