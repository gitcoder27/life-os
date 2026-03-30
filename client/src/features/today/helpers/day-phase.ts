export type DayPhase = "morning" | "midday" | "late_day" | "end_of_day";

export function getDayPhase(now: Date): DayPhase {
  const hours = now.getHours();
  if (hours < 11) return "morning";
  if (hours < 16) return "midday";
  if (hours < 20) return "late_day";
  return "end_of_day";
}

export function getDayPhaseLabel(phase: DayPhase): string {
  switch (phase) {
    case "morning": return "Morning";
    case "midday": return "Midday";
    case "late_day": return "Late day";
    case "end_of_day": return "End of day";
  }
}

export function getDayPhasePrompt(
  phase: DayPhase,
  context: {
    priorityCount: number;
    pendingTaskCount: number;
    completedTaskCount: number;
    hasDrift: boolean;
  },
): string {
  const { priorityCount, pendingTaskCount, completedTaskCount, hasDrift } = context;

  switch (phase) {
    case "morning":
      if (priorityCount === 0) return "Set your top 3 before you start";
      if (pendingTaskCount > 0 && completedTaskCount === 0) return "Ready to start the day";
      return "Morning momentum";

    case "midday":
      if (hasDrift) return "Some blocks have drifted — refocus";
      if (pendingTaskCount === 0) return "All clear — ahead of schedule";
      return `${pendingTaskCount} to go — stay on track`;

    case "late_day":
      if (pendingTaskCount === 0) return "Everything done — strong finish";
      if (pendingTaskCount <= 3) return `${pendingTaskCount} left — finish or carry forward`;
      return "Wind down — decide what stays and what moves";

    case "end_of_day":
      if (pendingTaskCount === 0) return "Day complete";
      return `${pendingTaskCount} item${pendingTaskCount === 1 ? "" : "s"} to close out`;
  }
}

export function getWinStatus(
  pendingPriorityCount: number,
  totalPriorityCount: number,
  completedTaskCount: number,
  totalTaskCount: number,
): string {
  if (totalPriorityCount === 0) return "No priorities set yet";
  if (pendingPriorityCount === 0) return "All priorities complete — you won the day";
  const remaining = pendingPriorityCount;
  return `${remaining} thing${remaining === 1 ? "" : "s"} left to win today`;
}

export function formatTodayDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
