import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  DailyReviewMutationResponse,
  DailyReviewResponse,
  DailyTomorrowAdjustment,
  DailyTomorrowAdjustmentRecommendation,
  DailyTomorrowAdjustmentReason,
  MonthlyReviewHistoryTrendPoint,
  MonthlyReviewMutationResponse,
  MonthlyReviewResponse,
  ReviewFrictionTag,
  ReviewHistoryCadence,
  ReviewHistoryCadenceFilter,
  ReviewHistoryItem,
  ReviewHistoryMetric,
  ReviewHistoryPeriodComparison,
  ReviewHistoryRange,
  ReviewHistoryResponse,
  ReviewHistorySummary,
  ReviewSubmissionWindow,
  SubmitDailyReviewRequest,
  SubmitMonthlyReviewRequest,
  SubmitWeeklyReviewRequest,
  WeeklyMomentumResponse,
  WeeklyReviewHistoryTrendPoint,
  WeeklyReviewMutationResponse,
  WeeklyReviewResponse,
} from "@life-os/contracts";

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

export type ReviewCadence = "daily" | "weekly" | "monthly";
export type DailyFrictionTag = ReviewFrictionTag;

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

export type ReviewHistoryQueryParams = {
  cadence?: ReviewHistoryCadenceFilter;
  range?: ReviewHistoryRange;
  q?: string;
  cursor?: string;
  limit?: number;
};

export type {
  DailyReviewMutationResponse,
  DailyReviewResponse,
  DailyTomorrowAdjustment,
  DailyTomorrowAdjustmentRecommendation,
  DailyTomorrowAdjustmentReason,
  MonthlyReviewHistoryTrendPoint,
  MonthlyReviewMutationResponse,
  MonthlyReviewResponse,
  ReviewHistoryCadence,
  ReviewHistoryCadenceFilter,
  ReviewHistoryItem,
  ReviewHistoryMetric,
  ReviewHistoryPeriodComparison,
  ReviewHistoryRange,
  ReviewHistoryResponse,
  ReviewHistorySummary,
  ReviewSubmissionWindow,
  WeeklyReviewHistoryTrendPoint,
  WeeklyReviewMutationResponse,
  WeeklyReviewResponse,
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
    mutationFn: (payload: SubmitDailyReviewRequest) =>
      apiRequest<DailyReviewMutationResponse>(`/api/reviews/daily/${date}`, {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Daily review submitted.",
      errorMessage: "Daily review submission failed.",
    },
    onSuccess: () =>
      invalidateCoreData(queryClient, date, {
        domains: [
          "tasks",
          "home",
          "score",
          "planning",
          "goals",
          "review",
          "reviewHistory",
          "notifications",
        ],
      }),
  });
};

export const useSubmitWeeklyReviewMutation = (date: string) => {
  const queryClient = useQueryClient();
  const startDate = getWeekStartDate(date);

  return useMutation({
    mutationFn: (payload: SubmitWeeklyReviewRequest) =>
      apiRequest<WeeklyReviewMutationResponse>(`/api/reviews/weekly/${startDate}`, {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Weekly review submitted.",
      errorMessage: "Weekly review submission failed.",
    },
    onSuccess: () =>
      invalidateCoreData(queryClient, date, {
        domains: ["home", "score", "planning", "goals", "review", "reviewHistory", "notifications"],
      }),
  });
};

export const useSubmitMonthlyReviewMutation = (date: string) => {
  const queryClient = useQueryClient();
  const startDate = getMonthStartDate(date);

  return useMutation({
    mutationFn: (payload: SubmitMonthlyReviewRequest) =>
      apiRequest<MonthlyReviewMutationResponse>(`/api/reviews/monthly/${startDate}`, {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Monthly review submitted.",
      errorMessage: "Monthly review submission failed.",
    },
    onSuccess: () =>
      invalidateCoreData(queryClient, date, {
        domains: ["home", "score", "planning", "goals", "review", "reviewHistory", "notifications"],
      }),
  });
};
