import type {
  IsoDateString,
  MonthlyReviewHistoryTrendPoint,
  RecurrenceDefinition,
  ReviewHistoryCadence,
  ReviewHistoryCadenceFilter,
  ReviewHistoryItem,
  ReviewHistoryRange,
  ReviewHistoryResponse,
  ReviewHistorySummary,
  ReviewSubmissionWindow,
  WeeklyReviewHistoryTrendPoint,
} from "@life-os/contracts";
import type { Prisma, PrismaClient } from "@prisma/client";

import { AppError } from "../../lib/errors/app-error.js";
import {
  filterDueHabits,
  isHabitDueOnIsoDate,
  resolveHabitRecurrence,
} from "../../lib/habits/schedule.js";
import { buildWaterTotalsByLocalDate, countWaterTargetHits } from "../../lib/health/water.js";
import { applyRecurringTaskCarryForward, applyRecurringTaskSkip, materializeRecurringTasksInRange } from "../../lib/recurrence/tasks.js";
import { serializeRecurrenceDefinition } from "../../lib/recurrence/store.js";
import { addDays, addIsoDays, getMonthEndDate, getWeekEndDate, parseIsoDate } from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import { getDateRangeWindowUtc, getDayWindowUtc, normalizeTimezone } from "../../lib/time/user-time.js";
import { calculateDailyScore, ensureCycle, finalizeDailyScore, getWeeklyMomentum } from "../scoring/service.js";
import {
  resolveDailyReviewSubmissionWindow,
  resolveMonthlyReviewSubmissionWindow,
  resolveWeeklyReviewSubmissionWindow,
} from "./submission-window.js";

type ReviewFrictionTag =
  | "low energy"
  | "poor planning"
  | "distraction"
  | "interruptions"
  | "overcommitment"
  | "avoidance"
  | "unclear task"
  | "travel or schedule disruption";

interface PlanningPriorityInput {
  slot: 1 | 2 | 3;
  title: string;
  goalId?: string | null;
}

interface ReviewTaskDecision {
  taskId: string;
  targetDate: IsoDateString;
}

interface SubmitDailyReviewRequest {
  biggestWin: string;
  frictionTag: ReviewFrictionTag;
  frictionNote?: string | null;
  energyRating: number;
  optionalNote?: string | null;
  carryForwardTaskIds: string[];
  droppedTaskIds: string[];
  rescheduledTasks: ReviewTaskDecision[];
  tomorrowPriorities: PlanningPriorityInput[];
}

interface SubmitWeeklyReviewRequest {
  biggestWin: string;
  biggestMiss: string;
  mainLesson: string;
  keepText: string;
  improveText: string;
  nextWeekPriorities: PlanningPriorityInput[];
  focusHabitId?: string | null;
  healthTargetText?: string | null;
  spendingWatchCategoryId?: string | null;
  notes?: string | null;
}

interface SubmitMonthlyReviewRequest {
  monthVerdict: string;
  biggestWin: string;
  biggestLeak: string;
  ratings: Record<string, number>;
  nextMonthTheme: string;
  threeOutcomes: string[];
  habitChanges: string[];
  simplifyText: string;
  notes?: string | null;
}

interface DailyReviewSummary {
  prioritiesCompleted: number;
  prioritiesTotal: number;
  tasksCompleted: number;
  tasksScheduled: number;
  routinesCompleted: number;
  routinesTotal: number;
  habitsCompleted: number;
  habitsDue: number;
  waterMl: number;
  waterTargetMl: number;
  mealsLogged: number;
  workoutStatus: "completed" | "recovery_respected" | "fallback" | "missed" | "none";
  expensesLogged: number;
}

