import type { IsoDateString } from "@life-os/contracts";
import type { Prisma, PrismaClient } from "@prisma/client";

import {
  getMealTargetCountForHour,
  scoreMealConsistency,
} from "../../lib/health/meals.js";
import { filterDueHabits, getHabitCompletionCountForIsoDate } from "../../lib/habits/schedule.js";
import {
  getHabitTimingStatusToday,
  getRoutineTimingStatusToday,
  isScoredHabitTimingMode,
  isScoredRoutineTimingMode,
} from "../../lib/habits/timing.js";
import {
  addDays,
  parseIsoDate,
} from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import {
  getTimeWindowUtc,
  getUserLocalDate,
  getUserLocalHour,
  normalizeTimezone,
} from "../../lib/time/user-time.js";
import { getDayContext, type ScoringDayContext } from "./scoring-day-context.js";
import { SCORING_RULES, STRONG_DAY_STREAK_THRESHOLD } from "./scoring-rules.js";
import { ensureCycle } from "./planning-cycle-service.js";

export { ensureCycle } from "./planning-cycle-service.js";

type ScoreLabel = "Strong Day" | "Solid Day" | "Recovering Day" | "Off-Track Day";
type ScoreBucketKey =
  | "plan_and_priorities"
  | "routines_and_habits"
  | "health_basics"
  | "finance_and_admin"
  | "review_and_reset";
type DailyScoreMode = "stored" | "live";
type StoredDailyScore = Prisma.DailyScoreGetPayload<{
  include: {
    planningCycle: true;
  };
}>;

interface ScoreBucket {
  key: ScoreBucketKey;
  label: string;
  earnedPoints: number;
  applicablePoints: number;
  explanation: string;
}

interface ScoreReason {
  label: string;
  missingPoints: number;
}

export interface DailyScoreBreakdownResponse {
  date: string;
  value: number;
  label: ScoreLabel;
  earnedPoints: number;
  possiblePoints: number;
  buckets: ScoreBucket[];
  topReasons: ScoreReason[];
  finalizedAt: string | null;
  generatedAt: string;
}

export interface WeeklyMomentumResponse {
  endingOn: string;
  value: number;
  basedOnDays: number;
  weeklyReviewBonus: number;
  strongDayStreak: number;
  dailyScores: Array<{
    date: string;
    value: number;
    label: ScoreLabel;
  }>;
  generatedAt: string;
}

export interface ScoreHistoryDayResponse {
  date: string;
  value: number | null;
  label: ScoreLabel | null;
  finalized: boolean;
  isToday: boolean;
}

export interface ScoreHistoryResponse {
  endingOn: string;
  days: number;
  entries: ScoreHistoryDayResponse[];
  summary: {
    consistencyRun: number;
    solidPlusDays: number;
    strongDays: number;
    current7DayAverage: number | null;
    previous7DayAverage: number | null;
  };
  generatedAt: string;
}

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function getScoreLabel(value: number): ScoreLabel {
  if (value >= 85) {
    return "Strong Day";
  }

  if (value >= 70) {
    return "Solid Day";
  }

  if (value >= 55) {
    return "Recovering Day";
  }

  return "Off-Track Day";
}

function buildHistoryWindow(endingOn: Date, days: number): IsoDateString[] {
  const windowDates: IsoDateString[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    windowDates.push(toIsoDateString(addDays(endingOn, -offset)) as IsoDateString);
  }

  return windowDates;
}

function averageFinalizedScores(entries: ScoreHistoryDayResponse[]) {
  const finalizedValues = entries
    .filter((entry) => entry.finalized && entry.value !== null)
    .map((entry) => entry.value as number);

  if (finalizedValues.length === 0) {
    return null;
  }

  return Math.round(finalizedValues.reduce((sum, value) => sum + value, 0) / finalizedValues.length);
}

