import type { FastifyPluginAsync } from "fastify";
import type {
  CreateGoalRequest,
  CreateTaskRequest,
  DayPlanResponse,
  GoalDomain,
  GoalItem,
  GoalSummary,
  GoalMutationResponse,
  GoalsQuery,
  GoalStatus,
  GoalsResponse,
  IsoDateString,
  MonthFocusMutationResponse,
  MonthPlanResponse,
  PlanningPriorityInput,
  PlanningPriorityItem,
  PlanningPriorityMutationResponse,
  PriorityMutationResponse,
  PlanningTaskItem,
  TasksResponse,
  TaskMutationResponse,
  UpdateDayPrioritiesRequest,
  UpdateGoalRequest,
  UpdateMonthFocusRequest,
  UpdatePriorityRequest,
  UpdateTaskRequest,
  UpdateWeekPrioritiesRequest,
  WeekPlanResponse,
  CarryForwardTaskRequest,
  RecurrenceInput,
  RecurringTaskCarryPolicy,
} from "@life-os/contracts";
import type {
  Goal,
  GoalDomain as PrismaGoalDomain,
  GoalStatus as PrismaGoalStatus,
  PlanningCycle,
  PlanningCycleType,
  PriorityStatus as PrismaPriorityStatus,
  Task,
  TaskOriginType as PrismaTaskOriginType,
  TaskStatus as PrismaTaskStatus,
} from "@prisma/client";
import { z } from "zod";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { AppError } from "../../lib/errors/app-error.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { applyRecurringTaskCarryForward, materializeNextRecurringTaskOccurrence, materializeRecurringTasksInRange } from "../../lib/recurrence/tasks.js";
import { serializeRecurrenceDefinition, upsertRecurrenceRuleRecord } from "../../lib/recurrence/store.js";
import { addDays, getMonthEndDate, getWeekEndDate, parseIsoDate } from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import { parseOrThrow } from "../../lib/validation/parse.js";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/) as unknown as z.ZodType<IsoDateString>;
const isoDateTimeSchema = z.string().datetime({ offset: true });

const goalDomainSchema = z.enum([
  "health",
  "money",
  "work_growth",
  "home_admin",
  "discipline",
  "other",
]);
const goalStatusSchema = z.enum(["active", "paused", "completed", "archived"]);
const priorityStatusSchema = z.enum(["pending", "completed", "dropped"]);
const taskStatusSchema = z.enum(["pending", "completed", "dropped"]);
const taskOriginSchema = z.enum([
  "manual",
  "quick_capture",
  "carry_forward",
  "review_seed",
  "recurring",
]);
const carryPolicySchema = z.enum(["complete_and_clone", "move_due_date", "cancel"]);
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
const priorityInputSchema = z.object({
  id: z.string().uuid().optional(),
  slot: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  title: z.string().min(1).max(200),
  goalId: z.string().uuid().nullable().optional(),
});

const createGoalSchema = z.object({
  title: z.string().min(1).max(200),
  domain: goalDomainSchema,
  targetDate: isoDateSchema.nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
});

const updateGoalSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    domain: goalDomainSchema.optional(),
    status: goalStatusSchema.optional(),
    targetDate: isoDateSchema.nullable().optional(),
    notes: z.string().max(4000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const updateDayPrioritiesSchema = z.object({
  priorities: z.array(priorityInputSchema).max(3),
});

const updateWeekPrioritiesSchema = z.object({
  priorities: z.array(priorityInputSchema).max(3),
});

const updateMonthFocusSchema = z.object({
  theme: z.string().max(200).nullable(),
  topOutcomes: z.array(priorityInputSchema).max(3),
});

const goalsQuerySchema = z.object({
  domain: goalDomainSchema.optional(),
  status: goalStatusSchema.optional(),
});

const updatePrioritySchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    status: priorityStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  notes: z.string().max(4000).nullable().optional(),
  scheduledForDate: isoDateSchema.nullable().optional(),
  dueAt: isoDateTimeSchema.nullable().optional(),
  goalId: z.string().uuid().nullable().optional(),
  originType: taskOriginSchema.optional(),
  recurrence: recurrenceInputSchema.optional(),
  carryPolicy: carryPolicySchema.optional(),
});

const updateTaskSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    notes: z.string().max(4000).nullable().optional(),
    status: taskStatusSchema.optional(),
    scheduledForDate: isoDateSchema.nullable().optional(),
    dueAt: isoDateTimeSchema.nullable().optional(),
    goalId: z.string().uuid().nullable().optional(),
    recurrence: recurrenceInputSchema.optional(),
    carryPolicy: carryPolicySchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const carryForwardTaskSchema = z.object({
  targetDate: isoDateSchema,
});

const taskListQuerySchema = z
  .object({
    scheduledForDate: isoDateSchema.optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    status: taskStatusSchema.optional(),
    originType: taskOriginSchema.optional(),
    scheduledState: z.enum(["all", "scheduled", "unscheduled"]).optional(),
  })
  .refine(
    (value) =>
      !(value.scheduledForDate && (value.from || value.to)) &&
      !((value.from && !value.to) || (!value.from && value.to)),
    "Use either scheduledForDate or both from and to",
  );

function toPrismaGoalDomain(domain: GoalDomain): PrismaGoalDomain {
  switch (domain) {
    case "health":
      return "HEALTH";
    case "money":
      return "MONEY";
    case "work_growth":
      return "WORK_GROWTH";
    case "home_admin":
      return "HOME_ADMIN";
    case "discipline":
      return "DISCIPLINE";
    case "other":
      return "OTHER";
  }
}

function fromPrismaGoalDomain(domain: PrismaGoalDomain): GoalDomain {
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

function toPrismaGoalStatus(status: GoalStatus): PrismaGoalStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "paused":
      return "PAUSED";
    case "completed":
      return "COMPLETED";
    case "archived":
      return "ARCHIVED";
  }
}

