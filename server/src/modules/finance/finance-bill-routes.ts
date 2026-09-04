import type { FastifyPluginAsync } from "fastify";
import type {
  CompleteFinanceBillRequest,
  CompleteFinanceBillWithExpenseRequest,
  CreateFinanceBillRequest,
  FinanceBillMutationResponse,
  FinanceBillsResponse,
  IsoDateString,
  LinkFinanceBillExpenseRequest,
  RescheduleFinanceBillRequest,
} from "@life-os/contracts";
import { z } from "zod";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { AppError } from "../../lib/errors/app-error.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { parseIsoDate } from "../../lib/time/cycle.js";
import { getUserLocalDate } from "../../lib/time/user-time.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import { assertOwnedFinanceAccount } from "./finance-account-service.js";
import { assertOwnedExpenseCategory } from "./finance-category-service.js";
import { getUserCurrencyCode } from "./finance-currency-service.js";
import { serializeExpense } from "./finance-expense-service.js";
import {
  getIsoMonthString,
  getUserFinanceContext,
  listFinanceBillsForMonth,
} from "./finance-month-plan-service.js";
import { findOwnedRecurringExpenseTemplate } from "./finance-recurring-expense-service.js";
import {
  completeFinanceBillSchema,
  completeFinanceBillWithExpenseSchema,
  createFinanceBillSchema,
  isoMonthSchema,
  linkFinanceBillExpenseSchema,
  rescheduleFinanceBillSchema,
} from "./finance-schemas.js";
import {
  findOwnedFinanceBill,
  serializeFinanceBill,
  toPrismaBillCompletionMode,
} from "./service.js";

function resolveBillPaidAt(paidOn: IsoDateString) {
  return parseIsoDate(paidOn);
}

function resolveBillExpenseAmount(
  billAmountMinor: number | null,
  requestedAmountMinor: number | null | undefined,
) {
  return requestedAmountMinor ?? billAmountMinor ?? null;
}

