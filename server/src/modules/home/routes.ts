import type { FastifyPluginAsync } from "fastify";
import type {
  AttentionItem,
  HabitSummary,
  HealthSummary,
  HomeNotificationItem,
  HomeOverviewResponse,
  IsoDateString,
  RoutineSummary,
} from "@life-os/contracts";
import { z } from "zod";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { addDays, parseIsoDate } from "../../lib/time/cycle.js";
import { getUtcGreeting, toIsoDateString } from "../../lib/time/date.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import { calculateDailyScore, ensureCycle, getWeeklyMomentum } from "../scoring/service.js";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/) as unknown as z.ZodType<IsoDateString>;
const dateQuerySchema = z.object({
  date: isoDateSchema.optional(),
});

function currentRoutinePeriod(date: Date): RoutineSummary["currentPeriod"] {
  const hour = date.getUTCHours();

  if (hour < 15) {
    return "morning";
  }

  if (hour < 23) {
    return "evening";
  }

  return "none";
}

function normalizeHabitScheduleRule(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  return input as { daysOfWeek?: number[] };
}

function isHabitDueOn(scheduleRule: { daysOfWeek?: number[] }, date: Date) {
  if (!scheduleRule.daysOfWeek || scheduleRule.daysOfWeek.length === 0) {
    return true;
  }

  return scheduleRule.daysOfWeek.includes(date.getUTCDay());
}

function severityToTone(
  severity: "INFO" | "WARNING" | "CRITICAL",
): AttentionItem["tone"] {
  switch (severity) {
    case "INFO":
      return "info";
    case "WARNING":
      return "warning";
    case "CRITICAL":
      return "urgent";
  }
}

