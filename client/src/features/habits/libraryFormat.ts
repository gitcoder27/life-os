import { DAY_LABELS_SHORT, formatRecurrenceSummary } from "../../shared/lib/recurrence";

import type { HabitItem, Routine } from "./types";

function formatDays(days: number[]) {
  const sorted = [...new Set(days)].sort((left, right) => left - right);
  if (sorted.length === 0 || sorted.length === 7) return "Every day";
  if (sorted.join() === "1,2,3,4,5") return "Weekdays";
  if (sorted.join() === "0,6") return "Weekends";
  return sorted.map((day) => DAY_LABELS_SHORT[day]).join(", ");
}

/** Short, plain schedule for the habits list: "Every day", "Weekdays", "Mon, Thu". */
export function habitScheduleLabel(habit: Pick<HabitItem, "recurrence" | "scheduleRule">) {
  const rule = habit.recurrence?.rule;

  if (!rule) return formatDays(habit.scheduleRule.daysOfWeek ?? []);

  switch (rule.frequency) {
    case "daily":
      return "Every day";
    case "weekly":
      return rule.daysOfWeek?.length ? formatDays(rule.daysOfWeek) : "Weekly";
    case "interval":
      return (rule.interval ?? 1) <= 1 ? "Every day" : `Every ${rule.interval} days`;
    default:
      return formatRecurrenceSummary(rule);
  }
}

export function habitMetaItems(habit: HabitItem) {
  return [
    habitScheduleLabel(habit),
    habit.timingLabel ?? "Anytime",
    `${habit.durationMinutes} min`,
    habit.targetPerDay > 1 ? `${habit.targetPerDay} times a day` : null,
    habit.goal?.title ?? null,
    habit.category,
  ].filter((item): item is string => Boolean(item));
}

export function routineMetaItems(routine: Routine) {
  const steps = routine.items.length;
  return [
    `${steps} ${steps === 1 ? "step" : "steps"}`,
    routine.timingLabel,
    routine.status === "active" && steps > 0 ? `${routine.completedItems} of ${steps} today` : null,
  ].filter((item): item is string => Boolean(item));
}

function formatPauseDate(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? isoDate
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function pauseWindowLabel(window: HabitItem["pauseWindows"][number]) {
  const kind = window.kind === "rest_day" ? "Rest day" : "Vacation";
  if (window.isActiveToday && window.startsOn === window.endsOn) return `${kind} today`;

  const dates =
    window.startsOn === window.endsOn
      ? formatPauseDate(window.startsOn)
      : `${formatPauseDate(window.startsOn)} to ${formatPauseDate(window.endsOn)}`;

  return window.isActiveToday ? `${kind} now, ${dates}` : `${kind}, ${dates}`;
}

export function pauseWindowActionLabel(window: HabitItem["pauseWindows"][number]) {
  return window.isActiveToday ? "End" : "Remove";
}
