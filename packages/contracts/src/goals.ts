import type { ApiMeta, EntityId, IsoDateString } from "./common.js";
import type { TaskOriginType } from "./planning.js";

export type GoalDomain = "health" | "money" | "work_growth" | "home_admin" | "discipline" | "other";
export type GoalStatus = "active" | "paused" | "completed" | "archived";
export type GoalHealthState = "on_track" | "drifting" | "stalled" | "achieved";
export type GoalMilestoneStatus = "pending" | "completed";
export type GoalMomentumTrend = "up" | "down" | "steady";

export interface GoalSummary {
  id: EntityId;
  title: string;
  domain: GoalDomain;
  status: GoalStatus;
}

export interface GoalItem {
  id: EntityId;
  title: string;
  domain: GoalDomain;
  status: GoalStatus;
  targetDate: IsoDateString | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoalMilestoneItem {
  id: EntityId;
  goalId: EntityId;
  title: string;
  targetDate: IsoDateString | null;
  status: GoalMilestoneStatus;
  completedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface GoalMilestoneInput {
  id?: EntityId;
  title: string;
  targetDate?: IsoDateString | null;
  status: GoalMilestoneStatus;
}

export interface GoalMilestoneCounts {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
}

export interface GoalMomentumPoint {
  startDate: IsoDateString;
  endDate: IsoDateString;
  completedCount: number;
}

export interface GoalMomentumSummary {
  trend: GoalMomentumTrend;
  buckets: GoalMomentumPoint[];
}

export interface GoalLinkedSummary {
  currentDayPriorities: number;
  currentWeekPriorities: number;
  currentMonthPriorities: number;
  pendingTasks: number;
  activeHabits: number;
  dueHabitsToday: number;
}

export interface GoalOverviewItem extends GoalItem {
  progressPercent: number;
  health: GoalHealthState | null;
  nextBestAction: string | null;
  milestoneCounts: GoalMilestoneCounts;
  momentum: GoalMomentumSummary;
  linkedSummary: GoalLinkedSummary;
  lastActivityAt: string | null;
}

export interface GoalLinkedPriorityItem {
  id: EntityId;
  slot: 1 | 2 | 3;
  title: string;
  status: "pending" | "completed" | "dropped";
  completedAt: string | null;
  cycleType: "day" | "week" | "month";
  cycleStartDate: IsoDateString;
  cycleEndDate: IsoDateString;
}

export interface GoalLinkedTaskItem {
  id: EntityId;
  title: string;
  notes: string | null;
  status: "pending" | "completed" | "dropped";
  scheduledForDate: IsoDateString | null;
  dueAt: string | null;
  originType: TaskOriginType;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoalLinkedHabitItem {
  id: EntityId;
  title: string;
  category: string | null;
  status: "active" | "paused" | "archived";
  targetPerDay: number;
  dueToday: boolean;
  completedToday: boolean;
  streakCount: number;
  completionRate7d: number;
  riskLevel: "none" | "at_risk" | "drifting";
  riskMessage: string | null;
}

export interface GoalDetailItem extends GoalOverviewItem {
  milestones: GoalMilestoneItem[];
  linkedPriorities: GoalLinkedPriorityItem[];
  linkedTasks: GoalLinkedTaskItem[];
  linkedHabits: GoalLinkedHabitItem[];
}

export interface GoalsResponse extends ApiMeta {
  contextDate: IsoDateString;
  goals: GoalOverviewItem[];
}

export interface GoalsQuery {
  domain?: GoalDomain;
  status?: GoalStatus;
  date?: IsoDateString;
}

export interface CreateGoalRequest {
  title: string;
  domain: GoalDomain;
  targetDate?: IsoDateString | null;
  notes?: string | null;
}

export interface UpdateGoalRequest {
  title?: string;
  domain?: GoalDomain;
  status?: GoalStatus;
  targetDate?: IsoDateString | null;
  notes?: string | null;
}

export interface GoalDetailResponse extends ApiMeta {
  contextDate: IsoDateString;
  goal: GoalDetailItem;
}

export interface GoalMutationResponse extends ApiMeta {
  goal: GoalItem;
}

export interface UpdateGoalMilestonesRequest {
  milestones: GoalMilestoneInput[];
}

export interface GoalMilestonesMutationResponse extends ApiMeta {
  milestones: GoalMilestoneItem[];
}
