import type {
  DayPlannerBlockItem,
  HabitItem,
  RoutineItem,
} from "../../../shared/lib/api";
import {
  buildPlannerDateTime,
  formatDurationMinutes,
  getLocalTimezoneOffset,
  minutesToTimeString,
  timeStringToMinutes,
  toTimeInputValue,
} from "./planner-blocks";

const DEFAULT_HABIT_DURATION_MINUTES = 25;
const MIN_ROUTINE_DURATION_MINUTES = 20;
const MAX_ROUTINE_DURATION_MINUTES = 90;
const ROUTINE_ITEM_DURATION_MINUTES = 8;
const MORNING_WINDOW = { start: 6 * 60, end: 11 * 60 };
const EVENING_WINDOW = { start: 18 * 60, end: 22 * 60 };

export type DailyRhythmKind = "habit" | "routine";
export type DailyRhythmPlacement = "fixed" | "flexible" | "anytime";
export type DailyRhythmState =
  | "reserved"
  | "planned"
  | "conflict"
  | "needs_slot"
  | "checklist"
  | "skipped"
  | "done";

export type DailyRhythmItem = {
  id: string;
  sourceId: string;
  kind: DailyRhythmKind;
  title: string;
  placement: DailyRhythmPlacement;
  state: DailyRhythmState;
  completed: boolean;
  skipped: boolean;
  startsAt: string | null;
  endsAt: string | null;
  startMinutes: number | null;
  endMinutes: number | null;
  windowStartMinutes: number | null;
  windowEndMinutes: number | null;
  durationMinutes: number;
  timingLabel: string | null;
  detailLabel: string;
  progressLabel: string | null;
  conflictLabel: string | null;
  routineItemIds: string[];
  incompleteRoutineItemIds: string[];
};

export type DailyRhythmReservation = {
  id: string;
  itemId: string;
  kind: DailyRhythmKind;
  title: string;
  startsAt: string;
  endsAt: string;
  durationLabel: string;
  detailLabel: string;
};

export type DailyRhythmPlan = {
  items: DailyRhythmItem[];
  reservations: DailyRhythmReservation[];
  counts: {
    total: number;
    reserved: number;
    planned: number;
    conflicts: number;
    needsSlot: number;
    checklist: number;
    skipped: number;
    done: number;
  };
};

type BusyWindow = {
  id: string;
  title: string;
  startMinutes: number;
  endMinutes: number;
};

type RhythmCandidate = {
  id: string;
  sourceId: string;
  kind: DailyRhythmKind;
  title: string;
  placement: DailyRhythmPlacement;
  completed: boolean;
  skipped: boolean;
  startMinutes: number | null;
  endMinutes: number | null;
  windowStartMinutes: number | null;
  windowEndMinutes: number | null;
  durationMinutes: number;
  timingLabel: string | null;
  detailLabel: string;
  progressLabel: string | null;
  routineItemIds: string[];
  incompleteRoutineItemIds: string[];
};

