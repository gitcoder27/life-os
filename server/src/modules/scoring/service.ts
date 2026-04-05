import type { Prisma, PrismaClient } from "@prisma/client";

import {
  getMealTargetCountForHour,
  scoreMealConsistency,
} from "../../lib/health/meals.js";
import { filterDueHabits, getHabitCompletionCountForIsoDate } from "../../lib/habits/schedule.js";
import {
  addDays,
  getMonthEndDate,
  getMonthStartIsoDate,
  getWeekEndDate,
  getWeekStartIsoDate,
  parseIsoDate,
} from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import {
  getDayWindowUtc,
  getTimeWindowUtc,
  getUserLocalDate,
  getUserLocalHour,
  normalizeTimezone,
} from "../../lib/time/user-time.js";
import { goalSummaryInclude } from "../planning/planning-record-shapes.js";

type ScoreLabel = "Strong Day" | "Solid Day" | "Recovering Day" | "Off-Track Day";
type ScoreBucketKey =
  | "plan_and_priorities"
  | "routines_and_habits"
  | "health_basics"
  | "finance_and_admin"
  | "review_and_reset";

interface ScoreBucket {
  key: ScoreBucketKey;
  label: string;
  earnedPoints: number;
  applicablePoints: number;
  explanation: string;
}

interface ScoreReason {
  label: string;
  missingPoints: number;
}

export interface DailyScoreBreakdownResponse {
  date: string;
  value: number;
  label: ScoreLabel;
  earnedPoints: number;
  possiblePoints: number;
  buckets: ScoreBucket[];
  topReasons: ScoreReason[];
  finalizedAt: string | null;
  generatedAt: string;
}

export interface WeeklyMomentumResponse {
  endingOn: string;
  value: number;
  basedOnDays: number;
  weeklyReviewBonus: number;
  strongDayStreak: number;
  dailyScores: Array<{
    date: string;
    value: number;
    label: ScoreLabel;
  }>;
  generatedAt: string;
}

const PRIORITY_POINTS: Record<number, number> = {
  1: 10,
  2: 8,
  3: 6,
};

const planningCycleInclude = {
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
  dailyReview: true,
  dailyScore: true,
  weeklyReview: true,
  monthlyReview: true,
} satisfies Prisma.PlanningCycleInclude;

function isPrismaErrorCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function getScoreLabel(value: number): ScoreLabel {
  if (value >= 85) {
    return "Strong Day";
  }

  if (value >= 70) {
    return "Solid Day";
  }

  if (value >= 55) {
    return "Recovering Day";
  }

  return "Off-Track Day";
}

export async function ensureCycle(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: {
    userId: string;
    cycleType: "DAY" | "WEEK" | "MONTH";
    cycleStartDate: Date;
    cycleEndDate: Date;
  },
) {
  const where = {
    userId_cycleType_cycleStartDate: {
      userId: input.userId,
      cycleType: input.cycleType,
      cycleStartDate: input.cycleStartDate,
    },
  } satisfies Prisma.PlanningCycleWhereUniqueInput;

  try {
    return await prisma.planningCycle.upsert({
      where,
      update: {
        cycleEndDate: input.cycleEndDate,
      },
      create: input,
      include: planningCycleInclude,
    });
  } catch (error) {
    if (!isPrismaErrorCode(error, "P2002")) {
      throw error;
    }

    const existingCycle = await prisma.planningCycle.findUnique({
      where,
      include: planningCycleInclude,
    });

    if (!existingCycle) {
      throw error;
    }

    if (existingCycle.cycleEndDate.getTime() === input.cycleEndDate.getTime()) {
      return existingCycle;
    }

    return prisma.planningCycle.update({
      where,
      data: {
        cycleEndDate: input.cycleEndDate,
      },
      include: planningCycleInclude,
    });
  }
}

function buildBucket(
  key: ScoreBucket["key"],
  label: string,
  earnedPoints: number,
  applicablePoints: number,
  explanation: string,
): ScoreBucket {
  return {
    key,
    label,
    earnedPoints: roundToOneDecimal(earnedPoints),
    applicablePoints: roundToOneDecimal(applicablePoints),
    explanation,
  };
}

