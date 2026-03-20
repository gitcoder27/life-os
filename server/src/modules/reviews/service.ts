import type { ReviewSubmissionWindow } from "@life-os/contracts";
import type { Prisma, PrismaClient } from "@prisma/client";

import { AppError } from "../../lib/errors/app-error.js";
import {
  filterDueHabits,
  isHabitDueOnIsoDate,
  normalizeHabitScheduleRule,
} from "../../lib/habits/schedule.js";
import { buildWaterTotalsByLocalDate, countWaterTargetHits } from "../../lib/health/water.js";
import { addDays, addIsoDays, getMonthEndDate, getWeekEndDate, parseIsoDate } from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import { getDateRangeWindowUtc, getDayWindowUtc, normalizeTimezone } from "../../lib/time/user-time.js";
import { calculateDailyScore, ensureCycle, finalizeDailyScore, getWeeklyMomentum } from "../scoring/service.js";
import {
  resolveDailyReviewSubmissionWindow,
  resolveMonthlyReviewSubmissionWindow,
  resolveWeeklyReviewSubmissionWindow,
} from "./submission-window.js";

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
  isCompleted: boolean;
  submissionWindow: ReviewSubmissionWindow;
  seededTomorrowPriorities: Array<{
    id: string;
    slot: 1 | 2 | 3;
    title: string;
    status: "pending" | "completed" | "dropped";
    goalId: string | null;
    completedAt: string | null;
  }>;
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
  seededNextWeekPriorities: Array<{
    id: string;
    slot: 1 | 2 | 3;
    title: string;
    status: "pending" | "completed" | "dropped";
    goalId: string | null;
    completedAt: string | null;
  }>;
  submissionWindow: ReviewSubmissionWindow;
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
  seededNextMonthTheme: string | null;
  seededNextMonthOutcomes: Array<{
    id: string;
    slot: 1 | 2 | 3;
    title: string;
    status: "pending" | "completed" | "dropped";
    goalId: string | null;
    completedAt: string | null;
  }>;
  submissionWindow: ReviewSubmissionWindow;
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

function serializePriority(priority: {
  id: string;
  slot: number;
  title: string;
  status: "PENDING" | "COMPLETED" | "DROPPED";
  goalId: string | null;
  completedAt: Date | null;
}): {
  id: string;
  slot: 1 | 2 | 3;
  title: string;
  status: "pending" | "completed" | "dropped";
  goalId: string | null;
  completedAt: string | null;
} {
  return {
    id: priority.id,
    slot: priority.slot as 1 | 2 | 3,
    title: priority.title,
    status:
      priority.status === "COMPLETED"
        ? "completed"
        : priority.status === "DROPPED"
          ? "dropped"
          : "pending",
    goalId: priority.goalId,
    completedAt: priority.completedAt?.toISOString() ?? null,
  };
}

async function getUserPreferences(prisma: PrismaClient, userId: string) {
  return prisma.userPreference?.findUnique
    ? prisma.userPreference.findUnique({
        where: {
          userId,
        },
      })
    : null;
}

function assertReviewSubmissionWindow(reviewLabel: string, submissionWindow: ReviewSubmissionWindow) {
  if (submissionWindow.isOpen) {
    return;
  }

  const message = submissionWindow.allowedDate
    ? `${reviewLabel} can only be submitted for ${submissionWindow.allowedDate} right now. Active window: ${submissionWindow.opensAt ?? "unknown"} to ${submissionWindow.closesAt ?? "unknown"} (${submissionWindow.timezone}).`
    : `${reviewLabel} is closed right now. The next window opens at ${submissionWindow.opensAt ?? "unknown"} and closes at ${submissionWindow.closesAt ?? "unknown"} (${submissionWindow.timezone}).`;

  throw new AppError({
    statusCode: 409,
    code: "REVIEW_OUT_OF_WINDOW",
    message,
  });
}

function throwReviewAlreadySubmitted(reviewLabel: "Weekly review" | "Monthly review") {
  throw new AppError({
    statusCode: 409,
    code: "REVIEW_ALREADY_SUBMITTED",
    message: `${reviewLabel} has already been completed for this period`,
  });
}

function listIsoDates(startDate: string, endDate: string) {
  const dates: string[] = [];

  for (
    let currentDate = startDate as `${number}-${number}-${number}`;
    currentDate <= endDate;
    currentDate = addIsoDays(currentDate, 1)
  ) {
    dates.push(currentDate);
  }

  return dates;
}

