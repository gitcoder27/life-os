import type { ApiMeta, EntityId, IsoDateString } from "./common.js";

export type HabitStatus = "active" | "paused" | "archived";
export type HabitCheckinStatus = "completed" | "skipped";
export type RoutinePeriod = "morning" | "evening";
export type RoutineStatus = "active" | "archived";

export interface HabitScheduleRule {
  daysOfWeek?: number[];
}

export interface HabitItem {
  id: EntityId;
  title: string;
  category: string | null;
  scheduleRule: HabitScheduleRule;
  targetPerDay: number;
  status: HabitStatus;
  dueToday: boolean;
  completedToday: boolean;
  streakCount: number;
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
  period: RoutinePeriod;
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
}

export interface RoutinesResponse extends ApiMeta {
  date: IsoDateString;
  routines: RoutineRecord[];
}

export interface CreateHabitRequest {
  title: string;
  category?: string | null;
  scheduleRule?: HabitScheduleRule;
  targetPerDay?: number;
}

export interface UpdateHabitRequest {
  title?: string;
  category?: string | null;
  scheduleRule?: HabitScheduleRule;
  targetPerDay?: number;
  status?: HabitStatus;
}

export interface HabitMutationResponse extends ApiMeta {
  habit: HabitItem;
}

export interface HabitCheckinRequest {
  date?: IsoDateString;
  status?: HabitCheckinStatus;
  note?: string | null;
}

export interface RoutineItemInput {
  title: string;
  sortOrder: number;
  isRequired?: boolean;
}

export interface CreateRoutineRequest {
  name: string;
  period: RoutinePeriod;
  items: RoutineItemInput[];
}

export interface UpdateRoutineRequest {
  name?: string;
  status?: RoutineStatus;
  items?: RoutineItemInput[];
}

export interface RoutineMutationResponse extends ApiMeta {
  routine: RoutineRecord;
}

export interface RoutineItemCheckinRequest {
  date?: IsoDateString;
}