interface PlanningTaskItem {
  id: string;
  title: string;
  notes: string | null;
  kind: "task" | "note" | "reminder";
  reminderDate: string | null;
  status: "pending" | "completed" | "dropped";
  scheduledForDate: string | null;
  dueAt: string | null;
  goalId: string | null;
  originType: "manual" | "quick_capture" | "carry_forward" | "review_seed" | "recurring" | "template";
  carriedFromTaskId: string | null;
  recurrence: RecurrenceDefinition | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ExistingDailyReview {
  biggestWin: string;
  frictionTag: ReviewFrictionTag;
  frictionNote: string | null;
  energyRating: number;
  optionalNote: string | null;
  completedAt: string;
}

interface ExistingWeeklyReview {
  biggestWin: string;
  biggestMiss: string;
  mainLesson: string;
  keepText: string;
  improveText: string;
  focusHabitId: string | null;
  healthTargetText: string | null;
  spendingWatchCategoryId: string | null;
  notes: string | null;
  completedAt: string;
}

interface ExistingMonthlyReview {
  monthVerdict: string;
  biggestWin: string;
  biggestLeak: string;
  ratings: Record<string, number>;
  nextMonthTheme: string;
  threeOutcomes: string[];
  habitChanges: string[];
  simplifyText: string;
  notes: string | null;
  completedAt: string;
}

interface DailyReviewResponse {
  date: string;
  summary: DailyReviewSummary;
  score: Awaited<ReturnType<typeof calculateDailyScore>>;
  incompleteTasks: PlanningTaskItem[];
  existingReview: ExistingDailyReview | null;
  isCompleted: boolean;
  submissionWindow: ReviewSubmissionWindow;
  seededTomorrowPriorities: Array<{
    id: string;
    slot: 1 | 2 | 3;
    title: string;
    status: "pending" | "completed" | "dropped";
    goalId: string | null;
    completedAt: string | null;
  }>;
  generatedAt: string;
}

interface WeeklyReviewResponse {
  startDate: string;
  endDate: string;
  summary: {
    averageDailyScore: number;
    strongDayCount: number;
    habitCompletionRate: number;
    routineCompletionRate: number;
    workoutsCompleted: number;
    workoutsPlanned: number;
    waterTargetHitCount: number;
    mealsLoggedCount: number;
    spendingTotal: number;
    topSpendCategory: string | null;
    topFrictionTags: Array<{ tag: ReviewFrictionTag; count: number }>;
  };
  existingReview: ExistingWeeklyReview | null;
  seededNextWeekPriorities: Array<{
    id: string;
    slot: 1 | 2 | 3;
    title: string;
    status: "pending" | "completed" | "dropped";
    goalId: string | null;
    completedAt: string | null;
  }>;
  submissionWindow: ReviewSubmissionWindow;
  generatedAt: string;
}

interface MonthlyReviewResponse {
  startDate: string;
  endDate: string;
  summary: {
    averageWeeklyMomentum: number;
    bestScore: number | null;
    worstScore: number | null;
    workoutCount: number;
    waterSuccessRate: number;
    spendingByCategory: Array<{ category: string; amountMinor: number }>;
    topHabits: Array<{ habitId: string; title: string; completionRate: number }>;
    commonFrictionTags: Array<{ tag: ReviewFrictionTag; count: number }>;
  };
  existingReview: ExistingMonthlyReview | null;
  seededNextMonthTheme: string | null;
  seededNextMonthOutcomes: Array<{
    id: string;
    slot: 1 | 2 | 3;
    title: string;
    status: "pending" | "completed" | "dropped";
    goalId: string | null;
    completedAt: string | null;
  }>;
  submissionWindow: ReviewSubmissionWindow;
  generatedAt: string;
}

interface ReviewHistoryQuery {
  cadence?: ReviewHistoryCadenceFilter;
  range?: ReviewHistoryRange;
  q?: string;
  cursor?: string;
  limit?: number;
}

interface ReviewHistoryCursorPayload {
  cadence: ReviewHistoryCadence;
  id: string;
  completedAt: string;
}

interface WeeklyHistoryMetrics {
  averageDailyScore: number;
  habitCompletionRate: number;
  strongDayCount: number;
  topFrictionTags: ReviewFrictionTag[];
}

interface MonthlyHistoryMetrics {
  averageWeeklyMomentum: number;
  waterSuccessRate: number;
  workoutCount: number;
  topFrictionTags: ReviewFrictionTag[];
}

type DailyReviewHistoryRow = Prisma.DailyReviewGetPayload<{
  include: {
    planningCycle: {
      include: {
        dailyScore: true;
      };
    };
  };
}>;

type WeeklyReviewHistoryRow = Prisma.WeeklyReviewGetPayload<{
  include: {
    planningCycle: true;
  };
}>;

type MonthlyReviewHistoryRow = Prisma.MonthlyReviewGetPayload<{
  include: {
    planningCycle: true;
  };
}>;

const FRICTION_TAGS = [
  "low energy",
  "poor planning",
  "distraction",
  "interruptions",
  "overcommitment",
  "avoidance",
  "unclear task",
  "travel or schedule disruption",
] as const satisfies readonly ReviewFrictionTag[];

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function serializePriority(priority: {
  id: string;
  slot: number;
  title: string;
  status: "PENDING" | "COMPLETED" | "DROPPED";
  goalId: string | null;
  completedAt: Date | null;
}): {
  id: string;
  slot: 1 | 2 | 3;
  title: string;
  status: "pending" | "completed" | "dropped";
  goalId: string | null;
  completedAt: string | null;
} {
  return {
    id: priority.id,
    slot: priority.slot as 1 | 2 | 3,
    title: priority.title,
    status:
      priority.status === "COMPLETED"
        ? "completed"
        : priority.status === "DROPPED"
          ? "dropped"
          : "pending",
    goalId: priority.goalId,
    completedAt: priority.completedAt?.toISOString() ?? null,
  };
}

async function getUserPreferences(prisma: PrismaClient, userId: string) {
  return prisma.userPreference?.findUnique
    ? prisma.userPreference.findUnique({
        where: {
          userId,
        },
      })
    : null;
}

function assertReviewSubmissionWindow(reviewLabel: string, submissionWindow: ReviewSubmissionWindow) {
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

function throwReviewAlreadySubmitted(reviewLabel: "Weekly review" | "Monthly review") {
  throw new AppError({
    statusCode: 409,
    code: "REVIEW_ALREADY_SUBMITTED",
    message: `${reviewLabel} has already been completed for this period`,
  });
}

function listIsoDates(startDate: string, endDate: string) {
  const dates: Array<`${number}-${number}-${number}`> = [];

  for (
    let currentDate = startDate as `${number}-${number}-${number}`;
    currentDate <= endDate;
    currentDate = addIsoDays(currentDate, 1)
  ) {
    dates.push(currentDate);
  }

  return dates;
}

function normalizeReviewHistoryQuery(query: ReviewHistoryQuery) {
  return {
    cadence: query.cadence ?? "all",
    range: query.range ?? "90d",
    q: query.q?.trim() ?? "",
    cursor: query.cursor ?? null,
    limit: Math.min(50, Math.max(1, query.limit ?? 30)),
  };
}

function resolveHistoryRangeStart(range: ReviewHistoryRange, now: Date) {
  if (range === "all") {
    return null;
  }

  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const offset = range === "30d" ? 29 : range === "90d" ? 89 : 364;
  start.setUTCDate(start.getUTCDate() - offset);
  return start;
}

function containsNormalized(haystack: string | null | undefined, needle: string) {
  if (!needle) {
    return true;
  }

  return haystack?.toLowerCase().includes(needle) ?? false;
}

function buildReviewHistoryRoute(cadence: ReviewHistoryCadence, periodStart: string) {
  return `/reviews/${cadence}?date=${periodStart}`;
}

function createHistoryMetric(
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

function compareHistoryItems(left: ReviewHistoryItem, right: ReviewHistoryItem) {
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

function paginateReviewHistoryItems(items: ReviewHistoryItem[], cursor: string | null, limit: number) {
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

function addFrictionTagCounts(
  counts: Partial<Record<ReviewFrictionTag, number>>,
  tags: ReviewFrictionTag[],
) {
  for (const tag of tags) {
    counts[tag] = (counts[tag] ?? 0) + 1;
  }
}

function getTopFrictionTags(
  counts: Partial<Record<ReviewFrictionTag, number>>,
  limit = 3,
): Array<{ tag: ReviewFrictionTag; count: number }> {
  return Object.entries(counts)
    .sort((left, right) => right[1]! - left[1]!)
    .slice(0, limit)
    .map(([tag, count]) => ({ tag: tag as ReviewFrictionTag, count: count ?? 0 }));
}

function formatPeriodLabel(startDate: string, endDate: string) {
  return startDate === endDate ? startDate : `${startDate} to ${endDate}`;
}

async function getDailySummary(prisma: PrismaClient, userId: string, date: Date) {
  const targetIsoDate = toIsoDateString(date);
  await materializeRecurringTasksInRange(prisma, userId, date, date);
  const preferences = await prisma.userPreference?.findUnique?.({
    where: {
      userId,
    },
  });
  const dayWindow = getDayWindowUtc(targetIsoDate, preferences?.timezone);
  const [cycle, tasks, routines, routineCheckins, habits, habitCheckins, waterLogs, mealLogs, workoutDay, expenses] =
    await Promise.all([
      ensureCycle(prisma, {
        userId,
        cycleType: "DAY",
        cycleStartDate: date,
        cycleEndDate: date,
      }),
      prisma.task.findMany({
        where: {
          userId,
          scheduledForDate: date,
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
        },
      }),
      prisma.routine.findMany({
        where: {
          userId,
          status: "ACTIVE",
        },
        include: {
          items: true,
        },
      }),
      prisma.routineItemCheckin.findMany({
        where: {
          occurredOn: date,
          routineItem: {
            routine: {
              userId,
            },
          },
        },
      }),
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
          occurredOn: date,
          habit: {
            userId,
          },
        },
      }),
      prisma.waterLog.findMany({
        where: {
          userId,
          occurredAt: {
            gte: dayWindow.start,
            lt: dayWindow.end,
          },
        },
      }),
      prisma.mealLog.findMany({
        where: {
          userId,
          occurredAt: {
            gte: dayWindow.start,
            lt: dayWindow.end,
          },
        },
      }),
      prisma.workoutDay.findUnique({
        where: {
          userId_date: {
            userId,
            date,
          },
        },
      }),
      prisma.expense.findMany({
        where: {
          userId,
          spentOn: {
            gte: date,
            lt: addDays(date, 1),
          },
        },
      }),
    ]);
  const dueHabits = new Set(filterDueHabits(habits, targetIsoDate).map((habit) => habit.id));

  const routinesTotal = routines.reduce((sum, routine) => sum + routine.items.length, 0);
  const routinesCompleted = routineCheckins.length;
  const workoutStatus: DailyReviewSummary["workoutStatus"] =
    workoutDay?.actualStatus === "COMPLETED"
      ? "completed"
      : workoutDay?.actualStatus === "RECOVERY_RESPECTED"
        ? "recovery_respected"
        : workoutDay?.actualStatus === "FALLBACK"
          ? "fallback"
          : workoutDay?.actualStatus === "MISSED"
            ? "missed"
            : "none";

  return {
    cycle,
    summary: {
      prioritiesCompleted: cycle.priorities.filter((priority) => priority.status === "COMPLETED").length,
      prioritiesTotal: cycle.priorities.length,
      tasksCompleted: tasks.filter((task) => task.status === "COMPLETED").length,
      tasksScheduled: tasks.length,
      routinesCompleted,
      routinesTotal,
      habitsCompleted: habitCheckins.filter(
        (checkin) => checkin.status === "COMPLETED" && dueHabits.has(checkin.habitId),
      ).length,
      habitsDue: dueHabits.size,
      waterMl: waterLogs.reduce((sum, log) => sum + log.amountMl, 0),
      waterTargetMl: preferences?.dailyWaterTargetMl ?? 2500,
      mealsLogged: mealLogs.length,
      workoutStatus,
      expensesLogged: expenses.length,
    },
    incompleteTasks: tasks
      .filter((task) => task.status !== "COMPLETED")
      .map((task): PlanningTaskItem => ({
        id: task.id,
        title: task.title,
        notes: task.notes,
        kind:
          task.kind === "NOTE" ? "note" : task.kind === "REMINDER" ? "reminder" : "task",
        reminderDate: task.reminderDate ? toIsoDateString(task.reminderDate) : null,
        status:
          task.status === "DROPPED" ? "dropped" : task.status === "COMPLETED" ? "completed" : "pending",
        scheduledForDate: task.scheduledForDate ? toIsoDateString(task.scheduledForDate) : null,
        dueAt: task.dueAt?.toISOString() ?? null,
        goalId: task.goalId,
        originType:
          task.originType === "QUICK_CAPTURE"
            ? "quick_capture"
            : task.originType === "CARRY_FORWARD"
              ? "carry_forward"
              : task.originType === "REVIEW_SEED"
                ? "review_seed"
                : task.originType === "RECURRING"
                  ? "recurring"
                  : task.originType === "TEMPLATE"
                    ? "template"
                  : "manual",
        carriedFromTaskId: task.carriedFromTaskId,
        recurrence: serializeRecurrenceDefinition(task.recurrenceRule),
        completedAt: task.completedAt?.toISOString() ?? null,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      })),
  };
}

export async function getDailyReviewModel(
  prisma: PrismaClient,
  userId: string,
  date: Date,
): Promise<DailyReviewResponse> {
  const tomorrowDate = addDays(date, 1);
  const [preferences, { cycle, summary, incompleteTasks }, score, tomorrowCycle] = await Promise.all([
    getUserPreferences(prisma, userId),
    getDailySummary(prisma, userId, date),
    calculateDailyScore(prisma, userId, date),
    prisma.planningCycle.findUnique({
      where: {
        userId_cycleType_cycleStartDate: {
          userId,
          cycleType: "DAY",
          cycleStartDate: tomorrowDate,
        },
      },
      include: {
        priorities: {
          orderBy: {
            slot: "asc",
          },
        },
      },
    }),
  ]);

  const existingReview: ExistingDailyReview | null = cycle.dailyReview
    ? {
        biggestWin: cycle.dailyReview.biggestWin,
        frictionTag: cycle.dailyReview.frictionTag as ReviewFrictionTag,
        frictionNote: cycle.dailyReview.frictionNote,
        energyRating: cycle.dailyReview.energyRating,
        optionalNote: cycle.dailyReview.optionalNote,
        completedAt: cycle.dailyReview.completedAt.toISOString(),
      }
    : null;
  const submissionWindow = resolveDailyReviewSubmissionWindow(toIsoDateString(date), new Date(), preferences);

  return {
    date: toIsoDateString(date),
    summary,
    score,
    incompleteTasks,
    existingReview,
    isCompleted: Boolean(existingReview),
    submissionWindow,
    seededTomorrowPriorities: tomorrowCycle?.priorities.map(serializePriority) ?? [],
    generatedAt: new Date().toISOString(),
  };
}

function dedupeTaskIds(payload: SubmitDailyReviewRequest) {
  const seen = new Set<string>();

  for (const taskId of [...payload.carryForwardTaskIds, ...payload.droppedTaskIds, ...payload.rescheduledTasks.map((task) => task.taskId)]) {
    if (seen.has(taskId)) {
      throw new AppError({
        statusCode: 400,
        code: "BAD_REQUEST",
        message: `Task ${taskId} appears in more than one review decision`,
      });
    }
    seen.add(taskId);
  }
}

async function validateDailyReviewTaskDecisions(
  prisma: PrismaClient,
  userId: string,
  date: Date,
  payload: SubmitDailyReviewRequest,
) {
  const decidedTaskIds = [
    ...payload.carryForwardTaskIds,
    ...payload.droppedTaskIds,
    ...payload.rescheduledTasks.map((task) => task.taskId),
  ];
  const pendingTasks = await prisma.task.findMany({
    where: {
      userId,
      scheduledForDate: date,
      status: "PENDING",
    },
    orderBy: {
      createdAt: "asc",
    },
  });
  const pendingTaskIds = new Set(pendingTasks.map((task) => task.id));

  if (decidedTaskIds.length !== pendingTaskIds.size) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Every pending task for the review date must be resolved before submission",
    });
  }

  for (const taskId of decidedTaskIds) {
    if (!pendingTaskIds.has(taskId)) {
      throw new AppError({
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Review decisions can only target pending tasks scheduled for this date",
      });
    }
  }
}

