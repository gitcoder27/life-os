import type {
  HabitTimingMode,
  IsoDateString,
  RoutinePeriod,
  RoutineTimingMode,
  TimingStatusToday,
} from "@life-os/contracts";

import { getUserLocalDate, getUserLocalTime } from "../time/user-time.js";

const MORNING_WINDOW = {
  start: 5 * 60,
  end: 12 * 60,
};

const EVENING_WINDOW = {
  start: 17 * 60,
  end: 23 * 60,
};

function toLocalMinutes(date: Date, timezone?: string | null) {
  const [hourString = "0", minuteString = "0"] = getUserLocalTime(date, timezone).split(":");

  return Number(hourString) * 60 + Number(minuteString);
}

function formatHourMinute(minutes: number) {
  const safeMinutes = Math.max(0, Math.min(minutes, 23 * 60 + 59));
  const hour = Math.floor(safeMinutes / 60);
  const minute = safeMinutes % 60;
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;

  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

function evaluateTimedStatus(input: {
  completedAt: Date | null;
  now: Date;
  targetIsoDate: IsoDateString;
  timezone?: string | null;
  startMinutes: number;
  deadlineMinutes: number;
}): TimingStatusToday {
  if (input.completedAt) {
    const completedMinutes = toLocalMinutes(input.completedAt, input.timezone);

    return completedMinutes <= input.deadlineMinutes ? "complete_on_time" : "complete_late";
  }

  const currentIsoDate = getUserLocalDate(input.now, input.timezone);
  if (currentIsoDate !== input.targetIsoDate) {
    return "none";
  }

  const currentMinutes = toLocalMinutes(input.now, input.timezone);
  if (currentMinutes < input.startMinutes) {
    return "upcoming";
  }

  if (currentMinutes <= input.deadlineMinutes) {
    return "due_now";
  }

  return "late";
}

export function buildHabitTimingLabel(input: {
  timingMode: HabitTimingMode;
  anchorText?: string | null;
  targetTimeMinutes?: number | null;
  windowStartMinutes?: number | null;
  windowEndMinutes?: number | null;
}) {
  switch (input.timingMode) {
    case "anchor":
      return input.anchorText?.trim() || null;
    case "exact_time":
      return input.targetTimeMinutes === null || input.targetTimeMinutes === undefined
        ? null
        : formatHourMinute(input.targetTimeMinutes);
    case "time_window":
      return input.windowStartMinutes === null ||
        input.windowStartMinutes === undefined ||
        input.windowEndMinutes === null ||
        input.windowEndMinutes === undefined
        ? null
        : `${formatHourMinute(input.windowStartMinutes)} - ${formatHourMinute(input.windowEndMinutes)}`;
    default:
      return null;
  }
}

export function buildRoutineTimingLabel(input: {
  timingMode: RoutineTimingMode;
  period?: RoutinePeriod | null;
  windowStartMinutes?: number | null;
  windowEndMinutes?: number | null;
}) {
  switch (input.timingMode) {
    case "period":
      return input.period === "morning" ? "Morning" : input.period === "evening" ? "Evening" : null;
    case "custom_window":
      return input.windowStartMinutes === null ||
        input.windowStartMinutes === undefined ||
        input.windowEndMinutes === null ||
        input.windowEndMinutes === undefined
        ? null
        : `${formatHourMinute(input.windowStartMinutes)} - ${formatHourMinute(input.windowEndMinutes)}`;
    default:
      return null;
  }
}

export function getHabitTimingStatusToday(input: {
  timingMode: HabitTimingMode;
  targetPerDay: number;
  completedAt: Date | null;
  now: Date;
  targetIsoDate: IsoDateString;
  timezone?: string | null;
  targetTimeMinutes?: number | null;
  windowStartMinutes?: number | null;
  windowEndMinutes?: number | null;
}): TimingStatusToday {
  if (input.timingMode === "anytime" || input.timingMode === "anchor") {
    return "none";
  }

  if (input.timingMode === "exact_time") {
    if (input.targetTimeMinutes === null || input.targetTimeMinutes === undefined) {
      return "none";
    }

    return evaluateTimedStatus({
      completedAt: input.completedAt,
      now: input.now,
      targetIsoDate: input.targetIsoDate,
      timezone: input.timezone,
      startMinutes: input.targetTimeMinutes,
      deadlineMinutes: input.targetTimeMinutes + 60,
    });
  }

  if (
    input.windowStartMinutes === null ||
    input.windowStartMinutes === undefined ||
    input.windowEndMinutes === null ||
    input.windowEndMinutes === undefined
  ) {
    return "none";
  }

  return evaluateTimedStatus({
    completedAt: input.completedAt,
    now: input.now,
    targetIsoDate: input.targetIsoDate,
    timezone: input.timezone,
    startMinutes: input.windowStartMinutes,
    deadlineMinutes: input.windowEndMinutes,
  });
}

export function getRoutineTimingStatusToday(input: {
  timingMode: RoutineTimingMode;
  period?: RoutinePeriod | null;
  completedAt: Date | null;
  now: Date;
  targetIsoDate: IsoDateString;
  timezone?: string | null;
  windowStartMinutes?: number | null;
  windowEndMinutes?: number | null;
}): TimingStatusToday {
  if (input.timingMode === "anytime") {
    return "none";
  }

  if (input.timingMode === "period") {
    const window = input.period === "morning"
      ? MORNING_WINDOW
      : input.period === "evening"
        ? EVENING_WINDOW
        : null;

    if (!window) {
      return "none";
    }

    return evaluateTimedStatus({
      completedAt: input.completedAt,
      now: input.now,
      targetIsoDate: input.targetIsoDate,
      timezone: input.timezone,
      startMinutes: window.start,
      deadlineMinutes: window.end,
    });
  }

  if (
    input.windowStartMinutes === null ||
    input.windowStartMinutes === undefined ||
    input.windowEndMinutes === null ||
    input.windowEndMinutes === undefined
  ) {
    return "none";
  }

  return evaluateTimedStatus({
    completedAt: input.completedAt,
    now: input.now,
    targetIsoDate: input.targetIsoDate,
    timezone: input.timezone,
    startMinutes: input.windowStartMinutes,
    deadlineMinutes: input.windowEndMinutes,
  });
}

export function isScoredHabitTimingMode(timingMode: HabitTimingMode, targetPerDay: number) {
  return targetPerDay === 1 && (timingMode === "exact_time" || timingMode === "time_window");
}

export function isScoredRoutineTimingMode(timingMode: RoutineTimingMode) {
  return timingMode === "period" || timingMode === "custom_window";
}
