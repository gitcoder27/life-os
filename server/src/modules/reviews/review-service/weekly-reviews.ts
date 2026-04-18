import type { PrismaClient } from "@prisma/client";

import { getHabitCompletionCountForIsoDate, isHabitDueOnIsoDate, resolveHabitRecurrence } from "../../../lib/habits/schedule.js";
import { countWaterTargetHits } from "../../../lib/health/water.js";
import { addDays, getWeekEndDate } from "../../../lib/time/cycle.js";
import { toIsoDateString } from "../../../lib/time/date.js";
import { getDateRangeWindowUtc, normalizeTimezone } from "../../../lib/time/user-time.js";
import {
  computeWeeklyCapacityProgress,
  countCompletedDeepBlocksForWeek,
  resolveWeeklyCapacityProfile,
} from "../../planning/weekly-capacity.js";
import { ensureCycle } from "../../scoring/service.js";
import { resolveWeeklyReviewSubmissionWindow } from "../submission-window.js";

import {
  assertOwnedPriorityGoalReferences,
  assertReviewSubmissionWindow,
  getUserPreferences,
  listIsoDates,
  replacePriorities,
  roundToPercent,
  serializePriority,
  throwReviewAlreadySubmitted,
} from "./review-helpers.js";
import type {
  ExistingWeeklyReview,
  ReviewFrictionTag,
  SubmitWeeklyReviewRequest,
  WeeklyReviewResponse,
} from "./review-types.js";