async function replacePriorities(
  prisma: PrismaClient | Prisma.TransactionClient,
  planningCycleId: string,
  priorities:
    | SubmitDailyReviewRequest["tomorrowPriorities"]
    | SubmitWeeklyReviewRequest["nextWeekPriorities"]
    | Array<{ slot: 1 | 2 | 3; title: string; goalId?: string | null }>,
  sourceReviewType: "DAILY" | "WEEKLY" | "MONTHLY",
) {
  await prisma.cyclePriority.deleteMany({
    where: {
      planningCycleId,
    },
  });

  if (priorities.length > 0) {
    await prisma.cyclePriority.createMany({
      data: priorities.map((priority: (typeof priorities)[number]) => ({
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
  });

  return refreshed.map(serializePriority);
}

export async function submitDailyReview(
  prisma: PrismaClient,
  userId: string,
  date: Date,
  payload: SubmitDailyReviewRequest,
) {
  dedupeTaskIds(payload);
  await materializeRecurringTasksInRange(prisma, userId, date, date);
  const preferences = await getUserPreferences(prisma, userId);
  assertReviewSubmissionWindow(
    "Daily review",
    resolveDailyReviewSubmissionWindow(toIsoDateString(date), new Date(), preferences),
  );
  const cycle = await ensureCycle(prisma, {
    userId,
    cycleType: "DAY",
    cycleStartDate: date,
    cycleEndDate: date,
  });

  if (cycle.dailyReview) {
    throw new AppError({
      statusCode: 409,
      code: "CONFLICT",
      message: "Daily review has already been completed for this date",
    });
  }

  await validateDailyReviewTaskDecisions(prisma, userId, date, payload);

  const tomorrowDate = addDays(date, 1);
  const tomorrowCycle = await ensureCycle(prisma, {
    userId,
    cycleType: "DAY",
    cycleStartDate: tomorrowDate,
    cycleEndDate: tomorrowDate,
  });
  const completedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.dailyReview.upsert({
      where: {
        planningCycleId: cycle.id,
      },
      update: {
        biggestWin: payload.biggestWin,
        frictionTag: payload.frictionTag,
        frictionNote: payload.frictionNote ?? null,
        energyRating: payload.energyRating,
        optionalNote: payload.optionalNote ?? null,
        completedAt,
      },
      create: {
        userId,
        planningCycleId: cycle.id,
        biggestWin: payload.biggestWin,
        frictionTag: payload.frictionTag,
        frictionNote: payload.frictionNote ?? null,
        energyRating: payload.energyRating,
        optionalNote: payload.optionalNote ?? null,
        completedAt,
      },
    });

    await replacePriorities(tx, tomorrowCycle.id, payload.tomorrowPriorities, "DAILY");

    for (const taskId of payload.droppedTaskIds) {
      const task = await tx.task.findUniqueOrThrow({
        where: {
          id: taskId,
        },
      });

      if (task.recurrenceRuleId) {
        await applyRecurringTaskSkip(tx, userId, task);
      } else {
        await tx.task.update({
          where: {
            id: taskId,
          },
          data: {
            status: "DROPPED",
          },
        });
      }
    }

    for (const taskId of payload.carryForwardTaskIds) {
      const task = await tx.task.findUniqueOrThrow({
        where: {
          id: taskId,
        },
      });

      if (task.recurrenceRuleId) {
        await applyRecurringTaskCarryForward(tx, userId, task, toIsoDateString(tomorrowDate));
        continue;
      }

      await tx.task.update({
        where: {
          id: taskId,
        },
        data: {
          status: "DROPPED",
        },
      });

      await tx.task.create({
        data: {
          userId,
          title: task.title,
          notes: task.notes,
          kind: task.kind,
          reminderDate: task.reminderDate,
          scheduledForDate: tomorrowDate,
          dueAt: task.dueAt,
          goalId: task.goalId,
          originType: "CARRY_FORWARD",
          carriedFromTaskId: task.id,
        },
      });
    }

    for (const rescheduledTask of payload.rescheduledTasks) {
      const task = await tx.task.findUniqueOrThrow({
        where: {
          id: rescheduledTask.taskId,
        },
      });
      const targetDate = parseIsoDate(rescheduledTask.targetDate);

      if (task.recurrenceRuleId) {
        await applyRecurringTaskCarryForward(tx, userId, task, rescheduledTask.targetDate);
        continue;
      }

      await tx.task.update({
        where: {
          id: task.id,
        },
        data: {
          status: "DROPPED",
        },
      });

      await tx.task.create({
        data: {
          userId,
          title: task.title,
          notes: task.notes,
          kind: task.kind,
          reminderDate: task.reminderDate,
          scheduledForDate: targetDate,
          dueAt: task.dueAt,
          goalId: task.goalId,
          originType: "CARRY_FORWARD",
          carriedFromTaskId: task.id,
        },
      });
    }
  });

  const finalizedScore = await finalizeDailyScore(prisma, userId, date);
  const tomorrowPriorities = await replacePriorities(prisma, tomorrowCycle.id, payload.tomorrowPriorities, "DAILY");

  return {
    reviewCompletedAt: completedAt.toISOString(),
    score: finalizedScore,
    tomorrowPriorities,
    generatedAt: new Date().toISOString(),
  };
}

export async function getWeeklyReviewModel(
  prisma: PrismaClient,
  userId: string,
  startDate: Date,
): Promise<WeeklyReviewResponse> {
  const startIsoDate = toIsoDateString(startDate);
  const cycle = await ensureCycle(prisma, {
    userId,
    cycleType: "WEEK",
    cycleStartDate: startDate,
    cycleEndDate: getWeekEndDate(startDate),
  });
  const nextWeekStart = addDays(startDate, 7);
  const preferences = await prisma.userPreference?.findUnique?.({
    where: {
      userId,
    },
  });
  const timezone = normalizeTimezone(preferences?.timezone);
  const waterTargetMl = preferences?.dailyWaterTargetMl ?? 2500;
  const effectiveEndDate = cycle.cycleEndDate;
  const effectiveEndIsoDate = toIsoDateString(effectiveEndDate);
  const submissionWindow = resolveWeeklyReviewSubmissionWindow(startIsoDate, new Date(), preferences);
  const rangeWindow = getDateRangeWindowUtc(startIsoDate, effectiveEndIsoDate, timezone);
  const scopedIsoDates = listIsoDates(startIsoDate, effectiveEndIsoDate);
  const [scores, habits, routineCheckins, routines, workoutDays, waterLogs, mealLogs, expenses, dailyReviews, nextWeekCycle] =
    await Promise.all([
      prisma.dailyScore.findMany({
        where: {
          userId,
          finalizedAt: {
            not: null,
          },
          planningCycle: {
            cycleStartDate: {
              gte: startDate,
              lte: effectiveEndDate,
            },
          },
        },
        include: {
          planningCycle: true,
        },
      }),
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
          checkins: {
            where: {
              occurredOn: {
                gte: startDate,
                lte: effectiveEndDate,
              },
            },
          },
        },
      }),
      prisma.routineItemCheckin.findMany({
        where: {
          occurredOn: {
            gte: startDate,
            lte: effectiveEndDate,
          },
          routineItem: {
            routine: {
              userId,
            },
          },
        },
      }),
      prisma.routineItem.findMany({
        where: {
          routine: {
            userId,
            status: "ACTIVE",
          },
        },
      }),
      prisma.workoutDay.findMany({
        where: {
          userId,
          date: {
            gte: startDate,
            lte: effectiveEndDate,
          },
        },
      }),
      prisma.waterLog.findMany({
        where: {
          userId,
          occurredAt: {
            gte: rangeWindow.start,
            lt: rangeWindow.end,
          },
        },
      }),
      prisma.mealLog.findMany({
        where: {
          userId,
          occurredAt: {
            gte: rangeWindow.start,
            lt: rangeWindow.end,
          },
        },
      }),
      prisma.expense.findMany({
        where: {
          userId,
          spentOn: {
            gte: startDate,
            lte: effectiveEndDate,
          },
        },
        include: {
          expenseCategory: true,
        },
      }),
      prisma.dailyReview.findMany({
        where: {
          userId,
          planningCycle: {
            cycleStartDate: {
              gte: startDate,
              lte: effectiveEndDate,
            },
          },
        },
      }),
      prisma.planningCycle.findUnique({
        where: {
          userId_cycleType_cycleStartDate: {
            userId,
            cycleType: "WEEK",
            cycleStartDate: nextWeekStart,
          },
        },
        include: {
          priorities: {
            orderBy: {
              slot: "asc",
            },
          },
        },
      }),
    ]);

  const existingReview: ExistingWeeklyReview | null = cycle.weeklyReview
    ? {
        biggestWin: cycle.weeklyReview.biggestWin,
        biggestMiss: cycle.weeklyReview.biggestMiss,
        mainLesson: cycle.weeklyReview.mainLesson,
        keepText: cycle.weeklyReview.keepText,
        improveText: cycle.weeklyReview.improveText,
        focusHabitId: cycle.weeklyReview.focusHabitId,
        healthTargetText: cycle.weeklyReview.healthTargetText,
        spendingWatchCategoryId: cycle.weeklyReview.spendingWatchCategoryId,
        notes: cycle.weeklyReview.notes,
        completedAt: cycle.weeklyReview.completedAt.toISOString(),
      }
    : null;

  const averageDailyScore =
    scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score.scoreValue, 0) / scores.length) : 0;
  const topSpendCategory = expenses
    .reduce<Record<string, number>>((acc, expense) => {
      const category = expense.expenseCategory?.name ?? "Uncategorized";
      acc[category] = (acc[category] ?? 0) + expense.amountMinor;
      return acc;
    }, {});
  const topSpendEntry = Object.entries(topSpendCategory).sort((a, b) => b[1] - a[1])[0];
  const frictionCounts = dailyReviews.reduce<Record<string, number>>((acc, review) => {
    acc[review.frictionTag] = (acc[review.frictionTag] ?? 0) + 1;
    return acc;
  }, {});
  const habitTotals = habits.reduce(
    (totals, habit) => {
      const scheduleRule = resolveHabitRecurrence(habit, startIsoDate);
      const completedDates = new Set<string>(
        habit.checkins
          .filter((checkin) => checkin.status === "COMPLETED")
          .map((checkin) => toIsoDateString(checkin.occurredOn)),
      );

      for (const isoDate of scopedIsoDates) {
        if (!isHabitDueOnIsoDate(scheduleRule, isoDate as `${number}-${number}-${number}`, habit.pauseWindows)) {
          continue;
        }

        totals.due += 1;

        if (completedDates.has(isoDate)) {
          totals.completed += 1;
        }
      }

      return totals;
    },
    { due: 0, completed: 0 },
  );

  return {
    startDate: startIsoDate,
    endDate: toIsoDateString(cycle.cycleEndDate),
    summary: {
      averageDailyScore,
      strongDayCount: scores.filter((score) => score.scoreValue >= 70).length,
      habitCompletionRate:
        habitTotals.due > 0 ? roundToPercent(habitTotals.completed / habitTotals.due) : 0,
      routineCompletionRate: routines.length > 0 ? roundToPercent(routineCheckins.length / routines.length) : 0,
      workoutsCompleted: workoutDays.filter((day) => day.actualStatus === "COMPLETED").length,
      workoutsPlanned: workoutDays.filter((day) => day.planType === "WORKOUT").length,
      waterTargetHitCount: countWaterTargetHits(waterLogs, timezone, waterTargetMl),
      mealsLoggedCount: mealLogs.length,
      spendingTotal: expenses.reduce((sum, expense) => sum + expense.amountMinor, 0),
      topSpendCategory: topSpendEntry?.[0] ?? null,
      topFrictionTags: Object.entries(frictionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([tag, count]) => ({ tag: tag as ReviewFrictionTag, count })),
    },
    existingReview,
    seededNextWeekPriorities: nextWeekCycle?.priorities.map(serializePriority) ?? [],
    submissionWindow,
    generatedAt: new Date().toISOString(),
  };
}

