import type { FastifyPluginAsync } from "fastify";
import type {
  CreateDayPlannerBlockRequest,
  DayLaunchMutationResponse,
  DayPlanResponse,
  DayPlannerBlockMutationResponse,
  DayPlannerBlocksMutationResponse,
  IsoDateString,
  MonthFocusMutationResponse,
  MonthPlanResponse,
  PlanningPriorityMutationResponse,
  PriorityMutationResponse,
  ReorderDayPlannerBlocksRequest,
  ReplaceDayPlannerBlockTasksRequest,
  UpsertDayLaunchRequest,
  UpdateDayPlannerBlockRequest,
  UpdateDayPrioritiesRequest,
  UpdateMonthFocusRequest,
  UpdatePriorityRequest,
  UpdateWeekCapacityRequest,
  UpdateWeekPrioritiesRequest,
  WeekCapacityMutationResponse,
  WeekPlanResponse,
} from "@life-os/contracts";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { AppError } from "../../lib/errors/app-error.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { materializeRecurringTasksInRange } from "../../lib/recurrence/tasks.js";
import { getMonthEndDate, getWeekEndDate, parseIsoDate } from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import { buildRescueSuggestion } from "./day-mode.js";
import { detectMissedDayPattern } from "./day-mode.js";
import { buildGoalNudges } from "./goal-nudges.js";
import { buildGoalOverviews, buildTodayLinkedGoalCounts } from "./goal-overviews.js";
import {
  getUserTimezone,
  resolveGoalContext,
  validatePlannerBlockWindow,
} from "./planning-context.js";
import {
  normalizePlannerBlockTitle,
  serializeDailyLaunch,
  serializeDayPlannerBlock,
  serializePriority,
  serializeTask,
  toPrismaDayMode,
  toPrismaRescueReason,
  toPrismaTaskStuckReason,
} from "./planning-mappers.js";
import { goalSummaryInclude, goalWithMilestonesInclude, planningTaskInclude } from "./planning-record-shapes.js";
import {
  assertNoPlannerBlockOverlap,
  ensurePlanningCycle,
  findOwnedDayPlannerBlock,
  findOwnedPriority,
  loadPlannerBlockWithTasks,
  loadPlannerBlocks,
  normalizePlannerBlockSortOrders,
  normalizePlannerBlockTaskSortOrders,
  replaceCyclePriorities,
  replacePlannerBlockTasks,
  seedPlannerBlocksFromMostRecentDay,
} from "./planning-repository.js";
import {
  createDayPlannerBlockSchema,
  isoDateSchema,
  upsertDayLaunchSchema,
  reorderDayPlannerBlocksSchema,
  replaceDayPlannerBlockTasksSchema,
  updateDayPlannerBlockSchema,
  updateDayPrioritiesSchema,
  updateMonthFocusSchema,
  updatePrioritySchema,
  updateWeekCapacitySchema,
  updateWeekPrioritiesSchema,
} from "./planning-schemas.js";
import {
  buildWeeklyCapacityModel,
  getDefaultDeepWorkBlockTarget,
  toPrismaWeeklyCapacityMode,
} from "./weekly-capacity.js";

const toPrismaPriorityStatus = (status: UpdatePriorityRequest["status"]) =>
  status === undefined
    ? undefined
    : status === "completed"
      ? "COMPLETED"
      : status === "dropped"
        ? "DROPPED"
        : "PENDING";

const toPriorityCompletedAt = (status: UpdatePriorityRequest["status"]) =>
  status === "completed" ? new Date() : status === "pending" || status === "dropped" ? null : undefined;

async function findOwnedScheduledTaskForDay(
  app: Parameters<FastifyPluginAsync>[0],
  input: {
    userId: string;
    taskId: string;
    date: IsoDateString;
  },
) {
  const task = await app.prisma.task.findFirst({
    where: {
      id: input.taskId,
      userId: input.userId,
      scheduledForDate: parseIsoDate(input.date),
    },
    include: planningTaskInclude,
  });

  if (!task) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Must-win task must belong to the user and be scheduled for the selected day",
    });
  }

  return task;
}

