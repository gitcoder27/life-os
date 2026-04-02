import type { PrismaClient } from "@prisma/client";
import { normalizeTimezone, getDateRangeWindowUtc } from "../../../lib/time/user-time.js";
import { toIsoDateString } from "../../../lib/time/date.js";
import { countWaterTargetHits } from "../../../lib/health/water.js";
import { getHabitCompletionCountForIsoDate, isHabitDueOnIsoDate, resolveHabitRecurrence } from "../../../lib/habits/schedule.js";
import { getWeeklyMomentum } from "../../scoring/service.js";

import {
  buildReviewHistoryRoute,
  buildReviewHistorySummary,
  compareHistoryItems,
  containsNormalized,
  createHistoryMetric,
  formatPeriodLabel,
  getTopFrictionTags,
  getUserPreferences,
  listIsoDates,
  normalizeReviewHistoryQuery,
  paginateReviewHistoryItems,
  resolveHistoryRangeStart,
  roundToPercent,
} from "./review-helpers.js";
import type {
  DailyReviewHistoryRow,
  MonthlyHistoryMetrics,
  MonthlyReviewHistoryRow,
  MonthlyReviewHistoryTrendPoint,
  ReviewFrictionTag,
  ReviewHistoryItem,
  ReviewHistoryQuery,
  ReviewHistoryResponse,
  WeeklyHistoryMetrics,
  WeeklyReviewHistoryRow,
  WeeklyReviewHistoryTrendPoint,
} from "./review-types.js";

function matchesDailyHistorySearch(review: DailyReviewHistoryRow, normalizedQuery: string) {
  return (
    !normalizedQuery ||
    containsNormalized(review.biggestWin, normalizedQuery) ||
    containsNormalized(review.frictionTag, normalizedQuery) ||
    containsNormalized(review.frictionNote, normalizedQuery) ||
    containsNormalized(review.optionalNote, normalizedQuery)
  );
}

function matchesWeeklyHistorySearch(review: WeeklyReviewHistoryRow, normalizedQuery: string) {
  return (
    !normalizedQuery ||
    containsNormalized(review.biggestWin, normalizedQuery) ||
    containsNormalized(review.biggestMiss, normalizedQuery) ||
    containsNormalized(review.mainLesson, normalizedQuery) ||
    containsNormalized(review.keepText, normalizedQuery) ||
    containsNormalized(review.improveText, normalizedQuery) ||
    containsNormalized(review.notes, normalizedQuery) ||
    containsNormalized(review.healthTargetText, normalizedQuery)
  );
}

function matchesMonthlyHistorySearch(review: MonthlyReviewHistoryRow, normalizedQuery: string) {
  const outcomeTitles = Array.isArray(review.threeOutcomesJson)
    ? review.threeOutcomesJson
        .map((value) =>
          typeof value === "string"
            ? value
            : value && typeof value === "object" && "title" in value && typeof value.title === "string"
              ? value.title
              : null,
        )
        .filter((value): value is string => Boolean(value))
    : [];

  return (
    !normalizedQuery ||
    containsNormalized(review.monthVerdict, normalizedQuery) ||
    containsNormalized(review.biggestWin, normalizedQuery) ||
    containsNormalized(review.biggestLeak, normalizedQuery) ||
    containsNormalized(review.nextMonthTheme, normalizedQuery) ||
    containsNormalized(review.simplifyText, normalizedQuery) ||
    containsNormalized(review.notes, normalizedQuery) ||
    outcomeTitles.some((value) => containsNormalized(value, normalizedQuery)) ||
    (review.habitChangesJson as string[]).some((value) => containsNormalized(value, normalizedQuery))
  );
}

