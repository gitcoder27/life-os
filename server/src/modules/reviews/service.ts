import type { Prisma, PrismaClient } from "@prisma/client";

import { addDays, getMonthEndDate, getWeekEndDate, parseIsoDate } from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import { calculateDailyScore, ensureCycle, finalizeDailyScore, getWeeklyMomentum } from "../scoring/service.js";

type ReviewFrictionTag =
  | "low energy"
  | "poor planning"
  | "distraction"
  | "interruptions"
  | "overcommitment"
  | "avoidance"
  | "unclear task"
  | "travel or schedule disruption";

interface PlanningPriorityInput {
  slot: 1 | 2 | 3;
  title: string;
  goalId?: string | null;
}

interface ReviewTaskDecision {
  taskId: string;
  targetDate: string;
}

interface SubmitDailyReviewRequest {
  biggestWin: string;
  frictionTag: ReviewFrictionTag;
  frictionNote?: string | null;
  energyRating: number;
  optionalNote?: string | null;
  carryForwardTaskIds: string[];
  droppedTaskIds: string[];
  rescheduledTasks: ReviewTaskDecision[];
  tomorrowPriorities: PlanningPriorityInput[];
}

interface SubmitWeeklyReviewRequest {
  biggestWin: string;
  biggestMiss: string;
  mainLesson: string;
  keepText: string;
  improveText: string;
  nextWeekPriorities: PlanningPriorityInput[];
  focusHabitId?: string | null;
  healthTargetText?: string | null;
  spendingWatchCategoryId?: string | null;
  notes?: string | null;
}

interface SubmitMonthlyReviewRequest {
  monthVerdict: string;
  biggestWin: string;
  biggestLeak: string;
  ratings: Record<string, number>;
  nextMonthTheme: string;
  threeOutcomes: string[];
  habitChanges: string[];
  simplifyText: string;
  notes?: string | null;
}

interface DailyReviewSummary {
  prioritiesCompleted: number;
  prioritiesTotal: number;
  tasksCompleted: number;
  tasksScheduled: number;
  routinesCompleted: number;
  routinesTotal: number;
  habitsCompleted: number;
  habitsDue: number;
  waterMl: number;
  waterTargetMl: number;
  mealsLogged: number;
  workoutStatus: "completed" | "recovery_respected" | "fallback" | "missed" | "none";
  expensesLogged: number;
}

