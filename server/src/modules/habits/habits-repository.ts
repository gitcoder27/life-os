import type { IsoDateString } from "@life-os/contracts";

import { AppError } from "../../lib/errors/app-error.js";
import { getUserLocalDate } from "../../lib/time/user-time.js";
import { buildHabitDetailInclude, buildRoutineWithCheckinsInclude, habitRelationsInclude } from "./habit-record-shapes.js";
import type { HabitsApp, HabitsPrisma } from "./module-types.js";

export const getTodayContext = async (app: HabitsApp, userId: string) => {
  const preferences = await app.prisma.userPreference.findUnique({
    where: {
      userId,
    },
    select: {
      timezone: true,
      weekStartsOn: true,
    },
  });

  return {
    targetIsoDate: getUserLocalDate(new Date(), preferences?.timezone),
    weekStartsOn: preferences?.weekStartsOn ?? 1,
  };
};

export const listHabitsForUser = async (
  prisma: HabitsPrisma,
  userId: string,
  targetIsoDate: IsoDateString,
) =>
  prisma.habit.findMany({
    where: {
      userId,
    },
    include: buildHabitDetailInclude(targetIsoDate),
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });

export const loadHabitDetail = async (
  prisma: HabitsPrisma,
  habitId: string,
  targetIsoDate: IsoDateString,
) =>
  prisma.habit.findUniqueOrThrow({
    where: {
      id: habitId,
    },
    include: buildHabitDetailInclude(targetIsoDate),
  });

export const findOwnedHabit = async (prisma: HabitsPrisma, userId: string, habitId: string) => {
  const habit = await prisma.habit.findFirst({
    where: {
      id: habitId,
      userId,
    },
    include: {
      pauseWindows: {
        orderBy: {
          startsOn: "asc",
        },
      },
    },
  });

  if (!habit) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Habit not found",
    });
  }

  return habit;
};

export const findOverlappingPauseWindow = async (
  prisma: HabitsPrisma,
  input: {
    habitId: string;
    startsOn: Date;
    endsOn: Date;
  },
) =>
  prisma.habitPauseWindow.findFirst({
    where: {
      habitId: input.habitId,
      startsOn: {
        lte: input.endsOn,
      },
      endsOn: {
        gte: input.startsOn,
      },
    },
  });

export const findOwnedPauseWindow = async (
  prisma: HabitsPrisma,
  userId: string,
  habitId: string,
  pauseWindowId: string,
) => {
  const pauseWindow = await prisma.habitPauseWindow.findFirst({
    where: {
      id: pauseWindowId,
      habitId,
      habit: {
        userId,
      },
    },
  });

  if (!pauseWindow) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Habit pause window not found",
    });
  }

  return pauseWindow;
};

export const assertOwnedGoalReference = async (
  prisma: HabitsPrisma,
  userId: string,
  goalId: string | null | undefined,
) => {
  if (!goalId) {
    return;
  }

  const goal = await prisma.goal.findFirst({
    where: {
      id: goalId,
      userId,
    },
  });

  if (!goal) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Goal not found",
    });
  }
};

export const listRoutinesForUser = async (prisma: HabitsPrisma, userId: string, onDate: Date) =>
  prisma.routine.findMany({
    where: {
      userId,
    },
    include: buildRoutineWithCheckinsInclude(onDate),
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

export const findOwnedRoutine = async (prisma: HabitsPrisma, userId: string, routineId: string) => {
  const routine = await prisma.routine.findFirst({
    where: {
      id: routineId,
      userId,
    },
  });

  if (!routine) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Routine not found",
    });
  }

  return routine;
};

export const findOwnedRoutineItem = async (
  prisma: HabitsPrisma,
  userId: string,
  routineItemId: string,
) => {
  const item = await prisma.routineItem.findFirst({
    where: {
      id: routineItemId,
      routine: {
        userId,
      },
    },
    include: {
      routine: true,
    },
  });

  if (!item) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Routine item not found",
    });
  }

  return item;
};

export const loadRoutineById = async (prisma: HabitsPrisma, routineId: string, onDate: Date) =>
  prisma.routine.findUniqueOrThrow({
    where: {
      id: routineId,
    },
    include: buildRoutineWithCheckinsInclude(onDate),
  });
