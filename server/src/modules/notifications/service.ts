import type { Prisma, PrismaClient } from "@prisma/client";

import { addDays, getMonthEndDate, getWeekEndDate } from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import { ensureCycle } from "../scoring/service.js";

interface NotificationGenerationResult {
  created: number;
  skippedExisting: number;
}

interface NotificationCleanupResult {
  deleted: number;
}

type NotificationClient = PrismaClient | Prisma.TransactionClient;

function startOfDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfWeek(date: Date, weekStartsOn: number) {
  const normalized = startOfDay(date);
  const day = normalized.getUTCDay();
  const delta = (day - weekStartsOn + 7) % 7;

  return addDays(normalized, -delta);
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function atUtcHour(date: Date, hour: number) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hour,
      0,
      0,
      0,
    ),
  );
}

async function ensureGeneratedNotification(
  prisma: NotificationClient,
  input: {
    userId: string;
    notificationType: string;
    severity: "INFO" | "WARNING" | "CRITICAL";
    title: string;
    body: string;
    entityType: string;
    entityId: string;
    ruleKey: string;
    visibleFrom?: Date | null;
    expiresAt?: Date | null;
  },
) {
  const existing = await prisma.notification.findFirst({
    where: {
      userId: input.userId,
      ruleKey: input.ruleKey,
      entityType: input.entityType,
      entityId: input.entityId,
    },
  });

  if (existing) {
    return false;
  }

  await prisma.notification.create({
    data: {
      userId: input.userId,
      notificationType: input.notificationType,
      severity: input.severity,
      title: input.title,
      body: input.body,
      entityType: input.entityType,
      entityId: input.entityId,
      ruleKey: input.ruleKey,
      visibleFrom: input.visibleFrom ?? null,
      expiresAt: input.expiresAt ?? null,
    },
  });

  return true;
}

function normalizeScheduleRule(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  return input as { daysOfWeek?: number[] };
}

function isHabitDueOn(scheduleRule: { daysOfWeek?: number[] }, date: Date) {
  if (!scheduleRule.daysOfWeek || scheduleRule.daysOfWeek.length === 0) {
    return true;
  }

  return scheduleRule.daysOfWeek.includes(date.getUTCDay());
}

function calculateHabitStreak(
  checkins: Array<{ occurredOn: Date; status: "COMPLETED" | "SKIPPED" }>,
  scheduleRule: { daysOfWeek?: number[] },
  onDate: Date,
) {
  const completedDates = new Set(
    checkins
      .filter((checkin) => checkin.status === "COMPLETED")
      .map((checkin) => toIsoDateString(checkin.occurredOn)),
  );
  let streak = 0;

  for (let offset = 1; offset <= 30; offset += 1) {
    const date = addDays(onDate, -offset);

    if (!isHabitDueOn(scheduleRule, date)) {
      continue;
    }

    if (!completedDates.has(toIsoDateString(date))) {
      break;
    }

    streak += 1;
  }

  return streak;
}

