import type { FastifyPluginAsync } from "fastify";
import type {
  CreateRecurringExpenseRequest,
  RecurringExpenseMutationResponse,
  RecurringExpensesResponse,
  UpdateRecurringExpenseRequest,
} from "@life-os/contracts";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { upsertRecurrenceRuleRecord } from "../../lib/recurrence/store.js";
import { parseIsoDate } from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import { assertOwnedExpenseCategory } from "./finance-category-service.js";
import { getUserCurrencyCode } from "./finance-currency-service.js";
import {
  createRecurringExpenseSchema,
  updateRecurringExpenseSchema,
} from "./finance-schemas.js";
import {
  findOwnedRecurringExpenseTemplate,
  resolveRecurringExpenseRecurrenceInput,
  serializeRecurringExpense,
  toPrismaRecurringExpenseStatus,
} from "./finance-recurring-expense-service.js";

const recurringExpenseInclude = {
  recurrenceRuleRecord: {
    include: {
      exceptions: {
        orderBy: {
          occurrenceDate: "asc" as const,
        },
      },
    },
  },
};

export const registerFinanceRecurringExpenseRoutes: FastifyPluginAsync = async (app) => {
  app.get("/recurring-expenses", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const recurringExpenses = await app.prisma.recurringExpenseTemplate.findMany({
      where: {
        userId: user.id,
      },
      include: recurringExpenseInclude,
      orderBy: [
        { status: "asc" },
        { nextDueOn: "asc" },
        { createdAt: "asc" },
      ],
    });

    const response: RecurringExpensesResponse = withGeneratedAt({
      recurringExpenses: recurringExpenses.map(serializeRecurringExpense),
    });

    return reply.send(response);
  });

  app.post("/recurring-expenses", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(
      createRecurringExpenseSchema,
      request.body as CreateRecurringExpenseRequest,
    );
    const recurrence = resolveRecurringExpenseRecurrenceInput(payload);

    await assertOwnedExpenseCategory(app.prisma, user.id, payload.expenseCategoryId);

    const recurringExpense = await app.prisma.$transaction(async (tx) => {
      const createdRecurringExpense = await tx.recurringExpenseTemplate.create({
        data: {
          userId: user.id,
          title: payload.title,
          expenseCategoryId: payload.expenseCategoryId ?? null,
          defaultAmountMinor: payload.defaultAmountMinor ?? null,
          currencyCode: payload.currencyCode ?? (await getUserCurrencyCode(app.prisma, user.id)),
          recurrenceRule: recurrence.legacyRuleText,
          nextDueOn: parseIsoDate(payload.nextDueOn),
          remindDaysBefore: payload.remindDaysBefore ?? 0,
          status: toPrismaRecurringExpenseStatus(payload.status ?? "active"),
        },
      });

      const recurrenceRecord = await upsertRecurrenceRuleRecord(tx, {
        ownerType: "RECURRING_EXPENSE",
        ownerId: createdRecurringExpense.id,
        recurrence: recurrence.recurrence,
        legacyRuleText: recurrence.legacyRuleText,
      });

      await tx.recurringExpenseTemplate.update({
        where: {
          id: createdRecurringExpense.id,
        },
        data: {
          recurrenceRuleId: recurrenceRecord.id,
        },
      });

      return tx.recurringExpenseTemplate.findUniqueOrThrow({
        where: {
          id: createdRecurringExpense.id,
        },
        include: recurringExpenseInclude,
      });
    });

    const response: RecurringExpenseMutationResponse = withGeneratedAt({
      recurringExpense: serializeRecurringExpense(recurringExpense),
    });

    return reply.status(201).send(response);
  });

  app.patch("/recurring-expenses/:recurringExpenseId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { recurringExpenseId } = request.params as { recurringExpenseId: string };
    const payload = parseOrThrow(
      updateRecurringExpenseSchema,
      request.body as UpdateRecurringExpenseRequest,
    );

    const existingRecurringExpense = await findOwnedRecurringExpenseTemplate(app.prisma, user.id, recurringExpenseId);
    await assertOwnedExpenseCategory(app.prisma, user.id, payload.expenseCategoryId);

    const recurringExpense = await app.prisma.$transaction(async (tx) => {
      const recurrence =
        payload.recurrence || payload.recurrenceRule || payload.nextDueOn
          ? resolveRecurringExpenseRecurrenceInput({
              recurrence: payload.recurrence,
              recurrenceRule: payload.recurrenceRule,
              nextDueOn: payload.nextDueOn ?? toIsoDateString(existingRecurringExpense.nextDueOn),
            })
          : null;

      await tx.recurringExpenseTemplate.update({
        where: {
          id: recurringExpenseId,
        },
        data: {
          title: payload.title,
          expenseCategoryId: payload.expenseCategoryId,
          defaultAmountMinor: payload.defaultAmountMinor,
          currencyCode: payload.currencyCode,
          recurrenceRule: recurrence?.legacyRuleText ?? payload.recurrenceRule,
          nextDueOn: payload.nextDueOn ? parseIsoDate(payload.nextDueOn) : undefined,
          remindDaysBefore: payload.remindDaysBefore,
          status: payload.status ? toPrismaRecurringExpenseStatus(payload.status) : undefined,
        },
      });

      if (recurrence) {
        const recurrenceRecord = await upsertRecurrenceRuleRecord(tx, {
          ownerType: "RECURRING_EXPENSE",
          ownerId: recurringExpenseId,
          recurrence: recurrence.recurrence,
          legacyRuleText: recurrence.legacyRuleText,
        });

        await tx.recurringExpenseTemplate.update({
          where: {
            id: recurringExpenseId,
          },
          data: {
            recurrenceRuleId: recurrenceRecord.id,
          },
        });
      }

      return tx.recurringExpenseTemplate.findUniqueOrThrow({
        where: {
          id: recurringExpenseId,
        },
        include: recurringExpenseInclude,
      });
    });

    const response: RecurringExpenseMutationResponse = withGeneratedAt({
      recurringExpense: serializeRecurringExpense(recurringExpense),
    });

    return reply.send(response);
  });
};
