import type { FastifyPluginAsync } from "fastify";
import type {
  CreateExpenseCategoryRequest,
  ExpenseCategoryMutationResponse,
  FinanceCategoriesResponse,
  UpdateExpenseCategoryRequest,
} from "@life-os/contracts";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import {
  createExpenseCategorySchema,
  updateExpenseCategorySchema,
} from "./finance-schemas.js";
import {
  findOwnedExpenseCategory,
  serializeExpenseCategory,
} from "./finance-category-service.js";

export const registerFinanceCategoryRoutes: FastifyPluginAsync = async (app) => {
  app.get("/categories", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const categories = await app.prisma.expenseCategory.findMany({
      where: {
        userId: user.id,
        archivedAt: null,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    const response: FinanceCategoriesResponse = withGeneratedAt({
      categories: categories.map(serializeExpenseCategory),
    });

    return reply.send(response);
  });

  app.post("/categories", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(
      createExpenseCategorySchema,
      request.body as CreateExpenseCategoryRequest,
    );
    const category = await app.prisma.expenseCategory.create({
      data: {
        userId: user.id,
        name: payload.name,
        color: payload.color ?? null,
        sortOrder: payload.sortOrder ?? 0,
      },
    });

    const response: ExpenseCategoryMutationResponse = withGeneratedAt({
      category: serializeExpenseCategory(category),
    });

    return reply.status(201).send(response);
  });

  app.patch("/categories/:categoryId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { categoryId } = request.params as { categoryId: string };
    const payload = parseOrThrow(
      updateExpenseCategorySchema,
      request.body as UpdateExpenseCategoryRequest,
    );

    await findOwnedExpenseCategory(app.prisma, user.id, categoryId);

    const category = await app.prisma.expenseCategory.update({
      where: {
        id: categoryId,
      },
      data: {
        name: payload.name,
        color: payload.color,
        sortOrder: payload.sortOrder,
        archivedAt:
          payload.archived === undefined
            ? undefined
            : payload.archived
              ? new Date()
              : null,
      },
    });

    const response: ExpenseCategoryMutationResponse = withGeneratedAt({
      category: serializeExpenseCategory(category),
    });

    return reply.send(response);
  });
};
