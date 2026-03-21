import type { FastifyPluginAsync } from "fastify";
import type {
  CreateExpenseCategoryRequest,
  DeleteExpenseResponse,
  ExpenseCategoryItem,
  ExpenseCategoryMutationResponse,
  ExpensesResponse,
  FinanceCategoriesResponse,
  IsoDateString,
  IsoMonthString,
  RecurrenceInput,
  RecurringExpenseMutationResponse,
  UpdateExpenseCategoryRequest,
  UpdateRecurringExpenseRequest,
} from "@life-os/contracts";
import type {
  ExpenseCategory,
  AdminItemStatus as PrismaAdminItemStatus,
  Expense,
  ExpenseSource as PrismaExpenseSource,
  RecurringExpenseStatus as PrismaRecurringExpenseStatus,
  RecurringExpenseTemplate,
} from "@prisma/client";
import { z } from "zod";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { AppError } from "../../lib/errors/app-error.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { formatLegacyFinanceRecurrenceRule, parseLegacyFinanceRecurrenceRule } from "../../lib/recurrence/rules.js";
import { serializeRecurrenceDefinition, upsertRecurrenceRuleRecord } from "../../lib/recurrence/store.js";
import { parseIsoDate } from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import { parseOrThrow } from "../../lib/validation/parse.js";

type ExpenseSource = "manual" | "quick_capture" | "template";
type RecurringExpenseStatus = "active" | "paused" | "archived";
type AdminItemStatus = "pending" | "done" | "rescheduled" | "dropped";

interface ExpenseItem {
  id: string;
  expenseCategoryId: string | null;
  amountMinor: number;
  currencyCode: string;
  spentOn: IsoDateString;
  description: string | null;
  source: ExpenseSource;
  recurringExpenseTemplateId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FinanceSummaryResponse {
  generatedAt: string;
  month: IsoMonthString;
  currencyCode: string;
  totalSpentMinor: number;
  categoryTotals: Array<{
    expenseCategoryId: string | null;
    name: string;
    color: string | null;
    totalAmountMinor: number;
  }>;
  upcomingBills: Array<{
    id: string;
    title: string;
    dueOn: IsoDateString;
    amountMinor: number | null;
    status: AdminItemStatus;
  }>;
}

interface CreateExpenseRequest {
  expenseCategoryId?: string | null;
  amountMinor: number;
  currencyCode?: string;
  spentOn: IsoDateString;
  description?: string | null;
  source?: ExpenseSource;
  recurringExpenseTemplateId?: string | null;
}

interface UpdateExpenseRequest {
  expenseCategoryId?: string | null;
  amountMinor?: number;
  currencyCode?: string;
  spentOn?: IsoDateString;
  description?: string | null;
}

interface ExpenseMutationResponse {
  generatedAt: string;
  expense: ExpenseItem;
}

interface RecurringExpenseItem {
  id: string;
  title: string;
  expenseCategoryId: string | null;
  defaultAmountMinor: number | null;
  currencyCode: string;
  recurrenceRule: string;
  recurrence: ReturnType<typeof serializeRecurrenceDefinition>;
  nextDueOn: IsoDateString;
  remindDaysBefore: number;
  status: RecurringExpenseStatus;
  createdAt: string;
  updatedAt: string;
}

interface RecurringExpensesResponse {
  generatedAt: string;
  recurringExpenses: RecurringExpenseItem[];
}

interface CreateRecurringExpenseRequest {
  title: string;
  expenseCategoryId?: string | null;
  defaultAmountMinor?: number | null;
  currencyCode?: string;
  recurrenceRule?: string;
  recurrence?: RecurrenceInput;
  nextDueOn: IsoDateString;
  remindDaysBefore?: number;
  status?: RecurringExpenseStatus;
}

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/) as unknown as z.ZodType<IsoDateString>;
const isoMonthSchema = z.string().regex(/^\d{4}-\d{2}$/) as unknown as z.ZodType<IsoMonthString>;

