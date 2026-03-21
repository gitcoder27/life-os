import type {
  HabitScheduleRule,
  IsoDateString,
  RecurrenceExceptionItem,
  RecurrenceRuleInput,
} from "@life-os/contracts";

import { addIsoDays, parseIsoDate } from "../time/cycle.js";
import { toIsoDateString } from "../time/date.js";

const MAX_LOOKAHEAD_DAYS = 366 * 5;

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
}

function daysBetween(startIsoDate: IsoDateString, endIsoDate: IsoDateString) {
  const start = parseIsoDate(startIsoDate).getTime();
  const end = parseIsoDate(endIsoDate).getTime();
  return Math.round((end - start) / 86_400_000);
}

function monthsBetween(startIsoDate: IsoDateString, endIsoDate: IsoDateString) {
  const start = parseIsoDate(startIsoDate);
  const end = parseIsoDate(endIsoDate);
  return (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
}

function rawRuleMatchesDate(rule: RecurrenceRuleInput, isoDate: IsoDateString) {
  if (isoDate < rule.startsOn) {
    return false;
  }

  switch (rule.frequency) {
    case "daily": {
      const interval = Math.max(rule.interval ?? 1, 1);
      return daysBetween(rule.startsOn, isoDate) % interval === 0;
    }
    case "weekly": {
      const daysOfWeek = rule.daysOfWeek && rule.daysOfWeek.length > 0
        ? rule.daysOfWeek
        : [parseIsoDate(rule.startsOn).getUTCDay()];
      if (!daysOfWeek.includes(parseIsoDate(isoDate).getUTCDay())) {
        return false;
      }
      const interval = Math.max(rule.interval ?? 1, 1);
      return Math.floor(daysBetween(rule.startsOn, isoDate) / 7) % interval === 0;
    }
    case "monthly_nth_weekday": {
      if (!rule.nthWeekday) {
        return false;
      }
      const interval = Math.max(rule.interval ?? 1, 1);
      if (monthsBetween(rule.startsOn, isoDate) % interval !== 0) {
        return false;
      }
      const date = parseIsoDate(isoDate);
      const target = getNthWeekdayOfMonth(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        rule.nthWeekday.ordinal,
        rule.nthWeekday.dayOfWeek,
      );
      return toIsoDateString(target) === isoDate;
    }
    case "interval": {
      const interval = Math.max(rule.interval ?? 1, 1);
      const dayDiff = daysBetween(rule.startsOn, isoDate);
      return dayDiff % interval === 0;
    }
  }
}

function endConditionAllowsDate(rule: RecurrenceRuleInput, isoDate: IsoDateString) {
  const end = rule.end;
  if (!end || end.type === "never") {
    return true;
  }

  if (end.type === "on_date") {
    return Boolean(end.until && isoDate <= end.until);
  }

  const occurrenceCount = end.occurrenceCount ?? 0;
  if (occurrenceCount <= 0) {
    return false;
  }

  let count = 0;
  let cursor = rule.startsOn;
  while (cursor <= isoDate) {
    if (rawRuleMatchesDate(rule, cursor)) {
      count += 1;
      if (cursor === isoDate) {
        return count <= occurrenceCount;
      }
    }
    cursor = addIsoDays(cursor, 1);
  }

  return false;
}

function getNthWeekdayOfMonth(year: number, month: number, ordinal: number, dayOfWeek: number) {
  if (ordinal === -1) {
    const lastDay = new Date(Date.UTC(year, month + 1, 0));
    const delta = (lastDay.getUTCDay() - dayOfWeek + 7) % 7;
    return new Date(Date.UTC(year, month + 1, lastDay.getUTCDate() - delta));
  }

  const firstDay = new Date(Date.UTC(year, month, 1));
  const offset = (dayOfWeek - firstDay.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month, 1 + offset + (ordinal - 1) * 7));
}

function applyExceptions(
  dueDates: IsoDateString[],
  startIsoDate: IsoDateString,
  endIsoDate: IsoDateString,
  exceptions: RecurrenceExceptionItem[],
) {
  const dateSet = new Set(dueDates);

  for (const exception of exceptions) {
    if (exception.action === "skip") {
      dateSet.delete(exception.occurrenceDate);
      continue;
    }

    if (exception.action === "reschedule") {
      dateSet.delete(exception.occurrenceDate);
      if (exception.targetDate && exception.targetDate >= startIsoDate && exception.targetDate <= endIsoDate) {
        dateSet.add(exception.targetDate);
      }
      continue;
    }

    if (exception.occurrenceDate >= startIsoDate && exception.occurrenceDate <= endIsoDate) {
      dateSet.add(exception.occurrenceDate);
    }
  }

  return [...dateSet].sort();
}

