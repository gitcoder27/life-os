import type {
  HabitScheduleRule,
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
}

interface HabitRecurrenceCarrier {
  scheduleRuleJson: unknown;
  recurrenceRule?: {
    id?: string;
    ruleJson: unknown;
    exceptions?: Array<{ occurrenceDate: Date; action: string; targetDate: Date | null }>;
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

function coerceHabitExceptionAction(action: string) {
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

  const startsOn = fallbackIsoDate ?? fallbackStartsOnFromDate(habit.createdAt ?? new Date());
  return {
    id: recurrenceRule?.id ?? "habit-legacy-recurrence",
    rule: buildLegacyHabitRecurrence(normalizeHabitScheduleRule(habit.scheduleRuleJson), startsOn),
    exceptions: [],
    carryPolicy: null,
    legacyRuleText: null,
  };
}

export function getIsoDateWeekday(isoDate: IsoDateString) {
  return new Date(`${isoDate}T00:00:00.000Z`).getUTCDay();
}

export function isHabitDueOnIsoDate(
  scheduleInput: HabitScheduleRule | RecurrenceDefinition,
  isoDate: IsoDateString,
) {
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
  return habits.filter((habit) => isHabitDueOnIsoDate(resolveHabitRecurrence(habit, isoDate), isoDate));
}

export function calculateHabitStreak(
  checkins: HabitCheckinLike[],
  scheduleInput: HabitScheduleRule | RecurrenceDefinition,
  onDate: IsoDateString,
  startOffset = 0,
) {
  const completedDates = new Set(
    checkins
      .filter((checkin) => checkin.status === "COMPLETED")
      .map((checkin) => toIsoDateString(checkin.occurredOn)),
  );
  let streak = 0;

  for (let offset = startOffset; offset < startOffset + 30; offset += 1) {
    const targetDate = addIsoDays(onDate, -offset);

    if (!isHabitDueOnIsoDate(scheduleInput, targetDate)) {
      continue;
    }

    if (!completedDates.has(targetDate)) {
      break;
    }

    streak += 1;
  }

  return streak;
}
