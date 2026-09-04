import type { FastifyPluginAsync } from "fastify";
import type {
  CreateFinanceTransactionRequest,
  FinanceTransactionMutationResponse,
  FinanceTransactionsResponse,
  UpdateFinanceTransactionRequest,
} from "@life-os/contracts";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { AppError } from "../../lib/errors/app-error.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { parseIsoDate } from "../../lib/time/cycle.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import { assertOwnedFinanceAccount } from "./finance-account-service.js";
import { assertOwnedExpenseCategory } from "./finance-category-service.js";
import { getUserCurrencyCode } from "./finance-currency-service.js";
import {
  createFinanceTransactionSchema,
  expenseRangeQuerySchema,
  updateFinanceTransactionSchema,
} from "./finance-schemas.js";
import {
  findOwnedFinanceBill,
} from "./service.js";
import {
  fromPrismaFinanceTransactionType,
  serializeFinanceTransaction,
  toPrismaFinanceTransactionType,
  validateFinanceTransactionPayload,
} from "./finance-transaction-service.js";

export const registerFinanceTransactionRoutes: FastifyPluginAsync = async (app) => {
  app.get("/transactions", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(expenseRangeQuerySchema, request.query);
    const fromDate = parseIsoDate(query.from);
    const toDateExclusive = new Date(parseIsoDate(query.to).getTime() + 24 * 60 * 60 * 1000);
    const transactions = await app.prisma.financeTransaction.findMany({
      where: {
        userId: user.id,
        occurredOn: {
          gte: fromDate,
          lt: toDateExclusive,
        },
      },
      orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
    });

    const response: FinanceTransactionsResponse = withGeneratedAt({
      from: query.from,
      to: query.to,
      transactions: transactions.map(serializeFinanceTransaction),
    });

    return reply.send(response);
  });

  app.post("/transactions", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createFinanceTransactionSchema, request.body as CreateFinanceTransactionRequest);

    validateFinanceTransactionPayload(payload);
    await Promise.all([
      assertOwnedFinanceAccount(app.prisma, user.id, payload.accountId),
      assertOwnedFinanceAccount(app.prisma, user.id, payload.transferAccountId),
      assertOwnedExpenseCategory(app.prisma, user.id, payload.expenseCategoryId),
      payload.billId ? findOwnedFinanceBill(app.prisma, user.id, payload.billId) : Promise.resolve(null),
    ]);

    if (payload.transferAccountId && payload.transferAccountId === payload.accountId) {
      throw new AppError({
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Transfer accounts must be different",
      });
    }

    const transaction = await app.prisma.financeTransaction.create({
      data: {
        userId: user.id,
        accountId: payload.accountId,
        transferAccountId: payload.transactionType === "transfer" ? payload.transferAccountId ?? null : null,
        transactionType: toPrismaFinanceTransactionType(payload.transactionType),
        amountMinor: payload.amountMinor,
        currencyCode: payload.currencyCode ?? (await getUserCurrencyCode(app.prisma, user.id)),
        occurredOn: parseIsoDate(payload.occurredOn),
        description: payload.description ?? null,
        expenseCategoryId: payload.expenseCategoryId ?? null,
        billId: payload.billId ?? null,
      },
    });

    const response: FinanceTransactionMutationResponse = withGeneratedAt({
      transaction: serializeFinanceTransaction(transaction),
    });

    return reply.status(201).send(response);
  });

  app.patch("/transactions/:transactionId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { transactionId } = request.params as { transactionId: string };
    const payload = parseOrThrow(updateFinanceTransactionSchema, request.body as UpdateFinanceTransactionRequest);
    const existing = await app.prisma.financeTransaction.findFirst({
      where: {
        id: transactionId,
        userId: user.id,
      },
    });

    if (!existing) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Finance transaction not found",
      });
    }

    const nextPayload = {
      accountId: payload.accountId ?? existing.accountId,
      transferAccountId: payload.transferAccountId === undefined ? existing.transferAccountId : payload.transferAccountId,
      transactionType: payload.transactionType ?? fromPrismaFinanceTransactionType(existing.transactionType),
      amountMinor: payload.amountMinor ?? existing.amountMinor,
    };

    validateFinanceTransactionPayload(nextPayload);
    await Promise.all([
      assertOwnedFinanceAccount(app.prisma, user.id, nextPayload.accountId),
      assertOwnedFinanceAccount(app.prisma, user.id, nextPayload.transferAccountId),
      assertOwnedExpenseCategory(app.prisma, user.id, payload.expenseCategoryId),
      payload.billId ? findOwnedFinanceBill(app.prisma, user.id, payload.billId) : Promise.resolve(null),
    ]);

    if (nextPayload.transferAccountId && nextPayload.transferAccountId === nextPayload.accountId) {
      throw new AppError({
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Transfer accounts must be different",
      });
    }

    const transaction = await app.prisma.financeTransaction.update({
      where: {
        id: existing.id,
      },
      data: {
        accountId: payload.accountId,
        transferAccountId: nextPayload.transactionType === "transfer" ? nextPayload.transferAccountId : null,
        transactionType: payload.transactionType ? toPrismaFinanceTransactionType(payload.transactionType) : undefined,
        amountMinor: payload.amountMinor,
        currencyCode: payload.currencyCode,
        occurredOn: payload.occurredOn ? parseIsoDate(payload.occurredOn) : undefined,
        description: payload.description,
        expenseCategoryId: payload.expenseCategoryId,
        billId: payload.billId,
      },
    });

    const response: FinanceTransactionMutationResponse = withGeneratedAt({
      transaction: serializeFinanceTransaction(transaction),
    });

    return reply.send(response);
  });
};
