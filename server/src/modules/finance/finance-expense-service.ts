import type {
  ExpenseItem,
  ExpenseSource,
} from "@life-os/contracts";
import type {
  Expense,
  ExpenseSource as PrismaExpenseSource,
  Prisma,
} from "@prisma/client";

import { AppError } from "../../lib/errors/app-error.js";
import { toIsoDateString } from "../../lib/time/date.js";

type ExpenseClient = Pick<Prisma.TransactionClient, "expense">;

export function toPrismaExpenseSource(source: ExpenseSource): PrismaExpenseSource {
  switch (source) {
    case "manual":
      return "MANUAL";
    case "quick_capture":
      return "QUICK_CAPTURE";
    case "template":
      return "TEMPLATE";
  }

  throw new Error(`Unsupported expense source: ${source satisfies never}`);
}

function fromPrismaExpenseSource(source: PrismaExpenseSource): ExpenseSource {
  switch (source) {
    case "MANUAL":
      return "manual";
    case "QUICK_CAPTURE":
      return "quick_capture";
    case "TEMPLATE":
      return "template";
  }

  throw new Error(`Unsupported expense source: ${source satisfies never}`);
}

export function serializeExpense(expense: Expense): ExpenseItem {
  return {
    id: expense.id,
    expenseCategoryId: expense.expenseCategoryId,
    amountMinor: expense.amountMinor,
    currencyCode: expense.currencyCode,
    spentOn: toIsoDateString(expense.spentOn),
    description: expense.description,
    source: fromPrismaExpenseSource(expense.source),
    billId: expense.billId,
    recurringExpenseTemplateId: expense.recurringExpenseTemplateId,
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  };
}

export async function findOwnedExpense(
  prisma: ExpenseClient,
  userId: string,
  expenseId: string,
) {
  const expense = await prisma.expense.findFirst({
    where: {
      id: expenseId,
      userId,
    },
  });

  if (!expense) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Expense not found",
    });
  }

  return expense;
}
