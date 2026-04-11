import type { RescueReason, RescueSuggestion } from "@life-os/contracts";

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
