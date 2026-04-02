import type { ApiMeta, EntityId, IsoDateString } from "./common.js";
import type { GoalSummary } from "./goals.js";
import type { RecurrenceDefinition, RecurrenceInput } from "./recurrence.js";

export type HabitStatus = "active" | "paused" | "archived";
export type HabitCheckinStatus = "completed" | "skipped";
export type HabitPauseKind = "rest_day" | "vacation";
export type RoutineStatus = "active" | "archived";
export type HabitRiskLevel = "none" | "at_risk" | "drifting";
export type HabitRiskReason = "streak_at_risk" | "missed_recently" | "low_completion_rate" | null;

export interface HabitScheduleRule {
  daysOfWeek?: number[];
}

export interface HabitItem {
  id: EntityId;
  title: string;
  category: string | null;
  scheduleRule: HabitScheduleRule;
  recurrence: RecurrenceDefinition | null;
  goalId: EntityId | null;
  goal: GoalSummary | null;
  targetPerDay: number;
  status: HabitStatus;
  dueToday: boolean;
  completedToday: boolean;
  completedCountToday: number;
  streakCount: number;
  risk: HabitRiskState;
  pauseWindows: HabitPauseWindow[];
}

export interface HabitPauseWindow {
  id: EntityId;
  kind: HabitPauseKind;
  startsOn: IsoDateString;
  endsOn: IsoDateString;
  note: string | null;
  isActiveToday: boolean;
}

export interface HabitRiskState {
  level: HabitRiskLevel;
  reason: HabitRiskReason;
  message: string | null;
  dueCount7d: number;
  completedCount7d: number;
  completionRate7d: number;
}

export interface WeeklyHabitChallenge {
  habitId: EntityId;
  title: string;
  streakCount: number;
  completedToday: boolean;
  weekCompletions: number;
  weekTarget: number;
  status: "on_track" | "due_today" | "behind";
  message: string;
}

export interface RoutineItemState {
  id: EntityId;
  title: string;
  sortOrder: number;
  isRequired: boolean;
  completedToday: boolean;
}

export interface RoutineRecord {
  id: EntityId;
  name: string;
  sortOrder: number;
  status: RoutineStatus;
  completedItems: number;
  totalItems: number;
  items: RoutineItemState[];
}

export interface HabitsResponse extends ApiMeta {
  date: IsoDateString;
  habits: HabitItem[];
  dueHabits: HabitItem[];
  routines: RoutineRecord[];
  weeklyChallenge: WeeklyHabitChallenge | null;
}

export interface RoutinesResponse extends ApiMeta {
  date: IsoDateString;
  routines: RoutineRecord[];
}

export interface CreateHabitRequest {
  title: string;
  category?: string | null;
  scheduleRule?: HabitScheduleRule;
  recurrence?: RecurrenceInput;
  goalId?: EntityId | null;
  targetPerDay?: number;
}

export interface UpdateHabitRequest {
  title?: string;
  category?: string | null;
  scheduleRule?: HabitScheduleRule;
  recurrence?: RecurrenceInput;
  goalId?: EntityId | null;
  targetPerDay?: number;
  status?: HabitStatus;
}

export interface HabitMutationResponse extends ApiMeta {
  habit: HabitItem;
}

export interface CreateHabitPauseWindowRequest {
  kind: HabitPauseKind;
  startsOn: IsoDateString;
  endsOn?: IsoDateString;
  note?: string | null;
}

export interface HabitCheckinRequest {
  date?: IsoDateString;
  status?: HabitCheckinStatus;
  note?: string | null;
}

export interface RoutineItemInput {
  id?: EntityId;
  title: string;
  sortOrder: number;
  isRequired?: boolean;
}

export interface CreateRoutineRequest {
  name: string;
  items: RoutineItemInput[];
}

export interface UpdateRoutineRequest {
  name?: string;
  sortOrder?: number;
  status?: RoutineStatus;
  items?: RoutineItemInput[];
}

export interface RoutineMutationResponse extends ApiMeta {
  routine: RoutineRecord;
}

export interface RoutineItemCheckinRequest {
  date?: IsoDateString;
}