function buildScoreHistorySummary(entries: ScoreHistoryDayResponse[]) {
  let consistencyRun = 0;
  let foundMostRecentFinalizedDay = false;

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (!entry.finalized) {
      continue;
    }

    foundMostRecentFinalizedDay = true;
    if ((entry.value ?? 0) >= 70) {
      consistencyRun += 1;
      continue;
    }

    break;
  }

  return {
    consistencyRun: foundMostRecentFinalizedDay ? consistencyRun : 0,
    solidPlusDays: entries.filter((entry) => entry.finalized && (entry.value ?? 0) >= 70).length,
    strongDays: entries.filter((entry) => entry.finalized && (entry.value ?? 0) >= 85).length,
    current7DayAverage: averageFinalizedScores(entries.slice(-7)),
    previous7DayAverage: entries.length >= 14 ? averageFinalizedScores(entries.slice(-14, -7)) : null,
  };
}

function buildBucket(
  key: ScoreBucket["key"],
  label: string,
  earnedPoints: number,
  applicablePoints: number,
  explanation: string,
): ScoreBucket {
  return {
    key,
    label,
    earnedPoints: roundToOneDecimal(earnedPoints),
    applicablePoints: roundToOneDecimal(applicablePoints),
    explanation,
  };
}

function isScoreBucket(value: unknown): value is ScoreBucket {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const bucket = value as Partial<ScoreBucket>;
  return (
    typeof bucket.key === "string" &&
    typeof bucket.label === "string" &&
    typeof bucket.earnedPoints === "number" &&
    typeof bucket.applicablePoints === "number" &&
    typeof bucket.explanation === "string"
  );
}

function isScoreReason(value: unknown): value is ScoreReason {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const reason = value as Partial<ScoreReason>;
  return typeof reason.label === "string" && typeof reason.missingPoints === "number";
}

function parseStoredBreakdown(value: Prisma.JsonValue): Pick<DailyScoreBreakdownResponse, "buckets" | "topReasons"> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {
      buckets: [],
      topReasons: [],
    };
  }

  const breakdown = value as { buckets?: unknown; topReasons?: unknown };

  return {
    buckets: Array.isArray(breakdown.buckets) ? breakdown.buckets.filter(isScoreBucket) : [],
    topReasons: Array.isArray(breakdown.topReasons) ? breakdown.topReasons.filter(isScoreReason) : [],
  };
}

function serializeStoredDailyScore(score: StoredDailyScore): DailyScoreBreakdownResponse {
  const breakdown = parseStoredBreakdown(score.breakdownJson);

  return {
    date: toIsoDateString(score.planningCycle.cycleStartDate),
    value: score.scoreValue,
    label: score.scoreBand as ScoreLabel,
    earnedPoints: Number(score.earnedPoints),
    possiblePoints: Number(score.applicablePoints),
    buckets: breakdown.buckets,
    topReasons: breakdown.topReasons,
    finalizedAt: score.finalizedAt?.toISOString() ?? null,
    generatedAt: new Date().toISOString(),
  };
}

async function findFinalizedDailyScore(
  prisma: PrismaClient,
  userId: string,
  date: Date,
) {
  const targetIsoDate = toIsoDateString(date);
  const targetDate = parseIsoDate(targetIsoDate);

  if (!prisma.dailyScore?.findFirst) {
    return null;
  }

  return prisma.dailyScore.findFirst({
    where: {
      userId,
      finalizedAt: {
        not: null,
      },
      planningCycle: {
        cycleType: "DAY",
        cycleStartDate: targetDate,
      },
    },
    include: {
      planningCycle: true,
    },
  });
}

function getRequiredTomorrowPriorityCount(adjustment: string | null | undefined) {
  return adjustment === "rescue" || adjustment === "recovery" ? 1 : 2;
}

function countLoggedExpenseEntries(input: {
  ledgerExpenses: Array<{ billId: string | null }>;
  legacyExpenses: Array<{ billId: string | null }>;
}) {
  const ledgerExpenseBillIds = new Set(
    input.ledgerExpenses
      .map((transaction) => transaction.billId)
      .filter((billId): billId is string => Boolean(billId)),
  );
  const legacyOnlyExpenses = input.legacyExpenses.filter(
    (expense) => !expense.billId || !ledgerExpenseBillIds.has(expense.billId),
  );

  return input.ledgerExpenses.length + legacyOnlyExpenses.length;
}