const expenseSourceSchema = z.enum(["manual", "quick_capture", "template"]);
const recurringExpenseStatusSchema = z.enum(["active", "paused", "archived"]);
const recurrenceExceptionActionSchema = z.enum(["skip", "do_once", "reschedule"]);
const recurrenceRuleSchema = z.object({
  frequency: z.enum(["daily", "weekly", "monthly_nth_weekday", "interval"]),
  startsOn: isoDateSchema,
  interval: z.number().int().positive().max(365).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  nthWeekday: z
    .object({
      ordinal: z.union([z.literal(-1), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
      dayOfWeek: z.number().int().min(0).max(6),
    })
    .optional(),
  end: z
    .object({
      type: z.enum(["never", "on_date", "after_occurrences"]),
      until: isoDateSchema.nullable().optional(),
      occurrenceCount: z.number().int().positive().optional(),
    })
    .optional(),
});
const recurrenceInputSchema = z.object({
  rule: recurrenceRuleSchema,
  exceptions: z
    .array(
      z.object({
        occurrenceDate: isoDateSchema,
        action: recurrenceExceptionActionSchema,
        targetDate: isoDateSchema.nullable().optional(),
      }),
    )
    .max(180)
    .optional(),
});

const createExpenseSchema = z.object({
  expenseCategoryId: z.string().uuid().nullable().optional(),
  amountMinor: z.number().int().positive(),
  currencyCode: z.string().length(3).optional(),
  spentOn: isoDateSchema,
  description: z.string().max(4000).nullable().optional(),
  source: expenseSourceSchema.optional(),
  recurringExpenseTemplateId: z.string().uuid().nullable().optional(),
});

const updateExpenseSchema = z
  .object({
    expenseCategoryId: z.string().uuid().nullable().optional(),
    amountMinor: z.number().int().positive().optional(),
    currencyCode: z.string().length(3).optional(),
    spentOn: isoDateSchema.optional(),
    description: z.string().max(4000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const createRecurringExpenseSchema = z.object({
  title: z.string().min(1).max(200),
  expenseCategoryId: z.string().uuid().nullable().optional(),
  defaultAmountMinor: z.number().int().positive().nullable().optional(),
  currencyCode: z.string().length(3).optional(),
  recurrenceRule: z.string().min(1).max(100).optional(),
  recurrence: recurrenceInputSchema.optional(),
  nextDueOn: isoDateSchema,
  remindDaysBefore: z.number().int().min(0).max(365).optional(),
  status: recurringExpenseStatusSchema.optional(),
}).refine((value) => Boolean(value.recurrence || value.recurrenceRule), "Provide recurrence details");

const createExpenseCategorySchema = z.object({
  name: z.string().min(1).max(120),
  color: z.string().max(32).nullable().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

const updateExpenseCategorySchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    color: z.string().max(32).nullable().optional(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
    archived: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const updateRecurringExpenseSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    expenseCategoryId: z.string().uuid().nullable().optional(),
    defaultAmountMinor: z.number().int().positive().nullable().optional(),
    currencyCode: z.string().length(3).optional(),
    recurrenceRule: z.string().min(1).max(100).optional(),
    recurrence: recurrenceInputSchema.optional(),
    nextDueOn: isoDateSchema.optional(),
    remindDaysBefore: z.number().int().min(0).max(365).optional(),
    status: recurringExpenseStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const expenseRangeQuerySchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
});

function getMonthBounds(month: IsoMonthString) {
  const [year, monthNumber] = month.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, monthNumber - 1, 1));
  const nextMonthStart = new Date(Date.UTC(year, monthNumber, 1));

  return {
    monthStart,
    nextMonthStart,
  };
}

function toPrismaExpenseSource(source: ExpenseSource): PrismaExpenseSource {
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

function toPrismaRecurringExpenseStatus(
  status: RecurringExpenseStatus,
): PrismaRecurringExpenseStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "paused":
      return "PAUSED";
    case "archived":
      return "ARCHIVED";
  }

  throw new Error(`Unsupported recurring expense status: ${status satisfies never}`);
}

function fromPrismaRecurringExpenseStatus(
  status: PrismaRecurringExpenseStatus,
): RecurringExpenseStatus {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "PAUSED":
      return "paused";
    case "ARCHIVED":
      return "archived";
  }

  throw new Error(`Unsupported recurring expense status: ${status satisfies never}`);
}

function fromPrismaAdminItemStatus(status: PrismaAdminItemStatus) {
  switch (status) {
    case "PENDING":
      return "pending";
    case "DONE":
      return "done";
    case "RESCHEDULED":
      return "rescheduled";
    case "DROPPED":
      return "dropped";
  }

  throw new Error(`Unsupported admin item status: ${status satisfies never}`);
}

function serializeExpense(expense: Expense): ExpenseItem {
  return {
    id: expense.id,
    expenseCategoryId: expense.expenseCategoryId,
    amountMinor: expense.amountMinor,
    currencyCode: expense.currencyCode,
    spentOn: toIsoDateString(expense.spentOn),
    description: expense.description,
    source: fromPrismaExpenseSource(expense.source),
    recurringExpenseTemplateId: expense.recurringExpenseTemplateId,
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  };
}

function serializeExpenseCategory(category: ExpenseCategory): ExpenseCategoryItem {
  return {
    id: category.id,
    name: category.name,
    color: category.color,
    sortOrder: category.sortOrder,
    createdAt: category.createdAt.toISOString(),
    archivedAt: category.archivedAt?.toISOString() ?? null,
  };
}

function serializeRecurringExpense(
  recurringExpense: RecurringExpenseTemplate & {
    recurrenceRuleRecord?: Parameters<typeof serializeRecurrenceDefinition>[0];
  },
): RecurringExpenseItem {
  return {
    id: recurringExpense.id,
    title: recurringExpense.title,
    expenseCategoryId: recurringExpense.expenseCategoryId,
    defaultAmountMinor: recurringExpense.defaultAmountMinor,
    currencyCode: recurringExpense.currencyCode,
    recurrenceRule: recurringExpense.recurrenceRule,
    recurrence: serializeRecurrenceDefinition(recurringExpense.recurrenceRuleRecord),
    nextDueOn: toIsoDateString(recurringExpense.nextDueOn),
    remindDaysBefore: recurringExpense.remindDaysBefore,
    status: fromPrismaRecurringExpenseStatus(recurringExpense.status),
    createdAt: recurringExpense.createdAt.toISOString(),
    updatedAt: recurringExpense.updatedAt.toISOString(),
  };
}

function resolveRecurringExpenseRecurrenceInput(
  payload: { recurrence?: RecurrenceInput; recurrenceRule?: string; nextDueOn: IsoDateString },
) {
  if (payload.recurrence) {
    return {
      recurrence: payload.recurrence,
      legacyRuleText: formatLegacyFinanceRecurrenceRule(payload.recurrence.rule),
    };
  }

  const parsedRule = payload.recurrenceRule
    ? parseLegacyFinanceRecurrenceRule(payload.recurrenceRule, payload.nextDueOn)
    : null;
  if (!parsedRule) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Unsupported recurring expense rule",
    });
  }

  return {
    recurrence: {
      rule: parsedRule,
      exceptions: [],
    } satisfies RecurrenceInput,
    legacyRuleText: payload.recurrenceRule ?? formatLegacyFinanceRecurrenceRule(parsedRule),
  };
}

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