async function getDayContext(prisma: PrismaClient, userId: string, date: Date) {
  const targetIsoDate = toIsoDateString(date);
  const targetDate = parseIsoDate(targetIsoDate);
  const preferences = await prisma.userPreference.findUnique({
    where: {
      userId,
    },
  });
  const timezone = normalizeTimezone(preferences?.timezone);
  const weekStartsOn = preferences?.weekStartsOn ?? 1;
  const { start: dayWindowStart, end: dayWindowEnd } = getDayWindowUtc(targetIsoDate, timezone);
  const tomorrowDate = addDays(targetDate, 1);
  const tomorrowIsoDate = toIsoDateString(tomorrowDate);
  const weekStartDate = parseIsoDate(getWeekStartIsoDate(targetIsoDate, weekStartsOn));
  const monthStartDate = parseIsoDate(getMonthStartIsoDate(targetIsoDate));
  const nextMonthStart = new Date(
    Date.UTC(monthStartDate.getUTCFullYear(), monthStartDate.getUTCMonth() + 1, 1),
  );

  const dayCycle = await ensureCycle(prisma, {
    userId,
    cycleType: "DAY",
    cycleStartDate: targetDate,
    cycleEndDate: targetDate,
  });

  const tomorrowCycle = await ensureCycle(prisma, {
    userId,
    cycleType: "DAY",
    cycleStartDate: tomorrowDate,
    cycleEndDate: tomorrowDate,
  });

  const weekCycle = await ensureCycle(prisma, {
    userId,
    cycleType: "WEEK",
    cycleStartDate: weekStartDate,
    cycleEndDate: getWeekEndDate(weekStartDate),
  });

  await ensureCycle(prisma, {
    userId,
    cycleType: "MONTH",
    cycleStartDate: monthStartDate,
    cycleEndDate: getMonthEndDate(monthStartDate),
  });
  await ensureCycle(prisma, {
    userId,
    cycleType: "MONTH",
    cycleStartDate: nextMonthStart,
    cycleEndDate: getMonthEndDate(nextMonthStart),
  });

  const [
    tasks,
    activeHabits,
    habitCheckins,
    activeRoutines,
    routineCheckins,
    waterLogs,
    mealLogs,
    workoutDay,
    expenses,
    dueAdminItems,
  ] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId,
        scheduledForDate: targetDate,
      },
      include: {
        plannerBlockTask: {
          include: {
            block: true,
          },
        },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
    }),
    prisma.habit.findMany({
      where: {
        userId,
        status: "ACTIVE",
        archivedAt: null,
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
        pauseWindows: {
          orderBy: {
            startsOn: "asc",
          },
        },
      },
    }),
    prisma.habitCheckin.findMany({
      where: {
        habit: {
          userId,
        },
        occurredOn: targetDate,
      },
    }),
    prisma.routine.findMany({
      where: {
        userId,
        status: "ACTIVE",
      },
      include: {
        items: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    }),
    prisma.routineItemCheckin.findMany({
      where: {
        occurredOn: targetDate,
        routineItem: {
          routine: {
            userId,
          },
        },
      },
    }),
    prisma.waterLog.findMany({
      where: {
        userId,
        occurredAt: {
          gte: dayWindowStart,
          lt: dayWindowEnd,
        },
      },
    }),
    prisma.mealLog.findMany({
      where: {
        userId,
        occurredAt: {
          gte: dayWindowStart,
          lt: dayWindowEnd,
        },
      },
    }),
    prisma.workoutDay.findUnique({
      where: {
        userId_date: {
          userId,
          date: targetDate,
        },
      },
    }),
    prisma.expense.findMany({
      where: {
        userId,
        spentOn: {
          gte: targetDate,
          lt: tomorrowDate,
        },
      },
    }),
    prisma.adminItem.findMany({
      where: {
        userId,
        dueOn: targetDate,
      },
    }),
  ]);

  return {
    date: targetDate,
    targetIsoDate,
    dayCycle,
    tomorrowCycle,
    weekCycle,
    tasks,
    activeHabits,
    habitCheckins,
    activeRoutines,
    routineCheckins,
    waterLogs,
    mealLogs,
    workoutDay,
    expenses,
    dueAdminItems,
    preferences,
    timezone,
  };
}

function getRoutineCompletion(
  routines: Awaited<ReturnType<typeof getDayContext>>["activeRoutines"],
  routineCheckins: Awaited<ReturnType<typeof getDayContext>>["routineCheckins"],
) {
  const scorableRoutines = routines
    .map((routine) => ({
      ...routine,
      requiredItems: routine.items.filter((item) => item.isRequired),
    }))
    .filter((routine) => routine.requiredItems.length > 0);

  if (scorableRoutines.length === 0) {
    return {
      earned: 0,
      applicable: 0,
      completed: 0,
      total: 0,
    };
  }

  const routineShare = 10 / scorableRoutines.length;
  const earned = scorableRoutines.reduce((sum, routine) => {
    const completed = routine.requiredItems.filter((item) =>
      routineCheckins.some((checkin) => checkin.routineItemId === item.id),
    ).length;

    return sum + routineShare * (completed / routine.requiredItems.length);
  }, 0);
  const completed = scorableRoutines.reduce(
    (sum, routine) =>
      sum +
      routine.requiredItems.filter((item) =>
        routineCheckins.some((checkin) => checkin.routineItemId === item.id),
      ).length,
    0,
  );
  const total = scorableRoutines.reduce((sum, routine) => sum + routine.requiredItems.length, 0);

  return {
    earned,
    applicable: 10,
    completed,
    total,
  };
}

