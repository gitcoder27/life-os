import type { IsoDateString, ReviewSubmissionWindow, ReviewSubmissionWindowStatus } from "@life-os/contracts";

import { addIsoDays, getMonthStartIsoDate, getWeekStartIsoDate } from "../../lib/time/cycle.js";
import { getTimeWindowUtc, getUserLocalDate, normalizeTimezone } from "../../lib/time/user-time.js";

interface ReviewWindowPreferences {
  timezone?: string | null;
  dailyReviewStartTime?: string | null;
  dailyReviewEndTime?: string | null;
  weekStartsOn?: number | null;
}

const DEFAULT_DAILY_REVIEW_START_TIME = "20:00";
const DEFAULT_DAILY_REVIEW_END_TIME = "10:00";

function getUserLocalTime(date: Date, timezone?: string | null) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: normalizeTimezone(timezone),
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function compareIsoDates(left: IsoDateString, right: IsoDateString) {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}

function toReviewSubmissionWindow(input: {
  requestedDate: IsoDateString;
  allowedDate: IsoDateString | null;
  opensAt: Date | null;
  closesAt: Date | null;
  timezone: string;
}): ReviewSubmissionWindow {
  let status: ReviewSubmissionWindowStatus = "no_open_window";

  if (input.allowedDate) {
    const comparison = compareIsoDates(input.requestedDate, input.allowedDate);
    status = comparison === 0 ? "open" : comparison < 0 ? "too_late" : "too_early";
  }

  return {
    isOpen: status === "open",
    status,
    requestedDate: input.requestedDate,
    allowedDate: input.allowedDate,
    opensAt: input.opensAt?.toISOString() ?? null,
    closesAt: input.closesAt?.toISOString() ?? null,
    timezone: input.timezone,
  };
}

function getNextMonthStartIsoDate(isoDate: IsoDateString) {
  const [yearString, monthString] = isoDate.split("-");
  const year = Number(yearString);
  const month = Number(monthString);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01` as IsoDateString;
}

export function resolveDailyReviewSubmissionWindow(
  requestedDate: IsoDateString,
  now: Date,
  preferences?: ReviewWindowPreferences | null,
): ReviewSubmissionWindow {
  const timezone = normalizeTimezone(preferences?.timezone);
  const dailyReviewStartTime = preferences?.dailyReviewStartTime ?? DEFAULT_DAILY_REVIEW_START_TIME;
  const dailyReviewEndTime = preferences?.dailyReviewEndTime ?? DEFAULT_DAILY_REVIEW_END_TIME;
  const todayIsoDate = getUserLocalDate(now, timezone);
  const localTime = getUserLocalTime(now, timezone);

  if (localTime >= dailyReviewStartTime) {
    return toReviewSubmissionWindow({
      requestedDate,
      allowedDate: todayIsoDate,
      opensAt: getTimeWindowUtc(todayIsoDate, dailyReviewStartTime, timezone),
      closesAt: getTimeWindowUtc(addIsoDays(todayIsoDate, 1), dailyReviewEndTime, timezone),
      timezone,
    });
  }

  if (localTime < dailyReviewEndTime) {
    const yesterdayIsoDate = addIsoDays(todayIsoDate, -1);

    return toReviewSubmissionWindow({
      requestedDate,
      allowedDate: yesterdayIsoDate,
      opensAt: getTimeWindowUtc(yesterdayIsoDate, dailyReviewStartTime, timezone),
      closesAt: getTimeWindowUtc(todayIsoDate, dailyReviewEndTime, timezone),
      timezone,
    });
  }

  return toReviewSubmissionWindow({
    requestedDate,
    allowedDate: null,
    opensAt: getTimeWindowUtc(todayIsoDate, dailyReviewStartTime, timezone),
    closesAt: getTimeWindowUtc(addIsoDays(todayIsoDate, 1), dailyReviewEndTime, timezone),
    timezone,
  });
}

export function resolveWeeklyReviewSubmissionWindow(
  requestedDate: IsoDateString,
  now: Date,
  preferences?: ReviewWindowPreferences | null,
): ReviewSubmissionWindow {
  const timezone = normalizeTimezone(preferences?.timezone);
  const todayIsoDate = getUserLocalDate(now, timezone);
  const currentWeekStart = getWeekStartIsoDate(todayIsoDate, preferences?.weekStartsOn ?? 1);

  return toReviewSubmissionWindow({
    requestedDate,
    allowedDate: addIsoDays(currentWeekStart, -7),
    opensAt: getTimeWindowUtc(currentWeekStart, "00:00", timezone),
    closesAt: getTimeWindowUtc(addIsoDays(currentWeekStart, 7), "00:00", timezone),
    timezone,
  });
}

export function resolveMonthlyReviewSubmissionWindow(
  requestedDate: IsoDateString,
  now: Date,
  preferences?: ReviewWindowPreferences | null,
): ReviewSubmissionWindow {
  const timezone = normalizeTimezone(preferences?.timezone);
  const todayIsoDate = getUserLocalDate(now, timezone);
  const currentMonthStart = getMonthStartIsoDate(todayIsoDate);
  const previousMonthStart = getMonthStartIsoDate(addIsoDays(currentMonthStart, -1));

  return toReviewSubmissionWindow({
    requestedDate,
    allowedDate: previousMonthStart,
    opensAt: getTimeWindowUtc(currentMonthStart, "00:00", timezone),
    closesAt: getTimeWindowUtc(getNextMonthStartIsoDate(currentMonthStart), "00:00", timezone),
    timezone,
  });
}

export function getOpenDailyReviewRoute(
  now: Date,
  preferences?: ReviewWindowPreferences | null,
) {
  const timezone = normalizeTimezone(preferences?.timezone);
  const currentIsoDate = getUserLocalDate(now, timezone);
  const submissionWindow = resolveDailyReviewSubmissionWindow(currentIsoDate, now, preferences);

  return submissionWindow.allowedDate ? `/reviews/daily?date=${submissionWindow.allowedDate}` : null;
}