export const registerFinanceBillRoutes: FastifyPluginAsync = async (app) => {
  app.get("/bills", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(
      z.object({
        month: isoMonthSchema,
      }),
      request.query,
    );
    const { timezone } = await getUserFinanceContext(app, user.id);
    const currentMonth = getIsoMonthString(parseIsoDate(getUserLocalDate(new Date(), timezone)));
    const bills = await listFinanceBillsForMonth(app, user.id, query.month, {
      includeOverdueOpenBills: query.month === currentMonth,
    });

    const response: FinanceBillsResponse = withGeneratedAt({
      month: query.month,
      bills: bills.map(serializeFinanceBill),
    });

    return reply.send(response);
  });

  app.post("/bills", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(
      createFinanceBillSchema,
      request.body as CreateFinanceBillRequest,
    );

    const recurringExpenseTemplate = payload.recurringExpenseTemplateId
      ? await findOwnedRecurringExpenseTemplate(app.prisma, user.id, payload.recurringExpenseTemplateId)
      : null;
    const expenseCategoryId = payload.expenseCategoryId ?? recurringExpenseTemplate?.expenseCategoryId ?? null;

    await assertOwnedExpenseCategory(app.prisma, user.id, expenseCategoryId);

    const bill = await app.prisma.adminItem.create({
      data: {
        userId: user.id,
        title: payload.title.trim(),
        itemType: "BILL",
        dueOn: parseIsoDate(payload.dueOn),
        status: "PENDING",
        recurringExpenseTemplateId: payload.recurringExpenseTemplateId ?? null,
        expenseCategoryId,
        amountMinor: payload.amountMinor ?? recurringExpenseTemplate?.defaultAmountMinor ?? null,
        note: payload.note ?? null,
      },
      include: {
        linkedExpense: {
          select: {
            id: true,
          },
        },
      },
    });

    const response: FinanceBillMutationResponse = withGeneratedAt({
      bill: serializeFinanceBill(bill),
      expense: null,
    });

    return reply.status(201).send(response);
  });

  app.post("/bills/:billId/pay-and-log", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { billId } = request.params as { billId: string };
    const payload = parseOrThrow(
      completeFinanceBillWithExpenseSchema,
      request.body as CompleteFinanceBillWithExpenseRequest,
    );

    const existingBill = await findOwnedFinanceBill(app.prisma, user.id, billId);
    const expenseCategoryId = payload.expenseCategoryId ?? existingBill.expenseCategoryId ?? null;

    await Promise.all([
      assertOwnedExpenseCategory(app.prisma, user.id, expenseCategoryId),
      assertOwnedFinanceAccount(app.prisma, user.id, payload.accountId),
    ]);

    const amountMinor = resolveBillExpenseAmount(existingBill.amountMinor, payload.amountMinor);
    if (!amountMinor) {
      throw new AppError({
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Amount is required to log payment for this bill",
      });
    }

    const currencyCode = payload.currencyCode ?? (await getUserCurrencyCode(app.prisma, user.id));
    const paidAt = resolveBillPaidAt(payload.paidOn);

    const result = await app.prisma.$transaction(async (tx) => {
      const bill = await tx.adminItem.findFirst({
        where: {
          id: billId,
          userId: user.id,
          itemType: "BILL",
        },
        include: {
          linkedExpense: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!bill) {
        throw new AppError({
          statusCode: 404,
          code: "NOT_FOUND",
          message: "Bill not found",
        });
      }

      if (bill.status === "DROPPED") {
        throw new AppError({
          statusCode: 409,
          code: "CONFLICT",
          message: "Dropped bills cannot be paid",
        });
      }

      if (bill.status === "DONE") {
        if (bill.linkedExpense && bill.completionMode === "PAY_AND_LOG") {
          const expense = await tx.expense.findUnique({
            where: {
              billId: bill.id,
            },
          });

          return {
            bill,
            expense,
          };
        }

        if (!bill.linkedExpense && bill.completionMode === "MARK_PAID_ONLY") {
          const expense = await tx.expense.create({
            data: {
              userId: user.id,
              expenseCategoryId,
              billId: bill.id,
              amountMinor,
              currencyCode,
              spentOn: paidAt,
              description: payload.description ?? bill.title,
              source: bill.recurringExpenseTemplateId ? "TEMPLATE" : "MANUAL",
              recurringExpenseTemplateId: bill.recurringExpenseTemplateId ?? null,
            },
          });
          if (payload.accountId) {
            await tx.financeTransaction.create({
              data: {
                userId: user.id,
                accountId: payload.accountId,
                transactionType: "EXPENSE",
                amountMinor,
                currencyCode,
                occurredOn: paidAt,
                description: payload.description ?? bill.title,
                expenseCategoryId,
                billId: bill.id,
              },
            });
          }

          const updatedBill = await tx.adminItem.update({
            where: {
              id: bill.id,
            },
            data: {
              completedAt: paidAt,
              amountMinor: bill.amountMinor ?? amountMinor,
              expenseCategoryId,
            },
            include: {
              linkedExpense: {
                select: {
                  id: true,
                },
              },
            },
          });

          return {
            bill: updatedBill,
            expense,
          };
        }

        throw new AppError({
          statusCode: 409,
          code: "CONFLICT",
          message: "Bill has already been completed",
        });
      }

      const expense = await tx.expense.create({
        data: {
          userId: user.id,
          expenseCategoryId,
          billId: bill.id,
          amountMinor,
          currencyCode,
          spentOn: paidAt,
          description: payload.description ?? bill.title,
          source: bill.recurringExpenseTemplateId ? "TEMPLATE" : "MANUAL",
          recurringExpenseTemplateId: bill.recurringExpenseTemplateId ?? null,
        },
      });
      if (payload.accountId) {
        await tx.financeTransaction.create({
          data: {
            userId: user.id,
            accountId: payload.accountId,
            transactionType: "EXPENSE",
            amountMinor,
            currencyCode,
            occurredOn: paidAt,
            description: payload.description ?? bill.title,
            expenseCategoryId,
            billId: bill.id,
          },
        });
      }

      const updatedBill = await tx.adminItem.update({
        where: {
          id: bill.id,
        },
        data: {
          status: "DONE",
          completedAt: paidAt,
          completionMode: toPrismaBillCompletionMode("pay_and_log"),
          amountMinor: bill.amountMinor ?? amountMinor,
          expenseCategoryId,
        },
        include: {
          linkedExpense: {
            select: {
              id: true,
            },
          },
        },
      });

      return {
        bill: updatedBill,
        expense,
      };
    });

    const response: FinanceBillMutationResponse = withGeneratedAt({
      bill: serializeFinanceBill(result.bill),
      expense: result.expense ? serializeExpense(result.expense) : null,
    });

    return reply.send(response);
  });

  app.post("/bills/:billId/link-expense", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { billId } = request.params as { billId: string };
    const payload = parseOrThrow(
      linkFinanceBillExpenseSchema,
      request.body as LinkFinanceBillExpenseRequest,
    );

    const result = await app.prisma.$transaction(async (tx) => {
      const [bill, expense] = await Promise.all([
        tx.adminItem.findFirst({
          where: {
            id: billId,
            userId: user.id,
            itemType: "BILL",
          },
          include: {
            linkedExpense: {
              select: {
                id: true,
              },
            },
          },
        }),
        tx.expense.findFirst({
          where: {
            id: payload.expenseId,
            userId: user.id,
          },
        }),
      ]);

      if (!bill) {
        throw new AppError({
          statusCode: 404,
          code: "NOT_FOUND",
          message: "Bill not found",
        });
      }

      if (!expense) {
        throw new AppError({
          statusCode: 404,
          code: "NOT_FOUND",
          message: "Expense not found",
        });
      }

      if (bill.status !== "DONE") {
        throw new AppError({
          statusCode: 409,
          code: "CONFLICT",
          message: "Only paid bills can link an expense",
        });
      }

      if (bill.linkedExpense?.id === expense.id) {
        return {
          bill,
          expense,
        };
      }

      if (bill.linkedExpense) {
        throw new AppError({
          statusCode: 409,
          code: "CONFLICT",
          message: "Bill already has a linked expense",
        });
      }

      if (expense.billId && expense.billId !== bill.id) {
        throw new AppError({
          statusCode: 409,
          code: "CONFLICT",
          message: "Expense is already linked to another bill",
        });
      }

      const updatedExpense = await tx.expense.update({
        where: {
          id: expense.id,
        },
        data: {
          billId: bill.id,
          recurringExpenseTemplateId: expense.recurringExpenseTemplateId ?? bill.recurringExpenseTemplateId ?? null,
        },
      });

      const updatedBill = await tx.adminItem.update({
        where: {
          id: bill.id,
        },
        data: {
          expenseCategoryId: bill.expenseCategoryId ?? updatedExpense.expenseCategoryId,
          amountMinor: bill.amountMinor ?? updatedExpense.amountMinor,
        },
        include: {
          linkedExpense: {
            select: {
              id: true,
            },
          },
        },
      });

      return {
        bill: updatedBill,
        expense: updatedExpense,
      };
    });

    const response: FinanceBillMutationResponse = withGeneratedAt({
      bill: serializeFinanceBill(result.bill),
      expense: serializeExpense(result.expense),
    });

    return reply.send(response);
  });

  app.post("/bills/:billId/mark-paid", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { billId } = request.params as { billId: string };
    const payload = parseOrThrow(
      completeFinanceBillSchema,
      request.body as CompleteFinanceBillRequest,
    );

    await findOwnedFinanceBill(app.prisma, user.id, billId);

    const bill = await app.prisma.$transaction(async (tx) => {
      const currentBill = await tx.adminItem.findFirst({
        where: {
          id: billId,
          userId: user.id,
          itemType: "BILL",
        },
        include: {
          linkedExpense: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!currentBill) {
        throw new AppError({
          statusCode: 404,
          code: "NOT_FOUND",
          message: "Bill not found",
        });
      }

      if (currentBill.status === "DROPPED") {
        throw new AppError({
          statusCode: 409,
          code: "CONFLICT",
          message: "Dropped bills cannot be marked paid",
        });
      }

      if (currentBill.status === "DONE") {
        if (!currentBill.linkedExpense && currentBill.completionMode === "MARK_PAID_ONLY") {
          return currentBill;
        }

        throw new AppError({
          statusCode: 409,
          code: "CONFLICT",
          message: "Bill has already been completed",
        });
      }

      return tx.adminItem.update({
        where: {
          id: currentBill.id,
        },
        data: {
          status: "DONE",
          completedAt: resolveBillPaidAt(payload.paidOn),
          completionMode: toPrismaBillCompletionMode("mark_paid_only"),
        },
        include: {
          linkedExpense: {
            select: {
              id: true,
            },
          },
        },
      });
    });

    const response: FinanceBillMutationResponse = withGeneratedAt({
      bill: serializeFinanceBill(bill),
      expense: null,
    });

    return reply.send(response);
  });

  app.post("/bills/:billId/reschedule", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { billId } = request.params as { billId: string };
    const payload = parseOrThrow(
      rescheduleFinanceBillSchema,
      request.body as RescheduleFinanceBillRequest,
    );

    const currentBill = await findOwnedFinanceBill(app.prisma, user.id, billId);

    if (currentBill.status === "DONE" || currentBill.status === "DROPPED") {
      throw new AppError({
        statusCode: 409,
        code: "CONFLICT",
        message: "Completed or dismissed bills cannot be rescheduled",
      });
    }

    const nextDueOn = parseIsoDate(payload.dueOn);
    const bill = await app.prisma.adminItem.update({
      where: {
        id: currentBill.id,
      },
      data: {
        dueOn: nextDueOn,
        status: "RESCHEDULED",
        completedAt: null,
        completionMode: null,
      },
      include: {
        linkedExpense: {
          select: {
            id: true,
          },
        },
      },
    });

    const response: FinanceBillMutationResponse = withGeneratedAt({
      bill: serializeFinanceBill(bill),
      expense: null,
    });

    return reply.send(response);
  });

  app.post("/bills/:billId/dismiss", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { billId } = request.params as { billId: string };
    const currentBill = await findOwnedFinanceBill(app.prisma, user.id, billId);

    if (currentBill.status === "DONE") {
      throw new AppError({
        statusCode: 409,
        code: "CONFLICT",
        message: "Paid bills cannot be dismissed",
      });
    }

    if (currentBill.status === "DROPPED") {
      const response: FinanceBillMutationResponse = withGeneratedAt({
        bill: serializeFinanceBill(currentBill),
        expense: null,
      });

      return reply.send(response);
    }

    const bill = await app.prisma.adminItem.update({
      where: {
        id: currentBill.id,
      },
      data: {
        status: "DROPPED",
        completedAt: null,
        completionMode: null,
      },
      include: {
        linkedExpense: {
          select: {
            id: true,
          },
        },
      },
    });

    const response: FinanceBillMutationResponse = withGeneratedAt({
      bill: serializeFinanceBill(bill),
      expense: null,
    });

    return reply.send(response);
  });
};
