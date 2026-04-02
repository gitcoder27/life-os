import type {
  HabitScheduleRule,
  HabitStatus,
  IsoDateString,
  RecurrenceDefinition,
} from "@life-os/contracts";

import { addIsoDays } from "../time/cycle.js";
import { toIsoDateString } from "../time/date.js";
import {
  buildLegacyHabitRecurrence,
  fallbackStartsOnFromDate,
  isRecurrenceDueOnIsoDate,
  recurrenceFromScheduleLike,
} from "../recurrence/rules.js";

interface HabitCheckinLike {
  occurredOn: Date;
  status: "COMPLETED" | "SKIPPED";
  completionCount?: number | null;
}

export interface HabitPauseWindowLike {
  startsOn: Date;
  endsOn: Date;
}

type HabitLifecycleStatus = HabitStatus | "ACTIVE" | "PAUSED" | "ARCHIVED";

interface HabitRecurrenceCarrier {
  scheduleRuleJson: unknown;
  status?: HabitLifecycleStatus;
  archivedAt?: Date | null;
  pauseWindows?: HabitPauseWindowLike[];
  recurrenceRule?: {
    id?: string;
    ruleJson: unknown;
    exceptions?: Array<{ occurrenceDate: Date; action: unknown; targetDate: Date | null }>;
    carryPolicy?: unknown;
    legacyRuleText?: string | null;
  } | null;
  createdAt?: Date;
}

function normalizeDaysOfWeek(input: unknown) {
  if (!Array.isArray(input)) {
    return undefined;
  }

  const values = [
    ...new Set(input.filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)),
  ] as number[];
  return values.length > 0 ? values.sort() : undefined;
}

export function normalizeHabitScheduleRule(input: unknown): HabitScheduleRule {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const candidate = input as HabitScheduleRule;
  const daysOfWeek = normalizeDaysOfWeek(candidate.daysOfWeek);
  return daysOfWeek ? ({ ...candidate, daysOfWeek } as HabitScheduleRule) : (candidate as HabitScheduleRule);
}

function coerceHabitExceptionAction(action: unknown) {
  if (action === "SKIP") {
    return "skip" as const;
  }
  if (action === "DO_ONCE") {
    return "do_once" as const;
  }
  return "reschedule" as const;
}

export function resolveHabitRecurrence(
  habit: HabitRecurrenceCarrier,
  fallbackIsoDate?: IsoDateString,
): RecurrenceDefinition {
  const recurrenceRule = habit.recurrenceRule;
  if (recurrenceRule && recurrenceRule.ruleJson && typeof recurrenceRule.ruleJson === "object") {
    const scheduleLike = recurrenceRule.ruleJson as HabitScheduleRule;
    const recurrence = recurrenceFromScheduleLike(scheduleLike);
    if (recurrence) {
      return {
        id: recurrenceRule.id ?? "habit-recurrence",
        rule: recurrence,
        exceptions: (recurrenceRule.exceptions ?? []).map((exception) => ({
          occurrenceDate: toIsoDateString(exception.occurrenceDate),
          action: coerceHabitExceptionAction(exception.action),
          targetDate: exception.targetDate ? toIsoDateString(exception.targetDate) : null,
        })),
        carryPolicy: null,
        legacyRuleText: recurrenceRule.legacyRuleText ?? null,
      };
    }
  }

  const startsOn = habit.createdAt
    ? fallbackStartsOnFromDate(habit.createdAt)
    : (fallbackIsoDate ?? fallbackStartsOnFromDate(new Date()));
  return {
    id: recurrenceRule?.id ?? "habit-legacy-recurrence",
    rule: buildLegacyHabitRecurrence(normalizeHabitScheduleRule(habit.scheduleRuleJson), startsOn),
    exceptions: [],
    carryPolicy: null,
    legacyRuleText: null,
  };
}

function isHabitArchivedStatus(status: HabitLifecycleStatus | null | undefined) {
  return status === "archived" || status === "ARCHIVED";
}