export function normalizeRecurrenceRule(input: unknown): RecurrenceRuleInput | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const candidate = input as Partial<RecurrenceRuleInput>;
  if (
    (candidate.frequency !== "daily" &&
      candidate.frequency !== "weekly" &&
      candidate.frequency !== "monthly_nth_weekday" &&
      candidate.frequency !== "interval") ||
    typeof candidate.startsOn !== "string"
  ) {
    return null;
  }

  const normalized: RecurrenceRuleInput = {
    frequency: candidate.frequency,
    startsOn: candidate.startsOn as IsoDateString,
    interval:
      typeof candidate.interval === "number" && candidate.interval > 0
        ? Math.floor(candidate.interval)
        : undefined,
  };

  if (Array.isArray(candidate.daysOfWeek)) {
    normalized.daysOfWeek = [
      ...new Set(candidate.daysOfWeek.filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)),
    ].sort();
  }

  if (
    candidate.nthWeekday &&
    typeof candidate.nthWeekday === "object" &&
    (candidate.nthWeekday.ordinal === -1 || [1, 2, 3, 4].includes(candidate.nthWeekday.ordinal as number)) &&
    Number.isInteger(candidate.nthWeekday.dayOfWeek) &&
    candidate.nthWeekday.dayOfWeek >= 0 &&
    candidate.nthWeekday.dayOfWeek <= 6
  ) {
    normalized.nthWeekday = {
      ordinal: candidate.nthWeekday.ordinal as 1 | 2 | 3 | 4 | -1,
      dayOfWeek: candidate.nthWeekday.dayOfWeek,
    };
  }

  if (candidate.end && typeof candidate.end === "object") {
    const end = candidate.end;
    if (end.type === "never" || end.type === "on_date" || end.type === "after_occurrences") {
      normalized.end = {
        type: end.type,
        until: typeof end.until === "string" ? end.until as IsoDateString : undefined,
        occurrenceCount:
          typeof end.occurrenceCount === "number" && end.occurrenceCount > 0
            ? Math.floor(end.occurrenceCount)
            : undefined,
      };
    }
  }

  if (!normalized.end) {
    normalized.end = { type: "never" };
  }

  return normalized;
}

export function normalizeRecurrenceExceptions(input: unknown): RecurrenceExceptionItem[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const deduped = new Map<string, RecurrenceExceptionItem>();
  for (const item of input) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const candidate = item as Partial<RecurrenceExceptionItem>;
    if (
      typeof candidate.occurrenceDate !== "string" ||
      (candidate.action !== "skip" &&
        candidate.action !== "do_once" &&
        candidate.action !== "reschedule")
    ) {
      continue;
    }

    deduped.set(candidate.occurrenceDate, {
      occurrenceDate: candidate.occurrenceDate as IsoDateString,
      action: candidate.action,
      targetDate:
        typeof candidate.targetDate === "string"
          ? (candidate.targetDate as IsoDateString)
          : null,
    });
  }

  return [...deduped.values()].sort((left, right) => left.occurrenceDate.localeCompare(right.occurrenceDate));
}

export function listRecurrenceDatesInRange(
  rule: RecurrenceRuleInput,
  startIsoDate: IsoDateString,
  endIsoDate: IsoDateString,
  exceptions: RecurrenceExceptionItem[] = [],
) {
  const dueDates: IsoDateString[] = [];
  let cursor = startIsoDate < rule.startsOn ? rule.startsOn : startIsoDate;

  while (cursor <= endIsoDate) {
    if (rawRuleMatchesDate(rule, cursor) && endConditionAllowsDate(rule, cursor)) {
      dueDates.push(cursor);
    }
    cursor = addIsoDays(cursor, 1);
  }

  return applyExceptions(dueDates, startIsoDate, endIsoDate, exceptions);
}

export function isRecurrenceDueOnIsoDate(
  rule: RecurrenceRuleInput,
  isoDate: IsoDateString,
  exceptions: RecurrenceExceptionItem[] = [],
) {
  return listRecurrenceDatesInRange(rule, isoDate, isoDate, exceptions).includes(isoDate);
}

