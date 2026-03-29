import type {
  CreateHabitPauseWindowRequest,
  CreateHabitRequest,
  HabitCheckinRequest,
  HabitMutationResponse,
  HabitsResponse,
  IsoDateString,
  RecurrenceInput,
  UpdateHabitRequest,
} from "@life-os/contracts";
import type { Prisma } from "@prisma/client";

import { AppError } from "../../lib/errors/app-error.js";
import { calculateWeeklyHabitChallenge } from "../../lib/habits/guidance.js";
import {
  isHabitPausedOnIsoDate,
  isHabitPermanentlyInactive,
  resolveHabitRecurrence,
} from "../../lib/habits/schedule.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { upsertRecurrenceRuleRecord } from "../../lib/recurrence/store.js";
import { getWeekEndDate, getWeekStartIsoDate, parseIsoDate } from "../../lib/time/cycle.js";
import { ensureCycle } from "../scoring/service.js";
import {
  assertOwnedGoalReference,
  findOverlappingPauseWindow,
  findOwnedHabit,
  findOwnedPauseWindow,
  getTodayContext,
  listHabitsForUser,
  listRoutinesForUser,
  loadHabitDetail,
} from "./habits-repository.js";
import { resolveHabitRecurrenceInput, serializeHabit, toPrismaCheckinStatus, toPrismaHabitPauseKind, toPrismaHabitStatus } from "./habit-mappers.js";
import type { HabitDetailRecord } from "./habit-record-shapes.js";
import type { HabitsApp } from "./module-types.js";
import { serializeRoutine } from "./routine-mappers.js";

const buildWeeklyChallenge = (
  focusHabit: HabitDetailRecord | undefined,
  targetIsoDate: IsoDateString,
  weekStartsOn: number,
) => {
  if (!focusHabit || isHabitPermanentlyInactive(focusHabit)) {
    return null;
  }

  const pauseWindows = focusHabit.pauseWindows ?? [];
  const challenge = calculateWeeklyHabitChallenge({
    habit: {
      id: focusHabit.id,
      title: focusHabit.title,
    },
    checkins: focusHabit.checkins,
    scheduleInput: resolveHabitRecurrence(focusHabit, targetIsoDate),
    weekStartIsoDate: getWeekStartIsoDate(targetIsoDate, weekStartsOn),
    targetIsoDate,
    pauseWindows,
  });

  return challenge.weekTarget > 0 ? challenge : null;
};

const resolveMutationRecurrence = (
  payload: Pick<CreateHabitRequest, "recurrence" | "scheduleRule">,
  targetIsoDate: IsoDateString,
): RecurrenceInput =>
  resolveHabitRecurrenceInput(payload, targetIsoDate) as RecurrenceInput;

export const listHabits = async (app: HabitsApp, userId: string): Promise<HabitsResponse> => {
  const { targetIsoDate, weekStartsOn } = await getTodayContext(app, userId);
  const targetDate = parseIsoDate(targetIsoDate);
  const [habits, routines] = await Promise.all([
    listHabitsForUser(app.prisma, userId, targetIsoDate),
    listRoutinesForUser(app.prisma, userId, targetDate),
  ]);

  const habitItems = habits.map((habit) => serializeHabit(habit, targetIsoDate));
  const weekStartDate = parseIsoDate(getWeekStartIsoDate(targetIsoDate, weekStartsOn));
  const weekCycle = await ensureCycle(app.prisma, {
    userId,
    cycleType: "WEEK",
    cycleStartDate: weekStartDate,
    cycleEndDate: getWeekEndDate(weekStartDate),
  });
  const focusHabit = habits.find((habit) => habit.id === weekCycle.weeklyReview?.focusHabitId);

  return withGeneratedAt({
    date: targetIsoDate,
    habits: habitItems,
    dueHabits: habitItems.filter((habit) => habit.dueToday),
    routines: routines.map(serializeRoutine),
    weeklyChallenge: buildWeeklyChallenge(focusHabit, targetIsoDate, weekStartsOn),
  });
};

export const createHabit = async (
  app: HabitsApp,
  userId: string,
  payload: CreateHabitRequest,
): Promise<HabitMutationResponse> => {
  const { targetIsoDate } = await getTodayContext(app, userId);
  await assertOwnedGoalReference(app.prisma, userId, payload.goalId);

  const habit = await app.prisma.$transaction(async (tx) => {
    const recurrence = resolveMutationRecurrence(payload, targetIsoDate);
    const createdHabit = await tx.habit.create({
      data: {
        userId,
        title: payload.title,
        category: payload.category ?? null,
        scheduleRuleJson: recurrence.rule as unknown as Prisma.InputJsonValue,
        goalId: payload.goalId ?? null,
        targetPerDay: payload.targetPerDay ?? 1,
      },
    });

    const recurrenceRecord = await upsertRecurrenceRuleRecord(tx, {
      ownerType: "HABIT",
      ownerId: createdHabit.id,
      recurrence,
    });

    await tx.habit.update({
      where: {
        id: createdHabit.id,
      },
      data: {
        recurrenceRuleId: recurrenceRecord.id,
      },
    });

    return loadHabitDetail(tx, createdHabit.id, targetIsoDate);
  });

  return withGeneratedAt({
    habit: serializeHabit(habit, targetIsoDate),
  });
};