function roundToPercent(value: number) {
  return Math.round(value * 100);
}

export async function submitWeeklyReview(
  prisma: PrismaClient,
  userId: string,
  startDate: Date,
  payload: SubmitWeeklyReviewRequest,
) {
  const cycle = await ensureCycle(prisma, {
    userId,
    cycleType: "WEEK",
    cycleStartDate: startDate,
    cycleEndDate: getWeekEndDate(startDate),
  });

  if (cycle.weeklyReview) {
    throwReviewAlreadySubmitted("Weekly review");
  }

  const preferences = await getUserPreferences(prisma, userId);
  assertReviewSubmissionWindow(
    "Weekly review",
    resolveWeeklyReviewSubmissionWindow(toIsoDateString(startDate), new Date(), preferences),
  );
  const nextWeekStart = addDays(startDate, 7);
  const nextWeekCycle = await ensureCycle(prisma, {
    userId,
    cycleType: "WEEK",
    cycleStartDate: nextWeekStart,
    cycleEndDate: getWeekEndDate(nextWeekStart),
  });
  const completedAt = new Date();

  await prisma.weeklyReview.create({
    data: {
      userId,
      planningCycleId: cycle.id,
      biggestWin: payload.biggestWin,
      biggestMiss: payload.biggestMiss,
      mainLesson: payload.mainLesson,
      keepText: payload.keepText,
      improveText: payload.improveText,
      focusHabitId: payload.focusHabitId ?? null,
      healthTargetText: payload.healthTargetText ?? null,
      spendingWatchCategoryId: payload.spendingWatchCategoryId ?? null,
      notes: payload.notes ?? null,
      completedAt,
    },
  });

  const nextWeekPriorities = await replacePriorities(prisma, nextWeekCycle.id, payload.nextWeekPriorities, "WEEKLY");

  return {
    reviewCompletedAt: completedAt.toISOString(),
    nextWeekPriorities,
    generatedAt: new Date().toISOString(),
  };
}

