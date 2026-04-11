import type { PrismaClient } from "@prisma/client";
import type {
  DailyTomorrowAdjustment,
  DailyTomorrowAdjustmentRecommendation,
  RescueReason,
} from "@life-os/contracts";

import { AppError } from "../../../lib/errors/app-error.js";
import { filterDueHabits, getHabitCompletionCountForIsoDate } from "../../../lib/habits/schedule.js";
import {
  applyRecurringTaskCarryForward,
  applyRecurringTaskSkip,
  materializeRecurringTasksInRange,
} from "../../../lib/recurrence/tasks.js";
import { serializeRecurrenceDefinition } from "../../../lib/recurrence/store.js";
import { addDays, parseIsoDate } from "../../../lib/time/cycle.js";
import { toIsoDateString } from "../../../lib/time/date.js";
import { getDayWindowUtc, getUserLocalDate } from "../../../lib/time/user-time.js";
import { calculateDailyScore, ensureCycle, finalizeDailyScore } from "../../scoring/service.js";
import {
  serializeTask,
  toPrismaDayMode,
  toPrismaRescueReason,
} from "../../planning/planning-mappers.js";
import { planningTaskInclude } from "../../planning/planning-record-shapes.js";
import { detectMissedDayPattern } from "../../planning/day-mode.js";
import { resolveDailyReviewSubmissionWindow } from "../submission-window.js";

import {
  assertOwnedPriorityGoalReferences,
  assertReviewSubmissionWindow,
  getUserPreferences,
  replacePriorities,
  serializePriority,
} from "./review-helpers.js";
import type {
  DailyReviewResponse,
  DailyReviewSummary,
  ExistingDailyReview,
  PlanningTaskItem,
  SubmitDailyReviewRequest,
} from "./review-types.js";

function fromStoredTomorrowAdjustment(
  value: string | null | undefined,
): DailyTomorrowAdjustment | null {
  switch (value) {
    case "keep_standard":
    case "rescue":
    case "recovery":
      return value;
    default:
      return null;
  }
}

function buildTomorrowAdjustmentRecommendation(input: {
  hasMissedDayPattern: boolean;
  energyRating?: number;
  frictionTag?: string | null;
}): DailyTomorrowAdjustmentRecommendation {
  if (input.hasMissedDayPattern) {
    return {
      required: true,
      suggestedAdjustment: "recovery",
      reason: "missed_day_pattern",
      detail: "Recent misses suggest starting tomorrow in Recovery Mode.",
    };
  }

  if ((input.energyRating ?? 3) <= 2) {
    return {
      required: true,
      suggestedAdjustment: "rescue",
      reason: "low_energy",
      detail: "Low energy today is a strong signal to scale tomorrow down deliberately.",
    };
  }

  if (input.frictionTag === "overcommitment") {
    return {
      required: true,
      suggestedAdjustment: "rescue",
      reason: "overcommitment",
      detail: "Overcommitment today is a sign to shrink tomorrow before it spirals.",
    };
  }

  if (input.frictionTag === "poor planning") {
    return {
      required: true,
      suggestedAdjustment: "rescue",
      reason: "poor_planning",
      detail: "Poor planning today is a signal to lower tomorrow's expectations.",
    };
  }

  return {
    required: false,
    suggestedAdjustment: null,
    reason: null,
    detail: null,
  };
}

function getRequiredTomorrowPriorityCount(
  adjustment: DailyTomorrowAdjustment | null | undefined,
) {
  return adjustment === "rescue" || adjustment === "recovery" ? 1 : 2;
}

function mapTomorrowAdjustmentToRescueReason(input: {
  adjustment: DailyTomorrowAdjustment;
  recommendation: DailyTomorrowAdjustmentRecommendation;
}): RescueReason | null {
  if (input.adjustment === "keep_standard") {
    return null;
  }

  if (input.adjustment === "recovery" || input.recommendation.reason === "missed_day_pattern") {
    return "missed_day";
  }

  if (input.recommendation.reason === "low_energy") {
    return "low_energy";
  }

  return "overload";
}

async function getDailySummary(prisma: PrismaClient, userId: string, date: Date) {
  const targetIsoDate = toIsoDateString(date);
  await materializeRecurringTasksInRange(prisma, userId, date, date);
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
        include: planningTaskInclude,
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
  const dueHabitRecords = filterDueHabits(habits, targetIsoDate);
  const requiredRoutineItemIds = new Set(
    routines.flatMap((routine) => routine.items.filter((item) => item.isRequired).map((item) => item.id)),
  );

  const routinesTotal = requiredRoutineItemIds.size;
  const routinesCompleted = routineCheckins.filter((checkin) => requiredRoutineItemIds.has(checkin.routineItemId)).length;
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
      habitsCompleted: dueHabitRecords.reduce(
        (sum, habit) =>
          sum +
          Math.min(
            getHabitCompletionCountForIsoDate(
              habitCheckins.filter((checkin) => checkin.habitId === habit.id),
              targetIsoDate,
            ),
            habit.targetPerDay,
          ),
        0,
      ),
      habitsDue: dueHabitRecords.reduce((sum, habit) => sum + habit.targetPerDay, 0),
      waterMl: waterLogs.reduce((sum, log) => sum + log.amountMl, 0),
      waterTargetMl: preferences?.dailyWaterTargetMl ?? 2500,
      mealsLogged: mealLogs.length,
      workoutStatus,
      expensesLogged: expenses.length,
    },
    incompleteTasks: tasks
      .filter((task) => task.status !== "COMPLETED")
      .map((task): PlanningTaskItem => serializeTask(task)),
  };
}

