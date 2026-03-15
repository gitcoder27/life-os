import type { IsoDateString } from "@life-os/contracts";

import { addIsoDays, parseIsoDate } from "../time/cycle.js";
import { toIsoDateString } from "../time/date.js";

export interface HabitScheduleRule {
  daysOfWeek?: number[];
}

interface HabitCheckinLike {
  occurredOn: Date;
  status: "COMPLETED" | "SKIPPED";
}

export function normalizeHabitScheduleRule(input: unknown): HabitScheduleRule {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  return input as HabitScheduleRule;
}

export function getIsoDateWeekday(isoDate: IsoDateString) {
  return parseIsoDate(isoDate).getUTCDay();
}

export function isHabitDueOnIsoDate(scheduleRule: HabitScheduleRule, isoDate: IsoDateString) {
  if (!scheduleRule.daysOfWeek || scheduleRule.daysOfWeek.length === 0) {
    return true;
  }

  return scheduleRule.daysOfWeek.includes(getIsoDateWeekday(isoDate));
}

export function filterDueHabits<T extends { scheduleRuleJson: unknown }>(
  habits: T[],
  isoDate: IsoDateString,
) {
  return habits.filter((habit) =>
    isHabitDueOnIsoDate(normalizeHabitScheduleRule(habit.scheduleRuleJson), isoDate),
  );
}

export function calculateHabitStreak(
  checkins: HabitCheckinLike[],
  scheduleRule: HabitScheduleRule,
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

    if (!isHabitDueOnIsoDate(scheduleRule, targetDate)) {
      continue;
    }

    if (!completedDates.has(targetDate)) {
      break;
    }

    streak += 1;
  }

  return streak;
}
