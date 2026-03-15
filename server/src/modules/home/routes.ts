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
import { isHabitDueOnIsoDate, normalizeHabitScheduleRule } from "../../lib/habits/schedule.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { getMonthStartIsoDate, parseIsoDate } from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import {
  getDayWindowUtc,
  getLocalGreeting,
  getUserLocalDate,
  getUserLocalHour,
} from "../../lib/time/user-time.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import { calculateDailyScore, ensureCycle, getWeeklyMomentum } from "../scoring/service.js";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/) as unknown as z.ZodType<IsoDateString>;
const dateQuerySchema = z.object({
  date: isoDateSchema.optional(),
});

function currentRoutinePeriod(date: Date, timezone?: string | null): RoutineSummary["currentPeriod"] {
  const hour = getUserLocalHour(date, timezone);

  if (hour < 15) {
    return "morning";
  }

  if (hour < 23) {
    return "evening";
  }

  return "none";
}

async function buildHomeOverview(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  targetDate: Date,
): Promise<HomeOverviewResponse> {
  const targetIsoDate = toIsoDateString(targetDate);
  const preferences = await app.prisma.userPreference.findUnique({
    where: {
      userId,
    },
  });
  const dayWindow = getDayWindowUtc(targetIsoDate, preferences?.timezone);
  const [dayCycle, score, momentum, tasks, habits, habitCheckins, routines, routineCheckins, waterLogs, mealLogs, workoutDay, expenses, adminItems, notifications] =
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
            gte: dayWindow.start,
            lt: dayWindow.end,
          },
        },
      }),
      app.prisma.mealLog.findMany({
        where: {
          userId,
          occurredAt: {
            gte: dayWindow.start,
            lt: dayWindow.end,
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
            gte: parseIsoDate(getMonthStartIsoDate(targetIsoDate)),
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
    ]);

  const dueHabits = habits.filter((habit) =>
    isHabitDueOnIsoDate(normalizeHabitScheduleRule(habit.scheduleRuleJson), targetIsoDate),
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
  const currentIsoDate = getUserLocalDate(new Date(), preferences?.timezone);
  const routineSummary: RoutineSummary = {
    completedItems: completedRoutineItems,
    totalItems: totalRoutineItems,
    currentPeriod:
      targetIsoDate === currentIsoDate ? currentRoutinePeriod(new Date(), preferences?.timezone) : "none",
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
      detail: "Mark it done from Home or move it from Today.",
      action: {
        type: "complete_task",
        entityId: incompleteTask.id,
      },
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
      detail: "Complete it directly from Home.",
      action: {
        type: "complete_habit",
        entityId: missedHabit.id,
      },
    });
  }
  if (!dayCycle.dailyReview) {
    attentionItems.push({
      id: `review-${toIsoDateString(targetDate)}`,
      title: "Complete your daily review",
      kind: "review",
      tone: "warning",
      detail: "Close the day and seed tomorrow's priorities.",
      action: {
        type: "open_review",
        route: "/reviews/daily",
      },
    });
  }
  for (const item of adminItems.slice(0, 2)) {
    attentionItems.push({
      id: item.id,
      title: item.title,
      kind: "admin",
      tone: "urgent",
      detail: "Open Finance to handle the bill or admin item.",
      action: {
        type: "open_route",
        route: "/finance",
      },
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
    date: targetIsoDate,
    greeting: getLocalGreeting(new Date(), preferences?.timezone),
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
    const targetDate = query.date
      ? parseIsoDate(query.date)
      : parseIsoDate(
          getUserLocalDate(
            new Date(),
            (
              await app.prisma.userPreference.findUnique({
                where: {
                  userId: user.id,
                },
                select: {
                  timezone: true,
                },
              })
            )?.timezone,
          ),
        );

    return reply.send(await buildHomeOverview(app, user.id, targetDate));
  });

  app.get("/overview/history/:date", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { date } = request.params as { date: IsoDateString };
    const targetDate = parseIsoDate(parseOrThrow(isoDateSchema, date));

    return reply.send(await buildHomeOverview(app, user.id, targetDate));
  });
};