export const buildDailyRhythmPlan = (input: {
  date: string;
  blocks: DayPlannerBlockItem[];
  dueHabits: HabitItem[];
  routines: RoutineItem[];
}): DailyRhythmPlan => {
  const timezoneOffset = getLocalTimezoneOffset();
  const busyWindows = input.blocks.map(blockToBusyWindow);
  const reservations: DailyRhythmReservation[] = [];
  const reservationBusyWindows: BusyWindow[] = [];
  const candidates = [
    ...input.dueHabits.map(habitToCandidate),
    ...input.routines
      .filter((routine) => routine.status === "active")
      .map(routineToCandidate),
  ].sort(compareCandidates);

  const items = candidates.map((candidate) => {
    const representedByBlock = findRepresentingBlock(candidate, input.blocks);
    if (representedByBlock) {
      return candidateToItem(candidate, {
        state: candidate.completed ? "done" : candidate.skipped ? "skipped" : "planned",
        conflictLabel: null,
        date: input.date,
        timezoneOffset,
      });
    }

    if (candidate.completed) {
      return candidateToItem(candidate, {
        state: "done",
        conflictLabel: null,
        date: input.date,
        timezoneOffset,
      });
    }

    if (candidate.skipped) {
      return candidateToItem(candidate, {
        state: "skipped",
        conflictLabel: null,
        date: input.date,
        timezoneOffset,
      });
    }

    if (candidate.placement !== "fixed" || candidate.startMinutes === null || candidate.endMinutes === null) {
      return candidateToItem(candidate, {
        state: candidate.placement === "anytime" ? "checklist" : "needs_slot",
        conflictLabel: null,
        date: input.date,
        timezoneOffset,
      });
    }

    const overlappingBlock = findOverlap(candidate, busyWindows);
    const overlappingReservation = findOverlap(candidate, reservationBusyWindows);
    if (overlappingBlock || overlappingReservation) {
      return candidateToItem(candidate, {
        state: "conflict",
        conflictLabel: overlappingBlock?.title ?? overlappingReservation?.title ?? "another rhythm",
        date: input.date,
        timezoneOffset,
      });
    }

    const item = candidateToItem(candidate, {
      state: "reserved",
      conflictLabel: null,
      date: input.date,
      timezoneOffset,
    });
    if (item.startsAt && item.endsAt) {
      reservations.push({
        id: `rhythm-reservation-${item.id}`,
        itemId: item.id,
        kind: item.kind,
        title: item.title,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        durationLabel: formatDurationMinutes(item.durationMinutes),
        detailLabel: item.detailLabel,
      });
      reservationBusyWindows.push({
        id: item.id,
        title: item.title,
        startMinutes: item.startMinutes ?? 0,
        endMinutes: item.endMinutes ?? 0,
      });
    }

    return item;
  });

  return {
    items,
    reservations,
    counts: {
      total: items.length,
      reserved: items.filter((item) => item.state === "reserved").length,
      planned: items.filter((item) => item.state === "planned").length,
      conflicts: items.filter((item) => item.state === "conflict").length,
      needsSlot: items.filter((item) => item.state === "needs_slot").length,
      checklist: items.filter((item) => item.state === "checklist").length,
      done: items.filter((item) => item.state === "done").length,
      skipped: items.filter((item) => item.state === "skipped").length,
    },
  };
};

export const findDailyRhythmSlot = (input: {
  item: DailyRhythmItem;
  blocks: DayPlannerBlockItem[];
  date: string;
}): { startsAt: string; endsAt: string } | null => {
  const timezoneOffset = getLocalTimezoneOffset();
  const busyWindows = input.blocks.map(blockToBusyWindow).sort(compareBusyWindows);
  const duration = Math.max(15, input.item.durationMinutes);
  const searchStart = input.item.startMinutes
    ?? getWindowStartMinutes(input.item)
    ?? 8 * 60;
  const searchEnd = getWindowEndMinutes(input.item) ?? 22 * 60;
  const slot = findFirstOpenSlot({
    busyWindows,
    startMinutes: searchStart,
    endMinutes: searchEnd,
    durationMinutes: duration,
  }) ?? findFirstOpenSlot({
    busyWindows,
    startMinutes: input.item.startMinutes ?? 6 * 60,
    endMinutes: 23 * 60,
    durationMinutes: duration,
  }) ?? findFirstOpenSlot({
    busyWindows,
    startMinutes: 6 * 60,
    endMinutes: 23 * 60,
    durationMinutes: duration,
  });

  if (!slot) {
    return null;
  }

  return {
    startsAt: buildPlannerDateTime(input.date, minutesToTimeString(slot.startMinutes), timezoneOffset),
    endsAt: buildPlannerDateTime(input.date, minutesToTimeString(slot.endMinutes), timezoneOffset),
  };
};

