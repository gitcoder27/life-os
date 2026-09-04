import type { PrismaClient } from "@prisma/client";
import type {
  HabitRiskState,
  HabitSummary,
  IsoDateString,
  RoutineSummary,
  WeeklyHabitChallenge,
} from "@life-os/contracts";

import {
  calculateHabitActiveStreak,
  calculateHabitRisk,
  calculateWeeklyHabitChallenge,
} from "../../lib/habits/guidance.js";
import {
  isHabitCompletedOnIsoDate,
  isHabitDueOnIsoDate,
  isHabitPermanentlyInactive,
  resolveHabitRecurrence,
} from "../../lib/habits/schedule.js";
import {
  buildHabitTimingLabel,
  getHabitTimingStatusToday,
} from "../../lib/habits/timing.js";
import { addIsoDays, parseIsoDate } from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import { getUserLocalHour } from "../../lib/time/user-time.js";

type HomeHabitsPrisma = Pick<
  PrismaClient,
  "habit" | "habitCheckin" | "routine" | "routineItemCheckin"
>;

export type HomeHabitGuidanceItem = {
  id: string;
  title: string;
  dueToday: boolean;
  completedToday: boolean;
  timingStatusToday: "none" | "upcoming" | "due_now" | "late" | "complete_on_time" | "complete_late";
  timingLabel: string | null;
  streakCount: number;
  risk: HabitRiskState;
};

function currentRoutinePeriod(date: Date, timezone?: string | null): RoutineSummary["currentPeriod"] {
  const hour = getUserLocalHour(date, timezone);

  if (hour < 15) {
    return "morning";
  }

  if (hour < 23) {
    return "evening";
  }

  return "none";
}

