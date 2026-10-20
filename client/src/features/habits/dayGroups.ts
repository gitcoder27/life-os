import type { DueHabit, Routine } from "./types";

export type DayPart = "morning" | "afternoon" | "evening" | "anytime";

export const DAY_PART_LABELS: Record<DayPart, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  anytime: "Anytime",
};

const DAY_PART_ORDER: DayPart[] = ["morning", "afternoon", "evening", "anytime"];
const NOON = 12 * 60;
const EVENING = 17 * 60;

export type DayEntry =
  | { kind: "habit"; id: string; part: DayPart; startMinutes: number | null; done: boolean; habit: DueHabit }
  | { kind: "routine"; id: string; part: DayPart; startMinutes: number | null; done: boolean; routine: Routine };

export type DayGroup = {
  part: DayPart;
  entries: DayEntry[];
  doneCount: number;
};

export function habitStartMinutes(habit: Pick<DueHabit, "timingMode" | "targetTimeMinutes" | "windowStartMinutes">) {
  if (habit.timingMode === "exact_time") return habit.targetTimeMinutes ?? null;
  if (habit.timingMode === "time_window") return habit.windowStartMinutes ?? null;
  return null;
}

/** Start time used to place a routine; period routines sort to the start of their part of the day. */
export function routineStartMinutes(
  routine: Pick<Routine, "timingMode" | "period" | "windowStartMinutes">,
) {
  if (routine.timingMode === "custom_window") return routine.windowStartMinutes ?? null;
  if (routine.timingMode === "period") {
    if (routine.period === "morning") return 0;
    if (routine.period === "evening") return EVENING;
  }
  return null;
}

export function dayPartForMinutes(minutes: number | null): DayPart {
  if (minutes === null) return "anytime";
  if (minutes < NOON) return "morning";
  if (minutes < EVENING) return "afternoon";
  return "evening";
}

function entryLabel(entry: DayEntry) {
  return entry.kind === "habit" ? entry.habit.title : entry.routine.name;
}

function compareEntries(left: DayEntry, right: DayEntry) {
  const leftMinutes = left.startMinutes ?? Number.POSITIVE_INFINITY;
  const rightMinutes = right.startMinutes ?? Number.POSITIVE_INFINITY;
  if (leftMinutes !== rightMinutes) return leftMinutes - rightMinutes;
  return entryLabel(left).localeCompare(entryLabel(right));
}

/** Habits and routines for today, grouped by time of day and ordered by start time. */
export function buildDayGroups(habits: DueHabit[], routines: Routine[]): DayGroup[] {
  const entries: DayEntry[] = [
    ...habits.map((habit): DayEntry => {
      const startMinutes = habitStartMinutes(habit);
      return {
        kind: "habit",
        id: habit.id,
        part: dayPartForMinutes(startMinutes),
        startMinutes,
        done: habit.completedToday,
        habit,
      };
    }),
    ...routines.map((routine): DayEntry => {
      const startMinutes = routineStartMinutes(routine);
      return {
        kind: "routine",
        id: routine.id,
        part: dayPartForMinutes(startMinutes),
        startMinutes,
        done: routine.totalItems > 0 && routine.completedItems >= routine.totalItems,
        routine,
      };
    }),
  ];

  return DAY_PART_ORDER.flatMap((part) => {
    const partEntries = entries.filter((entry) => entry.part === part).sort(compareEntries);
    if (partEntries.length === 0) return [];
    return [{
      part,
      entries: partEntries,
      doneCount: partEntries.filter((entry) => entry.done).length,
    }];
  });
}

/**
 * The one open entry that deserves emphasis: the earliest item that is due now or
 * running late, otherwise the earliest upcoming one. Untimed items never qualify.
 */
export function findNextUpId(groups: DayGroup[]) {
  const open = groups.flatMap((group) => group.entries).filter((entry) => !entry.done);
  const status = (entry: DayEntry) =>
    entry.kind === "habit" ? entry.habit.timingStatusToday : entry.routine.timingStatusToday;

  return (
    open.find((entry) => status(entry) === "late" || status(entry) === "due_now")?.id ??
    open.find((entry) => status(entry) === "upcoming")?.id ??
    null
  );
}

export function formatClock(minutes: number) {
  const safeMinutes = Math.max(0, Math.min(minutes, 23 * 60 + 59));
  const hour = Math.floor(safeMinutes / 60);
  const minute = safeMinutes % 60;
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;

  return {
    time: `${hour12}:${String(minute).padStart(2, "0")}`,
    period: hour >= 12 ? "PM" : "AM",
  };
}
