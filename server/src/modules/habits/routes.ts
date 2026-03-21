import type { FastifyPluginAsync } from "fastify";
import type {
  CreateHabitRequest,
  CreateRoutineRequest,
  HabitCheckinRequest,
  HabitItem,
  HabitMutationResponse,
  HabitScheduleRule,
  HabitsResponse,
  IsoDateString,
  RoutineMutationResponse,
  RoutineRecord,
  RoutineStatus,
  RoutinesResponse,
  RoutineItemCheckinRequest,
  UpdateHabitRequest,
  UpdateRoutineRequest,
  RecurrenceInput,
} from "@life-os/contracts";
import type {
  Prisma,
  CheckinStatus as PrismaCheckinStatus,
  GoalDomain as PrismaGoalDomain,
  GoalStatus as PrismaGoalStatus,
  Habit,
  HabitCheckin,
  HabitStatus as PrismaHabitStatus,
  Routine,
  RoutineItem,
  RoutineItemCheckin,
  RoutinePeriod as PrismaRoutinePeriod,
  RoutineStatus as PrismaRoutineStatus,
} from "@prisma/client";
import { z } from "zod";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { AppError } from "../../lib/errors/app-error.js";
import {
  calculateHabitActiveStreak,
  calculateHabitRisk,
  calculateWeeklyHabitChallenge,
} from "../../lib/habits/guidance.js";
import {
  isHabitDueOnIsoDate,
  normalizeHabitScheduleRule,
  resolveHabitRecurrence,
} from "../../lib/habits/schedule.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { buildLegacyHabitRecurrence, deriveHabitScheduleFromRecurrence } from "../../lib/recurrence/rules.js";
import { serializeRecurrenceDefinition, upsertRecurrenceRuleRecord } from "../../lib/recurrence/store.js";
import { addIsoDays, getWeekEndDate, getWeekStartIsoDate, parseIsoDate } from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import { getUserLocalDate } from "../../lib/time/user-time.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import { ensureCycle } from "../scoring/service.js";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/) as unknown as z.ZodType<IsoDateString>;
const habitStatusSchema = z.enum(["active", "paused", "archived"]);
const habitCheckinStatusSchema = z.enum(["completed", "skipped"]);
const routinePeriodSchema = z.enum(["morning", "evening"]);
const routineStatusSchema = z.enum(["active", "archived"]);
const habitScheduleRuleSchema = z.object({
  daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(),
});
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
const routineItemInputSchema = z.object({
  title: z.string().min(1).max(200),
  sortOrder: z.number().int().min(0),
  isRequired: z.boolean().optional(),
});

const createHabitSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.string().max(120).nullable().optional(),
  scheduleRule: habitScheduleRuleSchema.optional(),
  recurrence: recurrenceInputSchema.optional(),
  goalId: z.string().uuid().nullable().optional(),
  targetPerDay: z.number().int().positive().max(20).optional(),
});

const updateHabitSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    category: z.string().max(120).nullable().optional(),
    scheduleRule: habitScheduleRuleSchema.optional(),
    recurrence: recurrenceInputSchema.optional(),
    goalId: z.string().uuid().nullable().optional(),
    targetPerDay: z.number().int().positive().max(20).optional(),
    status: habitStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const habitCheckinSchema = z.object({
  date: isoDateSchema.optional(),
  status: habitCheckinStatusSchema.optional(),
  note: z.string().max(4000).nullable().optional(),
});

const createRoutineSchema = z.object({
  name: z.string().min(1).max(200),
  period: routinePeriodSchema,
  items: z.array(routineItemInputSchema),
});

const updateRoutineSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    status: routineStatusSchema.optional(),
    items: z.array(routineItemInputSchema).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const routineItemCheckinSchema = z.object({
  date: isoDateSchema.optional(),
});

async function getTodayIsoDate(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
) {
  const preferences = await app.prisma.userPreference.findUnique({
    where: {
      userId,
    },
    select: {
      timezone: true,
      weekStartsOn: true,
    },
  });

  return {
    targetIsoDate: getUserLocalDate(new Date(), preferences?.timezone),
    weekStartsOn: preferences?.weekStartsOn ?? 1,
  };
}

function toPrismaHabitStatus(status: NonNullable<UpdateHabitRequest["status"]>): PrismaHabitStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "paused":
      return "PAUSED";
    case "archived":
      return "ARCHIVED";
  }
}