function getRoutineCompletion(
  routines: ScoringDayContext["activeRoutines"],
  routineCheckins: ScoringDayContext["routineCheckins"],
  input: {
    targetIsoDate: IsoDateString;
    now: Date;
    timezone?: string | null;
    dayMode?: "NORMAL" | "RESCUE" | "RECOVERY";
  },
): {
  earned: number;
  punctualityEarned: number;
  applicable: number;
  completed: number;
  total: number;
} {
  const scorableRoutines = routines
    .map((routine) => ({
      ...routine,
      requiredItems: routine.items.filter((item) => item.isRequired),
    }))
    .filter((routine) => routine.requiredItems.length > 0);

  if (scorableRoutines.length === 0) {
    return {
      earned: 0,
      punctualityEarned: 0,
      applicable: 0,
      completed: 0,
      total: 0,
    };
  }

  const completionShare = 8 / scorableRoutines.length;
  const earned = scorableRoutines.reduce((sum, routine) => {
    const completed = routine.requiredItems.filter((item) =>
      routineCheckins.some((checkin) => checkin.routineItemId === item.id),
    ).length;

    return sum + completionShare * (completed / routine.requiredItems.length);
  }, 0);
  const completed = scorableRoutines.reduce(
    (sum, routine) =>
      sum +
      routine.requiredItems.filter((item) =>
        routineCheckins.some((checkin) => checkin.routineItemId === item.id),
      ).length,
    0,
  );
  const total = scorableRoutines.reduce((sum, routine) => sum + routine.requiredItems.length, 0);

  const timedRoutines = scorableRoutines.filter((routine) => isScoredRoutineTimingMode(
    routine.timingMode === "PERIOD"
      ? "period"
      : routine.timingMode === "CUSTOM_WINDOW"
        ? "custom_window"
        : "anytime",
  ));
  const punctualityShare = timedRoutines.length > 0 ? 2 / timedRoutines.length : 0;
  const punctualityEarned = timedRoutines.reduce((sum, routine) => {
    const completedAt = routine.requiredItems.every((item) =>
      routineCheckins.some((checkin) => checkin.routineItemId === item.id),
    )
      ? routine.requiredItems
        .flatMap((item) => routineCheckins.filter((checkin) => checkin.routineItemId === item.id))
        .sort((left, right) => (left.completedAt?.getTime() ?? 0) - (right.completedAt?.getTime() ?? 0))
        .at(-1)?.completedAt ?? null
      : null;
    const timingMode =
      routine.timingMode === "PERIOD"
        ? "period"
        : routine.timingMode === "CUSTOM_WINDOW"
          ? "custom_window"
          : "anytime";
    const period =
      routine.period === "MORNING"
        ? "morning"
        : routine.period === "EVENING"
          ? "evening"
          : null;
    const status = getRoutineTimingStatusToday({
      timingMode,
      period,
      completedAt,
      now: input.now,
      targetIsoDate: input.targetIsoDate,
      timezone: input.timezone,
      windowStartMinutes: routine.windowStartMinutes ?? null,
      windowEndMinutes: routine.windowEndMinutes ?? null,
    });
    const rescueActive = input.dayMode === "RESCUE" || input.dayMode === "RECOVERY";

    if (rescueActive && completedAt) {
      return sum + punctualityShare;
    }

    return sum + (status === "complete_on_time" ? punctualityShare : 0);
  }, 0);

  return {
    earned,
    punctualityEarned,
    applicable: 8 + (timedRoutines.length > 0 ? 2 : 0),
    completed,
    total,
  };
}