function sortTasksForScore(
  tasks: Awaited<ReturnType<typeof getDayContext>>["tasks"],
) {
  return tasks
    .slice()
    .sort((left, right) => {
      const leftIsPlanned = Boolean(left.plannerBlockTask);
      const rightIsPlanned = Boolean(right.plannerBlockTask);

      if (leftIsPlanned !== rightIsPlanned) {
        return leftIsPlanned ? -1 : 1;
      }

      if (left.plannerBlockTask && right.plannerBlockTask) {
        const blockSortDelta = left.plannerBlockTask.block.sortOrder - right.plannerBlockTask.block.sortOrder;
        if (blockSortDelta !== 0) {
          return blockSortDelta;
        }

        const taskSortDelta = left.plannerBlockTask.sortOrder - right.plannerBlockTask.sortOrder;
        if (taskSortDelta !== 0) {
          return taskSortDelta;
        }
      }

      const leftDueAt = left.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightDueAt = right.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (leftDueAt !== rightDueAt) {
        return leftDueAt - rightDueAt;
      }

      return left.createdAt.getTime() - right.createdAt.getTime();
    });
}

export async function calculateDailyScore(
  prisma: PrismaClient,
  userId: string,
  date: Date,
): Promise<DailyScoreBreakdownResponse> {
  const context = await getDayContext(prisma, userId, date);
  const priorities = context.dayCycle.priorities;
  const tasksForScore = sortTasksForScore(context.tasks).slice(0, 5);

  const priorityEarned = priorities.reduce(
    (sum, priority) =>
      sum + (priority.status === "COMPLETED" ? PRIORITY_POINTS[priority.slot] ?? 0 : 0),
    0,
  );
  const priorityApplicable = priorities.reduce((sum, priority) => sum + (PRIORITY_POINTS[priority.slot] ?? 0), 0);
  const hasPlannedTasks = tasksForScore.some((task) => task.plannerBlockTask);
  const taskWeights = tasksForScore.map((task) => (hasPlannedTasks && !task.plannerBlockTask ? 0.5 : 1));
  const weightedTaskTotal = taskWeights.reduce((sum, weight) => sum + weight, 0);
  const completedTaskWeight = tasksForScore.reduce(
    (sum, task, index) => sum + (task.status === "COMPLETED" ? taskWeights[index] : 0),
    0,
  );
  const taskApplicable = weightedTaskTotal > 0 ? 6 : 0;
  const taskEarned = taskApplicable > 0 ? 6 * (completedTaskWeight / weightedTaskTotal) : 0;
  const planBucket = buildBucket(
    "plan_and_priorities",
    "Plan and Priorities",
    priorityEarned + taskEarned,
    priorityApplicable + taskApplicable,
    hasPlannedTasks
      ? "Top priorities plus up to five focus tasks. Planned tasks count first, and unplanned work earns partial credit. Goals guide what you plan, but do not add separate bonus points."
      : "Top priorities plus up to five focus tasks scheduled for the day. Goals guide what you plan, but do not add separate bonus points.",
  );

  const routines = getRoutineCompletion(context.activeRoutines, context.routineCheckins);
  const dueHabits = filterDueHabits(context.activeHabits, context.targetIsoDate);
  const habitCompletedUnits = dueHabits.reduce(
    (sum, habit) =>
      sum +
      Math.min(
        getHabitCompletionCountForIsoDate(
          context.habitCheckins.filter((checkin) => checkin.habitId === habit.id),
          context.targetIsoDate,
        ),
        habit.targetPerDay,
      ),
    0,
  );
  const habitTargetUnits = dueHabits.reduce((sum, habit) => sum + habit.targetPerDay, 0);
  const habitApplicable = dueHabits.length > 0 ? 15 : 0;
  const habitEarned = habitTargetUnits > 0 ? 15 * (habitCompletedUnits / habitTargetUnits) : 0;
  const routineHabitBucket = buildBucket(
    "routines_and_habits",
    "Routines and Habits",
    routines.earned + habitEarned,
    routines.applicable + habitApplicable,
    "Required routine items plus due habit repetitions for the day.",
  );

  const waterTarget = context.preferences?.dailyWaterTargetMl ?? 2500;
  const waterMl = context.waterLogs.reduce((sum, log) => sum + log.amountMl, 0);
  const waterEarned = 8 * Math.min(1, waterTarget > 0 ? waterMl / waterTarget : 0);
  const todayIsoDate = getUserLocalDate(new Date(), context.preferences?.timezone);
  const mealTargetCount =
    context.targetIsoDate === todayIsoDate
      ? getMealTargetCountForHour(getUserLocalHour(new Date(), context.preferences?.timezone))
      : 3;
  const mealScore = scoreMealConsistency(context.mealLogs, mealTargetCount);
  const workoutApplicable = context.workoutDay && context.workoutDay.planType !== "NONE" ? 10 : 0;
  const workoutEarned =
    workoutApplicable === 0
      ? 0
      : context.workoutDay?.actualStatus === "COMPLETED" ||
          context.workoutDay?.actualStatus === "RECOVERY_RESPECTED"
        ? 10
        : context.workoutDay?.actualStatus === "FALLBACK"
          ? 5
          : 0;
  const healthBucket = buildBucket(
    "health_basics",
    "Health Basics",
    waterEarned + mealScore.earnedPoints + workoutEarned,
    8 + mealScore.applicablePoints + workoutApplicable,
    "Water target, meal logging quality, and workout or recovery adherence.",
  );

  const expenseApplicable = context.expenses.length > 0 ? 5 : 0;
  const expenseEarned = context.expenses.length > 0 ? 5 * Math.min(1, context.expenses.length / 2) : 0;
  const dueAdminApplicable = context.dueAdminItems.length > 0 ? 5 : 0;
  const dueAdminEarned =
    context.dueAdminItems.length > 0
      ? 5 *
        (context.dueAdminItems.filter((item) => item.status === "DONE" || item.status === "RESCHEDULED").length /
          context.dueAdminItems.length)
      : 0;
  const financeBucket = buildBucket(
    "finance_and_admin",
    "Finance and Admin",
    expenseEarned + dueAdminEarned,
    expenseApplicable + dueAdminApplicable,
    "Same-day expense logging and due admin or bill items.",
  );

  const tomorrowPrepared = context.tomorrowCycle.priorities.length === 3 ? 4 : 0;
  const reviewCompleted = context.dayCycle.dailyReview ? 6 : 0;
  const reviewBucket = buildBucket(
    "review_and_reset",
    "Review and Reset",
    reviewCompleted + tomorrowPrepared,
    10,
    "Daily review completion plus tomorrow preparation.",
  );

  const buckets = [planBucket, routineHabitBucket, healthBucket, financeBucket, reviewBucket].filter(
    (bucket) => bucket.applicablePoints > 0,
  );
  const earnedPoints = roundToOneDecimal(buckets.reduce((sum, bucket) => sum + bucket.earnedPoints, 0));
  const possiblePoints = roundToOneDecimal(
    buckets.reduce((sum, bucket) => sum + bucket.applicablePoints, 0),
  );
  const value = possiblePoints > 0 ? Math.round((earnedPoints / possiblePoints) * 100) : 0;
  const topReasons = buckets
    .map((bucket) => ({
      label: bucket.label,
      missingPoints: roundToOneDecimal(bucket.applicablePoints - bucket.earnedPoints),
    }))
    .filter((reason) => reason.missingPoints > 0)
    .sort((a, b) => b.missingPoints - a.missingPoints)
    .slice(0, 3);

  return {
    date: context.targetIsoDate,
    value,
    label: getScoreLabel(value),
    earnedPoints,
    possiblePoints,
    buckets,
    topReasons,
    finalizedAt: context.dayCycle.dailyScore?.finalizedAt?.toISOString() ?? null,
    generatedAt: new Date().toISOString(),
  };
}

