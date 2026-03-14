import type { PrismaClient } from "@prisma/client";

import { addDays, getMonthEndDate, getWeekEndDate } from "../lib/time/cycle.js";
import { materializeRecurringExpenseItems } from "../modules/finance/service.js";
import { cleanupOldNotifications, generateRuleNotifications } from "../modules/notifications/service.js";
import { ensureCycle, finalizeClosedDayScores } from "../modules/scoring/service.js";

export interface JobRunContext {
  prisma: PrismaClient;
  now: Date;
  logger: Console;
}

export interface JobRunResult {
  summary: string;
}

export interface JobDefinition {
  name: string;
  schedule: string;
  description: string;
  run: (context: JobRunContext) => Promise<JobRunResult>;
}

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

const sessionCleanupJob: JobDefinition = {
  name: "session-cleanup",
  schedule: "daily",
  description: "Delete expired or revoked sessions",
  async run({ prisma, now }) {
    const result = await prisma.session.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: now } }, { revokedAt: { not: null } }],
      },
    });

    return {
      summary: `deleted ${result.count} expired/revoked session record(s)`,
    };
  },
};

const cycleSeedingJob: JobDefinition = {
  name: "cycle-seeding",
  schedule: "daily",
  description: "Seed current and upcoming day/week/month planning cycles",
  async run({ prisma, now }) {
    const users = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
      },
      select: {
        id: true,
        preferences: {
          select: {
            weekStartsOn: true,
          },
        },
      },
    });
    const today = startOfDay(now);
    const tomorrow = addDays(today, 1);
    let seededCycles = 0;

    for (const user of users) {
      const weekStartsOn = user.preferences?.weekStartsOn ?? 1;
      const currentWeekStart = startOfWeek(today, weekStartsOn);
      const nextWeekStart = addDays(currentWeekStart, 7);
      const currentMonthStart = startOfMonth(today);
      const nextMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));

      await Promise.all([
        ensureCycle(prisma, {
          userId: user.id,
          cycleType: "DAY",
          cycleStartDate: today,
          cycleEndDate: today,
        }),
        ensureCycle(prisma, {
          userId: user.id,
          cycleType: "DAY",
          cycleStartDate: tomorrow,
          cycleEndDate: tomorrow,
        }),
        ensureCycle(prisma, {
          userId: user.id,
          cycleType: "WEEK",
          cycleStartDate: currentWeekStart,
          cycleEndDate: getWeekEndDate(currentWeekStart),
        }),
        ensureCycle(prisma, {
          userId: user.id,
          cycleType: "WEEK",
          cycleStartDate: nextWeekStart,
          cycleEndDate: getWeekEndDate(nextWeekStart),
        }),
        ensureCycle(prisma, {
          userId: user.id,
          cycleType: "MONTH",
          cycleStartDate: currentMonthStart,
          cycleEndDate: getMonthEndDate(currentMonthStart),
        }),
        ensureCycle(prisma, {
          userId: user.id,
          cycleType: "MONTH",
          cycleStartDate: nextMonthStart,
          cycleEndDate: getMonthEndDate(nextMonthStart),
        }),
      ]);

      seededCycles += 6;
    }

    return {
      summary: `seeded/upserted ${seededCycles} planning cycle(s) for ${users.length} user(s)`,
    };
  },
};

const recurringExpenseMaterializerJob: JobDefinition = {
  name: "recurring-expense-materializer",
  schedule: "daily",
  description: "Generate pending admin items from recurring expense templates",
  async run({ prisma, now }) {
    const result = await materializeRecurringExpenseItems(prisma, now);

    return {
      summary: `created ${result.createdAdminItems} admin item(s), advanced ${result.advancedTemplates} template(s), skipped ${result.unsupportedTemplates} unsupported template(s)`,
    };
  },
};

const notificationEvaluatorJob: JobDefinition = {
  name: "notification-evaluator",
  schedule: "every-15-minutes",
  description: "Create rule-based notifications for due reviews, health, routines, habits, and admin items",
  async run({ prisma, now }) {
    const result = await generateRuleNotifications(prisma, now);

    return {
      summary: `created ${result.created} notification(s), skipped ${result.skippedExisting} existing notification(s)`,
    };
  },
};

const notificationCleanupJob: JobDefinition = {
  name: "notification-cleanup",
  schedule: "weekly",
  description: "Delete old dismissed, expired, or read notifications",
  async run({ prisma, now }) {
    const result = await cleanupOldNotifications(prisma, now);

    return {
      summary: `deleted ${result.deleted} old notification record(s)`,
    };
  },
};

const scoreFinalizerJob: JobDefinition = {
  name: "score-finalizer",
  schedule: "daily",
  description: "Finalize day scores after the review window closes",
  async run({ prisma, now }) {
    const result = await finalizeClosedDayScores(prisma, now);

    return {
      summary: `finalized ${result.finalizedCount} closed-day score(s)`,
    };
  },
};

export function getRegisteredJobs(): JobDefinition[] {
  return [
    sessionCleanupJob,
    cycleSeedingJob,
    scoreFinalizerJob,
    recurringExpenseMaterializerJob,
    notificationEvaluatorJob,
    notificationCleanupJob,
  ];
}
