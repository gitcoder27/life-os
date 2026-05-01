import type { ApiMeta, EntityId, IsoDateString } from "./common.js";
import type { GoalSummary } from "./goals.js";
import type { RecurrenceDefinition, RecurrenceInput } from "./recurrence.js";

export type HabitStatus = "active" | "paused" | "archived";
export type HabitCheckinStatus = "completed" | "skipped";
export type HabitPauseKind = "rest_day" | "vacation";
export type RoutineStatus = "active" | "archived";
export type HabitRiskLevel = "none" | "at_risk" | "drifting";
export type HabitRiskReason = "streak_at_risk" | "missed_recently" | "low_completion_rate" | null;
export type HabitType = "maintenance" | "growth" | "identity";
export type HabitCheckinLevel = "minimum" | "standard" | "stretch";
export type HabitTimingMode = "anytime" | "anchor" | "exact_time" | "time_window";
export type RoutineTimingMode = "anytime" | "period" | "custom_window";
export type RoutinePeriod = "morning" | "evening";
export type TimingStatusToday =
  | "none"
  | "upcoming"
  | "due_now"
  | "late"
  | "complete_on_time"
  | "complete_late";

export interface HabitScheduleRule {
  daysOfWeek?: number[];
}

export interface HabitItem {
  id: EntityId;
  title: string;
  category: string | null;
  habitType: HabitType;
  scheduleRule: HabitScheduleRule;
  recurrence: RecurrenceDefinition | null;
  goalId: EntityId | null;
  goal: GoalSummary | null;
  targetPerDay: number;
  durationMinutes: number;
  timingMode: HabitTimingMode;
  anchorText: string | null;
  targetTimeMinutes: number | null;
  windowStartMinutes: number | null;
  windowEndMinutes: number | null;
  timingStatusToday: TimingStatusToday;
  timingLabel: string | null;
  minimumVersion: string | null;
  standardVersion: string | null;
  stretchVersion: string | null;
  obstaclePlan: string | null;
  repairRule: string | null;
  identityMeaning: string | null;
  status: HabitStatus;
  dueToday: boolean;
  skippedToday: boolean;
  completedToday: boolean;
  completedCountToday: number;
  achievedLevelToday: HabitCheckinLevel | null;
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
  timingMode: RoutineTimingMode;
  period: RoutinePeriod | null;
  windowStartMinutes: number | null;
  windowEndMinutes: number | null;
  timingStatusToday: TimingStatusToday;
  timingLabel: string | null;
  completedAtToday: string | null;
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
  habitType?: HabitType;
  scheduleRule?: HabitScheduleRule;
  recurrence?: RecurrenceInput;
  goalId?: EntityId | null;
  targetPerDay?: number;
  durationMinutes?: number;
  timingMode?: HabitTimingMode;
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
}

export interface UpdateHabitRequest {
  title?: string;
  category?: string | null;
  habitType?: HabitType;
  scheduleRule?: HabitScheduleRule;
  recurrence?: RecurrenceInput;
  goalId?: EntityId | null;
  targetPerDay?: number;
  durationMinutes?: number;
  timingMode?: HabitTimingMode;
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
  level?: HabitCheckinLevel | null;
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
  timingMode?: RoutineTimingMode;
  period?: RoutinePeriod | null;
  windowStartMinutes?: number | null;
  windowEndMinutes?: number | null;
  items: RoutineItemInput[];
}

export interface UpdateRoutineRequest {
  name?: string;
  sortOrder?: number;
  status?: RoutineStatus;
  timingMode?: RoutineTimingMode;
  period?: RoutinePeriod | null;
  windowStartMinutes?: number | null;
  windowEndMinutes?: number | null;
  items?: RoutineItemInput[];
}

export interface RoutineMutationResponse extends ApiMeta {
  routine: RoutineRecord;
}

export interface RoutineItemCheckinRequest {
  date?: IsoDateString;
}