function canEditSubmittedDailyReview(
  reviewDate: string,
  submissionWindow: DailyReviewResponse["submissionWindow"],
  timezone?: string | null,
  now: Date = new Date(),
) {
  return submissionWindow.isOpen && reviewDate === getUserLocalDate(now, timezone);
}

export async function getDailyReviewModel(
  prisma: PrismaClient,
  userId: string,
  date: Date,
): Promise<DailyReviewResponse> {
  const now = new Date();
  const tomorrowDate = addDays(date, 1);
  const [preferences, { cycle, summary, incompleteTasks }, score, tomorrowCycle, overdueTaskCount] = await Promise.all([
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
    prisma.task.count({
      where: {
        userId,
        status: "PENDING",
        scheduledForDate: {
          lt: date,
        },
      },
    }),
  ]);
  const hasMissedDayPattern = await detectMissedDayPattern(prisma, {
    userId,
    targetDate: date,
    overdueTaskCount,
  });

  const existingReview: ExistingDailyReview | null = cycle.dailyReview
    ? {
        biggestWin: cycle.dailyReview.biggestWin,
        frictionTag: cycle.dailyReview.frictionTag as ExistingDailyReview["frictionTag"],
        frictionNote: cycle.dailyReview.frictionNote,
        energyRating: cycle.dailyReview.energyRating,
        optionalNote: cycle.dailyReview.optionalNote,
        tomorrowAdjustment: fromStoredTomorrowAdjustment(cycle.dailyReview.tomorrowAdjustment),
        completedAt: cycle.dailyReview.completedAt.toISOString(),
      }
    : null;
  const reviewDate = toIsoDateString(date);
  const submissionWindow = resolveDailyReviewSubmissionWindow(reviewDate, now, preferences);
  const canEditCompletedReview = Boolean(existingReview)
    ? canEditSubmittedDailyReview(reviewDate, submissionWindow, preferences?.timezone, now)
    : false;

  return {
    date: reviewDate,
    summary,
    score,
    incompleteTasks,
    existingReview,
    isCompleted: Boolean(existingReview),
    canEditSubmittedReview: canEditCompletedReview,
    submissionWindow,
    seededTomorrowPriorities: tomorrowCycle?.priorities.map(serializePriority) ?? [],
    tomorrowAdjustmentRecommendation: buildTomorrowAdjustmentRecommendation({
      hasMissedDayPattern,
    }),
    generatedAt: new Date().toISOString(),
  };
}

function dedupeTaskIds(payload: SubmitDailyReviewRequest) {
  const seen = new Set<string>();

  for (const taskId of [
    ...payload.carryForwardTaskIds,
    ...payload.droppedTaskIds,
    ...payload.rescheduledTasks.map((task) => task.taskId),
  ]) {
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

function validateTomorrowPlanForAdjustment(
  payload: SubmitDailyReviewRequest,
  recommendation: DailyTomorrowAdjustmentRecommendation,
) {
  if (recommendation.required && !payload.tomorrowAdjustment) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Choose how tomorrow should change before submitting this review",
    });
  }

  const requiredPriorityCount = getRequiredTomorrowPriorityCount(payload.tomorrowAdjustment ?? null);
  const filledPriorityCount = payload.tomorrowPriorities.filter((priority) => priority.title.trim().length > 0).length;

  if (filledPriorityCount < requiredPriorityCount) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message:
        requiredPriorityCount === 1
          ? "A downgraded tomorrow must keep at least one support priority"
          : "Tomorrow requires two support priorities before submission",
    });
  }
}

