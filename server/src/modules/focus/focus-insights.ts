import type {
  FocusSessionExitReason,
  FocusSessionHistoryItem,
  FocusTaskInsight,
} from "@life-os/contracts";

const RECENT_SESSION_LIMIT = 5;
const MINIMUM_PLANNED_MINUTES = 5;
const MAXIMUM_PLANNED_MINUTES = 180;
const RECOMMENDED_MINUTE_STEP = 5;
const SHORTFALL_RATIO_THRESHOLD = 0.7;

export interface FocusInsightSessionInput {
  id: string;
  depth: FocusSessionHistoryItem["depth"];
  plannedMinutes: number;
  startedAt: Date;
  endedAt: Date | null;
  status: FocusSessionHistoryItem["status"];
  exitReason: FocusSessionExitReason | null;
}

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

const roundAverageMinutes = (values: number[]) => {
  if (values.length === 0) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);

  return Math.round(total / values.length);
};

const roundToPracticalMinutes = (minutes: number) => {
  const roundedMinutes = Math.round(minutes / RECOMMENDED_MINUTE_STEP) * RECOMMENDED_MINUTE_STEP;

  return clamp(roundedMinutes, MINIMUM_PLANNED_MINUTES, MAXIMUM_PLANNED_MINUTES);
};

const toHistoryItem = (session: FocusInsightSessionInput): FocusSessionHistoryItem => {
  return {
    id: session.id,
    depth: session.depth,
    plannedMinutes: session.plannedMinutes,
    actualMinutes: getFocusSessionActualMinutes(session.startedAt, session.endedAt),
    status: session.status,
    exitReason: session.exitReason,
    endedAt: session.endedAt?.toISOString() ?? null,
  };
};

const getMostCommonExitReason = (sessions: FocusInsightSessionInput[]) => {
  const exitReasonCounts = new Map<FocusSessionExitReason, number>();

  for (const session of sessions) {
    if (!session.exitReason) {
      continue;
    }

    exitReasonCounts.set(session.exitReason, (exitReasonCounts.get(session.exitReason) ?? 0) + 1);
  }

  let mostCommonExitReason: FocusSessionExitReason | null = null;
  let highestCount = 0;

  for (const session of sessions) {
    if (!session.exitReason) {
      continue;
    }

    const count = exitReasonCounts.get(session.exitReason) ?? 0;
    if (count > highestCount) {
      mostCommonExitReason = session.exitReason;
      highestCount = count;
    }
  }

  return mostCommonExitReason;
};

export const getFocusSessionActualMinutes = (startedAt: Date, endedAt: Date | null) => {
  if (!endedAt) {
    return null;
  }

  const elapsedMilliseconds = endedAt.getTime() - startedAt.getTime();
  const elapsedMinutes = Math.round(elapsedMilliseconds / 60000);

  return Math.max(0, elapsedMinutes);
};

export const buildFocusTaskInsight = (
  taskId: string,
  recentEndedSessions: FocusInsightSessionInput[],
): FocusTaskInsight => {
  const recentHistoryInputs = recentEndedSessions.slice(0, RECENT_SESSION_LIMIT);
  const recentSessions = recentHistoryInputs.map(toHistoryItem);
  const totalSessions = recentSessions.length;
  const completedSessions = recentSessions.filter((session) => session.status === "completed").length;
  const abortedSessions = recentSessions.filter((session) => session.status === "aborted").length;
  const averagePlannedMinutes = roundAverageMinutes(
    recentSessions.map((session) => session.plannedMinutes),
  );
  const averageActualMinutes = roundAverageMinutes(
    recentSessions
      .map((session) => session.actualMinutes)
      .filter((minutes): minutes is number => minutes !== null),
  );
  const mostCommonExitReason = getMostCommonExitReason(recentHistoryInputs);
  const unclearAbortCount = recentSessions.filter(
    (session) => session.status === "aborted" && session.exitReason === "unclear",
  ).length;

  if (unclearAbortCount >= 2) {
    return {
      taskId,
      totalSessions,
      completedSessions,
      abortedSessions,
      averagePlannedMinutes,
      averageActualMinutes,
      mostCommonExitReason,
      recommendedPlannedMinutes: null,
      suggestedAdjustment: "clarify_next_action",
      summaryMessage:
        "This task has ended as unclear a few times recently. Tighten the next visible action before the next session.",
      recentSessions,
    };
  }

  if (
    totalSessions >= 2 &&
    averagePlannedMinutes !== null &&
    averageActualMinutes !== null &&
    averageActualMinutes < averagePlannedMinutes * SHORTFALL_RATIO_THRESHOLD
  ) {
    return {
      taskId,
      totalSessions,
      completedSessions,
      abortedSessions,
      averagePlannedMinutes,
      averageActualMinutes,
      mostCommonExitReason,
      recommendedPlannedMinutes: roundToPracticalMinutes(averageActualMinutes),
      suggestedAdjustment: "shorten_session",
      summaryMessage:
        "Recent focus sessions on this task usually end earlier than planned. Try a shorter session.",
      recentSessions,
    };
  }

  if (totalSessions === 0) {
    return {
      taskId,
      totalSessions,
      completedSessions,
      abortedSessions,
      averagePlannedMinutes,
      averageActualMinutes,
      mostCommonExitReason,
      recommendedPlannedMinutes: null,
      suggestedAdjustment: "keep_current_setup",
      summaryMessage:
        "No recent focus history on this task yet. Keep the current setup and see how the next session feels.",
      recentSessions,
    };
  }

  return {
    taskId,
    totalSessions,
    completedSessions,
    abortedSessions,
    averagePlannedMinutes,
    averageActualMinutes,
    mostCommonExitReason,
    recommendedPlannedMinutes: null,
    suggestedAdjustment: "keep_current_setup",
    summaryMessage: "Recent sessions on this task look stable. Keep the current setup.",
    recentSessions,
  };
};
