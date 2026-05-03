import type { IsoDateString } from "@life-os/contracts";
import type { PrismaClient } from "@prisma/client";

import { getUtcDateForLocalTime } from "../../lib/time/user-time.js";
import { isoDateStringSchema } from "../../lib/validation/date-range.js";

interface BackfillResult {
  updated: number;
  skipped: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseLegacyQuickCapture(notes: string | null) {
  if (!notes) {
    return null;
  }

  try {
    const parsed = JSON.parse(notes);

    if (
      !isRecord(parsed) ||
      parsed.marker !== "life_os_capture" ||
      parsed.v !== 1 ||
      (parsed.kind !== "note" && parsed.kind !== "reminder") ||
      typeof parsed.text !== "string"
    ) {
      return null;
    }

    return {
      kind: parsed.kind,
      text: parsed.text.trim() || null,
      reminderDate:
        typeof parsed.reminderDate === "string" && isoDateStringSchema.safeParse(parsed.reminderDate).success
          ? (parsed.reminderDate as IsoDateString)
          : null,
    };
  } catch {
    return null;
  }
}

export async function backfillTaskReminders(prisma: PrismaClient): Promise<BackfillResult> {
  const tasks = await prisma.task.findMany({
    where: {
      notes: {
        not: null,
      },
    },
    include: {
      user: {
        include: {
          preferences: {
            select: {
              timezone: true,
            },
          },
        },
      },
    },
  });

  let updated = 0;
  let skipped = 0;

  for (const task of tasks) {
    const parsed = parseLegacyQuickCapture(task.notes);

    if (!parsed) {
      skipped += 1;
      continue;
    }

    await prisma.task.update({
      where: {
        id: task.id,
      },
      data: {
        kind: parsed.kind === "note" ? "NOTE" : "REMINDER",
        notes: parsed.text,
        reminderAt:
          parsed.kind === "reminder" && parsed.reminderDate
            ? getUtcDateForLocalTime(parsed.reminderDate, "00:00", task.user.preferences?.timezone)
            : null,
        reminderTriggeredAt: null,
      },
    });
    updated += 1;
  }

  return {
    updated,
    skipped,
  };
}
