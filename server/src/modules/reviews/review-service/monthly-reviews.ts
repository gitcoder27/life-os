import type { PrismaClient } from "@prisma/client";

import { getHabitCompletionCountForIsoDate, isHabitDueOnIsoDate, resolveHabitRecurrence } from "../../../lib/habits/schedule.js";
import { countWaterTargetHits } from "../../../lib/health/water.js";
import { getMonthEndDate } from "../../../lib/time/cycle.js";
import { toIsoDateString } from "../../../lib/time/date.js";
import { getDateRangeWindowUtc, normalizeTimezone } from "../../../lib/time/user-time.js";
import { ensureCycle, getWeeklyMomentum } from "../../scoring/service.js";
import { resolveMonthlyReviewSubmissionWindow } from "../submission-window.js";

import {
  assertOwnedPriorityGoalReferences,
  assertReviewSubmissionWindow,
  getUserPreferences,
  listIsoDates,
  replacePriorities,
  roundToPercent,
  serializePriority,
  throwReviewAlreadySubmitted,
  toJson,
} from "./review-helpers.js";
import type {
  ExistingMonthlyReview,
  ReviewFrictionTag,
  SubmitMonthlyReviewRequest,
  MonthlyReviewResponse,
} from "./review-types.js";

export async function getMonthlyReviewModel(
  prisma: PrismaClient,
  userId: string,
  startDate: Date,
): Promise<MonthlyReviewResponse> {
  const startIsoDate = toIsoDateString(startDate);
  const cycle = await ensureCycle(prisma, {
    userId,
    cycleType: "MONTH",
    cycleStartDate: startDate,
    cycleEndDate: getMonthEndDate(startDate),
  });
  const nextMonthStart = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 1));
  const preferences = await prisma.userPreference?.findUnique?.({
    where: {
      userId,
    },
  });
  const timezone = normalizeTimezone(preferences?.timezone);
  const waterTargetMl = preferences?.dailyWaterTargetMl ?? 2500;
  const effectiveEndDate = cycle.cycleEndDate;
  const effectiveEndIsoDate = toIsoDateString(effectiveEndDate);
  const submissionWindow = resolveMonthlyReviewSubmissionWindow(startIsoDate, new Date(), preferences);
  const rangeWindow = getDateRangeWindowUtc(startIsoDate, effectiveEndIsoDate, timezone);
  const scopedIsoDates = listIsoDates(startIsoDate, effectiveEndIsoDate);
  const [scores, habits, workoutDays, waterLogs, expenses, dailyReviews, nextMonthCycle] = await Promise.all([
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
          cycleType: "MONTH",
          cycleStartDate: nextMonthStart,
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

  const spendingByCategory = expenses.reduce<Record<string, number>>((acc, expense) => {
    const category = expense.expenseCategory?.name ?? "Uncategorized";
    acc[category] = (acc[category] ?? 0) + expense.amountMinor;
    return acc;
  }, {});
  const frictionCounts = dailyReviews.reduce<Record<string, number>>((acc, review) => {
    acc[review.frictionTag] = (acc[review.frictionTag] ?? 0) + 1;
    return acc;
  }, {});
  const waterTargetHitCount = countWaterTargetHits(waterLogs, timezone, waterTargetMl);
  const topHabits = habits
    .map((habit) => {
      const scheduleRule = resolveHabitRecurrence(habit, startIsoDate);
      const dueCount = scopedIsoDates.reduce(
        (sum, isoDate) =>
          sum + (isHabitDueOnIsoDate(scheduleRule, isoDate, habit.pauseWindows) ? habit.targetPerDay : 0),
        0,
      );
      const completedCount = scopedIsoDates.reduce(
        (sum, isoDate) =>
          sum +
          (isHabitDueOnIsoDate(scheduleRule, isoDate, habit.pauseWindows)
            ? Math.min(getHabitCompletionCountForIsoDate(habit.checkins, isoDate), habit.targetPerDay)
            : 0),
        0,
      );

      return {
        habitId: habit.id,
        title: habit.title,
        completionRate: dueCount > 0 ? roundToPercent(completedCount / dueCount) : 0,
      };
    })
    .sort((a, b) => b.completionRate - a.completionRate)
    .slice(0, 3);

  const storedNextMonthOutcomes = Array.isArray(cycle.monthlyReview?.threeOutcomesJson)
    ? cycle.monthlyReview!.threeOutcomesJson
        .map((value, index) => {
          if (typeof value === "string") {
            return {
              id: `legacy-outcome-${index + 1}`,
              slot: (index + 1) as 1 | 2 | 3,
              title: value,
              status: "pending" as const,
              goalId: null,
              goal: null,
              completedAt: null,
            };
          }

          if (
            value &&
            typeof value === "object" &&
            "slot" in value &&
            "title" in value &&
            typeof value.slot === "number" &&
            typeof value.title === "string"
          ) {
            return {
              id: "id" in value && typeof value.id === "string" ? value.id : `stored-outcome-${index + 1}`,
              slot: value.slot as 1 | 2 | 3,
              title: value.title,
              status:
                "status" in value && (value.status === "completed" || value.status === "dropped")
                  ? value.status
                  : "pending",
              goalId: "goalId" in value && typeof value.goalId === "string" ? value.goalId : null,
              goal:
                "goal" in value && value.goal && typeof value.goal === "object"
                  ? (value.goal as unknown as MonthlyReviewResponse["seededNextMonthOutcomes"][number]["goal"])
                  : null,
              completedAt:
                "completedAt" in value && typeof value.completedAt === "string" ? value.completedAt : null,
            };
          }

          return null;
        })
        .filter((value): value is MonthlyReviewResponse["seededNextMonthOutcomes"][number] => Boolean(value))
    : [];

  const existingReview: ExistingMonthlyReview | null = cycle.monthlyReview
    ? {
        monthVerdict: cycle.monthlyReview.monthVerdict,
        biggestWin: cycle.monthlyReview.biggestWin,
        biggestLeak: cycle.monthlyReview.biggestLeak,
        ratings: cycle.monthlyReview.ratingsJson as Record<string, number>,
        nextMonthTheme: cycle.monthlyReview.nextMonthTheme,
        nextMonthOutcomes: storedNextMonthOutcomes,
        habitChanges: cycle.monthlyReview.habitChangesJson as string[],
        simplifyText: cycle.monthlyReview.simplifyText,
        notes: cycle.monthlyReview.notes,
        completedAt: cycle.monthlyReview.completedAt.toISOString(),
      }
    : null;

  const weeklyMomentum = await getWeeklyMomentum(prisma, userId, cycle.cycleEndDate);

  return {
    startDate: startIsoDate,
    endDate: toIsoDateString(cycle.cycleEndDate),
    summary: {
      averageWeeklyMomentum: weeklyMomentum.value,
      bestScore: scores.length > 0 ? Math.max(...scores.map((score) => score.scoreValue)) : null,
      worstScore: scores.length > 0 ? Math.min(...scores.map((score) => score.scoreValue)) : null,
      workoutCount: workoutDays.filter((day) => day.actualStatus === "COMPLETED").length,
      waterSuccessRate:
        scopedIsoDates.length > 0 ? roundToPercent(waterTargetHitCount / scopedIsoDates.length) : 0,
      spendingByCategory: Object.entries(spendingByCategory).map(([category, amountMinor]) => ({
        category,
        amountMinor,
      })),
      topHabits,
      commonFrictionTags: Object.entries(frictionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([tag, count]) => ({ tag: tag as ReviewFrictionTag, count })),
    },
    existingReview,
    seededNextMonthTheme: nextMonthCycle?.theme ?? null,
    seededNextMonthOutcomes: nextMonthCycle?.priorities.map(serializePriority) ?? [],
    submissionWindow,
    generatedAt: new Date().toISOString(),
  };
}

export async function submitMonthlyReview(
  prisma: PrismaClient,
  userId: string,
  startDate: Date,
  payload: SubmitMonthlyReviewRequest,
) {
  const cycle = await ensureCycle(prisma, {
    userId,
    cycleType: "MONTH",
    cycleStartDate: startDate,
    cycleEndDate: getMonthEndDate(startDate),
  });

  if (cycle.monthlyReview) {
    throwReviewAlreadySubmitted("Monthly review");
  }

  const preferences = await getUserPreferences(prisma, userId);
  assertReviewSubmissionWindow(
    "Monthly review",
    resolveMonthlyReviewSubmissionWindow(toIsoDateString(startDate), new Date(), preferences),
  );
  const nextMonthStart = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 1));
  const nextMonthCycle = await ensureCycle(prisma, {
    userId,
    cycleType: "MONTH",
    cycleStartDate: nextMonthStart,
    cycleEndDate: getMonthEndDate(nextMonthStart),
  });
  await assertOwnedPriorityGoalReferences(prisma, userId, payload.nextMonthOutcomes);
  const completedAt = new Date();

  await prisma.monthlyReview.create({
    data: {
      userId,
      planningCycleId: cycle.id,
      monthVerdict: payload.monthVerdict,
      biggestWin: payload.biggestWin,
      biggestLeak: payload.biggestLeak,
      ratingsJson: toJson(payload.ratings),
      nextMonthTheme: payload.nextMonthTheme,
      threeOutcomesJson: toJson(payload.nextMonthOutcomes),
      habitChangesJson: toJson(payload.habitChanges),
      simplifyText: payload.simplifyText,
      notes: payload.notes ?? null,
      completedAt,
    },
  });

  await prisma.planningCycle.update({
    where: {
      id: nextMonthCycle.id,
    },
    data: {
      theme: payload.nextMonthTheme,
    },
  });

  const nextMonthOutcomes = await replacePriorities(
    prisma,
    nextMonthCycle.id,
    payload.nextMonthOutcomes,
    "MONTHLY",
  );

  return {
    reviewCompletedAt: completedAt.toISOString(),
    nextMonthTheme: payload.nextMonthTheme,
    nextMonthOutcomes,
    generatedAt: new Date().toISOString(),
  };
}