export async function getMonthlyReviewModel(
  prisma: PrismaClient,
  userId: string,
  startDate: Date,
): Promise<MonthlyReviewResponse> {
  const startIsoDate = toIsoDateString(startDate);
  const cycle = await ensureCycle(prisma, {
    userId,
    cycleType: "MONTH",
    cycleStartDate: startDate,
    cycleEndDate: getMonthEndDate(startDate),
  });
  const nextMonthStart = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 1));
  const preferences = await prisma.userPreference?.findUnique?.({
    where: {
      userId,
    },
  });
  const timezone = normalizeTimezone(preferences?.timezone);
  const waterTargetMl = preferences?.dailyWaterTargetMl ?? 2500;
  const effectiveEndDate = cycle.cycleEndDate;
  const effectiveEndIsoDate = toIsoDateString(effectiveEndDate);
  const submissionWindow = resolveMonthlyReviewSubmissionWindow(startIsoDate, new Date(), preferences);
  const rangeWindow = getDateRangeWindowUtc(startIsoDate, effectiveEndIsoDate, timezone);
  const scopedIsoDates = listIsoDates(startIsoDate, effectiveEndIsoDate);
  const [scores, habits, workoutDays, waterLogs, expenses, dailyReviews, nextMonthCycle] = await Promise.all([
    prisma.dailyScore.findMany({
      where: {
        userId,
        finalizedAt: {
          not: null,
        },
        planningCycle: {
          cycleStartDate: {
            gte: startDate,
            lte: effectiveEndDate,
          },
        },
      },
      include: {
        planningCycle: true,
      },
    }),
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
        checkins: {
          where: {
            occurredOn: {
              gte: startDate,
              lte: effectiveEndDate,
            },
          },
        },
      },
    }),
    prisma.workoutDay.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: effectiveEndDate,
        },
      },
    }),
    prisma.waterLog.findMany({
      where: {
        userId,
        occurredAt: {
          gte: rangeWindow.start,
          lt: rangeWindow.end,
        },
      },
    }),
    prisma.expense.findMany({
      where: {
        userId,
        spentOn: {
          gte: startDate,
          lte: effectiveEndDate,
        },
      },
      include: {
        expenseCategory: true,
      },
    }),
    prisma.dailyReview.findMany({
      where: {
        userId,
        planningCycle: {
          cycleStartDate: {
            gte: startDate,
            lte: effectiveEndDate,
          },
        },
      },
    }),
    prisma.planningCycle.findUnique({
      where: {
        userId_cycleType_cycleStartDate: {
          userId,
          cycleType: "MONTH",
          cycleStartDate: nextMonthStart,
        },
      },
      include: {
        priorities: {
          orderBy: {
            slot: "asc",
          },
        },
      },
    }),
  ]);

  const spendingByCategory = expenses.reduce<Record<string, number>>((acc, expense) => {
    const category = expense.expenseCategory?.name ?? "Uncategorized";
    acc[category] = (acc[category] ?? 0) + expense.amountMinor;
    return acc;
  }, {});
  const frictionCounts = dailyReviews.reduce<Record<string, number>>((acc, review) => {
    acc[review.frictionTag] = (acc[review.frictionTag] ?? 0) + 1;
    return acc;
  }, {});
  const waterTargetHitCount = countWaterTargetHits(waterLogs, timezone, waterTargetMl);
  const topHabits = habits
    .map((habit) => {
      const scheduleRule = resolveHabitRecurrence(habit, startIsoDate);
      const completedDates = new Set<string>(
        habit.checkins
          .filter((checkin) => checkin.status === "COMPLETED")
          .map((checkin) => toIsoDateString(checkin.occurredOn)),
      );
      const dueCount = scopedIsoDates.filter((isoDate) =>
        isHabitDueOnIsoDate(scheduleRule, isoDate as `${number}-${number}-${number}`, habit.pauseWindows),
      ).length;
      const completedCount = scopedIsoDates.filter((isoDate) => completedDates.has(isoDate)).length;

      return {
        habitId: habit.id,
        title: habit.title,
        completionRate: dueCount > 0 ? roundToPercent(completedCount / dueCount) : 0,
      };
    })
    .sort((a, b) => b.completionRate - a.completionRate)
    .slice(0, 3);

  const existingReview: ExistingMonthlyReview | null = cycle.monthlyReview
    ? {
        monthVerdict: cycle.monthlyReview.monthVerdict,
        biggestWin: cycle.monthlyReview.biggestWin,
        biggestLeak: cycle.monthlyReview.biggestLeak,
        ratings: cycle.monthlyReview.ratingsJson as Record<string, number>,
        nextMonthTheme: cycle.monthlyReview.nextMonthTheme,
        threeOutcomes: cycle.monthlyReview.threeOutcomesJson as string[],
        habitChanges: cycle.monthlyReview.habitChangesJson as string[],
        simplifyText: cycle.monthlyReview.simplifyText,
        notes: cycle.monthlyReview.notes,
        completedAt: cycle.monthlyReview.completedAt.toISOString(),
      }
    : null;

  const weeklyMomentum = await getWeeklyMomentum(prisma, userId, cycle.cycleEndDate);

  return {
    startDate: startIsoDate,
    endDate: toIsoDateString(cycle.cycleEndDate),
    summary: {
      averageWeeklyMomentum: weeklyMomentum.value,
      bestScore: scores.length > 0 ? Math.max(...scores.map((score) => score.scoreValue)) : null,
      worstScore: scores.length > 0 ? Math.min(...scores.map((score) => score.scoreValue)) : null,
      workoutCount: workoutDays.filter((day) => day.actualStatus === "COMPLETED").length,
      waterSuccessRate:
        scopedIsoDates.length > 0 ? roundToPercent(waterTargetHitCount / scopedIsoDates.length) : 0,
      spendingByCategory: Object.entries(spendingByCategory).map(([category, amountMinor]) => ({
        category,
        amountMinor,
      })),
      topHabits,
      commonFrictionTags: Object.entries(frictionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([tag, count]) => ({ tag: tag as ReviewFrictionTag, count })),
    },
    existingReview,
    seededNextMonthTheme: nextMonthCycle?.theme ?? null,
    seededNextMonthOutcomes: nextMonthCycle?.priorities.map(serializePriority) ?? [],
    submissionWindow,
    generatedAt: new Date().toISOString(),
  };
}

export async function submitMonthlyReview(
  prisma: PrismaClient,
  userId: string,
  startDate: Date,
  payload: SubmitMonthlyReviewRequest,
) {
  const cycle = await ensureCycle(prisma, {
    userId,
    cycleType: "MONTH",
    cycleStartDate: startDate,
    cycleEndDate: getMonthEndDate(startDate),
  });

  if (cycle.monthlyReview) {
    throwReviewAlreadySubmitted("Monthly review");
  }

  const preferences = await getUserPreferences(prisma, userId);
  assertReviewSubmissionWindow(
    "Monthly review",
    resolveMonthlyReviewSubmissionWindow(toIsoDateString(startDate), new Date(), preferences),
  );
  const nextMonthStart = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 1));
  const nextMonthCycle = await ensureCycle(prisma, {
    userId,
    cycleType: "MONTH",
    cycleStartDate: nextMonthStart,
    cycleEndDate: getMonthEndDate(nextMonthStart),
  });
  const completedAt = new Date();

  await prisma.monthlyReview.create({
    data: {
      userId,
      planningCycleId: cycle.id,
      monthVerdict: payload.monthVerdict,
      biggestWin: payload.biggestWin,
      biggestLeak: payload.biggestLeak,
      ratingsJson: toJson(payload.ratings),
      nextMonthTheme: payload.nextMonthTheme,
      threeOutcomesJson: toJson(payload.threeOutcomes),
      habitChangesJson: toJson(payload.habitChanges),
      simplifyText: payload.simplifyText,
      notes: payload.notes ?? null,
      completedAt,
    },
  });

  await prisma.planningCycle.update({
    where: {
      id: nextMonthCycle.id,
    },
    data: {
      theme: payload.nextMonthTheme,
    },
  });

  const nextMonthOutcomes = await replacePriorities(
    prisma,
    nextMonthCycle.id,
    payload.threeOutcomes.map((title: string, index: number) => ({
      slot: (index + 1) as 1 | 2 | 3,
      title,
      goalId: null,
    })),
    "MONTHLY",
  );

  return {
    reviewCompletedAt: completedAt.toISOString(),
    nextMonthTheme: payload.nextMonthTheme,
    nextMonthOutcomes,
    generatedAt: new Date().toISOString(),
  };
}

function matchesDailyHistorySearch(review: DailyReviewHistoryRow, normalizedQuery: string) {
  return (
    !normalizedQuery ||
    containsNormalized(review.biggestWin, normalizedQuery) ||
    containsNormalized(review.frictionTag, normalizedQuery) ||
    containsNormalized(review.frictionNote, normalizedQuery) ||
    containsNormalized(review.optionalNote, normalizedQuery)
  );
}

function matchesWeeklyHistorySearch(review: WeeklyReviewHistoryRow, normalizedQuery: string) {
  return (
    !normalizedQuery ||
    containsNormalized(review.biggestWin, normalizedQuery) ||
    containsNormalized(review.biggestMiss, normalizedQuery) ||
    containsNormalized(review.mainLesson, normalizedQuery) ||
    containsNormalized(review.keepText, normalizedQuery) ||
    containsNormalized(review.improveText, normalizedQuery) ||
    containsNormalized(review.notes, normalizedQuery) ||
    containsNormalized(review.healthTargetText, normalizedQuery)
  );
}

