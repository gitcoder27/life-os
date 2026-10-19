import type {
  GoalHealthState,
  GoalHorizonSystemKey,
  GoalMilestoneCounts,
  GoalMilestoneStatus,
  GoalMomentumSummary,
  GoalStatus,
} from "@life-os/contracts";

import { addDays } from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const LONG_HORIZON_SYSTEM_KEYS: ReadonlySet<GoalHorizonSystemKey> = new Set(["life_vision", "five_year"]);
const LONG_HORIZON_MIN_SPAN_MONTHS = 36;
const DEFINE_NEXT_MILESTONE_ACTION = "Define the next milestone";

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
  goalStatus: GoalStatus;
  targetDate: Date | null;
  milestones: GoalInsightMilestone[];
  pendingTasks: GoalInsightTask[];
  habits: GoalInsightHabit[];
  completionDates: Date[];
  contextDate: Date;
}

export interface GoalTreeNodeInput extends Omit<GoalInsightsInput, "contextDate"> {
  id: string;
  parentGoalId: string | null;
  horizonSystemKey: GoalHorizonSystemKey | null;
  horizonSpanMonths: number | null;
}

export interface GoalInsightsResult {
  progressPercent: number;
  health: GoalHealthState | null;
  nextBestAction: string | null;
  milestoneCounts: GoalMilestoneCounts;
  momentum: GoalMomentumSummary;
  lastActivityAt: string | null;
}

interface ResolvedGoalInsights {
  result: GoalInsightsResult;
  progressRatio: number;
  completionDates: Date[];
}

interface ResolvedGoalChild {
  node: GoalTreeNodeInput;
  insights: ResolvedGoalInsights;
}

// Paused or archived goals drop out of their parent's roll-up, along with everything beneath them.
export function countsTowardParentGoal(status: GoalStatus) {
  return status === "active" || status === "completed";
}

function isLongHorizonGoal(node: GoalTreeNodeInput) {
  return (
    (node.horizonSystemKey !== null && LONG_HORIZON_SYSTEM_KEYS.has(node.horizonSystemKey))
    || (node.horizonSpanMonths !== null && node.horizonSpanMonths >= LONG_HORIZON_MIN_SPAN_MONTHS)
  );
}

