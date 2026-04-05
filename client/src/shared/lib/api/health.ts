import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  apiRequest,
  invalidateCoreData,
  queryKeys,
  toSectionError,
  unwrapRequiredResult,
} from "./core";
import { toIsoDate } from "../date";

type HealthWaterSignal = {
  status: "on_track" | "behind" | "complete";
  progressPct: number;
  remainingMl: number;
  paceTargetMl: number;
};

type HealthMealSignal = {
  status: "on_track" | "behind" | "complete";
  progressPct: number;
  targetCount: number;
  nextSuggestedSlot: "breakfast" | "lunch" | "dinner" | "snack" | null;
};

type HealthWorkoutSignal = {
  status: "complete" | "pending" | "recovery" | "missed";
  label: string;
};

type HealthScoreSnapshot = {
  value: number;
  label: "strong" | "steady" | "needs_attention";
  earnedPoints: number;
  possiblePoints: number;
};

export type HealthTimelineItem = {
  id: string;
  kind: "water" | "meal" | "workout" | "weight";
  occurredAt: string;
  title: string;
  detail: string;
};

export type HealthGuidanceIntent =
  | "log_water"
  | "log_meal"
  | "update_workout"
  | "log_weight"
  | "review_patterns";

export type HealthGuidanceItem = {
  id: string;
  kind: string;
  tone: "positive" | "neutral" | "warning";
  title: string;
  detail: string;
  actionLabel: string;
  route: string;
  intent: HealthGuidanceIntent;
};

type HealthRangeInsights = {
  waterDaysOnTarget: number;
  mealLoggingDays: number;
  meaningfulMealDays: number;
  workoutsMissed: number;
  workoutCompletionRate: number | null;
  weightChange: number | null;
  weightUnit: string | null;
};

type HealthSummaryResponse = {
  generatedAt: string;
  from: string;
  to: string;
  currentDay: {
    date: string;
    phase: "morning" | "midday" | "evening";
    waterMl: number;
    waterTargetMl: number;
    mealCount: number;
    meaningfulMealCount: number;
    workoutDay: {
      id: string;
      date: string;
      planType: "workout" | "recovery" | "none";
      plannedLabel: string | null;
      actualStatus: "completed" | "recovery_respected" | "fallback" | "missed" | "none";
      note: string | null;
      updatedAt: string;
    } | null;
    latestWeight: {
      id: string;
      measuredOn: string;
      weightValue: number;
      unit: string;
      note: string | null;
      createdAt: string;
    } | null;
    signals: {
      water: HealthWaterSignal;
      meals: HealthMealSignal;
      workout: HealthWorkoutSignal;
    };
    plannedMeals: Array<{
      mealPlanEntryId: string;
      date: string;
      mealSlot: "breakfast" | "lunch" | "dinner" | "snack";
      mealTemplateId: string | null;
      title: string;
      servings: number | null;
      note: string | null;
      isLogged: boolean;
    }>;
    score: HealthScoreSnapshot;
    timeline: HealthTimelineItem[];
  };
  range: {
    totalWaterMl: number;
    totalMealsLogged: number;
    workoutsCompleted: number;
    workoutsPlanned: number;
    insights: HealthRangeInsights;
  };
  guidance: {
    focus: HealthGuidanceItem;
    recommendations: HealthGuidanceItem[];
  };
  mealLogs: Array<{
    id: string;
    occurredAt: string;
    mealSlot: "breakfast" | "lunch" | "dinner" | "snack" | null;
    mealTemplateId: string | null;
    mealPlanEntryId?: string | null;
    description: string;
    loggingQuality: "partial" | "meaningful" | "full";
    createdAt: string;
  }>;
  weightHistory: Array<{
    id: string;
    measuredOn: string;
    weightValue: number;
    unit: string;
    note: string | null;
    createdAt: string;
  }>;
};

type WaterLogsResponse = {
  generatedAt: string;
  date: string;
  waterLogs: Array<{
    id: string;
    occurredAt: string;
    amountMl: number;
    source: "tap" | "quick_capture" | "manual";
    createdAt: string;
  }>;
};

export type MealTemplateIngredient = {
  name: string;
  quantity: number | null;
  unit: string | null;
  section: string | null;
  note: string | null;
};

