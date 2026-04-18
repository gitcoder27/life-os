import type {
  IsoDateString,
  WeeklyCapacityAssessment,
  WeeklyCapacityMode,
  WeeklyCapacityProgress,
  WeeklyCapacityProgressStatus,
  WeeklyCapacityProfile,
  WeeklyCapacitySignal,
} from "@life-os/contracts";
import type { PlanningCycle, WeeklyCapacityMode as PrismaWeeklyCapacityMode } from "@prisma/client";

import { getDateRangeWindowUtc, normalizeTimezone } from "../../lib/time/user-time.js";
import type { PlanningApp } from "./planning-types.js";

type WeekPriorityInput = {
  goalId: string | null;
};

type WeekTaskInput = {
  goalId: string | null;
  estimatedDurationMinutes: number | null;
};

type WeekCycleWithCapacity = Pick<
  PlanningCycle,
  "id" | "userId" | "cycleStartDate" | "cycleEndDate" | "weeklyCapacityMode" | "weeklyDeepWorkBlockTarget"
> & {
  priorities: WeekPriorityInput[];
};

type CapacityThresholds = {
  healthy: {
    priorities: number;
    estimatedMinutes: number;
    unsizedTasks: number;
    focusGoals: number;
    deepWorkTarget: number;
  };
  overloaded: {
    priorities: number;
    estimatedMinutes: number;
    unsizedTasks: number;
    focusGoals: number;
    deepWorkTarget: number;
  };
};

const DEFAULT_DEEP_WORK_BLOCK_TARGETS: Record<WeeklyCapacityMode, number> = {
  light: 2,
  standard: 4,
  heavy: 6,
};

const CAPACITY_THRESHOLDS: Record<WeeklyCapacityMode, CapacityThresholds> = {
  light: {
    healthy: {
      priorities: 2,
      estimatedMinutes: 240,
      unsizedTasks: 2,
      focusGoals: 2,
      deepWorkTarget: 2,
    },
    overloaded: {
      priorities: 2,
      estimatedMinutes: 360,
      unsizedTasks: 4,
      focusGoals: 3,
      deepWorkTarget: 3,
    },
  },
  standard: {
    healthy: {
      priorities: 3,
      estimatedMinutes: 480,
      unsizedTasks: 3,
      focusGoals: 3,
      deepWorkTarget: 4,
    },
    overloaded: {
      priorities: 3,
      estimatedMinutes: 720,
      unsizedTasks: 6,
      focusGoals: 4,
      deepWorkTarget: 6,
    },
  },
  heavy: {
    healthy: {
      priorities: 3,
      estimatedMinutes: 720,
      unsizedTasks: 4,
      focusGoals: 4,
      deepWorkTarget: 6,
    },
    overloaded: {
      priorities: 3,
      estimatedMinutes: 960,
      unsizedTasks: 7,
      focusGoals: 5,
      deepWorkTarget: 8,
    },
  },
};

const SIGNAL_ORDER: Array<{
  signal: WeeklyCapacitySignal;
  getValue: (metrics: CapacityMetrics) => number;
  getThreshold: (thresholds: CapacityThresholds) => { healthy: number; overloaded: number };
}> = [
  {
    signal: "too_many_priorities",
    getValue: (metrics) => metrics.plannedPriorityCount,
    getThreshold: (thresholds) => ({
      healthy: thresholds.healthy.priorities,
      overloaded: thresholds.overloaded.priorities,
    }),
  },
  {
    signal: "too_many_estimated_minutes",
    getValue: (metrics) => metrics.estimatedMinutesTotal,
    getThreshold: (thresholds) => ({
      healthy: thresholds.healthy.estimatedMinutes,
      overloaded: thresholds.overloaded.estimatedMinutes,
    }),
  },
  {
    signal: "too_many_unsized_tasks",
    getValue: (metrics) => metrics.unsizedTaskCount,
    getThreshold: (thresholds) => ({
      healthy: thresholds.healthy.unsizedTasks,
      overloaded: thresholds.overloaded.unsizedTasks,
    }),
  },
  {
    signal: "too_many_focus_goals",
    getValue: (metrics) => metrics.focusGoalCount,
    getThreshold: (thresholds) => ({
      healthy: thresholds.healthy.focusGoals,
      overloaded: thresholds.overloaded.focusGoals,
    }),
  },
  {
    signal: "deep_work_target_too_high",
    getValue: (metrics) => metrics.deepWorkBlockTarget,
    getThreshold: (thresholds) => ({
      healthy: thresholds.healthy.deepWorkTarget,
      overloaded: thresholds.overloaded.deepWorkTarget,
    }),
  },
];

