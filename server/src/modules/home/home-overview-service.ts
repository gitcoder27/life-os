import type { FastifyInstance } from "fastify";
import type {
  HomeOverviewResponse,
  IsoDateString,
} from "@life-os/contracts";

import { withGeneratedAt } from "../../lib/http/response.js";
import {
  getMonthStartIsoDate,
  parseIsoDate,
} from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import {
  getDayWindowUtc,
  getLocalGreeting,
  getUserLocalHour,
  resolveDisplayTimezone,
} from "../../lib/time/user-time.js";
import { buildHomeGuidance } from "./guidance.js";
import { buildBehaviorState } from "../behavior/behavior-state-service.js";
import { loadHomeFinanceSummary } from "../finance/home-finance-summary-service.js";
import { getActiveFocusSession } from "../focus/service.js";
import { loadHomeHabitSummary } from "../habits/home-habit-summary-service.js";
import { loadHomeHealthSummary } from "../health/home-health-summary-service.js";
import { loadHomeNotifications } from "../notifications/home-notifications-service.js";
import {
  ensureHomeDayPlanningCycle,
  loadHomePlanningSummary,
} from "../planning/home-planning-summary-service.js";
import { getOpenDailyReviewRoute } from "../reviews/submission-window.js";
import { buildAccountabilityRadar } from "./home-accountability-radar.js";
import { serializeHomeGoalSummary, toHomeTaskKind, toHomeTaskOriginType } from "./home-mappers.js";

const ACCOUNTABILITY_LOOKBACK_DAYS = 30;

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