export const updateHabit = async (
  app: HabitsApp,
  userId: string,
  habitId: string,
  payload: UpdateHabitRequest,
): Promise<HabitMutationResponse> => {
  await findOwnedHabit(app.prisma, userId, habitId);
  await assertOwnedGoalReference(app.prisma, userId, payload.goalId);
  const { targetIsoDate } = await getTodayContext(app, userId);

  const habit = await app.prisma.$transaction(async (tx) => {
    const recurrence = payload.recurrence || payload.scheduleRule
      ? resolveMutationRecurrence(payload, targetIsoDate)
      : null;

    await tx.habit.update({
      where: {
        id: habitId,
      },
      data: {
        title: payload.title,
        category: payload.category,
        scheduleRuleJson:
          (recurrence?.rule ?? payload.scheduleRule) as Prisma.InputJsonValue | undefined,
        goalId: payload.goalId,
        targetPerDay: payload.targetPerDay,
        status: payload.status ? toPrismaHabitStatus(payload.status) : undefined,
        archivedAt: payload.status === "archived" ? new Date() : undefined,
      },
    });

    if (recurrence) {
      const recurrenceRecord = await upsertRecurrenceRuleRecord(tx, {
        ownerType: "HABIT",
        ownerId: habitId,
        recurrence,
      });

      await tx.habit.update({
        where: {
          id: habitId,
        },
        data: {
          recurrenceRuleId: recurrenceRecord.id,
        },
      });
    }

    return loadHabitDetail(tx, habitId, targetIsoDate);
  });

  return withGeneratedAt({
    habit: serializeHabit(habit, targetIsoDate),
  });
};

export const createHabitPauseWindow = async (
  app: HabitsApp,
  userId: string,
  habitId: string,
  payload: CreateHabitPauseWindowRequest,
): Promise<HabitMutationResponse> => {
  const existingHabit = await findOwnedHabit(app.prisma, userId, habitId);

  if (isHabitPermanentlyInactive(existingHabit)) {
    throw new AppError({
      statusCode: 409,
      code: "CONFLICT",
      message: "Only active habits can use temporary pause windows",
    });
  }

  const startsOn = parseIsoDate(payload.startsOn);
  const endsOn = parseIsoDate(payload.endsOn ?? payload.startsOn);
  const overlap = await findOverlappingPauseWindow(app.prisma, {
    habitId,
    startsOn,
    endsOn,
  });

  if (overlap) {
    throw new AppError({
      statusCode: 409,
      code: "CONFLICT",
      message: "This habit already has a temporary pause during that time",
    });
  }

  const { targetIsoDate } = await getTodayContext(app, userId);
  const habit = await app.prisma.$transaction(async (tx) => {
    await tx.habitPauseWindow.create({
      data: {
        habitId,
        kind: toPrismaHabitPauseKind(payload.kind),
        startsOn,
        endsOn,
        note: payload.note ?? null,
      },
    });

    return loadHabitDetail(tx, habitId, targetIsoDate);
  });

  return withGeneratedAt({
    habit: serializeHabit(habit, targetIsoDate, {
      pauseWindowCutoffIsoDate: payload.startsOn,
    }),
  });
};

export const deleteHabitPauseWindow = async (
  app: HabitsApp,
  userId: string,
  habitId: string,
  pauseWindowId: string,
): Promise<HabitMutationResponse> => {
  await findOwnedHabit(app.prisma, userId, habitId);
  await findOwnedPauseWindow(app.prisma, userId, habitId, pauseWindowId);
  const { targetIsoDate } = await getTodayContext(app, userId);

  const habit = await app.prisma.$transaction(async (tx) => {
    await tx.habitPauseWindow.delete({
      where: {
        id: pauseWindowId,
      },
    });

    return loadHabitDetail(tx, habitId, targetIsoDate);
  });

  return withGeneratedAt({
    habit: serializeHabit(habit, targetIsoDate),
  });
};

export const createHabitCheckin = async (
  app: HabitsApp,
  userId: string,
  habitId: string,
  payload: HabitCheckinRequest,
): Promise<HabitMutationResponse> => {
  const targetIsoDate = payload.date ?? (await getTodayContext(app, userId)).targetIsoDate;
  const targetDate = parseIsoDate(targetIsoDate);
  const habitRecord = await findOwnedHabit(app.prisma, userId, habitId);

  if (isHabitPermanentlyInactive(habitRecord)) {
    throw new AppError({
      statusCode: 409,
      code: "CONFLICT",
      message: "This habit is not currently active",
    });
  }

  if (isHabitPausedOnIsoDate(habitRecord.pauseWindows, targetIsoDate)) {
    throw new AppError({
      statusCode: 409,
      code: "CONFLICT",
      message: "This habit is temporarily paused for that date",
    });
  }

  const status = payload.status ?? "completed";
  await app.prisma.habitCheckin.upsert({
    where: {
      habitId_occurredOn: {
        habitId,
        occurredOn: targetDate,
      },
    },
    update: {
      status: toPrismaCheckinStatus(status),
      source: "TAP",
      completedAt: status === "skipped" ? null : new Date(),
      note: payload.note ?? null,
    },
    create: {
      habitId,
      occurredOn: targetDate,
      status: toPrismaCheckinStatus(status),
      source: "TAP",
      completedAt: status === "skipped" ? null : new Date(),
      note: payload.note ?? null,
    },
  });

  const habit = await loadHabitDetail(app.prisma, habitId, targetIsoDate);

  return withGeneratedAt({
    habit: serializeHabit(habit, targetIsoDate),
  });
};