function fromPrismaGoalStatus(status: PrismaGoalStatus): GoalStatus {
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

function fromPrismaPriorityStatus(status: PrismaPriorityStatus): PlanningPriorityItem["status"] {
  switch (status) {
    case "PENDING":
      return "pending";
    case "COMPLETED":
      return "completed";
    case "DROPPED":
      return "dropped";
  }
}

function toPrismaTaskStatus(status: PlanningTaskItem["status"]): PrismaTaskStatus {
  switch (status) {
    case "pending":
      return "PENDING";
    case "completed":
      return "COMPLETED";
    case "dropped":
      return "DROPPED";
  }
}

function fromPrismaTaskStatus(status: PrismaTaskStatus): PlanningTaskItem["status"] {
  switch (status) {
    case "PENDING":
      return "pending";
    case "COMPLETED":
      return "completed";
    case "DROPPED":
      return "dropped";
  }
}

function toPrismaTaskOriginType(originType: PlanningTaskItem["originType"]): PrismaTaskOriginType {
  switch (originType) {
    case "manual":
      return "MANUAL";
    case "quick_capture":
      return "QUICK_CAPTURE";
    case "carry_forward":
      return "CARRY_FORWARD";
    case "review_seed":
      return "REVIEW_SEED";
    case "recurring":
      return "RECURRING";
  }
}

function fromPrismaTaskOriginType(originType: PrismaTaskOriginType): PlanningTaskItem["originType"] {
  switch (originType) {
    case "MANUAL":
      return "manual";
    case "QUICK_CAPTURE":
      return "quick_capture";
    case "CARRY_FORWARD":
      return "carry_forward";
    case "REVIEW_SEED":
      return "review_seed";
    case "RECURRING":
      return "recurring";
  }
}

function serializeGoal(goal: Goal): GoalItem {
  return {
    id: goal.id,
    title: goal.title,
    domain: fromPrismaGoalDomain(goal.domain),
    status: fromPrismaGoalStatus(goal.status),
    targetDate: goal.targetDate ? toIsoDateString(goal.targetDate) : null,
    notes: goal.notes,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
  };
}

function serializeGoalSummary(goal: {
  id: string;
  title: string;
  domain: PrismaGoalDomain;
  status: PrismaGoalStatus;
}): GoalSummary {
  return {
    id: goal.id,
    title: goal.title,
    domain: fromPrismaGoalDomain(goal.domain),
    status: fromPrismaGoalStatus(goal.status),
  };
}

function serializePriority(priority: {
  id: string;
  slot: number;
  title: string;
  status: PrismaPriorityStatus;
  goalId: string | null;
  goal?: {
    id: string;
    title: string;
    domain: PrismaGoalDomain;
    status: PrismaGoalStatus;
  } | null;
  completedAt: Date | null;
}): PlanningPriorityItem {
  return {
    id: priority.id,
    slot: priority.slot as 1 | 2 | 3,
    title: priority.title,
    status: fromPrismaPriorityStatus(priority.status),
    goalId: priority.goalId,
    goal: priority.goal ? serializeGoalSummary(priority.goal) : null,
    completedAt: priority.completedAt?.toISOString() ?? null,
  };
}

function serializeTask(task: Task & {
  goal?: {
    id: string;
    title: string;
    domain: PrismaGoalDomain;
    status: PrismaGoalStatus;
  } | null;
  recurrenceRule?: Parameters<typeof serializeRecurrenceDefinition>[0];
}): PlanningTaskItem {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    status: fromPrismaTaskStatus(task.status),
    scheduledForDate: task.scheduledForDate ? toIsoDateString(task.scheduledForDate) : null,
    dueAt: task.dueAt?.toISOString() ?? null,
    goalId: task.goalId,
    goal: task.goal ? serializeGoalSummary(task.goal) : null,
    originType: fromPrismaTaskOriginType(task.originType),
    carriedFromTaskId: task.carriedFromTaskId,
    recurrence: serializeRecurrenceDefinition(task.recurrenceRule),
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

async function ensurePlanningCycle(
  app: Parameters<FastifyPluginAsync>[0],
  input: {
    userId: string;
    cycleType: PlanningCycleType;
    cycleStartDate: Date;
    cycleEndDate: Date;
  },
) {
  return app.prisma.planningCycle.upsert({
    where: {
      userId_cycleType_cycleStartDate: {
        userId: input.userId,
        cycleType: input.cycleType,
        cycleStartDate: input.cycleStartDate,
      },
    },
    update: {
      cycleEndDate: input.cycleEndDate,
    },
    create: input,
    include: {
      priorities: {
        orderBy: {
          slot: "asc",
        },
        include: {
          goal: true,
        },
      },
    },
  });
}

async function syncTaskRecurrence(
  tx: any,
  taskId: string,
  recurrence: RecurrenceInput | undefined,
  carryPolicy: RecurringTaskCarryPolicy | null | undefined,
) {
  if (!recurrence) {
    return null;
  }

  const recurrenceRecord = await upsertRecurrenceRuleRecord(tx, {
    ownerType: "TASK",
    ownerId: taskId,
    recurrence,
    carryPolicy,
  });

  await tx.task.update({
    where: {
      id: taskId,
    },
    data: {
      recurrenceRuleId: recurrenceRecord.id,
    },
  });

  return recurrenceRecord;
}

async function replaceCyclePriorities(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  cycle: PlanningCycle,
  priorities: PlanningPriorityInput[],
) {
  const existing = await app.prisma.cyclePriority.findMany({
    where: {
      planningCycleId: cycle.id,
    },
    orderBy: {
      slot: "asc",
    },
  });
  const existingById = new Map(existing.map((priority) => [priority.id, priority]));
  const inputIds = priorities.flatMap((priority) => (priority.id ? [priority.id] : []));
  const uniqueInputIds = new Set(inputIds);
  const uniqueSlots = new Set(priorities.map((priority) => priority.slot));

  if (uniqueInputIds.size !== inputIds.length) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Priority IDs must be unique",
    });
  }

  if (uniqueSlots.size !== priorities.length) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Priority slots must be unique",
    });
  }

  for (const priorityId of inputIds) {
    if (!existingById.has(priorityId)) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Priority not found",
      });
    }
  }

  await Promise.all(priorities.map((priority) => assertOwnedGoalReference(app, userId, priority.goalId)));

  await app.prisma.$transaction(async (tx) => {
    const keptIds = new Set(inputIds);
    const priorityIdsToDelete = existing
      .filter((priority) => !keptIds.has(priority.id))
      .map((priority) => priority.id);

    if (priorityIdsToDelete.length > 0) {
      await tx.cyclePriority.deleteMany({
        where: {
          id: {
            in: priorityIdsToDelete,
          },
        },
      });
    }

    const referencedPriorities = priorities.filter(
      (priority): priority is PlanningPriorityInput & { id: string } => Boolean(priority.id),
    );

    for (const [index, priority] of referencedPriorities.entries()) {
      await tx.cyclePriority.update({
        where: {
          id: priority.id,
        },
        data: {
          slot: 100 + index,
        },
      });
    }

    for (const priority of priorities) {
      if (priority.id) {
        await tx.cyclePriority.update({
          where: {
            id: priority.id,
          },
          data: {
            slot: priority.slot,
            title: priority.title,
            goalId: priority.goalId ?? null,
          },
        });
        continue;
      }

      await tx.cyclePriority.create({
        data: {
          planningCycleId: cycle.id,
          slot: priority.slot,
          title: priority.title,
          goalId: priority.goalId ?? null,
        },
      });
    }
  });

  const refreshed = await app.prisma.cyclePriority.findMany({
    where: {
      planningCycleId: cycle.id,
    },
    orderBy: {
      slot: "asc",
    },
    include: {
      goal: true,
    },
  });

  return refreshed.map(serializePriority);
}