async function buildDailyHistoryItems(
  prisma: PrismaClient,
  userId: string,
  reviews: DailyReviewHistoryRow[],
): Promise<ReviewHistoryItem[]> {
  if (reviews.length === 0) {
    return [];
  }

  const sortedDates = [...reviews]
    .map((review) => review.planningCycle.cycleStartDate)
    .sort((left, right) => left.getTime() - right.getTime());
  const minDate = sortedDates[0]!;
  const maxDate = sortedDates[sortedDates.length - 1]!;
  const [tasks, habitCheckins] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId,
        scheduledForDate: {
          gte: minDate,
          lte: maxDate,
        },
      },
      select: {
        status: true,
        scheduledForDate: true,
      },
    }),
    prisma.habitCheckin.findMany({
      where: {
        status: "COMPLETED",
        occurredOn: {
          gte: minDate,
          lte: maxDate,
        },
        habit: {
          userId,
        },
      },
      select: {
        occurredOn: true,
      },
    }),
  ]);

  const taskCounts = new Map<string, { scheduled: number; completed: number }>();
  for (const task of tasks) {
    if (!task.scheduledForDate) {
      continue;
    }

    const isoDate = toIsoDateString(task.scheduledForDate);
    const current = taskCounts.get(isoDate) ?? { scheduled: 0, completed: 0 };
    current.scheduled += 1;
    if (task.status === "COMPLETED") {
      current.completed += 1;
    }
    taskCounts.set(isoDate, current);
  }

  const habitCounts = new Map<string, number>();
  for (const checkin of habitCheckins) {
    const isoDate = toIsoDateString(checkin.occurredOn);
    habitCounts.set(isoDate, (habitCounts.get(isoDate) ?? 0) + 1);
  }

  return reviews.map((review) => {
    const periodStart = toIsoDateString(review.planningCycle.cycleStartDate);
    const counts = taskCounts.get(periodStart) ?? { scheduled: 0, completed: 0 };
    const habitsCompleted = habitCounts.get(periodStart) ?? 0;
    const scoreValue = review.planningCycle.dailyScore?.scoreValue ?? null;

    return {
      id: review.id,
      cadence: "daily",
      periodStart,
      periodEnd: periodStart,
      completedAt: review.completedAt.toISOString(),
      primaryText: review.biggestWin,
      secondaryText: review.frictionNote ?? review.optionalNote,
      metrics: [
        createHistoryMetric("score", "Score", scoreValue, scoreValue === null ? "No score" : String(scoreValue)),
        createHistoryMetric(
          "tasks",
          "Tasks",
          `${counts.completed}/${counts.scheduled}`,
          `${counts.completed}/${counts.scheduled} done`,
        ),
        createHistoryMetric("habitsCompleted", "Habits", habitsCompleted, `${habitsCompleted} completed`),
      ],
      frictionTags: [review.frictionTag as ReviewFrictionTag],
      route: buildReviewHistoryRoute("daily", periodStart),
    };
  });
}

