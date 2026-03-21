import type { ApiMeta, EntityId, IsoDateString } from "./common.js";
import type { GoalSummary } from "./goals.js";
import type { RecurrenceDefinition, RecurrenceInput, RecurringTaskCarryPolicy } from "./recurrence.js";

export type PriorityStatus = "pending" | "completed" | "dropped";
export type TaskStatus = "pending" | "completed" | "dropped";
export type TaskOriginType = "manual" | "quick_capture" | "carry_forward" | "review_seed" | "recurring";

export interface PlanningPriorityItem {
  id: EntityId;
  slot: 1 | 2 | 3;
  title: string;
  status: PriorityStatus;
  goalId: EntityId | null;
  goal: GoalSummary | null;
  completedAt: string | null;
}

export interface PlanningPriorityInput {
  id?: EntityId;
  slot: 1 | 2 | 3;
  title: string;
  goalId?: EntityId | null;
}

export interface PlanningTaskItem {
  id: EntityId;
  title: string;
  notes: string | null;
  status: TaskStatus;
  scheduledForDate: IsoDateString | null;
  dueAt: string | null;
  goalId: EntityId | null;
  goal: GoalSummary | null;
  originType: TaskOriginType;
  carriedFromTaskId: EntityId | null;
  recurrence: RecurrenceDefinition | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DayPlanResponse extends ApiMeta {
  date: IsoDateString;
  priorities: PlanningPriorityItem[];
  tasks: PlanningTaskItem[];
}

export interface WeekPlanResponse extends ApiMeta {
  startDate: IsoDateString;
  endDate: IsoDateString;
  priorities: PlanningPriorityItem[];
}

export interface MonthPlanResponse extends ApiMeta {
  startDate: IsoDateString;
  endDate: IsoDateString;
  theme: string | null;
  topOutcomes: PlanningPriorityItem[];
}

export interface UpdateDayPrioritiesRequest {
  priorities: PlanningPriorityInput[];
}

export interface UpdateWeekPrioritiesRequest {
  priorities: PlanningPriorityInput[];
}

export interface UpdateMonthFocusRequest {
  theme: string | null;
  topOutcomes: PlanningPriorityInput[];
}

export interface PlanningPriorityMutationResponse extends ApiMeta {
  priorities: PlanningPriorityItem[];
}

export interface UpdatePriorityRequest {
  title?: string;
  status?: PriorityStatus;
}

export interface PriorityMutationResponse extends ApiMeta {
  priority: PlanningPriorityItem;
}

export interface MonthFocusMutationResponse extends ApiMeta {
  theme: string | null;
  topOutcomes: PlanningPriorityItem[];
}

export interface CreateTaskRequest {
  title: string;
  notes?: string | null;
  scheduledForDate?: IsoDateString | null;
  dueAt?: string | null;
  goalId?: EntityId | null;
  originType?: TaskOriginType;
  recurrence?: RecurrenceInput;
  carryPolicy?: RecurringTaskCarryPolicy;
}

export interface UpdateTaskRequest {
  title?: string;
  notes?: string | null;
  status?: TaskStatus;
  scheduledForDate?: IsoDateString | null;
  dueAt?: string | null;
  goalId?: EntityId | null;
  recurrence?: RecurrenceInput;
  carryPolicy?: RecurringTaskCarryPolicy | null;
}

export interface CarryForwardTaskRequest {
  targetDate: IsoDateString;
}

export interface TaskMutationResponse extends ApiMeta {
  task: PlanningTaskItem;
}

export interface TasksResponse extends ApiMeta {
  tasks: PlanningTaskItem[];
}