interface PlanningTaskItem {
  id: string;
  title: string;
  notes: string | null;
  status: "pending" | "completed" | "dropped";
  scheduledForDate: string | null;
  dueAt: string | null;
  goalId: string | null;
  originType: "manual" | "quick_capture" | "carry_forward" | "review_seed" | "recurring";
  carriedFromTaskId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ExistingDailyReview {
  biggestWin: string;
  frictionTag: ReviewFrictionTag;
  frictionNote: string | null;
  energyRating: number;
  optionalNote: string | null;
  completedAt: string;
}

interface ExistingWeeklyReview {
  biggestWin: string;
  biggestMiss: string;
  mainLesson: string;
  keepText: string;
  improveText: string;
  focusHabitId: string | null;
  healthTargetText: string | null;
  spendingWatchCategoryId: string | null;
  notes: string | null;
  completedAt: string;
}

interface ExistingMonthlyReview {
  monthVerdict: string;
  biggestWin: string;
  biggestLeak: string;
  ratings: Record<string, number>;
  nextMonthTheme: string;
  threeOutcomes: string[];
  habitChanges: string[];
  simplifyText: string;
  notes: string | null;
  completedAt: string;
}

interface DailyReviewResponse {
  date: string;
  summary: DailyReviewSummary;
  score: Awaited<ReturnType<typeof calculateDailyScore>>;
  incompleteTasks: PlanningTaskItem[];
  existingReview: ExistingDailyReview | null;
  generatedAt: string;
}

interface WeeklyReviewResponse {
  startDate: string;
  endDate: string;
  summary: {
    averageDailyScore: number;
    strongDayCount: number;
    habitCompletionRate: number;
    routineCompletionRate: number;
    workoutsCompleted: number;
    workoutsPlanned: number;
    waterTargetHitCount: number;
    mealsLoggedCount: number;
    spendingTotal: number;
    topSpendCategory: string | null;
    topFrictionTags: Array<{ tag: ReviewFrictionTag; count: number }>;
  };
  existingReview: ExistingWeeklyReview | null;
  generatedAt: string;
}

interface MonthlyReviewResponse {
  startDate: string;
  endDate: string;
  summary: {
    averageWeeklyMomentum: number;
    bestScore: number | null;
    worstScore: number | null;
    workoutCount: number;
    waterSuccessRate: number;
    spendingByCategory: Array<{ category: string; amountMinor: number }>;
    topHabits: Array<{ habitId: string; title: string; completionRate: number }>;
    commonFrictionTags: Array<{ tag: ReviewFrictionTag; count: number }>;
  };
  existingReview: ExistingMonthlyReview | null;
  generatedAt: string;
}

const FRICTION_TAGS = [
  "low energy",
  "poor planning",
  "distraction",
  "interruptions",
  "overcommitment",
  "avoidance",
  "unclear task",
  "travel or schedule disruption",
] as const satisfies readonly ReviewFrictionTag[];

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function getDailySummary(prisma: PrismaClient, userId: string, date: Date) {
  const [cycle, tasks, routines, routineCheckins, habits, habitCheckins, waterLogs, mealLogs, workoutDay, expenses, preferences] =
    await Promise.all([
      ensureCycle(prisma, {
        userId,
        cycleType: "DAY",
        cycleStartDate: date,
        cycleEndDate: date,
      }),
      prisma.task.findMany({
        where: {
          userId,
          scheduledForDate: date,
        },
      }),
      prisma.routine.findMany({
        where: {
          userId,
          status: "ACTIVE",
        },
        include: {
          items: true,
        },
      }),
      prisma.routineItemCheckin.findMany({
        where: {
          occurredOn: date,
          routineItem: {
            routine: {
              userId,
            },
          },
        },
      }),
      prisma.habit.findMany({
        where: {
          userId,
          status: "ACTIVE",
          archivedAt: null,
        },
      }),
      prisma.habitCheckin.findMany({
        where: {
          occurredOn: date,
          habit: {
            userId,
          },
        },
      }),
      prisma.waterLog.findMany({
        where: {
          userId,
          occurredAt: {
            gte: date,
            lt: addDays(date, 1),
          },
        },
      }),
      prisma.mealLog.findMany({
        where: {
          userId,
          occurredAt: {
            gte: date,
            lt: addDays(date, 1),
          },
        },
      }),
      prisma.workoutDay.findUnique({
        where: {
          userId_date: {
            userId,
            date,
          },
        },
      }),
      prisma.expense.findMany({
        where: {
          userId,
          spentOn: {
            gte: date,
            lt: addDays(date, 1),
          },
        },
      }),
      prisma.userPreference.findUnique({
        where: {
          userId,
        },
      }),
    ]);

  const routinesTotal = routines.reduce((sum, routine) => sum + routine.items.length, 0);
  const routinesCompleted = routineCheckins.length;
  const workoutStatus: DailyReviewSummary["workoutStatus"] =
    workoutDay?.actualStatus === "COMPLETED"
      ? "completed"
      : workoutDay?.actualStatus === "RECOVERY_RESPECTED"
        ? "recovery_respected"
        : workoutDay?.actualStatus === "FALLBACK"
          ? "fallback"
          : workoutDay?.actualStatus === "MISSED"
            ? "missed"
            : "none";

  return {
    cycle,
    summary: {
      prioritiesCompleted: cycle.priorities.filter((priority) => priority.status === "COMPLETED").length,
      prioritiesTotal: cycle.priorities.length,
      tasksCompleted: tasks.filter((task) => task.status === "COMPLETED").length,
      tasksScheduled: tasks.length,
      routinesCompleted,
      routinesTotal,
      habitsCompleted: habitCheckins.filter((checkin) => checkin.status === "COMPLETED").length,
      habitsDue: habits.length,
      waterMl: waterLogs.reduce((sum, log) => sum + log.amountMl, 0),
      waterTargetMl: preferences?.dailyWaterTargetMl ?? 2500,
      mealsLogged: mealLogs.length,
      workoutStatus,
      expensesLogged: expenses.length,
    },
    incompleteTasks: tasks
      .filter((task) => task.status !== "COMPLETED")
      .map((task): PlanningTaskItem => ({
        id: task.id,
        title: task.title,
        notes: task.notes,
        status:
          task.status === "DROPPED" ? "dropped" : task.status === "COMPLETED" ? "completed" : "pending",
        scheduledForDate: task.scheduledForDate ? toIsoDateString(task.scheduledForDate) : null,
        dueAt: task.dueAt?.toISOString() ?? null,
        goalId: task.goalId,
        originType:
          task.originType === "QUICK_CAPTURE"
            ? "quick_capture"
            : task.originType === "CARRY_FORWARD"
              ? "carry_forward"
              : task.originType === "REVIEW_SEED"
                ? "review_seed"
                : task.originType === "RECURRING"
                  ? "recurring"
                  : "manual",
        carriedFromTaskId: task.carriedFromTaskId,
        completedAt: task.completedAt?.toISOString() ?? null,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      })),
  };
}

export async function getDailyReviewModel(
  prisma: PrismaClient,
  userId: string,
  date: Date,
): Promise<DailyReviewResponse> {
  const [{ cycle, summary, incompleteTasks }, score] = await Promise.all([
    getDailySummary(prisma, userId, date),
    calculateDailyScore(prisma, userId, date),
  ]);

  const existingReview: ExistingDailyReview | null = cycle.dailyReview
    ? {
        biggestWin: cycle.dailyReview.biggestWin,
        frictionTag: cycle.dailyReview.frictionTag as ReviewFrictionTag,
        frictionNote: cycle.dailyReview.frictionNote,
        energyRating: cycle.dailyReview.energyRating,
        optionalNote: cycle.dailyReview.optionalNote,
        completedAt: cycle.dailyReview.completedAt.toISOString(),
      }
    : null;

  return {
    date: toIsoDateString(date),
    summary,
    score,
    incompleteTasks,
    existingReview,
    generatedAt: new Date().toISOString(),
  };
}

function dedupeTaskIds(payload: SubmitDailyReviewRequest) {
  const seen = new Set<string>();

  for (const taskId of [...payload.carryForwardTaskIds, ...payload.droppedTaskIds, ...payload.rescheduledTasks.map((task) => task.taskId)]) {
    if (seen.has(taskId)) {
      throw new Error(`Task ${taskId} appears in more than one review decision`);
    }
    seen.add(taskId);
  }
}

async function replacePriorities(
  prisma: PrismaClient | Prisma.TransactionClient,
  planningCycleId: string,
  priorities:
    | SubmitDailyReviewRequest["tomorrowPriorities"]
    | SubmitWeeklyReviewRequest["nextWeekPriorities"]
    | Array<{ slot: 1 | 2 | 3; title: string; goalId?: string | null }>,
  sourceReviewType: "DAILY" | "WEEKLY" | "MONTHLY",
) {
  await prisma.cyclePriority.deleteMany({
    where: {
      planningCycleId,
    },
  });

  if (priorities.length > 0) {
    await prisma.cyclePriority.createMany({
      data: priorities.map((priority: (typeof priorities)[number]) => ({
        planningCycleId,
        slot: priority.slot,
        title: priority.title,
        goalId: priority.goalId ?? null,
        sourceReviewType,
      })),
    });
  }

  const refreshed = await prisma.cyclePriority.findMany({
    where: {
      planningCycleId,
    },
    orderBy: {
      slot: "asc",
    },
  });

  return refreshed.map((priority: (typeof refreshed)[number]) => ({
    id: priority.id,
    slot: priority.slot as 1 | 2 | 3,
    title: priority.title,
    status: priority.status === "COMPLETED" ? "completed" : priority.status === "DROPPED" ? "dropped" : "pending",
    goalId: priority.goalId,
    completedAt: priority.completedAt?.toISOString() ?? null,
  }));
}

export async function submitDailyReview(
  prisma: PrismaClient,
  userId: string,
  date: Date,
  payload: SubmitDailyReviewRequest,
) {
  dedupeTaskIds(payload);
  const cycle = await ensureCycle(prisma, {
    userId,
    cycleType: "DAY",
    cycleStartDate: date,
    cycleEndDate: date,
  });
  const tomorrowDate = addDays(date, 1);
  const tomorrowCycle = await ensureCycle(prisma, {
    userId,
    cycleType: "DAY",
    cycleStartDate: tomorrowDate,
    cycleEndDate: tomorrowDate,
  });
  const completedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.dailyReview.upsert({
      where: {
        planningCycleId: cycle.id,
      },
      update: {
        biggestWin: payload.biggestWin,
        frictionTag: payload.frictionTag,
        frictionNote: payload.frictionNote ?? null,
        energyRating: payload.energyRating,
        optionalNote: payload.optionalNote ?? null,
        completedAt,
      },
      create: {
        userId,
        planningCycleId: cycle.id,
        biggestWin: payload.biggestWin,
        frictionTag: payload.frictionTag,
        frictionNote: payload.frictionNote ?? null,
        energyRating: payload.energyRating,
        optionalNote: payload.optionalNote ?? null,
        completedAt,
      },
    });

    await replacePriorities(tx, tomorrowCycle.id, payload.tomorrowPriorities, "DAILY");

    for (const taskId of payload.droppedTaskIds) {
      await tx.task.update({
        where: {
          id: taskId,
        },
        data: {
          status: "DROPPED",
        },
      });
    }

    for (const taskId of payload.carryForwardTaskIds) {
      const task = await tx.task.findUniqueOrThrow({
        where: {
          id: taskId,
        },
      });

      await tx.task.update({
        where: {
          id: taskId,
        },
        data: {
          status: "DROPPED",
        },
      });

      await tx.task.create({
        data: {
          userId,
          title: task.title,
          notes: task.notes,
          scheduledForDate: tomorrowDate,
          dueAt: task.dueAt,
          goalId: task.goalId,
          originType: "CARRY_FORWARD",
          carriedFromTaskId: task.id,
        },
      });
    }

    for (const rescheduledTask of payload.rescheduledTasks) {
      const task = await tx.task.findUniqueOrThrow({
        where: {
          id: rescheduledTask.taskId,
        },
      });
      const targetDate = parseIsoDate(
        rescheduledTask.targetDate as `${number}-${number}-${number}`,
      );

      await tx.task.update({
        where: {
          id: task.id,
        },
        data: {
          status: "DROPPED",
        },
      });

      await tx.task.create({
        data: {
          userId,
          title: task.title,
          notes: task.notes,
          scheduledForDate: targetDate,
          dueAt: task.dueAt,
          goalId: task.goalId,
          originType: "CARRY_FORWARD",
          carriedFromTaskId: task.id,
        },
      });
    }
  });

  const finalizedScore = await finalizeDailyScore(prisma, userId, date);
  const tomorrowPriorities = await replacePriorities(prisma, tomorrowCycle.id, payload.tomorrowPriorities, "DAILY");

  return {
    reviewCompletedAt: completedAt.toISOString(),
    score: finalizedScore,
    tomorrowPriorities,
    generatedAt: new Date().toISOString(),
  };
}

