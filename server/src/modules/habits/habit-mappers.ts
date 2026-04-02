import type {
  CreateHabitPauseWindowRequest,
  HabitCheckinRequest,
  HabitItem,
  HabitPauseWindow,
  HabitScheduleRule,
  IsoDateString,
  RecurrenceInput,
  UpdateHabitRequest,
} from "@life-os/contracts";
import type {
  CheckinStatus as PrismaCheckinStatus,
  GoalStatus as PrismaGoalStatus,
  HabitPauseKind as PrismaHabitPauseKind,
  HabitStatus as PrismaHabitStatus,
} from "@prisma/client";

import {
  calculateHabitActiveStreak,
  calculateHabitRisk,
} from "../../lib/habits/guidance.js";
import {
  getHabitCompletionCountForIsoDate,
  isHabitCompletedOnIsoDate,
  isHabitDueOnIsoDate,
  isHabitPermanentlyInactive,
  resolveHabitRecurrence,
} from "../../lib/habits/schedule.js";
import { buildLegacyHabitRecurrence, deriveHabitScheduleFromRecurrence } from "../../lib/recurrence/rules.js";
import { serializeRecurrenceDefinition } from "../../lib/recurrence/store.js";
import { toIsoDateString } from "../../lib/time/date.js";
import { fromPrismaGoalDomainSystemKey } from "../planning/planning-mappers.js";
import type { HabitDetailRecord } from "./habit-record-shapes.js";

const fromPrismaGoalStatus = (status: PrismaGoalStatus) => {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "PAUSED":
      return "paused";
    case "COMPLETED":
      return "completed";
    case "ARCHIVED":
      return "archived";
  }
};

const serializeGoalSummary = (goal: NonNullable<HabitDetailRecord["goal"]>): HabitItem["goal"] => ({
  id: goal.id,
  title: goal.title,
  domainId: goal.domainId,
  domain: goal.domain.name,
  domainSystemKey: fromPrismaGoalDomainSystemKey(goal.domain.systemKey),
  status: fromPrismaGoalStatus(goal.status),
});

const fromPrismaHabitPauseKind = (kind: PrismaHabitPauseKind): HabitPauseWindow["kind"] => {
  switch (kind) {
    case "REST_DAY":
      return "rest_day";
    case "VACATION":
      return "vacation";
  }
};

export const toPrismaHabitStatus = (
  status: NonNullable<UpdateHabitRequest["status"]>,
): PrismaHabitStatus => {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "paused":
      return "PAUSED";
    case "archived":
      return "ARCHIVED";
  }
};

export const fromPrismaHabitStatus = (status: PrismaHabitStatus): HabitItem["status"] => {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "PAUSED":
      return "paused";
    case "ARCHIVED":
      return "archived";
  }
};

export const toPrismaCheckinStatus = (
  status: NonNullable<HabitCheckinRequest["status"]>,
): PrismaCheckinStatus => {
  switch (status) {
    case "completed":
      return "COMPLETED";
    case "skipped":
      return "SKIPPED";
  }
};

export const toPrismaHabitPauseKind = (
  kind: CreateHabitPauseWindowRequest["kind"],
): PrismaHabitPauseKind => {
  switch (kind) {
    case "rest_day":
      return "REST_DAY";
    case "vacation":
      return "VACATION";
  }
};

export const resolveHabitRecurrenceInput = (
  payload: { recurrence?: RecurrenceInput; scheduleRule?: HabitScheduleRule },
  fallbackIsoDate: IsoDateString,
) => {
  if (payload.recurrence) {
    return payload.recurrence;
  }

  return {
    rule: buildLegacyHabitRecurrence(payload.scheduleRule ?? {}, fallbackIsoDate),
    exceptions: [],
  };
};

export const serializeHabitPauseWindow = (
  pauseWindow: HabitDetailRecord["pauseWindows"][number],
  targetIsoDate: IsoDateString,
): HabitPauseWindow => {
  const startsOn = toIsoDateString(pauseWindow.startsOn);
  const endsOn = toIsoDateString(pauseWindow.endsOn);

  return {
    id: pauseWindow.id,
    kind: fromPrismaHabitPauseKind(pauseWindow.kind),
    startsOn,
    endsOn,
    note: pauseWindow.note,
    isActiveToday: startsOn <= targetIsoDate && targetIsoDate <= endsOn,
  };
};

export const serializeHabit = (
  habit: HabitDetailRecord,
  targetIsoDate: IsoDateString,
  options?: { pauseWindowCutoffIsoDate?: IsoDateString },
): HabitItem => {
  const checkins = habit.checkins ?? [];
  const pauseWindows = habit.pauseWindows ?? [];
  const recurrence = resolveHabitRecurrence(habit, targetIsoDate);
  const scheduleRule = deriveHabitScheduleFromRecurrence(recurrence.rule);
  const dueToday = isHabitPermanentlyInactive(habit)
    ? false
    : isHabitDueOnIsoDate(recurrence, targetIsoDate, pauseWindows);
  const completedCountToday = getHabitCompletionCountForIsoDate(checkins, targetIsoDate);
  const completedToday = isHabitCompletedOnIsoDate(checkins, targetIsoDate, habit.targetPerDay);

  return {
    id: habit.id,
    title: habit.title,
    category: habit.category,
    scheduleRule,
    recurrence: serializeRecurrenceDefinition(habit.recurrenceRule),
    goalId: habit.goalId ?? null,
    goal: habit.goal ? serializeGoalSummary(habit.goal) : null,
    targetPerDay: habit.targetPerDay,
    status: fromPrismaHabitStatus(habit.status),
    dueToday,
    completedToday,
    completedCountToday,
    streakCount: calculateHabitActiveStreak(checkins, recurrence, targetIsoDate, pauseWindows, habit.targetPerDay),
    risk: isHabitPermanentlyInactive(habit)
      ? {
          level: "none",
          reason: null,
          message: null,
          dueCount7d: 0,
          completedCount7d: 0,
          completionRate7d: 100,
        }
      : calculateHabitRisk(checkins, recurrence, targetIsoDate, pauseWindows, habit.targetPerDay),
    pauseWindows: pauseWindows
      .filter(
        (pauseWindow) =>
          toIsoDateString(pauseWindow.endsOn) >= (options?.pauseWindowCutoffIsoDate ?? targetIsoDate),
      )
      .map((pauseWindow) => serializeHabitPauseWindow(pauseWindow, targetIsoDate)),
  };
};
