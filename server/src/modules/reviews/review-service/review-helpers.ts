import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  ReviewHistoryItem,
  ReviewHistorySummary,
  ReviewHistoryRange,
  ReviewSubmissionWindow,
} from "@life-os/contracts";

import { AppError } from "../../../lib/errors/app-error.js";
import { addIsoDays } from "../../../lib/time/cycle.js";
import { serializePriority as serializePlanningPriority } from "../../planning/planning-mappers.js";
import { goalSummaryInclude } from "../../planning/planning-record-shapes.js";

import type {
  ReviewFrictionTag,
  ReviewHistoryCursorPayload,
  ReviewHistoryQuery,
  ReviewPrioritySeed,
} from "./review-types.js";

export function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export const serializePriority = serializePlanningPriority;

export async function assertOwnedPriorityGoalReferences(
  prisma: PrismaClient | Prisma.TransactionClient,
  userId: string,
  priorities: ReviewPrioritySeed[],
) {
  const goalIds = [...new Set(priorities.flatMap((priority) => (priority.goalId ? [priority.goalId] : [])))];
  if (goalIds.length === 0) {
    return;
  }

  const count = await prisma.goal.count({
    where: {
      userId,
      id: {
        in: goalIds,
      },
    },
  });

  if (count !== goalIds.length) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Planning priorities can only reference goals you own",
    });
  }
}

export async function getUserPreferences(prisma: PrismaClient, userId: string) {
  return prisma.userPreference?.findUnique
    ? prisma.userPreference.findUnique({
        where: {
          userId,
        },
      })
    : null;
}

export function assertReviewSubmissionWindow(reviewLabel: string, submissionWindow: ReviewSubmissionWindow) {
  if (submissionWindow.isOpen) {
    return;
  }

  const message = submissionWindow.allowedDate
    ? `${reviewLabel} can only be submitted for ${submissionWindow.allowedDate} right now. Active window: ${submissionWindow.opensAt ?? "unknown"} to ${submissionWindow.closesAt ?? "unknown"} (${submissionWindow.timezone}).`
    : `${reviewLabel} is closed right now. The next window opens at ${submissionWindow.opensAt ?? "unknown"} and closes at ${submissionWindow.closesAt ?? "unknown"} (${submissionWindow.timezone}).`;

  throw new AppError({
    statusCode: 409,
    code: "REVIEW_OUT_OF_WINDOW",
    message,
  });
}

export function throwReviewAlreadySubmitted(reviewLabel: "Weekly review" | "Monthly review") {
  throw new AppError({
    statusCode: 409,
    code: "REVIEW_ALREADY_SUBMITTED",
    message: `${reviewLabel} has already been completed for this period`,
  });
}

export function listIsoDates(startDate: string, endDate: string) {
  const dates: string[] = [];

  for (
    let currentDate = startDate;
    currentDate <= endDate;
    currentDate = addIsoDays(currentDate, 1)
  ) {
    dates.push(currentDate);
  }

  return dates;
}

export function normalizeReviewHistoryQuery(query: ReviewHistoryQuery) {
  return {
    cadence: query.cadence ?? "all",
    range: query.range ?? "90d",
    q: query.q?.trim() ?? "",
    cursor: query.cursor ?? null,
    limit: Math.min(50, Math.max(1, query.limit ?? 30)),
  };
}

export function resolveHistoryRangeStart(range: ReviewHistoryRange, now: Date) {
  if (range === "all") {
    return null;
  }

  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const offset = range === "30d" ? 29 : range === "90d" ? 89 : 364;
  start.setUTCDate(start.getUTCDate() - offset);
  return start;
}

export function containsNormalized(haystack: string | null | undefined, needle: string) {
  if (!needle) {
    return true;
  }

  return haystack?.toLowerCase().includes(needle) ?? false;
}

export function buildReviewHistoryRoute(cadence: ReviewHistoryItem["cadence"], periodStart: string) {
  return `/reviews/${cadence}?date=${periodStart}`;
}

export function createHistoryMetric(
  key: string,
  label: string,
  value: number | string | null,
  valueLabel: string,
): ReviewHistoryItem["metrics"][number] {
  return {
    key,
    label,
    value,
    valueLabel,
  };
}