export async function loadHomeHabitSummary(
  prisma: HomeHabitsPrisma,
  input: {
    userId: string;
    targetDate: Date;
    targetIsoDate: IsoDateString;
    currentIsoDate: IsoDateString;
    weekStartIsoDate: IsoDateString;
    weeklyFocusHabitId?: string | null;
    timezone: string | null;
    now: Date;
  },
): Promise<{
  habitItems: HomeHabitGuidanceItem[];
  habitSummary: HabitSummary;
  routineSummary: RoutineSummary;
  weeklyChallenge: WeeklyHabitChallenge | null;
}> {
  const [habits, recentHabitCheckins, routines, routineCheckins] = await Promise.all([
    prisma.habit.findMany({
      where: {
        userId: input.userId,
        status: "ACTIVE",
        archivedAt: null,
      },
      include: {
        recurrenceRule: {
          include: {
            exceptions: {
              orderBy: {
                occurrenceDate: "asc",
              },
            },
          },
        },
        pauseWindows: {
          orderBy: {
            startsOn: "asc",
          },
        },
      },
    }),
    prisma.habitCheckin.findMany({
      where: {
        occurredOn: {
          gte: parseIsoDate(addIsoDays(input.targetIsoDate, -30)),
          lte: input.targetDate,
        },
        habit: {
          userId: input.userId,
        },
      },
    }),
    prisma.routine.findMany({
      where: {
        userId: input.userId,
        status: "ACTIVE",
      },
      include: {
        items: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    }),
    prisma.routineItemCheckin.findMany({
      where: {
        occurredOn: input.targetDate,
        routineItem: {
          routine: {
            userId: input.userId,
          },
        },
      },
    }),
  ]);

  const dueHabits = habits.filter((habit) =>
    !isHabitPermanentlyInactive(habit) &&
    isHabitDueOnIsoDate(
      resolveHabitRecurrence(habit, input.targetIsoDate),
      input.targetIsoDate,
      habit.pauseWindows,
    ),
  );
  const completedHabits = dueHabits.filter((habit) =>
    isHabitCompletedOnIsoDate(
      recentHabitCheckins.filter((checkin) => checkin.habitId === habit.id),
      input.targetIsoDate,
      habit.targetPerDay,
    ),
  );
  const habitItems = habits.map((habit) => {
    const habitCheckins = recentHabitCheckins.filter((checkin) => checkin.habitId === habit.id);
    const recurrence = resolveHabitRecurrence(habit, input.targetIsoDate);
    const completedAtToday =
      habitCheckins.find((checkin) => toIsoDateString(checkin.occurredOn) === input.targetIsoDate)?.completedAt ?? null;
    const timingMode =
      habit.timingMode === "ANCHOR"
        ? "anchor"
        : habit.timingMode === "EXACT_TIME"
          ? "exact_time"
          : habit.timingMode === "TIME_WINDOW"
            ? "time_window"
            : "anytime";

    return {
      id: habit.id,
      title: habit.title,
      dueToday:
        !isHabitPermanentlyInactive(habit) &&
        isHabitDueOnIsoDate(recurrence, input.targetIsoDate, habit.pauseWindows),
      completedToday: isHabitCompletedOnIsoDate(habitCheckins, input.targetIsoDate, habit.targetPerDay),
      timingStatusToday: getHabitTimingStatusToday({
        timingMode,
        targetPerDay: habit.targetPerDay,
        completedAt: completedAtToday,
        now: input.now,
        targetIsoDate: input.targetIsoDate,
        timezone: input.timezone,
        targetTimeMinutes: habit.targetTimeMinutes ?? null,
        windowStartMinutes: habit.windowStartMinutes ?? null,
        windowEndMinutes: habit.windowEndMinutes ?? null,
      }),
      timingLabel: buildHabitTimingLabel({
        timingMode,
        anchorText: habit.anchorText ?? null,
        targetTimeMinutes: habit.targetTimeMinutes ?? null,
        windowStartMinutes: habit.windowStartMinutes ?? null,
        windowEndMinutes: habit.windowEndMinutes ?? null,
      }),
      streakCount: calculateHabitActiveStreak(
        habitCheckins,
        recurrence,
        input.targetIsoDate,
        habit.pauseWindows,
        habit.targetPerDay,
      ),
      risk: calculateHabitRisk(
        habitCheckins,
        recurrence,
        input.targetIsoDate,
        habit.pauseWindows,
        habit.targetPerDay,
      ),
    };
  });

  const totalRoutineItems = routines.reduce((sum, routine) => sum + routine.items.length, 0);
  const weeklyChallengeHabit = input.weeklyFocusHabitId
    ? habits.find((habit) => habit.id === input.weeklyFocusHabitId)
    : null;
  const weeklyChallenge =
    weeklyChallengeHabit && !isHabitPermanentlyInactive(weeklyChallengeHabit)
      ? (() => {
          const checkins = recentHabitCheckins.filter((checkin) => checkin.habitId === weeklyChallengeHabit.id);
          const challenge = calculateWeeklyHabitChallenge({
            habit: {
              id: weeklyChallengeHabit.id,
              title: weeklyChallengeHabit.title,
            },
            checkins,
            scheduleInput: resolveHabitRecurrence(weeklyChallengeHabit, input.targetIsoDate),
            weekStartIsoDate: input.weekStartIsoDate,
            targetIsoDate: input.targetIsoDate,
            pauseWindows: weeklyChallengeHabit.pauseWindows,
            targetPerDay: weeklyChallengeHabit.targetPerDay,
          });

          return challenge.weekTarget > 0 ? challenge : null;
        })()
      : null;

  return {
    habitItems,
    habitSummary: {
      completedToday: completedHabits.length,
      dueToday: dueHabits.length,
      streakHighlights: completedHabits.slice(0, 3).map((habit) => `${habit.title} active today`),
    },
    routineSummary: {
      completedItems: routineCheckins.length,
      totalItems: totalRoutineItems,
      currentPeriod:
        input.targetIsoDate === input.currentIsoDate ? currentRoutinePeriod(input.now, input.timezone) : "none",
    },
    weeklyChallenge,
  };
}