export const registerPlanningPlanRoutes: FastifyPluginAsync = async (app) => {
  app.get("/planning/days/:date", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { date } = request.params as { date: IsoDateString };
    const parsedDate = parseOrThrow(isoDateSchema, date);
    const cycleStartDate = parseIsoDate(parsedDate);
    const goalContext = await resolveGoalContext(app, user.id, parsedDate);
    const timezone = await getUserTimezone(app, user.id);
    await materializeRecurringTasksInRange(app.prisma, user.id, cycleStartDate, cycleStartDate);
    const cycle = await ensurePlanningCycle(app, {
      userId: user.id,
      cycleType: "DAY",
      cycleStartDate,
      cycleEndDate: cycleStartDate,
    });
    await seedPlannerBlocksFromMostRecentDay(app.prisma, {
      userId: user.id,
      date: parsedDate,
      planningCycleId: cycle.id,
      timezone,
    });
    const [tasks, activeGoals, plannerBlocks, launch] = await Promise.all([
      app.prisma.task.findMany({
        where: {
          userId: user.id,
          scheduledForDate: cycleStartDate,
        },
        orderBy: [{ status: "asc" }, { todaySortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        include: planningTaskInclude,
      }),
      app.prisma.goal.findMany({
        where: {
          userId: user.id,
          status: "ACTIVE",
        },
        orderBy: {
          createdAt: "desc",
        },
        include: goalWithMilestonesInclude,
      }),
      loadPlannerBlocks(app.prisma, cycle.id),
      app.prisma.dailyLaunch?.findUnique?.({
        where: {
          planningCycleId: cycle.id,
        },
      }) ?? Promise.resolve(null),
    ]);
    const goalOverviews = await buildGoalOverviews(app, user.id, activeGoals, goalContext);
    const todayLinkedGoalCounts = buildTodayLinkedGoalCounts(cycle.priorities, tasks);
    const goalNudges = buildGoalNudges(
      goalOverviews.map((goal) => {
        const todayCounts = todayLinkedGoalCounts.get(goal.id) ?? {
          todayPriorityCount: 0,
          todayTaskCount: 0,
        };

        return {
          goal: {
            id: goal.id,
            title: goal.title,
            domainId: goal.domainId,
            domain: goal.domain,
            domainSystemKey: goal.domainSystemKey,
            status: goal.status,
            engagementState: goal.engagementState,
          },
          health: goal.health,
          progressPercent: goal.progressPercent,
          nextBestAction: goal.nextBestAction,
          targetDate: goal.targetDate ? parseIsoDate(goal.targetDate) : null,
          lastActivityAt: goal.lastActivityAt,
          todayPriorityCount: todayCounts.todayPriorityCount,
          todayTaskCount: todayCounts.todayTaskCount,
        };
      }),
    );

    const hasMissedDayPattern = await detectMissedDayPattern(app.prisma, {
      userId: user.id,
      targetDate: cycleStartDate,
      overdueTaskCount: 0,
    });

    const response: DayPlanResponse = withGeneratedAt({
      date: parsedDate,
      launch: launch ? serializeDailyLaunch(launch) : null,
      mustWinTask:
        launch?.mustWinTaskId
          ? serializeTask(
              tasks.find((task) => task.id === launch.mustWinTaskId) ??
                (await findOwnedScheduledTaskForDay(app, {
                  userId: user.id,
                  taskId: launch.mustWinTaskId,
                  date: parsedDate,
                })),
            )
          : null,
      rescueSuggestion: buildRescueSuggestion({
        launch,
        mustWinTask:
          launch?.mustWinTaskId
            ? tasks.find((task) => task.id === launch.mustWinTaskId) ?? null
            : null,
        pendingTaskCount: tasks.filter((task) => task.status === "PENDING").length,
        overdueTaskCount: 0,
        hasMissedDayPattern,
      }),
      priorities: cycle.priorities.map(serializePriority),
      tasks: tasks.map(serializeTask),
      goalNudges,
      plannerBlocks,
    });

    return reply.send(response);
  });

  app.put("/planning/days/:date/launch", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { date } = request.params as { date: IsoDateString };
    const parsedDate = parseOrThrow(isoDateSchema, date);
    const payload = parseOrThrow(upsertDayLaunchSchema, request.body as UpsertDayLaunchRequest);
    const cycleStartDate = parseIsoDate(parsedDate);
    const cycle = await ensurePlanningCycle(app, {
      userId: user.id,
      cycleType: "DAY",
      cycleStartDate,
      cycleEndDate: cycleStartDate,
    });

    let mustWinTask = payload.mustWinTaskId
      ? await findOwnedScheduledTaskForDay(app, {
          userId: user.id,
          taskId: payload.mustWinTaskId,
          date: parsedDate,
        })
      : null;

    const launch = await app.prisma.$transaction(async (tx) => {
      const existing = await tx.dailyLaunch.findUnique({
        where: {
          planningCycleId: cycle.id,
        },
      });

      const nextMustWinTaskId =
        payload.mustWinTaskId === undefined ? existing?.mustWinTaskId ?? null : payload.mustWinTaskId ?? null;
      const nextDayMode = payload.dayMode === undefined ? existing?.dayMode ?? "NORMAL" : toPrismaDayMode(payload.dayMode);
      const nextRescueReason =
        payload.rescueReason === undefined
          ? existing?.rescueReason ?? null
          : payload.rescueReason === null
            ? null
            : toPrismaRescueReason(payload.rescueReason);
      const nextEnergyRating =
        payload.energyRating === undefined ? existing?.energyRating ?? null : payload.energyRating ?? null;
      const nextReason =
        payload.likelyDerailmentReason === undefined
          ? existing?.likelyDerailmentReason ?? null
          : payload.likelyDerailmentReason === null
            ? null
            : toPrismaTaskStuckReason(payload.likelyDerailmentReason);
      const nextReasonNote =
        payload.likelyDerailmentNote === undefined
          ? existing?.likelyDerailmentNote ?? null
          : payload.likelyDerailmentNote ?? null;

      if (nextMustWinTaskId && !mustWinTask) {
        mustWinTask = await tx.task.findFirst({
          where: {
            id: nextMustWinTaskId,
            userId: user.id,
            scheduledForDate: cycleStartDate,
          },
          include: planningTaskInclude,
        });
      }

      const isComplete = Boolean(nextEnergyRating && nextMustWinTaskId);

      return tx.dailyLaunch.upsert({
        where: {
          planningCycleId: cycle.id,
        },
        update: {
          mustWinTaskId: nextMustWinTaskId,
          dayMode: nextDayMode,
          rescueReason: nextRescueReason,
          energyRating: nextEnergyRating,
          likelyDerailmentReason: nextReason,
          likelyDerailmentNote: nextReasonNote,
          rescueSuggestedAt:
            nextDayMode === "NORMAL" ? existing?.rescueSuggestedAt ?? null : existing?.rescueSuggestedAt ?? new Date(),
          rescueActivatedAt:
            nextDayMode === "RESCUE" || nextDayMode === "RECOVERY"
              ? existing?.rescueActivatedAt ?? new Date()
              : null,
          rescueExitedAt:
            nextDayMode === "NORMAL" && existing?.dayMode && existing.dayMode !== "NORMAL"
              ? new Date()
              : existing?.rescueExitedAt ?? null,
          completedAt: isComplete ? existing?.completedAt ?? new Date() : null,
        },
        create: {
          userId: user.id,
          planningCycleId: cycle.id,
          mustWinTaskId: nextMustWinTaskId,
          dayMode: nextDayMode,
          rescueReason: nextRescueReason,
          energyRating: nextEnergyRating,
          likelyDerailmentReason: nextReason,
          likelyDerailmentNote: nextReasonNote,
          rescueSuggestedAt: nextDayMode === "NORMAL" ? null : new Date(),
          rescueActivatedAt: nextDayMode === "NORMAL" ? null : new Date(),
          rescueExitedAt: null,
          completedAt: isComplete ? new Date() : null,
        },
      });
    });

    const hasMissedDayPattern = await detectMissedDayPattern(app.prisma, {
      userId: user.id,
      targetDate: cycleStartDate,
      overdueTaskCount: 0,
    });

    const response: DayLaunchMutationResponse = withGeneratedAt({
      launch: serializeDailyLaunch(launch),
      mustWinTask: mustWinTask ? serializeTask(mustWinTask) : null,
      rescueSuggestion: buildRescueSuggestion({
        launch,
        mustWinTask,
        pendingTaskCount: mustWinTask ? 1 : 0,
        overdueTaskCount: 0,
        hasMissedDayPattern,
      }),
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

  app.post("/planning/days/:date/planner-blocks", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { date } = request.params as { date: IsoDateString };
    const parsedDate = parseOrThrow(isoDateSchema, date);
    const payload = parseOrThrow(createDayPlannerBlockSchema, request.body as CreateDayPlannerBlockRequest);
    const cycleStartDate = parseIsoDate(parsedDate);
    const timezone = await getUserTimezone(app, user.id);
    const cycle = await ensurePlanningCycle(app, {
      userId: user.id,
      cycleType: "DAY",
      cycleStartDate,
      cycleEndDate: cycleStartDate,
    });
    const { startsAt, endsAt } = validatePlannerBlockWindow(parsedDate, timezone, payload.startsAt, payload.endsAt);
    await assertNoPlannerBlockOverlap(app.prisma, cycle.id, startsAt, endsAt);

    const plannerBlock = await app.prisma.$transaction(async (tx) => {
      const nextSortOrder =
        (await tx.dayPlannerBlock.count({
          where: {
            planningCycleId: cycle.id,
          },
        })) + 1;

      const createdBlock = await tx.dayPlannerBlock.create({
        data: {
          planningCycleId: cycle.id,
          title: normalizePlannerBlockTitle(payload.title),
          startsAt,
          endsAt,
          sortOrder: nextSortOrder,
        },
      });

      await replacePlannerBlockTasks(tx, {
        userId: user.id,
        date: parsedDate,
        blockId: createdBlock.id,
        blockStartsAt: startsAt,
        taskIds: payload.taskIds ?? [],
      });

      return loadPlannerBlockWithTasks(tx, createdBlock.id);
    });

    const response: DayPlannerBlockMutationResponse = withGeneratedAt({
      plannerBlock: serializeDayPlannerBlock(plannerBlock),
    });

    return reply.status(201).send(response);
  });

  app.patch("/planning/days/:date/planner-blocks/:blockId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { date, blockId } = request.params as { date: IsoDateString; blockId: string };
    const parsedDate = parseOrThrow(isoDateSchema, date);
    const payload = parseOrThrow(updateDayPlannerBlockSchema, request.body as UpdateDayPlannerBlockRequest);
    const timezone = await getUserTimezone(app, user.id);
    const block = await findOwnedDayPlannerBlock(app, user.id, parsedDate, blockId);
    const nextTitle = payload.title === undefined ? block.title : normalizePlannerBlockTitle(payload.title);
    const { startsAt, endsAt } = validatePlannerBlockWindow(
      parsedDate,
      timezone,
      payload.startsAt ?? block.startsAt.toISOString(),
      payload.endsAt ?? block.endsAt.toISOString(),
    );
    await assertNoPlannerBlockOverlap(app.prisma, block.planningCycle.id, startsAt, endsAt, {
      ignoreBlockId: block.id,
    });

    const plannerBlock = await app.prisma.$transaction(async (tx) => {
      await tx.dayPlannerBlock.update({
        where: {
          id: block.id,
        },
        data: {
          title: nextTitle,
          startsAt,
          endsAt,
        },
      });

      if (startsAt.getTime() !== block.startsAt.getTime()) {
        const taskIds = block.taskLinks.map((link) => link.taskId);
        if (taskIds.length > 0) {
          await tx.task.updateMany({
            where: {
              id: {
                in: taskIds,
              },
            },
            data: {
              dueAt: startsAt,
            },
          });
        }
      }

      return loadPlannerBlockWithTasks(tx, block.id);
    });

    const response: DayPlannerBlockMutationResponse = withGeneratedAt({
      plannerBlock: serializeDayPlannerBlock(plannerBlock),
    });

    return reply.send(response);
  });

  app.delete("/planning/days/:date/planner-blocks/:blockId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { date, blockId } = request.params as { date: IsoDateString; blockId: string };
    const parsedDate = parseOrThrow(isoDateSchema, date);
    const block = await findOwnedDayPlannerBlock(app, user.id, parsedDate, blockId);

    if (block.taskLinks.length > 0) {
      throw new AppError({
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Planner block must be empty before deletion",
      });
    }

    await app.prisma.$transaction(async (tx) => {
      await tx.dayPlannerBlock.delete({
        where: {
          id: block.id,
        },
      });
      await normalizePlannerBlockSortOrders(tx, block.planningCycle.id);
    });

    return reply.status(204).send();
  });

  app.put("/planning/days/:date/planner-blocks/order", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { date } = request.params as { date: IsoDateString };
    const parsedDate = parseOrThrow(isoDateSchema, date);
    const payload = parseOrThrow(reorderDayPlannerBlocksSchema, request.body as ReorderDayPlannerBlocksRequest);
    const cycleStartDate = parseIsoDate(parsedDate);
    const cycle = await ensurePlanningCycle(app, {
      userId: user.id,
      cycleType: "DAY",
      cycleStartDate,
      cycleEndDate: cycleStartDate,
    });
    const existingBlocks = await app.prisma.dayPlannerBlock.findMany({
      where: {
        planningCycleId: cycle.id,
      },
      orderBy: {
        sortOrder: "asc",
      },
      select: {
        id: true,
      },
    });
    const existingIds = existingBlocks.map((block) => block.id);
    const sameMembership =
      existingIds.length === payload.blockIds.length &&
      existingIds.every((id) => payload.blockIds.includes(id));

    if (!sameMembership) {
      throw new AppError({
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Planner block reorder payload must include every block exactly once",
      });
    }

    await app.prisma.$transaction(async (tx) => {
      for (const [index, blockId] of payload.blockIds.entries()) {
        await tx.dayPlannerBlock.update({
          where: {
            id: blockId,
          },
          data: {
            sortOrder: 100 + index,
          },
        });
      }

      for (const [index, blockId] of payload.blockIds.entries()) {
        await tx.dayPlannerBlock.update({
          where: {
            id: blockId,
          },
          data: {
            sortOrder: index + 1,
          },
        });
      }
    });

    const response: DayPlannerBlocksMutationResponse = withGeneratedAt({
      plannerBlocks: await loadPlannerBlocks(app.prisma, cycle.id),
    });

    return reply.send(response);
  });

  app.put("/planning/days/:date/planner-blocks/:blockId/tasks", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { date, blockId } = request.params as { date: IsoDateString; blockId: string };
    const parsedDate = parseOrThrow(isoDateSchema, date);
    const payload = parseOrThrow(
      replaceDayPlannerBlockTasksSchema,
      request.body as ReplaceDayPlannerBlockTasksRequest,
    );
    const block = await findOwnedDayPlannerBlock(app, user.id, parsedDate, blockId);

    const plannerBlock = await app.prisma.$transaction(async (tx) => {
      await replacePlannerBlockTasks(tx, {
        userId: user.id,
        date: parsedDate,
        blockId: block.id,
        blockStartsAt: block.startsAt,
        taskIds: payload.taskIds,
      });

      return loadPlannerBlockWithTasks(tx, block.id);
    });

    const response: DayPlannerBlockMutationResponse = withGeneratedAt({
      plannerBlock: serializeDayPlannerBlock(plannerBlock),
    });

    return reply.send(response);
  });

  app.delete("/planning/days/:date/planner-blocks/:blockId/tasks/:taskId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { date, blockId, taskId } = request.params as {
      date: IsoDateString;
      blockId: string;
      taskId: string;
    };
    const parsedDate = parseOrThrow(isoDateSchema, date);
    const block = await findOwnedDayPlannerBlock(app, user.id, parsedDate, blockId);
    const taskLink = block.taskLinks.find((link) => link.taskId === taskId);

    if (!taskLink) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Planner task assignment not found",
      });
    }

    const plannerBlock = await app.prisma.$transaction(async (tx) => {
      await tx.dayPlannerBlockTask.delete({
        where: {
          taskId,
        },
      });
      await normalizePlannerBlockTaskSortOrders(tx, block.id);
      await tx.task.update({
        where: {
          id: taskId,
        },
        data: {
          dueAt: null,
        },
      });

      return loadPlannerBlockWithTasks(tx, block.id);
    });

    const response: DayPlannerBlockMutationResponse = withGeneratedAt({
      plannerBlock: serializeDayPlannerBlock(plannerBlock),
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
        status: toPrismaPriorityStatus(payload.status),
        completedAt: toPriorityCompletedAt(payload.status),
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
    const weeklyCapacity = await buildWeeklyCapacityModel(app, cycle);

    const response: WeekPlanResponse = withGeneratedAt({
      startDate: parsedDate,
      endDate: toIsoDateString(cycle.cycleEndDate),
      priorities: cycle.priorities.map(serializePriority),
      capacityProfile: weeklyCapacity.capacityProfile,
      capacityAssessment: weeklyCapacity.capacityAssessment,
      capacityProgress: weeklyCapacity.capacityProgress,
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

  app.put("/planning/weeks/:startDate/capacity", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { startDate } = request.params as { startDate: IsoDateString };
    const parsedDate = parseOrThrow(isoDateSchema, startDate);
    const payload = parseOrThrow(updateWeekCapacitySchema, request.body as UpdateWeekCapacityRequest);
    const cycleStartDate = parseIsoDate(parsedDate);
    const cycle = await ensurePlanningCycle(app, {
      userId: user.id,
      cycleType: "WEEK",
      cycleStartDate,
      cycleEndDate: getWeekEndDate(cycleStartDate),
    });
    const persistedTarget =
      payload.deepWorkBlockTarget == null
        ? getDefaultDeepWorkBlockTarget(payload.capacityMode)
        : payload.deepWorkBlockTarget;
    const updatedCycle = await app.prisma.planningCycle.update({
      where: {
        id: cycle.id,
      },
      data: {
        weeklyCapacityMode: toPrismaWeeklyCapacityMode(payload.capacityMode),
        weeklyDeepWorkBlockTarget: persistedTarget,
      },
      include: {
        priorities: {
          orderBy: {
            slot: "asc",
          },
          include: {
            goal: {
              include: goalSummaryInclude,
            },
          },
        },
      },
    });
    const weeklyCapacity = await buildWeeklyCapacityModel(app, updatedCycle);

    const response: WeekCapacityMutationResponse = withGeneratedAt({
      capacityProfile: weeklyCapacity.capacityProfile,
      capacityAssessment: weeklyCapacity.capacityAssessment,
      capacityProgress: weeklyCapacity.capacityProgress,
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
};
