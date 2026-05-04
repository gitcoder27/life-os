import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  CreateHabitPauseWindowRequest,
  CreateHabitRequest,
  CreateRoutineRequest,
  HabitItem,
  HabitMutationResponse,
  HabitsResponse,
  IsoDateString,
  RoutineMutationResponse,
  RoutineRecord,
  UpdateHabitRequest,
  UpdateRoutineRequest,
} from "@life-os/contracts";
import { getTodayDate, toIsoDate } from "../date";
import {
  apiRequest,
  invalidateCoreData,
  invalidateCoreDataForDates,
  queryKeys,
} from "./core";

export type {
  HabitItem,
};
export type RoutineItem = RoutineRecord;
export type HabitsData = HabitsResponse;

const invalidateHabits = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: queryKeys.habits });
};

const invalidateHabitsAndCore = (queryClient: ReturnType<typeof useQueryClient>) => {
  invalidateHabits(queryClient);
  invalidateCoreData(queryClient, getTodayDate(), {
    domains: ["habits", "home", "score", "notifications"],
  });
};

const invalidateHabitDate = (
  queryClient: ReturnType<typeof useQueryClient>,
  date: string,
) => {
  invalidateCoreData(queryClient, date, {
    domains: ["habits", "home", "score", "notifications"],
  });
};

const getInclusiveDateRange = (startDate: string, endDate: string) => {
  const dates: string[] = [];
  const current = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);

  while (current <= end && dates.length < 31) {
    dates.push(toIsoDate(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
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
          date: date as IsoDateString,
          status: "completed",
          level,
        } satisfies { date: IsoDateString; status: "completed"; level: NonNullable<HabitsResponse["habits"][number]["achievedLevelToday"]> },
      });
    },
    meta: {
      successMessage: "Habit logged.",
      errorMessage: "Habit log failed.",
    },
    onSuccess: () => invalidateHabitDate(queryClient, date),
  });
};

export const useSkipHabitMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (habitId: string) =>
      apiRequest<HabitMutationResponse>(`/api/habits/${habitId}/checkins`, {
        method: "POST",
        body: {
          date: date as IsoDateString,
          status: "skipped",
        } satisfies { date: IsoDateString; status: "skipped" },
      }),
    meta: {
      successMessage: "Habit skipped for today.",
      errorMessage: "Habit skip failed.",
    },
    onSuccess: () => invalidateHabitDate(queryClient, date),
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
    onSuccess: () => invalidateHabitDate(queryClient, date),
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
    onSuccess: () => invalidateHabitDate(queryClient, date),
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
    onSuccess: () => invalidateHabitDate(queryClient, date),
  });
};

export const useCreateHabitMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateHabitRequest) =>
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
  } & UpdateHabitRequest;

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
    }: { habitId: string } & CreateHabitPauseWindowRequest) =>
      apiRequest<HabitMutationResponse>(`/api/habits/${habitId}/pause-windows`, {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Temporary habit pause saved.",
      errorMessage: "Temporary habit pause failed.",
    },
    onSuccess: (_response, variables) => {
      invalidateHabits(queryClient);
      invalidateCoreDataForDates(
        queryClient,
        getInclusiveDateRange(variables.startsOn, variables.endsOn ?? variables.startsOn),
        {
          domains: ["habits", "home", "score", "notifications"],
        },
      );
    },
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
    mutationFn: (payload: CreateRoutineRequest) =>
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
    }: { routineId: string } & UpdateRoutineRequest) =>
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
