import type { FastifyPluginAsync } from "fastify";
import type {
  CreateRecurringIncomeRequest,
  ReceiveRecurringIncomeRequest,
  ReceiveRecurringIncomeResponse,
  RecurringIncomeMutationResponse,
  RecurringIncomeResponse,
  UndoRecurringIncomeReceiptRequest,
  UndoRecurringIncomeReceiptResponse,
  UpdateRecurringIncomeRequest,
} from "@life-os/contracts";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { AppError } from "../../lib/errors/app-error.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { parseIsoDate } from "../../lib/time/cycle.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import { assertOwnedFinanceAccount } from "./finance-account-service.js";
import { getUserCurrencyCode } from "./finance-currency-service.js";
import {
  createRecurringIncomeSchema,
  receiveRecurringIncomeSchema,
  undoRecurringIncomeReceiptSchema,
  updateRecurringIncomeSchema,
} from "./finance-schemas.js";
import {
  getNextRecurringIncomeDate,
  serializeRecurringIncome,
  toPrismaRecurringIncomeStatus,
} from "./finance-recurring-income-service.js";
import { serializeFinanceTransaction } from "./finance-transaction-service.js";

export const registerFinanceRecurringIncomeRoutes: FastifyPluginAsync = async (app) => {
  app.get("/recurring-income", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const recurringIncome = await app.prisma.recurringIncomeTemplate.findMany({
      where: {
        userId: user.id,
      },
      orderBy: [{ status: "asc" }, { nextExpectedOn: "asc" }],
    });

    const response: RecurringIncomeResponse = withGeneratedAt({
      recurringIncome: recurringIncome.map(serializeRecurringIncome),
    });

    return reply.send(response);
  });

  app.post("/recurring-income", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createRecurringIncomeSchema, request.body as CreateRecurringIncomeRequest);

    await assertOwnedFinanceAccount(app.prisma, user.id, payload.accountId);

    const recurringIncome = await app.prisma.recurringIncomeTemplate.create({
      data: {
        userId: user.id,
        accountId: payload.accountId,
        title: payload.title.trim(),
        amountMinor: payload.amountMinor,
        currencyCode: payload.currencyCode ?? (await getUserCurrencyCode(app.prisma, user.id)),
        recurrenceRule: payload.recurrenceRule ?? "monthly",
        nextExpectedOn: parseIsoDate(payload.nextExpectedOn),
        status: toPrismaRecurringIncomeStatus(payload.status ?? "active"),
      },
    });

    const response: RecurringIncomeMutationResponse = withGeneratedAt({
      recurringIncome: serializeRecurringIncome(recurringIncome),
    });

    return reply.status(201).send(response);
  });

  app.patch("/recurring-income/:recurringIncomeId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { recurringIncomeId } = request.params as { recurringIncomeId: string };
    const payload = parseOrThrow(updateRecurringIncomeSchema, request.body as UpdateRecurringIncomeRequest);

    const existing = await app.prisma.recurringIncomeTemplate.findFirst({
      where: {
        id: recurringIncomeId,
        userId: user.id,
      },
    });

    if (!existing) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Recurring income not found",
      });
    }

    await assertOwnedFinanceAccount(app.prisma, user.id, payload.accountId);

    const recurringIncome = await app.prisma.recurringIncomeTemplate.update({
      where: {
        id: existing.id,
      },
      data: {
        accountId: payload.accountId,
        title: payload.title?.trim(),
        amountMinor: payload.amountMinor,
        currencyCode: payload.currencyCode,
        recurrenceRule: payload.recurrenceRule,
        nextExpectedOn: payload.nextExpectedOn ? parseIsoDate(payload.nextExpectedOn) : undefined,
        status: payload.status ? toPrismaRecurringIncomeStatus(payload.status) : undefined,
      },
    });

    const response: RecurringIncomeMutationResponse = withGeneratedAt({
      recurringIncome: serializeRecurringIncome(recurringIncome),
    });

    return reply.send(response);
  });

  app.post("/recurring-income/:recurringIncomeId/receive", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { recurringIncomeId } = request.params as { recurringIncomeId: string };
    const payload = parseOrThrow(receiveRecurringIncomeSchema, request.body as ReceiveRecurringIncomeRequest);

    const existing = await app.prisma.recurringIncomeTemplate.findFirst({
      where: {
        id: recurringIncomeId,
        userId: user.id,
      },
    });

    if (!existing) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Recurring income not found",
      });
    }

    if (existing.status !== "ACTIVE") {
      throw new AppError({
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Income plan must be active to receive",
      });
    }

    const accountId = payload.accountId ?? existing.accountId;
    await assertOwnedFinanceAccount(app.prisma, user.id, accountId);

    const receivedOn = parseIsoDate(payload.receivedOn);
    const amountMinor = payload.amountMinor ?? existing.amountMinor;
    const currencyCode = payload.currencyCode ?? existing.currencyCode;
    const description = payload.description ?? existing.title;

    const result = await app.prisma.$transaction(async (tx) => {
      const transaction = await tx.financeTransaction.create({
        data: {
          userId: user.id,
          accountId,
          transactionType: "INCOME",
          amountMinor,
          currencyCode,
          occurredOn: receivedOn,
          description,
          recurringIncomeTemplateId: existing.id,
        },
      });
      const recurringIncome = await tx.recurringIncomeTemplate.update({
        where: {
          id: existing.id,
        },
        data: {
          accountId,
          amountMinor,
          currencyCode,
          nextExpectedOn: getNextRecurringIncomeDate(existing, receivedOn),
        },
      });

      return { recurringIncome, transaction };
    });

    const response: ReceiveRecurringIncomeResponse = withGeneratedAt({
      recurringIncome: serializeRecurringIncome(result.recurringIncome),
      transaction: serializeFinanceTransaction(result.transaction),
    });

    return reply.send(response);
  });

  app.post("/recurring-income/:recurringIncomeId/undo-latest-receive", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { recurringIncomeId } = request.params as { recurringIncomeId: string };
    const payload =
      parseOrThrow(undoRecurringIncomeReceiptSchema, request.body as UndoRecurringIncomeReceiptRequest | undefined) ?? {};

    const existing = await app.prisma.recurringIncomeTemplate.findFirst({
      where: {
        id: recurringIncomeId,
        userId: user.id,
      },
    });

    if (!existing) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Recurring income not found",
      });
    }

    const recurringIncomeReceiptWhere = {
      userId: user.id,
      transactionType: "INCOME" as const,
      OR: [
        {
          recurringIncomeTemplateId: existing.id,
        },
        {
          recurringIncomeTemplateId: null,
          accountId: existing.accountId,
          amountMinor: existing.amountMinor,
          currencyCode: existing.currencyCode,
          description: existing.title,
        },
      ],
    };

    const transaction = payload.transactionId
      ? await app.prisma.financeTransaction.findFirst({
        where: {
          id: payload.transactionId,
          ...recurringIncomeReceiptWhere,
        },
      })
      : await app.prisma.financeTransaction.findFirst({
        where: recurringIncomeReceiptWhere,
        orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
      });

    if (!transaction) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "No received income transaction found",
      });
    }

    const recurringIncome = await app.prisma.$transaction(async (tx) => {
      await tx.financeTransaction.delete({
        where: {
          id: transaction.id,
        },
      });

      return tx.recurringIncomeTemplate.update({
        where: {
          id: existing.id,
        },
        data: {
          nextExpectedOn: transaction.occurredOn,
          accountId: transaction.accountId,
          amountMinor: transaction.amountMinor,
          currencyCode: transaction.currencyCode,
        },
      });
    });

    const response: UndoRecurringIncomeReceiptResponse = withGeneratedAt({
      recurringIncome: serializeRecurringIncome(recurringIncome),
      transactionId: transaction.id,
      undone: true,
    });

    return reply.send(response);
  });
};