function sortTasksForScore(
  tasks: ScoringDayContext["tasks"],
) {
  return tasks
    .slice()
    .sort((left, right) => {
      const leftIsPlanned = Boolean(left.plannerBlockTask);
      const rightIsPlanned = Boolean(right.plannerBlockTask);

      if (leftIsPlanned !== rightIsPlanned) {
        return leftIsPlanned ? -1 : 1;
      }

      if (left.plannerBlockTask && right.plannerBlockTask) {
        const blockSortDelta = left.plannerBlockTask.block.sortOrder - right.plannerBlockTask.block.sortOrder;
        if (blockSortDelta !== 0) {
          return blockSortDelta;
        }

        const taskSortDelta = left.plannerBlockTask.sortOrder - right.plannerBlockTask.sortOrder;
        if (taskSortDelta !== 0) {
          return taskSortDelta;
        }
      }

      const leftDueAt = left.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightDueAt = right.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (leftDueAt !== rightDueAt) {
        return leftDueAt - rightDueAt;
      }

      return left.createdAt.getTime() - right.createdAt.getTime();
    });
}

export async function calculateDailyScore(
  prisma: PrismaClient,
  userId: string,
  date: Date,
  options: {
    mode?: DailyScoreMode;
  } = {},
): Promise<DailyScoreBreakdownResponse> {
  if (options.mode !== "live") {
    const storedScore = await findFinalizedDailyScore(prisma, userId, date);
    if (storedScore) {
      return serializeStoredDailyScore(storedScore);
    }
  }

  const context = await getDayContext(prisma, userId, date);
  const priorities = context.dayCycle.priorities;
  const mustWinTask = context.dailyLaunch?.mustWinTaskId
    ? context.tasks.find((task) => task.id === context.dailyLaunch?.mustWinTaskId) ?? null
    : null;
  const supportPriorities = priorities.filter((priority) => priority.slot <= 2);
  const tasksForScore = sortTasksForScore(
    context.tasks.filter((task) => task.id !== mustWinTask?.id),
  ).slice(0, 5);

  const launchEarned = context.dailyLaunch?.completedAt
    ? SCORING_RULES.planAndPriorities.launchCompletion
    : 0;
  const launchApplicable = SCORING_RULES.planAndPriorities.launchCompletion;
  const mustWinApplicable = mustWinTask ? SCORING_RULES.planAndPriorities.mustWinComplete : 0;
  const mustWinEarned =
    mustWinTask?.status === "COMPLETED"
      ? SCORING_RULES.planAndPriorities.mustWinComplete
      : mustWinTask?.progressState === "ADVANCED"
        ? SCORING_RULES.planAndPriorities.mustWinAdvanced
        : mustWinTask?.progressState === "STARTED"
          ? SCORING_RULES.planAndPriorities.mustWinStarted
          : 0;
  const priorityEarned = supportPriorities.reduce(
    (sum, priority) =>
      sum + (priority.status === "COMPLETED" ? SCORING_RULES.planAndPriorities.supportPriorityPoints[priority.slot] ?? 0 : 0),
    0,
  );
  const priorityApplicable = supportPriorities.reduce(
    (sum, priority) => sum + (SCORING_RULES.planAndPriorities.supportPriorityPoints[priority.slot] ?? 0),
    0,
  );
  const completedTaskCount = tasksForScore.filter((task) => task.status === "COMPLETED").length;
  const taskApplicable = tasksForScore.length > 0 ? SCORING_RULES.planAndPriorities.supportTaskCompletion : 0;
  const taskEarned =
    taskApplicable > 0
      ? SCORING_RULES.planAndPriorities.supportTaskCompletion * (completedTaskCount / tasksForScore.length)
      : 0;
  const planBucket = buildBucket(
    "plan_and_priorities",
    "Plan and Priorities",
    launchEarned + mustWinEarned + priorityEarned + taskEarned,
    launchApplicable + mustWinApplicable + priorityApplicable + taskApplicable,
    "Launch completion, must-win progress, two support priorities, and a small contribution from completed supporting tasks.",
  );

  const routines = getRoutineCompletion(context.activeRoutines, context.routineCheckins, {
    targetIsoDate: context.targetIsoDate,
    now: new Date(),
    timezone: context.timezone,
    dayMode: context.dailyLaunch?.dayMode ?? undefined,
  });
  const dueHabits = filterDueHabits(context.activeHabits, context.targetIsoDate);
  const habitCompletedUnits = dueHabits.reduce(
    (sum, habit) =>
      sum +
      Math.min(
        getHabitCompletionCountForIsoDate(
          context.habitCheckins.filter((checkin) => checkin.habitId === habit.id),
          context.targetIsoDate,
        ),
        habit.targetPerDay,
      ),
    0,
  );
  const habitTargetUnits = dueHabits.reduce((sum, habit) => sum + habit.targetPerDay, 0);
  const habitApplicable = dueHabits.length > 0 ? SCORING_RULES.routinesAndHabits.habitCompletion : 0;
  const habitEarned =
    habitTargetUnits > 0
      ? SCORING_RULES.routinesAndHabits.habitCompletion * (habitCompletedUnits / habitTargetUnits)
      : 0;
  const timedDueHabits = dueHabits.filter((habit) =>
    isScoredHabitTimingMode(
      habit.timingMode === "EXACT_TIME"
        ? "exact_time"
        : habit.timingMode === "TIME_WINDOW"
          ? "time_window"
          : habit.timingMode === "ANCHOR"
            ? "anchor"
            : "anytime",
      habit.targetPerDay,
    ),
  );
  const habitPunctualityShare =
    timedDueHabits.length > 0
      ? SCORING_RULES.routinesAndHabits.habitPunctuality / timedDueHabits.length
      : 0;
  const rescueActive = context.dailyLaunch?.dayMode === "RESCUE" || context.dailyLaunch?.dayMode === "RECOVERY";
  const habitPunctualityEarned = timedDueHabits.reduce((sum, habit) => {
    const completedAt =
      context.habitCheckins.find((checkin) => checkin.habitId === habit.id && toIsoDateString(checkin.occurredOn) === context.targetIsoDate)?.completedAt ?? null;
    const timingMode =
      habit.timingMode === "ANCHOR"
        ? "anchor"
        : habit.timingMode === "EXACT_TIME"
          ? "exact_time"
          : habit.timingMode === "TIME_WINDOW"
            ? "time_window"
            : "anytime";
    const status = getHabitTimingStatusToday({
      timingMode,
      targetPerDay: habit.targetPerDay,
      completedAt,
      now: new Date(),
      targetIsoDate: context.targetIsoDate,
      timezone: context.timezone,
      targetTimeMinutes: habit.targetTimeMinutes ?? null,
      windowStartMinutes: habit.windowStartMinutes ?? null,
      windowEndMinutes: habit.windowEndMinutes ?? null,
    });

    if (rescueActive && completedAt) {
      return sum + habitPunctualityShare;
    }

    return sum + (status === "complete_on_time" ? habitPunctualityShare : 0);
  }, 0);
  const routineHabitBucket = buildBucket(
    "routines_and_habits",
    "Routines and Habits",
    routines.earned + routines.punctualityEarned + habitEarned + habitPunctualityEarned,
    routines.applicable + habitApplicable + (timedDueHabits.length > 0 ? SCORING_RULES.routinesAndHabits.habitPunctuality : 0),
    "Required routine items, due habit repetitions, and on-time completion for timed consistency work.",
  );

  const waterTarget = context.preferences?.dailyWaterTargetMl ?? SCORING_RULES.healthBasics.defaultWaterTargetMl;
  const waterMl = context.waterLogs.reduce((sum, log) => sum + log.amountMl, 0);
  const waterEarned = SCORING_RULES.healthBasics.water * Math.min(1, waterTarget > 0 ? waterMl / waterTarget : 0);
  const todayIsoDate = getUserLocalDate(new Date(), context.preferences?.timezone);
  const mealTargetCount =
    context.targetIsoDate === todayIsoDate
      ? getMealTargetCountForHour(getUserLocalHour(new Date(), context.preferences?.timezone))
      : SCORING_RULES.healthBasics.defaultMealTargetCount;
  const mealScore = scoreMealConsistency(context.mealLogs, mealTargetCount);
  const workoutApplicable =
    context.workoutDay && context.workoutDay.planType !== "NONE" ? SCORING_RULES.healthBasics.workout : 0;
  const workoutEarned =
    workoutApplicable === 0
      ? 0
      : context.workoutDay?.actualStatus === "COMPLETED" ||
          context.workoutDay?.actualStatus === "RECOVERY_RESPECTED"
        ? SCORING_RULES.healthBasics.workout
        : context.workoutDay?.actualStatus === "FALLBACK"
          ? SCORING_RULES.healthBasics.workoutFallback
          : 0;
  const healthBucket = buildBucket(
    "health_basics",
    "Health Basics",
    waterEarned + mealScore.earnedPoints + workoutEarned,
    SCORING_RULES.healthBasics.water + mealScore.applicablePoints + workoutApplicable,
    "Water target, meal logging quality, and workout or recovery adherence.",
  );

  const loggedExpenseCount = countLoggedExpenseEntries({
    ledgerExpenses: context.financeTransactions,
    legacyExpenses: context.expenses,
  });
  const expenseApplicable = loggedExpenseCount > 0 ? SCORING_RULES.financeAndAdmin.expenseLogging : 0;
  const expenseEarned =
    loggedExpenseCount > 0
      ? SCORING_RULES.financeAndAdmin.expenseLogging *
        Math.min(1, loggedExpenseCount / SCORING_RULES.financeAndAdmin.expenseTargetCount)
      : 0;
  const dueAdminApplicable = context.dueAdminItems.length > 0 ? SCORING_RULES.financeAndAdmin.dueAdmin : 0;
  const dueAdminEarned =
    context.dueAdminItems.length > 0
      ? SCORING_RULES.financeAndAdmin.dueAdmin *
        (context.dueAdminItems.filter((item) => item.status === "DONE" || item.status === "RESCHEDULED").length /
          context.dueAdminItems.length)
      : 0;
  const financeBucket = buildBucket(
    "finance_and_admin",
    "Finance and Admin",
    expenseEarned + dueAdminEarned,
    expenseApplicable + dueAdminApplicable,
    "Same-day expense logging and due admin or bill items.",
  );

  const tomorrowPriorityCount = getRequiredTomorrowPriorityCount(context.dayCycle.dailyReview?.tomorrowAdjustment);
  const tomorrowPrepared =
    context.tomorrowCycle.priorities.length >= tomorrowPriorityCount
      ? SCORING_RULES.reviewAndReset.tomorrowPrepared
      : 0;
  const reviewCompleted = context.dayCycle.dailyReview ? SCORING_RULES.reviewAndReset.reviewCompletion : 0;
  const reviewBucket = buildBucket(
    "review_and_reset",
    "Review and Reset",
    reviewCompleted + tomorrowPrepared,
    SCORING_RULES.reviewAndReset.reviewCompletion + SCORING_RULES.reviewAndReset.tomorrowPrepared,
    "Daily review completion plus tomorrow preparation.",
  );

  const buckets = [planBucket, routineHabitBucket, healthBucket, financeBucket, reviewBucket].filter(
    (bucket) => bucket.applicablePoints > 0,
  );
  const earnedPoints = roundToOneDecimal(buckets.reduce((sum, bucket) => sum + bucket.earnedPoints, 0));
  const possiblePoints = roundToOneDecimal(
    buckets.reduce((sum, bucket) => sum + bucket.applicablePoints, 0),
  );
  const value = possiblePoints > 0 ? Math.round((earnedPoints / possiblePoints) * 100) : 0;
  const topReasons = buckets
    .map((bucket) => ({
      label: bucket.label,
      missingPoints: roundToOneDecimal(bucket.applicablePoints - bucket.earnedPoints),
    }))
    .filter((reason) => reason.missingPoints > 0)
    .sort((a, b) => b.missingPoints - a.missingPoints)
    .slice(0, 3);

  return {
    date: context.targetIsoDate,
    value,
    label: getScoreLabel(value),
    earnedPoints,
    possiblePoints,
    buckets,
    topReasons,
    finalizedAt: context.dayCycle.dailyScore?.finalizedAt?.toISOString() ?? null,
    generatedAt: new Date().toISOString(),
  };
}