export type MealTemplateItem = {
  id: string;
  name: string;
  mealSlot: "breakfast" | "lunch" | "dinner" | "snack" | null;
  description: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: MealTemplateIngredient[];
  instructions: string[];
  tags: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type MealTemplatesResponse = {
  generatedAt: string;
  mealTemplates: MealTemplateItem[];
};

type MealLogsResponse = {
  generatedAt: string;
  date: string;
  mealLogs: Array<{
    id: string;
    occurredAt: string;
    mealSlot: "breakfast" | "lunch" | "dinner" | "snack" | null;
    mealTemplateId: string | null;
    mealPlanEntryId?: string | null;
    description: string;
    loggingQuality: "partial" | "meaningful" | "full";
    createdAt: string;
  }>;
};

type WaterLogMutationResponse = {
  generatedAt: string;
  waterLog: WaterLogsResponse["waterLogs"][number];
};

type DeleteWaterLogMutationResponse = {
  generatedAt: string;
  deleted: true;
  waterLogId: string;
};

type MealLogMutationResponse = {
  generatedAt: string;
  mealLog: MealLogsResponse["mealLogs"][number];
};

type DeleteMealLogMutationResponse = {
  generatedAt: string;
  deleted: true;
  mealLogId: string;
};

type WorkoutDayMutationResponse = {
  generatedAt: string;
  workoutDay: NonNullable<HealthSummaryResponse["currentDay"]["workoutDay"]>;
};

type WeightLogMutationResponse = {
  generatedAt: string;
  weightLog: NonNullable<HealthSummaryResponse["currentDay"]["latestWeight"]>;
};

type DeleteWeightLogMutationResponse = {
  generatedAt: string;
  deleted: true;
  weightLogId: string;
};

type MealTemplateMutationResponse = {
  generatedAt: string;
  mealTemplate: MealTemplatesResponse["mealTemplates"][number];
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
        },
      }),
    meta: {
      successMessage: "Water logged.",
      errorMessage: "Water log failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
};

export const useUpdateWaterLogMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      waterLogId,
      ...payload
    }: {
      waterLogId: string;
      occurredAt?: string;
      amountMl?: number;
      source?: "tap" | "quick_capture" | "manual";
    }) =>
      apiRequest<WaterLogMutationResponse>(`/api/health/water-logs/${waterLogId}`, {
        method: "PATCH",
        body: payload,
      }),
    meta: {
      successMessage: "Water log updated.",
      errorMessage: "Water log update failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
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
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
};

export const useAddMealMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      description: string;
      loggingQuality: "partial" | "meaningful" | "full";
      mealSlot?: "breakfast" | "lunch" | "dinner" | "snack" | null;
      mealTemplateId?: string | null;
      mealPlanEntryId?: string | null;
    }) =>
      apiRequest<MealLogMutationResponse>("/api/health/meal-logs", {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Meal logged.",
      errorMessage: "Meal log failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
};

export const useUpdateMealLogMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      mealLogId,
      ...payload
    }: {
      mealLogId: string;
      occurredAt?: string;
      mealSlot?: "breakfast" | "lunch" | "dinner" | "snack" | null;
      mealTemplateId?: string | null;
      description?: string;
      loggingQuality?: "partial" | "meaningful" | "full";
    }) =>
      apiRequest<MealLogMutationResponse>(`/api/health/meal-logs/${mealLogId}`, {
        method: "PATCH",
        body: payload,
      }),
    meta: {
      successMessage: "Meal log updated.",
      errorMessage: "Meal log update failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
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
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
};

export const useWorkoutMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      planType?: "workout" | "recovery" | "none";
      plannedLabel?: string | null;
      actualStatus?: "completed" | "recovery_respected" | "fallback" | "missed" | "none";
      note?: string | null;
    }) =>
      apiRequest<WorkoutDayMutationResponse>(`/api/health/workout-days/${date}`, {
        method: "PUT",
        body: payload,
      }),
    meta: {
      successMessage: "Workout updated.",
      errorMessage: "Workout update failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
};