export function getNextRecurrenceDateAfter(
  rule: RecurrenceRuleInput,
  afterIsoDate: IsoDateString,
  exceptions: RecurrenceExceptionItem[] = [],
) {
  let cursor = addIsoDays(afterIsoDate, 1);
  let safety = 0;

  while (safety < MAX_LOOKAHEAD_DAYS) {
    if (isRecurrenceDueOnIsoDate(rule, cursor, exceptions)) {
      return cursor;
    }
    cursor = addIsoDays(cursor, 1);
    safety += 1;
  }

  return null;
}

export function deriveHabitScheduleFromRecurrence(rule: RecurrenceRuleInput): HabitScheduleRule {
  if (rule.frequency === "weekly" && rule.daysOfWeek && rule.daysOfWeek.length > 0) {
    return { daysOfWeek: rule.daysOfWeek };
  }

  return {};
}

export function buildLegacyHabitRecurrence(
  scheduleRule: HabitScheduleRule,
  startsOn: IsoDateString,
): RecurrenceRuleInput {
  if (scheduleRule.daysOfWeek && scheduleRule.daysOfWeek.length > 0) {
    return {
      frequency: "weekly",
      startsOn,
      interval: 1,
      daysOfWeek: scheduleRule.daysOfWeek,
      end: { type: "never" },
    };
  }

  return {
    frequency: "daily",
    startsOn,
    interval: 1,
    end: { type: "never" },
  };
}

export function parseLegacyFinanceRecurrenceRule(
  recurrenceRule: string,
  startsOn: IsoDateString,
): RecurrenceRuleInput | null {
  const normalized = recurrenceRule.trim().toLowerCase();

  if (normalized === "daily") {
    return { frequency: "daily", startsOn, interval: 1, end: { type: "never" } };
  }
  if (normalized === "weekly") {
    return {
      frequency: "weekly",
      startsOn,
      interval: 1,
      daysOfWeek: [parseIsoDate(startsOn).getUTCDay()],
      end: { type: "never" },
    };
  }
  if (normalized === "monthly") {
    const startDate = parseIsoDate(startsOn);
    const ordinal = Math.min(Math.floor((startDate.getUTCDate() - 1) / 7) + 1, 4) as 1 | 2 | 3 | 4;
    return {
      frequency: "monthly_nth_weekday",
      startsOn,
      interval: 1,
      nthWeekday: {
        ordinal,
        dayOfWeek: startDate.getUTCDay(),
      },
      end: { type: "never" },
    };
  }

  const match = normalized.match(/^every:(\d+):(day|days|week|weeks|month|months)$/);
  if (!match) {
    return null;
  }

  const interval = Number(match[1]);
  const unit = match[2];
  if (unit.startsWith("day")) {
    return { frequency: "interval", startsOn, interval, end: { type: "never" } };
  }
  if (unit.startsWith("week")) {
    return {
      frequency: "weekly",
      startsOn,
      interval,
      daysOfWeek: [parseIsoDate(startsOn).getUTCDay()],
      end: { type: "never" },
    };
  }
  const startDate = parseIsoDate(startsOn);
  const ordinal = Math.min(Math.floor((startDate.getUTCDate() - 1) / 7) + 1, 4) as 1 | 2 | 3 | 4;
  return {
    frequency: "monthly_nth_weekday",
    startsOn,
    interval,
    nthWeekday: {
      ordinal,
      dayOfWeek: startDate.getUTCDay(),
    },
    end: { type: "never" },
  };
}

export function formatLegacyFinanceRecurrenceRule(rule: RecurrenceRuleInput) {
  if (rule.frequency === "daily" && (rule.interval ?? 1) === 1) {
    return "daily";
  }
  if (rule.frequency === "weekly" && (rule.interval ?? 1) === 1) {
    return "weekly";
  }
  if (rule.frequency === "monthly_nth_weekday" && (rule.interval ?? 1) === 1) {
    return "monthly";
  }
  if (rule.frequency === "interval") {
    return `every:${rule.interval ?? 1}:day`;
  }
  if (rule.frequency === "weekly") {
    return `every:${rule.interval ?? 1}:week`;
  }
  return `every:${rule.interval ?? 1}:month`;
}

export function recurrenceFromScheduleLike(scheduleRule: HabitScheduleRule) {
  const candidate = scheduleRule as HabitScheduleRule & Partial<RecurrenceRuleInput>;
  if (typeof candidate.frequency === "string" && typeof candidate.startsOn === "string") {
    return normalizeRecurrenceRule(candidate);
  }
  return null;
}

export function fallbackStartsOnFromDate(date: Date) {
  return toIsoDateString(startOfUtcDay(date));
}
