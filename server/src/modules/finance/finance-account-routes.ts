import type { FastifyPluginAsync } from "fastify";
import type {
  CreateFinanceAccountRequest,
  FinanceAccountMutationResponse,
  FinanceAccountsResponse,
  UpdateFinanceAccountRequest,
} from "@life-os/contracts";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import {
  buildFinanceAccountItems,
  findOwnedFinanceAccount,
  serializeFinanceAccount,
  toPrismaFinanceAccountType,
} from "./finance-account-service.js";
import { getUserCurrencyCode } from "./finance-currency-service.js";
import {
  createFinanceAccountSchema,
  updateFinanceAccountSchema,
} from "./finance-schemas.js";

export const registerFinanceAccountRoutes: FastifyPluginAsync = async (app) => {
  app.get("/accounts", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const response: FinanceAccountsResponse = withGeneratedAt({
      accounts: await buildFinanceAccountItems(app.prisma, user.id),
    });

    return reply.send(response);
  });

  app.post("/accounts", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createFinanceAccountSchema, request.body as CreateFinanceAccountRequest);
    const currencyCode = payload.currencyCode ?? (await getUserCurrencyCode(app.prisma, user.id));

    const account = await app.prisma.financeAccount.create({
      data: {
        userId: user.id,
        name: payload.name.trim(),
        accountType: toPrismaFinanceAccountType(payload.accountType ?? "bank"),
        currencyCode,
        openingBalanceMinor: payload.openingBalanceMinor ?? 0,
      },
    });

    const response: FinanceAccountMutationResponse = withGeneratedAt({
      account: serializeFinanceAccount(account, account.openingBalanceMinor),
    });

    return reply.status(201).send(response);
  });

  app.patch("/accounts/:accountId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { accountId } = request.params as { accountId: string };
    const payload = parseOrThrow(updateFinanceAccountSchema, request.body as UpdateFinanceAccountRequest);

    await findOwnedFinanceAccount(app.prisma, user.id, accountId);

    const account = await app.prisma.financeAccount.update({
      where: {
        id: accountId,
      },
      data: {
        name: payload.name?.trim(),
        accountType: payload.accountType ? toPrismaFinanceAccountType(payload.accountType) : undefined,
        openingBalanceMinor: payload.openingBalanceMinor,
        archivedAt:
          payload.archived === undefined
            ? undefined
            : payload.archived
              ? new Date()
              : null,
      },
    });

    const accounts = await buildFinanceAccountItems(app.prisma, user.id);
    const response: FinanceAccountMutationResponse = withGeneratedAt({
      account: accounts.find((item) => item.id === account.id) ?? serializeFinanceAccount(account, account.openingBalanceMinor),
    });

    return reply.send(response);
  });
};