export const useAddWeightMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      weightValue: number;
      unit?: string;
      measuredOn?: string;
      note?: string | null;
    }) =>
      apiRequest<WeightLogMutationResponse>("/api/health/weight-logs", {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Weight logged.",
      errorMessage: "Weight log failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
};

export const useUpdateWeightLogMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      weightLogId,
      ...payload
    }: {
      weightLogId: string;
      measuredOn?: string;
      weightValue?: number;
      unit?: string;
      note?: string | null;
    }) =>
      apiRequest<WeightLogMutationResponse>(`/api/health/weight-logs/${weightLogId}`, {
        method: "PATCH",
        body: payload,
      }),
    meta: {
      successMessage: "Weight log updated.",
      errorMessage: "Weight log update failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
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
    onSuccess: () => invalidateCoreData(queryClient, date),
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
    mutationFn: (payload: {
      name: string;
      mealSlot?: "breakfast" | "lunch" | "dinner" | "snack" | null;
      description?: string;
      servings?: number | null;
      prepMinutes?: number | null;
      cookMinutes?: number | null;
      ingredients?: MealTemplateIngredient[];
      instructions?: string[];
      tags?: string[];
      notes?: string | null;
    }) =>
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
      void queryClient.invalidateQueries({ queryKey: ["health"] });
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
    }: {
      mealTemplateId: string;
      name?: string;
      mealSlot?: "breakfast" | "lunch" | "dinner" | "snack" | null;
      description?: string | null;
      servings?: number | null;
      prepMinutes?: number | null;
      cookMinutes?: number | null;
      ingredients?: MealTemplateIngredient[];
      instructions?: string[];
      tags?: string[];
      notes?: string | null;
      archived?: boolean;
    }) =>
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
      void queryClient.invalidateQueries({ queryKey: ["health"] });
      void queryClient.invalidateQueries({ queryKey: ["mealPlanWeek"] });
    },
  });
};

/* ── Meal Plan Week ── */

export type MealPlanEntryItem = {
  id: string;
  date: string;
  mealSlot: "breakfast" | "lunch" | "dinner" | "snack";
  mealTemplateId: string;
  mealTemplateName: string;
  servings: number | null;
  note: string | null;
  sortOrder: number;
  isLogged: boolean;
  loggedMealCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MealPrepSessionItem = {
  id: string;
  scheduledForDate: string;
  title: string;
  notes: string | null;
  taskId: string | null;
  taskStatus: "pending" | "completed" | "dropped" | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type MealPlanGroceryItem = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  section: string | null;
  note: string | null;
  sourceType: "planned" | "manual";
  isChecked: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type MealPlanWeekSummary = {
  totalPlannedMeals: number;
  loggedPlannedMeals: number;
  prepSessionsCount: number;
  completedPrepSessionsCount: number;
  groceryItemCount: number;
};

export type MealPlanWeekResponse = {
  generatedAt: string;
  startDate: string;
  endDate: string;
  notes: string | null;
  entries: MealPlanEntryItem[];
  prepSessions: MealPrepSessionItem[];
  groceryItems: MealPlanGroceryItem[];
  summary: MealPlanWeekSummary;
  mealTemplates: MealTemplateItem[];
};

export type SaveMealPlanWeekPayload = {
  notes?: string | null;
  entries: Array<{
    id?: string;
    date: string;
    mealSlot: "breakfast" | "lunch" | "dinner" | "snack";
    mealTemplateId: string;
    servings?: number | null;
    note?: string | null;
    sortOrder?: number;
  }>;
  prepSessions: Array<{
    id?: string;
    scheduledForDate: string;
    title: string;
    notes?: string | null;
    sortOrder?: number;
  }>;
  manualGroceryItems: Array<{
    id?: string;
    name: string;
    quantity?: number | null;
    unit?: string | null;
    section?: string | null;
    note?: string | null;
    isChecked?: boolean;
    sortOrder?: number;
  }>;
  plannedGroceryItems?: Array<{
    name: string;
    unit?: string | null;
    isChecked?: boolean;
  }>;
};

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
      void queryClient.invalidateQueries({ queryKey: ["mealPlanWeek"] });
      void queryClient.invalidateQueries({ queryKey: ["health"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["home"] });
    },
  });
};