function fromPrismaHabitStatus(status: PrismaHabitStatus): HabitItem["status"] {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "PAUSED":
      return "paused";
    case "ARCHIVED":
      return "archived";
  }
}

function fromPrismaGoalDomain(domain: PrismaGoalDomain) {
  switch (domain) {
    case "HEALTH":
      return "health";
    case "MONEY":
      return "money";
    case "WORK_GROWTH":
      return "work_growth";
    case "HOME_ADMIN":
      return "home_admin";
    case "DISCIPLINE":
      return "discipline";
    case "OTHER":
      return "other";
  }
}

function fromPrismaGoalStatus(status: PrismaGoalStatus) {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "PAUSED":
      return "paused";
    case "COMPLETED":
      return "completed";
    case "ARCHIVED":
      return "archived";
  }
}

function serializeGoalSummary(goal: {
  id: string;
  title: string;
  domain: PrismaGoalDomain;
  status: PrismaGoalStatus;
}): HabitItem["goal"] {
  return {
    id: goal.id,
    title: goal.title,
    domain: fromPrismaGoalDomain(goal.domain),
    status: fromPrismaGoalStatus(goal.status),
  };
}

function toPrismaCheckinStatus(status: NonNullable<HabitCheckinRequest["status"]>): PrismaCheckinStatus {
  switch (status) {
    case "completed":
      return "COMPLETED";
    case "skipped":
      return "SKIPPED";
  }
}

function toPrismaRoutinePeriod(period: CreateRoutineRequest["period"]): PrismaRoutinePeriod {
  switch (period) {
    case "morning":
      return "MORNING";
    case "evening":
      return "EVENING";
  }
}

function fromPrismaRoutinePeriod(period: PrismaRoutinePeriod): RoutineRecord["period"] {
  switch (period) {
    case "MORNING":
      return "morning";
    case "EVENING":
      return "evening";
  }
}

function toPrismaRoutineStatus(status: NonNullable<UpdateRoutineRequest["status"]>): PrismaRoutineStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "archived":
      return "ARCHIVED";
  }
}

function fromPrismaRoutineStatus(status: PrismaRoutineStatus): RoutineStatus {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "ARCHIVED":
      return "archived";
  }
}

function serializeRoutine(
  routine: Routine & {
    items: (RoutineItem & { checkins: RoutineItemCheckin[] })[];
  },
): RoutineRecord {
  const items = routine.items
    .map((item) => ({
      id: item.id,
      title: item.title,
      sortOrder: item.sortOrder,
      isRequired: item.isRequired,
      completedToday: item.checkins.length > 0,
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder);

  return {
    id: routine.id,
    name: routine.name,
    period: fromPrismaRoutinePeriod(routine.period),
    status: fromPrismaRoutineStatus(routine.status),
    completedItems: items.filter((item) => item.completedToday).length,
    totalItems: items.length,
    items,
  };
}

async function serializeHabit(
  habit: Habit & {
    goal?: {
      id: string;
      title: string;
      domain: PrismaGoalDomain;
      status: PrismaGoalStatus;
    } | null;
    recurrenceRule?: {
      id?: string;
      ruleJson: unknown;
      exceptions?: Array<{ occurrenceDate: Date; action: unknown; targetDate: Date | null }>;
      carryPolicy?: unknown;
      legacyRuleText?: string | null;
    } | null;
  },
  checkins: HabitCheckin[],
  targetIsoDate: IsoDateString,
): Promise<HabitItem> {
  const recurrence = resolveHabitRecurrence(habit, targetIsoDate);
  const scheduleRule = deriveHabitScheduleFromRecurrence(recurrence.rule);
  const dueToday = isHabitDueOnIsoDate(recurrence, targetIsoDate);
  const completedToday = checkins.some(
    (checkin) =>
      toIsoDateString(checkin.occurredOn) === targetIsoDate && checkin.status === "COMPLETED",
  );

  return {
    id: habit.id,
    title: habit.title,
    category: habit.category,
    scheduleRule,
    recurrence: serializeRecurrenceDefinition(habit.recurrenceRule),
    goalId: habit.goalId ?? null,
    goal: habit.goal ? serializeGoalSummary(habit.goal) : null,
    targetPerDay: habit.targetPerDay,
    status: fromPrismaHabitStatus(habit.status),
    dueToday,
    completedToday,
    streakCount: calculateHabitActiveStreak(checkins, recurrence, targetIsoDate),
    risk: calculateHabitRisk(checkins, recurrence, targetIsoDate),
  };
}

async function findOwnedHabit(app: Parameters<FastifyPluginAsync>[0], userId: string, habitId: string) {
  const habit = await app.prisma.habit.findFirst({
    where: {
      id: habitId,
      userId,
    },
  });

  if (!habit) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Habit not found",
    });
  }

  return habit;
}

