import type { PrismaClient } from "@prisma/client";

import { parseIsoDate } from "../../lib/time/cycle.js";
import { getUserLocalDate, normalizeTimezone } from "../../lib/time/user-time.js";
import { normalizeNotificationPreferences } from "../notifications/policy.js";
import { ensureGeneratedNotification } from "../notifications/service.js";

export interface ReminderExecutionResult {
  promoted: number;
  notified: number;
  skippedNotifications: number;
}

export async function executeDueReminders(
  prisma: PrismaClient,
  now: Date,
): Promise<ReminderExecutionResult> {
  const dueTasks = await prisma.task.findMany({
    where: {
      kind: "REMINDER",
      status: "PENDING",
      reminderAt: {
        lte: now,
      },
      reminderTriggeredAt: null,
      user: {
        status: "ACTIVE",
      },
    },
    include: {
      user: {
        include: {
          preferences: {
            select: {
              timezone: true,
              notificationPreferences: true,
            },
          },
        },
      },
    },
    orderBy: [{ reminderAt: "asc" }, { createdAt: "asc" }],
  });

  let promoted = 0;
  let notified = 0;
  let skippedNotifications = 0;

  for (const task of dueTasks) {
    const timezone = normalizeTimezone(task.user.preferences?.timezone);
    const todayIsoDate = getUserLocalDate(now, timezone);
    const notificationPreferences = normalizeNotificationPreferences(
      task.user.preferences?.notificationPreferences,
    );

    const reminderResult = await prisma.$transaction(async (tx) => {
      const taskUpdate = await tx.task.updateMany({
        where: {
          id: task.id,
          reminderTriggeredAt: null,
        },
        data: {
          scheduledForDate: task.scheduledForDate ?? parseIsoDate(todayIsoDate),
          reminderTriggeredAt: now,
        },
      });

      if (taskUpdate.count === 0) {
        return {
          claimed: false,
          createdNotification: false,
        };
      }

      const createdNotification = await ensureGeneratedNotification(tx, {
        userId: task.userId,
        notificationType: "task",
        severity: "WARNING",
        title: `Reminder: ${task.title}`,
        body: task.notes?.trim() || task.title,
        entityType: "task",
        entityId: `${task.id}:${task.reminderAt?.toISOString() ?? now.toISOString()}`,
        ruleKey: "reminder_due",
        timezone,
        now,
        notificationPreferences,
      });

      return {
        claimed: true,
        createdNotification,
      };
    });

    if (!reminderResult.claimed) {
      skippedNotifications += 1;
      continue;
    }

    if (!task.scheduledForDate) {
      promoted += 1;
    }

    if (reminderResult.createdNotification) {
      notified += 1;
    } else {
      skippedNotifications += 1;
    }
  }

  return {
    promoted,
    notified,
    skippedNotifications,
  };
}
