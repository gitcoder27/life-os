import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  apiRequest,
  invalidateCoreData,
  queryKeys,
} from "./core";
import type { LinkedGoal } from "./goals";

export type FocusSessionSuggestedAdjustment =
  | "keep_current_setup"
  | "shorten_session"
  | "clarify_next_action";

export type FocusSessionHistoryItem = {
  id: string;
  depth: FocusSessionDepth;
  plannedMinutes: number;
  actualMinutes: number | null;
  status: FocusSessionStatus;
  exitReason: FocusSessionExitReason | null;
  endedAt: string | null;
};

export type FocusTaskInsight = {
  taskId: string;
  totalSessions: number;
  completedSessions: number;
  abortedSessions: number;
  averagePlannedMinutes: number | null;
  averageActualMinutes: number | null;
  mostCommonExitReason: FocusSessionExitReason | null;
  recommendedPlannedMinutes: number | null;
  suggestedAdjustment: FocusSessionSuggestedAdjustment;
  summaryMessage: string;
  recentSessions: FocusSessionHistoryItem[];
};

type FocusTaskInsightResponse = {
  generatedAt: string;
  insight: FocusTaskInsight;
};

export type FocusSessionDepth = "deep" | "shallow";
export type FocusSessionStatus = "active" | "completed" | "aborted";
export type FocusSessionExitReason =
  | "interrupted"
  | "low_energy"
  | "unclear"
  | "switched_context"
  | "done_enough";
export type FocusSessionTaskOutcome = "started" | "advanced" | "completed";

export type FocusSessionTaskSummary = {
  id: string;
  title: string;
  nextAction: string | null;
  status: "pending" | "completed" | "dropped";
  progressState: "not_started" | "started" | "advanced";
  goalId: string | null;
  goal: LinkedGoal | null;
  focusLengthMinutes: number | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type FocusSessionItem = {
  id: string;
  taskId: string;
  task: FocusSessionTaskSummary;
  depth: FocusSessionDepth;
  plannedMinutes: number;
  actualMinutes: number | null;
  startedAt: string;
  endedAt: string | null;
  status: FocusSessionStatus;
  exitReason: FocusSessionExitReason | null;
  distractionNotes: string | null;
  completionNote: string | null;
  createdAt: string;
  updatedAt: string;
};

type ActiveFocusSessionResponse = {
  generatedAt: string;
  session: FocusSessionItem | null;
};

type FocusSessionMutationResponse = {
  generatedAt: string;
  session: FocusSessionItem;
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
        },
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
        body: { note },
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
        },
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
        },
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