async function assertOwnedGoalReference(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  goalId: string | null | undefined,
) {
  if (!goalId) {
    return;
  }

  const goal = await app.prisma.goal.findFirst({
    where: {
      id: goalId,
      userId,
    },
  });

  if (!goal) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Goal not found",
    });
  }
}

async function findOwnedRoutine(app: Parameters<FastifyPluginAsync>[0], userId: string, routineId: string) {
  const routine = await app.prisma.routine.findFirst({
    where: {
      id: routineId,
      userId,
    },
  });

  if (!routine) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Routine not found",
    });
  }

  return routine;
}

async function findOwnedRoutineItem(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  routineItemId: string,
) {
  const item = await app.prisma.routineItem.findFirst({
    where: {
      id: routineItemId,
      routine: {
        userId,
      },
    },
    include: {
      routine: true,
    },
  });

  if (!item) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Routine item not found",
    });
  }

  return item;
}

async function loadRoutineById(
  app: Parameters<FastifyPluginAsync>[0],
  routineId: string,
  onDate: Date,
) {
  return app.prisma.routine.findUniqueOrThrow({
    where: {
      id: routineId,
    },
    include: {
      items: {
        include: {
          checkins: {
            where: {
              occurredOn: onDate,
            },
          },
        },
      },
    },
  });
}

function resolveHabitRecurrenceInput(
  payload: { recurrence?: RecurrenceInput; scheduleRule?: HabitScheduleRule },
  fallbackIsoDate: IsoDateString,
) {
  if (payload.recurrence) {
    return payload.recurrence;
  }

  return {
    rule: buildLegacyHabitRecurrence(payload.scheduleRule ?? {}, fallbackIsoDate),
    exceptions: [],
  } satisfies RecurrenceInput;
}

