import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type {
  RecurrenceDefinition,
  RecurrenceInput,
} from "../recurrence";
import { getTodayDate } from "../date";
import {
  apiRequest,
  invalidateCoreData,
  queryKeys,
} from "./core";
import type { LinkedGoal } from "./goals";

type HabitsResponse = {
  generatedAt: string;
  date: string;
  weeklyChallenge: {
    habitId: string;
    title: string;
    streakCount: number;
    completedToday: boolean;
    weekCompletions: number;
    weekTarget: number;
    status: "on_track" | "due_today" | "behind";
    message: string;
  } | null;
  habits: Array<{
    id: string;
    title: string;
    category: string | null;
    habitType: "maintenance" | "growth" | "identity";
    scheduleRule: { daysOfWeek?: number[] };
    recurrence: RecurrenceDefinition | null;
    goalId: string | null;
    goal: LinkedGoal | null;
    targetPerDay: number;
    timingMode: "anytime" | "anchor" | "exact_time" | "time_window";
    anchorText: string | null;
    targetTimeMinutes: number | null;
    windowStartMinutes: number | null;
    windowEndMinutes: number | null;
    timingStatusToday: "none" | "upcoming" | "due_now" | "late" | "complete_on_time" | "complete_late";
    timingLabel: string | null;
    minimumVersion: string | null;
    standardVersion: string | null;
    stretchVersion: string | null;
    obstaclePlan: string | null;
    repairRule: string | null;
    identityMeaning: string | null;
    status: "active" | "paused" | "archived";
    dueToday: boolean;
    completedToday: boolean;
    completedCountToday: number;
    achievedLevelToday: "minimum" | "standard" | "stretch" | null;
    streakCount: number;
    risk: {
      level: "none" | "at_risk" | "drifting";
      reason: "streak_at_risk" | "missed_recently" | "low_completion_rate" | null;
      message: string | null;
      dueCount7d: number;
      completedCount7d: number;
      completionRate7d: number;
    };
    pauseWindows: Array<{
      id: string;
      kind: "rest_day" | "vacation";
      startsOn: string;
      endsOn: string;
      note: string | null;
      isActiveToday: boolean;
    }>;
  }>;
  dueHabits: Array<{
    id: string;
    title: string;
    category: string | null;
    habitType: "maintenance" | "growth" | "identity";
    scheduleRule: { daysOfWeek?: number[] };
    recurrence: RecurrenceDefinition | null;
    goalId: string | null;
    goal: LinkedGoal | null;
    targetPerDay: number;
    timingMode: "anytime" | "anchor" | "exact_time" | "time_window";
    anchorText: string | null;
    targetTimeMinutes: number | null;
    windowStartMinutes: number | null;
    windowEndMinutes: number | null;
    timingStatusToday: "none" | "upcoming" | "due_now" | "late" | "complete_on_time" | "complete_late";
    timingLabel: string | null;
    minimumVersion: string | null;
    standardVersion: string | null;
    stretchVersion: string | null;
    obstaclePlan: string | null;
    repairRule: string | null;
    identityMeaning: string | null;
    status: "active" | "paused" | "archived";
    dueToday: boolean;
    completedToday: boolean;
    completedCountToday: number;
    achievedLevelToday: "minimum" | "standard" | "stretch" | null;
    streakCount: number;
    risk: {
      level: "none" | "at_risk" | "drifting";
      reason: "streak_at_risk" | "missed_recently" | "low_completion_rate" | null;
      message: string | null;
      dueCount7d: number;
      completedCount7d: number;
      completionRate7d: number;
    };
    pauseWindows: Array<{
      id: string;
      kind: "rest_day" | "vacation";
      startsOn: string;
      endsOn: string;
      note: string | null;
      isActiveToday: boolean;
    }>;
  }>;
  routines: Array<{
    id: string;
    name: string;
    sortOrder: number;
    status: "active" | "archived";
    timingMode: "anytime" | "period" | "custom_window";
    period: "morning" | "evening" | null;
    windowStartMinutes: number | null;
    windowEndMinutes: number | null;
    timingStatusToday: "none" | "upcoming" | "due_now" | "late" | "complete_on_time" | "complete_late";
    timingLabel: string | null;
    completedAtToday: string | null;
    completedItems: number;
    totalItems: number;
    items: Array<{
      id: string;
      title: string;
      sortOrder: number;
      isRequired: boolean;
      completedToday: boolean;
    }>;
  }>;
};

type HabitMutationResponse = {
  generatedAt: string;
  habit: HabitsResponse["habits"][number];
};

type RoutineMutationResponse = {
  generatedAt: string;
  routine: HabitsResponse["routines"][number];
};

const invalidateHabits = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: queryKeys.habits });
};

const invalidateHabitsAndCore = (queryClient: ReturnType<typeof useQueryClient>) => {
  invalidateHabits(queryClient);
  invalidateCoreData(queryClient, getTodayDate());
};

export const useHabitsQuery = () =>
  useQuery({
    queryKey: queryKeys.habits,
    queryFn: () => apiRequest<HabitsResponse>("/api/habits"),
    retry: false,
  });

export const useHabitCheckinMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: string | { habitId: string; level?: "minimum" | "standard" | "stretch" | null }) => {
      const habitId = typeof payload === "string" ? payload : payload.habitId;
      const level = typeof payload === "string" ? "standard" : payload.level ?? "standard";

      return apiRequest<HabitMutationResponse>(`/api/habits/${habitId}/checkins`, {
        method: "POST",
        body: {
          date,
          status: "completed",
          level,
        },
      });
    },
    meta: {
      successMessage: "Habit logged.",
      errorMessage: "Habit log failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
};

export const useDeleteHabitCheckinMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (habitId: string) =>
      apiRequest<HabitMutationResponse>(`/api/habits/${habitId}/checkins`, {
        method: "DELETE",
        query: { date },
      }),
    meta: {
      successMessage: "Habit reopened.",
      errorMessage: "Habit update failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
};

export const useRoutineCheckinMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) =>
      apiRequest<RoutineMutationResponse>(`/api/routine-items/${itemId}/checkins`, {
        method: "POST",
        body: { date },
      }),
    meta: {
      successMessage: "Routine item completed.",
      errorMessage: "Routine update failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
};

export const useDeleteRoutineCheckinMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) =>
      apiRequest<RoutineMutationResponse>(`/api/routine-items/${itemId}/checkins`, {
        method: "DELETE",
        query: { date },
      }),
    meta: {
      successMessage: "Routine item reopened.",
      errorMessage: "Routine update failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
};

export const useCreateHabitMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      title: string;
      category?: string | null;
      habitType?: "maintenance" | "growth" | "identity";
      scheduleRule?: { daysOfWeek?: number[] };
      recurrence?: RecurrenceInput;
      targetPerDay?: number;
      goalId?: string | null;
      timingMode?: "anytime" | "anchor" | "exact_time" | "time_window";
      anchorText?: string | null;
      targetTimeMinutes?: number | null;
      windowStartMinutes?: number | null;
      windowEndMinutes?: number | null;
      minimumVersion?: string | null;
      standardVersion?: string | null;
      stretchVersion?: string | null;
      obstaclePlan?: string | null;
      repairRule?: string | null;
      identityMeaning?: string | null;
    }) =>
      apiRequest<HabitMutationResponse>("/api/habits", {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Habit created.",
      errorMessage: "Habit creation failed.",
    },
    onSuccess: () => invalidateHabitsAndCore(queryClient),
  });
};

export const useUpdateHabitMutation = () => {
  const queryClient = useQueryClient();

  type UpdateHabitVariables = {
    habitId: string;
    title?: string;
    category?: string | null;
    habitType?: "maintenance" | "growth" | "identity";
    scheduleRule?: { daysOfWeek?: number[] };
    recurrence?: RecurrenceInput;
    targetPerDay?: number;
    status?: "active" | "paused" | "archived";
    goalId?: string | null;
    timingMode?: "anytime" | "anchor" | "exact_time" | "time_window";
    anchorText?: string | null;
    targetTimeMinutes?: number | null;
    windowStartMinutes?: number | null;
    windowEndMinutes?: number | null;
    minimumVersion?: string | null;
    standardVersion?: string | null;
    stretchVersion?: string | null;
    obstaclePlan?: string | null;
    repairRule?: string | null;
    identityMeaning?: string | null;
  };

  return useMutation<HabitMutationResponse, Error, UpdateHabitVariables>({
    mutationFn: ({
      habitId,
      ...payload
    }: UpdateHabitVariables) =>
      apiRequest<HabitMutationResponse>(`/api/habits/${habitId}`, {
        method: "PATCH",
        body: payload,
      }),
    meta: {
      successMessage: "Habit updated.",
      errorMessage: "Habit update failed.",
    },
    onSuccess: () => invalidateHabitsAndCore(queryClient),
  });
};

export const useCreateHabitPauseWindowMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      habitId,
      ...payload
    }: {
      habitId: string;
      kind: "rest_day" | "vacation";
      startsOn: string;
      endsOn?: string;
      note?: string | null;
    }) =>
      apiRequest<HabitMutationResponse>(`/api/habits/${habitId}/pause-windows`, {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Temporary habit pause saved.",
      errorMessage: "Temporary habit pause failed.",
    },
    onSuccess: () => invalidateHabitsAndCore(queryClient),
  });
};

export const useDeleteHabitPauseWindowMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ habitId, pauseWindowId }: { habitId: string; pauseWindowId: string }) =>
      apiRequest<HabitMutationResponse>(`/api/habits/${habitId}/pause-windows/${pauseWindowId}`, {
        method: "DELETE",
      }),
    meta: {
      successMessage: "Temporary habit pause removed.",
      errorMessage: "Temporary habit pause removal failed.",
    },
    onSuccess: () => invalidateHabitsAndCore(queryClient),
  });
};

export const useCreateRoutineMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      name: string;
      timingMode?: "anytime" | "period" | "custom_window";
      period?: "morning" | "evening" | null;
      windowStartMinutes?: number | null;
      windowEndMinutes?: number | null;
      items: Array<{ title: string; sortOrder: number; isRequired?: boolean }>;
    }) =>
      apiRequest<RoutineMutationResponse>("/api/routines", {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Routine created.",
      errorMessage: "Routine creation failed.",
    },
    onSuccess: () => invalidateHabitsAndCore(queryClient),
  });
};

export const useUpdateRoutineMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      routineId,
      ...payload
    }: {
      routineId: string;
      name?: string;
      sortOrder?: number;
      status?: "active" | "archived";
      timingMode?: "anytime" | "period" | "custom_window";
      period?: "morning" | "evening" | null;
      windowStartMinutes?: number | null;
      windowEndMinutes?: number | null;
      items?: Array<{ id?: string; title: string; sortOrder: number; isRequired?: boolean }>;
    }) =>
      apiRequest<RoutineMutationResponse>(`/api/routines/${routineId}`, {
        method: "PATCH",
        body: payload,
      }),
    meta: {
      successMessage: "Routine updated.",
      errorMessage: "Routine update failed.",
    },
    onSuccess: () => invalidateHabitsAndCore(queryClient),
  });
};
