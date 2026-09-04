import type { FastifyPluginAsync } from "fastify";
import type {
  CreateCreditCardRequest,
  CreateLoanRequest,
  CreditCardMutationResponse,
  CreditCardsResponse,
  LoanMutationResponse,
  LoansResponse,
  PayCreditCardRequest,
  PayLoanRequest,
  UpdateCreditCardRequest,
  UpdateLoanRequest,
} from "@life-os/contracts";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { AppError } from "../../lib/errors/app-error.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { parseIsoDate } from "../../lib/time/cycle.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import {
  createCreditCardSchema,
  createLoanSchema,
  payDebtSchema,
  updateCreditCardSchema,
  updateLoanSchema,
} from "./finance-schemas.js";
import {
  payCreditCardDebt,
  payLoanDebt,
} from "./finance-debt-service.js";
import {
  serializeCreditCard,
  serializeLoan,
  toPrismaCreditCardStatus,
  toPrismaLoanStatus,
} from "./finance-debt-mappers.js";

async function getUserCurrencyCode(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
) {
  const preferences = await app.prisma.userPreference.findUnique({
    where: {
      userId,
    },
  });

  return preferences?.currencyCode ?? "USD";
}

async function assertOwnedFinanceAccount(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  accountId: string | null | undefined,
) {
  if (!accountId) {
    return;
  }

  const account = await app.prisma.financeAccount.findFirst({
    where: {
      id: accountId,
      userId,
    },
    select: {
      id: true,
    },
  });

  if (!account) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Finance account not found",
    });
  }
}

