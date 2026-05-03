import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  AbortFocusSessionRequest,
  ActiveFocusSessionResponse,
  CaptureFocusDistractionRequest,
  CompleteFocusSessionRequest,
  CreateFocusSessionRequest,
  FocusSessionDepth,
  FocusSessionExitReason,
  FocusSessionHistoryItem,
  FocusSessionItem,
  FocusSessionMutationResponse,
  FocusSessionStatus,
  FocusSessionSuggestedAdjustment,
  FocusSessionTaskOutcome,
  FocusTaskInsight,
  FocusTaskInsightResponse,
} from "@life-os/contracts";

import {
  apiRequest,
  invalidateCoreData,
  queryKeys,
} from "./core";

export type {
  FocusSessionDepth,
  FocusSessionExitReason,
  FocusSessionHistoryItem,
  FocusSessionItem,
  FocusSessionStatus,
  FocusSessionSuggestedAdjustment,
  FocusSessionTaskOutcome,
  FocusTaskInsight,
};

export const useActiveFocusSessionQuery = () =>
  useQuery({
    queryKey: queryKeys.focusActive,
    queryFn: () => apiRequest<ActiveFocusSessionResponse>("/api/focus/active"),
    retry: false,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  });

const focusTaskInsightQueryKey = (taskId: string) =>
  ["focus", "task-insight", taskId] as const;

export const useFocusTaskInsightQuery = (
  taskId: string | null,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: focusTaskInsightQueryKey(taskId ?? ""),
    queryFn: () =>
      apiRequest<FocusTaskInsightResponse>(`/api/focus/tasks/${taskId}/insights`),
    enabled: Boolean(taskId) && options?.enabled !== false,
    retry: false,
    staleTime: 60_000,
  });

export const useStartFocusSessionMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      depth,
      plannedMinutes,
    }: {
      taskId: string;
      depth?: FocusSessionDepth;
      plannedMinutes: number;
    }) =>
      apiRequest<FocusSessionMutationResponse>("/api/focus/sessions", {
        method: "POST",
        body: {
          taskId,
          depth,
          plannedMinutes,
        } satisfies CreateFocusSessionRequest,
      }),
    meta: {
      successMessage: "Focus session started.",
      errorMessage: "Could not start focus session.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
};

export const useCaptureFocusDistractionMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, note }: { sessionId: string; note: string }) =>
      apiRequest<FocusSessionMutationResponse>(`/api/focus/sessions/${sessionId}/distraction`, {
        method: "POST",
        body: { note } satisfies CaptureFocusDistractionRequest,
      }),
    meta: {
      successMessage: "Distraction saved.",
      errorMessage: "Could not save distraction.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
};

export const useCompleteFocusSessionMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sessionId,
      taskOutcome,
      completionNote,
    }: {
      sessionId: string;
      taskOutcome: FocusSessionTaskOutcome;
      completionNote?: string | null;
    }) =>
      apiRequest<FocusSessionMutationResponse>(`/api/focus/sessions/${sessionId}/complete`, {
        method: "POST",
        body: {
          taskOutcome,
          completionNote,
        } satisfies CompleteFocusSessionRequest,
      }),
    meta: {
      successMessage: "Focus session completed.",
      errorMessage: "Could not complete focus session.",
    },
    onSuccess: (data) => {
      invalidateCoreData(queryClient, date);
      void queryClient.invalidateQueries({
        queryKey: focusTaskInsightQueryKey(data.session.taskId),
      });
    },
  });
};

export const useAbortFocusSessionMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sessionId,
      exitReason,
      note,
    }: {
      sessionId: string;
      exitReason: FocusSessionExitReason;
      note?: string | null;
    }) =>
      apiRequest<FocusSessionMutationResponse>(`/api/focus/sessions/${sessionId}/abort`, {
        method: "POST",
        body: {
          exitReason,
          note,
        } satisfies AbortFocusSessionRequest,
      }),
    meta: {
      successMessage: "Focus session ended.",
      errorMessage: "Could not end focus session.",
    },
    onSuccess: (data) => {
      invalidateCoreData(queryClient, date);
      void queryClient.invalidateQueries({
        queryKey: focusTaskInsightQueryKey(data.session.taskId),
      });
    },
  });
};