function isHabitPausedStatus(status: HabitLifecycleStatus | null | undefined) {
  return status === "paused" || status === "PAUSED";
}

export function isHabitPermanentlyInactive(input: {
  status?: HabitLifecycleStatus;
  archivedAt?: Date | null;
}) {
  return isHabitPausedStatus(input.status) || isHabitArchivedStatus(input.status) || Boolean(input.archivedAt);
}

export function isHabitPausedOnIsoDate(
  pauseWindows: HabitPauseWindowLike[] | null | undefined,
  isoDate: IsoDateString,
) {
  if (!pauseWindows || pauseWindows.length === 0) {
    return false;
  }

  return pauseWindows.some((window) => {
    const startsOn = toIsoDateString(window.startsOn);
    const endsOn = toIsoDateString(window.endsOn);
    return startsOn <= isoDate && isoDate <= endsOn;
  });
}

export function getIsoDateWeekday(isoDate: IsoDateString) {
  return new Date(`${isoDate}T00:00:00.000Z`).getUTCDay();
}

export function isHabitDueOnIsoDate(
  scheduleInput: HabitScheduleRule | RecurrenceDefinition,
  isoDate: IsoDateString,
  pauseWindows: HabitPauseWindowLike[] = [],
) {
  if (isHabitPausedOnIsoDate(pauseWindows, isoDate)) {
    return false;
  }

  if ("rule" in scheduleInput) {
    return isRecurrenceDueOnIsoDate(scheduleInput.rule, isoDate, scheduleInput.exceptions);
  }

  const recurrence = recurrenceFromScheduleLike(scheduleInput);
  if (recurrence) {
    return isRecurrenceDueOnIsoDate(recurrence, isoDate, []);
  }

  if (!scheduleInput.daysOfWeek || scheduleInput.daysOfWeek.length === 0) {
    return true;
  }

  return scheduleInput.daysOfWeek.includes(getIsoDateWeekday(isoDate));
}

export function filterDueHabits<T extends HabitRecurrenceCarrier>(habits: T[], isoDate: IsoDateString) {
  return habits.filter((habit) => {
    if (isHabitPermanentlyInactive(habit)) {
      return false;
    }

    return isHabitDueOnIsoDate(resolveHabitRecurrence(habit, isoDate), isoDate, habit.pauseWindows);
  });
}

function normalizeCompletionCount(checkin: HabitCheckinLike) {
  if (checkin.status !== "COMPLETED") {
    return 0;
  }

  if (typeof checkin.completionCount === "number" && Number.isFinite(checkin.completionCount)) {
    return Math.max(0, Math.trunc(checkin.completionCount));
  }

  return 1;
}

export function getHabitCompletionCountForIsoDate(
  checkins: HabitCheckinLike[],
  isoDate: IsoDateString,
) {
  return checkins.reduce((sum, checkin) => {
    if (toIsoDateString(checkin.occurredOn) !== isoDate) {
      return sum;
    }

    return sum + normalizeCompletionCount(checkin);
  }, 0);
}

export function isHabitCompletedOnIsoDate(
  checkins: HabitCheckinLike[],
  isoDate: IsoDateString,
  targetPerDay = 1,
) {
  return getHabitCompletionCountForIsoDate(checkins, isoDate) >= Math.max(1, targetPerDay);
}

export function calculateHabitStreak(
  checkins: HabitCheckinLike[],
  scheduleInput: HabitScheduleRule | RecurrenceDefinition,
  onDate: IsoDateString,
  startOffset = 0,
  pauseWindows: HabitPauseWindowLike[] = [],
  targetPerDay = 1,
) {
  let streak = 0;

  for (let offset = startOffset; offset < startOffset + 30; offset += 1) {
    const targetDate = addIsoDays(onDate, -offset);

    if (!isHabitDueOnIsoDate(scheduleInput, targetDate, pauseWindows)) {
      continue;
    }

    if (!isHabitCompletedOnIsoDate(checkins, targetDate, targetPerDay)) {
      break;
    }

    streak += 1;
  }

  return streak;
}
