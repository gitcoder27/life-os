import type {
  HealthGuidanceItem,
  HealthMealSignal,
  HealthPhase,
  HealthRangeInsights,
  HealthScoreSnapshot,
  HealthSummaryResponse,
  HealthTimelineItem,
  HealthWaterSignal,
  MealLogItem,
  MealSlot,
  WaterLogItem,
  WeightLogItem,
  WorkoutActualStatus,
  WorkoutDayItem,
} from "@life-os/contracts";

import {
  getMealTargetCountForHour,
  scoreMealConsistency,
} from "../../lib/health/meals.js";
import { getUserLocalDate } from "../../lib/time/user-time.js";

type SummaryBuilderInput = {
  currentIsoDate: string;
  currentHour: number;
  timezone?: string | null;
  waterTargetMl: number;
  currentDayWaterMl: number;
  currentDayWaterLogs: WaterLogItem[];
  currentDayMealLogs: MealLogItem[];
  currentWorkout: WorkoutDayItem | null;
  latestWeight: WeightLogItem | null;
  rangeWaterLogs: WaterLogItem[];
  rangeMealLogs: MealLogItem[];
  rangeWorkoutDays: WorkoutDayItem[];
  rangeWeightHistory: WeightLogItem[];
};

type CurrentDayEnhancements = HealthSummaryResponse["currentDay"]["signals"] & {
  phase: HealthPhase;
  score: HealthScoreSnapshot;
  timeline: HealthTimelineItem[];
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const roundToOneDecimal = (value: number) => Math.round(value * 10) / 10;

const getHealthPhase = (hour: number): HealthPhase => {
  if (hour < 12) {
    return "morning";
  }

  if (hour < 17) {
    return "midday";
  }

  return "evening";
};

const formatMealSlot = (slot: MealSlot | null) => {
  switch (slot) {
    case "breakfast":
      return "Breakfast";
    case "lunch":
      return "Lunch";
    case "dinner":
      return "Dinner";
    case "snack":
      return "Snack";
    default:
      return "Meal";
  }
};

const formatMealLoggingQuality = (quality: MealLogItem["loggingQuality"]) => {
  switch (quality) {
    case "partial":
      return "Quick log";
    case "meaningful":
      return "Meaningful log";
    case "full":
      return "Full log";
  }
};

const formatWorkoutStatus = (status: WorkoutActualStatus | null | undefined) => {
  switch (status) {
    case "completed":
      return "Completed";
    case "recovery_respected":
      return "Recovery respected";
    case "fallback":
      return "Fallback done";
    case "missed":
      return "Missed";
    case "none":
    case null:
    case undefined:
      return "Not logged";
  }
};

const getWaterPaceTargetMl = (targetMl: number, hour: number) => {
  if (targetMl <= 0) {
    return 0;
  }

  if (hour < 12) {
    return Math.round(targetMl * 0.25);
  }

  if (hour < 17) {
    return Math.round(targetMl * 0.6);
  }

  if (hour < 21) {
    return Math.round(targetMl * 0.85);
  }

  return targetMl;
};

const buildWaterSignal = (
  currentDayWaterMl: number,
  waterTargetMl: number,
  currentHour: number,
): HealthWaterSignal => {
  const progressPct = clampPercent(
    waterTargetMl > 0 ? (currentDayWaterMl / waterTargetMl) * 100 : 0,
  );
  const remainingMl = Math.max(0, waterTargetMl - currentDayWaterMl);
  const paceTargetMl = getWaterPaceTargetMl(waterTargetMl, currentHour);

  if (waterTargetMl > 0 && currentDayWaterMl >= waterTargetMl) {
    return {
      status: "complete",
      progressPct,
      remainingMl: 0,
      paceTargetMl,
    };
  }

  return {
    status: currentDayWaterMl >= paceTargetMl ? "on_track" : "behind",
    progressPct,
    remainingMl,
    paceTargetMl,
  };
};

const getNextSuggestedMealSlot = (hour: number, mealCount: number): MealSlot | null => {
  if (mealCount >= 3) {
    return null;
  }

  if (hour < 11) {
    return "breakfast";
  }

  if (hour < 16) {
    return mealCount === 0 ? "breakfast" : "lunch";
  }

  if (hour < 21) {
    return "dinner";
  }

  return "snack";
};

const buildMealSignal = (
  mealLogs: MealLogItem[],
  currentHour: number,
): HealthMealSignal => {
  const mealCount = mealLogs.length;
  const targetCount = getMealTargetCountForHour(currentHour);
  const progressPct = clampPercent((Math.min(mealCount, 3) / 3) * 100);
  const nextSuggestedSlot = getNextSuggestedMealSlot(currentHour, mealCount);

  if (mealCount >= 3) {
    return {
      status: "complete",
      progressPct,
      targetCount,
      nextSuggestedSlot: null,
    };
  }

  return {
    status: mealCount >= targetCount ? "on_track" : "behind",
    progressPct,
    targetCount,
    nextSuggestedSlot,
  };
};

const buildWorkoutSignal = (workoutDay: WorkoutDayItem | null) => {
  if (!workoutDay || workoutDay.planType === "none") {
    return {
      status: "pending" as const,
      label: "No workout planned",
    };
  }

  switch (workoutDay.actualStatus) {
    case "completed":
      return {
        status: "complete" as const,
        label: "Workout completed",
      };
    case "fallback":
      return {
        status: "complete" as const,
        label: "Fallback session completed",
      };
    case "recovery_respected":
      return {
        status: "recovery" as const,
        label: "Recovery day respected",
      };
    case "missed":
      return {
        status: "missed" as const,
        label: "Workout missed",
      };
    case "none":
    default:
      return {
        status: "pending" as const,
        label:
          workoutDay.planType === "recovery"
            ? "Recovery needs confirmation"
            : "Workout still open",
      };
  }
};

const buildHealthScore = (
  waterMl: number,
  waterTargetMl: number,
  mealLogs: MealLogItem[],
  currentHour: number,
  workoutDay: WorkoutDayItem | null,
): HealthScoreSnapshot => {
  const waterEarned = 8 * Math.min(1, waterTargetMl > 0 ? waterMl / waterTargetMl : 0);
  const mealScore = scoreMealConsistency(mealLogs, getMealTargetCountForHour(currentHour));
  const workoutApplicable = workoutDay && workoutDay.planType !== "none" ? 10 : 0;

  let workoutEarned = 0;
  if (workoutApplicable > 0) {
    if (
      workoutDay?.actualStatus === "completed" ||
      workoutDay?.actualStatus === "recovery_respected"
    ) {
      workoutEarned = 10;
    } else if (workoutDay?.actualStatus === "fallback") {
      workoutEarned = 5;
    }
  }

  const earnedPoints = roundToOneDecimal(waterEarned + mealScore.earnedPoints + workoutEarned);
  const possiblePoints = 8 + mealScore.applicablePoints + workoutApplicable;
  const value = possiblePoints > 0 ? Math.round((earnedPoints / possiblePoints) * 100) : 0;

  return {
    value,
    label: value >= 85 ? "strong" : value >= 60 ? "steady" : "needs_attention",
    earnedPoints,
    possiblePoints,
  };
};

const buildTimeline = (input: SummaryBuilderInput): HealthTimelineItem[] => {
  const items: HealthTimelineItem[] = [
    ...input.currentDayWaterLogs.map((log) => ({
      id: `water:${log.id}`,
      kind: "water" as const,
      occurredAt: log.occurredAt,
      title: `${log.amountMl}ml water`,
      detail:
        log.source === "quick_capture"
          ? "Quick water log"
          : log.source === "manual"
            ? "Manual correction"
            : "Water logged",
    })),
    ...input.currentDayMealLogs.map((log) => ({
      id: `meal:${log.id}`,
      kind: "meal" as const,
      occurredAt: log.occurredAt,
      title: log.description,
      detail: `${formatMealSlot(log.mealSlot)} • ${formatMealLoggingQuality(log.loggingQuality)}`,
    })),
  ];

  if (input.currentWorkout && input.currentWorkout.planType !== "none") {
    items.push({
      id: `workout:${input.currentWorkout.id}`,
      kind: "workout",
      occurredAt: input.currentWorkout.updatedAt,
      title: input.currentWorkout.plannedLabel ?? "Workout",
      detail: formatWorkoutStatus(input.currentWorkout.actualStatus),
    });
  }

  if (input.latestWeight && input.latestWeight.measuredOn === input.currentIsoDate) {
    items.push({
      id: `weight:${input.latestWeight.id}`,
      kind: "weight",
      occurredAt: input.latestWeight.createdAt,
      title: `${input.latestWeight.weightValue} ${input.latestWeight.unit}`,
      detail: "Weight logged",
    });
  }

  return items.sort(
    (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
  );
};

const buildRangeInsights = (input: SummaryBuilderInput): HealthRangeInsights => {
  const waterByDay = new Map<string, number>();
  input.rangeWaterLogs.forEach((log) => {
    const day = getUserLocalDate(new Date(log.occurredAt), input.timezone);
    waterByDay.set(day, (waterByDay.get(day) ?? 0) + log.amountMl);
  });

  const waterDaysOnTarget = [...waterByDay.values()].filter(
    (totalMl) => input.waterTargetMl > 0 && totalMl >= input.waterTargetMl,
  ).length;

  const mealLoggingDays = new Set(
    input.rangeMealLogs.map((log) => getUserLocalDate(new Date(log.occurredAt), input.timezone)),
  ).size;
  const meaningfulMealDays = new Set(
    input.rangeMealLogs
      .filter((log) => log.loggingQuality === "meaningful" || log.loggingQuality === "full")
      .map((log) => getUserLocalDate(new Date(log.occurredAt), input.timezone)),
  ).size;

  const workoutsPlanned = input.rangeWorkoutDays.filter((workoutDay) => workoutDay.planType !== "none");
  const workoutsCompleted = workoutsPlanned.filter(
    (workoutDay) =>
      workoutDay.actualStatus === "completed" || workoutDay.actualStatus === "recovery_respected",
  ).length;
  const workoutsMissed = workoutsPlanned.filter(
    (workoutDay) => workoutDay.actualStatus === "missed",
  ).length;

  const latestWeight = input.rangeWeightHistory[0] ?? null;
  const oldestWeight = input.rangeWeightHistory[input.rangeWeightHistory.length - 1] ?? null;

  return {
    waterDaysOnTarget,
    mealLoggingDays,
    meaningfulMealDays,
    workoutsMissed,
    workoutCompletionRate:
      workoutsPlanned.length > 0
        ? Math.round((workoutsCompleted / workoutsPlanned.length) * 100)
        : null,
    weightChange:
      latestWeight && oldestWeight && input.rangeWeightHistory.length >= 2
        ? roundToOneDecimal(latestWeight.weightValue - oldestWeight.weightValue)
        : null,
    weightUnit: latestWeight?.unit ?? null,
  };
};

const buildGuidance = (
  input: SummaryBuilderInput,
  signals: CurrentDayEnhancements,
  insights: HealthRangeInsights,
) => {
  const recommendations: HealthGuidanceItem[] = [];

  const addRecommendation = (recommendation: HealthGuidanceItem | null) => {
    if (!recommendation || recommendations.length >= 3) {
      return;
    }

    recommendations.push(recommendation);
  };

  if (signals.water.status === "behind" && input.waterTargetMl > 0) {
    const shortfall = Math.max(0, signals.water.paceTargetMl - input.currentDayWaterMl);
    addRecommendation({
      id: "health:water-pace",
      kind: "water",
      tone: "warning",
      title: "Recover hydration pace",
      detail:
        shortfall > 0
          ? `You are about ${shortfall}ml behind the pace for this point in the day.`
          : `You still have ${signals.water.remainingMl}ml left to hit today's target.`,
      actionLabel: "Log water",
      route: "/health",
      intent: "log_water",
    });
  }

  const meaningfulMealCount = input.currentDayMealLogs.filter(
    (meal) => meal.loggingQuality === "meaningful" || meal.loggingQuality === "full",
  ).length;
  if (input.currentHour >= 13 && input.currentDayMealLogs.length === 0) {
    addRecommendation({
      id: "health:first-meal",
      kind: "meal",
      tone: "warning",
      title: "Log your first meal",
      detail: "The day is moving and there is still no meal logged. Keep the record current while it is easy.",
      actionLabel: "Log meal",
      route: "/health",
      intent: "log_meal",
    });
  } else if (input.currentHour >= 17 && meaningfulMealCount < 2) {
    addRecommendation({
      id: "health:meal-quality",
      kind: "meal",
      tone: "warning",
      title: "Add one proper meal log",
      detail: "Meal logging is still light for the day. One meaningful entry keeps the pattern believable.",
      actionLabel: "Log meal",
      route: "/health",
      intent: "log_meal",
    });
  }

  if (
    input.currentWorkout &&
    input.currentWorkout.planType !== "none" &&
    input.currentHour >= 17 &&
    input.currentWorkout.actualStatus === "none"
  ) {
    addRecommendation({
      id: "health:workout-open",
      kind: "workout",
      tone: "warning",
      title: "Close today's workout",
      detail: "A workout is planned but still not marked complete, missed, or recovery respected.",
      actionLabel: "Update workout",
      route: "/health",
      intent: "update_workout",
    });
  } else if (
    insights.workoutCompletionRate !== null &&
    input.rangeWorkoutDays.filter((workoutDay) => workoutDay.planType !== "none").length >= 2 &&
    insights.workoutCompletionRate < 60
  ) {
    addRecommendation({
      id: "health:workout-consistency",
      kind: "consistency",
      tone: "warning",
      title: "Workout consistency is slipping",
      detail: `${insights.workoutCompletionRate}% of planned sessions were completed in this range.`,
      actionLabel: "Review patterns",
      route: "/health",
      intent: "review_patterns",
    });
  }

  if (!input.latestWeight && recommendations.length > 0 && recommendations.length < 3) {
    addRecommendation({
      id: "health:first-weight",
      kind: "weight",
      tone: "neutral",
      title: "Start a weight trend",
      detail: "There is no body-weight history yet, so trend changes cannot be shown.",
      actionLabel: "Log weight",
      route: "/health",
      intent: "log_weight",
    });
  }

  const focus =
    recommendations[0] ??
    (signals.score.label === "strong"
      ? {
          id: "health:steady",
          kind: "consistency" as const,
          tone: "positive" as const,
          title: "Health basics are steady",
          detail: "The day is in a good place. Keep the logging simple and protect the pattern.",
          actionLabel: "Review patterns",
          route: "/health" as const,
          intent: "review_patterns" as const,
        }
      : {
          id: "health:keep-moving",
          kind: "consistency" as const,
          tone: "neutral" as const,
          title: "Keep the basics moving",
          detail:
            signals.meals.nextSuggestedSlot
              ? `Next useful check-in: ${formatMealSlot(signals.meals.nextSuggestedSlot)} or another quick water log.`
              : "Keep the day current with the next health action instead of catching up later.",
          actionLabel: "Review patterns",
          route: "/health" as const,
          intent: "review_patterns" as const,
        });

  return {
    focus,
    recommendations,
  };
};

export function buildHealthSummaryEnhancements(input: SummaryBuilderInput) {
  const phase = getHealthPhase(input.currentHour);
  const water = buildWaterSignal(input.currentDayWaterMl, input.waterTargetMl, input.currentHour);
  const meals = buildMealSignal(input.currentDayMealLogs, input.currentHour);
  const workout = buildWorkoutSignal(input.currentWorkout);
  const score = buildHealthScore(
    input.currentDayWaterMl,
    input.waterTargetMl,
    input.currentDayMealLogs,
    input.currentHour,
    input.currentWorkout,
  );
  const timeline = buildTimeline(input);
  const insights = buildRangeInsights(input);
  const guidance = buildGuidance(input, { phase, water, meals, workout, score, timeline }, insights);

  return {
    currentDay: {
      phase,
      signals: {
        water,
        meals,
        workout,
      },
      score,
      timeline,
    },
    range: {
      insights,
    },
    guidance,
  };
}