const habitToCandidate = (habit: HabitItem): RhythmCandidate => {
  const durationMinutes = habit.durationMinutes ?? DEFAULT_HABIT_DURATION_MINUTES;
  const fixedStart = habit.timingMode === "exact_time" ? habit.targetTimeMinutes : null;
  const windowStart = habit.timingMode === "time_window" ? habit.windowStartMinutes : null;
  const windowEnd = habit.timingMode === "time_window" ? habit.windowEndMinutes : null;
  const placement: DailyRhythmPlacement =
    habit.timingMode === "exact_time"
      ? "fixed"
      : habit.timingMode === "time_window"
        ? "flexible"
        : "anytime";

  return {
    id: `habit-${habit.id}`,
    sourceId: habit.id,
    kind: "habit",
    title: habit.title,
    placement,
    completed: habit.completedToday,
    skipped: habit.skippedToday,
    startMinutes: fixedStart,
    endMinutes: fixedStart === null ? null : Math.min(fixedStart + durationMinutes, 23 * 60 + 59),
    windowStartMinutes: windowStart,
    windowEndMinutes: windowEnd,
    durationMinutes,
    timingLabel: habit.timingLabel,
    detailLabel: buildHabitDetailLabel(habit, durationMinutes),
    progressLabel: habit.targetPerDay > 1
      ? `${Math.min(habit.completedCountToday, habit.targetPerDay)}/${habit.targetPerDay}`
      : null,
    routineItemIds: [],
    incompleteRoutineItemIds: [],
  };
};

const routineToCandidate = (routine: RoutineItem): RhythmCandidate => {
  const completed = routine.totalItems > 0 && routine.completedItems >= routine.totalItems;
  const itemCountDuration = Math.min(
    Math.max(routine.totalItems * ROUTINE_ITEM_DURATION_MINUTES, MIN_ROUTINE_DURATION_MINUTES),
    MAX_ROUTINE_DURATION_MINUTES,
  );
  const hasCustomWindow =
    routine.timingMode === "custom_window" &&
    routine.windowStartMinutes !== null &&
    routine.windowEndMinutes !== null &&
    routine.windowEndMinutes > routine.windowStartMinutes;
  const periodWindow = routine.period === "morning"
    ? MORNING_WINDOW
    : routine.period === "evening"
      ? EVENING_WINDOW
      : null;
  const placement: DailyRhythmPlacement = hasCustomWindow ? "fixed" : routine.timingMode === "anytime" ? "anytime" : "flexible";
  const windowStart = hasCustomWindow ? routine.windowStartMinutes : periodWindow?.start ?? null;
  const windowEnd = hasCustomWindow ? routine.windowEndMinutes : periodWindow?.end ?? null;
  const durationMinutes = hasCustomWindow && windowStart !== null && windowEnd !== null
    ? windowEnd - windowStart
    : itemCountDuration;

  return {
    id: `routine-${routine.id}`,
    sourceId: routine.id,
    kind: "routine",
    title: routine.name,
    placement,
    completed,
    skipped: false,
    startMinutes: hasCustomWindow ? routine.windowStartMinutes : null,
    endMinutes: hasCustomWindow ? routine.windowEndMinutes : null,
    windowStartMinutes: windowStart,
    windowEndMinutes: windowEnd,
    durationMinutes,
    timingLabel: routine.timingLabel,
    detailLabel: buildRoutineDetailLabel(routine, durationMinutes),
    progressLabel: routine.totalItems > 0 ? `${routine.completedItems}/${routine.totalItems}` : null,
    routineItemIds: routine.items.map((item) => item.id),
    incompleteRoutineItemIds: routine.items
      .filter((item) => !item.completedToday)
      .map((item) => item.id),
  };
};

const candidateToItem = (
  candidate: RhythmCandidate,
  input: {
    state: DailyRhythmState;
    conflictLabel: string | null;
    date: string;
    timezoneOffset: string;
  },
): DailyRhythmItem => {
  const startsAt = candidate.startMinutes === null
    ? null
    : buildPlannerDateTime(input.date, minutesToTimeString(candidate.startMinutes), input.timezoneOffset);
  const endsAt = candidate.endMinutes === null
    ? null
    : buildPlannerDateTime(input.date, minutesToTimeString(candidate.endMinutes), input.timezoneOffset);

  return {
    id: candidate.id,
    sourceId: candidate.sourceId,
    kind: candidate.kind,
    title: candidate.title,
    placement: candidate.placement,
    state: input.state,
    completed: candidate.completed,
    skipped: candidate.skipped,
    startsAt,
    endsAt,
    startMinutes: candidate.startMinutes,
    endMinutes: candidate.endMinutes,
    windowStartMinutes: candidate.windowStartMinutes,
    windowEndMinutes: candidate.windowEndMinutes,
    durationMinutes: candidate.durationMinutes,
    timingLabel: candidate.timingLabel,
    detailLabel: candidate.detailLabel,
    progressLabel: candidate.progressLabel,
    conflictLabel: input.conflictLabel,
    routineItemIds: candidate.routineItemIds,
    incompleteRoutineItemIds: candidate.incompleteRoutineItemIds,
  };
};

