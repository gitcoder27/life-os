import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  getMonthStartDate,
  getWeekEndDate,
  getWeekStartDate,
} from "../date";
import {
  apiRequest,
  invalidateCoreData,
  queryKeys,
  toSectionError,
  unwrapRequiredResult,
} from "./core";
import type { DayPlannerBlockItem, TaskItem } from "./planning";
import type { WeeklyMomentumResponse } from "./scoring";

export type ReviewCadence = "daily" | "weekly" | "monthly";
export type DailyFrictionTag =
  | "low energy"
  | "poor planning"
  | "distraction"
  | "interruptions"
  | "overcommitment"
  | "avoidance"
  | "unclear task"
  | "travel or schedule disruption";

type ReviewSubmissionWindow = {
  isOpen: boolean;
  status: "open" | "too_early" | "too_late" | "wrong_period" | "no_open_window";
  requestedDate: string;
  allowedDate: string | null;
  opensAt: string | null;
  closesAt: string | null;
  timezone: string;
};

type DailyScoreResponse = {
  generatedAt: string;
  date: string;
  value: number;
  label: string;
  earnedPoints: number;
  possiblePoints: number;
  buckets: Array<{
    key: string;
    label: string;
    earnedPoints: number;
    applicablePoints: number;
    explanation: string;
  }>;
  topReasons: Array<{
    label: string;
    missingPoints: number;
  }>;
  finalizedAt: string | null;
};

type DailyReviewResponse = {
  generatedAt: string;
  date: string;
  summary: {
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
  };
  score: DailyScoreResponse;
  incompleteTasks: TaskItem[];
  existingReview: {
    biggestWin: string;
    frictionTag: DailyFrictionTag;
    frictionNote: string | null;
    energyRating: number;
    optionalNote: string | null;
    completedAt: string;
  } | null;
  isCompleted: boolean;
  submissionWindow: ReviewSubmissionWindow;
  seededTomorrowPriorities: Array<{
    id: string;
    slot: 1 | 2 | 3;
    title: string;
    status: "pending" | "completed" | "dropped";
    goalId: string | null;
    goal: import("./goals").LinkedGoal | null;
    completedAt: string | null;
  }>;
};

type WeeklyReviewResponse = {
  generatedAt: string;
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
    topFrictionTags: Array<{
      tag: string;
      count: number;
    }>;
  };
  existingReview: {
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
  } | null;
  seededNextWeekPriorities?: Array<{
    id: string;
    slot: 1 | 2 | 3;
    title: string;
    status: "pending" | "completed" | "dropped";
    goalId: string | null;
    completedAt: string | null;
  }>;
  submissionWindow: ReviewSubmissionWindow;
};

type MonthlyReviewResponse = {
  generatedAt: string;
  startDate: string;
  endDate: string;
  summary: {
    averageWeeklyMomentum: number;
    bestScore: number | null;
    worstScore: number | null;
    workoutCount: number;
    waterSuccessRate: number;
    spendingByCategory: Array<{
      category: string;
      amountMinor: number;
    }>;
    topHabits: Array<{
      habitId: string;
      title: string;
      completionRate: number;
    }>;
    commonFrictionTags: Array<{
      tag: string;
      count: number;
    }>;
  };
  existingReview: {
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
  } | null;
  seededNextMonthTheme?: string | null;
  seededNextMonthOutcomes?: Array<{
    id: string;
    slot: 1 | 2 | 3;
    title: string;
    status: "pending" | "completed" | "dropped";
    goalId: string | null;
    completedAt: string | null;
  }>;
  submissionWindow: ReviewSubmissionWindow;
};

type DailyReviewMutationResponse = {
  generatedAt: string;
  reviewCompletedAt: string;
  score: DailyScoreResponse;
  tomorrowPriorities: Array<{
    id: string;
    slot: 1 | 2 | 3;
    title: string;
    status: "pending" | "completed" | "dropped";
    goalId: string | null;
    completedAt: string | null;
  }>;
};