function matchesMonthlyHistorySearch(review: MonthlyReviewHistoryRow, normalizedQuery: string) {
  return (
    !normalizedQuery ||
    containsNormalized(review.monthVerdict, normalizedQuery) ||
    containsNormalized(review.biggestWin, normalizedQuery) ||
    containsNormalized(review.biggestLeak, normalizedQuery) ||
    containsNormalized(review.nextMonthTheme, normalizedQuery) ||
    containsNormalized(review.simplifyText, normalizedQuery) ||
    containsNormalized(review.notes, normalizedQuery) ||
    (review.threeOutcomesJson as string[]).some((value) => containsNormalized(value, normalizedQuery)) ||
    (review.habitChangesJson as string[]).some((value) => containsNormalized(value, normalizedQuery))
  );
}

async function buildDailyHistoryItems(
  prisma: PrismaClient,
  userId: string,
  reviews: DailyReviewHistoryRow[],
): Promise<ReviewHistoryItem[]> {
  if (reviews.length === 0) {
    return [];
  }

  const sortedDates = [...reviews]
    .map((review) => review.planningCycle.cycleStartDate)
    .sort((left, right) => left.getTime() - right.getTime());
  const minDate = sortedDates[0]!;
  const maxDate = sortedDates[sortedDates.length - 1]!;
  const [tasks, habitCheckins] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId,
        scheduledForDate: {
          gte: minDate,
          lte: maxDate,
        },
      },
      select: {
        status: true,
        scheduledForDate: true,
      },
    }),
    prisma.habitCheckin.findMany({
      where: {
        status: "COMPLETED",
        occurredOn: {
          gte: minDate,
          lte: maxDate,
        },
        habit: {
          userId,
        },
      },
      select: {
        occurredOn: true,
      },
    }),
  ]);

  const taskCounts = new Map<string, { scheduled: number; completed: number }>();
  for (const task of tasks) {
    if (!task.scheduledForDate) {
      continue;
    }

    const isoDate = toIsoDateString(task.scheduledForDate);
    const current = taskCounts.get(isoDate) ?? { scheduled: 0, completed: 0 };
    current.scheduled += 1;
    if (task.status === "COMPLETED") {
      current.completed += 1;
    }
    taskCounts.set(isoDate, current);
  }

  const habitCounts = new Map<string, number>();
  for (const checkin of habitCheckins) {
    const isoDate = toIsoDateString(checkin.occurredOn);
    habitCounts.set(isoDate, (habitCounts.get(isoDate) ?? 0) + 1);
  }

  return reviews.map((review) => {
    const periodStart = toIsoDateString(review.planningCycle.cycleStartDate);
    const counts = taskCounts.get(periodStart) ?? { scheduled: 0, completed: 0 };
    const habitsCompleted = habitCounts.get(periodStart) ?? 0;
    const scoreValue = review.planningCycle.dailyScore?.scoreValue ?? null;

    return {
      id: review.id,
      cadence: "daily",
      periodStart,
      periodEnd: periodStart,
      completedAt: review.completedAt.toISOString(),
      primaryText: review.biggestWin,
      secondaryText: review.frictionNote ?? review.optionalNote,
      metrics: [
        createHistoryMetric("score", "Score", scoreValue, scoreValue === null ? "No score" : String(scoreValue)),
        createHistoryMetric(
          "tasks",
          "Tasks",
          `${counts.completed}/${counts.scheduled}`,
          `${counts.completed}/${counts.scheduled} done`,
        ),
        createHistoryMetric("habitsCompleted", "Habits", habitsCompleted, `${habitsCompleted} completed`),
      ],
      frictionTags: [review.frictionTag as ReviewFrictionTag],
      route: buildReviewHistoryRoute("daily", periodStart),
    };
  });
}

async function buildWeeklyHistoryMetricsMap(
  prisma: PrismaClient,
  userId: string,
  reviews: WeeklyReviewHistoryRow[],
) {
  const metricsMap = new Map<string, WeeklyHistoryMetrics>();
  if (reviews.length === 0) {
    return metricsMap;
  }

  const minStart = new Date(
    Math.min(...reviews.map((review) => review.planningCycle.cycleStartDate.getTime())),
  );
  const maxEnd = new Date(
    Math.max(...reviews.map((review) => review.planningCycle.cycleEndDate.getTime())),
  );
  const [scores, habits, routineCheckins, routines, dailyReviews] = await Promise.all([
    prisma.dailyScore.findMany({
      where: {
        userId,
        finalizedAt: {
          not: null,
        },
        planningCycle: {
          cycleStartDate: {
            gte: minStart,
            lte: maxEnd,
          },
        },
      },
      include: {
        planningCycle: true,
      },
    }),
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
        checkins: {
          where: {
            occurredOn: {
              gte: minStart,
              lte: maxEnd,
            },
          },
        },
      },
    }),
    prisma.routineItemCheckin.findMany({
      where: {
        occurredOn: {
          gte: minStart,
          lte: maxEnd,
        },
        routineItem: {
          routine: {
            userId,
          },
        },
      },
    }),
    prisma.routineItem.findMany({
      where: {
        routine: {
          userId,
          status: "ACTIVE",
        },
      },
    }),
    prisma.dailyReview.findMany({
      where: {
        userId,
        planningCycle: {
          cycleStartDate: {
            gte: minStart,
            lte: maxEnd,
          },
        },
      },
      include: {
        planningCycle: true,
      },
    }),
  ]);

  for (const review of reviews) {
    const startDate = review.planningCycle.cycleStartDate;
    const endDate = review.planningCycle.cycleEndDate;
    const startIso = toIsoDateString(startDate);
    const endIso = toIsoDateString(endDate);
    const scopedIsoDates = listIsoDates(startIso, endIso);
    const periodScores = scores.filter(
      (score) =>
        score.planningCycle.cycleStartDate.getTime() >= startDate.getTime() &&
        score.planningCycle.cycleStartDate.getTime() <= endDate.getTime(),
    );
    const periodRoutineCheckins = routineCheckins.filter(
      (checkin) =>
        checkin.occurredOn.getTime() >= startDate.getTime() &&
        checkin.occurredOn.getTime() <= endDate.getTime(),
    );
    const periodDailyReviews = dailyReviews.filter(
      (entry) =>
        entry.planningCycle.cycleStartDate.getTime() >= startDate.getTime() &&
        entry.planningCycle.cycleStartDate.getTime() <= endDate.getTime(),
    );
    const habitTotals = habits.reduce(
      (totals, habit) => {
        const scheduleRule = resolveHabitRecurrence(habit, toIsoDateString(startDate));
        const completedDates = new Set(
          habit.checkins
            .filter((checkin) => checkin.status === "COMPLETED")
            .map((checkin) => toIsoDateString(checkin.occurredOn)),
        );

        for (const isoDate of scopedIsoDates) {
          if (!isHabitDueOnIsoDate(scheduleRule, isoDate as `${number}-${number}-${number}`, habit.pauseWindows)) {
            continue;
          }

          totals.due += 1;
          if (completedDates.has(isoDate)) {
            totals.completed += 1;
          }
        }

        return totals;
      },
      { due: 0, completed: 0 },
    );
    const frictionCounts = periodDailyReviews.reduce<Partial<Record<ReviewFrictionTag, number>>>((acc, entry) => {
      const tag = entry.frictionTag as ReviewFrictionTag;
      acc[tag] = (acc[tag] ?? 0) + 1;
      return acc;
    }, {});

    metricsMap.set(review.id, {
      averageDailyScore:
        periodScores.length > 0
          ? Math.round(periodScores.reduce((sum, score) => sum + score.scoreValue, 0) / periodScores.length)
          : 0,
      habitCompletionRate:
        habitTotals.due > 0 ? roundToPercent(habitTotals.completed / habitTotals.due) : 0,
      strongDayCount: periodScores.filter((score) => score.scoreValue >= 70).length,
      topFrictionTags: getTopFrictionTags(frictionCounts).map((entry) => entry.tag),
    });
  }

  return metricsMap;
}