export async function finalizeDailyScore(
  prisma: PrismaClient,
  userId: string,
  date: Date,
) {
  const dayCycle = await ensureCycle(prisma, {
    userId,
    cycleType: "DAY",
    cycleStartDate: date,
    cycleEndDate: date,
  });
  const score = await calculateDailyScore(prisma, userId, date, { mode: "live" });
  const finalizedAt = new Date();

  await prisma.dailyScore.upsert({
    where: {
      planningCycleId: dayCycle.id,
    },
    update: {
      scoreValue: score.value,
      scoreBand: score.label,
      earnedPoints: score.earnedPoints,
      applicablePoints: score.possiblePoints,
      breakdownJson: {
        buckets: score.buckets,
        topReasons: score.topReasons,
      } as unknown as Prisma.InputJsonValue,
      finalizedAt,
    },
    create: {
      userId,
      planningCycleId: dayCycle.id,
      scoreValue: score.value,
      scoreBand: score.label,
      earnedPoints: score.earnedPoints,
      applicablePoints: score.possiblePoints,
      breakdownJson: {
        buckets: score.buckets,
        topReasons: score.topReasons,
      } as unknown as Prisma.InputJsonValue,
      finalizedAt,
    },
  });

  await prisma.planningCycle.update({
    where: {
      id: dayCycle.id,
    },
    data: {
      status: "CLOSED",
    },
  });

  return {
    ...score,
    finalizedAt: finalizedAt.toISOString(),
    generatedAt: new Date().toISOString(),
  };
}

