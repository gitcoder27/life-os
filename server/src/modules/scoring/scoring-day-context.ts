import type { IsoDateString } from "@life-os/contracts";
import type { PrismaClient } from "@prisma/client";

import {
  addDays,
  getMonthEndDate,
  getMonthStartIsoDate,
  getWeekEndDate,
  getWeekStartIsoDate,
  parseIsoDate,
} from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import {
  getDayWindowUtc,
  normalizeTimezone,
} from "../../lib/time/user-time.js";
import { ensureCycle } from "./planning-cycle-service.js";

export const getDayContext = async (prisma: PrismaClient, userId: string, date: Date) => {
  const targetIsoDate = toIsoDateString(date) as IsoDateString;
  const targetDate = parseIsoDate(targetIsoDate);
  const preferences = await prisma.userPreference.findUnique({
    where: {
      userId,
    },
  });
  const timezone = normalizeTimezone(preferences?.timezone);
  const weekStartsOn = preferences?.weekStartsOn ?? 1;
  const { start: dayWindowStart, end: dayWindowEnd } = getDayWindowUtc(targetIsoDate, timezone);
  const tomorrowDate = addDays(targetDate, 1);
  const tomorrowIsoDate = toIsoDateString(tomorrowDate) as IsoDateString;
  const weekStartDate = parseIsoDate(getWeekStartIsoDate(targetIsoDate, weekStartsOn));
  const monthStartDate = parseIsoDate(getMonthStartIsoDate(targetIsoDate));
  const nextMonthStart = new Date(
    Date.UTC(monthStartDate.getUTCFullYear(), monthStartDate.getUTCMonth() + 1, 1),
  );

  const dayCycle = await ensureCycle(prisma, {
    userId,
    cycleType: "DAY",
    cycleStartDate: targetDate,
    cycleEndDate: targetDate,
  });

  const tomorrowCycle = await ensureCycle(prisma, {
    userId,
    cycleType: "DAY",
    cycleStartDate: tomorrowDate,
    cycleEndDate: tomorrowDate,
  });

  const weekCycle = await ensureCycle(prisma, {
    userId,
    cycleType: "WEEK",
    cycleStartDate: weekStartDate,
    cycleEndDate: getWeekEndDate(weekStartDate),
  });

  await ensureCycle(prisma, {
    userId,
    cycleType: "MONTH",
    cycleStartDate: monthStartDate,
    cycleEndDate: getMonthEndDate(monthStartDate),
  });
  await ensureCycle(prisma, {
    userId,
    cycleType: "MONTH",
    cycleStartDate: nextMonthStart,
    cycleEndDate: getMonthEndDate(nextMonthStart),
  });

  const [
    tasks,
    dailyLaunch,
    activeHabits,
    habitCheckins,
    activeRoutines,
    routineCheckins,
    waterLogs,
    mealLogs,
    workoutDay,
    financeTransactions,
    expenses,
    dueAdminItems,
  ] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId,
        scheduledForDate: targetDate,
      },
      include: {
        plannerBlockTask: {
          include: {
            block: true,
          },
        },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
    }),
    prisma.dailyLaunch?.findUnique?.({
      where: {
        planningCycleId: dayCycle.id,
      },
    }) ?? Promise.resolve(null),
    prisma.habit.findMany({
      where: {
        userId,
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
        habit: {
          userId,
        },
        occurredOn: targetDate,
      },
    }),
    prisma.routine.findMany({
      where: {
        userId,
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
        occurredOn: targetDate,
        routineItem: {
          routine: {
            userId,
          },
        },
      },
    }),
    prisma.waterLog.findMany({
      where: {
        userId,
        occurredAt: {
          gte: dayWindowStart,
          lt: dayWindowEnd,
        },
      },
    }),
    prisma.mealLog.findMany({
      where: {
        userId,
        occurredAt: {
          gte: dayWindowStart,
          lt: dayWindowEnd,
        },
      },
    }),
    prisma.workoutDay.findUnique({
      where: {
        userId_date: {
          userId,
          date: targetDate,
        },
      },
    }),
    prisma.financeTransaction?.findMany?.({
      where: {
        userId,
        transactionType: "EXPENSE",
        occurredOn: {
          gte: targetDate,
          lt: tomorrowDate,
        },
      },
    }) ?? Promise.resolve([]),
    prisma.expense.findMany({
      where: {
        userId,
        spentOn: {
          gte: targetDate,
          lt: tomorrowDate,
        },
      },
    }),
    prisma.adminItem.findMany({
      where: {
        userId,
        dueOn: targetDate,
      },
    }),
  ]);

  return {
    date: targetDate,
    targetIsoDate,
    dayCycle,
    tomorrowCycle,
    weekCycle,
    tasks,
    dailyLaunch,
    activeHabits,
    habitCheckins,
    activeRoutines,
    routineCheckins,
    waterLogs,
    mealLogs,
    workoutDay,
    financeTransactions,
    expenses,
    dueAdminItems,
    preferences,
    timezone,
  };
};

export type ScoringDayContext = Awaited<ReturnType<typeof getDayContext>>;