async function assertOwnedExpenseCategory(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  expenseCategoryId: string | null | undefined,
) {
  if (!expenseCategoryId) {
    return;
  }

  const category = await app.prisma.expenseCategory.findFirst({
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

async function findOwnedExpenseCategory(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  expenseCategoryId: string,
) {
  const category = await app.prisma.expenseCategory.findFirst({
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

async function assertOwnedRecurringExpenseTemplate(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  recurringExpenseTemplateId: string | null | undefined,
) {
  if (!recurringExpenseTemplateId) {
    return;
  }

  const recurringExpense = await app.prisma.recurringExpenseTemplate.findFirst({
    where: {
      id: recurringExpenseTemplateId,
      userId,
    },
  });

  if (!recurringExpense) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Recurring expense not found",
    });
  }
}

async function findOwnedRecurringExpenseTemplate(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  recurringExpenseTemplateId: string,
) {
  const recurringExpense = await app.prisma.recurringExpenseTemplate.findFirst({
    where: {
      id: recurringExpenseTemplateId,
      userId,
    },
  });

  if (!recurringExpense) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Recurring expense not found",
    });
  }

  return recurringExpense;
}

async function findOwnedExpense(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  expenseId: string,
) {
  const expense = await app.prisma.expense.findFirst({
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

export const registerFinanceRoutes: FastifyPluginAsync = async (app) => {
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

    await findOwnedExpenseCategory(app, user.id, categoryId);

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

  app.get("/expenses", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(expenseRangeQuerySchema, request.query);
    const fromDate = parseIsoDate(query.from);
    const toDateExclusive = new Date(parseIsoDate(query.to).getTime() + 24 * 60 * 60 * 1000);
    const expenses = await app.prisma.expense.findMany({
      where: {
        userId: user.id,
        spentOn: {
          gte: fromDate,
          lt: toDateExclusive,
        },
      },
      orderBy: [{ spentOn: "asc" }, { createdAt: "asc" }],
    });

    const response: ExpensesResponse = withGeneratedAt({
      from: query.from,
      to: query.to,
      expenses: expenses.map(serializeExpense),
    });

    return reply.send(response);
  });

  app.get("/summary", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(
      z.object({
        month: isoMonthSchema,
      }),
      request.query,
    );
    const { monthStart, nextMonthStart } = getMonthBounds(query.month);
    const currencyCode = await getUserCurrencyCode(app, user.id);

    const [expenses, categories, upcomingBills] = await Promise.all([
      app.prisma.expense.findMany({
        where: {
          userId: user.id,
          spentOn: {
            gte: monthStart,
            lt: nextMonthStart,
          },
        },
      }),
      app.prisma.expenseCategory.findMany({
        where: {
          userId: user.id,
          archivedAt: null,
        },
      }),
      app.prisma.adminItem.findMany({
        where: {
          userId: user.id,
          dueOn: {
            gte: monthStart,
            lt: nextMonthStart,
          },
          status: "PENDING",
        },
        orderBy: {
          dueOn: "asc",
        },
        take: 10,
      }),
    ]);

    const categoryLookup = new Map(categories.map((category) => [category.id, category]));
    const categoryTotalsMap = new Map<
      string,
      { expenseCategoryId: string | null; name: string; color: string | null; totalAmountMinor: number }
    >();
    let totalSpentMinor = 0;

    for (const expense of expenses) {
      totalSpentMinor += expense.amountMinor;
      const category = expense.expenseCategoryId ? categoryLookup.get(expense.expenseCategoryId) : null;
      const key = expense.expenseCategoryId ?? "uncategorized";
      const existing = categoryTotalsMap.get(key);

      if (existing) {
        existing.totalAmountMinor += expense.amountMinor;
        continue;
      }

      categoryTotalsMap.set(key, {
        expenseCategoryId: expense.expenseCategoryId,
        name: category?.name ?? "Uncategorized",
        color: category?.color ?? null,
        totalAmountMinor: expense.amountMinor,
      });
    }

    const response: FinanceSummaryResponse = withGeneratedAt({
      month: query.month,
      currencyCode,
      totalSpentMinor,
      categoryTotals: Array.from(categoryTotalsMap.values()).sort(
        (left, right) => right.totalAmountMinor - left.totalAmountMinor,
      ),
      upcomingBills: upcomingBills.map((bill) => ({
        id: bill.id,
        title: bill.title,
        dueOn: toIsoDateString(bill.dueOn),
        amountMinor: bill.amountMinor,
        status: fromPrismaAdminItemStatus(bill.status),
      })),
    });

    return reply.send(response);
  });

  app.post("/expenses", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createExpenseSchema, request.body as CreateExpenseRequest);

    await Promise.all([
      assertOwnedExpenseCategory(app, user.id, payload.expenseCategoryId),
      assertOwnedRecurringExpenseTemplate(app, user.id, payload.recurringExpenseTemplateId),
    ]);

    const expense = await app.prisma.expense.create({
      data: {
        userId: user.id,
        expenseCategoryId: payload.expenseCategoryId ?? null,
        amountMinor: payload.amountMinor,
        currencyCode: payload.currencyCode ?? (await getUserCurrencyCode(app, user.id)),
        spentOn: parseIsoDate(payload.spentOn),
        description: payload.description ?? null,
        source: toPrismaExpenseSource(payload.source ?? "manual"),
        recurringExpenseTemplateId: payload.recurringExpenseTemplateId ?? null,
      },
    });

    const response: ExpenseMutationResponse = withGeneratedAt({
      expense: serializeExpense(expense),
    });

    return reply.status(201).send(response);
  });

  app.patch("/expenses/:expenseId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(updateExpenseSchema, request.body as UpdateExpenseRequest);
    const { expenseId } = request.params as { expenseId: string };

    await findOwnedExpense(app, user.id, expenseId);
    await assertOwnedExpenseCategory(app, user.id, payload.expenseCategoryId);

    const expense = await app.prisma.expense.update({
      where: {
        id: expenseId,
      },
      data: {
        expenseCategoryId: payload.expenseCategoryId,
        amountMinor: payload.amountMinor,
        currencyCode: payload.currencyCode,
        spentOn: payload.spentOn ? parseIsoDate(payload.spentOn) : undefined,
        description: payload.description,
      },
    });

    const response: ExpenseMutationResponse = withGeneratedAt({
      expense: serializeExpense(expense),
    });

    return reply.send(response);
  });

  app.delete("/expenses/:expenseId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { expenseId } = request.params as { expenseId: string };

    await findOwnedExpense(app, user.id, expenseId);
    await app.prisma.expense.delete({
      where: {
        id: expenseId,
      },
    });

    const response: DeleteExpenseResponse = withGeneratedAt({
      deleted: true,
      expenseId,
    });

    return reply.send(response);
  });

  app.get("/recurring-expenses", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const recurringExpenses = await app.prisma.recurringExpenseTemplate.findMany({
      where: {
        userId: user.id,
      },
      include: {
        recurrenceRuleRecord: {
          include: {
            exceptions: {
              orderBy: {
                occurrenceDate: "asc",
              },
            },
          },
        },
      },
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

    await assertOwnedExpenseCategory(app, user.id, payload.expenseCategoryId);

    const recurringExpense = await app.prisma.$transaction(async (tx) => {
      const createdRecurringExpense = await tx.recurringExpenseTemplate.create({
        data: {
          userId: user.id,
          title: payload.title,
          expenseCategoryId: payload.expenseCategoryId ?? null,
          defaultAmountMinor: payload.defaultAmountMinor ?? null,
          currencyCode: payload.currencyCode ?? (await getUserCurrencyCode(app, user.id)),
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
        include: {
          recurrenceRuleRecord: {
            include: {
              exceptions: {
                orderBy: {
                  occurrenceDate: "asc",
                },
              },
            },
          },
        },
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

    const existingRecurringExpense = await findOwnedRecurringExpenseTemplate(app, user.id, recurringExpenseId);
    await assertOwnedExpenseCategory(app, user.id, payload.expenseCategoryId);

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
        include: {
          recurrenceRuleRecord: {
            include: {
              exceptions: {
                orderBy: {
                  occurrenceDate: "asc",
                },
              },
            },
          },
        },
      });
    });

    const response: RecurringExpenseMutationResponse = withGeneratedAt({
      recurringExpense: serializeRecurringExpense(recurringExpense),
    });

    return reply.send(response);
  });
};