export async function getWeeklyReviewModel(
  prisma: PrismaClient,
  userId: string,
  startDate: Date,
): Promise<WeeklyReviewResponse> {
  const cycle = await ensureCycle(prisma, {
    userId,
    cycleType: "WEEK",
    cycleStartDate: startDate,
    cycleEndDate: getWeekEndDate(startDate),
  });
  const [scores, habits, routineCheckins, routines, workoutDays, waterLogs, mealLogs, expenses, dailyReviews] =
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
              lte: cycle.cycleEndDate,
            },
          },
        },
        include: {
          planningCycle: true,
        },
      }),
      prisma.habitCheckin.findMany({
        where: {
          habit: {
            userId,
          },
          occurredOn: {
            gte: startDate,
            lte: cycle.cycleEndDate,
          },
        },
      }),
      prisma.routineItemCheckin.findMany({
        where: {
          occurredOn: {
            gte: startDate,
            lte: cycle.cycleEndDate,
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
            lte: cycle.cycleEndDate,
          },
        },
      }),
      prisma.waterLog.findMany({
        where: {
          userId,
          occurredAt: {
            gte: startDate,
            lt: addDays(cycle.cycleEndDate, 1),
          },
        },
      }),
      prisma.mealLog.findMany({
        where: {
          userId,
          occurredAt: {
            gte: startDate,
            lt: addDays(cycle.cycleEndDate, 1),
          },
        },
      }),
      prisma.expense.findMany({
        where: {
          userId,
          spentOn: {
            gte: startDate,
            lte: cycle.cycleEndDate,
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
              lte: cycle.cycleEndDate,
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

  const averageDailyScore =
    scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score.scoreValue, 0) / scores.length) : 0;
  const topSpendCategory = expenses
    .reduce<Record<string, number>>((acc, expense) => {
      const category = expense.expenseCategory?.name ?? "Uncategorized";
      acc[category] = (acc[category] ?? 0) + expense.amountMinor;
      return acc;
    }, {});
  const topSpendEntry = Object.entries(topSpendCategory).sort((a, b) => b[1] - a[1])[0];
  const frictionCounts = dailyReviews.reduce<Record<string, number>>((acc, review) => {
    acc[review.frictionTag] = (acc[review.frictionTag] ?? 0) + 1;
    return acc;
  }, {});

  return {
    startDate: toIsoDateString(startDate),
    endDate: toIsoDateString(cycle.cycleEndDate),
    summary: {
      averageDailyScore,
      strongDayCount: scores.filter((score) => score.scoreValue >= 70).length,
      habitCompletionRate: habits.length > 0 ? roundToPercent(habits.filter((checkin) => checkin.status === "COMPLETED").length / habits.length) : 0,
      routineCompletionRate: routines.length > 0 ? roundToPercent(routineCheckins.length / routines.length) : 0,
      workoutsCompleted: workoutDays.filter((day) => day.actualStatus === "COMPLETED").length,
      workoutsPlanned: workoutDays.filter((day) => day.planType === "WORKOUT").length,
      waterTargetHitCount: 0,
      mealsLoggedCount: mealLogs.length,
      spendingTotal: expenses.reduce((sum, expense) => sum + expense.amountMinor, 0),
      topSpendCategory: topSpendEntry?.[0] ?? null,
      topFrictionTags: Object.entries(frictionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([tag, count]) => ({ tag: tag as ReviewFrictionTag, count })),
    },
    existingReview,
    generatedAt: new Date().toISOString(),
  };
}

function roundToPercent(value: number) {
  return Math.round(value * 100);
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
  const nextWeekStart = addDays(startDate, 7);
  const nextWeekCycle = await ensureCycle(prisma, {
    userId,
    cycleType: "WEEK",
    cycleStartDate: nextWeekStart,
    cycleEndDate: getWeekEndDate(nextWeekStart),
  });
  const completedAt = new Date();

  await prisma.weeklyReview.upsert({
    where: {
      planningCycleId: cycle.id,
    },
    update: {
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
    create: {
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

export async function getMonthlyReviewModel(
  prisma: PrismaClient,
  userId: string,
  startDate: Date,
): Promise<MonthlyReviewResponse> {
  const cycle = await ensureCycle(prisma, {
    userId,
    cycleType: "MONTH",
    cycleStartDate: startDate,
    cycleEndDate: getMonthEndDate(startDate),
  });
  const [scores, habits, workoutDays, waterLogs, expenses, dailyReviews] = await Promise.all([
    prisma.dailyScore.findMany({
      where: {
        userId,
        finalizedAt: {
          not: null,
        },
        planningCycle: {
          cycleStartDate: {
            gte: startDate,
            lte: cycle.cycleEndDate,
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
        checkins: {
          where: {
            occurredOn: {
              gte: startDate,
              lte: cycle.cycleEndDate,
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
          lte: cycle.cycleEndDate,
        },
      },
    }),
    prisma.waterLog.findMany({
      where: {
        userId,
        occurredAt: {
          gte: startDate,
          lt: addDays(cycle.cycleEndDate, 1),
        },
      },
    }),
    prisma.expense.findMany({
      where: {
        userId,
        spentOn: {
          gte: startDate,
          lte: cycle.cycleEndDate,
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
            lte: cycle.cycleEndDate,
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

  const existingReview: ExistingMonthlyReview | null = cycle.monthlyReview
    ? {
        monthVerdict: cycle.monthlyReview.monthVerdict,
        biggestWin: cycle.monthlyReview.biggestWin,
        biggestLeak: cycle.monthlyReview.biggestLeak,
        ratings: cycle.monthlyReview.ratingsJson as Record<string, number>,
        nextMonthTheme: cycle.monthlyReview.nextMonthTheme,
        threeOutcomes: cycle.monthlyReview.threeOutcomesJson as string[],
        habitChanges: cycle.monthlyReview.habitChangesJson as string[],
        simplifyText: cycle.monthlyReview.simplifyText,
        notes: cycle.monthlyReview.notes,
        completedAt: cycle.monthlyReview.completedAt.toISOString(),
      }
    : null;

  const weeklyMomentum = await getWeeklyMomentum(prisma, userId, cycle.cycleEndDate);

  return {
    startDate: toIsoDateString(startDate),
    endDate: toIsoDateString(cycle.cycleEndDate),
    summary: {
      averageWeeklyMomentum: weeklyMomentum.value,
      bestScore: scores.length > 0 ? Math.max(...scores.map((score) => score.scoreValue)) : null,
      worstScore: scores.length > 0 ? Math.min(...scores.map((score) => score.scoreValue)) : null,
      workoutCount: workoutDays.filter((day) => day.actualStatus === "COMPLETED").length,
      waterSuccessRate: scores.length > 0 ? roundToPercent(Math.min(1, waterLogs.length / scores.length)) : 0,
      spendingByCategory: Object.entries(spendingByCategory).map(([category, amountMinor]) => ({
        category,
        amountMinor,
      })),
      topHabits: habits
        .map((habit) => ({
          habitId: habit.id,
          title: habit.title,
          completionRate: habit.checkins.length > 0 ? roundToPercent(habit.checkins.filter((checkin) => checkin.status === "COMPLETED").length / habit.checkins.length) : 0,
        }))
        .sort((a, b) => b.completionRate - a.completionRate)
        .slice(0, 3),
      commonFrictionTags: Object.entries(frictionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([tag, count]) => ({ tag: tag as ReviewFrictionTag, count })),
    },
    existingReview,
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
  const nextMonthStart = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 1));
  const nextMonthCycle = await ensureCycle(prisma, {
    userId,
    cycleType: "MONTH",
    cycleStartDate: nextMonthStart,
    cycleEndDate: getMonthEndDate(nextMonthStart),
  });
  const completedAt = new Date();

  await prisma.monthlyReview.upsert({
    where: {
      planningCycleId: cycle.id,
    },
    update: {
      monthVerdict: payload.monthVerdict,
      biggestWin: payload.biggestWin,
      biggestLeak: payload.biggestLeak,
      ratingsJson: toJson(payload.ratings),
      nextMonthTheme: payload.nextMonthTheme,
      threeOutcomesJson: toJson(payload.threeOutcomes),
      habitChangesJson: toJson(payload.habitChanges),
      simplifyText: payload.simplifyText,
      notes: payload.notes ?? null,
      completedAt,
    },
    create: {
      userId,
      planningCycleId: cycle.id,
      monthVerdict: payload.monthVerdict,
      biggestWin: payload.biggestWin,
      biggestLeak: payload.biggestLeak,
      ratingsJson: toJson(payload.ratings),
      nextMonthTheme: payload.nextMonthTheme,
      threeOutcomesJson: toJson(payload.threeOutcomes),
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
    payload.threeOutcomes.map((title: string, index: number) => ({
      slot: (index + 1) as 1 | 2 | 3,
      title,
      goalId: null,
    })),
    "MONTHLY",
  );

  return {
    reviewCompletedAt: completedAt.toISOString(),
    nextMonthTheme: payload.nextMonthTheme,
    nextMonthOutcomes,
    generatedAt: new Date().toISOString(),
  };
}
