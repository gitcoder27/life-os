import type { FastifyPluginAsync } from "fastify";
import type {
  AccountabilityRadar,
  AttentionItem,
  GoalSummary,
  HabitSummary,
  HealthSummary,
  HomeNotificationItem,
  HomeOverviewResponse,
  HomeQuoteResponse,
  IsoDateString,
  TaskKind,
  RoutineSummary,
  TaskOriginType,
} from "@life-os/contracts";
import type {
  GoalStatus as PrismaGoalStatus,
  TaskOriginType as PrismaTaskOriginType,
} from "@prisma/client";
import { z } from "zod";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import {
  calculateHabitActiveStreak,
  calculateHabitRisk,
  calculateWeeklyHabitChallenge,
} from "../../lib/habits/guidance.js";
import { buildStaleInboxTaskWhere } from "../../lib/inbox/stale.js";
import {
  isHabitCompletedOnIsoDate,
  isHabitDueOnIsoDate,
  isHabitPermanentlyInactive,
  resolveHabitRecurrence,
} from "../../lib/habits/schedule.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { materializeRecurringTasksInRange } from "../../lib/recurrence/tasks.js";
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
import { createHomeQuoteService } from "./quote-service.js";
import { fromPrismaGoalDomainSystemKey } from "../planning/planning-mappers.js";
import { goalSummaryInclude } from "../planning/planning-record-shapes.js";
import { getOpenDailyReviewRoute } from "../reviews/submission-window.js";
import { calculateDailyScore, ensureCycle, getWeeklyMomentum } from "../scoring/service.js";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/) as unknown as z.ZodType<IsoDateString>;
const dateQuerySchema = z.object({
  date: isoDateSchema.optional(),
});

const ACCOUNTABILITY_LOOKBACK_DAYS = 30;
const ACCOUNTABILITY_SURFACED_ITEMS = 5;

function currentHomePhase(
  date: Date,
  timezone?: string | null,
): HomeOverviewResponse["phase"] {
  const hour = getUserLocalHour(date, timezone);

  if (hour < 12) {
    return "morning";
  }

  if (hour < 17) {
    return "midday";
  }

  return "evening";
}

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

function fromPrismaTaskOriginType(originType: PrismaTaskOriginType): TaskOriginType {
  switch (originType) {
    case "MANUAL":
      return "manual";
    case "QUICK_CAPTURE":
      return "quick_capture";
    case "CARRY_FORWARD":
      return "carry_forward";
    case "REVIEW_SEED":
      return "review_seed";
    case "RECURRING":
      return "recurring";
    case "TEMPLATE":
      return "template";
    case "MEAL_PLAN":
      return "meal_plan";
  }
}

function fromPrismaTaskKind(kind: "TASK" | "NOTE" | "REMINDER"): TaskKind {
  switch (kind) {
    case "TASK":
      return "task";
    case "NOTE":
      return "note";
    case "REMINDER":
      return "reminder";
  }
}

function serializeGoalSummary(goal: {
  id: string;
  title: string;
  domainId: string;
  domain: {
    id: string;
    name: string;
    systemKey: Parameters<typeof fromPrismaGoalDomainSystemKey>[0];
  };
  status: PrismaGoalStatus;
}): GoalSummary {
  return {
    id: goal.id,
    title: goal.title,
    domainId: goal.domainId,
    domain: goal.domain.name,
    domainSystemKey: fromPrismaGoalDomainSystemKey(goal.domain.systemKey),
    status: fromPrismaGoalStatus(goal.status),
  };
}

function getIsoDayDifference(startIsoDate: IsoDateString, endIsoDate: IsoDateString) {
  return Math.round((parseIsoDate(endIsoDate).getTime() - parseIsoDate(startIsoDate).getTime()) / 86_400_000);
}

function formatOverdueLabel(ageDays: number) {
  return `Overdue by ${ageDays} day${ageDays === 1 ? "" : "s"}`;
}

