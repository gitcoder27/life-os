import type { FastifyPluginAsync } from "fastify";
import type {
  AttentionItem,
  GoalSummary,
  HabitSummary,
  HealthSummary,
  HomeNotificationItem,
  HomeOverviewResponse,
  IsoDateString,
  RoutineSummary,
} from "@life-os/contracts";
import type { GoalDomain as PrismaGoalDomain, GoalStatus as PrismaGoalStatus } from "@prisma/client";
import { z } from "zod";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import {
  calculateHabitActiveStreak,
  calculateHabitRisk,
  calculateWeeklyHabitChallenge,
} from "../../lib/habits/guidance.js";
import {
  isHabitDueOnIsoDate,
  normalizeHabitScheduleRule,
} from "../../lib/habits/schedule.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import {
  addIsoDays,
  getMonthStartIsoDate,
  getWeekEndDate,
  getWeekStartIsoDate,
  parseIsoDate,
} from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import {
  getDayWindowUtc,
  getLocalGreeting,
  getUserLocalDate,
  getUserLocalHour,
} from "../../lib/time/user-time.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import { buildHomeGuidance } from "./guidance.js";
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

function fromPrismaGoalDomain(domain: PrismaGoalDomain) {
  switch (domain) {
    case "HEALTH":
      return "health";
    case "MONEY":
      return "money";
    case "WORK_GROWTH":
      return "work_growth";
    case "HOME_ADMIN":
      return "home_admin";
    case "DISCIPLINE":
      return "discipline";
    case "OTHER":
      return "other";
  }
}

function fromPrismaGoalStatus(status: PrismaGoalStatus) {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "PAUSED":
      return "paused";
    case "COMPLETED":
      return "completed";
    case "ARCHIVED":
      return "archived";
  }
}

function serializeGoalSummary(goal: {
  id: string;
  title: string;
  domain: PrismaGoalDomain;
  status: PrismaGoalStatus;
}): GoalSummary {
  return {
    id: goal.id,
    title: goal.title,
    domain: fromPrismaGoalDomain(goal.domain),
    status: fromPrismaGoalStatus(goal.status),
  };
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
  const weekStartIsoDate = getWeekStartIsoDate(targetIsoDate, preferences?.weekStartsOn ?? 1);
  const weekStartDate = parseIsoDate(weekStartIsoDate);
  const [dayCycle, weekCycle, score, momentum, tasks, habits, recentHabitCheckins, routines, routineCheckins, waterLogs, mealLogs, workoutDay, expenses, adminItems, notifications] =
    await Promise.all([
      ensureCycle(app.prisma, {
        userId,
        cycleType: "DAY",
        cycleStartDate: targetDate,
        cycleEndDate: targetDate,
      }),
      ensureCycle(app.prisma, {
        userId,
        cycleType: "WEEK",
        cycleStartDate: weekStartDate,
        cycleEndDate: getWeekEndDate(weekStartDate),
      }),
      calculateDailyScore(app.prisma, userId, targetDate),
      getWeeklyMomentum(app.prisma, userId, targetDate),
      app.prisma.task.findMany({
        where: {
          userId,
          scheduledForDate: targetDate,
        },
        orderBy: [{ createdAt: "asc" }],
        include: {
          goal: true,
        },
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
          occurredOn: {
            gte: parseIsoDate(addIsoDays(targetIsoDate, -30)),
            lte: targetDate,
          },
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
    recentHabitCheckins.some(
      (checkin) => checkin.habitId === habit.id && checkin.status === "COMPLETED",
    ),
  );
  const habitItems = habits.map((habit) => {
    const habitCheckins = recentHabitCheckins.filter((checkin) => checkin.habitId === habit.id);
    const scheduleRule = normalizeHabitScheduleRule(habit.scheduleRuleJson);
    const risk = calculateHabitRisk(habitCheckins, scheduleRule, targetIsoDate);
    const completedToday = habitCheckins.some(
      (checkin) =>
        toIsoDateString(checkin.occurredOn) === targetIsoDate && checkin.status === "COMPLETED",
    );

    return {
      id: habit.id,
      title: habit.title,
      dueToday: isHabitDueOnIsoDate(scheduleRule, targetIsoDate),
      completedToday,
      streakCount: calculateHabitActiveStreak(habitCheckins, scheduleRule, targetIsoDate),
      risk,
      scheduleRule,
      checkins: habitCheckins,
    };
  });

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
    (habit) =>
      !recentHabitCheckins.some((checkin) => checkin.habitId === habit.id && checkin.status === "COMPLETED"),
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
  const weeklyChallengeHabit = weekCycle.weeklyReview?.focusHabitId
    ? habitItems.find((habit) => habit.id === weekCycle.weeklyReview?.focusHabitId)
    : null;
  const weeklyChallenge =
    weeklyChallengeHabit &&
    weeklyChallengeHabit.checkins &&
    weeklyChallengeHabit.scheduleRule
      ? calculateWeeklyHabitChallenge({
          habit: {
            id: weeklyChallengeHabit.id,
            title: weeklyChallengeHabit.title,
          },
          checkins: weeklyChallengeHabit.checkins,
          scheduleRule: weeklyChallengeHabit.scheduleRule,
          weekStartIsoDate,
          targetIsoDate,
        })
      : null;
  const guidance = buildHomeGuidance({
    score: {
      label: score.label,
      value: score.value,
      topReasons: score.topReasons,
    },
    momentum: {
      strongDayStreak: momentum.strongDayStreak,
    },
    habits: habitItems.map((habit) => ({
      id: habit.id,
      title: habit.title,
      dueToday: habit.dueToday,
      completedToday: habit.completedToday,
      streakCount: habit.streakCount,
      risk: habit.risk,
    })),
    priorities: dayCycle.priorities.map((priority) => ({
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
    })),
    weeklyChallenge,
    dayReviewCompleted: Boolean(dayCycle.dailyReview),
    currentHour: targetIsoDate === currentIsoDate ? getUserLocalHour(new Date(), preferences?.timezone) : 12,
    health: {
      waterMl: healthSummary.waterMl,
      waterTargetMl: healthSummary.waterTargetMl,
    },
  });

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
      goalId: priority.goalId,
      goal: priority.goal ? serializeGoalSummary(priority.goal) : null,
    })),
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status:
        task.status === "COMPLETED" ? "completed" : task.status === "DROPPED" ? "dropped" : "pending",
      scheduledForDate: task.scheduledForDate ? toIsoDateString(task.scheduledForDate) : null,
      goalId: task.goalId,
      goal: task.goal ? serializeGoalSummary(task.goal) : null,
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
    guidance,
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
