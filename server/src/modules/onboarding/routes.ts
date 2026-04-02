import type { FastifyPluginAsync } from "fastify";
import type {
  MealSlot as PrismaMealSlot,
  Prisma,
} from "@prisma/client";

import type {
  OnboardingCompleteRequest,
  OnboardingCompleteResponse,
  OnboardingStateResponse,
} from "@life-os/contracts";
import type { IsoDateString } from "@life-os/contracts";
import { z } from "zod";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { withGeneratedAt, withWriteSuccess } from "../../lib/http/response.js";
import { getMonthEndDate, getWeekEndDate, parseIsoDate } from "../../lib/time/cycle.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import { ensureGoalConfigSeeded } from "../planning/goal-config.js";
import { toPrismaGoalDomainSystemKey } from "../planning/planning-mappers.js";

const goalDomainSchema = z.enum([
  "health",
  "money",
  "work_growth",
  "home_admin",
  "discipline",
  "other",
]);
const mealSlotSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);
const routinePeriodSchema = z.enum(["morning", "evening"]);

const onboardingGoalSchema = z.object({
  title: z.string().min(1).max(200),
  domain: goalDomainSchema,
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
});

const onboardingHabitSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.string().max(120).nullable().optional(),
  targetPerDay: z.number().int().positive().max(20).optional(),
  scheduleRuleJson: z.record(z.string(), z.unknown()).optional(),
});

const onboardingRoutineItemSchema = z.object({
  title: z.string().min(1).max(200),
  isRequired: z.boolean().optional(),
});

const onboardingRoutineSchema = z.object({
  name: z.string().min(1).max(200),
  period: routinePeriodSchema,
  items: z.array(onboardingRoutineItemSchema).min(1).max(20),
});

const onboardingExpenseCategorySchema = z.object({
  name: z.string().min(1).max(120),
  color: z.string().max(32).nullable().optional(),
});

const onboardingMealTemplateSchema = z.object({
  name: z.string().min(1).max(120),
  mealSlot: mealSlotSchema.nullable().optional(),
  description: z.string().min(1).max(500),
});