export async function getScoreHistory(
  prisma: PrismaClient,
  userId: string,
  endingOn: Date,
  days: number,
): Promise<ScoreHistoryResponse> {
  const boundedDays = Math.max(7, Math.min(days, 90));
  const preferences = await prisma.userPreference.findUnique({
    where: {
      userId,
    },
  });
  const timezone = normalizeTimezone(preferences?.timezone);
  const now = new Date();
  const todayIsoDate = getUserLocalDate(now, timezone) as IsoDateString;
  const endingOnIsoDate = toIsoDateString(endingOn);
  const windowDates = buildHistoryWindow(endingOn, boundedDays);
  const windowStart = parseIsoDate(windowDates[0]);

  const finalizedScores = await prisma.dailyScore.findMany({
    where: {
      userId,
      finalizedAt: {
        not: null,
      },
      planningCycle: {
        cycleStartDate: {
          gte: windowStart,
          lte: endingOn,
        },
      },
    },
    include: {
      planningCycle: true,
    },
  });

  const finalizedScoresByDate = new Map(
    finalizedScores.map((score) => [
      toIsoDateString(score.planningCycle.cycleStartDate),
      score,
    ]),
  );

  const liveTodayScore =
    windowDates.includes(todayIsoDate)
      ? await calculateDailyScore(prisma, userId, parseIsoDate(todayIsoDate))
      : null;

  const entries = windowDates.map<ScoreHistoryDayResponse>((isoDate) => {
    if (liveTodayScore && isoDate === todayIsoDate) {
      return {
        date: isoDate,
        value: liveTodayScore.value,
        label: liveTodayScore.label,
        finalized: Boolean(liveTodayScore.finalizedAt),
        isToday: true,
      };
    }

    const finalizedScore = finalizedScoresByDate.get(isoDate);
    if (finalizedScore) {
      return {
        date: isoDate,
        value: finalizedScore.scoreValue,
        label: finalizedScore.scoreBand as ScoreLabel,
        finalized: true,
        isToday: isoDate === todayIsoDate,
      };
    }

    return {
      date: isoDate,
      value: null,
      label: null,
      finalized: false,
      isToday: isoDate === todayIsoDate,
    };
  });

  return {
    endingOn: endingOnIsoDate,
    days: boundedDays,
    entries,
    summary: buildScoreHistorySummary(entries),
    generatedAt: new Date().toISOString(),
  };
}

