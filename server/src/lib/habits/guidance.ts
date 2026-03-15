import type {
  HabitRiskState,
  HabitScheduleRule,
  IsoDateString,
  WeeklyHabitChallenge,
} from "@life-os/contracts";

import { addIsoDays } from "../time/cycle.js";
import { toIsoDateString } from "../time/date.js";
import { calculateHabitStreak, isHabitDueOnIsoDate } from "./schedule.js";

interface HabitCheckinLike {
  occurredOn: Date;
  status: "COMPLETED" | "SKIPPED";
}

function getCompletedDates(checkins: HabitCheckinLike[]) {
  return new Set(
    checkins
      .filter((checkin) => checkin.status === "COMPLETED")
      .map((checkin) => toIsoDateString(checkin.occurredOn)),
  );
}

function getDueDatesInRange(
  scheduleRule: HabitScheduleRule,
  startIsoDate: IsoDateString,
  endIsoDate: IsoDateString,
) {
  const dueDates: IsoDateString[] = [];
  let cursor = startIsoDate;

  while (cursor <= endIsoDate) {
    if (isHabitDueOnIsoDate(scheduleRule, cursor)) {
      dueDates.push(cursor);
    }

    cursor = addIsoDays(cursor, 1);
  }

  return dueDates;
}

function countCompletedDueDates(dueDates: IsoDateString[], completedDates: Set<IsoDateString>) {
  return dueDates.filter((isoDate) => completedDates.has(isoDate)).length;
}

export function calculateHabitActiveStreak(
  checkins: HabitCheckinLike[],
  scheduleRule: HabitScheduleRule,
  targetIsoDate: IsoDateString,
) {
  const dueToday = isHabitDueOnIsoDate(scheduleRule, targetIsoDate);
  const completedToday = getCompletedDates(checkins).has(targetIsoDate);

  return calculateHabitStreak(
    checkins,
    scheduleRule,
    targetIsoDate,
    dueToday && !completedToday ? 1 : 0,
  );
}

export function calculateHabitRisk(
  checkins: HabitCheckinLike[],
  scheduleRule: HabitScheduleRule,
  targetIsoDate: IsoDateString,
): HabitRiskState {
  const completedDates = getCompletedDates(checkins);
  const dueToday = isHabitDueOnIsoDate(scheduleRule, targetIsoDate);
  const completedToday = completedDates.has(targetIsoDate);
  const dueDates7d = getDueDatesInRange(scheduleRule, addIsoDays(targetIsoDate, -6), targetIsoDate);
  const completedCount7d = countCompletedDueDates(dueDates7d, completedDates);
  const dueCount7d = dueDates7d.length;
  const completionRate7d = dueCount7d > 0 ? Math.round((completedCount7d / dueCount7d) * 100) : 100;
  const missedDueCount7d = dueCount7d - completedCount7d;
  const activeStreak = calculateHabitActiveStreak(checkins, scheduleRule, targetIsoDate);

  if (dueToday && !completedToday && activeStreak >= 2) {
    return {
      level: "at_risk",
      reason: "streak_at_risk",
      message: `${activeStreak}-day streak is on the line today.`,
      dueCount7d,
      completedCount7d,
      completionRate7d,
    };
  }

  if (dueCount7d >= 3 && missedDueCount7d >= 2) {
    return {
      level: "drifting",
      reason: "missed_recently",
      message: `Missed ${missedDueCount7d} due check-ins in the last 7 days.`,
      dueCount7d,
      completedCount7d,
      completionRate7d,
    };
  }

  if (dueCount7d >= 3 && completionRate7d < 60) {
    return {
      level: "drifting",
      reason: "low_completion_rate",
      message: `Only ${completionRate7d}% of due check-ins landed over the last 7 days.`,
      dueCount7d,
      completedCount7d,
      completionRate7d,
    };
  }

  return {
    level: "none",
    reason: null,
    message: null,
    dueCount7d,
    completedCount7d,
    completionRate7d,
  };
}

export function calculateWeeklyHabitChallenge(input: {
  habit: {
    id: string;
    title: string;
  };
  checkins: HabitCheckinLike[];
  scheduleRule: HabitScheduleRule;
  weekStartIsoDate: IsoDateString;
  targetIsoDate: IsoDateString;
}): WeeklyHabitChallenge {
  const completedDates = getCompletedDates(input.checkins);
  const weekEndIsoDate = addIsoDays(input.weekStartIsoDate, 6);
  const dueDatesThisWeek = getDueDatesInRange(input.scheduleRule, input.weekStartIsoDate, weekEndIsoDate);
  const dueDatesByToday = getDueDatesInRange(input.scheduleRule, input.weekStartIsoDate, input.targetIsoDate);
  const weekCompletions = countCompletedDueDates(dueDatesByToday, completedDates);
  const completedToday = completedDates.has(input.targetIsoDate);
  const dueToday = isHabitDueOnIsoDate(input.scheduleRule, input.targetIsoDate);
  const expectedByNow = dueDatesByToday.length;
  const streakCount = calculateHabitActiveStreak(input.checkins, input.scheduleRule, input.targetIsoDate);

  const status =
    dueToday && !completedToday ? "due_today" : weekCompletions < expectedByNow ? "behind" : "on_track";

  let message = "Weekly focus habit is on track.";
  if (status === "due_today") {
    message = `${input.habit.title} is due today. Keep the weekly focus alive.`;
  } else if (status === "behind") {
    message = `${input.habit.title} slipped earlier this week. Reset it with today's session.`;
  } else if (completedToday) {
    message = `${input.habit.title} is already complete today.`;
  }

  return {
    habitId: input.habit.id,
    title: input.habit.title,
    streakCount,
    completedToday,
    weekCompletions,
    weekTarget: dueDatesThisWeek.length,
    status,
    message,
  };
}