function normalizeClockTime(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return value;
  }

  const trimmed = value.trim().toLowerCase();

  if (!trimmed) {
    return null;
  }

  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);

  if (!match) {
    return value;
  }

  const hour = Number.parseInt(match[1] ?? "0", 10);
  const minute = Number.parseInt(match[2] ?? "0", 10);

  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    return value;
  }

  const normalizedHour =
    match[3] === "pm"
      ? hour === 12
        ? 12
        : hour + 12
      : hour === 12
        ? 0
        : hour;

  return `${String(normalizedHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

const onboardingCompletionSchema = z.object({
  displayName: z.string().min(1),
  timezone: z.string().min(1),
  currencyCode: z.string().length(3),
  weekStartsOn: z.number().int().min(0).max(6),
  dailyWaterTargetMl: z.number().int().positive(),
  dailyReviewStartTime: z.preprocess(
    (value) =>
      typeof value === "string" || value === null || value === undefined
        ? normalizeClockTime(value)
        : value,
    z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  ),
  dailyReviewEndTime: z.preprocess(
    (value) =>
      typeof value === "string" || value === null || value === undefined
        ? normalizeClockTime(value)
        : value,
    z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  ),
  lifePriorities: z.array(z.string().min(1).max(200)).min(1).max(5),
  goals: z.array(onboardingGoalSchema).max(10),
  habits: z.array(onboardingHabitSchema).max(20),
  routines: z.array(onboardingRoutineSchema).max(6),
  expenseCategories: z.array(onboardingExpenseCategorySchema).max(20),
  mealTemplates: z.array(onboardingMealTemplateSchema).max(20).optional(),
  firstWeekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  firstMonthStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function toMealSlot(
  mealSlot: "breakfast" | "lunch" | "dinner" | "snack" | null | undefined,
): PrismaMealSlot | null {
  switch (mealSlot) {
    case "breakfast":
      return "BREAKFAST";
    case "lunch":
      return "LUNCH";
    case "dinner":
      return "DINNER";
    case "snack":
      return "SNACK";
    default:
      return null;
  }
}

function getOnboardingDefaults() {
  return {
    dailyReviewStartTime: "20:00",
    dailyReviewEndTime: "10:00",
    expenseCategorySuggestions: [
      "Groceries",
      "Dining",
      "Transport",
      "Utilities",
      "Subscriptions",
      "Health",
    ],
    habitSuggestions: ["Morning planning", "Workout", "Hydration", "Evening reset"],
    routineTemplates: [
      {
        name: "Morning Reset",
        period: "morning" as const,
        items: ["Review top 3 priorities", "Drink water", "Check calendar"],
      },
      {
        name: "Evening Reset",
        period: "evening" as const,
        items: ["Daily review", "Prep tomorrow", "Tidy key space"],
      },
    ],
    mealTemplateSuggestions: [
      { name: "Protein breakfast", mealSlot: "breakfast" as const },
      { name: "Quick lunch", mealSlot: "lunch" as const },
      { name: "Default dinner", mealSlot: "dinner" as const },
    ],
  };
}

export const registerOnboardingRoutes: FastifyPluginAsync = async (app) => {
  app.get("/state", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const preferences = await app.prisma.userPreference.findUnique({
      where: {
        userId: user.id,
      },
    });
    const dbUser = await app.prisma.user.findUniqueOrThrow({
      where: {
        id: user.id,
      },
    });
    const defaults = getOnboardingDefaults();

    const response: OnboardingStateResponse = withGeneratedAt({
      isRequired: false,
      isComplete: Boolean(dbUser.onboardedAt),
      completedAt: dbUser.onboardedAt ? dbUser.onboardedAt.toISOString() : null,
      nextStep: dbUser.onboardedAt ? null : "account",
      defaults: {
        timezone: preferences?.timezone ?? "UTC",
        currencyCode: preferences?.currencyCode ?? "USD",
        weekStartsOn: preferences?.weekStartsOn ?? 1,
        dailyWaterTargetMl: preferences?.dailyWaterTargetMl ?? 2500,
        dailyReviewStartTime: preferences?.dailyReviewStartTime ?? defaults.dailyReviewStartTime,
        dailyReviewEndTime: preferences?.dailyReviewEndTime ?? defaults.dailyReviewEndTime,
        expenseCategorySuggestions: defaults.expenseCategorySuggestions,
        habitSuggestions: defaults.habitSuggestions,
        routineTemplates: defaults.routineTemplates,
        mealTemplateSuggestions: defaults.mealTemplateSuggestions,
      },
    });

    return reply.send(response);
  });

  app.post("/complete", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(onboardingCompletionSchema, request.body as OnboardingCompleteRequest);
    const completedAt = new Date().toISOString();
    const weekStartDate = parseIsoDate(payload.firstWeekStartDate as IsoDateString);
    const dailyReviewStartTime =
      typeof payload.dailyReviewStartTime === "string" ? payload.dailyReviewStartTime : "20:00";
    const dailyReviewEndTime =
      typeof payload.dailyReviewEndTime === "string" ? payload.dailyReviewEndTime : "10:00";
    const inferredFirstMonthStartDate = `${weekStartDate.getUTCFullYear()}-${String(
      weekStartDate.getUTCMonth() + 1,
    ).padStart(2, "0")}-01` as OnboardingCompleteRequest["firstWeekStartDate"];
    const monthStartDate = parseIsoDate(
      (payload.firstMonthStartDate ?? inferredFirstMonthStartDate) as IsoDateString,
    );

    await app.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          displayName: payload.displayName,
          onboardedAt: completedAt,
        },
      });

      await tx.userPreference.upsert({
        where: {
          userId: user.id,
        },
        create: {
          userId: user.id,
          timezone: payload.timezone,
          currencyCode: payload.currencyCode,
          weekStartsOn: payload.weekStartsOn,
          dailyWaterTargetMl: payload.dailyWaterTargetMl,
          dailyReviewStartTime,
          dailyReviewEndTime,
        },
        update: {
          timezone: payload.timezone,
          currencyCode: payload.currencyCode,
          weekStartsOn: payload.weekStartsOn,
          dailyWaterTargetMl: payload.dailyWaterTargetMl,
          dailyReviewStartTime,
          dailyReviewEndTime,
        },
      });

      await tx.goal.deleteMany({
        where: {
          userId: user.id,
        },
      });
      if (payload.goals.length > 0) {
        await ensureGoalConfigSeeded(tx, user.id);
        const goalDomains = await tx.goalDomainConfig.findMany({
          where: {
            userId: user.id,
          },
        });
        const goalDomainBySystemKey = new Map(
          goalDomains
            .filter((domain) => domain.systemKey)
            .map((domain) => [domain.systemKey!, domain.id]),
        );

        await tx.goal.createMany({
          data: payload.goals.map((goal, index) => {
            const domainId = goalDomainBySystemKey.get(toPrismaGoalDomainSystemKey(goal.domain));
            if (!domainId) {
              throw new Error(`Missing goal domain seed for ${goal.domain}`);
            }

            return {
              userId: user.id,
              title: goal.title,
              domainId,
              targetDate: goal.targetDate ? parseIsoDate(goal.targetDate as IsoDateString) : null,
              notes:
                goal.notes ??
                (payload.lifePriorities.length > 0
                  ? `Life priorities: ${payload.lifePriorities.join(", ")}`
                  : null),
              sortOrder: index + 1,
            };
          }),
        });
      }

      await tx.habit.deleteMany({
        where: {
          userId: user.id,
        },
      });
      if (payload.habits.length > 0) {
        await tx.habit.createMany({
          data: payload.habits.map((habit) => ({
            userId: user.id,
            title: habit.title,
            category: habit.category ?? null,
            targetPerDay: habit.targetPerDay ?? 1,
            scheduleRuleJson:
              (habit.scheduleRuleJson ?? { cadence: "daily" }) as Prisma.InputJsonValue,
          })),
        });
      }

      await tx.routine.deleteMany({
        where: {
          userId: user.id,
        },
      });
      const orderedRoutines = [...payload.routines].sort((left, right) => {
        const leftWeight = left.period === "morning" ? 0 : 1;
        const rightWeight = right.period === "morning" ? 0 : 1;

        return leftWeight - rightWeight;
      });

      for (const [index, routine] of orderedRoutines.entries()) {
        const createdRoutine = await tx.routine.create({
          data: {
            userId: user.id,
            name: routine.name,
            sortOrder: index,
          },
        });

        await tx.routineItem.createMany({
          data: routine.items.map((item, index) => ({
            routineId: createdRoutine.id,
            title: item.title,
            sortOrder: index + 1,
            isRequired: item.isRequired ?? true,
          })),
        });
      }

      await tx.expenseCategory.deleteMany({
        where: {
          userId: user.id,
        },
      });
      if (payload.expenseCategories.length > 0) {
        await tx.expenseCategory.createMany({
          data: payload.expenseCategories.map((category, index) => ({
            userId: user.id,
            name: category.name,
            color: category.color ?? null,
            sortOrder: index + 1,
          })),
        });
      }

      await tx.mealTemplate.deleteMany({
        where: {
          userId: user.id,
        },
      });
      if ((payload.mealTemplates?.length ?? 0) > 0) {
        await tx.mealTemplate.createMany({
          data: (payload.mealTemplates ?? []).map((mealTemplate) => ({
            userId: user.id,
            name: mealTemplate.name,
            mealSlot: toMealSlot(mealTemplate.mealSlot),
            templatePayloadJson: {
              description: mealTemplate.description,
            },
          })),
        });
      }

      await tx.planningCycle.upsert({
        where: {
          userId_cycleType_cycleStartDate: {
            userId: user.id,
            cycleType: "WEEK",
            cycleStartDate: weekStartDate,
          },
        },
        update: {
          cycleEndDate: getWeekEndDate(weekStartDate),
        },
        create: {
          userId: user.id,
          cycleType: "WEEK",
          cycleStartDate: weekStartDate,
          cycleEndDate: getWeekEndDate(weekStartDate),
        },
      });

      await tx.planningCycle.upsert({
        where: {
          userId_cycleType_cycleStartDate: {
            userId: user.id,
            cycleType: "MONTH",
            cycleStartDate: monthStartDate,
          },
        },
        update: {
          cycleEndDate: getMonthEndDate(monthStartDate),
          theme: payload.lifePriorities[0] ?? null,
        },
        create: {
          userId: user.id,
          cycleType: "MONTH",
          cycleStartDate: monthStartDate,
          cycleEndDate: getMonthEndDate(monthStartDate),
          theme: payload.lifePriorities[0] ?? null,
        },
      });
    });

    await app.prisma.auditEvent.create({
      data: {
        userId: user.id,
        eventType: "onboarding.completed",
        eventPayloadJson: {
          goalCount: payload.goals.length,
          habitCount: payload.habits.length,
          routineCount: payload.routines.length,
          expenseCategoryCount: payload.expenseCategories.length,
          mealTemplateCount: payload.mealTemplates?.length ?? 0,
        },
      },
    });

    const response: OnboardingCompleteResponse = {
      ...withWriteSuccess({
        completedAt,
      }),
    };

    return reply.status(202).send(response);
  });
};
