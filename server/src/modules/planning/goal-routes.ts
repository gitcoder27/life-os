import type { FastifyPluginAsync } from "fastify";
import type {
  CreateGoalRequest,
  GoalDetailResponse,
  GoalMilestonesMutationResponse,
  GoalMutationResponse,
  GoalsQuery,
  GoalsResponse,
  IsoDateString,
  UpdateGoalMilestonesRequest,
  UpdateGoalRequest,
} from "@life-os/contracts";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { AppError } from "../../lib/errors/app-error.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { addDays, parseIsoDate } from "../../lib/time/cycle.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import { buildGoalOverviews } from "./goal-overviews.js";
import { getCurrentGoalCycleFilters, resolveGoalContext } from "./planning-context.js";
import {
  type GoalLinkedHabitRecord,
  serializeGoal,
  serializeGoalLinkedHabit,
  serializeGoalLinkedPriority,
  serializeGoalLinkedTask,
  serializeGoalMilestone,
  toPrismaGoalDomain,
  toPrismaGoalStatus,
} from "./planning-mappers.js";
import { goalWithMilestonesInclude } from "./planning-record-shapes.js";
import { findOwnedGoal, replaceGoalMilestones } from "./planning-repository.js";
import {
  createGoalSchema,
  goalContextQuerySchema,
  goalsQuerySchema,
  updateGoalMilestonesSchema,
  updateGoalSchema,
} from "./planning-schemas.js";

export const registerPlanningGoalRoutes: FastifyPluginAsync = async (app) => {
  app.get("/goals", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(goalsQuerySchema, request.query as GoalsQuery);
    const context = await resolveGoalContext(app, user.id, query.date);
    const goals = await app.prisma.goal.findMany({
      where: {
        userId: user.id,
        domain: query.domain ? toPrismaGoalDomain(query.domain) : undefined,
        status: query.status ? toPrismaGoalStatus(query.status) : undefined,
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: goalWithMilestonesInclude,
    });
    const goalOverviews = await buildGoalOverviews(app, user.id, goals, context);

    const response: GoalsResponse = withGeneratedAt({
      contextDate: context.contextIsoDate,
      goals: goalOverviews,
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
      include: goalWithMilestonesInclude,
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
    const [linkedPriorities, linkedTasks, linkedHabits] = await Promise.all([
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

    const response: GoalDetailResponse = withGeneratedAt({
      contextDate: context.contextIsoDate,
      goal: {
        ...overview,
        milestones: goal.milestones.map(serializeGoalMilestone),
        linkedPriorities: linkedPriorities.map(serializeGoalLinkedPriority),
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