async function buildWeeklyHistoryMetricsMap(
  prisma: PrismaClient,
  userId: string,
  reviews: WeeklyReviewHistoryRow[],
) {
  const metricsMap = new Map<string, WeeklyHistoryMetrics>();
  if (reviews.length === 0) {
    return metricsMap;
  }

  const minStart = new Date(Math.min(...reviews.map((review) => review.planningCycle.cycleStartDate.getTime())));
  const maxEnd = new Date(Math.max(...reviews.map((review) => review.planningCycle.cycleEndDate.getTime())));
  const [scores, habits, routineCheckins, routines, dailyReviews] = await Promise.all([
    prisma.dailyScore.findMany({
      where: {
        userId,
        finalizedAt: {
          not: null,
        },
        planningCycle: {
          cycleStartDate: {
            gte: minStart,
            lte: maxEnd,
          },
        },
      },
      include: {
        planningCycle: true,
      },
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
        checkins: {
          where: {
            occurredOn: {
              gte: minStart,
              lte: maxEnd,
            },
          },
        },
      },
    }),
    prisma.routineItemCheckin.findMany({
      where: {
        occurredOn: {
          gte: minStart,
          lte: maxEnd,
        },
        routineItem: {
          routine: {
            userId,
          },
        },
      },
    }),
    prisma.routineItem.findMany({
      where: {
        routine: {
          userId,
          status: "ACTIVE",
        },
      },
    }),
    prisma.dailyReview.findMany({
      where: {
        userId,
        planningCycle: {
          cycleStartDate: {
            gte: minStart,
            lte: maxEnd,
          },
        },
      },
      include: {
        planningCycle: true,
      },
    }),
  ]);

  for (const review of reviews) {
    const startDate = review.planningCycle.cycleStartDate;
    const endDate = review.planningCycle.cycleEndDate;
    const scopedIsoDates = listIsoDates(toIsoDateString(startDate), toIsoDateString(endDate));
    const periodScores = scores.filter(
      (score) =>
        score.planningCycle.cycleStartDate.getTime() >= startDate.getTime() &&
        score.planningCycle.cycleStartDate.getTime() <= endDate.getTime(),
    );
    const periodRoutineCheckins = routineCheckins.filter(
      (checkin) =>
        checkin.occurredOn.getTime() >= startDate.getTime() &&
        checkin.occurredOn.getTime() <= endDate.getTime(),
    );
    const periodDailyReviews = dailyReviews.filter(
      (entry) =>
        entry.planningCycle.cycleStartDate.getTime() >= startDate.getTime() &&
        entry.planningCycle.cycleStartDate.getTime() <= endDate.getTime(),
    );
    const habitTotals = habits.reduce(
      (totals, habit) => {
        const scheduleRule = resolveHabitRecurrence(habit, toIsoDateString(startDate));

        for (const isoDate of scopedIsoDates) {
          if (!isHabitDueOnIsoDate(scheduleRule, isoDate, habit.pauseWindows)) {
            continue;
          }

          totals.due += habit.targetPerDay;
          totals.completed += Math.min(getHabitCompletionCountForIsoDate(habit.checkins, isoDate), habit.targetPerDay);
        }

        return totals;
      },
      { due: 0, completed: 0 },
    );
    const frictionCounts = periodDailyReviews.reduce<Partial<Record<ReviewFrictionTag, number>>>((acc, entry) => {
      const tag = entry.frictionTag as ReviewFrictionTag;
      acc[tag] = (acc[tag] ?? 0) + 1;
      return acc;
    }, {});

    metricsMap.set(review.id, {
      averageDailyScore:
        periodScores.length > 0
          ? Math.round(periodScores.reduce((sum, score) => sum + score.scoreValue, 0) / periodScores.length)
          : 0,
      habitCompletionRate:
        habitTotals.due > 0 ? roundToPercent(habitTotals.completed / habitTotals.due) : 0,
      strongDayCount: periodScores.filter((score) => score.scoreValue >= 85).length,
      topFrictionTags: getTopFrictionTags(frictionCounts).map((entry) => entry.tag),
    });
  }

  return metricsMap;
}

function buildWeeklyHistoryItems(
  reviews: WeeklyReviewHistoryRow[],
  metricsMap: Map<string, WeeklyHistoryMetrics>,
): ReviewHistoryItem[] {
  return reviews.map((review) => {
    const periodStart = toIsoDateString(review.planningCycle.cycleStartDate);
    const periodEnd = toIsoDateString(review.planningCycle.cycleEndDate);
    const metrics = metricsMap.get(review.id) ?? {
      averageDailyScore: 0,
      habitCompletionRate: 0,
      strongDayCount: 0,
      topFrictionTags: [],
    };

    return {
      id: review.id,
      cadence: "weekly",
      periodStart,
      periodEnd,
      completedAt: review.completedAt.toISOString(),
      primaryText: review.mainLesson,
      secondaryText: review.biggestWin,
      metrics: [
        createHistoryMetric(
          "averageDailyScore",
          "Avg daily score",
          metrics.averageDailyScore,
          String(metrics.averageDailyScore),
        ),
        createHistoryMetric(
          "habitCompletionRate",
          "Habit completion",
          metrics.habitCompletionRate,
          `${metrics.habitCompletionRate}%`,
        ),
        createHistoryMetric("strongDayCount", "Strong days", metrics.strongDayCount, String(metrics.strongDayCount)),
      ],
      frictionTags: metrics.topFrictionTags,
      route: buildReviewHistoryRoute("weekly", periodStart),
    };
  });
}