export async function generateRuleNotifications(
  prisma: PrismaClient,
  now: Date,
): Promise<NotificationGenerationResult> {
  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
    },
    include: {
      preferences: true,
    },
  });

  let created = 0;
  let skippedExisting = 0;
  const today = startOfDay(now);
  const todayIso = toIsoDateString(today);
  const tomorrow = addDays(today, 1);
  const lateEvening = now >= atUtcHour(now, 20);
  const lateAfternoon = now >= atUtcHour(now, 18);

  for (const user of users) {
    const weekStartsOn = user.preferences?.weekStartsOn ?? 1;
    const waterTargetMl = user.preferences?.dailyWaterTargetMl ?? 2500;

    const [
      dueAdminItems,
      todayWaterLogs,
      todayWorkout,
      activeRoutines,
      todayRoutineCheckins,
      activeHabits,
      recentHabitCheckins,
    ] = await Promise.all([
      prisma.adminItem.findMany({
        where: {
          userId: user.id,
          status: "PENDING",
          dueOn: {
            gte: today,
            lt: addDays(today, 4),
          },
        },
        orderBy: [{ dueOn: "asc" }],
      }),
      prisma.waterLog.findMany({
        where: {
          userId: user.id,
          occurredAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),
      prisma.workoutDay.findUnique({
        where: {
          userId_date: {
            userId: user.id,
            date: today,
          },
        },
      }),
      prisma.routine.findMany({
        where: {
          userId: user.id,
          status: "ACTIVE",
        },
        include: {
          items: true,
        },
      }),
      prisma.routineItemCheckin.findMany({
        where: {
          occurredOn: today,
          routineItem: {
            routine: {
              userId: user.id,
            },
          },
        },
      }),
      prisma.habit.findMany({
        where: {
          userId: user.id,
          status: "ACTIVE",
          archivedAt: null,
        },
      }),
      prisma.habitCheckin.findMany({
        where: {
          habit: {
            userId: user.id,
          },
          occurredOn: {
            gte: addDays(today, -30),
            lt: tomorrow,
          },
        },
      }),
    ]);

    for (const adminItem of dueAdminItems) {
      const daysUntilDue = Math.round(
        (startOfDay(adminItem.dueOn).getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
      );
      const createdNotification = await ensureGeneratedNotification(prisma, {
        userId: user.id,
        notificationType: "finance",
        severity: daysUntilDue === 0 ? "CRITICAL" : "WARNING",
        title:
          daysUntilDue === 0
            ? `${adminItem.title} is due today`
            : daysUntilDue === 1
              ? `${adminItem.title} is due tomorrow`
              : `${adminItem.title} is due soon`,
        body: `Due on ${toIsoDateString(adminItem.dueOn)}.`,
        entityType: "admin_item",
        entityId: `${adminItem.id}:${todayIso}`,
        ruleKey: "admin_item_due_soon",
        expiresAt: addDays(startOfDay(adminItem.dueOn), 1),
      });

      if (createdNotification) {
        created += 1;
      } else {
        skippedExisting += 1;
      }
    }

    if (lateAfternoon) {
      const currentWaterMl = todayWaterLogs.reduce((sum, log) => sum + log.amountMl, 0);
      if (currentWaterMl < waterTargetMl / 2) {
        const createdNotification = await ensureGeneratedNotification(prisma, {
          userId: user.id,
          notificationType: "health",
          severity: "WARNING",
          title: "Water intake is behind target",
          body: `${currentWaterMl}ml logged against a ${waterTargetMl}ml target.`,
          entityType: "health_day",
          entityId: `water:${todayIso}`,
          ruleKey: "low_water_late_day",
          visibleFrom: atUtcHour(now, 18),
          expiresAt: tomorrow,
        });

        if (createdNotification) {
          created += 1;
        } else {
          skippedExisting += 1;
        }
      }

      if (
        todayWorkout &&
        todayWorkout.planType !== "NONE" &&
        (todayWorkout.actualStatus === "NONE" || todayWorkout.actualStatus === "MISSED")
      ) {
        const createdNotification = await ensureGeneratedNotification(prisma, {
          userId: user.id,
          notificationType: "health",
          severity: todayWorkout.actualStatus === "MISSED" ? "CRITICAL" : "WARNING",
          title: "Workout still needs confirmation",
          body:
            todayWorkout.planType === "RECOVERY"
              ? "Recovery plan has not been confirmed yet."
              : "Workout plan is still unconfirmed for today.",
          entityType: "workout_day",
          entityId: `workout:${todayIso}`,
          ruleKey: "workout_unconfirmed_late_day",
          visibleFrom: atUtcHour(now, 18),
          expiresAt: tomorrow,
        });

        if (createdNotification) {
          created += 1;
        } else {
          skippedExisting += 1;
        }
      }

      const atRiskHabits = activeHabits
        .map((habit) => {
          const habitCheckins = recentHabitCheckins.filter((checkin) => checkin.habitId === habit.id);
          const scheduleRule = normalizeScheduleRule(habit.scheduleRuleJson);
          const completedToday = habitCheckins.some(
            (checkin) =>
              toIsoDateString(checkin.occurredOn) === todayIso && checkin.status === "COMPLETED",
          );

          return {
            habit,
            completedToday,
            dueToday: isHabitDueOn(scheduleRule, today),
            streak: calculateHabitStreak(habitCheckins, scheduleRule, today),
          };
        })
        .filter((item) => item.dueToday && !item.completedToday && item.streak >= 2)
        .sort((left, right) => right.streak - left.streak);

      if (atRiskHabits.length > 0) {
        const topHabit = atRiskHabits[0];
        const createdNotification = await ensureGeneratedNotification(prisma, {
          userId: user.id,
          notificationType: "habit",
          severity: "WARNING",
          title: `${topHabit.habit.title} streak is at risk`,
          body: `${topHabit.streak} day streak is active and the habit is still due today.`,
          entityType: "habit",
          entityId: `${topHabit.habit.id}:${todayIso}`,
          ruleKey: "habit_streak_at_risk",
          visibleFrom: atUtcHour(now, 18),
          expiresAt: tomorrow,
        });

        if (createdNotification) {
          created += 1;
        } else {
          skippedExisting += 1;
        }
      }
    }

    if (lateEvening) {
      const totalRoutineItems = activeRoutines.reduce((sum, routine) => sum + routine.items.length, 0);
      if (totalRoutineItems > todayRoutineCheckins.length) {
        const createdNotification = await ensureGeneratedNotification(prisma, {
          userId: user.id,
          notificationType: "routine",
          severity: "WARNING",
          title: "Routine items are still open",
          body: `${totalRoutineItems - todayRoutineCheckins.length} routine item(s) remain incomplete today.`,
          entityType: "routine_day",
          entityId: `routine:${todayIso}`,
          ruleKey: "incomplete_routine_late_day",
          visibleFrom: atUtcHour(now, 20),
          expiresAt: tomorrow,
        });

        if (createdNotification) {
          created += 1;
        } else {
          skippedExisting += 1;
        }
      }
    }

    const todayCycle = await ensureCycle(prisma, {
      userId: user.id,
      cycleType: "DAY",
      cycleStartDate: today,
      cycleEndDate: today,
    });
    if (lateEvening && !todayCycle.dailyReview) {
      const createdNotification = await ensureGeneratedNotification(prisma, {
        userId: user.id,
        notificationType: "review",
        severity: "WARNING",
        title: "Daily review is still open",
        body: `Complete the review for ${todayIso}.`,
        entityType: "daily_review",
        entityId: `daily-review:${todayIso}`,
        ruleKey: "daily_review_due",
        visibleFrom: atUtcHour(now, 20),
        expiresAt: tomorrow,
      });

      if (createdNotification) {
        created += 1;
      } else {
        skippedExisting += 1;
      }
    }

    const yesterday = addDays(today, -1);
    const yesterdayCycle = await ensureCycle(prisma, {
      userId: user.id,
      cycleType: "DAY",
      cycleStartDate: yesterday,
      cycleEndDate: yesterday,
    });
    if (!yesterdayCycle.dailyReview) {
      const createdNotification = await ensureGeneratedNotification(prisma, {
        userId: user.id,
        notificationType: "review",
        severity: "WARNING",
        title: "Yesterday's daily review is overdue",
        body: `Finish the review for ${toIsoDateString(yesterday)}.`,
        entityType: "daily_review",
        entityId: `daily-review-overdue:${toIsoDateString(yesterday)}`,
        ruleKey: "daily_review_overdue",
        expiresAt: tomorrow,
      });

      if (createdNotification) {
        created += 1;
      } else {
        skippedExisting += 1;
      }
    }

    const currentWeekStart = startOfWeek(today, weekStartsOn);
    const previousWeekStart = addDays(currentWeekStart, -7);
    const previousWeekCycle = await ensureCycle(prisma, {
      userId: user.id,
      cycleType: "WEEK",
      cycleStartDate: previousWeekStart,
      cycleEndDate: getWeekEndDate(previousWeekStart),
    });
    if (!previousWeekCycle.weeklyReview) {
      const createdNotification = await ensureGeneratedNotification(prisma, {
        userId: user.id,
        notificationType: "review",
        severity: "INFO",
        title: "Weekly review is overdue",
        body: `Complete the weekly review starting ${toIsoDateString(previousWeekStart)}.`,
        entityType: "weekly_review",
        entityId: `weekly-review:${toIsoDateString(previousWeekStart)}`,
        ruleKey: "weekly_review_overdue",
        expiresAt: addDays(getWeekEndDate(currentWeekStart), 1),
      });

      if (createdNotification) {
        created += 1;
      } else {
        skippedExisting += 1;
      }
    }

    const currentMonthStart = startOfMonth(today);
    const previousMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
    const previousMonthCycle = await ensureCycle(prisma, {
      userId: user.id,
      cycleType: "MONTH",
      cycleStartDate: previousMonthStart,
      cycleEndDate: getMonthEndDate(previousMonthStart),
    });
    if (!previousMonthCycle.monthlyReview) {
      const createdNotification = await ensureGeneratedNotification(prisma, {
        userId: user.id,
        notificationType: "review",
        severity: "INFO",
        title: "Monthly review is overdue",
        body: `Complete the monthly review for ${toIsoDateString(previousMonthStart).slice(0, 7)}.`,
        entityType: "monthly_review",
        entityId: `monthly-review:${toIsoDateString(previousMonthStart).slice(0, 7)}`,
        ruleKey: "monthly_review_overdue",
        expiresAt: addDays(getMonthEndDate(currentMonthStart), 1),
      });

      if (createdNotification) {
        created += 1;
      } else {
        skippedExisting += 1;
      }
    }
  }

  return {
    created,
    skippedExisting,
  };
}

export async function cleanupOldNotifications(
  prisma: PrismaClient,
  now: Date,
): Promise<NotificationCleanupResult> {
  const cutoff = addDays(startOfDay(now), -30);
  const result = await prisma.notification.deleteMany({
    where: {
      createdAt: {
        lt: cutoff,
      },
      OR: [
        { dismissedAt: { not: null } },
        { expiresAt: { not: null, lt: now } },
        { readAt: { not: null } },
      ],
    },
  });

  return {
    deleted: result.count,
  };
}