export function compareHistoryItems(left: ReviewHistoryItem, right: ReviewHistoryItem) {
  const completedDiff = right.completedAt.localeCompare(left.completedAt);
  if (completedDiff !== 0) {
    return completedDiff;
  }

  const cadenceDiff = right.cadence.localeCompare(left.cadence);
  if (cadenceDiff !== 0) {
    return cadenceDiff;
  }

  return right.id.localeCompare(left.id);
}

function encodeReviewHistoryCursor(item: ReviewHistoryItem) {
  return Buffer.from(
    JSON.stringify({
      cadence: item.cadence,
      id: item.id,
      completedAt: item.completedAt,
    } satisfies ReviewHistoryCursorPayload),
  ).toString("base64url");
}

function decodeReviewHistoryCursor(cursor: string): ReviewHistoryCursorPayload {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<ReviewHistoryCursorPayload>;
    if (
      !parsed ||
      (parsed.cadence !== "daily" && parsed.cadence !== "weekly" && parsed.cadence !== "monthly") ||
      typeof parsed.id !== "string" ||
      typeof parsed.completedAt !== "string"
    ) {
      throw new Error("Invalid cursor payload");
    }

    return parsed as ReviewHistoryCursorPayload;
  } catch {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Invalid review history cursor",
    });
  }
}

export function paginateReviewHistoryItems(items: ReviewHistoryItem[], cursor: string | null, limit: number) {
  const startIndex = cursor
    ? (() => {
        const decoded = decodeReviewHistoryCursor(cursor);
        const index = items.findIndex(
          (item) =>
            item.id === decoded.id &&
            item.cadence === decoded.cadence &&
            item.completedAt === decoded.completedAt,
        );

        if (index === -1) {
          throw new AppError({
            statusCode: 400,
            code: "BAD_REQUEST",
            message: "Review history cursor no longer matches the current result set",
          });
        }

        return index + 1;
      })()
    : 0;
  const page = items.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < items.length;

  return {
    items: page,
    nextCursor: hasMore && page.length > 0 ? encodeReviewHistoryCursor(page[page.length - 1]!) : null,
  };
}

export function addFrictionTagCounts(
  counts: Partial<Record<ReviewFrictionTag, number>>,
  tags: ReviewFrictionTag[],
) {
  for (const tag of tags) {
    counts[tag] = (counts[tag] ?? 0) + 1;
  }
}

export function getTopFrictionTags(
  counts: Partial<Record<ReviewFrictionTag, number>>,
  limit = 3,
): Array<{ tag: ReviewFrictionTag; count: number }> {
  return Object.entries(counts)
    .sort((left, right) => right[1]! - left[1]!)
    .slice(0, limit)
    .map(([tag, count]) => ({ tag: tag as ReviewFrictionTag, count: count ?? 0 }));
}

export function formatPeriodLabel(startDate: string, endDate: string) {
  return startDate === endDate ? startDate : `${startDate} to ${endDate}`;
}

export function roundToPercent(value: number) {
  return Math.round(value * 100);
}

export async function replacePriorities(
  prisma: PrismaClient | Prisma.TransactionClient,
  planningCycleId: string,
  priorities: ReviewPrioritySeed[],
  sourceReviewType: "DAILY" | "WEEKLY" | "MONTHLY",
) {
  await prisma.cyclePriority.deleteMany({
    where: {
      planningCycleId,
    },
  });

  if (priorities.length > 0) {
    await prisma.cyclePriority.createMany({
      data: priorities.map((priority) => ({
        planningCycleId,
        slot: priority.slot,
        title: priority.title,
        goalId: priority.goalId ?? null,
        sourceReviewType,
      })),
    });
  }

  const refreshed = await prisma.cyclePriority.findMany({
    where: {
      planningCycleId,
    },
    orderBy: {
      slot: "asc",
    },
    include: {
      goal: {
        include: goalSummaryInclude,
      },
    },
  });

  return refreshed.map(serializePriority);
}

export function buildReviewHistorySummary(items: ReviewHistoryItem[]): ReviewHistorySummary {
  const countsByCadence: ReviewHistorySummary["countsByCadence"] = {
    daily: 0,
    weekly: 0,
    monthly: 0,
  };
  const frictionCounts: Partial<Record<ReviewFrictionTag, number>> = {};

  for (const item of items) {
    countsByCadence[item.cadence] += 1;
    addFrictionTagCounts(frictionCounts, item.frictionTags);
  }

  return {
    totalReviews: items.length,
    countsByCadence,
    topFrictionTags: getTopFrictionTags(frictionCounts),
  };
}