async function buildMonthlyHistoryMetricsMap(
  prisma: PrismaClient,
  userId: string,
  reviews: MonthlyReviewHistoryRow[],
  timezone: string,
  waterTargetMl: number,
) {
  const metricsMap = new Map<string, MonthlyHistoryMetrics>();
  if (reviews.length === 0) {
    return metricsMap;
  }

  const minStart = new Date(Math.min(...reviews.map((review) => review.planningCycle.cycleStartDate.getTime())));
  const maxEnd = new Date(Math.max(...reviews.map((review) => review.planningCycle.cycleEndDate.getTime())));
  const rangeWindow = getDateRangeWindowUtc(toIsoDateString(minStart), toIsoDateString(maxEnd), timezone);
  const [workoutDays, waterLogs, dailyReviews, momentumValues] = await Promise.all([
    prisma.workoutDay.findMany({
      where: {
        userId,
        date: {
          gte: minStart,
          lte: maxEnd,
        },
      },
    }),
    prisma.waterLog.findMany({
      where: {
        userId,
        occurredAt: {
          gte: rangeWindow.start,
          lt: rangeWindow.end,
        },
      },
    }),
    prisma.dailyReview.findMany({
      where: {
        userId,
        planningCycle: {
          cycleStartDate: {
            gte: minStart,
            lte: maxEnd,
          },
        },
      },
      include: {
        planningCycle: true,
      },
    }),
    Promise.all(
      reviews.map((review) =>
        getWeeklyMomentum(prisma, userId, review.planningCycle.cycleEndDate).then((result) => ({
          reviewId: review.id,
          value: result.value,
        })),
      ),
    ),
  ]);

  const momentumMap = new Map(momentumValues.map((entry) => [entry.reviewId, entry.value]));

  for (const review of reviews) {
    const startDate = review.planningCycle.cycleStartDate;
    const endDate = review.planningCycle.cycleEndDate;
    const startIso = toIsoDateString(startDate);
    const endIso = toIsoDateString(endDate);
    const scopedIsoDates = listIsoDates(startIso, endIso);
    const periodWindow = getDateRangeWindowUtc(startIso, endIso, timezone);
    const periodWaterLogs = waterLogs.filter(
      (log) => log.occurredAt >= periodWindow.start && log.occurredAt < periodWindow.end,
    );
    const waterTargetHitCount = countWaterTargetHits(periodWaterLogs, timezone, waterTargetMl);
    const periodWorkoutCount = workoutDays.filter(
      (day) =>
        day.date.getTime() >= startDate.getTime() &&
        day.date.getTime() <= endDate.getTime() &&
        day.actualStatus === "COMPLETED",
    ).length;
    const frictionCounts = dailyReviews.reduce<Partial<Record<ReviewFrictionTag, number>>>((acc, entry) => {
      if (
        entry.planningCycle.cycleStartDate.getTime() < startDate.getTime() ||
        entry.planningCycle.cycleStartDate.getTime() > endDate.getTime()
      ) {
        return acc;
      }

      const tag = entry.frictionTag as ReviewFrictionTag;
      acc[tag] = (acc[tag] ?? 0) + 1;
      return acc;
    }, {});

    metricsMap.set(review.id, {
      averageWeeklyMomentum: momentumMap.get(review.id) ?? 0,
      waterSuccessRate:
        scopedIsoDates.length > 0 ? roundToPercent(waterTargetHitCount / scopedIsoDates.length) : 0,
      workoutCount: periodWorkoutCount,
      topFrictionTags: getTopFrictionTags(frictionCounts).map((entry) => entry.tag),
    });
  }

  return metricsMap;
}