export async function getWeeklyMomentum(
  prisma: PrismaClient,
  userId: string,
  endingOn: Date,
): Promise<WeeklyMomentumResponse> {
  const dailyScores = await prisma.dailyScore.findMany({
    where: {
      userId,
      finalizedAt: {
        not: null,
      },
      planningCycle: {
        cycleStartDate: {
          lte: endingOn,
        },
      },
    },
    orderBy: {
      planningCycle: {
        cycleStartDate: "desc",
      },
    },
    take: 7,
    include: {
      planningCycle: true,
    },
  });

  const trailingWeekStart = addDays(endingOn, -6);
  const weeklyReviewInWindow = await prisma.weeklyReview.findFirst({
    where: {
      userId,
      planningCycle: {
        cycleEndDate: {
          gte: trailingWeekStart,
          lte: endingOn,
        },
      },
    },
  });

  const weeklyReviewBonus = weeklyReviewInWindow ? 5 : 0;
  const values = dailyScores.map((score) => score.scoreValue);
  const average = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const value = Math.min(100, Math.round(average + weeklyReviewBonus));

  const allRecentScores = await prisma.dailyScore.findMany({
    where: {
      userId,
      finalizedAt: {
        not: null,
      },
      planningCycle: {
        cycleStartDate: {
          lte: endingOn,
        },
      },
    },
    orderBy: {
      planningCycle: {
        cycleStartDate: "desc",
      },
    },
    include: {
      planningCycle: true,
    },
    take: 30,
  });

  let strongDayStreak = 0;
  for (const score of allRecentScores) {
    if (score.scoreValue >= STRONG_DAY_STREAK_THRESHOLD) {
      strongDayStreak += 1;
      continue;
    }
    break;
  }

  return {
    endingOn: toIsoDateString(endingOn),
    value,
    basedOnDays: dailyScores.length,
    weeklyReviewBonus,
    strongDayStreak,
    dailyScores: dailyScores
      .slice()
      .reverse()
      .map((score) => ({
        date: toIsoDateString(score.planningCycle.cycleStartDate),
        value: score.scoreValue,
        label: score.scoreBand as ScoreLabel,
      })),
    generatedAt: new Date().toISOString(),
  };
}