export const registerHabitsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/habits", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { targetIsoDate, weekStartsOn } = await getTodayIsoDate(app, user.id);
    const targetDate = parseIsoDate(targetIsoDate);
    const habits = await app.prisma.habit.findMany({
      where: {
        userId: user.id,
      },
      include: {
        goal: true,
        recurrenceRule: {
          include: {
            exceptions: {
              orderBy: {
                occurrenceDate: "asc",
              },
            },
          },
        },
        checkins: {
          where: {
            occurredOn: {
              gte: parseIsoDate(addIsoDays(targetIsoDate, -30)),
              lte: targetDate,
            },
          },
        },
      },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    });
    const routines = await app.prisma.routine.findMany({
      where: {
        userId: user.id,
      },
      include: {
        items: {
          include: {
            checkins: {
              where: {
                occurredOn: targetDate,
              },
            },
          },
        },
      },
      orderBy: [{ period: "asc" }, { createdAt: "asc" }],
    });
    const habitItems = await Promise.all(
      habits.map((habit) => serializeHabit(habit, habit.checkins, targetIsoDate)),
    );
    const weekStartDate = parseIsoDate(getWeekStartIsoDate(targetIsoDate, weekStartsOn));
    const weekCycle = await ensureCycle(app.prisma, {
      userId: user.id,
      cycleType: "WEEK",
      cycleStartDate: weekStartDate,
      cycleEndDate: getWeekEndDate(weekStartDate),
    });
    const focusHabit = weekCycle.weeklyReview?.focusHabitId
      ? habits.find((habit) => habit.id === weekCycle.weeklyReview?.focusHabitId)
      : null;
    const weeklyChallenge = focusHabit
      ? calculateWeeklyHabitChallenge({
          habit: {
            id: focusHabit.id,
            title: focusHabit.title,
          },
          checkins: focusHabit.checkins,
          scheduleInput: resolveHabitRecurrence(focusHabit, targetIsoDate),
          weekStartIsoDate: getWeekStartIsoDate(targetIsoDate, weekStartsOn),
          targetIsoDate,
        })
      : null;

    const response: HabitsResponse = withGeneratedAt({
      date: targetIsoDate,
      habits: habitItems,
      dueHabits: habitItems.filter((habit) => habit.dueToday),
      routines: routines.map(serializeRoutine),
      weeklyChallenge,
    });

    return reply.send(response);
  });

  app.post("/habits", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createHabitSchema, request.body as CreateHabitRequest);
    const { targetIsoDate } = await getTodayIsoDate(app, user.id);
    await assertOwnedGoalReference(app, user.id, payload.goalId);
    const habit = await app.prisma.$transaction(async (tx) => {
      const recurrence = resolveHabitRecurrenceInput(payload, targetIsoDate);
      const createdHabit = await tx.habit.create({
        data: {
          userId: user.id,
          title: payload.title,
          category: payload.category ?? null,
          scheduleRuleJson: recurrence.rule as unknown as Prisma.InputJsonValue,
          goalId: payload.goalId ?? null,
          targetPerDay: payload.targetPerDay ?? 1,
        },
      });

      const recurrenceRecord = await upsertRecurrenceRuleRecord(tx, {
        ownerType: "HABIT",
        ownerId: createdHabit.id,
        recurrence,
      });

      await tx.habit.update({
        where: {
          id: createdHabit.id,
        },
        data: {
          recurrenceRuleId: recurrenceRecord.id,
        },
      });

      return tx.habit.findUniqueOrThrow({
        where: {
          id: createdHabit.id,
        },
        include: {
          goal: true,
          recurrenceRule: {
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

    const response: HabitMutationResponse = withGeneratedAt({
      habit: await serializeHabit(habit, [], targetIsoDate),
    });

    return reply.status(201).send(response);
  });

  app.patch("/habits/:habitId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(updateHabitSchema, request.body as UpdateHabitRequest);
    const { habitId } = request.params as { habitId: string };
    await findOwnedHabit(app, user.id, habitId);
    await assertOwnedGoalReference(app, user.id, payload.goalId);
    const { targetIsoDate } = await getTodayIsoDate(app, user.id);
    const todayDate = parseIsoDate(targetIsoDate);
    const habit = await app.prisma.$transaction(async (tx) => {
      const recurrence = payload.recurrence || payload.scheduleRule
        ? resolveHabitRecurrenceInput(payload, targetIsoDate)
        : null;

      await tx.habit.update({
        where: {
          id: habitId,
        },
        data: {
          title: payload.title,
          category: payload.category,
          scheduleRuleJson:
            (recurrence?.rule ?? payload.scheduleRule) as unknown as Prisma.InputJsonValue | undefined,
          goalId: payload.goalId,
          targetPerDay: payload.targetPerDay,
          status: payload.status ? toPrismaHabitStatus(payload.status) : undefined,
          archivedAt: payload.status === "archived" ? new Date() : undefined,
        },
      });

      if (recurrence) {
        const recurrenceRecord = await upsertRecurrenceRuleRecord(tx, {
          ownerType: "HABIT",
          ownerId: habitId,
          recurrence,
        });

        await tx.habit.update({
          where: {
            id: habitId,
          },
          data: {
            recurrenceRuleId: recurrenceRecord.id,
          },
        });
      }

      return tx.habit.findUniqueOrThrow({
        where: {
          id: habitId,
        },
        include: {
          goal: true,
          recurrenceRule: {
            include: {
              exceptions: {
                orderBy: {
                  occurrenceDate: "asc",
                },
              },
            },
          },
          checkins: {
            where: {
              occurredOn: {
                gte: parseIsoDate(addIsoDays(targetIsoDate, -30)),
                lte: todayDate,
              },
            },
          },
        },
      });
    });

    const response: HabitMutationResponse = withGeneratedAt({
      habit: await serializeHabit(habit, habit.checkins, targetIsoDate),
    });

    return reply.send(response);
  });

  app.post("/habits/:habitId/checkins", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(habitCheckinSchema, request.body as HabitCheckinRequest);
    const { habitId } = request.params as { habitId: string };
    const targetIsoDate = payload.date ?? (await getTodayIsoDate(app, user.id)).targetIsoDate;
    const targetDate = parseIsoDate(targetIsoDate);
    await findOwnedHabit(app, user.id, habitId);
    await app.prisma.habitCheckin.upsert({
      where: {
        habitId_occurredOn: {
          habitId,
          occurredOn: targetDate,
        },
      },
      update: {
        status: toPrismaCheckinStatus(payload.status ?? "completed"),
        source: "TAP",
        completedAt: payload.status === "skipped" ? null : new Date(),
        note: payload.note ?? null,
      },
      create: {
        habitId,
        occurredOn: targetDate,
        status: toPrismaCheckinStatus(payload.status ?? "completed"),
        source: "TAP",
        completedAt: payload.status === "skipped" ? null : new Date(),
        note: payload.note ?? null,
      },
    });
    const habit = await app.prisma.habit.findUniqueOrThrow({
      where: {
        id: habitId,
      },
      include: {
        recurrenceRule: {
          include: {
            exceptions: {
              orderBy: {
                occurrenceDate: "asc",
              },
            },
          },
        },
        checkins: {
          where: {
            occurredOn: {
              gte: parseIsoDate(addIsoDays(targetIsoDate, -30)),
              lte: targetDate,
            },
          },
        },
      },
    });

    const response: HabitMutationResponse = withGeneratedAt({
      habit: await serializeHabit(habit, habit.checkins, targetIsoDate),
    });

    return reply.send(response);
  });

  app.get("/routines", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { targetIsoDate } = await getTodayIsoDate(app, user.id);
    const targetDate = parseIsoDate(targetIsoDate);
    const routines = await app.prisma.routine.findMany({
      where: {
        userId: user.id,
      },
      include: {
        items: {
          include: {
            checkins: {
              where: {
                occurredOn: targetDate,
              },
            },
          },
        },
      },
      orderBy: [{ period: "asc" }, { createdAt: "asc" }],
    });

    const response: RoutinesResponse = withGeneratedAt({
      date: targetIsoDate,
      routines: routines.map(serializeRoutine),
    });

    return reply.send(response);
  });

  app.post("/routines", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createRoutineSchema, request.body as CreateRoutineRequest);
    const routine = await app.prisma.routine.create({
      data: {
        userId: user.id,
        name: payload.name,
        period: toPrismaRoutinePeriod(payload.period),
        items: {
          create: payload.items.map((item) => ({
            title: item.title,
            sortOrder: item.sortOrder,
            isRequired: item.isRequired ?? true,
          })),
        },
      },
    });
    const { targetIsoDate } = await getTodayIsoDate(app, user.id);
    const response: RoutineMutationResponse = withGeneratedAt({
      routine: serializeRoutine(await loadRoutineById(app, routine.id, parseIsoDate(targetIsoDate))),
    });

    return reply.status(201).send(response);
  });

  app.patch("/routines/:routineId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(updateRoutineSchema, request.body as UpdateRoutineRequest);
    const { routineId } = request.params as { routineId: string };
    await findOwnedRoutine(app, user.id, routineId);

    await app.prisma.$transaction(async (tx) => {
      await tx.routine.update({
        where: {
          id: routineId,
        },
        data: {
          name: payload.name,
          status: payload.status ? toPrismaRoutineStatus(payload.status) : undefined,
        },
      });

      if (payload.items) {
        await tx.routineItem.deleteMany({
          where: {
            routineId,
          },
        });

        if (payload.items.length > 0) {
          await tx.routineItem.createMany({
            data: payload.items.map((item) => ({
              routineId,
              title: item.title,
              sortOrder: item.sortOrder,
              isRequired: item.isRequired ?? true,
            })),
          });
        }
      }
    });

    const { targetIsoDate } = await getTodayIsoDate(app, user.id);
    const response: RoutineMutationResponse = withGeneratedAt({
      routine: serializeRoutine(await loadRoutineById(app, routineId, parseIsoDate(targetIsoDate))),
    });

    return reply.send(response);
  });

  app.post("/routine-items/:itemId/checkins", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(routineItemCheckinSchema, request.body as RoutineItemCheckinRequest);
    const { itemId } = request.params as { itemId: string };
    const item = await findOwnedRoutineItem(app, user.id, itemId);
    const targetDate = parseIsoDate(payload.date ?? (await getTodayIsoDate(app, user.id)).targetIsoDate);
    await app.prisma.routineItemCheckin.upsert({
      where: {
        routineItemId_occurredOn: {
          routineItemId: item.id,
          occurredOn: targetDate,
        },
      },
      update: {
        completedAt: new Date(),
      },
      create: {
        routineItemId: item.id,
        occurredOn: targetDate,
        completedAt: new Date(),
      },
    });

    const response: RoutineMutationResponse = withGeneratedAt({
      routine: serializeRoutine(await loadRoutineById(app, item.routineId, targetDate)),
    });

    return reply.send(response);
  });
};
