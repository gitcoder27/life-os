import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type {
  DeleteMealLogResponse,
  DeleteWaterLogResponse,
  DeleteWeightLogResponse,
  CreateMealLogRequest,
  CreateMealTemplateRequest,
  CreateWaterLogRequest,
  CreateWeightLogRequest,
  HealthGuidanceIntent,
  HealthGuidanceItem,
  HealthSummaryResponse,
  HealthTimelineItem,
  MealLogMutationResponse,
  MealLoggingQuality,
  MealLogsResponse,
  MealPlanEntryItem,
  MealPlanGroceryItem,
  MealPlanWeekResponse,
  MealPrepSessionItem,
  MealSlot,
  MealTemplateIngredient,
  MealTemplateItem,
  MealTemplateMutationResponse,
  MealTemplatesResponse,
  SaveMealPlanWeekRequest,
  UpdateMealLogRequest,
  UpdateMealTemplateRequest,
  UpdateWaterLogRequest,
  UpdateWeightLogRequest,
  UpdateWorkoutDayRequest,
  WaterLogMutationResponse,
  WaterLogsResponse,
  WaterLogSource,
  WeightLogMutationResponse,
  WorkoutActualStatus,
  WorkoutDayMutationResponse,
  WorkoutPlanType,
} from "@life-os/contracts";
import {
  apiRequest,
  invalidateCoreData,
  queryKeys,
  toSectionError,
  unwrapRequiredResult,
} from "./core";
import { toIsoDate } from "../date";

export type {
  HealthGuidanceIntent,
  HealthGuidanceItem,
  HealthTimelineItem,
  MealPlanEntryItem,
  MealPlanGroceryItem,
  MealPlanWeekResponse,
  MealPrepSessionItem,
  MealTemplateIngredient,
  MealTemplateItem,
};

export type SaveMealPlanWeekPayload = SaveMealPlanWeekRequest;

type DeleteWaterLogMutationResponse = DeleteWaterLogResponse;
type DeleteMealLogMutationResponse = DeleteMealLogResponse;
type DeleteWeightLogMutationResponse = DeleteWeightLogResponse;

const invalidateHealthDate = (
  queryClient: ReturnType<typeof useQueryClient>,
  date: string,
) => {
  invalidateCoreData(queryClient, date, {
    domains: ["health", "home", "score", "notifications"],
  });
};

export const useHealthDataQuery = (date: string) =>
  useQuery({
    queryKey: queryKeys.health(date),
    queryFn: async () => {
      const rangeStartDate = (() => {
        const start = new Date(`${date}T12:00:00`);
        start.setDate(start.getDate() - 6);
        return toIsoDate(start);
      })();
      const [summaryResult, waterLogsResult, mealTemplatesResult, mealLogsResult] =
        await Promise.allSettled([
          apiRequest<HealthSummaryResponse>("/api/health/summary", {
            query: { from: rangeStartDate, to: date },
          }),
          apiRequest<WaterLogsResponse>("/api/health/water-logs", {
            query: { date },
          }),
          apiRequest<MealTemplatesResponse>("/api/health/meal-templates"),
          apiRequest<MealLogsResponse>("/api/health/meal-logs", {
            query: { date },
          }),
        ]);

      return {
        summary: unwrapRequiredResult(summaryResult, "Health summary could not load."),
        waterLogs: waterLogsResult.status === "fulfilled" ? waterLogsResult.value : null,
        mealTemplates:
          mealTemplatesResult.status === "fulfilled" ? mealTemplatesResult.value : null,
        mealLogs: mealLogsResult.status === "fulfilled" ? mealLogsResult.value : null,
        sectionErrors: {
          waterLogs:
            waterLogsResult.status === "rejected"
              ? toSectionError(waterLogsResult.reason, "Water logs could not load.")
              : null,
          mealTemplates:
            mealTemplatesResult.status === "rejected"
              ? toSectionError(mealTemplatesResult.reason, "Meal templates could not load.")
              : null,
          mealLogs:
            mealLogsResult.status === "rejected"
              ? toSectionError(mealLogsResult.reason, "Meal logs could not load.")
              : null,
        },
      };
    },
    retry: false,
  });

export const useAddWaterMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (amountMl: number) =>
      apiRequest<WaterLogMutationResponse>("/api/health/water-logs", {
        method: "POST",
        body: {
          amountMl,
          source: "quick_capture",
        } satisfies CreateWaterLogRequest,
      }),
    meta: {
      successMessage: "Water logged.",
      errorMessage: "Water log failed.",
    },
    onSuccess: () => invalidateHealthDate(queryClient, date),
  });
};

export const useUpdateWaterLogMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      waterLogId,
      ...payload
    }: { waterLogId: string } & UpdateWaterLogRequest) =>
      apiRequest<WaterLogMutationResponse>(`/api/health/water-logs/${waterLogId}`, {
        method: "PATCH",
        body: payload,
      }),
    meta: {
      successMessage: "Water log updated.",
      errorMessage: "Water log update failed.",
    },
    onSuccess: () => invalidateHealthDate(queryClient, date),
  });
};

