import type { PrismaClient } from "@prisma/client";
import type { RescueReason, RescueSuggestion } from "@life-os/contracts";
import { addDays } from "../../lib/time/cycle.js";

type LaunchLike = {
  dayMode?: "NORMAL" | "RESCUE" | "RECOVERY";
  energyRating?: number | null;
};

type TaskLike = {
  title: string;
  nextAction?: string | null;
  fiveMinuteVersion?: string | null;
  lastStuckAt?: Date | null;
};

const RECOVERY_REVIEW_FRICTION_TAGS = new Set([
  "low energy",
  "poor planning",
  "overcommitment",
]);

type PriorDayCycleRecord = {
  cycleStartDate: Date;
  dailyLaunch: {
    completedAt: Date | null;
    mustWinTask: {
      status: "PENDING" | "COMPLETED" | "DROPPED";
      progressState: "NOT_STARTED" | "STARTED" | "ADVANCED";
    } | null;
  } | null;
  dailyReview: {
    frictionTag: string;
  } | null;
};

function hasMeaningfulMustWinProgress(cycle: PriorDayCycleRecord | null | undefined) {
  const mustWinTask = cycle?.dailyLaunch?.mustWinTask;
  if (!mustWinTask) {
    return false;
  }

  return (
    mustWinTask.status === "COMPLETED" ||
    mustWinTask.progressState === "STARTED" ||
    mustWinTask.progressState === "ADVANCED"
  );
}

function isMissedDayCycle(cycle: PriorDayCycleRecord | null | undefined) {
  if (!cycle) {
    return false;
  }

  if (!cycle.dailyLaunch?.completedAt) {
    return true;
  }

  return !hasMeaningfulMustWinProgress(cycle);
}

function hasRecoveryRiskReviewSignal(cycles: PriorDayCycleRecord[]) {
  return cycles.some((cycle) =>
    cycle.dailyReview?.frictionTag
      ? RECOVERY_REVIEW_FRICTION_TAGS.has(cycle.dailyReview.frictionTag)
      : false,
  );
}

export async function detectMissedDayPattern(
  prisma: Pick<PrismaClient, "planningCycle">,
  input: {
    userId: string;
    targetDate: Date;
    overdueTaskCount: number;
  },
) {
  if (typeof prisma.planningCycle.findMany !== "function") {
    return false;
  }

  const previousCycleStart = addDays(input.targetDate, -1);
  const lookbackStart = addDays(input.targetDate, -2);
  const priorCyclesResult = await prisma.planningCycle.findMany({
    where: {
      userId: input.userId,
      cycleType: "DAY",
      cycleStartDate: {
        gte: lookbackStart,
        lt: input.targetDate,
      },
    },
    orderBy: {
      cycleStartDate: "desc",
    },
    include: {
      dailyLaunch: {
        include: {
          mustWinTask: {
            select: {
              status: true,
              progressState: true,
            },
          },
        },
      },
      dailyReview: {
        select: {
          frictionTag: true,
        },
      },
    },
  });
  const priorCycles = Array.isArray(priorCyclesResult) ? priorCyclesResult : [];

  const priorDayCycle =
    priorCycles.find((cycle) => cycle.cycleStartDate.getTime() === previousCycleStart.getTime()) ?? null;
  const secondPriorDayCycle =
    priorCycles.find((cycle) => cycle.cycleStartDate.getTime() === lookbackStart.getTime()) ?? null;

  const priorDayMissed = isMissedDayCycle(priorDayCycle);
  const secondPriorDayMissed = isMissedDayCycle(secondPriorDayCycle);
  const hasBacklogPressure = input.overdueTaskCount >= 1;
  const hasRecentRecoveryRisk = hasRecoveryRiskReviewSignal(priorCycles as PriorDayCycleRecord[]);

  return (
    (priorDayMissed && (hasBacklogPressure || hasRecentRecoveryRisk)) ||
    (priorDayMissed && secondPriorDayMissed)
  );
}

function buildMinimumViableAction(task: TaskLike | null) {
  if (!task) {
    return null;
  }

  return task.fiveMinuteVersion?.trim() || task.nextAction?.trim() || null;
}

function buildSuggestion(
  mode: RescueSuggestion["mode"],
  reason: RescueReason,
  task: TaskLike | null,
): RescueSuggestion {
  if (reason === "low_energy") {
    return {
      mode,
      reason,
      title: "Scale the day down",
      detail: "Low energy is a signal to protect continuity, not force a normal day.",
      minimumViableAction: buildMinimumViableAction(task),
    };
  }

  if (reason === "missed_day") {
    return {
      mode,
      reason,
      title: "Recover the day",
      detail: "Reset to one believable action and clear the backlog deliberately.",
      minimumViableAction: buildMinimumViableAction(task),
    };
  }

  if (reason === "interruption") {
    return {
      mode,
      reason,
      title: "Protect the remainder",
      detail: "The day was interrupted. Reduce commitments and keep one thing alive.",
      minimumViableAction: buildMinimumViableAction(task),
    };
  }

  return {
    mode,
    reason,
    title: "Enter Rescue Mode",
    detail: "The day looks overloaded. Shrink it before it turns into rollover and guilt.",
    minimumViableAction: buildMinimumViableAction(task),
  };
}

export function buildRescueSuggestion(input: {
  launch: LaunchLike | null;
  mustWinTask: TaskLike | null;
  pendingTaskCount: number;
  overdueTaskCount: number;
  hasMissedDayPattern?: boolean;
}) {
  if (input.launch?.dayMode === "RESCUE") {
    return buildSuggestion("rescue", "overload", input.mustWinTask);
  }

  if (input.launch?.dayMode === "RECOVERY") {
    return buildSuggestion("recovery", "missed_day", input.mustWinTask);
  }

  if ((input.launch?.energyRating ?? 3) <= 2) {
    return buildSuggestion("rescue", "low_energy", input.mustWinTask);
  }

  if (input.mustWinTask?.lastStuckAt) {
    return buildSuggestion("rescue", "interruption", input.mustWinTask);
  }

  if (input.overdueTaskCount >= 3 || input.pendingTaskCount >= 8) {
    return buildSuggestion("rescue", "overload", input.mustWinTask);
  }

  if (input.hasMissedDayPattern) {
    return buildSuggestion("recovery", "missed_day", input.mustWinTask);
  }

  return null;
}
