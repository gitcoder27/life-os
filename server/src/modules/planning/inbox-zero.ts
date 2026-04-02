import type { Prisma, PrismaClient } from "@prisma/client";

import { buildStaleInboxTaskWhere, STALE_INBOX_THRESHOLD_DAYS } from "../../lib/inbox/stale.js";
import { getDayWindowUtc, getUserLocalDate } from "../../lib/time/user-time.js";
import { createAuditEvent } from "../auth/service.js";
import { ensureGeneratedNotification } from "../notifications/service.js";
import { normalizeNotificationPreferences } from "../notifications/policy.js";

type InboxZeroClient = PrismaClient | Prisma.TransactionClient;

export type InboxZeroMutationSource =
  | "task_update"
  | "task_bulk_schedule"
  | "task_bulk_status"
  | "task_bulk_archive"
  | "task_carry_forward"
  | "task_bulk_carry_forward";

export async function countStaleInboxTasks(
  prisma: InboxZeroClient,
  input: {
    userId: string;
    targetDate: Date;
    timezone?: string | null;
  },
) {
  return prisma.task.count({
    where: buildStaleInboxTaskWhere(input),
  });
}

export async function recordInboxZeroIfEarned(
  prisma: InboxZeroClient,
  input: {
    userId: string;
    targetDate: Date;
    timezone?: string | null;
    staleCountBefore: number;
    mutationSource: InboxZeroMutationSource;
    affectedTaskIds: string[];
  },
) {
  if (input.staleCountBefore <= 0) {
    return false;
  }

  const staleCountAfter = await countStaleInboxTasks(prisma, input);

  if (staleCountAfter !== 0) {
    return false;
  }

  const preferences = await prisma.userPreference.findUnique({
    where: {
      userId: input.userId,
    },
    select: {
      timezone: true,
      notificationPreferences: true,
    },
  });
  const timezone = input.timezone ?? preferences?.timezone ?? null;
  const localDate = getUserLocalDate(input.targetDate, timezone);
  const dayWindow = getDayWindowUtc(localDate, timezone);

  await createAuditEvent(prisma, {
    userId: input.userId,
    eventType: "inbox.zero_achieved",
    eventPayloadJson: {
      localDate,
      staleCountBefore: input.staleCountBefore,
      staleCountAfter,
      thresholdDays: STALE_INBOX_THRESHOLD_DAYS,
      mutationSource: input.mutationSource,
      affectedTaskIds: input.affectedTaskIds,
    },
  });

  await ensureGeneratedNotification(prisma, {
    userId: input.userId,
    notificationType: "inbox",
    severity: "INFO",
    title: "Inbox Zero reached",
    body: "No stale captures are waiting in your inbox.",
    entityType: "inbox_zero",
    entityId: localDate,
    ruleKey: "inbox_zero_achieved",
    timezone,
    now: input.targetDate,
    notificationPreferences: normalizeNotificationPreferences(
      preferences?.notificationPreferences,
    ),
    expiresAt: dayWindow.end,
  });

  return true;
}
