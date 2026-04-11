import type { FastifyPluginAsync } from "fastify";
import type {
  CreateGoalRequest,
  GoalDetailResponse,
  GoalMilestonesMutationResponse,
  GoalMutationResponse,
  GoalsConfigResponse,
  GoalsQuery,
  GoalsResponse,
  GoalsWorkspaceResponse,
  IsoDateString,
  MonthPlanResponse,
  UpdateGoalDomainsRequest,
  UpdateGoalHorizonsRequest,
  UpdateGoalMilestonesRequest,
  UpdateGoalRequest,
  WeekPlanResponse,
} from "@life-os/contracts";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { AppError } from "../../lib/errors/app-error.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { materializeRecurringTasksInRange } from "../../lib/recurrence/tasks.js";
import {
  addDays,
  getMonthEndDate,
  getMonthStartIsoDate,
  getWeekEndDate,
  getWeekStartIsoDate,
  parseIsoDate,
} from "../../lib/time/cycle.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import { buildGoalOverviews } from "./goal-overviews.js";
import { getCurrentGoalCycleFilters, resolveGoalContext } from "./planning-context.js";
import {
  type GoalLinkedHabitRecord,
  serializeGoal,
  serializeGoalHierarchySummary,
  serializeGoalLinkedHabit,
  serializeGoalLinkedPriority,
  serializeGoalLinkedTask,
  serializeGoalMilestone,
  serializePriority,
  serializeTask,
  toPrismaGoalEngagementState,
  toPrismaGoalStatus,
} from "./planning-mappers.js";
import { goalWithMilestonesInclude, planningTaskInclude } from "./planning-record-shapes.js";
import {
  assertOwnedGoalDomainReference,
  assertOwnedGoalHorizonReference,
  assertValidGoalParentReference,
  ensurePlanningCycle,
  findOwnedGoal,
  loadGoalConfig,
  replaceGoalDomainConfigs,
  replaceGoalHorizonConfigs,
  replaceGoalMilestones,
} from "./planning-repository.js";
import {
  createGoalSchema,
  goalContextQuerySchema,
  goalsQuerySchema,
  updateGoalDomainsSchema,
  updateGoalHorizonsSchema,
  updateGoalMilestonesSchema,
  updateGoalSchema,
} from "./planning-schemas.js";

const goalMutationInclude = {
  domain: true,
  horizon: true,
} as const;

const goalHierarchyInclude = {
  domain: true,
  horizon: true,
} as const;

async function assertGoalEngagementCapacity(
  app: Parameters<FastifyPluginAsync>[0],
  input: {
    userId: string;
    goalId?: string;
    status: "active" | "paused" | "completed" | "archived";
    engagementState: "primary" | "secondary" | "parked" | "maintenance" | null;
  },
) {
  if (input.status !== "active") {
    return;
  }

  if (input.engagementState !== "primary" && input.engagementState !== "secondary") {
    return;
  }

  const activeGoals = await app.prisma.goal.findMany({
    where: {
      userId: input.userId,
      status: "ACTIVE",
      id: input.goalId ? { not: input.goalId } : undefined,
    },
    select: {
      engagementState: true,
    },
  });

  const primaryCount = activeGoals.filter((goal) => goal.engagementState === "PRIMARY").length;
  const secondaryCount = activeGoals.filter((goal) => goal.engagementState === "SECONDARY").length;

  if (input.engagementState === "primary" && primaryCount >= 1) {
    throw new AppError({
      statusCode: 409,
      code: "CONFLICT",
      message: "Only one primary active goal is allowed",
    });
  }

  if (input.engagementState === "secondary" && secondaryCount >= 2) {
    throw new AppError({
      statusCode: 409,
      code: "CONFLICT",
      message: "Only two secondary active goals are allowed",
    });
  }
}

async function loadGoalAncestors(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  parentGoalId: string | null,
) {
  const ancestors = [];
  let cursor = parentGoalId;

  while (cursor) {
    const ancestor = await app.prisma.goal.findFirst({
      where: {
        id: cursor,
        userId,
      },
      include: goalHierarchyInclude,
    });

    if (!ancestor) {
      break;
    }

    ancestors.unshift(serializeGoalHierarchySummary(ancestor));
    cursor = ancestor.parentGoalId;
  }

  return ancestors;
}