export async function buildHomeOverview(
  app: FastifyInstance,
  userId: string,
  targetDate: Date,
  fallbackTimezone?: string | null,
): Promise<HomeOverviewResponse> {
  const targetIsoDate = toIsoDateString(targetDate);
  const preferences = await app.prisma.userPreference.findUnique({
    where: {
      userId,
    },
  });
  const effectiveTimezone = resolveDisplayTimezone(preferences?.timezone, fallbackTimezone);
  const dayWindow = getDayWindowUtc(targetIsoDate, effectiveTimezone);
  const monthStartDate = parseIsoDate(getMonthStartIsoDate(targetIsoDate));
  const nextMonthStartDate = new Date(
    Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, 1),
  );
  const now = new Date();

  const [planning, healthSummary, financeHome, homeNotifications] =
    await Promise.all([
      loadHomePlanningSummary(app.prisma, {
        userId,
        targetDate,
        targetIsoDate,
        timezone: effectiveTimezone,
        weekStartsOn: preferences?.weekStartsOn ?? 1,
        overdueLookbackDays: ACCOUNTABILITY_LOOKBACK_DAYS,
        now,
      }),
      loadHomeHealthSummary(app.prisma, {
        userId,
        targetDate,
        dayWindow,
        waterTargetMl: preferences?.dailyWaterTargetMl ?? 2500,
      }),
      loadHomeFinanceSummary(app, {
        userId,
        targetDate,
        targetIsoDate,
        monthStartDate,
        nextMonthStartDate,
        currencyCode: preferences?.currencyCode ?? "USD",
      }),
      loadHomeNotifications(app.prisma, {
        userId,
        now,
      }),
    ]);
  const habitHome = await loadHomeHabitSummary(app.prisma, {
    userId,
    targetDate,
    targetIsoDate,
    currentIsoDate: planning.currentIsoDate,
    weekStartIsoDate: planning.weekStartIsoDate,
    weeklyFocusHabitId: planning.weekCycle.weeklyReview?.focusHabitId,
    timezone: effectiveTimezone,
    now,
  });

  const accountabilityRadar = buildAccountabilityRadar({
    overdueTasks: planning.overdueTasks,
    staleInboxTasks: planning.staleInboxTasks,
    targetIsoDate,
    timezone: effectiveTimezone,
  });

  const openDailyReviewRoute =
    targetIsoDate === planning.currentIsoDate ? getOpenDailyReviewRoute(now, preferences) : null;
  const openDailyReviewDate = openDailyReviewRoute?.split("date=")[1] ?? null;
  const openDailyReviewCycle = openDailyReviewDate
      ? openDailyReviewDate === targetIsoDate
      ? planning.dayCycle
      : await ensureHomeDayPlanningCycle(app.prisma, {
          userId,
          date: parseIsoDate(openDailyReviewDate as IsoDateString),
        })
    : null;
  const dailyReviewAvailable = Boolean(openDailyReviewRoute && openDailyReviewCycle && !openDailyReviewCycle.dailyReview);
  const guidance = buildHomeGuidance({
    score: {
      label: planning.score.label,
      value: planning.score.value,
      topReasons: planning.score.topReasons,
    },
    momentum: {
      strongDayStreak: planning.momentum.strongDayStreak,
    },
    habits: habitHome.habitItems.map((habit) => ({
      id: habit.id,
      title: habit.title,
      dueToday: habit.dueToday,
      completedToday: habit.completedToday,
      timingStatusToday: habit.timingStatusToday,
      timingLabel: habit.timingLabel,
      streakCount: habit.streakCount,
      risk: habit.risk,
    })),
    priorities: planning.dayCycle.priorities.map((priority) => ({
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
    tasks: planning.guidanceTasks,
    mustWinTask: planning.guidanceMustWinTask,
    planning: {
      date: targetIsoDate,
      hasPlannerBlocks: planning.plannerBlockCount > 0,
      pendingPriorityCount: planning.pendingPriorityCount,
      openTaskCount: planning.openTaskCount,
      launchComplete: Boolean(planning.dailyLaunch?.completedAt),
    },
    accountability: {
      staleInboxCount: planning.staleInboxTasks.length,
      staleInboxTaskId: planning.staleInboxTasks[0]?.id ?? null,
      overdueTaskCount: planning.overdueTasks.length,
      overdueTaskId: planning.overdueTasks[0]?.id ?? null,
    },
    weeklyChallenge: habitHome.weeklyChallenge,
    dailyReviewAvailable,
    dailyReviewRoute: dailyReviewAvailable ? openDailyReviewRoute : null,
    currentHour: targetIsoDate === planning.currentIsoDate ? getUserLocalHour(now, effectiveTimezone) : 12,
    health: {
      waterMl: healthSummary.waterMl,
      waterTargetMl: healthSummary.waterTargetMl,
    },
  });
  const activeFocusSession =
    targetIsoDate === planning.currentIsoDate
      ? await getActiveFocusSession(app.prisma, userId)
      : null;
  const behaviorState = buildBehaviorState({
    context: {
      userId,
      date: targetIsoDate,
      cycleId: planning.dayCycle.id,
      timezone: effectiveTimezone,
      launch: planning.serializedLaunch,
      mustWinTask: planning.serializedMustWinTask,
      priorities: planning.dayCycle.priorities.map((priority) => ({
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
        goal: priority.goal ? serializeHomeGoalSummary(priority.goal) : null,
        completedAt: priority.completedAt?.toISOString() ?? null,
      })),
      tasks: planning.serializedTasks,
      plannerBlocks: planning.plannerBlocks,
    },
    capacity: planning.behaviorCapacity,
    activeFocusSession,
    now,
    isLiveDate: targetIsoDate === planning.currentIsoDate,
    overdueTaskCount: planning.overdueTasks.length,
    hasMissedDayPattern: planning.hasMissedDayPattern,
  });

  return withGeneratedAt({
    date: targetIsoDate,
    greeting: getLocalGreeting(now, effectiveTimezone),
    phase: currentHomePhase(now, effectiveTimezone),
    launch: planning.serializedLaunch,
    mustWinTask: planning.serializedMustWinTask,
    rescueSuggestion: planning.rescueSuggestion,
    dailyScore: {
      value: planning.score.value,
      label: planning.score.label,
      earnedPoints: planning.score.earnedPoints,
      possiblePoints: planning.score.possiblePoints,
    },
    weeklyMomentum: planning.momentum.value,
    topPriorities: planning.dayCycle.priorities.map((priority) => ({
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
      goal: priority.goal ? serializeHomeGoalSummary(priority.goal) : null,
    })),
    tasks: planning.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status:
        task.status === "COMPLETED" ? "completed" : task.status === "DROPPED" ? "dropped" : "pending",
      scheduledForDate: task.scheduledForDate ? toIsoDateString(task.scheduledForDate) : null,
      dueAt: task.dueAt?.toISOString() ?? null,
      goalId: task.goalId,
      goal: task.goal ? serializeHomeGoalSummary(task.goal) : null,
      notes: task.notes,
      kind: toHomeTaskKind(task.kind),
      reminderAt: task.reminderAt?.toISOString() ?? null,
      originType: toHomeTaskOriginType(task.originType),
    })),
    routineSummary: habitHome.routineSummary,
    habitSummary: habitHome.habitSummary,
    healthSummary,
    financeSummary: financeHome.financeSummary,
    accountabilityRadar,
    attentionItems: financeHome.attentionItems.slice(0, 6),
    notifications: homeNotifications,
    guidance,
    behaviorState,
  });
}