export const useDeleteWaterLogMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (waterLogId: string) =>
      apiRequest<DeleteWaterLogMutationResponse>(`/api/health/water-logs/${waterLogId}`, {
        method: "DELETE",
      }),
    meta: {
      successMessage: "Water log deleted.",
      errorMessage: "Water log deletion failed.",
    },
    onSuccess: () => invalidateHealthDate(queryClient, date),
  });
};

export const useAddMealMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateMealLogRequest) =>
      apiRequest<MealLogMutationResponse>("/api/health/meal-logs", {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Meal logged.",
      errorMessage: "Meal log failed.",
    },
    onSuccess: () => invalidateHealthDate(queryClient, date),
  });
};

export const useUpdateMealLogMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      mealLogId,
      ...payload
    }: { mealLogId: string } & UpdateMealLogRequest) =>
      apiRequest<MealLogMutationResponse>(`/api/health/meal-logs/${mealLogId}`, {
        method: "PATCH",
        body: payload,
      }),
    meta: {
      successMessage: "Meal log updated.",
      errorMessage: "Meal log update failed.",
    },
    onSuccess: () => invalidateHealthDate(queryClient, date),
  });
};

export const useDeleteMealLogMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mealLogId: string) =>
      apiRequest<DeleteMealLogMutationResponse>(`/api/health/meal-logs/${mealLogId}`, {
        method: "DELETE",
      }),
    meta: {
      successMessage: "Meal log deleted.",
      errorMessage: "Meal log deletion failed.",
    },
    onSuccess: () => invalidateHealthDate(queryClient, date),
  });
};

export const useWorkoutMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateWorkoutDayRequest) =>
      apiRequest<WorkoutDayMutationResponse>(`/api/health/workout-days/${date}`, {
        method: "PUT",
        body: payload,
      }),
    meta: {
      successMessage: "Workout updated.",
      errorMessage: "Workout update failed.",
    },
    onSuccess: () => invalidateHealthDate(queryClient, date),
  });
};

export const useAddWeightMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateWeightLogRequest) =>
      apiRequest<WeightLogMutationResponse>("/api/health/weight-logs", {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Weight logged.",
      errorMessage: "Weight log failed.",
    },
    onSuccess: () => invalidateHealthDate(queryClient, date),
  });
};

export const useUpdateWeightLogMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      weightLogId,
      ...payload
    }: { weightLogId: string } & UpdateWeightLogRequest) =>
      apiRequest<WeightLogMutationResponse>(`/api/health/weight-logs/${weightLogId}`, {
        method: "PATCH",
        body: payload,
      }),
    meta: {
      successMessage: "Weight log updated.",
      errorMessage: "Weight log update failed.",
    },
    onSuccess: () => invalidateHealthDate(queryClient, date),
  });
};

export const useDeleteWeightLogMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (weightLogId: string) =>
      apiRequest<DeleteWeightLogMutationResponse>(`/api/health/weight-logs/${weightLogId}`, {
        method: "DELETE",
      }),
    meta: {
      successMessage: "Weight log deleted.",
      errorMessage: "Weight log deletion failed.",
    },
    onSuccess: () => invalidateHealthDate(queryClient, date),
  });
};

export const useMealTemplatesQuery = () =>
  useQuery({
    queryKey: queryKeys.mealTemplates,
    queryFn: () => apiRequest<MealTemplatesResponse>("/api/health/meal-templates"),
    retry: false,
  });

export const useCreateMealTemplateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateMealTemplateRequest) =>
      apiRequest<MealTemplateMutationResponse>("/api/health/meal-templates", {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Meal template created.",
      errorMessage: "Meal template creation failed.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.mealTemplates });
      void queryClient.invalidateQueries({ queryKey: ["mealPlanWeek"] });
    },
  });
};

export const useUpdateMealTemplateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      mealTemplateId,
      ...payload
    }: { mealTemplateId: string } & UpdateMealTemplateRequest) =>
      apiRequest<MealTemplateMutationResponse>(`/api/health/meal-templates/${mealTemplateId}`, {
        method: "PATCH",
        body: payload,
      }),
    meta: {
      successMessage: "Meal template updated.",
      errorMessage: "Meal template update failed.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.mealTemplates });
      void queryClient.invalidateQueries({ queryKey: ["mealPlanWeek"] });
    },
  });
};

/* ── Meal Plan Week ── */

export const useMealPlanWeekQuery = (startDate: string) =>
  useQuery({
    queryKey: queryKeys.mealPlanWeek(startDate),
    queryFn: () =>
      apiRequest<MealPlanWeekResponse>(`/api/health/meal-plans/weeks/${startDate}`),
    retry: false,
  });

export const useSaveMealPlanWeekMutation = (
  startDate: string,
  options?: {
    successMessage?: string;
    errorMessage?: string;
  },
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SaveMealPlanWeekPayload) =>
      apiRequest<MealPlanWeekResponse>(`/api/health/meal-plans/weeks/${startDate}`, {
        method: "PUT",
        body: payload,
    }),
    meta: {
      successMessage: options?.successMessage ?? "Meal plan saved.",
      errorMessage: options?.errorMessage ?? "Meal plan save failed.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.mealPlanWeek(startDate) });
      invalidateCoreData(queryClient, startDate, {
        domains: ["health", "tasks", "home", "score", "notifications"],
      });
    },
  });
};
