import type {
  GoalHealthState,
  GoalMilestoneCounts,
  GoalMilestoneStatus,
  GoalMomentumSummary,
} from "@life-os/contracts";

import { addDays } from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface GoalInsightMilestone {
  title: string;
  status: GoalMilestoneStatus;
  targetDate: Date | null;
  sortOrder: number;
}

export interface GoalInsightTask {
  title: string;
  dueAt: Date | null;
  scheduledForDate: Date | null;
  createdAt: Date;
}

export interface GoalInsightHabit {
  title: string;
  dueToday: boolean;
  completedToday: boolean;
}

export interface GoalInsightsInput {
  goalStatus: "active" | "paused" | "completed" | "archived";
  targetDate: Date | null;
  milestones: GoalInsightMilestone[];
  pendingTasks: GoalInsightTask[];
  habits: GoalInsightHabit[];
  completionDates: Date[];
  contextDate: Date;
}

export interface GoalInsightsResult {
  progressPercent: number;
  health: GoalHealthState | null;
  nextBestAction: string | null;
  milestoneCounts: GoalMilestoneCounts;
  momentum: GoalMomentumSummary;
  lastActivityAt: string | null;
}

function getUtcDayValue(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function getDaysUntil(targetDate: Date, contextDate: Date) {
  return Math.floor((getUtcDayValue(targetDate) - getUtcDayValue(contextDate)) / DAY_MS);
}

function compareOptionalDates(left: Date | null, right: Date | null) {
  if (left && right) {
    return left.getTime() - right.getTime();
  }

  if (left) {
    return -1;
  }

  if (right) {
    return 1;
  }

  return 0;
}

function buildMilestoneCounts(
  milestones: GoalInsightMilestone[],
  contextDate: Date,
): GoalMilestoneCounts {
  const completed = milestones.filter((milestone) => milestone.status === "completed").length;
  const overdue = milestones.filter(
    (milestone) =>
      milestone.status !== "completed"
      && milestone.targetDate
      && getDaysUntil(milestone.targetDate, contextDate) < 0,
  ).length;

  return {
    total: milestones.length,
    completed,
    pending: milestones.length - completed,
    overdue,
  };
}

function buildMomentum(completionDates: Date[], contextDate: Date): GoalMomentumSummary {
  const buckets = Array.from({ length: 4 }, (_, index) => {
    const startDate = addDays(contextDate, -27 + index * 7);
    const endDate = addDays(startDate, 6);
    const endExclusive = addDays(endDate, 1);
    const completedCount = completionDates.filter(
      (date) => date.getTime() >= startDate.getTime() && date.getTime() < endExclusive.getTime(),
    ).length;

    return {
      startDate: toIsoDateString(startDate),
      endDate: toIsoDateString(endDate),
      completedCount,
    };
  });

  const previous = buckets[2]?.completedCount ?? 0;
  const latest = buckets[3]?.completedCount ?? 0;
  const trend = latest > previous ? "up" : latest < previous ? "down" : "steady";

  return {
    trend,
    buckets,
  };
}

function deriveHealthState(
  input: GoalInsightsInput,
  milestoneCounts: GoalMilestoneCounts,
): GoalHealthState | null {
  if (input.goalStatus === "completed") {
    return "achieved";
  }

  if (input.goalStatus !== "active") {
    return null;
  }

  if (milestoneCounts.total > 0 && milestoneCounts.completed === milestoneCounts.total) {
    return "achieved";
  }

  const recent7Start = addDays(input.contextDate, -6).getTime();
  const recent14Start = addDays(input.contextDate, -13).getTime();
  const hasRecent7dCompletion = input.completionDates.some((date) => date.getTime() >= recent7Start);
  const hasRecent14dCompletion = input.completionDates.some((date) => date.getTime() >= recent14Start);
  const hasOverdueMilestone = milestoneCounts.overdue > 0;
  const targetPast = input.targetDate ? getDaysUntil(input.targetDate, input.contextDate) < 0 : false;
  const targetWithin14d =
    input.targetDate
      ? (() => {
          const daysUntilTarget = getDaysUntil(input.targetDate, input.contextDate);
          return daysUntilTarget >= 0 && daysUntilTarget <= 14;
        })()
      : false;

  if (!hasRecent14dCompletion && (targetPast || hasOverdueMilestone)) {
    return "stalled";
  }

  if (!hasRecent7dCompletion || hasOverdueMilestone || (targetWithin14d && milestoneCounts.pending > 0)) {
    return "drifting";
  }

  return "on_track";
}

function deriveNextBestAction(
  input: GoalInsightsInput,
  health: GoalHealthState | null,
): string | null {
  if (input.goalStatus !== "active" || health === "achieved") {
    return null;
  }

  const nextMilestone = input.milestones
    .filter((milestone) => milestone.status !== "completed")
    .sort((left, right) => {
      const sortOrderDiff = left.sortOrder - right.sortOrder;

      if (sortOrderDiff !== 0) {
        return sortOrderDiff;
      }

      return compareOptionalDates(left.targetDate, right.targetDate);
    })[0];

  if (nextMilestone) {
    return `Complete milestone: ${nextMilestone.title}`;
  }

  const nextTask = [...input.pendingTasks].sort((left, right) => {
    const dueAtDiff = compareOptionalDates(left.dueAt, right.dueAt);

    if (dueAtDiff !== 0) {
      return dueAtDiff;
    }

    const scheduledDiff = compareOptionalDates(left.scheduledForDate, right.scheduledForDate);

    if (scheduledDiff !== 0) {
      return scheduledDiff;
    }

    return left.createdAt.getTime() - right.createdAt.getTime();
  })[0];

  if (nextTask) {
    return `Finish task: ${nextTask.title}`;
  }

  const dueHabit = input.habits.find((habit) => habit.dueToday && !habit.completedToday);

  if (dueHabit) {
    return `Complete habit: ${dueHabit.title}`;
  }

  return "Define the next milestone";
}

export function buildGoalInsights(input: GoalInsightsInput): GoalInsightsResult {
  const milestoneCounts = buildMilestoneCounts(input.milestones, input.contextDate);
  const progressPercent =
    milestoneCounts.total === 0
      ? 0
      : Math.round((milestoneCounts.completed / milestoneCounts.total) * 100);
  const momentum = buildMomentum(input.completionDates, input.contextDate);
  const health = deriveHealthState(input, milestoneCounts);
  const nextBestAction = deriveNextBestAction(input, health);
  const lastActivityAt = [...input.completionDates]
    .sort((left, right) => right.getTime() - left.getTime())[0]
    ?.toISOString() ?? null;

  return {
    progressPercent,
    health,
    nextBestAction,
    milestoneCounts,
    momentum,
    lastActivityAt,
  };
}