const buildHabitDetailLabel = (habit: HabitItem, durationMinutes: number) => {
  if (habit.timingLabel) {
    return `${habit.timingLabel} · ${formatDurationMinutes(durationMinutes)}`;
  }

  if (habit.anchorText) {
    return habit.anchorText;
  }

  return "Anytime";
};

const buildRoutineDetailLabel = (routine: RoutineItem, durationMinutes: number) => {
  const duration = formatDurationMinutes(durationMinutes);
  if (routine.timingLabel) {
    return `${routine.timingLabel} · ${duration}`;
  }

  if (routine.period) {
    return `${routine.period} · ${duration}`;
  }

  return duration;
};

const findRepresentingBlock = (
  candidate: RhythmCandidate,
  blocks: DayPlannerBlockItem[],
) => blocks.find((block) => {
  if (!block.title || !sameNormalizedTitle(block.title, candidate.title)) {
    return false;
  }

  if (candidate.startMinutes === null || candidate.endMinutes === null) {
    return true;
  }

  const blockStart = timeStringToMinutes(toTimeInputValue(block.startsAt));
  const blockEnd = timeStringToMinutes(toTimeInputValue(block.endsAt));
  return blockStart < candidate.endMinutes && blockEnd > candidate.startMinutes;
});

const findOverlap = (
  candidate: RhythmCandidate,
  busyWindows: BusyWindow[],
) => {
  if (candidate.startMinutes === null || candidate.endMinutes === null) {
    return null;
  }

  return busyWindows.find((window) =>
    window.startMinutes < candidate.endMinutes! &&
    window.endMinutes > candidate.startMinutes!,
  ) ?? null;
};

const blockToBusyWindow = (block: DayPlannerBlockItem): BusyWindow => ({
  id: block.id,
  title: block.title || "Untitled block",
  startMinutes: timeStringToMinutes(toTimeInputValue(block.startsAt)),
  endMinutes: timeStringToMinutes(toTimeInputValue(block.endsAt)),
});

const findFirstOpenSlot = (input: {
  busyWindows: BusyWindow[];
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
}) => {
  let cursor = input.startMinutes;

  for (const busyWindow of input.busyWindows.sort(compareBusyWindows)) {
    if (busyWindow.endMinutes <= cursor) {
      continue;
    }

    if (busyWindow.startMinutes >= input.endMinutes) {
      break;
    }

    if (cursor + input.durationMinutes <= busyWindow.startMinutes) {
      return {
        startMinutes: cursor,
        endMinutes: cursor + input.durationMinutes,
      };
    }

    cursor = Math.max(cursor, busyWindow.endMinutes);
  }

  if (cursor + input.durationMinutes <= input.endMinutes) {
    return {
      startMinutes: cursor,
      endMinutes: cursor + input.durationMinutes,
    };
  }

  return null;
};

const getWindowStartMinutes = (item: DailyRhythmItem) => {
  if (item.startMinutes !== null) {
    return item.startMinutes;
  }

  if (item.windowStartMinutes !== null) {
    return item.windowStartMinutes;
  }

  return null;
};

const getWindowEndMinutes = (item: DailyRhythmItem) => {
  if (item.endMinutes !== null) {
    return item.endMinutes;
  }

  if (item.windowEndMinutes !== null) {
    return item.windowEndMinutes;
  }

  return null;
};

const compareCandidates = (left: RhythmCandidate, right: RhythmCandidate) => {
  const leftStart = left.startMinutes ?? left.windowStartMinutes ?? 24 * 60;
  const rightStart = right.startMinutes ?? right.windowStartMinutes ?? 24 * 60;
  if (leftStart !== rightStart) {
    return leftStart - rightStart;
  }

  return left.title.localeCompare(right.title);
};

const compareBusyWindows = (left: BusyWindow, right: BusyWindow) =>
  left.startMinutes - right.startMinutes || left.endMinutes - right.endMinutes;

const sameNormalizedTitle = (left: string, right: string) => {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  return normalizedLeft === normalizedRight || normalizedLeft.includes(normalizedRight);
};
