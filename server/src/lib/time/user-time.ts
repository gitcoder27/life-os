import type { IsoDateString } from "@life-os/contracts";

import { addIsoDays, parseIsoDate } from "./cycle.js";

const DEFAULT_TIMEZONE = "UTC";

const weekdayMap: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

interface LocalDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

function getFormatter(timezone: string) {
  const normalizedTimezone = normalizeTimezone(timezone);

  if (!formatterCache.has(normalizedTimezone)) {
    formatterCache.set(
      normalizedTimezone,
      new Intl.DateTimeFormat("en-US", {
        timeZone: normalizedTimezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        weekday: "short",
        hourCycle: "h23",
      }),
    );
  }

  return formatterCache.get(normalizedTimezone)!;
}

function getLocalDateTimeParts(date: Date, timezone: string): LocalDateTimeParts {
  const parts = getFormatter(timezone).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
    weekday: weekdayMap[values.weekday] ?? 0,
  };
}

function resolveLocalDateTimeToUtc(
  isoDate: IsoDateString,
  timezone: string,
  hour = 0,
  minute = 0,
  second = 0,
) {
  const normalizedTimezone = normalizeTimezone(timezone);
  const date = parseIsoDate(isoDate);
  const target = {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour,
    minute,
    second,
  };
  const targetValue = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
    target.second,
    0,
  );

  let guess = new Date(targetValue);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = getLocalDateTimeParts(guess, normalizedTimezone);
    const currentValue = Date.UTC(
      current.year,
      current.month - 1,
      current.day,
      current.hour,
      current.minute,
      current.second,
      0,
    );
    const diffMs = targetValue - currentValue;

    if (diffMs === 0) {
      return guess;
    }

    guess = new Date(guess.getTime() + diffMs);
  }

  return guess;
}

export function normalizeTimezone(timezone?: string | null) {
  return timezone ?? DEFAULT_TIMEZONE;
}

export function getUserLocalDate(date: Date, timezone?: string | null): IsoDateString {
  const localDate = getLocalDateTimeParts(date, normalizeTimezone(timezone));

  return `${localDate.year}-${String(localDate.month).padStart(2, "0")}-${String(localDate.day).padStart(2, "0")}` as IsoDateString;
}

export function getUserLocalHour(date: Date, timezone?: string | null) {
  return getLocalDateTimeParts(date, normalizeTimezone(timezone)).hour;
}

export function getUserLocalWeekday(date: Date, timezone?: string | null) {
  return getLocalDateTimeParts(date, normalizeTimezone(timezone)).weekday;
}

export function getLocalGreeting(date: Date, timezone?: string | null) {
  const hour = getUserLocalHour(date, timezone);

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

export function getDayWindowUtc(isoDate: IsoDateString, timezone?: string | null) {
  const normalizedTimezone = normalizeTimezone(timezone);
  const start = resolveLocalDateTimeToUtc(isoDate, normalizedTimezone);
  const end = resolveLocalDateTimeToUtc(addIsoDays(isoDate, 1), normalizedTimezone);

  return { start, end };
}

export function getDateRangeWindowUtc(
  startDate: IsoDateString,
  endDate: IsoDateString,
  timezone?: string | null,
) {
  const normalizedTimezone = normalizeTimezone(timezone);

  return {
    start: resolveLocalDateTimeToUtc(startDate, normalizedTimezone),
    end: resolveLocalDateTimeToUtc(addIsoDays(endDate, 1), normalizedTimezone),
  };
}

export function getUtcDateForLocalTime(
  isoDate: IsoDateString,
  time: string | null | undefined,
  timezone?: string | null,
) {
  const [hourString = "0", minuteString = "0"] = (time ?? "00:00").split(":");

  return resolveLocalDateTimeToUtc(
    isoDate,
    normalizeTimezone(timezone),
    Number(hourString),
    Number(minuteString),
    0,
  );
}

export const getTimeWindowUtc = getUtcDateForLocalTime;
