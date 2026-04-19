import type { ApiMeta, EntityId } from "./common.js";
import type { GoalSummary } from "./goals.js";
import type { TaskProgressState, TaskStatus } from "./planning.js";

export type FocusSessionDepth = "deep" | "shallow";
export type FocusSessionStatus = "active" | "completed" | "aborted";
export type FocusSessionExitReason =
  | "interrupted"
  | "low_energy"
  | "unclear"
  | "switched_context"
  | "done_enough";
export type FocusSessionTaskOutcome = "started" | "advanced" | "completed";

export interface FocusSessionTaskSummary {
  id: EntityId;
  title: string;
  nextAction: string | null;
  status: TaskStatus;
  progressState: TaskProgressState;
  goalId: EntityId | null;
  goal: GoalSummary | null;
  focusLengthMinutes: number | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface FocusSessionItem {
  id: EntityId;
  taskId: EntityId;
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
}

export interface ActiveFocusSessionResponse extends ApiMeta {
  session: FocusSessionItem | null;
}

export interface FocusSessionMutationResponse extends ApiMeta {
  session: FocusSessionItem;
}

export type FocusSessionSuggestedAdjustment =
  | "keep_current_setup"
  | "shorten_session"
  | "clarify_next_action";

export interface FocusSessionHistoryItem {
  id: EntityId;
  depth: FocusSessionDepth;
  plannedMinutes: number;
  actualMinutes: number | null;
  status: FocusSessionStatus;
  exitReason: FocusSessionExitReason | null;
  endedAt: string | null;
}

export interface FocusTaskInsight {
  taskId: EntityId;
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
}

export interface FocusTaskInsightResponse extends ApiMeta {
  insight: FocusTaskInsight;
}

export interface CreateFocusSessionRequest {
  taskId: EntityId;
  depth?: FocusSessionDepth;
  plannedMinutes: number;
}

export interface CaptureFocusDistractionRequest {
  note: string;
}

export interface CompleteFocusSessionRequest {
  taskOutcome: FocusSessionTaskOutcome;
  completionNote?: string | null;
}

export interface AbortFocusSessionRequest {
  exitReason: FocusSessionExitReason;
  note?: string | null;
}