function buildWeeklyHistoryItems(
  reviews: WeeklyReviewHistoryRow[],
  metricsMap: Map<string, WeeklyHistoryMetrics>,
): ReviewHistoryItem[] {
  return reviews.map((review) => {
    const periodStart = toIsoDateString(review.planningCycle.cycleStartDate);
    const periodEnd = toIsoDateString(review.planningCycle.cycleEndDate);
    const metrics = metricsMap.get(review.id) ?? {
      averageDailyScore: 0,
      habitCompletionRate: 0,
      strongDayCount: 0,
      topFrictionTags: [],
    };

    return {
      id: review.id,
      cadence: "weekly",
      periodStart,
      periodEnd,
      completedAt: review.completedAt.toISOString(),
      primaryText: review.mainLesson,
      secondaryText: review.biggestWin,
      metrics: [
        createHistoryMetric(
          "averageDailyScore",
          "Avg daily score",
          metrics.averageDailyScore,
          String(metrics.averageDailyScore),
        ),
        createHistoryMetric(
          "habitCompletionRate",
          "Habit completion",
          metrics.habitCompletionRate,
          `${metrics.habitCompletionRate}%`,
        ),
        createHistoryMetric("strongDayCount", "Strong days", metrics.strongDayCount, String(metrics.strongDayCount)),
      ],
      frictionTags: metrics.topFrictionTags,
      route: buildReviewHistoryRoute("weekly", periodStart),
    };
  });
}

async function buildMonthlyHistoryMetricsMap(
  prisma: PrismaClient,
  userId: string,
  reviews: MonthlyReviewHistoryRow[],
  timezone: string,
  waterTargetMl: number,
) {
  const metricsMap = new Map<string, MonthlyHistoryMetrics>();
  if (reviews.length === 0) {
    return metricsMap;
  }

  const minStart = new Date(
    Math.min(...reviews.map((review) => review.planningCycle.cycleStartDate.getTime())),
  );
  const maxEnd = new Date(
    Math.max(...reviews.map((review) => review.planningCycle.cycleEndDate.getTime())),
  );
  const rangeWindow = getDateRangeWindowUtc(toIsoDateString(minStart), toIsoDateString(maxEnd), timezone);
  const [workoutDays, waterLogs, dailyReviews, momentumValues] = await Promise.all([
    prisma.workoutDay.findMany({
      where: {
        userId,
        date: {
          gte: minStart,
          lte: maxEnd,
        },
      },
    }),
    prisma.waterLog.findMany({
      where: {
        userId,
        occurredAt: {
          gte: rangeWindow.start,
          lt: rangeWindow.end,
        },
      },
    }),
    prisma.dailyReview.findMany({
      where: {
        userId,
        planningCycle: {
          cycleStartDate: {
            gte: minStart,
            lte: maxEnd,
          },
        },
      },
      include: {
        planningCycle: true,
      },
    }),
    Promise.all(
      reviews.map((review) =>
        getWeeklyMomentum(prisma, userId, review.planningCycle.cycleEndDate).then((result) => ({
          reviewId: review.id,
          value: result.value,
        })),
      ),
    ),
  ]);

  const momentumMap = new Map(momentumValues.map((entry) => [entry.reviewId, entry.value]));

  for (const review of reviews) {
    const startDate = review.planningCycle.cycleStartDate;
    const endDate = review.planningCycle.cycleEndDate;
    const startIso = toIsoDateString(startDate);
    const endIso = toIsoDateString(endDate);
    const scopedIsoDates = listIsoDates(startIso, endIso);
    const periodWindow = getDateRangeWindowUtc(startIso, endIso, timezone);
    const periodWaterLogs = waterLogs.filter(
      (log) => log.occurredAt >= periodWindow.start && log.occurredAt < periodWindow.end,
    );
    const waterTargetHitCount = countWaterTargetHits(periodWaterLogs, timezone, waterTargetMl);
    const periodWorkoutCount = workoutDays.filter(
      (day) =>
        day.date.getTime() >= startDate.getTime() &&
        day.date.getTime() <= endDate.getTime() &&
        day.actualStatus === "COMPLETED",
    ).length;
    const frictionCounts = dailyReviews.reduce<Partial<Record<ReviewFrictionTag, number>>>((acc, entry) => {
      if (
        entry.planningCycle.cycleStartDate.getTime() < startDate.getTime() ||
        entry.planningCycle.cycleStartDate.getTime() > endDate.getTime()
      ) {
        return acc;
      }

      const tag = entry.frictionTag as ReviewFrictionTag;
      acc[tag] = (acc[tag] ?? 0) + 1;
      return acc;
    }, {});

    metricsMap.set(review.id, {
      averageWeeklyMomentum: momentumMap.get(review.id) ?? 0,
      waterSuccessRate:
        scopedIsoDates.length > 0 ? roundToPercent(waterTargetHitCount / scopedIsoDates.length) : 0,
      workoutCount: periodWorkoutCount,
      topFrictionTags: getTopFrictionTags(frictionCounts).map((entry) => entry.tag),
    });
  }

  return metricsMap;
}

function buildMonthlyHistoryItems(
  reviews: MonthlyReviewHistoryRow[],
  metricsMap: Map<string, MonthlyHistoryMetrics>,
): ReviewHistoryItem[] {
  return reviews.map((review) => {
    const periodStart = toIsoDateString(review.planningCycle.cycleStartDate);
    const periodEnd = toIsoDateString(review.planningCycle.cycleEndDate);
    const metrics = metricsMap.get(review.id) ?? {
      averageWeeklyMomentum: 0,
      waterSuccessRate: 0,
      workoutCount: 0,
      topFrictionTags: [],
    };

    return {
      id: review.id,
      cadence: "monthly",
      periodStart,
      periodEnd,
      completedAt: review.completedAt.toISOString(),
      primaryText: review.monthVerdict,
      secondaryText: review.biggestWin,
      metrics: [
        createHistoryMetric(
          "averageWeeklyMomentum",
          "Weekly momentum",
          metrics.averageWeeklyMomentum,
          String(metrics.averageWeeklyMomentum),
        ),
        createHistoryMetric(
          "waterSuccessRate",
          "Water success",
          metrics.waterSuccessRate,
          `${metrics.waterSuccessRate}%`,
        ),
        createHistoryMetric("workoutCount", "Workouts", metrics.workoutCount, String(metrics.workoutCount)),
      ],
      frictionTags: metrics.topFrictionTags,
      route: buildReviewHistoryRoute("monthly", periodStart),
    };
  });
}

