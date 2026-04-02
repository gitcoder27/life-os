import type {
  HabitRiskState,
  HabitScheduleRule,
  IsoDateString,
  RecurrenceDefinition,
  WeeklyHabitChallenge,
} from "@life-os/contracts";

import { addIsoDays } from "../time/cycle.js";
import {
  calculateHabitStreak,
  getHabitCompletionCountForIsoDate,
  isHabitCompletedOnIsoDate,
  isHabitDueOnIsoDate,
  type HabitPauseWindowLike,
} from "./schedule.js";

interface HabitCheckinLike {
  occurredOn: Date;
  status: "COMPLETED" | "SKIPPED";
  completionCount?: number | null;
}

function getDueDatesInRange(
  scheduleInput: HabitScheduleRule | RecurrenceDefinition,
  startIsoDate: IsoDateString,
  endIsoDate: IsoDateString,
  pauseWindows: HabitPauseWindowLike[] = [],
) {
  const dueDates: IsoDateString[] = [];
  let cursor = startIsoDate;

  while (cursor <= endIsoDate) {
    if (isHabitDueOnIsoDate(scheduleInput, cursor, pauseWindows)) {
      dueDates.push(cursor);
    }

    cursor = addIsoDays(cursor, 1);
  }

  return dueDates;
}

function countCompletedDueUnits(
  checkins: HabitCheckinLike[],
  dueDates: IsoDateString[],
  targetPerDay: number,
) {
  return dueDates.reduce(
    (sum, isoDate) => sum + Math.min(getHabitCompletionCountForIsoDate(checkins, isoDate), targetPerDay),
    0,
  );
}

export function calculateHabitActiveStreak(
  checkins: HabitCheckinLike[],
  scheduleInput: HabitScheduleRule | RecurrenceDefinition,
  targetIsoDate: IsoDateString,
  pauseWindows: HabitPauseWindowLike[] = [],
  targetPerDay = 1,
) {
  const dueToday = isHabitDueOnIsoDate(scheduleInput, targetIsoDate, pauseWindows);
  const completedToday = isHabitCompletedOnIsoDate(checkins, targetIsoDate, targetPerDay);

  return calculateHabitStreak(
    checkins,
    scheduleInput,
    targetIsoDate,
    dueToday && !completedToday ? 1 : 0,
    pauseWindows,
    targetPerDay,
  );
}

export function calculateHabitRisk(
  checkins: HabitCheckinLike[],
  scheduleInput: HabitScheduleRule | RecurrenceDefinition,
  targetIsoDate: IsoDateString,
  pauseWindows: HabitPauseWindowLike[] = [],
  targetPerDay = 1,
): HabitRiskState {
  const dueToday = isHabitDueOnIsoDate(scheduleInput, targetIsoDate, pauseWindows);
  const completedToday = isHabitCompletedOnIsoDate(checkins, targetIsoDate, targetPerDay);
  const dueDates7d = getDueDatesInRange(scheduleInput, addIsoDays(targetIsoDate, -6), targetIsoDate, pauseWindows);
  const completedCount7d = countCompletedDueUnits(checkins, dueDates7d, targetPerDay);
  const dueCount7d = dueDates7d.length * Math.max(1, targetPerDay);
  const completionRate7d = dueCount7d > 0 ? Math.round((completedCount7d / dueCount7d) * 100) : 100;
  const missedDueCount7d = dueCount7d - completedCount7d;
  const activeStreak = calculateHabitActiveStreak(
    checkins,
    scheduleInput,
    targetIsoDate,
    pauseWindows,
    targetPerDay,
  );

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
  scheduleInput: HabitScheduleRule | RecurrenceDefinition;
  weekStartIsoDate: IsoDateString;
  targetIsoDate: IsoDateString;
  pauseWindows?: HabitPauseWindowLike[];
  targetPerDay?: number;
}): WeeklyHabitChallenge {
  const weekEndIsoDate = addIsoDays(input.weekStartIsoDate, 6);
  const pauseWindows = input.pauseWindows ?? [];
  const targetPerDay = Math.max(1, input.targetPerDay ?? 1);
  const dueDatesThisWeek = getDueDatesInRange(
    input.scheduleInput,
    input.weekStartIsoDate,
    weekEndIsoDate,
    pauseWindows,
  );
  const dueDatesByToday = getDueDatesInRange(
    input.scheduleInput,
    input.weekStartIsoDate,
    input.targetIsoDate,
    pauseWindows,
  );
  const weekCompletions = countCompletedDueUnits(input.checkins, dueDatesByToday, targetPerDay);
  const completedToday = isHabitCompletedOnIsoDate(input.checkins, input.targetIsoDate, targetPerDay);
  const dueToday = isHabitDueOnIsoDate(input.scheduleInput, input.targetIsoDate, pauseWindows);
  const expectedByNow = dueDatesByToday.length * targetPerDay;
  const streakCount = calculateHabitActiveStreak(
    input.checkins,
    input.scheduleInput,
    input.targetIsoDate,
    pauseWindows,
    targetPerDay,
  );

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
    weekTarget: dueDatesThisWeek.length * targetPerDay,
    status,
    message,
  };
}
