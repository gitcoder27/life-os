import type { PrismaClient } from "@prisma/client";
import type { IsoDateString } from "@life-os/contracts";

import { buildStaleInboxTaskWhere } from "../../lib/inbox/stale.js";
import { materializeRecurringTasksInRange } from "../../lib/recurrence/tasks.js";
import {
  addIsoDays,
  getWeekEndDate,
  getWeekStartIsoDate,
  parseIsoDate,
} from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import { getUserLocalDate } from "../../lib/time/user-time.js";
import { calculateDailyScore, ensureCycle, getWeeklyMomentum } from "../scoring/service.js";
import { assessDayCapacity } from "./day-capacity.js";
import { buildRescueSuggestion, detectMissedDayPattern } from "./day-mode.js";
import {
  fromPrismaTaskProgressState,
  serializeDailyLaunch,
  serializeTask,
} from "./planning-mappers.js";
import { planningTaskInclude } from "./planning-record-shapes.js";
import { loadPlannerBlocks } from "./planning-repository.js";

const toGuidanceTaskStatus = (status: "COMPLETED" | "DROPPED" | "PENDING") => {
  if (status === "COMPLETED") {
    return "completed" as const;
  }

  if (status === "DROPPED") {
    return "dropped" as const;
  }

  return "pending" as const;
};

export async function ensureHomeDayPlanningCycle(
  prisma: PrismaClient,
  input: {
    userId: string;
    date: Date;
  },
) {
  return ensureCycle(prisma, {
    userId: input.userId,
    cycleType: "DAY",
    cycleStartDate: input.date,
    cycleEndDate: input.date,
  });
}

export async function loadHomePlanningSummary(
  prisma: PrismaClient,
  input: {
    userId: string;
    targetDate: Date;
    targetIsoDate: IsoDateString;
    timezone: string | null;
    weekStartsOn: number;
    overdueLookbackDays: number;
    now: Date;
  },
) {
  const weekStartIsoDate = getWeekStartIsoDate(input.targetIsoDate, input.weekStartsOn);
  const weekStartDate = parseIsoDate(weekStartIsoDate);
  const overdueWindowStartIsoDate = addIsoDays(input.targetIsoDate, -input.overdueLookbackDays);
  const overdueWindowStartDate = parseIsoDate(overdueWindowStartIsoDate);
  const currentIsoDate = getUserLocalDate(input.now, input.timezone);
  const isLiveDate = input.targetIsoDate === currentIsoDate;

  await materializeRecurringTasksInRange(
    prisma,
    input.userId,
    overdueWindowStartDate,
    parseIsoDate(addIsoDays(input.targetIsoDate, -1)),
  );

  const [dayCycle, weekCycle, score, momentum, tasks, overdueTasks, staleInboxTasks] =
    await Promise.all([
      ensureHomeDayPlanningCycle(prisma, {
        userId: input.userId,
        date: input.targetDate,
      }),
      ensureCycle(prisma, {
        userId: input.userId,
        cycleType: "WEEK",
        cycleStartDate: weekStartDate,
        cycleEndDate: getWeekEndDate(weekStartDate),
      }),
      calculateDailyScore(prisma, input.userId, input.targetDate),
      getWeeklyMomentum(prisma, input.userId, input.targetDate),
      prisma.task.findMany({
        where: {
          userId: input.userId,
          scheduledForDate: input.targetDate,
        },
        orderBy: [{ createdAt: "asc" }],
        include: planningTaskInclude,
      }),
      prisma.task.findMany({
        where: {
          userId: input.userId,
          status: "PENDING",
          scheduledForDate: {
            gte: overdueWindowStartDate,
            lt: input.targetDate,
          },
        },
        orderBy: [{ scheduledForDate: "asc" }, { createdAt: "asc" }],
      }),
      prisma.task.findMany({
        where: buildStaleInboxTaskWhere({
          userId: input.userId,
          targetDate: input.targetDate,
          timezone: input.timezone,
        }),
        orderBy: [{ createdAt: "asc" }],
      }),
    ]);

  const plannerBlocks = typeof prisma.dayPlannerBlock?.findMany === "function"
    ? await loadPlannerBlocks(prisma, dayCycle.id)
    : [];
  const plannerBlockCount = typeof prisma.dayPlannerBlock?.count === "function"
    ? await prisma.dayPlannerBlock.count({
        where: {
          planningCycleId: dayCycle.id,
        },
      })
    : plannerBlocks.length;
  const dailyLaunch = await prisma.dailyLaunch.findUnique({
    where: {
      planningCycleId: dayCycle.id,
    },
    include: {
      mustWinTask: {
        include: planningTaskInclude,
      },
    },
  });
  const hasMissedDayPattern = await detectMissedDayPattern(prisma, {
    userId: input.userId,
    targetDate: input.targetDate,
    overdueTaskCount: overdueTasks.length,
  });
  const serializedTasks = tasks.map(serializeTask);
  const serializedLaunch = dailyLaunch ? serializeDailyLaunch(dailyLaunch) : null;
  const serializedMustWinTask = dailyLaunch?.mustWinTask ? serializeTask(dailyLaunch.mustWinTask) : null;
  const behaviorCapacity = assessDayCapacity({
    tasks: serializedTasks,
    plannerBlocks,
    launch: serializedLaunch,
    mustWinTask: serializedMustWinTask,
    now: input.now,
    isLiveDate,
  });
  const rescueSuggestion = buildRescueSuggestion({
    launch: dailyLaunch,
    mustWinTask: dailyLaunch?.mustWinTask ?? null,
    pendingTaskCount: tasks.filter((task) => task.status === "PENDING").length,
    overdueTaskCount: overdueTasks.length,
    hasMissedDayPattern,
  });

  return {
    dayCycle,
    weekCycle,
    score,
    momentum,
    tasks,
    overdueTasks,
    staleInboxTasks,
    weekStartIsoDate,
    plannerBlocks,
    plannerBlockCount,
    dailyLaunch,
    hasMissedDayPattern,
    serializedTasks,
    serializedLaunch,
    serializedMustWinTask,
    behaviorCapacity,
    rescueSuggestion,
    guidanceTasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: toGuidanceTaskStatus(task.status),
      progressState: fromPrismaTaskProgressState(task.progressState),
      lastStuckAt: task.lastStuckAt?.toISOString() ?? null,
    })),
    guidanceMustWinTask: dailyLaunch?.mustWinTask
      ? {
          id: dailyLaunch.mustWinTask.id,
          title: dailyLaunch.mustWinTask.title,
          status: toGuidanceTaskStatus(dailyLaunch.mustWinTask.status),
          progressState: fromPrismaTaskProgressState(dailyLaunch.mustWinTask.progressState),
          lastStuckAt: dailyLaunch.mustWinTask.lastStuckAt?.toISOString() ?? null,
        }
      : null,
    pendingPriorityCount: dayCycle.priorities.filter((priority) => priority.status !== "COMPLETED" && priority.status !== "DROPPED").length,
    openTaskCount: tasks.filter((task) => task.status === "PENDING").length,
    currentIsoDate: currentIsoDate as IsoDateString,
  };
}
