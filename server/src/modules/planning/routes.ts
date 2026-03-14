import type { FastifyPluginAsync } from "fastify";
import type {
  CreateGoalRequest,
  CreateTaskRequest,
  DayPlanResponse,
  GoalDomain,
  GoalItem,
  GoalMutationResponse,
  GoalStatus,
  GoalsResponse,
  IsoDateString,
  MonthFocusMutationResponse,
  MonthPlanResponse,
  PlanningPriorityInput,
  PlanningPriorityItem,
  PlanningPriorityMutationResponse,
  PlanningTaskItem,
  TaskMutationResponse,
  UpdateDayPrioritiesRequest,
  UpdateGoalRequest,
  UpdateMonthFocusRequest,
  UpdateTaskRequest,
  UpdateWeekPrioritiesRequest,
  WeekPlanResponse,
  CarryForwardTaskRequest,
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
const taskStatusSchema = z.enum(["pending", "completed", "dropped"]);
const taskOriginSchema = z.enum([
  "manual",
  "quick_capture",
  "carry_forward",
  "review_seed",
  "recurring",
]);
const priorityInputSchema = z.object({
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

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  notes: z.string().max(4000).nullable().optional(),
  scheduledForDate: isoDateSchema.nullable().optional(),
  dueAt: isoDateTimeSchema.nullable().optional(),
  goalId: z.string().uuid().nullable().optional(),
  originType: taskOriginSchema.optional(),
});

const updateTaskSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    notes: z.string().max(4000).nullable().optional(),
    status: taskStatusSchema.optional(),
    scheduledForDate: isoDateSchema.nullable().optional(),
    dueAt: isoDateTimeSchema.nullable().optional(),
    goalId: z.string().uuid().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const carryForwardTaskSchema = z.object({
  targetDate: isoDateSchema,
});

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

function serializePriority(priority: {
  id: string;
  slot: number;
  title: string;
  status: PrismaPriorityStatus;
  goalId: string | null;
  completedAt: Date | null;
}): PlanningPriorityItem {
  return {
    id: priority.id,
    slot: priority.slot as 1 | 2 | 3,
    title: priority.title,
    status: fromPrismaPriorityStatus(priority.status),
    goalId: priority.goalId,
    completedAt: priority.completedAt?.toISOString() ?? null,
  };
}

function serializeTask(task: Task): PlanningTaskItem {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    status: fromPrismaTaskStatus(task.status),
    scheduledForDate: task.scheduledForDate ? toIsoDateString(task.scheduledForDate) : null,
    dueAt: task.dueAt?.toISOString() ?? null,
    goalId: task.goalId,
    originType: fromPrismaTaskOriginType(task.originType),
    carriedFromTaskId: task.carriedFromTaskId,
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
      },
    },
  });
}

async function replaceCyclePriorities(
  app: Parameters<FastifyPluginAsync>[0],
  cycle: PlanningCycle,
  priorities: PlanningPriorityInput[],
) {
  await app.prisma.$transaction(async (tx) => {
    await tx.cyclePriority.deleteMany({
      where: {
        planningCycleId: cycle.id,
      },
    });

    if (priorities.length > 0) {
      await tx.cyclePriority.createMany({
        data: priorities.map((priority) => ({
          planningCycleId: cycle.id,
          slot: priority.slot,
          title: priority.title,
          goalId: priority.goalId ?? null,
        })),
      });
    }
  });

  const refreshed = await app.prisma.planningCycle.findUniqueOrThrow({
    where: {
      id: cycle.id,
    },
    include: {
      priorities: {
        orderBy: {
          slot: "asc",
        },
      },
    },
  });

  return refreshed.priorities.map(serializePriority);
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

export const registerPlanningRoutes: FastifyPluginAsync = async (app) => {
  app.get("/goals", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const goals = await app.prisma.goal.findMany({
      where: {
        userId: user.id,
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
    const priorities = await replaceCyclePriorities(app, cycle, payload.priorities);

    const response: PlanningPriorityMutationResponse = withGeneratedAt({
      priorities,
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
    const priorities = await replaceCyclePriorities(app, cycle, payload.priorities);

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

    const topOutcomes = await replaceCyclePriorities(app, cycle, payload.topOutcomes);

    const response: MonthFocusMutationResponse = withGeneratedAt({
      theme: payload.theme,
      topOutcomes,
    });

    return reply.send(response);
  });

  app.post("/tasks", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createTaskSchema, request.body as CreateTaskRequest);
    const task = await app.prisma.task.create({
      data: {
        userId: user.id,
        title: payload.title,
        notes: payload.notes ?? null,
        scheduledForDate: payload.scheduledForDate ? parseIsoDate(payload.scheduledForDate) : null,
        dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
        goalId: payload.goalId ?? null,
        originType: toPrismaTaskOriginType(payload.originType ?? "manual"),
      },
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
    await findOwnedTask(app, user.id, taskId);
    const task = await app.prisma.task.update({
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
      },
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
    const existingTask = await findOwnedTask(app, user.id, taskId);

    const task = await app.prisma.$transaction(async (tx) => {
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
      });
    });

    const response: TaskMutationResponse = withGeneratedAt({
      task: serializeTask(task),
    });

    return reply.status(201).send(response);
  });
};