function getHealthRank(health: GoalHealthState | null) {
  switch (health) {
    case "stalled":
      return 0;
    case "drifting":
      return 1;
    case "on_track":
      return 2;
    case "achieved":
      return 3;
    default:
      return 4;
  }
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

function deriveProgressRatio(
  node: GoalTreeNodeInput,
  milestoneCounts: GoalMilestoneCounts,
  children: ResolvedGoalChild[],
) {
  if (node.goalStatus === "completed") {
    return 1;
  }

  // Each counted child is one unit; the goal's own milestones together form one more.
  const units = children.map((child) => child.insights.progressRatio);

  if (milestoneCounts.total > 0) {
    units.push(milestoneCounts.completed / milestoneCounts.total);
  }

  if (units.length === 0) {
    return 0;
  }

  return units.reduce((sum, unit) => sum + unit, 0) / units.length;
}

function isRolledUpComplete(
  milestoneCounts: GoalMilestoneCounts,
  children: ResolvedGoalChild[],
  progressRatio: number,
) {
  return (milestoneCounts.total > 0 || children.length > 0) && progressRatio >= 1;
}

function deriveActivityHealthState(
  node: GoalTreeNodeInput,
  milestoneCounts: GoalMilestoneCounts,
  children: ResolvedGoalChild[],
  progressRatio: number,
  completionDates: Date[],
  contextDate: Date,
): GoalHealthState | null {
  if (node.goalStatus === "completed") {
    return "achieved";
  }

  if (node.goalStatus !== "active") {
    return null;
  }

  if (isRolledUpComplete(milestoneCounts, children, progressRatio)) {
    return "achieved";
  }

  const recent7Start = addDays(contextDate, -6).getTime();
  const recent14Start = addDays(contextDate, -13).getTime();
  const hasRecent7dCompletion = completionDates.some((date) => date.getTime() >= recent7Start);
  const hasRecent14dCompletion = completionDates.some((date) => date.getTime() >= recent14Start);
  const hasOverdueMilestone = milestoneCounts.overdue > 0;
  const hasOpenWork =
    milestoneCounts.pending > 0 || children.some((child) => child.insights.progressRatio < 1);
  const targetPast = node.targetDate ? getDaysUntil(node.targetDate, contextDate) < 0 : false;
  const targetWithin14d =
    node.targetDate
      ? (() => {
          const daysUntilTarget = getDaysUntil(node.targetDate, contextDate);
          return daysUntilTarget >= 0 && daysUntilTarget <= 14;
        })()
      : false;

  if (!hasRecent14dCompletion && (targetPast || hasOverdueMilestone)) {
    return "stalled";
  }

  if (!hasRecent7dCompletion || hasOverdueMilestone || (targetWithin14d && hasOpenWork)) {
    return "drifting";
  }

  return "on_track";
}

// Long-horizon goals are about direction, not pace: they report the best health among their active children.
function deriveInheritedHealthState(
  node: GoalTreeNodeInput,
  milestoneCounts: GoalMilestoneCounts,
  children: ResolvedGoalChild[],
  progressRatio: number,
): GoalHealthState | null {
  if (node.goalStatus === "completed") {
    return "achieved";
  }

  if (node.goalStatus !== "active") {
    return null;
  }

  if (isRolledUpComplete(milestoneCounts, children, progressRatio)) {
    return "achieved";
  }

  const childHealthStates = children
    .filter((child) => child.node.goalStatus === "active")
    .map((child) => child.insights.result.health)
    .filter((health): health is GoalHealthState => health !== null);

  if (childHealthStates.some((health) => health === "on_track" || health === "achieved")) {
    return "on_track";
  }

  if (childHealthStates.includes("drifting")) {
    return "drifting";
  }

  if (childHealthStates.includes("stalled")) {
    return "stalled";
  }

  return null;
}

function pickChildNextBestAction(children: ResolvedGoalChild[]) {
  const candidate = children
    .filter(
      (child) =>
        child.node.goalStatus === "active"
        && child.insights.result.nextBestAction !== null
        && child.insights.result.nextBestAction !== DEFINE_NEXT_MILESTONE_ACTION,
    )
    .sort((left, right) => {
      const healthDiff = getHealthRank(left.insights.result.health) - getHealthRank(right.insights.result.health);

      if (healthDiff !== 0) {
        return healthDiff;
      }

      return compareOptionalDates(left.node.targetDate, right.node.targetDate);
    })[0];

  return candidate?.insights.result.nextBestAction ?? null;
}

function deriveNextBestAction(
  node: GoalTreeNodeInput,
  health: GoalHealthState | null,
  children: ResolvedGoalChild[],
  longHorizon: boolean,
): string | null {
  if (node.goalStatus !== "active" || health === "achieved") {
    return null;
  }

  const nextMilestone = node.milestones
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

  const nextTask = [...node.pendingTasks].sort((left, right) => {
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

  const dueHabit = node.habits.find((habit) => habit.dueToday && !habit.completedToday);

  if (dueHabit) {
    return `Complete habit: ${dueHabit.title}`;
  }

  const childAction = pickChildNextBestAction(children);

  if (childAction) {
    return childAction;
  }

  return longHorizon ? null : DEFINE_NEXT_MILESTONE_ACTION;
}

function deriveGoalNodeInsights(
  node: GoalTreeNodeInput,
  children: ResolvedGoalChild[],
  contextDate: Date,
): ResolvedGoalInsights {
  const milestoneCounts = buildMilestoneCounts(node.milestones, contextDate);
  const completionDates = [
    ...node.completionDates,
    ...children.flatMap((child) => child.insights.completionDates),
  ];
  const progressRatio = deriveProgressRatio(node, milestoneCounts, children);
  const longHorizon = isLongHorizonGoal(node);
  const health = longHorizon
    ? deriveInheritedHealthState(node, milestoneCounts, children, progressRatio)
    : deriveActivityHealthState(node, milestoneCounts, children, progressRatio, completionDates, contextDate);
  const nextBestAction = deriveNextBestAction(node, health, children, longHorizon);
  const lastActivityAt = completionDates.reduce<Date | null>(
    (latest, date) => (!latest || date.getTime() > latest.getTime() ? date : latest),
    null,
  );

  return {
    result: {
      progressPercent: Math.round(progressRatio * 100),
      health,
      nextBestAction,
      milestoneCounts,
      momentum: buildMomentum(completionDates, contextDate),
      lastActivityAt: lastActivityAt?.toISOString() ?? null,
    },
    progressRatio,
    completionDates,
  };
}

// Rolls activity, progress, health and next action up the goal hierarchy. Pass each goal together with
// its descendants; parents outside the set are ignored.
export function buildGoalTreeInsights(
  nodes: GoalTreeNodeInput[],
  contextDate: Date,
): Map<string, GoalInsightsResult> {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const childrenByParentId = new Map<string, GoalTreeNodeInput[]>();

  for (const node of nodes) {
    if (!node.parentGoalId || node.parentGoalId === node.id || !nodeIds.has(node.parentGoalId)) {
      continue;
    }

    const bucket = childrenByParentId.get(node.parentGoalId) ?? [];
    bucket.push(node);
    childrenByParentId.set(node.parentGoalId, bucket);
  }

  const resolved = new Map<string, ResolvedGoalInsights>();
  const resolving = new Set<string>();

  function resolve(node: GoalTreeNodeInput): ResolvedGoalInsights {
    const cached = resolved.get(node.id);

    if (cached) {
      return cached;
    }

    resolving.add(node.id);
    const children = (childrenByParentId.get(node.id) ?? [])
      .filter((child) => !resolving.has(child.id) && countsTowardParentGoal(child.goalStatus))
      .map((child) => ({ node: child, insights: resolve(child) }));
    resolving.delete(node.id);

    const insights = deriveGoalNodeInsights(node, children, contextDate);
    resolved.set(node.id, insights);

    return insights;
  }

  return new Map(nodes.map((node) => [node.id, resolve(node).result]));
}

export function buildGoalInsights(input: GoalInsightsInput): GoalInsightsResult {
  const { contextDate, ...node } = input;

  return deriveGoalNodeInsights(
    {
      ...node,
      id: "goal",
      parentGoalId: null,
      horizonSystemKey: null,
      horizonSpanMonths: null,
    },
    [],
    contextDate,
  ).result;
}