async function buildHomeOverview(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  targetDate: Date,
): Promise<HomeOverviewResponse> {
  const [dayCycle, score, momentum, tasks, habits, habitCheckins, routines, routineCheckins, waterLogs, mealLogs, workoutDay, expenses, adminItems, notifications, preferences] =
    await Promise.all([
      ensureCycle(app.prisma, {
        userId,
        cycleType: "DAY",
        cycleStartDate: targetDate,
        cycleEndDate: targetDate,
      }),
      calculateDailyScore(app.prisma, userId, targetDate),
      getWeeklyMomentum(app.prisma, userId, targetDate),
      app.prisma.task.findMany({
        where: {
          userId,
          scheduledForDate: targetDate,
        },
        orderBy: [{ createdAt: "asc" }],
      }),
      app.prisma.habit.findMany({
        where: {
          userId,
          status: "ACTIVE",
          archivedAt: null,
        },
      }),
      app.prisma.habitCheckin.findMany({
        where: {
          occurredOn: targetDate,
          habit: {
            userId,
          },
        },
      }),
      app.prisma.routine.findMany({
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
      app.prisma.routineItemCheckin.findMany({
        where: {
          occurredOn: targetDate,
          routineItem: {
            routine: {
              userId,
            },
          },
        },
      }),
      app.prisma.waterLog.findMany({
        where: {
          userId,
          occurredAt: {
            gte: targetDate,
            lt: addDays(targetDate, 1),
          },
        },
      }),
      app.prisma.mealLog.findMany({
        where: {
          userId,
          occurredAt: {
            gte: targetDate,
            lt: addDays(targetDate, 1),
          },
        },
      }),
      app.prisma.workoutDay.findUnique({
        where: {
          userId_date: {
            userId,
            date: targetDate,
          },
        },
      }),
      app.prisma.expense.findMany({
        where: {
          userId,
          spentOn: {
            gte: new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), 1)),
            lt: new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, 1)),
          },
        },
      }),
      app.prisma.adminItem.findMany({
        where: {
          userId,
          dueOn: targetDate,
          status: "PENDING",
        },
        orderBy: [{ dueOn: "asc" }],
      }),
      app.prisma.notification.findMany({
        where: {
          userId,
          dismissedAt: null,
          OR: [{ visibleFrom: null }, { visibleFrom: { lte: new Date() } }],
          AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
        },
        orderBy: [{ createdAt: "desc" }],
        take: 5,
      }),
      app.prisma.userPreference.findUnique({
        where: {
          userId,
        },
      }),
    ]);

  const dueHabits = habits.filter((habit) =>
    isHabitDueOn(normalizeHabitScheduleRule(habit.scheduleRuleJson), targetDate),
  );
  const completedHabits = dueHabits.filter((habit) =>
    habitCheckins.some(
      (checkin) => checkin.habitId === habit.id && checkin.status === "COMPLETED",
    ),
  );

  const habitSummary: HabitSummary = {
    completedToday: completedHabits.length,
    dueToday: dueHabits.length,
    streakHighlights: completedHabits.slice(0, 3).map((habit) => `${habit.title} active today`),
  };

  const totalRoutineItems = routines.reduce((sum, routine) => sum + routine.items.length, 0);
  const completedRoutineItems = routineCheckins.length;
  const routineSummary: RoutineSummary = {
    completedItems: completedRoutineItems,
    totalItems: totalRoutineItems,
    currentPeriod: currentRoutinePeriod(targetDate),
  };

  const healthSummary: HealthSummary = {
    waterMl: waterLogs.reduce((sum, log) => sum + log.amountMl, 0),
    waterTargetMl: preferences?.dailyWaterTargetMl ?? 2500,
    mealsLogged: mealLogs.length,
    workoutStatus:
      workoutDay?.actualStatus === "COMPLETED"
        ? "completed"
        : workoutDay?.actualStatus === "RECOVERY_RESPECTED"
          ? "recovery_respected"
          : workoutDay?.actualStatus === "FALLBACK"
            ? "fallback"
            : workoutDay?.actualStatus === "MISSED"
              ? "missed"
              : "none",
  };

  const attentionItems: AttentionItem[] = [];
  const incompleteTask = tasks.find((task) => task.status === "PENDING");
  if (incompleteTask) {
    attentionItems.push({
      id: incompleteTask.id,
      title: `Task still open: ${incompleteTask.title}`,
      kind: "task",
      tone: "warning",
    });
  }
  const missedHabit = dueHabits.find(
    (habit) => !habitCheckins.some((checkin) => checkin.habitId === habit.id && checkin.status === "COMPLETED"),
  );
  if (missedHabit) {
    attentionItems.push({
      id: missedHabit.id,
      title: `Habit due: ${missedHabit.title}`,
      kind: "habit",
      tone: "warning",
    });
  }
  if (!dayCycle.dailyReview) {
    attentionItems.push({
      id: `review-${toIsoDateString(targetDate)}`,
      title: "Complete your daily review",
      kind: "review",
      tone: "warning",
    });
  }
  for (const item of adminItems.slice(0, 2)) {
    attentionItems.push({
      id: item.id,
      title: item.title,
      kind: "admin",
      tone: "urgent",
    });
  }
  for (const notification of notifications.slice(0, 1)) {
    attentionItems.push({
      id: notification.id,
      title: notification.title,
      kind: "notification",
      tone: severityToTone(notification.severity),
    });
  }

  const homeNotifications: HomeNotificationItem[] = notifications.map((notification) => ({
    id: notification.id,
    title: notification.title,
    body: notification.body,
    read: Boolean(notification.readAt),
    createdAt: notification.createdAt.toISOString(),
  }));

  return withGeneratedAt({
    date: toIsoDateString(targetDate),
    greeting: getUtcGreeting(new Date()),
    dailyScore: {
      value: score.value,
      label: score.label,
      earnedPoints: score.earnedPoints,
      possiblePoints: score.possiblePoints,
    },
    weeklyMomentum: momentum.value,
    topPriorities: dayCycle.priorities.map((priority) => ({
      id: priority.id,
      title: priority.title,
      slot: priority.slot as 1 | 2 | 3,
      status:
        priority.status === "COMPLETED"
          ? "completed"
          : priority.status === "DROPPED"
            ? "dropped"
            : "pending",
    })),
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status:
        task.status === "COMPLETED" ? "completed" : task.status === "DROPPED" ? "dropped" : "pending",
      scheduledForDate: task.scheduledForDate ? toIsoDateString(task.scheduledForDate) : null,
    })),
    routineSummary,
    habitSummary,
    healthSummary,
    financeSummary: {
      spentThisMonth: expenses.reduce((sum, expense) => sum + expense.amountMinor, 0),
      budgetLabel: expenses.length === 0 ? "No spend logged" : "Current month spend",
      upcomingBills: adminItems.length,
    },
    attentionItems: attentionItems.slice(0, 6),
    notifications: homeNotifications,
  });
}

export const registerHomeRoutes: FastifyPluginAsync = async (app) => {
  app.get("/overview", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(dateQuerySchema, request.query);
    const targetDate = query.date ? parseIsoDate(query.date) : parseIsoDate(toIsoDateString(new Date()));

    return reply.send(await buildHomeOverview(app, user.id, targetDate));
  });

  app.get("/overview/history/:date", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { date } = request.params as { date: IsoDateString };
    const targetDate = parseIsoDate(parseOrThrow(isoDateSchema, date));

    return reply.send(await buildHomeOverview(app, user.id, targetDate));
  });
};