type CapacityMetrics = {
  plannedPriorityCount: number;
  scheduledTaskCount: number;
  estimatedMinutesTotal: number;
  unsizedTaskCount: number;
  focusGoalCount: number;
  deepWorkBlockTarget: number;
};

export function fromPrismaWeeklyCapacityMode(
  mode: PrismaWeeklyCapacityMode | null | undefined,
): WeeklyCapacityMode {
  switch (mode) {
    case "LIGHT":
      return "light";
    case "HEAVY":
      return "heavy";
    case "STANDARD":
    default:
      return "standard";
  }
}

export function toPrismaWeeklyCapacityMode(mode: WeeklyCapacityMode): PrismaWeeklyCapacityMode {
  switch (mode) {
    case "light":
      return "LIGHT";
    case "heavy":
      return "HEAVY";
    case "standard":
    default:
      return "STANDARD";
  }
}

export function getDefaultDeepWorkBlockTarget(mode: WeeklyCapacityMode) {
  return DEFAULT_DEEP_WORK_BLOCK_TARGETS[mode];
}

function formatBlockCount(count: number) {
  return `${count} deep-work block${count === 1 ? "" : "s"}`;
}

export function resolveWeeklyCapacityProfile(input: {
  weeklyCapacityMode: PrismaWeeklyCapacityMode | null | undefined;
  weeklyDeepWorkBlockTarget: number | null | undefined;
}): WeeklyCapacityProfile {
  const capacityMode = fromPrismaWeeklyCapacityMode(input.weeklyCapacityMode);

  return {
    capacityMode,
    deepWorkBlockTarget: input.weeklyDeepWorkBlockTarget ?? getDefaultDeepWorkBlockTarget(capacityMode),
  };
}

function getMessageTail(signal: WeeklyCapacitySignal | undefined) {
  switch (signal) {
    case "too_many_priorities":
      return " Start by trimming a weekly priority.";
    case "too_many_estimated_minutes":
      return " Start by reducing planned work volume.";
    case "too_many_unsized_tasks":
      return " Start by sizing the unsized tasks before trusting the week.";
    case "too_many_focus_goals":
      return " Start by narrowing the active goals this week needs to carry.";
    case "deep_work_target_too_high":
      return " Start by lowering the deep-work target.";
    default:
      return "";
  }
}

function getPrimaryMessage(
  status: WeeklyCapacityAssessment["status"],
  mode: WeeklyCapacityMode,
  firstSignal: WeeklyCapacitySignal | undefined,
) {
  if (status === "healthy") {
    return `This week looks realistic for a ${mode} load.`;
  }

  const base =
    status === "tight"
      ? "This week is getting tight. Reduce one commitment before daily rescue becomes more likely."
      : `This week looks overloaded for a ${mode} week. Lower commitments before it starts spilling into every day.`;

  return `${base}${getMessageTail(firstSignal)}`;
}

export function computeWeeklyCapacityAssessment(input: {
  capacityProfile: WeeklyCapacityProfile;
  priorities: WeekPriorityInput[];
  tasks: WeekTaskInput[];
}): WeeklyCapacityAssessment {
  const metrics: CapacityMetrics = {
    plannedPriorityCount: input.priorities.length,
    scheduledTaskCount: input.tasks.length,
    estimatedMinutesTotal: input.tasks.reduce((sum, task) => sum + (task.estimatedDurationMinutes ?? 0), 0),
    unsizedTaskCount: input.tasks.filter((task) => task.estimatedDurationMinutes == null).length,
    focusGoalCount: new Set(
      [...input.priorities.map((priority) => priority.goalId), ...input.tasks.map((task) => task.goalId)].filter(
        (goalId): goalId is string => Boolean(goalId),
      ),
    ).size,
    deepWorkBlockTarget: input.capacityProfile.deepWorkBlockTarget,
  };
  const thresholds = CAPACITY_THRESHOLDS[input.capacityProfile.capacityMode];

  const overloadedSignals = SIGNAL_ORDER.filter(({ getValue, getThreshold }) => {
    const threshold = getThreshold(thresholds);
    return getValue(metrics) > threshold.overloaded;
  }).map(({ signal }) => signal);

  const tightSignals = SIGNAL_ORDER.filter(({ getValue, getThreshold }) => {
    const threshold = getThreshold(thresholds);
    const value = getValue(metrics);

    return value > threshold.healthy && value <= threshold.overloaded;
  }).map(({ signal }) => signal);

  const signals = [...new Set([...overloadedSignals, ...tightSignals])];
  const status: WeeklyCapacityAssessment["status"] =
    overloadedSignals.length > 0 ? "overloaded" : tightSignals.length > 0 ? "tight" : "healthy";

  return {
    status,
    plannedPriorityCount: metrics.plannedPriorityCount,
    scheduledTaskCount: metrics.scheduledTaskCount,
    estimatedMinutesTotal: metrics.estimatedMinutesTotal,
    unsizedTaskCount: metrics.unsizedTaskCount,
    focusGoalCount: metrics.focusGoalCount,
    primaryMessage: getPrimaryMessage(status, input.capacityProfile.capacityMode, signals[0]),
    signals,
  };
}

