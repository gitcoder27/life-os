import type { FastifyPluginAsync } from "fastify";
import type {
  FinanceMonthPlanMutationResponse,
  FinanceMonthPlanResponse,
  UpdateFinanceMonthPlanRequest,
} from "@life-os/contracts";
import { z } from "zod";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import { assertOwnedExpenseCategory } from "./finance-category-service.js";
import {
  isoMonthSchema,
  updateFinanceMonthPlanSchema,
} from "./finance-schemas.js";
import {
  buildFinanceMonthPlan,
  getMonthBounds,
} from "./finance-month-plan-service.js";

export const registerFinanceMonthPlanRoutes: FastifyPluginAsync = async (app) => {
  app.get("/month-plan", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(
      z.object({
        month: isoMonthSchema,
      }),
      request.query,
    );

    const response: FinanceMonthPlanResponse = withGeneratedAt({
      monthPlan: await buildFinanceMonthPlan(app, user.id, query.month),
    });

    return reply.send(response);
  });

  app.put("/month-plan", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(
      z.object({
        month: isoMonthSchema,
      }),
      request.query,
    );
    const payload = parseOrThrow(updateFinanceMonthPlanSchema, request.body as UpdateFinanceMonthPlanRequest);
    const { monthStart } = getMonthBounds(query.month);

    for (const watch of payload.categoryWatches ?? []) {
      await assertOwnedExpenseCategory(app.prisma, user.id, watch.expenseCategoryId);
    }

    await app.prisma.$transaction(async (tx) => {
      const monthPlan = await tx.financeMonthPlan.upsert({
        where: {
          userId_monthStart: {
            userId: user.id,
            monthStart,
          },
        },
        update: {
          plannedSpendMinor: payload.plannedSpendMinor,
          fixedObligationsMinor: payload.fixedObligationsMinor,
          flexibleSpendTargetMinor: payload.flexibleSpendTargetMinor,
          plannedIncomeMinor: payload.plannedIncomeMinor,
          expectedLargeExpensesMinor: payload.expectedLargeExpensesMinor,
        },
        create: {
          userId: user.id,
          monthStart,
          plannedSpendMinor: payload.plannedSpendMinor ?? null,
          fixedObligationsMinor: payload.fixedObligationsMinor ?? null,
          flexibleSpendTargetMinor: payload.flexibleSpendTargetMinor ?? null,
          plannedIncomeMinor: payload.plannedIncomeMinor ?? null,
          expectedLargeExpensesMinor: payload.expectedLargeExpensesMinor ?? null,
        },
      });

      if (payload.categoryWatches) {
        await tx.financeMonthPlanCategoryWatch.deleteMany({
          where: {
            financeMonthPlanId: monthPlan.id,
          },
        });

        if (payload.categoryWatches.length > 0) {
          await tx.financeMonthPlanCategoryWatch.createMany({
            data: payload.categoryWatches.map((watch) => ({
              financeMonthPlanId: monthPlan.id,
              expenseCategoryId: watch.expenseCategoryId,
              watchLimitMinor: watch.watchLimitMinor,
            })),
          });
        }
      }
    });

    const response: FinanceMonthPlanMutationResponse = withGeneratedAt({
      monthPlan: await buildFinanceMonthPlan(app, user.id, query.month),
    });

    return reply.send(response);
  });
};
