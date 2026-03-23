import type { Prisma } from "@prisma/client";

import { addIsoDays } from "../time/cycle.js";
import { toIsoDateString } from "../time/date.js";
import { getDayWindowUtc } from "../time/user-time.js";

export const STALE_INBOX_THRESHOLD_DAYS = 3;

export function buildStaleInboxTaskWhere(input: {
  userId: string;
  targetDate: Date;
  timezone?: string | null;
}): Prisma.TaskWhereInput {
  const targetIsoDate = toIsoDateString(input.targetDate);
  const staleInboxCutoffIsoDate = addIsoDays(targetIsoDate, -STALE_INBOX_THRESHOLD_DAYS);
  const staleInboxCutoff = getDayWindowUtc(staleInboxCutoffIsoDate, input.timezone);

  return {
    userId: input.userId,
    status: "PENDING",
    originType: "QUICK_CAPTURE",
    scheduledForDate: null,
    createdAt: {
      lt: staleInboxCutoff.start,
    },
  };
}