function buildMonthlyHistoryItems(
  reviews: MonthlyReviewHistoryRow[],
  metricsMap: Map<string, MonthlyHistoryMetrics>,
): ReviewHistoryItem[] {
  return reviews.map((review) => {
    const periodStart = toIsoDateString(review.planningCycle.cycleStartDate);
    const periodEnd = toIsoDateString(review.planningCycle.cycleEndDate);
    const metrics = metricsMap.get(review.id) ?? {
      averageWeeklyMomentum: 0,
      waterSuccessRate: 0,
      workoutCount: 0,
      topFrictionTags: [],
    };

    return {
      id: review.id,
      cadence: "monthly",
      periodStart,
      periodEnd,
      completedAt: review.completedAt.toISOString(),
      primaryText: review.monthVerdict,
      secondaryText: review.biggestWin,
      metrics: [
        createHistoryMetric(
          "averageWeeklyMomentum",
          "Weekly momentum",
          metrics.averageWeeklyMomentum,
          String(metrics.averageWeeklyMomentum),
        ),
        createHistoryMetric(
          "waterSuccessRate",
          "Water success",
          metrics.waterSuccessRate,
          `${metrics.waterSuccessRate}%`,
        ),
        createHistoryMetric("workoutCount", "Workouts", metrics.workoutCount, String(metrics.workoutCount)),
      ],
      frictionTags: metrics.topFrictionTags,
      route: buildReviewHistoryRoute("monthly", periodStart),
    };
  });
}

function buildWeeklyTrend(
  reviews: WeeklyReviewHistoryRow[],
  metricsMap: Map<string, WeeklyHistoryMetrics>,
): WeeklyReviewHistoryTrendPoint[] {
  return [...reviews]
    .sort(
      (left, right) => left.planningCycle.cycleStartDate.getTime() - right.planningCycle.cycleStartDate.getTime(),
    )
    .slice(-8)
    .map((review) => {
      const metrics = metricsMap.get(review.id) ?? {
        averageDailyScore: 0,
        habitCompletionRate: 0,
        strongDayCount: 0,
        topFrictionTags: [],
      };

      return {
        startDate: toIsoDateString(review.planningCycle.cycleStartDate),
        endDate: toIsoDateString(review.planningCycle.cycleEndDate),
        averageDailyScore: metrics.averageDailyScore,
        habitCompletionRate: metrics.habitCompletionRate,
        strongDayCount: metrics.strongDayCount,
      };
    });
}

function buildMonthlyTrend(
  reviews: MonthlyReviewHistoryRow[],
  metricsMap: Map<string, MonthlyHistoryMetrics>,
): MonthlyReviewHistoryTrendPoint[] {
  return [...reviews]
    .sort(
      (left, right) => left.planningCycle.cycleStartDate.getTime() - right.planningCycle.cycleStartDate.getTime(),
    )
    .slice(-6)
    .map((review) => {
      const metrics = metricsMap.get(review.id) ?? {
        averageWeeklyMomentum: 0,
        waterSuccessRate: 0,
        workoutCount: 0,
        topFrictionTags: [],
      };

      return {
        startDate: toIsoDateString(review.planningCycle.cycleStartDate),
        endDate: toIsoDateString(review.planningCycle.cycleEndDate),
        averageWeeklyMomentum: metrics.averageWeeklyMomentum,
        waterSuccessRate: metrics.waterSuccessRate,
        workoutCount: metrics.workoutCount,
      };
    });
}

function buildWeeklyComparison(
  reviews: WeeklyReviewHistoryRow[],
  metricsMap: Map<string, WeeklyHistoryMetrics>,
): ReviewHistoryResponse["comparisons"]["weekly"] {
  const [current, previous] = [...reviews].sort(
    (left, right) => right.planningCycle.cycleStartDate.getTime() - left.planningCycle.cycleStartDate.getTime(),
  );

  if (!current || !previous) {
    return null;
  }

  const currentMetrics = metricsMap.get(current.id) ?? {
    averageDailyScore: 0,
    habitCompletionRate: 0,
    strongDayCount: 0,
    topFrictionTags: [],
  };
  const previousMetrics = metricsMap.get(previous.id) ?? {
    averageDailyScore: 0,
    habitCompletionRate: 0,
    strongDayCount: 0,
    topFrictionTags: [],
  };

  return {
    currentPeriodStart: toIsoDateString(current.planningCycle.cycleStartDate),
    currentPeriodEnd: toIsoDateString(current.planningCycle.cycleEndDate),
    previousPeriodStart: toIsoDateString(previous.planningCycle.cycleStartDate),
    previousPeriodEnd: toIsoDateString(previous.planningCycle.cycleEndDate),
    currentLabel: formatPeriodLabel(
      toIsoDateString(current.planningCycle.cycleStartDate),
      toIsoDateString(current.planningCycle.cycleEndDate),
    ),
    previousLabel: formatPeriodLabel(
      toIsoDateString(previous.planningCycle.cycleStartDate),
      toIsoDateString(previous.planningCycle.cycleEndDate),
    ),
    currentText: current.mainLesson,
    previousText: previous.mainLesson,
    metrics: {
      current: {
        averageDailyScore: currentMetrics.averageDailyScore,
        habitCompletionRate: currentMetrics.habitCompletionRate,
        strongDayCount: currentMetrics.strongDayCount,
      },
      previous: {
        averageDailyScore: previousMetrics.averageDailyScore,
        habitCompletionRate: previousMetrics.habitCompletionRate,
        strongDayCount: previousMetrics.strongDayCount,
      },
      delta: {
        averageDailyScore: currentMetrics.averageDailyScore - previousMetrics.averageDailyScore,
        habitCompletionRate: currentMetrics.habitCompletionRate - previousMetrics.habitCompletionRate,
        strongDayCount: currentMetrics.strongDayCount - previousMetrics.strongDayCount,
      },
    },
  };
}