type WeeklyReviewMutationResponse = {
  generatedAt: string;
  reviewCompletedAt: string;
  nextWeekPriorities: Array<{
    id: string;
    slot: 1 | 2 | 3;
    title: string;
    status: "pending" | "completed" | "dropped";
    goalId: string | null;
    completedAt: string | null;
  }>;
};

type MonthlyReviewMutationResponse = {
  generatedAt: string;
  reviewCompletedAt: string;
  nextMonthTheme: string;
  nextMonthOutcomes: Array<{
    id: string;
    slot: 1 | 2 | 3;
    title: string;
    status: "pending" | "completed" | "dropped";
    goalId: string | null;
    completedAt: string | null;
  }>;
};

export type ReviewHistoryCadence = "daily" | "weekly" | "monthly";
export type ReviewHistoryCadenceFilter = "all" | ReviewHistoryCadence;
export type ReviewHistoryRange = "30d" | "90d" | "365d" | "all";

export type ReviewHistoryMetric = {
  key: string;
  label: string;
  value: number | string | null;
  valueLabel: string;
};

export type ReviewHistoryItem = {
  id: string;
  cadence: ReviewHistoryCadence;
  periodStart: string;
  periodEnd: string;
  completedAt: string;
  primaryText: string;
  secondaryText: string | null;
  metrics: ReviewHistoryMetric[];
  frictionTags: DailyFrictionTag[];
  route: string;
};

export type ReviewHistorySummary = {
  totalReviews: number;
  countsByCadence: Record<ReviewHistoryCadence, number>;
  topFrictionTags: Array<{ tag: DailyFrictionTag; count: number }>;
};

export type WeeklyReviewHistoryTrendPoint = {
  startDate: string;
  endDate: string;
  averageDailyScore: number;
  habitCompletionRate: number;
  strongDayCount: number;
};

export type MonthlyReviewHistoryTrendPoint = {
  startDate: string;
  endDate: string;
  averageWeeklyMomentum: number;
  waterSuccessRate: number;
  workoutCount: number;
};

export type ReviewHistoryPeriodComparison<TMetrics extends Record<string, number>> = {
  currentPeriodStart: string;
  currentPeriodEnd: string;
  previousPeriodStart: string;
  previousPeriodEnd: string;
  currentLabel: string;
  previousLabel: string;
  currentText: string;
  previousText: string;
  metrics: {
    current: TMetrics;
    previous: TMetrics;
    delta: TMetrics;
  };
};

export type WeeklyComparisonMetrics = {
  averageDailyScore: number;
  habitCompletionRate: number;
  strongDayCount: number;
};

export type MonthlyComparisonMetrics = {
  averageWeeklyMomentum: number;
  waterSuccessRate: number;
  workoutCount: number;
};

export type ReviewHistoryResponse = {
  generatedAt: string;
  items: ReviewHistoryItem[];
  nextCursor: string | null;
  summary: ReviewHistorySummary;
  weeklyTrend: WeeklyReviewHistoryTrendPoint[];
  monthlyTrend: MonthlyReviewHistoryTrendPoint[];
  comparisons: {
    weekly: ReviewHistoryPeriodComparison<WeeklyComparisonMetrics> | null;
    monthly: ReviewHistoryPeriodComparison<MonthlyComparisonMetrics> | null;
  };
};

export type ReviewHistoryQueryParams = {
  cadence?: ReviewHistoryCadenceFilter;
  range?: ReviewHistoryRange;
  q?: string;
  cursor?: string;
  limit?: number;
};