export function computeWeeklyCapacityProgress(input: {
  capacityProfile: WeeklyCapacityProfile;
  completedDeepBlocks: number;
}): WeeklyCapacityProgress {
  const plannedDeepWorkBlocks = input.capacityProfile.deepWorkBlockTarget;
  const completedDeepBlocks = input.completedDeepBlocks;
  const remainingDeepBlocks = Math.max(plannedDeepWorkBlocks - completedDeepBlocks, 0);
  const overBudgetBlocks = Math.max(completedDeepBlocks - plannedDeepWorkBlocks, 0);

  let status: WeeklyCapacityProgressStatus = "within_budget";
  let message = `${formatBlockCount(remainingDeepBlocks)} remaining this week.`;

  if (plannedDeepWorkBlocks === 0 && completedDeepBlocks === 0) {
    message = "No deep-work blocks planned this week.";
  } else if (overBudgetBlocks > 0) {
    status = "over_budget";
    message = `${formatBlockCount(overBudgetBlocks)} over budget this week.`;
  } else if (plannedDeepWorkBlocks > 0 && completedDeepBlocks === plannedDeepWorkBlocks) {
    status = "at_budget";
    message = "Deep-work budget reached for this week.";
  }

  return {
    completedDeepBlocks,
    remainingDeepBlocks,
    overBudgetBlocks,
    status,
    message,
  };
}

export async function countCompletedDeepBlocksForWeek(
  prisma: Pick<PlanningApp["prisma"], "focusSession">,
  input: {
    userId: string;
    startDate: IsoDateString;
    endDate: IsoDateString;
    timezone?: string | null;
  },
) {
  const rangeWindow = getDateRangeWindowUtc(input.startDate, input.endDate, normalizeTimezone(input.timezone));

  return prisma.focusSession.count({
    where: {
      userId: input.userId,
      status: "COMPLETED",
      depth: "DEEP",
      endedAt: {
        gte: rangeWindow.start,
        lt: rangeWindow.end,
      },
    },
  });
}

export async function buildWeeklyCapacityModel(app: PlanningApp, cycle: WeekCycleWithCapacity) {
  const capacityProfile = resolveWeeklyCapacityProfile({
    weeklyCapacityMode: cycle.weeklyCapacityMode,
    weeklyDeepWorkBlockTarget: cycle.weeklyDeepWorkBlockTarget,
  });
  const startDate = cycle.cycleStartDate.toISOString().slice(0, 10) as IsoDateString;
  const endDate = cycle.cycleEndDate.toISOString().slice(0, 10) as IsoDateString;
  const [tasks, preferences] = await Promise.all([
    app.prisma.task.findMany({
      where: {
        userId: cycle.userId,
        kind: "TASK",
        status: "PENDING",
        scheduledForDate: {
          gte: cycle.cycleStartDate,
          lte: cycle.cycleEndDate,
        },
      },
      select: {
        goalId: true,
        estimatedDurationMinutes: true,
      },
    }),
    app.prisma.userPreference.findUnique({
      where: {
        userId: cycle.userId,
      },
      select: {
        timezone: true,
      },
    }),
  ]);
  const completedDeepBlocks = await countCompletedDeepBlocksForWeek(app.prisma, {
    userId: cycle.userId,
    startDate,
    endDate,
    timezone: preferences?.timezone ?? null,
  });

  return {
    capacityProfile,
    capacityAssessment: computeWeeklyCapacityAssessment({
      capacityProfile,
      priorities: cycle.priorities,
      tasks,
    }),
    capacityProgress: computeWeeklyCapacityProgress({
      capacityProfile,
      completedDeepBlocks,
    }),
  };
}
