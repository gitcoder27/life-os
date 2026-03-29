import type { PrismaClient } from "@prisma/client";

import { AppError } from "../../../lib/errors/app-error.js";
import { filterDueHabits } from "../../../lib/habits/schedule.js";
import {
  applyRecurringTaskCarryForward,
  applyRecurringTaskSkip,
  materializeRecurringTasksInRange,
} from "../../../lib/recurrence/tasks.js";
import { serializeRecurrenceDefinition } from "../../../lib/recurrence/store.js";
import { addDays, parseIsoDate } from "../../../lib/time/cycle.js";
import { toIsoDateString } from "../../../lib/time/date.js";
import { getDayWindowUtc } from "../../../lib/time/user-time.js";
import { calculateDailyScore, ensureCycle, finalizeDailyScore } from "../../scoring/service.js";
import { resolveDailyReviewSubmissionWindow } from "../submission-window.js";

import {
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
        kind: task.kind === "NOTE" ? "note" : task.kind === "REMINDER" ? "reminder" : "task",
        reminderAt: task.reminderAt?.toISOString() ?? null,
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
                  : task.originType === "TEMPLATE"
                    ? "template"
                    : "manual",
        carriedFromTaskId: task.carriedFromTaskId,
        recurrence: serializeRecurrenceDefinition(task.recurrenceRule),
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
        frictionTag: cycle.dailyReview.frictionTag as ExistingDailyReview["frictionTag"],
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

export async function submitDailyReview(
  prisma: PrismaClient,
  userId: string,
  date: Date,
  payload: SubmitDailyReviewRequest,
) {
  dedupeTaskIds(payload);
  await materializeRecurringTasksInRange(prisma, userId, date, date);
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
    generatedAt: new Date().toISOString(),
  };
}