function getReviewWindowEnd(date: Date, dailyReviewEndTime: string | null | undefined) {
  return getTimeWindowUtc(toIsoDateString(date), dailyReviewEndTime ?? "10:00", "UTC");
}

export async function finalizeClosedDayScores(prisma: PrismaClient, now: Date) {
  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
    },
    include: {
      preferences: true,
    },
  });
  let finalizedCount = 0;

  for (const user of users) {
    const timezone = normalizeTimezone(user.preferences?.timezone);
    const todayIsoDate = getUserLocalDate(now, timezone);
    const today = parseIsoDate(todayIsoDate);
    const reviewWindowEndsToday = getTimeWindowUtc(
      todayIsoDate,
      user.preferences?.dailyReviewEndTime ?? "10:00",
      timezone,
    );
    const thresholdDate = now >= reviewWindowEndsToday ? addDays(today, -1) : addDays(today, -2);
    const openDayCycles = await prisma.planningCycle.findMany({
      where: {
        userId: user.id,
        cycleType: "DAY",
        cycleStartDate: {
          lte: thresholdDate,
        },
        OR: [{ status: { not: "CLOSED" } }, { dailyScore: null }, { dailyScore: { finalizedAt: null } }],
      },
      include: {
        dailyScore: true,
      },
      orderBy: {
        cycleStartDate: "asc",
      },
    });

    for (const cycle of openDayCycles) {
      await finalizeDailyScore(prisma, user.id, cycle.cycleStartDate);
      finalizedCount += 1;
    }
  }

  return {
    finalizedCount,
  };
}