async function getDailySummary(prisma: PrismaClient, userId: string, date: Date) {
  const targetIsoDate = toIsoDateString(date);
  const preferences = await prisma.userPreference?.findUnique?.({
    where: {
      userId,
    },
  });
  const dayWindow = getDayWindowUtc(targetIsoDate, preferences?.timezone);
  const [cycle, tasks, routines, routineCheckins, habits, habitCheckins, waterLogs, mealLogs, workoutDay, expenses] =
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
            gte: dayWindow.start,
            lt: dayWindow.end,
          },
        },
      }),
      prisma.mealLog.findMany({
        where: {
          userId,
          occurredAt: {
            gte: dayWindow.start,
            lt: dayWindow.end,
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
    ]);
  const dueHabits = new Set(filterDueHabits(habits, targetIsoDate).map((habit) => habit.id));

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
      habitsCompleted: habitCheckins.filter(
        (checkin) => checkin.status === "COMPLETED" && dueHabits.has(checkin.habitId),
      ).length,
      habitsDue: dueHabits.size,
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
  const tomorrowDate = addDays(date, 1);
  const [preferences, { cycle, summary, incompleteTasks }, score, tomorrowCycle] = await Promise.all([
    getUserPreferences(prisma, userId),
    getDailySummary(prisma, userId, date),
    calculateDailyScore(prisma, userId, date),
    prisma.planningCycle.findUnique({
      where: {
        userId_cycleType_cycleStartDate: {
          userId,
          cycleType: "DAY",
          cycleStartDate: tomorrowDate,
        },
      },
      include: {
        priorities: {
          orderBy: {
            slot: "asc",
          },
        },
      },
    }),
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
  const submissionWindow = resolveDailyReviewSubmissionWindow(toIsoDateString(date), new Date(), preferences);

  return {
    date: toIsoDateString(date),
    summary,
    score,
    incompleteTasks,
    existingReview,
    isCompleted: Boolean(existingReview),
    submissionWindow,
    seededTomorrowPriorities: tomorrowCycle?.priorities.map(serializePriority) ?? [],
    generatedAt: new Date().toISOString(),
  };
}

function dedupeTaskIds(payload: SubmitDailyReviewRequest) {
  const seen = new Set<string>();

  for (const taskId of [...payload.carryForwardTaskIds, ...payload.droppedTaskIds, ...payload.rescheduledTasks.map((task) => task.taskId)]) {
    if (seen.has(taskId)) {
      throw new AppError({
        statusCode: 400,
        code: "BAD_REQUEST",
        message: `Task ${taskId} appears in more than one review decision`,
      });
    }
    seen.add(taskId);
  }
}

async function validateDailyReviewTaskDecisions(
  prisma: PrismaClient,
  userId: string,
  date: Date,
  payload: SubmitDailyReviewRequest,
) {
  const decidedTaskIds = [
    ...payload.carryForwardTaskIds,
    ...payload.droppedTaskIds,
    ...payload.rescheduledTasks.map((task) => task.taskId),
  ];
  const pendingTasks = await prisma.task.findMany({
    where: {
      userId,
      scheduledForDate: date,
      status: "PENDING",
    },
    orderBy: {
      createdAt: "asc",
    },
  });
  const pendingTaskIds = new Set(pendingTasks.map((task) => task.id));

  if (decidedTaskIds.length !== pendingTaskIds.size) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Every pending task for the review date must be resolved before submission",
    });
  }

  for (const taskId of decidedTaskIds) {
    if (!pendingTaskIds.has(taskId)) {
      throw new AppError({
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Review decisions can only target pending tasks scheduled for this date",
      });
    }
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

  return refreshed.map(serializePriority);
}

export async function submitDailyReview(
  prisma: PrismaClient,
  userId: string,
  date: Date,
  payload: SubmitDailyReviewRequest,
) {
  dedupeTaskIds(payload);
  const preferences = await getUserPreferences(prisma, userId);
  assertReviewSubmissionWindow(
    "Daily review",
    resolveDailyReviewSubmissionWindow(toIsoDateString(date), new Date(), preferences),
  );
  const cycle = await ensureCycle(prisma, {
    userId,
    cycleType: "DAY",
    cycleStartDate: date,
    cycleEndDate: date,
  });

  if (cycle.dailyReview) {
    throw new AppError({
      statusCode: 409,
      code: "CONFLICT",
      message: "Daily review has already been completed for this date",
    });
  }

  await validateDailyReviewTaskDecisions(prisma, userId, date, payload);

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
  const habitTotals = habits.reduce(
    (totals, habit) => {
      const scheduleRule = normalizeHabitScheduleRule(habit.scheduleRuleJson);
      const completedDates = new Set<string>(
        habit.checkins
          .filter((checkin) => checkin.status === "COMPLETED")
          .map((checkin) => toIsoDateString(checkin.occurredOn)),
      );

      for (const isoDate of scopedIsoDates) {
        if (!isHabitDueOnIsoDate(scheduleRule, isoDate as `${number}-${number}-${number}`)) {
          continue;
        }

        totals.due += 1;

        if (completedDates.has(isoDate)) {
          totals.completed += 1;
        }
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
      strongDayCount: scores.filter((score) => score.scoreValue >= 70).length,
      habitCompletionRate:
        habitTotals.due > 0 ? roundToPercent(habitTotals.completed / habitTotals.due) : 0,
      routineCompletionRate: routines.length > 0 ? roundToPercent(routineCheckins.length / routines.length) : 0,
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
    submissionWindow,
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
      const scheduleRule = normalizeHabitScheduleRule(habit.scheduleRuleJson);
      const completedDates = new Set<string>(
        habit.checkins
          .filter((checkin) => checkin.status === "COMPLETED")
          .map((checkin) => toIsoDateString(checkin.occurredOn)),
      );
      const dueCount = scopedIsoDates.filter((isoDate) =>
        isHabitDueOnIsoDate(scheduleRule, isoDate as `${number}-${number}-${number}`),
      ).length;
      const completedCount = scopedIsoDates.filter((isoDate) => completedDates.has(isoDate)).length;

      return {
        habitId: habit.id,
        title: habit.title,
        completionRate: dueCount > 0 ? roundToPercent(completedCount / dueCount) : 0,
      };
    })
    .sort((a, b) => b.completionRate - a.completionRate)
    .slice(0, 3);

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