function buildReviewHistorySummary(items: ReviewHistoryItem[]): ReviewHistorySummary {
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

function buildWeeklyTrend(
  reviews: WeeklyReviewHistoryRow[],
  metricsMap: Map<string, WeeklyHistoryMetrics>,
): WeeklyReviewHistoryTrendPoint[] {
  return [...reviews]
    .sort(
      (left, right) =>
        left.planningCycle.cycleStartDate.getTime() - right.planningCycle.cycleStartDate.getTime(),
    )
    .slice(-8)
    .map((review) => {
      const metrics = metricsMap.get(review.id) ?? {
        averageDailyScore: 0,
        habitCompletionRate: 0,
        strongDayCount: 0,
        topFrictionTags: [],
      };

      return {
        startDate: toIsoDateString(review.planningCycle.cycleStartDate),
        endDate: toIsoDateString(review.planningCycle.cycleEndDate),
        averageDailyScore: metrics.averageDailyScore,
        habitCompletionRate: metrics.habitCompletionRate,
        strongDayCount: metrics.strongDayCount,
      };
    });
}

function buildMonthlyTrend(
  reviews: MonthlyReviewHistoryRow[],
  metricsMap: Map<string, MonthlyHistoryMetrics>,
): MonthlyReviewHistoryTrendPoint[] {
  return [...reviews]
    .sort(
      (left, right) =>
        left.planningCycle.cycleStartDate.getTime() - right.planningCycle.cycleStartDate.getTime(),
    )
    .slice(-6)
    .map((review) => {
      const metrics = metricsMap.get(review.id) ?? {
        averageWeeklyMomentum: 0,
        waterSuccessRate: 0,
        workoutCount: 0,
        topFrictionTags: [],
      };

      return {
        startDate: toIsoDateString(review.planningCycle.cycleStartDate),
        endDate: toIsoDateString(review.planningCycle.cycleEndDate),
        averageWeeklyMomentum: metrics.averageWeeklyMomentum,
        waterSuccessRate: metrics.waterSuccessRate,
        workoutCount: metrics.workoutCount,
      };
    });
}

function buildWeeklyComparison(
  reviews: WeeklyReviewHistoryRow[],
  metricsMap: Map<string, WeeklyHistoryMetrics>,
): ReviewHistoryResponse["comparisons"]["weekly"] {
  const [current, previous] = [...reviews].sort(
    (left, right) =>
      right.planningCycle.cycleStartDate.getTime() - left.planningCycle.cycleStartDate.getTime(),
  );

  if (!current || !previous) {
    return null;
  }

  const currentMetrics = metricsMap.get(current.id) ?? {
    averageDailyScore: 0,
    habitCompletionRate: 0,
    strongDayCount: 0,
    topFrictionTags: [],
  };
  const previousMetrics = metricsMap.get(previous.id) ?? {
    averageDailyScore: 0,
    habitCompletionRate: 0,
    strongDayCount: 0,
    topFrictionTags: [],
  };

  return {
    currentPeriodStart: toIsoDateString(current.planningCycle.cycleStartDate),
    currentPeriodEnd: toIsoDateString(current.planningCycle.cycleEndDate),
    previousPeriodStart: toIsoDateString(previous.planningCycle.cycleStartDate),
    previousPeriodEnd: toIsoDateString(previous.planningCycle.cycleEndDate),
    currentLabel: formatPeriodLabel(
      toIsoDateString(current.planningCycle.cycleStartDate),
      toIsoDateString(current.planningCycle.cycleEndDate),
    ),
    previousLabel: formatPeriodLabel(
      toIsoDateString(previous.planningCycle.cycleStartDate),
      toIsoDateString(previous.planningCycle.cycleEndDate),
    ),
    currentText: current.mainLesson,
    previousText: previous.mainLesson,
    metrics: {
      current: {
        averageDailyScore: currentMetrics.averageDailyScore,
        habitCompletionRate: currentMetrics.habitCompletionRate,
        strongDayCount: currentMetrics.strongDayCount,
      },
      previous: {
        averageDailyScore: previousMetrics.averageDailyScore,
        habitCompletionRate: previousMetrics.habitCompletionRate,
        strongDayCount: previousMetrics.strongDayCount,
      },
      delta: {
        averageDailyScore: currentMetrics.averageDailyScore - previousMetrics.averageDailyScore,
        habitCompletionRate: currentMetrics.habitCompletionRate - previousMetrics.habitCompletionRate,
        strongDayCount: currentMetrics.strongDayCount - previousMetrics.strongDayCount,
      },
    },
  };
}

function buildMonthlyComparison(
  reviews: MonthlyReviewHistoryRow[],
  metricsMap: Map<string, MonthlyHistoryMetrics>,
): ReviewHistoryResponse["comparisons"]["monthly"] {
  const [current, previous] = [...reviews].sort(
    (left, right) =>
      right.planningCycle.cycleStartDate.getTime() - left.planningCycle.cycleStartDate.getTime(),
  );

  if (!current || !previous) {
    return null;
  }

  const currentMetrics = metricsMap.get(current.id) ?? {
    averageWeeklyMomentum: 0,
    waterSuccessRate: 0,
    workoutCount: 0,
    topFrictionTags: [],
  };
  const previousMetrics = metricsMap.get(previous.id) ?? {
    averageWeeklyMomentum: 0,
    waterSuccessRate: 0,
    workoutCount: 0,
    topFrictionTags: [],
  };

  return {
    currentPeriodStart: toIsoDateString(current.planningCycle.cycleStartDate),
    currentPeriodEnd: toIsoDateString(current.planningCycle.cycleEndDate),
    previousPeriodStart: toIsoDateString(previous.planningCycle.cycleStartDate),
    previousPeriodEnd: toIsoDateString(previous.planningCycle.cycleEndDate),
    currentLabel: formatPeriodLabel(
      toIsoDateString(current.planningCycle.cycleStartDate),
      toIsoDateString(current.planningCycle.cycleEndDate),
    ),
    previousLabel: formatPeriodLabel(
      toIsoDateString(previous.planningCycle.cycleStartDate),
      toIsoDateString(previous.planningCycle.cycleEndDate),
    ),
    currentText: current.monthVerdict,
    previousText: previous.monthVerdict,
    metrics: {
      current: {
        averageWeeklyMomentum: currentMetrics.averageWeeklyMomentum,
        waterSuccessRate: currentMetrics.waterSuccessRate,
        workoutCount: currentMetrics.workoutCount,
      },
      previous: {
        averageWeeklyMomentum: previousMetrics.averageWeeklyMomentum,
        waterSuccessRate: previousMetrics.waterSuccessRate,
        workoutCount: previousMetrics.workoutCount,
      },
      delta: {
        averageWeeklyMomentum: currentMetrics.averageWeeklyMomentum - previousMetrics.averageWeeklyMomentum,
        waterSuccessRate: currentMetrics.waterSuccessRate - previousMetrics.waterSuccessRate,
        workoutCount: currentMetrics.workoutCount - previousMetrics.workoutCount,
      },
    },
  };
}

export async function getReviewHistory(
  prisma: PrismaClient,
  userId: string,
  query: ReviewHistoryQuery = {},
): Promise<ReviewHistoryResponse> {
  const resolved = normalizeReviewHistoryQuery(query);
  const now = new Date();
  const rangeStart = resolveHistoryRangeStart(resolved.range, now);
  const [preferences, dailyReviewsAll, weeklyReviewsAll, monthlyReviewsAll] = await Promise.all([
    getUserPreferences(prisma, userId),
    prisma.dailyReview.findMany({
      where: {
        userId,
        planningCycle: rangeStart
          ? {
              cycleStartDate: {
                gte: rangeStart,
              },
            }
          : undefined,
      },
      include: {
        planningCycle: {
          include: {
            dailyScore: true,
          },
        },
      },
      orderBy: {
        completedAt: "desc",
      },
    }),
    prisma.weeklyReview.findMany({
      where: {
        userId,
        planningCycle: rangeStart
          ? {
              cycleStartDate: {
                gte: rangeStart,
              },
            }
          : undefined,
      },
      include: {
        planningCycle: true,
      },
      orderBy: {
        completedAt: "desc",
      },
    }),
    prisma.monthlyReview.findMany({
      where: {
        userId,
        planningCycle: rangeStart
          ? {
              cycleStartDate: {
                gte: rangeStart,
              },
            }
          : undefined,
      },
      include: {
        planningCycle: true,
      },
      orderBy: {
        completedAt: "desc",
      },
    }),
  ]);

  const normalizedQuery = resolved.q.toLowerCase();
  const timezone = normalizeTimezone(preferences?.timezone);
  const waterTargetMl = preferences?.dailyWaterTargetMl ?? 2500;
  const cadenceAllowsDaily = resolved.cadence === "all" || resolved.cadence === "daily";
  const cadenceAllowsWeekly = resolved.cadence === "all" || resolved.cadence === "weekly";
  const cadenceAllowsMonthly = resolved.cadence === "all" || resolved.cadence === "monthly";

  const dailyReviewsFiltered = cadenceAllowsDaily
    ? dailyReviewsAll.filter((review) => matchesDailyHistorySearch(review, normalizedQuery))
    : [];
  const weeklyReviewsFiltered = cadenceAllowsWeekly
    ? weeklyReviewsAll.filter((review) => matchesWeeklyHistorySearch(review, normalizedQuery))
    : [];
  const monthlyReviewsFiltered = cadenceAllowsMonthly
    ? monthlyReviewsAll.filter((review) => matchesMonthlyHistorySearch(review, normalizedQuery))
    : [];

  const [dailyItems, weeklyMetricsMap, monthlyMetricsMap] = await Promise.all([
    buildDailyHistoryItems(prisma, userId, dailyReviewsFiltered),
    cadenceAllowsWeekly
      ? buildWeeklyHistoryMetricsMap(prisma, userId, weeklyReviewsAll)
      : Promise.resolve(new Map<string, WeeklyHistoryMetrics>()),
    cadenceAllowsMonthly
      ? buildMonthlyHistoryMetricsMap(prisma, userId, monthlyReviewsAll, timezone, waterTargetMl)
      : Promise.resolve(new Map<string, MonthlyHistoryMetrics>()),
  ]);

  const allFilteredItems = [
    ...dailyItems,
    ...buildWeeklyHistoryItems(weeklyReviewsFiltered, weeklyMetricsMap),
    ...buildMonthlyHistoryItems(monthlyReviewsFiltered, monthlyMetricsMap),
  ].sort(compareHistoryItems);
  const summary = buildReviewHistorySummary(allFilteredItems);
  const paginated = paginateReviewHistoryItems(allFilteredItems, resolved.cursor, resolved.limit);

  return {
    items: paginated.items,
    nextCursor: paginated.nextCursor,
    summary,
    weeklyTrend: cadenceAllowsWeekly ? buildWeeklyTrend(weeklyReviewsAll, weeklyMetricsMap) : [],
    monthlyTrend: cadenceAllowsMonthly ? buildMonthlyTrend(monthlyReviewsAll, monthlyMetricsMap) : [],
    comparisons: {
      weekly: cadenceAllowsWeekly ? buildWeeklyComparison(weeklyReviewsAll, weeklyMetricsMap) : null,
      monthly: cadenceAllowsMonthly ? buildMonthlyComparison(monthlyReviewsAll, monthlyMetricsMap) : null,
    },
    generatedAt: new Date().toISOString(),
  };
}