export const useReviewDataQuery = (cadence: ReviewCadence, date: string) => {
  const keyDate =
    cadence === "daily"
      ? date
      : cadence === "weekly"
        ? getWeekStartDate(date)
        : getMonthStartDate(date);

  return useQuery({
    queryKey: queryKeys.review(cadence, keyDate),
    queryFn: async () => {
      if (cadence === "daily") {
        const review = await apiRequest<DailyReviewResponse>(`/api/reviews/daily/${keyDate}`);
        return {
          cadence,
          keyDate,
          review,
        } as const;
      }

      if (cadence === "weekly") {
        const [reviewResult, momentumResult] = await Promise.allSettled([
          apiRequest<WeeklyReviewResponse>(`/api/reviews/weekly/${keyDate}`),
          apiRequest<WeeklyMomentumResponse>("/api/scores/weekly-momentum", {
            query: { endingOn: getWeekEndDate(date) },
          }),
        ]);

        return {
          cadence,
          keyDate,
          review: unwrapRequiredResult(reviewResult, "Weekly review data could not load."),
          momentum: momentumResult.status === "fulfilled" ? momentumResult.value : null,
          momentumError:
            momentumResult.status === "rejected"
              ? toSectionError(momentumResult.reason, "Weekly momentum could not load.")
              : null,
        } as const;
      }

      const review = await apiRequest<MonthlyReviewResponse>(`/api/reviews/monthly/${keyDate}`);
      return {
        cadence,
        keyDate,
        review,
      } as const;
    },
    retry: false,
  });
};

export const useReviewHistoryQuery = (params: ReviewHistoryQueryParams) =>
  useQuery({
    queryKey: queryKeys.reviewHistory(params),
    queryFn: () =>
      apiRequest<ReviewHistoryResponse>("/api/reviews/history", {
        query: {
          cadence: params.cadence && params.cadence !== "all" ? params.cadence : undefined,
          range: params.range,
          q: params.q || undefined,
          cursor: params.cursor || undefined,
          limit: params.limit ? String(params.limit) : undefined,
        },
      }),
    retry: false,
  });

export const useSubmitDailyReviewMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      biggestWin: string;
      frictionTag: DailyFrictionTag;
      frictionNote?: string | null;
      energyRating: number;
      optionalNote?: string | null;
      carryForwardTaskIds: string[];
      droppedTaskIds: string[];
      rescheduledTasks: Array<{
        taskId: string;
        targetDate: string;
      }>;
      tomorrowPriorities: Array<{
        id?: string;
        slot: 1 | 2 | 3;
        title: string;
        goalId?: string | null;
      }>;
    }) =>
      apiRequest<DailyReviewMutationResponse>(`/api/reviews/daily/${date}`, {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Daily review submitted.",
      errorMessage: "Daily review submission failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
};

export const useSubmitWeeklyReviewMutation = (date: string) => {
  const queryClient = useQueryClient();
  const startDate = getWeekStartDate(date);

  return useMutation({
    mutationFn: (payload: {
      biggestWin: string;
      biggestMiss: string;
      mainLesson: string;
      keepText: string;
      improveText: string;
      nextWeekPriorities: Array<{
        slot: 1 | 2 | 3;
        title: string;
      }>;
      focusHabitId?: string | null;
      healthTargetText?: string | null;
      spendingWatchCategoryId?: string | null;
      notes?: string | null;
    }) =>
      apiRequest<WeeklyReviewMutationResponse>(`/api/reviews/weekly/${startDate}`, {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Weekly review submitted.",
      errorMessage: "Weekly review submission failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
};

export const useSubmitMonthlyReviewMutation = (date: string) => {
  const queryClient = useQueryClient();
  const startDate = getMonthStartDate(date);

  return useMutation({
    mutationFn: (payload: {
      monthVerdict: string;
      biggestWin: string;
      biggestLeak: string;
      ratings: Record<string, number>;
      nextMonthTheme: string;
      threeOutcomes: string[];
      habitChanges: string[];
      simplifyText: string;
      notes?: string | null;
    }) =>
      apiRequest<MonthlyReviewMutationResponse>(`/api/reviews/monthly/${startDate}`, {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Monthly review submitted.",
      errorMessage: "Monthly review submission failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
};