export const registerPlanningGoalRoutes: FastifyPluginAsync = async (app) => {
  app.get("/goals", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(goalsQuerySchema, request.query as GoalsQuery);
    const context = await resolveGoalContext(app, user.id, query.date);
    const goals = await app.prisma.goal.findMany({
      where: {
        userId: user.id,
        domainId: query.domainId,
        horizonId: query.horizonId,
        status: query.status ? toPrismaGoalStatus(query.status) : undefined,
      },
      orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      include: goalWithMilestonesInclude,
    });
    const goalOverviews = await buildGoalOverviews(app, user.id, goals, context);

    const response: GoalsResponse = withGeneratedAt({
      contextDate: context.contextIsoDate,
      goals: goalOverviews,
    });

    return reply.send(response);
  });

  app.get("/goals/config", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const response: GoalsConfigResponse = withGeneratedAt(await loadGoalConfig(app, user.id));

    return reply.send(response);
  });

  app.put("/goals/config/domains", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(updateGoalDomainsSchema, request.body as UpdateGoalDomainsRequest);
    const domains = await replaceGoalDomainConfigs(app, user.id, payload.domains);

    const response: GoalsConfigResponse = withGeneratedAt({
      domains,
      horizons: (await loadGoalConfig(app, user.id)).horizons,
    });

    return reply.send(response);
  });

  app.put("/goals/config/horizons", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(updateGoalHorizonsSchema, request.body as UpdateGoalHorizonsRequest);
    const horizons = await replaceGoalHorizonConfigs(app, user.id, payload.horizons);

    const response: GoalsConfigResponse = withGeneratedAt({
      domains: (await loadGoalConfig(app, user.id)).domains,
      horizons,
    });

    return reply.send(response);
  });

  app.get("/goals/workspace", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(goalContextQuerySchema, request.query);
    const context = await resolveGoalContext(app, user.id, query.date);
    const generatedAt = new Date().toISOString();
    const weekStartDate = parseIsoDate(getWeekStartIsoDate(context.contextIsoDate, context.weekStartsOn));
    const monthStartDate = parseIsoDate(getMonthStartIsoDate(context.contextIsoDate));

    await materializeRecurringTasksInRange(app.prisma, user.id, context.contextDate, context.contextDate);

    const [config, goals, dayCycle, weekCycle, monthCycle, todayTasks] = await Promise.all([
      loadGoalConfig(app, user.id),
      app.prisma.goal.findMany({
        where: { userId: user.id },
        orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
        include: goalWithMilestonesInclude,
      }),
      ensurePlanningCycle(app, {
        userId: user.id,
        cycleType: "DAY",
        cycleStartDate: context.contextDate,
        cycleEndDate: context.contextDate,
      }),
      ensurePlanningCycle(app, {
        userId: user.id,
        cycleType: "WEEK",
        cycleStartDate: weekStartDate,
        cycleEndDate: getWeekEndDate(weekStartDate),
      }),
      ensurePlanningCycle(app, {
        userId: user.id,
        cycleType: "MONTH",
        cycleStartDate: monthStartDate,
        cycleEndDate: getMonthEndDate(monthStartDate),
      }),
      app.prisma.task.findMany({
        where: {
          userId: user.id,
          scheduledForDate: context.contextDate,
        },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        include: planningTaskInclude,
      }),
    ]);

    const goalOverviews = await buildGoalOverviews(app, user.id, goals, context);
    const representedGoalIds = [
      ...new Set(
        [...dayCycle.priorities.map((priority) => priority.goalId), ...todayTasks.map((task) => task.goalId)].filter(
          (goalId): goalId is string => Boolean(goalId),
        ),
      ),
    ];

    const weekPlan: WeekPlanResponse = {
      startDate: weekCycle.cycleStartDate.toISOString().slice(0, 10) as IsoDateString,
      endDate: weekCycle.cycleEndDate.toISOString().slice(0, 10) as IsoDateString,
      priorities: weekCycle.priorities.map(serializePriority),
      generatedAt,
    };

    const monthPlan: MonthPlanResponse = {
      startDate: monthCycle.cycleStartDate.toISOString().slice(0, 10) as IsoDateString,
      endDate: monthCycle.cycleEndDate.toISOString().slice(0, 10) as IsoDateString,
      theme: monthCycle.theme,
      topOutcomes: monthCycle.priorities.map(serializePriority),
      generatedAt,
    };

    const response: GoalsWorkspaceResponse = withGeneratedAt({
      contextDate: context.contextIsoDate,
      domains: config.domains,
      horizons: config.horizons,
      goals: goalOverviews,
      weekPlan,
      monthPlan,
      todayAlignment: {
        date: context.contextIsoDate,
        priorities: dayCycle.priorities.map(serializePriority),
        tasks: todayTasks.map(serializeTask),
        representedGoalIds,
      },
    });

    return reply.send(response);
  });

  app.post("/goals", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createGoalSchema, request.body as CreateGoalRequest);
    await assertOwnedGoalDomainReference(app, user.id, payload.domainId);
    await assertOwnedGoalHorizonReference(app, user.id, payload.horizonId);
    await assertValidGoalParentReference(app, user.id, null, payload.parentGoalId);
    await assertGoalEngagementCapacity(app, {
      userId: user.id,
      status: "active",
      engagementState: payload.engagementState ?? null,
    });

    const sortOrder =
      payload.sortOrder ??
      (await app.prisma.goal.count({
        where: {
          userId: user.id,
          parentGoalId: payload.parentGoalId ?? null,
        },
      })) +
        1;

    const goal = await app.prisma.goal.create({
      data: {
        userId: user.id,
        title: payload.title,
        domainId: payload.domainId,
        horizonId: payload.horizonId ?? null,
        parentGoalId: payload.parentGoalId ?? null,
        why: payload.why ?? null,
        targetDate: payload.targetDate ? parseIsoDate(payload.targetDate) : null,
        notes: payload.notes ?? null,
        engagementState: payload.engagementState ? toPrismaGoalEngagementState(payload.engagementState) : null,
        weeklyProofText: payload.weeklyProofText ?? null,
        knownObstacle: payload.knownObstacle ?? null,
        parkingRule: payload.parkingRule ?? null,
        sortOrder,
      },
      include: goalMutationInclude,
    });

    const response: GoalMutationResponse = withGeneratedAt({
      goal: serializeGoal(goal),
    });

    return reply.status(201).send(response);
  });

  app.get("/goals/:goalId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { goalId } = request.params as { goalId: string };
    const query = parseOrThrow(goalContextQuerySchema, request.query);
    const context = await resolveGoalContext(app, user.id, query.date);
    const goal = await app.prisma.goal.findFirst({
      where: {
        id: goalId,
        userId: user.id,
      },
      include: {
        ...goalWithMilestonesInclude,
        parent: {
          include: goalHierarchyInclude,
        },
        children: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: goalHierarchyInclude,
        },
      },
    });

    if (!goal) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Goal not found",
      });
    }

    const [overview] = await buildGoalOverviews(app, user.id, [goal], context);
    const currentCycleFilters = getCurrentGoalCycleFilters(context.contextIsoDate, context.weekStartsOn);
    const habitsCheckinStart = addDays(context.contextDate, -30);
    const [ancestors, linkedPriorities, linkedTasks, linkedHabits] = await Promise.all([
      loadGoalAncestors(app, user.id, goal.parentGoalId),
      app.prisma.cyclePriority.findMany({
        where: {
          goalId,
          planningCycle: {
            userId: user.id,
            OR: [
              {
                cycleType: "DAY",
                cycleStartDate: currentCycleFilters.dayStartDate,
              },
              {
                cycleType: "WEEK",
                cycleStartDate: currentCycleFilters.weekStartDate,
              },
              {
                cycleType: "MONTH",
                cycleStartDate: currentCycleFilters.monthStartDate,
              },
            ],
          },
        },
        include: {
          planningCycle: true,
        },
        orderBy: [{ planningCycle: { cycleStartDate: "asc" } }, { slot: "asc" }],
      }),
      app.prisma.task.findMany({
        where: {
          userId: user.id,
          goalId,
          status: "PENDING",
        },
        orderBy: [{ dueAt: "asc" }, { scheduledForDate: "asc" }, { createdAt: "asc" }],
        take: 5,
      }),
      app.prisma.habit.findMany({
        where: {
          userId: user.id,
          goalId,
          status: "ACTIVE",
        },
        include: {
          pauseWindows: {
            orderBy: {
              startsOn: "asc",
            },
          },
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
                gte: habitsCheckinStart,
                lte: context.contextDate,
              },
            },
            orderBy: {
              occurredOn: "asc",
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
    ]);

    const serializedLinkedPriorities = linkedPriorities.map(serializeGoalLinkedPriority);
    const response: GoalDetailResponse = withGeneratedAt({
      contextDate: context.contextIsoDate,
      goal: {
        ...overview,
        milestones: goal.milestones.map(serializeGoalMilestone),
        parent: goal.parent ? serializeGoalHierarchySummary(goal.parent) : null,
        children: goal.children.map(serializeGoalHierarchySummary),
        ancestors,
        linkedPriorities: serializedLinkedPriorities,
        currentWeekPriorities: serializedLinkedPriorities.filter((priority) => priority.cycleType === "week"),
        currentMonthOutcomes: serializedLinkedPriorities.filter((priority) => priority.cycleType === "month"),
        linkedTasks: linkedTasks.map(serializeGoalLinkedTask),
        linkedHabits: linkedHabits.map((habit) =>
          serializeGoalLinkedHabit(habit as GoalLinkedHabitRecord, context.contextIsoDate),
        ),
      },
    });

    return reply.send(response);
  });

  app.patch("/goals/:goalId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(updateGoalSchema, request.body as UpdateGoalRequest);
    const { goalId } = request.params as { goalId: string };
    const existingGoal = await findOwnedGoal(app, user.id, goalId);
    if (payload.domainId) {
      await assertOwnedGoalDomainReference(app, user.id, payload.domainId);
    }
    await assertOwnedGoalHorizonReference(app, user.id, payload.horizonId);
    await assertValidGoalParentReference(app, user.id, goalId, payload.parentGoalId);
    await assertGoalEngagementCapacity(app, {
      userId: user.id,
      goalId,
      status:
        payload.status ??
        (existingGoal.status === "ACTIVE"
          ? "active"
          : existingGoal.status === "PAUSED"
            ? "paused"
            : existingGoal.status === "COMPLETED"
              ? "completed"
              : "archived"),
      engagementState:
        payload.engagementState === undefined
          ? existingGoal.engagementState === "PRIMARY"
            ? "primary"
            : existingGoal.engagementState === "SECONDARY"
              ? "secondary"
              : existingGoal.engagementState === "PARKED"
                ? "parked"
                : existingGoal.engagementState === "MAINTENANCE"
                  ? "maintenance"
                  : null
          : payload.engagementState,
    });

    const goal = await app.prisma.goal.update({
      where: {
        id: goalId,
      },
      data: {
        title: payload.title,
        domainId: payload.domainId,
        horizonId: payload.horizonId,
        parentGoalId: payload.parentGoalId,
        why: payload.why,
        status: payload.status ? toPrismaGoalStatus(payload.status) : undefined,
        targetDate:
          payload.targetDate === undefined
            ? undefined
            : payload.targetDate === null
              ? null
              : parseIsoDate(payload.targetDate),
        notes: payload.notes,
        engagementState:
          payload.engagementState === undefined
            ? undefined
            : payload.engagementState === null
              ? null
              : toPrismaGoalEngagementState(payload.engagementState),
        weeklyProofText: payload.weeklyProofText,
        knownObstacle: payload.knownObstacle,
        parkingRule: payload.parkingRule,
        sortOrder: payload.sortOrder,
      },
      include: goalMutationInclude,
    });

    const response: GoalMutationResponse = withGeneratedAt({
      goal: serializeGoal(goal),
    });

    return reply.send(response);
  });

  app.put("/goals/:goalId/milestones", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { goalId } = request.params as { goalId: string };
    const payload = parseOrThrow(updateGoalMilestonesSchema, request.body as UpdateGoalMilestonesRequest);
    await findOwnedGoal(app, user.id, goalId);
    const milestones = await replaceGoalMilestones(app, goalId, payload.milestones);

    const response: GoalMilestonesMutationResponse = withGeneratedAt({
      milestones,
    });

    return reply.send(response);
  });
};