function buildMonthlyComparison(
  reviews: MonthlyReviewHistoryRow[],
  metricsMap: Map<string, MonthlyHistoryMetrics>,
): ReviewHistoryResponse["comparisons"]["monthly"] {
  const [current, previous] = [...reviews].sort(
    (left, right) => right.planningCycle.cycleStartDate.getTime() - left.planningCycle.cycleStartDate.getTime(),
  );

  if (!current || !previous) {
    return null;
  }

  const currentMetrics = metricsMap.get(current.id) ?? {
    averageWeeklyMomentum: 0,
    waterSuccessRate: 0,
    workoutCount: 0,
    topFrictionTags: [],
  };
  const previousMetrics = metricsMap.get(previous.id) ?? {
    averageWeeklyMomentum: 0,
    waterSuccessRate: 0,
    workoutCount: 0,
    topFrictionTags: [],
  };

  return {
    currentPeriodStart: toIsoDateString(current.planningCycle.cycleStartDate),
    currentPeriodEnd: toIsoDateString(current.planningCycle.cycleEndDate),
    previousPeriodStart: toIsoDateString(previous.planningCycle.cycleStartDate),
    previousPeriodEnd: toIsoDateString(previous.planningCycle.cycleEndDate),
    currentLabel: formatPeriodLabel(
      toIsoDateString(current.planningCycle.cycleStartDate),
      toIsoDateString(current.planningCycle.cycleEndDate),
    ),
    previousLabel: formatPeriodLabel(
      toIsoDateString(previous.planningCycle.cycleStartDate),
      toIsoDateString(previous.planningCycle.cycleEndDate),
    ),
    currentText: current.monthVerdict,
    previousText: previous.monthVerdict,
    metrics: {
      current: {
        averageWeeklyMomentum: currentMetrics.averageWeeklyMomentum,
        waterSuccessRate: currentMetrics.waterSuccessRate,
        workoutCount: currentMetrics.workoutCount,
      },
      previous: {
        averageWeeklyMomentum: previousMetrics.averageWeeklyMomentum,
        waterSuccessRate: previousMetrics.waterSuccessRate,
        workoutCount: previousMetrics.workoutCount,
      },
      delta: {
        averageWeeklyMomentum: currentMetrics.averageWeeklyMomentum - previousMetrics.averageWeeklyMomentum,
        waterSuccessRate: currentMetrics.waterSuccessRate - previousMetrics.waterSuccessRate,
        workoutCount: currentMetrics.workoutCount - previousMetrics.workoutCount,
      },
    },
  };
}