function formatStaleInboxLabel(ageDays: number) {
  return `Inbox for ${ageDays} day${ageDays === 1 ? "" : "s"}`;
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
  const overdueWindowStartIsoDate = addIsoDays(targetIsoDate, -ACCOUNTABILITY_LOOKBACK_DAYS);
  const overdueWindowStartDate = parseIsoDate(overdueWindowStartIsoDate);
  const monthStartDate = parseIsoDate(getMonthStartIsoDate(targetIsoDate));
  const nextMonthStartDate = new Date(
    Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, 1),
  );
  await materializeRecurringTasksInRange(
    app.prisma,
    userId,
    overdueWindowStartDate,
    parseIsoDate(addIsoDays(targetIsoDate, -1)),
  );

  const [dayCycle, weekCycle, score, momentum, tasks, overdueTasks, staleInboxTasks, habits, recentHabitCheckins, routines, routineCheckins, waterLogs, mealLogs, workoutDay, expenses, todayAdminItems, monthlyPendingAdminItems, notifications] =
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
          goal: {
            include: goalSummaryInclude,
          },
        },
      }),
      app.prisma.task.findMany({
        where: {
          userId,
          status: "PENDING",
          scheduledForDate: {
            gte: overdueWindowStartDate,
            lt: targetDate,
          },
        },
        orderBy: [{ scheduledForDate: "asc" }, { createdAt: "asc" }],
      }),
      app.prisma.task.findMany({
        where: buildStaleInboxTaskWhere({
          userId,
          targetDate,
          timezone: preferences?.timezone,
        }),
        orderBy: [{ createdAt: "asc" }],
      }),
      app.prisma.habit.findMany({
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
            gte: monthStartDate,
            lt: nextMonthStartDate,
          },
        },
      }),
      app.prisma.adminItem.findMany({
        where: {
          userId,
          itemType: "BILL",
          dueOn: targetDate,
          status: {
            in: ["PENDING", "RESCHEDULED"],
          },
        },
        orderBy: [{ dueOn: "asc" }],
      }),
      app.prisma.adminItem.findMany({
        where: {
          userId,
          itemType: "BILL",
          dueOn: {
            gte: monthStartDate,
            lt: nextMonthStartDate,
          },
          status: {
            in: ["PENDING", "RESCHEDULED"],
          },
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
    !isHabitPermanentlyInactive(habit) &&
    isHabitDueOnIsoDate(resolveHabitRecurrence(habit, targetIsoDate), targetIsoDate, habit.pauseWindows),
  );
  const plannerBlockCount = await app.prisma.dayPlannerBlock.count({
    where: {
      planningCycleId: dayCycle.id,
    },
  });
  const completedHabits = dueHabits.filter((habit) =>
    isHabitCompletedOnIsoDate(
      recentHabitCheckins.filter((checkin) => checkin.habitId === habit.id),
      targetIsoDate,
      habit.targetPerDay,
    ),
  );
  const habitItems = habits.map((habit) => {
    const habitCheckins = recentHabitCheckins.filter((checkin) => checkin.habitId === habit.id);
    const recurrence = resolveHabitRecurrence(habit, targetIsoDate);
    const risk = calculateHabitRisk(habitCheckins, recurrence, targetIsoDate, habit.pauseWindows, habit.targetPerDay);
    const completedToday = isHabitCompletedOnIsoDate(habitCheckins, targetIsoDate, habit.targetPerDay);

    return {
      id: habit.id,
      title: habit.title,
      dueToday:
        !isHabitPermanentlyInactive(habit) &&
        isHabitDueOnIsoDate(recurrence, targetIsoDate, habit.pauseWindows),
      completedToday,
      streakCount: calculateHabitActiveStreak(habitCheckins, recurrence, targetIsoDate, habit.pauseWindows, habit.targetPerDay),
      risk,
      scheduleRule: habit.scheduleRuleJson,
      pauseWindows: habit.pauseWindows,
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

  const accountabilityItems = [
    ...overdueTasks.map((task) => {
      const scheduledForDate = toIsoDateString(task.scheduledForDate!);
      const ageDays = getIsoDayDifference(scheduledForDate, targetIsoDate);

      return {
        id: task.id,
        kind: "overdue_task" as const,
        title: task.title,
        route: "/today",
        label: formatOverdueLabel(ageDays),
        ageDays,
        scheduledForDate,
        createdAt: task.createdAt.toISOString(),
        notes: task.notes,
        taskKind: fromPrismaTaskKind(task.kind),
        reminderAt: task.reminderAt?.toISOString() ?? null,
        originType: fromPrismaTaskOriginType(task.originType),
      };
    }),
    ...staleInboxTasks.map((task) => {
      const createdOnIsoDate = getUserLocalDate(task.createdAt, preferences?.timezone);
      const ageDays = getIsoDayDifference(createdOnIsoDate, targetIsoDate);

      return {
        id: task.id,
        kind: "stale_inbox" as const,
        title: task.title,
        route: "/inbox",
        label: formatStaleInboxLabel(ageDays),
        ageDays,
        scheduledForDate: null,
        createdAt: task.createdAt.toISOString(),
        notes: task.notes,
        taskKind: fromPrismaTaskKind(task.kind),
        reminderAt: task.reminderAt?.toISOString() ?? null,
        originType: fromPrismaTaskOriginType(task.originType),
      };
    }),
  ];
  const accountabilityRadar: AccountabilityRadar = {
    overdueTaskCount: overdueTasks.length,
    staleInboxCount: staleInboxTasks.length,
    totalCount: accountabilityItems.length,
    overflowCount: Math.max(accountabilityItems.length - ACCOUNTABILITY_SURFACED_ITEMS, 0),
    items: accountabilityItems.slice(0, ACCOUNTABILITY_SURFACED_ITEMS),
  };

  const attentionItems: AttentionItem[] = [];
  const now = new Date();
  const openDailyReviewRoute =
    targetIsoDate === currentIsoDate ? getOpenDailyReviewRoute(now, preferences) : null;
  const openDailyReviewDate = openDailyReviewRoute?.split("date=")[1] ?? null;
  const openDailyReviewCycle = openDailyReviewDate
      ? openDailyReviewDate === targetIsoDate
      ? dayCycle
      : await ensureCycle(app.prisma, {
          userId,
          cycleType: "DAY",
          cycleStartDate: parseIsoDate(openDailyReviewDate as IsoDateString),
          cycleEndDate: parseIsoDate(openDailyReviewDate as IsoDateString),
        })
    : null;
  const dailyReviewAvailable = Boolean(openDailyReviewRoute && openDailyReviewCycle && !openDailyReviewCycle.dailyReview);
  for (const item of todayAdminItems.slice(0, 2)) {
    attentionItems.push({
      id: item.id,
      title: item.title,
      kind: "admin",
      tone: "urgent",
      detail: "Open Finance to handle the bill.",
      dismissible: true,
      action: {
        type: "open_destination",
        destination: {
          kind: "finance_bills",
          adminItemId: item.id,
          section: "due_now",
        },
      },
    });
  }
  const upcomingAdminItem = monthlyPendingAdminItems.find((item) => toIsoDateString(item.dueOn) > targetIsoDate);
  if (todayAdminItems.length === 0 && upcomingAdminItem) {
    attentionItems.push({
      id: `upcoming-admin:${upcomingAdminItem.id}`,
      title: upcomingAdminItem.title,
      kind: "finance",
      tone: "warning",
      detail: `Upcoming on ${toIsoDateString(upcomingAdminItem.dueOn)}.`,
      dismissible: true,
      action: {
        type: "open_destination",
        destination: {
          kind: "finance_bills",
          adminItemId: upcomingAdminItem.id,
          section: "pending_bills",
        },
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
    ? habits.find((habit) => habit.id === weekCycle.weeklyReview?.focusHabitId)
    : null;
  const weeklyChallenge =
    weeklyChallengeHabit && !isHabitPermanentlyInactive(weeklyChallengeHabit)
      ? (() => {
          const checkins = recentHabitCheckins.filter((checkin) => checkin.habitId === weeklyChallengeHabit.id);
          const challenge = calculateWeeklyHabitChallenge({
          habit: {
            id: weeklyChallengeHabit.id,
            title: weeklyChallengeHabit.title,
          },
          checkins,
          scheduleInput: resolveHabitRecurrence(weeklyChallengeHabit, targetIsoDate),
          weekStartIsoDate,
          targetIsoDate,
          pauseWindows: weeklyChallengeHabit.pauseWindows,
          targetPerDay: weeklyChallengeHabit.targetPerDay,
          });

          return challenge.weekTarget > 0 ? challenge : null;
        })()
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
    planning: {
      date: targetIsoDate,
      hasPlannerBlocks: plannerBlockCount > 0,
      pendingPriorityCount: dayCycle.priorities.filter((priority) => priority.status !== "COMPLETED" && priority.status !== "DROPPED").length,
      openTaskCount: tasks.filter((task) => task.status === "PENDING").length,
    },
    accountability: {
      staleInboxCount: staleInboxTasks.length,
      staleInboxTaskId: staleInboxTasks[0]?.id ?? null,
      overdueTaskCount: overdueTasks.length,
      overdueTaskId: overdueTasks[0]?.id ?? null,
    },
    weeklyChallenge,
    dailyReviewAvailable,
    dailyReviewRoute: dailyReviewAvailable ? openDailyReviewRoute : null,
    currentHour: targetIsoDate === currentIsoDate ? getUserLocalHour(now, preferences?.timezone) : 12,
    health: {
      waterMl: healthSummary.waterMl,
      waterTargetMl: healthSummary.waterTargetMl,
    },
  });

  return withGeneratedAt({
    date: targetIsoDate,
    greeting: getLocalGreeting(now, preferences?.timezone),
    phase: currentHomePhase(now, preferences?.timezone),
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
      dueAt: task.dueAt?.toISOString() ?? null,
      goalId: task.goalId,
      goal: task.goal ? serializeGoalSummary(task.goal) : null,
      notes: task.notes,
      kind: fromPrismaTaskKind(task.kind),
      reminderAt: task.reminderAt?.toISOString() ?? null,
      originType: fromPrismaTaskOriginType(task.originType),
    })),
    routineSummary,
    habitSummary,
    healthSummary,
    financeSummary: {
      spentThisMonthMinor: expenses.reduce((sum, expense) => sum + expense.amountMinor, 0),
      currencyCode: preferences?.currencyCode ?? "USD",
      budgetLabel: expenses.length === 0 ? "No spend logged" : "Current month spend",
      upcomingBills: monthlyPendingAdminItems.length,
    },
    accountabilityRadar,
    attentionItems: attentionItems.slice(0, 6),
    notifications: homeNotifications,
    guidance,
  });
}

export const registerHomeRoutes: FastifyPluginAsync = async (app) => {
  const quoteService = createHomeQuoteService();

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

  app.get("/quote", async (request, reply): Promise<HomeQuoteResponse> => {
    requireAuthenticatedUser(request);

    return reply.send(
      withGeneratedAt({
        quote: await quoteService.getQuote(),
      }),
    );
  });

  app.get("/overview/history/:date", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { date } = request.params as { date: IsoDateString };
    const targetDate = parseIsoDate(parseOrThrow(isoDateSchema, date));

    return reply.send(await buildHomeOverview(app, user.id, targetDate));
  });
};