async function findOwnedGoal(app: Parameters<FastifyPluginAsync>[0], userId: string, goalId: string) {
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

  return goal;
}

async function assertOwnedGoalReference(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  goalId: string | null | undefined,
) {
  if (!goalId) {
    return;
  }

  await findOwnedGoal(app, userId, goalId);
}

async function findOwnedTask(app: Parameters<FastifyPluginAsync>[0], userId: string, taskId: string) {
  const task = await app.prisma.task.findFirst({
    where: {
      id: taskId,
      userId,
    },
  });

  if (!task) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Task not found",
    });
  }

  return task;
}

async function findOwnedPriority(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  priorityId: string,
) {
  const priority = await app.prisma.cyclePriority.findFirst({
    where: {
      id: priorityId,
      planningCycle: {
        userId,
      },
    },
  });

  if (!priority) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Priority not found",
    });
  }

  return priority;
}

export const registerPlanningRoutes: FastifyPluginAsync = async (app) => {
  app.get("/goals", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(goalsQuerySchema, request.query as GoalsQuery);
    const goals = await app.prisma.goal.findMany({
      where: {
        userId: user.id,
        domain: query.domain ? toPrismaGoalDomain(query.domain) : undefined,
        status: query.status ? toPrismaGoalStatus(query.status) : undefined,
      },
      orderBy: [
        { status: "asc" },
        { createdAt: "desc" },
      ],
    });

    const response: GoalsResponse = withGeneratedAt({
      goals: goals.map(serializeGoal),
    });

    return reply.send(response);
  });

  app.post("/goals", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createGoalSchema, request.body as CreateGoalRequest);
    const goal = await app.prisma.goal.create({
      data: {
        userId: user.id,
        title: payload.title,
        domain: toPrismaGoalDomain(payload.domain),
        targetDate: payload.targetDate ? parseIsoDate(payload.targetDate) : null,
        notes: payload.notes ?? null,
      },
    });

    const response: GoalMutationResponse = withGeneratedAt({
      goal: serializeGoal(goal),
    });

    return reply.status(201).send(response);
  });

  app.patch("/goals/:goalId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(updateGoalSchema, request.body as UpdateGoalRequest);
    const { goalId } = request.params as { goalId: string };
    await findOwnedGoal(app, user.id, goalId);

    const goal = await app.prisma.goal.update({
      where: {
        id: goalId,
      },
      data: {
        title: payload.title,
        domain: payload.domain ? toPrismaGoalDomain(payload.domain) : undefined,
        status: payload.status ? toPrismaGoalStatus(payload.status) : undefined,
        targetDate:
          payload.targetDate === undefined
            ? undefined
            : payload.targetDate === null
              ? null
              : parseIsoDate(payload.targetDate),
        notes: payload.notes,
      },
    });

    const response: GoalMutationResponse = withGeneratedAt({
      goal: serializeGoal(goal),
    });

    return reply.send(response);
  });

  app.get("/planning/days/:date", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { date } = request.params as { date: IsoDateString };
    const parsedDate = parseOrThrow(isoDateSchema, date);
    const cycleStartDate = parseIsoDate(parsedDate);
    await materializeRecurringTasksInRange(app.prisma, user.id, cycleStartDate, cycleStartDate);
    const cycle = await ensurePlanningCycle(app, {
      userId: user.id,
      cycleType: "DAY",
      cycleStartDate,
      cycleEndDate: cycleStartDate,
    });
    const tasks = await app.prisma.task.findMany({
      where: {
        userId: user.id,
        scheduledForDate: cycleStartDate,
      },
      orderBy: [
        { status: "asc" },
        { createdAt: "asc" },
      ],
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

    const response: DayPlanResponse = withGeneratedAt({
      date: parsedDate,
      priorities: cycle.priorities.map(serializePriority),
      tasks: tasks.map(serializeTask),
    });

    return reply.send(response);
  });

  app.put("/planning/days/:date/priorities", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { date } = request.params as { date: IsoDateString };
    const parsedDate = parseOrThrow(isoDateSchema, date);
    const payload = parseOrThrow(updateDayPrioritiesSchema, request.body as UpdateDayPrioritiesRequest);
    const cycleStartDate = parseIsoDate(parsedDate);
    const cycle = await ensurePlanningCycle(app, {
      userId: user.id,
      cycleType: "DAY",
      cycleStartDate,
      cycleEndDate: cycleStartDate,
    });
    const priorities = await replaceCyclePriorities(app, user.id, cycle, payload.priorities);

    const response: PlanningPriorityMutationResponse = withGeneratedAt({
      priorities,
    });

    return reply.send(response);
  });

  app.patch("/planning/priorities/:priorityId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { priorityId } = request.params as { priorityId: string };
    const payload = parseOrThrow(updatePrioritySchema, request.body as UpdatePriorityRequest);

    await findOwnedPriority(app, user.id, priorityId);

    const priority = await app.prisma.cyclePriority.update({
      where: {
        id: priorityId,
      },
      data: {
        title: payload.title,
        status:
          payload.status === undefined
            ? undefined
            : payload.status === "completed"
              ? "COMPLETED"
              : payload.status === "dropped"
                ? "DROPPED"
                : "PENDING",
        completedAt:
          payload.status === "completed"
            ? new Date()
            : payload.status === "pending" || payload.status === "dropped"
              ? null
              : undefined,
      },
    });

    const response: PriorityMutationResponse = withGeneratedAt({
      priority: serializePriority(priority),
    });

    return reply.send(response);
  });

  app.get("/planning/weeks/:startDate", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { startDate } = request.params as { startDate: IsoDateString };
    const parsedDate = parseOrThrow(isoDateSchema, startDate);
    const cycleStartDate = parseIsoDate(parsedDate);
    const cycle = await ensurePlanningCycle(app, {
      userId: user.id,
      cycleType: "WEEK",
      cycleStartDate,
      cycleEndDate: getWeekEndDate(cycleStartDate),
    });

    const response: WeekPlanResponse = withGeneratedAt({
      startDate: parsedDate,
      endDate: toIsoDateString(cycle.cycleEndDate),
      priorities: cycle.priorities.map(serializePriority),
    });

    return reply.send(response);
  });

  app.put("/planning/weeks/:startDate/priorities", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { startDate } = request.params as { startDate: IsoDateString };
    const parsedDate = parseOrThrow(isoDateSchema, startDate);
    const payload = parseOrThrow(updateWeekPrioritiesSchema, request.body as UpdateWeekPrioritiesRequest);
    const cycleStartDate = parseIsoDate(parsedDate);
    const cycle = await ensurePlanningCycle(app, {
      userId: user.id,
      cycleType: "WEEK",
      cycleStartDate,
      cycleEndDate: getWeekEndDate(cycleStartDate),
    });
    const priorities = await replaceCyclePriorities(app, user.id, cycle, payload.priorities);

    const response: PlanningPriorityMutationResponse = withGeneratedAt({
      priorities,
    });

    return reply.send(response);
  });

  app.get("/planning/months/:startDate", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { startDate } = request.params as { startDate: IsoDateString };
    const parsedDate = parseOrThrow(isoDateSchema, startDate);
    const cycleStartDate = parseIsoDate(parsedDate);
    const cycle = await ensurePlanningCycle(app, {
      userId: user.id,
      cycleType: "MONTH",
      cycleStartDate,
      cycleEndDate: getMonthEndDate(cycleStartDate),
    });

    const response: MonthPlanResponse = withGeneratedAt({
      startDate: parsedDate,
      endDate: toIsoDateString(cycle.cycleEndDate),
      theme: cycle.theme,
      topOutcomes: cycle.priorities.map(serializePriority),
    });

    return reply.send(response);
  });

  app.put("/planning/months/:startDate/focus", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { startDate } = request.params as { startDate: IsoDateString };
    const parsedDate = parseOrThrow(isoDateSchema, startDate);
    const payload = parseOrThrow(updateMonthFocusSchema, request.body as UpdateMonthFocusRequest);
    const cycleStartDate = parseIsoDate(parsedDate);
    const cycle = await ensurePlanningCycle(app, {
      userId: user.id,
      cycleType: "MONTH",
      cycleStartDate,
      cycleEndDate: getMonthEndDate(cycleStartDate),
    });

    await app.prisma.planningCycle.update({
      where: {
        id: cycle.id,
      },
      data: {
        theme: payload.theme,
      },
    });

    const topOutcomes = await replaceCyclePriorities(app, user.id, cycle, payload.topOutcomes);

    const response: MonthFocusMutationResponse = withGeneratedAt({
      theme: payload.theme,
      topOutcomes,
    });

    return reply.send(response);
  });

  app.get("/tasks", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(taskListQuerySchema, request.query);
    const scheduledForDate = query.scheduledForDate ? parseIsoDate(query.scheduledForDate) : null;
    const fromDate = query.from ? parseIsoDate(query.from) : null;
    const toDateExclusive = query.to ? addDays(parseIsoDate(query.to), 1) : null;
    const scheduledDateFilter =
      scheduledForDate
        ? scheduledForDate
        : fromDate && toDateExclusive
          ? {
              gte: fromDate,
              lt: toDateExclusive,
            }
          : query.scheduledState === "scheduled"
            ? { not: null }
            : query.scheduledState === "unscheduled"
              ? null
              : undefined;
    if (scheduledForDate) {
      await materializeRecurringTasksInRange(app.prisma, user.id, scheduledForDate, scheduledForDate);
    } else if (fromDate && toDateExclusive) {
      await materializeRecurringTasksInRange(app.prisma, user.id, fromDate, addDays(toDateExclusive, -1));
    }
    const tasks = await app.prisma.task.findMany({
      where: {
        userId: user.id,
        status: query.status ? toPrismaTaskStatus(query.status) : undefined,
        originType: query.originType ? toPrismaTaskOriginType(query.originType) : undefined,
        scheduledForDate: scheduledDateFilter,
      },
      orderBy: [{ scheduledForDate: "asc" }, { createdAt: "asc" }],
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

    const response: TasksResponse = withGeneratedAt({
      tasks: tasks.map(serializeTask),
    });

    return reply.send(response);
  });

  app.post("/tasks", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createTaskSchema, request.body as CreateTaskRequest);
    await assertOwnedGoalReference(app, user.id, payload.goalId);
    const task = await app.prisma.$transaction(async (tx) => {
      const createdTask = await tx.task.create({
        data: {
          userId: user.id,
          title: payload.title,
          notes: payload.notes ?? null,
          scheduledForDate: payload.scheduledForDate ? parseIsoDate(payload.scheduledForDate) : null,
          dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
          goalId: payload.goalId ?? null,
          originType: toPrismaTaskOriginType(
            payload.recurrence ? "recurring" : (payload.originType ?? "manual"),
          ),
        },
      });

      await syncTaskRecurrence(tx, createdTask.id, payload.recurrence, payload.carryPolicy);

      return tx.task.findUniqueOrThrow({
        where: {
          id: createdTask.id,
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

    const response: TaskMutationResponse = withGeneratedAt({
      task: serializeTask(task),
    });

    return reply.status(201).send(response);
  });

  app.patch("/tasks/:taskId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(updateTaskSchema, request.body as UpdateTaskRequest);
    const { taskId } = request.params as { taskId: string };
    const existingTask = await app.prisma.task.findFirst({
      where: {
        id: taskId,
        userId: user.id,
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
      },
    });
    if (!existingTask) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Task not found",
      });
    }
    await assertOwnedGoalReference(app, user.id, payload.goalId);
    const task = await app.prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: {
          id: taskId,
        },
        data: {
          title: payload.title,
          notes: payload.notes,
          status: payload.status ? toPrismaTaskStatus(payload.status) : undefined,
          scheduledForDate:
            payload.scheduledForDate === undefined
              ? undefined
              : payload.scheduledForDate === null
                ? null
                : parseIsoDate(payload.scheduledForDate),
          dueAt:
            payload.dueAt === undefined ? undefined : payload.dueAt === null ? null : new Date(payload.dueAt),
          goalId: payload.goalId,
          completedAt:
            payload.status === "completed"
              ? new Date()
              : payload.status === "pending" || payload.status === "dropped"
                ? null
                : undefined,
          originType:
            payload.recurrence || existingTask.recurrenceRuleId
              ? toPrismaTaskOriginType("recurring")
              : undefined,
        },
      });

      await syncTaskRecurrence(
        tx,
        taskId,
        payload.recurrence,
        payload.carryPolicy === undefined ? undefined : payload.carryPolicy,
      );

      if (payload.status === "completed" && existingTask.recurrenceRuleId && existingTask.scheduledForDate) {
        await materializeNextRecurringTaskOccurrence(
          tx,
          user.id,
          existingTask.recurrenceRuleId,
          toIsoDateString(existingTask.scheduledForDate),
        );
      }

      return tx.task.findUniqueOrThrow({
        where: {
          id: taskId,
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

    const response: TaskMutationResponse = withGeneratedAt({
      task: serializeTask(task),
    });

    return reply.send(response);
  });

  app.post("/tasks/:taskId/carry-forward", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(carryForwardTaskSchema, request.body as CarryForwardTaskRequest);
    const { taskId } = request.params as { taskId: string };
    const existingTask = await app.prisma.task.findFirst({
      where: {
        id: taskId,
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
      },
    });
    if (!existingTask) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Task not found",
      });
    }

    const task = await app.prisma.$transaction(async (tx) => {
      if (existingTask.recurrenceRuleId) {
        const recurringTask = await applyRecurringTaskCarryForward(
          tx,
          user.id,
          existingTask,
          payload.targetDate,
        );
        if (recurringTask) {
          return recurringTask;
        }
      }

      await tx.task.update({
        where: {
          id: existingTask.id,
        },
        data: {
          status: "DROPPED",
        },
      });

      return tx.task.create({
        data: {
          userId: user.id,
          title: existingTask.title,
          notes: existingTask.notes,
          scheduledForDate: parseIsoDate(payload.targetDate),
          dueAt: existingTask.dueAt,
          goalId: existingTask.goalId,
          originType: "CARRY_FORWARD",
          carriedFromTaskId: existingTask.id,
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

    const response: TaskMutationResponse = withGeneratedAt({
      task: serializeTask(task),
    });

    return reply.status(201).send(response);
  });
};