export async function getReviewHistory(
  prisma: PrismaClient,
  userId: string,
  query: ReviewHistoryQuery = {},
): Promise<ReviewHistoryResponse> {
  const resolved = normalizeReviewHistoryQuery(query);
  const now = new Date();
  const rangeStart = resolveHistoryRangeStart(resolved.range, now);
  const [preferences, dailyReviewsAll, weeklyReviewsAll, monthlyReviewsAll] = await Promise.all([
    getUserPreferences(prisma, userId),
    prisma.dailyReview.findMany({
      where: {
        userId,
        planningCycle: rangeStart
          ? {
              cycleStartDate: {
                gte: rangeStart,
              },
            }
          : undefined,
      },
      include: {
        planningCycle: {
          include: {
            dailyScore: true,
          },
        },
      },
      orderBy: {
        completedAt: "desc",
      },
    }),
    prisma.weeklyReview.findMany({
      where: {
        userId,
        planningCycle: rangeStart
          ? {
              cycleStartDate: {
                gte: rangeStart,
              },
            }
          : undefined,
      },
      include: {
        planningCycle: true,
      },
      orderBy: {
        completedAt: "desc",
      },
    }),
    prisma.monthlyReview.findMany({
      where: {
        userId,
        planningCycle: rangeStart
          ? {
              cycleStartDate: {
                gte: rangeStart,
              },
            }
          : undefined,
      },
      include: {
        planningCycle: true,
      },
      orderBy: {
        completedAt: "desc",
      },
    }),
  ]);

  const normalizedQuery = resolved.q.toLowerCase();
  const timezone = normalizeTimezone(preferences?.timezone);
  const waterTargetMl = preferences?.dailyWaterTargetMl ?? 2500;
  const cadenceAllowsDaily = resolved.cadence === "all" || resolved.cadence === "daily";
  const cadenceAllowsWeekly = resolved.cadence === "all" || resolved.cadence === "weekly";
  const cadenceAllowsMonthly = resolved.cadence === "all" || resolved.cadence === "monthly";

  const dailyReviewsFiltered = cadenceAllowsDaily
    ? dailyReviewsAll.filter((review) => matchesDailyHistorySearch(review, normalizedQuery))
    : [];
  const weeklyReviewsFiltered = cadenceAllowsWeekly
    ? weeklyReviewsAll.filter((review) => matchesWeeklyHistorySearch(review, normalizedQuery))
    : [];
  const monthlyReviewsFiltered = cadenceAllowsMonthly
    ? monthlyReviewsAll.filter((review) => matchesMonthlyHistorySearch(review, normalizedQuery))
    : [];

  const [dailyItems, weeklyMetricsMap, monthlyMetricsMap] = await Promise.all([
    buildDailyHistoryItems(prisma, userId, dailyReviewsFiltered),
    cadenceAllowsWeekly
      ? buildWeeklyHistoryMetricsMap(prisma, userId, weeklyReviewsAll)
      : Promise.resolve(new Map<string, WeeklyHistoryMetrics>()),
    cadenceAllowsMonthly
      ? buildMonthlyHistoryMetricsMap(prisma, userId, monthlyReviewsAll, timezone, waterTargetMl)
      : Promise.resolve(new Map<string, MonthlyHistoryMetrics>()),
  ]);

  const allFilteredItems = [
    ...dailyItems,
    ...buildWeeklyHistoryItems(weeklyReviewsFiltered, weeklyMetricsMap),
    ...buildMonthlyHistoryItems(monthlyReviewsFiltered, monthlyMetricsMap),
  ].sort(compareHistoryItems);
  const summary = buildReviewHistorySummary(allFilteredItems);
  const paginated = paginateReviewHistoryItems(allFilteredItems, resolved.cursor, resolved.limit);

  return {
    items: paginated.items,
    nextCursor: paginated.nextCursor,
    summary,
    weeklyTrend: cadenceAllowsWeekly ? buildWeeklyTrend(weeklyReviewsAll, weeklyMetricsMap) : [],
    monthlyTrend: cadenceAllowsMonthly ? buildMonthlyTrend(monthlyReviewsAll, monthlyMetricsMap) : [],
    comparisons: {
      weekly: cadenceAllowsWeekly ? buildWeeklyComparison(weeklyReviewsAll, weeklyMetricsMap) : null,
      monthly: cadenceAllowsMonthly ? buildMonthlyComparison(monthlyReviewsAll, monthlyMetricsMap) : null,
    },
    generatedAt: new Date().toISOString(),
  };
}