export async function finalizeDailyScore(
  prisma: PrismaClient,
  userId: string,
  date: Date,
) {
  const dayCycle = await ensureCycle(prisma, {
    userId,
    cycleType: "DAY",
    cycleStartDate: date,
    cycleEndDate: date,
  });
  const score = await calculateDailyScore(prisma, userId, date);
  const finalizedAt = new Date();

  await prisma.dailyScore.upsert({
    where: {
      planningCycleId: dayCycle.id,
    },
    update: {
      scoreValue: score.value,
      scoreBand: score.label,
      earnedPoints: score.earnedPoints,
      applicablePoints: score.possiblePoints,
      breakdownJson: {
        buckets: score.buckets,
        topReasons: score.topReasons,
      } as unknown as Prisma.InputJsonValue,
      finalizedAt,
    },
    create: {
      userId,
      planningCycleId: dayCycle.id,
      scoreValue: score.value,
      scoreBand: score.label,
      earnedPoints: score.earnedPoints,
      applicablePoints: score.possiblePoints,
      breakdownJson: {
        buckets: score.buckets,
        topReasons: score.topReasons,
      } as unknown as Prisma.InputJsonValue,
      finalizedAt,
    },
  });

  await prisma.planningCycle.update({
    where: {
      id: dayCycle.id,
    },
    data: {
      status: "CLOSED",
    },
  });

  return {
    ...score,
    finalizedAt: finalizedAt.toISOString(),
    generatedAt: new Date().toISOString(),
  };
}