export async function submitDailyReview(
  prisma: PrismaClient,
  userId: string,
  date: Date,
  payload: SubmitDailyReviewRequest,
) {
  const now = new Date();
  dedupeTaskIds(payload);
  await materializeRecurringTasksInRange(prisma, userId, date, date);
  const preferences = await getUserPreferences(prisma, userId);
  const reviewDate = toIsoDateString(date);
  const submissionWindow = resolveDailyReviewSubmissionWindow(reviewDate, now, preferences);
  assertReviewSubmissionWindow(
    "Daily review",
    submissionWindow,
  );
  const cycle = await ensureCycle(prisma, {
    userId,
    cycleType: "DAY",
    cycleStartDate: date,
    cycleEndDate: date,
  });
  await assertOwnedPriorityGoalReferences(prisma, userId, payload.tomorrowPriorities);
  const overdueTaskCount = await prisma.task.count({
    where: {
      userId,
      status: "PENDING",
      scheduledForDate: {
        lt: date,
      },
    },
  });
  const hasMissedDayPattern = await detectMissedDayPattern(prisma, {
    userId,
    targetDate: date,
    overdueTaskCount,
  });
  const tomorrowAdjustmentRecommendation = buildTomorrowAdjustmentRecommendation({
    hasMissedDayPattern,
    energyRating: payload.energyRating,
    frictionTag: payload.frictionNote?.trim() ? payload.frictionTag : null,
  });

  if (
    cycle.dailyReview &&
    !canEditSubmittedDailyReview(reviewDate, submissionWindow, preferences?.timezone, now)
  ) {
    throw new AppError({
      statusCode: 409,
      code: "CONFLICT",
      message: "Daily review has already been completed for this date",
    });
  }

  await validateDailyReviewTaskDecisions(prisma, userId, date, payload);
  validateTomorrowPlanForAdjustment(payload, tomorrowAdjustmentRecommendation);

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
        tomorrowAdjustment: payload.tomorrowAdjustment ?? null,
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
        tomorrowAdjustment: payload.tomorrowAdjustment ?? null,
        completedAt,
      },
    });

    await replacePriorities(tx, tomorrowCycle.id, payload.tomorrowPriorities, "DAILY");

    const existingTomorrowLaunch = await tx.dailyLaunch.findUnique({
      where: {
        planningCycleId: tomorrowCycle.id,
      },
    });

    if (
      payload.tomorrowAdjustment &&
      (payload.tomorrowAdjustment !== "keep_standard" || existingTomorrowLaunch)
    ) {
      const nextRescueReason = mapTomorrowAdjustmentToRescueReason({
        adjustment: payload.tomorrowAdjustment,
        recommendation: tomorrowAdjustmentRecommendation,
      });

      await tx.dailyLaunch.upsert({
        where: {
          planningCycleId: tomorrowCycle.id,
        },
        update: {
          dayMode: toPrismaDayMode(
            payload.tomorrowAdjustment === "keep_standard"
              ? "normal"
              : payload.tomorrowAdjustment,
          ),
          rescueReason: nextRescueReason ? toPrismaRescueReason(nextRescueReason) : null,
          rescueSuggestedAt:
            payload.tomorrowAdjustment === "keep_standard"
              ? null
              : existingTomorrowLaunch?.rescueSuggestedAt ?? completedAt,
          rescueActivatedAt: null,
          rescueExitedAt: existingTomorrowLaunch?.rescueExitedAt ?? null,
        },
        create: {
          userId,
          planningCycleId: tomorrowCycle.id,
          mustWinTaskId: null,
          dayMode: toPrismaDayMode(
            payload.tomorrowAdjustment === "keep_standard"
              ? "normal"
              : payload.tomorrowAdjustment,
          ),
          rescueReason: nextRescueReason ? toPrismaRescueReason(nextRescueReason) : null,
          energyRating: null,
          likelyDerailmentReason: null,
          likelyDerailmentNote: null,
          rescueSuggestedAt: payload.tomorrowAdjustment === "keep_standard" ? null : completedAt,
          rescueActivatedAt: null,
          rescueExitedAt: null,
          completedAt: null,
        },
      });
    }

    for (const taskId of payload.droppedTaskIds) {
      const task = await tx.task.findUniqueOrThrow({
        where: {
          id: taskId,
        },
      });

      if (task.recurrenceRuleId) {
        await applyRecurringTaskSkip(tx, userId, task);
      } else {
        await tx.task.update({
          where: {
            id: taskId,
          },
          data: {
            status: "DROPPED",
          },
        });
      }
    }

    for (const taskId of payload.carryForwardTaskIds) {
      const task = await tx.task.findUniqueOrThrow({
        where: {
          id: taskId,
        },
      });

      if (task.recurrenceRuleId) {
        await applyRecurringTaskCarryForward(tx, userId, task, toIsoDateString(tomorrowDate));
        continue;
      }

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
          kind: task.kind,
          reminderAt: task.reminderAt,
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
      const targetDate = parseIsoDate(rescheduledTask.targetDate);

      if (task.recurrenceRuleId) {
        await applyRecurringTaskCarryForward(tx, userId, task, rescheduledTask.targetDate);
        continue;
      }

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
          kind: task.kind,
          reminderAt: task.reminderAt,
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
    appliedTomorrowAdjustment: payload.tomorrowAdjustment ?? null,
    generatedAt: new Date().toISOString(),
  };
}
