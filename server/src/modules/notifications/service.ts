import type { Prisma, PrismaClient } from "@prisma/client";
import type { NotificationCategory, NotificationSeverity } from "@life-os/contracts";

import {
  calculateHabitStreak,
  isHabitDueOnIsoDate,
  normalizeHabitScheduleRule,
} from "../../lib/habits/schedule.js";
import { addDays, addIsoDays, getMonthEndDate, getMonthStartIsoDate, getWeekEndDate, getWeekStartIsoDate, parseIsoDate } from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import {
  getDayWindowUtc,
  getTimeWindowUtc,
  getUserLocalDate,
  getUserLocalHour,
  normalizeTimezone,
} from "../../lib/time/user-time.js";
import {
  buildNotificationDeliveryKey,
  buildNotificationNaturalKey,
  getEffectiveRepeatCadence,
  normalizeNotificationPreferences,
  shouldGenerateNotification,
} from "./policy.js";
import { ensureCycle } from "../scoring/service.js";
import { resolveDailyReviewSubmissionWindow } from "../reviews/submission-window.js";

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

async function ensureGeneratedNotification(
  prisma: NotificationClient,
  input: {
    userId: string;
    notificationType: NotificationCategory;
    severity: "INFO" | "WARNING" | "CRITICAL";
    title: string;
    body: string;
    entityType: string;
    entityId: string;
    ruleKey: string;
    timezone?: string | null;
    now: Date;
    notificationPreferences: ReturnType<typeof normalizeNotificationPreferences>;
    visibleFrom?: Date | null;
    expiresAt?: Date | null;
  },
) {
  const severity = input.severity.toLowerCase() as NotificationSeverity;
  const shouldCreate = shouldGenerateNotification({
    preferences: input.notificationPreferences,
    category: input.notificationType,
    severity,
  });

  if (!shouldCreate) {
    return false;
  }

  const naturalKey = buildNotificationNaturalKey({
    ruleKey: input.ruleKey,
    entityType: input.entityType,
    entityId: input.entityId,
  });
  const repeatCadence = getEffectiveRepeatCadence(
    input.notificationPreferences,
    input.notificationType,
  );
  const deliveryKey = buildNotificationDeliveryKey({
    naturalKey,
    now: input.now,
    timezone: input.timezone,
    repeatCadence,
  });

  const dismissed = await prisma.notification.findFirst({
    where: {
      userId: input.userId,
      ruleKey: input.ruleKey,
      entityType: input.entityType,
      entityId: input.entityId,
      dismissedAt: {
        not: null,
      },
    },
  });

  if (dismissed) {
    return false;
  }

  const activeUnread = await prisma.notification.findFirst({
    where: {
      userId: input.userId,
      ruleKey: input.ruleKey,
      entityType: input.entityType,
      entityId: input.entityId,
      dismissedAt: null,
      readAt: null,
    },
  });

  if (activeUnread) {
    return false;
  }

  const existing = await prisma.notification.findFirst({
    where: {
      userId: input.userId,
      ...(repeatCadence === "off"
        ? {
            ruleKey: input.ruleKey,
            entityType: input.entityType,
            entityId: input.entityId,
            dismissedAt: null,
          }
        : {
            deliveryKey,
            dismissedAt: null,
          }),
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
      deliveryKey,
      visibleFrom: input.visibleFrom ?? null,
      expiresAt: input.expiresAt ?? null,
    },
  });

  return true;
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

  for (const user of users) {
    const timezone = normalizeTimezone(user.preferences?.timezone);
    const weekStartsOn = user.preferences?.weekStartsOn ?? 1;
    const waterTargetMl = user.preferences?.dailyWaterTargetMl ?? 2500;
    const todayIso = getUserLocalDate(now, timezone);
    const today = parseIsoDate(todayIso);
    const tomorrowIso = addIsoDays(todayIso, 1);
    const tomorrow = parseIsoDate(tomorrowIso);
    const dayWindow = getDayWindowUtc(todayIso, timezone);
    const lateEvening = getUserLocalHour(now, timezone) >= 20;
    const lateAfternoon = getUserLocalHour(now, timezone) >= 18;
    const reviewPreferences = {
      timezone,
      weekStartsOn,
      dailyReviewStartTime: user.preferences?.dailyReviewStartTime,
      dailyReviewEndTime: user.preferences?.dailyReviewEndTime,
    };
    const notificationPreferences = normalizeNotificationPreferences(
      user.preferences?.notificationPreferences,
    );

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
            gte: dayWindow.start,
            lt: dayWindow.end,
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
            lte: today,
          },
        },
      }),
    ]);

    for (const adminItem of dueAdminItems) {
      const daysUntilDue = Math.round(
        (adminItem.dueOn.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
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
        now,
        timezone,
        notificationPreferences,
        expiresAt: getDayWindowUtc(toIsoDateString(adminItem.dueOn), timezone).end,
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
          now,
          timezone,
          notificationPreferences,
          visibleFrom: getTimeWindowUtc(todayIso, "18:00", timezone),
          expiresAt: dayWindow.end,
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
          now,
          timezone,
          notificationPreferences,
          visibleFrom: getTimeWindowUtc(todayIso, "18:00", timezone),
          expiresAt: dayWindow.end,
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
          const scheduleRule = normalizeHabitScheduleRule(habit.scheduleRuleJson);
          const completedToday = habitCheckins.some(
            (checkin) =>
              toIsoDateString(checkin.occurredOn) === todayIso && checkin.status === "COMPLETED",
          );

          return {
            habit,
            completedToday,
            dueToday: isHabitDueOnIsoDate(scheduleRule, todayIso),
            streak: calculateHabitStreak(habitCheckins, scheduleRule, todayIso, 1),
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
          now,
          timezone,
          notificationPreferences,
          visibleFrom: getTimeWindowUtc(todayIso, "18:00", timezone),
          expiresAt: dayWindow.end,
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
          now,
          timezone,
          notificationPreferences,
          visibleFrom: getTimeWindowUtc(todayIso, "20:00", timezone),
          expiresAt: dayWindow.end,
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
    const todayReviewWindow = resolveDailyReviewSubmissionWindow(todayIso, now, reviewPreferences);
    if (todayReviewWindow.isOpen && todayReviewWindow.allowedDate === todayIso && !todayCycle.dailyReview) {
      const createdNotification = await ensureGeneratedNotification(prisma, {
        userId: user.id,
        notificationType: "review",
        severity: "WARNING",
        title: "Daily review is still open",
        body: `Complete the review for ${todayIso}.`,
        entityType: "daily_review",
        entityId: `daily-review:${todayIso}`,
        ruleKey: "daily_review_due",
        now,
        timezone,
        notificationPreferences,
        visibleFrom: todayReviewWindow.opensAt ? new Date(todayReviewWindow.opensAt) : getTimeWindowUtc(todayIso, "20:00", timezone),
        expiresAt: todayReviewWindow.closesAt ? new Date(todayReviewWindow.closesAt) : dayWindow.end,
      });

      if (createdNotification) {
        created += 1;
      } else {
        skippedExisting += 1;
      }
    }

    const yesterday = parseIsoDate(addIsoDays(todayIso, -1));
    const yesterdayIso = toIsoDateString(yesterday);
    const yesterdayCycle = await ensureCycle(prisma, {
      userId: user.id,
      cycleType: "DAY",
      cycleStartDate: yesterday,
      cycleEndDate: yesterday,
    });
    const yesterdayReviewWindow = resolveDailyReviewSubmissionWindow(yesterdayIso, now, reviewPreferences);
    if (yesterdayReviewWindow.isOpen && yesterdayReviewWindow.allowedDate === yesterdayIso && !yesterdayCycle.dailyReview) {
      const createdNotification = await ensureGeneratedNotification(prisma, {
        userId: user.id,
        notificationType: "review",
        severity: "WARNING",
        title: "Yesterday's daily review is overdue",
        body: `Finish the review for ${toIsoDateString(yesterday)}.`,
        entityType: "daily_review",
        entityId: `daily-review-overdue:${toIsoDateString(yesterday)}`,
        ruleKey: "daily_review_overdue",
        now,
        timezone,
        notificationPreferences,
        expiresAt: yesterdayReviewWindow.closesAt ? new Date(yesterdayReviewWindow.closesAt) : dayWindow.end,
      });

      if (createdNotification) {
        created += 1;
      } else {
        skippedExisting += 1;
      }
    }

    const currentWeekStart = parseIsoDate(getWeekStartIsoDate(todayIso, weekStartsOn));
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
        now,
        timezone,
        notificationPreferences,
        expiresAt: getDayWindowUtc(addIsoDays(toIsoDateString(getWeekEndDate(currentWeekStart)), 1), timezone).start,
      });

      if (createdNotification) {
        created += 1;
      } else {
        skippedExisting += 1;
      }
    }

    const currentMonthStart = parseIsoDate(getMonthStartIsoDate(todayIso));
    const previousMonthStart = new Date(
      Date.UTC(currentMonthStart.getUTCFullYear(), currentMonthStart.getUTCMonth() - 1, 1),
    );
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
        now,
        timezone,
        notificationPreferences,
        expiresAt: getDayWindowUtc(addIsoDays(toIsoDateString(getMonthEndDate(currentMonthStart)), 1), timezone).start,
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