export async function getWeeklyMomentum(
  prisma: PrismaClient,
  userId: string,
  endingOn: Date,
): Promise<WeeklyMomentumResponse> {
  const dailyScores = await prisma.dailyScore.findMany({
    where: {
      userId,
      finalizedAt: {
        not: null,
      },
      planningCycle: {
        cycleStartDate: {
          lte: endingOn,
        },
      },
    },
    orderBy: {
      planningCycle: {
        cycleStartDate: "desc",
      },
    },
    take: 7,
    include: {
      planningCycle: true,
    },
  });

  const trailingWeekStart = addDays(endingOn, -6);
  const weeklyReviewInWindow = await prisma.weeklyReview.findFirst({
    where: {
      userId,
      planningCycle: {
        cycleEndDate: {
          gte: trailingWeekStart,
          lte: endingOn,
        },
      },
    },
  });

  const weeklyReviewBonus = weeklyReviewInWindow ? 5 : 0;
  const values = dailyScores.map((score) => score.scoreValue);
  const average = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const value = Math.min(100, Math.round(average + weeklyReviewBonus));

  const allRecentScores = await prisma.dailyScore.findMany({
    where: {
      userId,
      finalizedAt: {
        not: null,
      },
      planningCycle: {
        cycleStartDate: {
          lte: endingOn,
        },
      },
    },
    orderBy: {
      planningCycle: {
        cycleStartDate: "desc",
      },
    },
    include: {
      planningCycle: true,
    },
    take: 30,
  });

  let strongDayStreak = 0;
  for (const score of allRecentScores) {
    if (score.scoreValue >= 85) {
      strongDayStreak += 1;
      continue;
    }
    break;
  }

  return {
    endingOn: toIsoDateString(endingOn),
    value,
    basedOnDays: dailyScores.length,
    weeklyReviewBonus,
    strongDayStreak,
    dailyScores: dailyScores
      .slice()
      .reverse()
      .map((score) => ({
        date: toIsoDateString(score.planningCycle.cycleStartDate),
        value: score.scoreValue,
        label: score.scoreBand as ScoreLabel,
      })),
    generatedAt: new Date().toISOString(),
  };
}

function getReviewWindowEnd(date: Date, dailyReviewEndTime: string | null | undefined) {
  return getTimeWindowUtc(toIsoDateString(date), dailyReviewEndTime ?? "10:00", "UTC");
}

export async function finalizeClosedDayScores(prisma: PrismaClient, now: Date) {
  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
    },
    include: {
      preferences: true,
    },
  });
  let finalizedCount = 0;

  for (const user of users) {
    const timezone = normalizeTimezone(user.preferences?.timezone);
    const todayIsoDate = getUserLocalDate(now, timezone);
    const today = parseIsoDate(todayIsoDate);
    const reviewWindowEndsToday = getTimeWindowUtc(
      todayIsoDate,
      user.preferences?.dailyReviewEndTime ?? "10:00",
      timezone,
    );
    const thresholdDate = now >= reviewWindowEndsToday ? addDays(today, -1) : addDays(today, -2);
    const openDayCycles = await prisma.planningCycle.findMany({
      where: {
        userId: user.id,
        cycleType: "DAY",
        cycleStartDate: {
          lte: thresholdDate,
        },
        OR: [{ status: { not: "CLOSED" } }, { dailyScore: null }, { dailyScore: { finalizedAt: null } }],
      },
      include: {
        dailyScore: true,
      },
      orderBy: {
        cycleStartDate: "asc",
      },
    });

    for (const cycle of openDayCycles) {
      await finalizeDailyScore(prisma, user.id, cycle.cycleStartDate);
      finalizedCount += 1;
    }
  }

  return {
    finalizedCount,
  };
}
