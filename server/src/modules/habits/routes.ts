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
} from "@life-os/contracts";
import type {
  CheckinStatus as PrismaCheckinStatus,
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
import { withGeneratedAt } from "../../lib/http/response.js";
import { parseIsoDate } from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import { parseOrThrow } from "../../lib/validation/parse.js";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/) as unknown as z.ZodType<IsoDateString>;
const habitStatusSchema = z.enum(["active", "paused", "archived"]);
const habitCheckinStatusSchema = z.enum(["completed", "skipped"]);
const routinePeriodSchema = z.enum(["morning", "evening"]);
const routineStatusSchema = z.enum(["active", "archived"]);
const habitScheduleRuleSchema = z.object({
  daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(),
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
  targetPerDay: z.number().int().positive().max(20).optional(),
});

const updateHabitSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    category: z.string().max(120).nullable().optional(),
    scheduleRule: habitScheduleRuleSchema.optional(),
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

function getTodayIsoDate() {
  return toIsoDateString(new Date());
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

function normalizeScheduleRule(scheduleRule: unknown): HabitScheduleRule {
  const parsed = habitScheduleRuleSchema.safeParse(scheduleRule);
  return parsed.success ? parsed.data : {};
}

function isHabitDueOn(scheduleRule: HabitScheduleRule, date: Date) {
  if (!scheduleRule.daysOfWeek || scheduleRule.daysOfWeek.length === 0) {
    return true;
  }

  return scheduleRule.daysOfWeek.includes(date.getUTCDay());
}

async function calculateHabitStreak(habit: Habit, checkins: HabitCheckin[], onDate: Date) {
  const completedDates = new Set(
    checkins
      .filter((checkin) => checkin.status === "COMPLETED")
      .map((checkin) => toIsoDateString(checkin.occurredOn)),
  );
  const scheduleRule = normalizeScheduleRule(habit.scheduleRuleJson);
  let streak = 0;

  for (let offset = 0; offset < 30; offset += 1) {
    const date = new Date(onDate.getTime() - offset * 24 * 60 * 60 * 1000);

    if (!isHabitDueOn(scheduleRule, date)) {
      continue;
    }

    if (!completedDates.has(toIsoDateString(date))) {
      break;
    }

    streak += 1;
  }

  return streak;
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

async function serializeHabit(habit: Habit, checkins: HabitCheckin[], targetDate: Date): Promise<HabitItem> {
  const targetIsoDate = toIsoDateString(targetDate);
  const dueToday = isHabitDueOn(normalizeScheduleRule(habit.scheduleRuleJson), targetDate);
  const completedToday = checkins.some(
    (checkin) =>
      toIsoDateString(checkin.occurredOn) === targetIsoDate && checkin.status === "COMPLETED",
  );

  return {
    id: habit.id,
    title: habit.title,
    category: habit.category,
    scheduleRule: normalizeScheduleRule(habit.scheduleRuleJson),
    targetPerDay: habit.targetPerDay,
    status: fromPrismaHabitStatus(habit.status),
    dueToday,
    completedToday,
    streakCount: await calculateHabitStreak(habit, checkins, targetDate),
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

export const registerHabitsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/habits", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const targetIsoDate = getTodayIsoDate();
    const targetDate = parseIsoDate(targetIsoDate);
    const habits = await app.prisma.habit.findMany({
      where: {
        userId: user.id,
      },
      include: {
        checkins: {
          where: {
            occurredOn: {
              gte: new Date(targetDate.getTime() - 30 * 24 * 60 * 60 * 1000),
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
      habits.map((habit) => serializeHabit(habit, habit.checkins, targetDate)),
    );

    const response: HabitsResponse = withGeneratedAt({
      date: targetIsoDate,
      habits: habitItems,
      dueHabits: habitItems.filter((habit) => habit.dueToday),
      routines: routines.map(serializeRoutine),
    });

    return reply.send(response);
  });

  app.post("/habits", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createHabitSchema, request.body as CreateHabitRequest);
    const habit = await app.prisma.habit.create({
      data: {
        userId: user.id,
        title: payload.title,
        category: payload.category ?? null,
        scheduleRuleJson: payload.scheduleRule ?? {},
        targetPerDay: payload.targetPerDay ?? 1,
      },
    });

    const response: HabitMutationResponse = withGeneratedAt({
      habit: await serializeHabit(habit, [], parseIsoDate(getTodayIsoDate())),
    });

    return reply.status(201).send(response);
  });

  app.patch("/habits/:habitId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(updateHabitSchema, request.body as UpdateHabitRequest);
    const { habitId } = request.params as { habitId: string };
    await findOwnedHabit(app, user.id, habitId);
    const todayDate = parseIsoDate(getTodayIsoDate());
    const habit = await app.prisma.habit.update({
      where: {
        id: habitId,
      },
      data: {
        title: payload.title,
        category: payload.category,
        scheduleRuleJson: payload.scheduleRule,
        targetPerDay: payload.targetPerDay,
        status: payload.status ? toPrismaHabitStatus(payload.status) : undefined,
        archivedAt: payload.status === "archived" ? new Date() : undefined,
      },
      include: {
        checkins: {
          where: {
            occurredOn: {
              gte: new Date(todayDate.getTime() - 30 * 24 * 60 * 60 * 1000),
              lte: todayDate,
            },
          },
        },
      },
    });

    const response: HabitMutationResponse = withGeneratedAt({
      habit: await serializeHabit(habit, habit.checkins, todayDate),
    });

    return reply.send(response);
  });

  app.post("/habits/:habitId/checkins", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(habitCheckinSchema, request.body as HabitCheckinRequest);
    const { habitId } = request.params as { habitId: string };
    const targetDate = parseIsoDate(payload.date ?? getTodayIsoDate());
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
        checkins: {
          where: {
            occurredOn: {
              gte: new Date(targetDate.getTime() - 30 * 24 * 60 * 60 * 1000),
              lte: targetDate,
            },
          },
        },
      },
    });

    const response: HabitMutationResponse = withGeneratedAt({
      habit: await serializeHabit(habit, habit.checkins, targetDate),
    });

    return reply.send(response);
  });

  app.get("/routines", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const targetIsoDate = getTodayIsoDate();
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
    const response: RoutineMutationResponse = withGeneratedAt({
      routine: serializeRoutine(await loadRoutineById(app, routine.id, parseIsoDate(getTodayIsoDate()))),
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

    const response: RoutineMutationResponse = withGeneratedAt({
      routine: serializeRoutine(await loadRoutineById(app, routineId, parseIsoDate(getTodayIsoDate()))),
    });

    return reply.send(response);
  });

  app.post("/routine-items/:itemId/checkins", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(routineItemCheckinSchema, request.body as RoutineItemCheckinRequest);
    const { itemId } = request.params as { itemId: string };
    const item = await findOwnedRoutineItem(app, user.id, itemId);
    const targetDate = parseIsoDate(payload.date ?? getTodayIsoDate());
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