export const registerFinanceDebtRoutes: FastifyPluginAsync = async (app) => {
  app.get("/credit-cards", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const creditCards = await app.prisma.creditCard.findMany({
      where: {
        userId: user.id,
      },
      orderBy: [{ status: "asc" }, { paymentDueDay: "asc" }, { createdAt: "asc" }],
    });

    const response: CreditCardsResponse = withGeneratedAt({
      creditCards: creditCards.map(serializeCreditCard),
    });

    return reply.send(response);
  });

  app.post("/credit-cards", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createCreditCardSchema, request.body as CreateCreditCardRequest);

    await assertOwnedFinanceAccount(app, user.id, payload.paymentAccountId);

    const creditCard = await app.prisma.creditCard.create({
      data: {
        userId: user.id,
        paymentAccountId: payload.paymentAccountId ?? null,
        name: payload.name.trim(),
        issuer: payload.issuer ?? null,
        currencyCode: payload.currencyCode ?? (await getUserCurrencyCode(app, user.id)),
        creditLimitMinor: payload.creditLimitMinor,
        outstandingBalanceMinor: payload.outstandingBalanceMinor ?? 0,
        statementDay: payload.statementDay ?? null,
        paymentDueDay: payload.paymentDueDay ?? null,
        minimumDueMinor: payload.minimumDueMinor ?? null,
        status: toPrismaCreditCardStatus(payload.status ?? "active"),
      },
    });

    const response: CreditCardMutationResponse = withGeneratedAt({
      creditCard: serializeCreditCard(creditCard),
    });

    return reply.status(201).send(response);
  });

  app.patch("/credit-cards/:creditCardId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { creditCardId } = request.params as { creditCardId: string };
    const payload = parseOrThrow(updateCreditCardSchema, request.body as UpdateCreditCardRequest);
    const existing = await app.prisma.creditCard.findFirst({
      where: {
        id: creditCardId,
        userId: user.id,
      },
    });

    if (!existing) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Credit card not found",
      });
    }

    await assertOwnedFinanceAccount(app, user.id, payload.paymentAccountId);

    const creditCard = await app.prisma.creditCard.update({
      where: {
        id: existing.id,
      },
      data: {
        paymentAccountId: payload.paymentAccountId,
        name: payload.name?.trim(),
        issuer: payload.issuer,
        currencyCode: payload.currencyCode,
        creditLimitMinor: payload.creditLimitMinor,
        outstandingBalanceMinor: payload.outstandingBalanceMinor,
        statementDay: payload.statementDay,
        paymentDueDay: payload.paymentDueDay,
        minimumDueMinor: payload.minimumDueMinor,
        status: payload.status ? toPrismaCreditCardStatus(payload.status) : undefined,
      },
    });

    const response: CreditCardMutationResponse = withGeneratedAt({
      creditCard: serializeCreditCard(creditCard),
    });

    return reply.send(response);
  });

  app.post("/credit-cards/:creditCardId/pay", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { creditCardId } = request.params as { creditCardId: string };
    const payload = parseOrThrow(payDebtSchema, request.body as PayCreditCardRequest);
    const creditCard = await payCreditCardDebt(app.prisma, creditCardId, {
      userId: user.id,
      accountId: payload.accountId,
      amountMinor: payload.amountMinor,
      paidOn: payload.paidOn,
    });

    const response: CreditCardMutationResponse = withGeneratedAt({
      creditCard: serializeCreditCard(creditCard),
    });

    return reply.send(response);
  });

  app.get("/loans", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const loans = await app.prisma.loan.findMany({
      where: {
        userId: user.id,
      },
      orderBy: [{ status: "asc" }, { dueDay: "asc" }, { createdAt: "asc" }],
    });

    const response: LoansResponse = withGeneratedAt({
      loans: loans.map(serializeLoan),
    });

    return reply.send(response);
  });

  app.post("/loans", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createLoanSchema, request.body as CreateLoanRequest);

    await assertOwnedFinanceAccount(app, user.id, payload.paymentAccountId);

    const loan = await app.prisma.loan.create({
      data: {
        userId: user.id,
        paymentAccountId: payload.paymentAccountId ?? null,
        name: payload.name.trim(),
        lender: payload.lender ?? null,
        currencyCode: payload.currencyCode ?? (await getUserCurrencyCode(app, user.id)),
        principalAmountMinor: payload.principalAmountMinor ?? null,
        outstandingBalanceMinor: payload.outstandingBalanceMinor,
        emiAmountMinor: payload.emiAmountMinor,
        interestRateBps: payload.interestRateBps ?? null,
        dueDay: payload.dueDay ?? null,
        startOn: payload.startOn ? parseIsoDate(payload.startOn) : null,
        endOn: payload.endOn ? parseIsoDate(payload.endOn) : null,
        status: toPrismaLoanStatus(payload.status ?? "active"),
      },
    });

    const response: LoanMutationResponse = withGeneratedAt({
      loan: serializeLoan(loan),
    });

    return reply.status(201).send(response);
  });

  app.patch("/loans/:loanId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { loanId } = request.params as { loanId: string };
    const payload = parseOrThrow(updateLoanSchema, request.body as UpdateLoanRequest);
    const existing = await app.prisma.loan.findFirst({
      where: {
        id: loanId,
        userId: user.id,
      },
    });

    if (!existing) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Loan not found",
      });
    }

    await assertOwnedFinanceAccount(app, user.id, payload.paymentAccountId);

    const loan = await app.prisma.loan.update({
      where: {
        id: existing.id,
      },
      data: {
        paymentAccountId: payload.paymentAccountId,
        name: payload.name?.trim(),
        lender: payload.lender,
        currencyCode: payload.currencyCode,
        principalAmountMinor: payload.principalAmountMinor,
        outstandingBalanceMinor: payload.outstandingBalanceMinor,
        emiAmountMinor: payload.emiAmountMinor,
        interestRateBps: payload.interestRateBps,
        dueDay: payload.dueDay,
        startOn: payload.startOn ? parseIsoDate(payload.startOn) : payload.startOn === null ? null : undefined,
        endOn: payload.endOn ? parseIsoDate(payload.endOn) : payload.endOn === null ? null : undefined,
        status: payload.status ? toPrismaLoanStatus(payload.status) : undefined,
      },
    });

    const response: LoanMutationResponse = withGeneratedAt({
      loan: serializeLoan(loan),
    });

    return reply.send(response);
  });

  app.post("/loans/:loanId/pay", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { loanId } = request.params as { loanId: string };
    const payload = parseOrThrow(payDebtSchema, request.body as PayLoanRequest);
    const loan = await payLoanDebt(app.prisma, loanId, {
      userId: user.id,
      accountId: payload.accountId,
      amountMinor: payload.amountMinor,
      paidOn: payload.paidOn,
    });

    const response: LoanMutationResponse = withGeneratedAt({
      loan: serializeLoan(loan),
    });

    return reply.send(response);
  });
};