export async function getWeeklyReviewModel(
  prisma: PrismaClient,
  userId: string,
  startDate: Date,
): Promise<WeeklyReviewResponse> {
  const startIsoDate = toIsoDateString(startDate);
  const cycle = await ensureCycle(prisma, {
    userId,
    cycleType: "WEEK",
    cycleStartDate: startDate,
    cycleEndDate: getWeekEndDate(startDate),
  });
  const nextWeekStart = addDays(startDate, 7);
  const preferences = await prisma.userPreference?.findUnique?.({
    where: {
      userId,
    },
  });
  const timezone = normalizeTimezone(preferences?.timezone);
  const waterTargetMl = preferences?.dailyWaterTargetMl ?? 2500;
  const effectiveEndDate = cycle.cycleEndDate;
  const effectiveEndIsoDate = toIsoDateString(effectiveEndDate);
  const submissionWindow = resolveWeeklyReviewSubmissionWindow(startIsoDate, new Date(), preferences);
  const rangeWindow = getDateRangeWindowUtc(startIsoDate, effectiveEndIsoDate, timezone);
  const scopedIsoDates = listIsoDates(startIsoDate, effectiveEndIsoDate);
  const [scores, habits, routineCheckins, routines, workoutDays, waterLogs, mealLogs, expenses, dailyReviews, nextWeekCycle] =
    await Promise.all([
      prisma.dailyScore.findMany({
        where: {
          userId,
          finalizedAt: {
            not: null,
          },
          planningCycle: {
            cycleStartDate: {
              gte: startDate,
              lte: effectiveEndDate,
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
                gte: startDate,
                lte: effectiveEndDate,
              },
            },
          },
        },
      }),
      prisma.routineItemCheckin.findMany({
        where: {
          occurredOn: {
            gte: startDate,
            lte: effectiveEndDate,
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
      prisma.workoutDay.findMany({
        where: {
          userId,
          date: {
            gte: startDate,
            lte: effectiveEndDate,
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
      prisma.mealLog.findMany({
        where: {
          userId,
          occurredAt: {
            gte: rangeWindow.start,
            lt: rangeWindow.end,
          },
        },
      }),
      prisma.expense.findMany({
        where: {
          userId,
          spentOn: {
            gte: startDate,
            lte: effectiveEndDate,
          },
        },
        include: {
          expenseCategory: true,
        },
      }),
      prisma.dailyReview.findMany({
        where: {
          userId,
          planningCycle: {
            cycleStartDate: {
              gte: startDate,
              lte: effectiveEndDate,
            },
          },
        },
      }),
      prisma.planningCycle.findUnique({
        where: {
          userId_cycleType_cycleStartDate: {
            userId,
            cycleType: "WEEK",
            cycleStartDate: nextWeekStart,
          },
        },
      include: {
        priorities: {
          orderBy: {
            slot: "asc",
          },
          include: {
            goal: {
              include: {
                domain: true,
              },
            },
          },
        },
      },
    }),
    ]);

  const existingReview: ExistingWeeklyReview | null = cycle.weeklyReview
    ? {
        biggestWin: cycle.weeklyReview.biggestWin,
        biggestMiss: cycle.weeklyReview.biggestMiss,
        mainLesson: cycle.weeklyReview.mainLesson,
        keepText: cycle.weeklyReview.keepText,
        improveText: cycle.weeklyReview.improveText,
        focusHabitId: cycle.weeklyReview.focusHabitId,
        healthTargetText: cycle.weeklyReview.healthTargetText,
        spendingWatchCategoryId: cycle.weeklyReview.spendingWatchCategoryId,
        notes: cycle.weeklyReview.notes,
        completedAt: cycle.weeklyReview.completedAt.toISOString(),
      }
    : null;
  const capacityProfile = resolveWeeklyCapacityProfile({
    weeklyCapacityMode: cycle.weeklyCapacityMode,
    weeklyDeepWorkBlockTarget: cycle.weeklyDeepWorkBlockTarget,
  });
  const completedDeepBlocks = await countCompletedDeepBlocksForWeek(prisma as any, {
    userId,
    startDate: startIsoDate,
    endDate: effectiveEndIsoDate,
    timezone,
  });
  const capacityProgress = computeWeeklyCapacityProgress({
    capacityProfile,
    completedDeepBlocks,
  });

  const averageDailyScore =
    scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score.scoreValue, 0) / scores.length) : 0;
  const topSpendCategory = expenses.reduce<Record<string, number>>((acc, expense) => {
    const category = expense.expenseCategory?.name ?? "Uncategorized";
    acc[category] = (acc[category] ?? 0) + expense.amountMinor;
    return acc;
  }, {});
  const topSpendEntry = Object.entries(topSpendCategory).sort((a, b) => b[1] - a[1])[0];
  const frictionCounts = dailyReviews.reduce<Record<string, number>>((acc, review) => {
    acc[review.frictionTag] = (acc[review.frictionTag] ?? 0) + 1;
    return acc;
  }, {});
  const requiredRoutineItemIds = new Set(routines.filter((item) => item.isRequired).map((item) => item.id));
  const habitTotals = habits.reduce(
    (totals, habit) => {
      const scheduleRule = resolveHabitRecurrence(habit, startIsoDate);

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

  return {
    startDate: startIsoDate,
    endDate: toIsoDateString(cycle.cycleEndDate),
    summary: {
      averageDailyScore,
      strongDayCount: scores.filter((score) => score.scoreValue >= 85).length,
      habitCompletionRate:
        habitTotals.due > 0 ? roundToPercent(habitTotals.completed / habitTotals.due) : 0,
      routineCompletionRate:
        requiredRoutineItemIds.size > 0
          ? roundToPercent(
              routineCheckins.filter((checkin) => requiredRoutineItemIds.has(checkin.routineItemId)).length /
                (requiredRoutineItemIds.size * scopedIsoDates.length),
            )
          : 0,
      workoutsCompleted: workoutDays.filter((day) => day.actualStatus === "COMPLETED").length,
      workoutsPlanned: workoutDays.filter((day) => day.planType === "WORKOUT").length,
      waterTargetHitCount: countWaterTargetHits(waterLogs, timezone, waterTargetMl),
      mealsLoggedCount: mealLogs.length,
      spendingTotal: expenses.reduce((sum, expense) => sum + expense.amountMinor, 0),
      topSpendCategory: topSpendEntry?.[0] ?? null,
      topFrictionTags: Object.entries(frictionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([tag, count]) => ({ tag: tag as ReviewFrictionTag, count })),
    },
    existingReview,
    seededNextWeekPriorities: nextWeekCycle?.priorities.map(serializePriority) ?? [],
    capacitySummary: {
      capacityMode: capacityProfile.capacityMode,
      plannedDeepWorkBlocks: capacityProfile.deepWorkBlockTarget,
      completedDeepBlocks: capacityProgress.completedDeepBlocks,
      overBudgetBlocks: capacityProgress.overBudgetBlocks,
      status: capacityProgress.status,
      message: capacityProgress.message,
    },
    submissionWindow,
    generatedAt: new Date().toISOString(),
  };
}

export async function submitWeeklyReview(
  prisma: PrismaClient,
  userId: string,
  startDate: Date,
  payload: SubmitWeeklyReviewRequest,
) {
  const cycle = await ensureCycle(prisma, {
    userId,
    cycleType: "WEEK",
    cycleStartDate: startDate,
    cycleEndDate: getWeekEndDate(startDate),
  });

  if (cycle.weeklyReview) {
    throwReviewAlreadySubmitted("Weekly review");
  }

  const preferences = await getUserPreferences(prisma, userId);
  assertReviewSubmissionWindow(
    "Weekly review",
    resolveWeeklyReviewSubmissionWindow(toIsoDateString(startDate), new Date(), preferences),
  );
  const nextWeekStart = addDays(startDate, 7);
  const nextWeekCycle = await ensureCycle(prisma, {
    userId,
    cycleType: "WEEK",
    cycleStartDate: nextWeekStart,
    cycleEndDate: getWeekEndDate(nextWeekStart),
  });
  await assertOwnedPriorityGoalReferences(prisma, userId, payload.nextWeekPriorities);
  const completedAt = new Date();

  await prisma.weeklyReview.create({
    data: {
      userId,
      planningCycleId: cycle.id,
      biggestWin: payload.biggestWin,
      biggestMiss: payload.biggestMiss,
      mainLesson: payload.mainLesson,
      keepText: payload.keepText,
      improveText: payload.improveText,
      focusHabitId: payload.focusHabitId ?? null,
      healthTargetText: payload.healthTargetText ?? null,
      spendingWatchCategoryId: payload.spendingWatchCategoryId ?? null,
      notes: payload.notes ?? null,
      completedAt,
    },
  });

  const nextWeekPriorities = await replacePriorities(prisma, nextWeekCycle.id, payload.nextWeekPriorities, "WEEKLY");

  return {
    reviewCompletedAt: completedAt.toISOString(),
    nextWeekPriorities,
    generatedAt: new Date().toISOString(),
  };
}
