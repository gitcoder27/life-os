import type { ApiMeta, EntityId, IsoDateString } from "./common.js";
import type {
  MonthPlanResponse,
  PlanningPriorityItem,
  PlanningTaskItem,
  TaskKind,
  TaskOriginType,
  WeekPlanResponse,
} from "./planning.js";

export type GoalDomain = string;
export type GoalDomainSystemKey =
  | "health"
  | "money"
  | "work_growth"
  | "home_admin"
  | "discipline"
  | "other";
export type GoalHorizonSystemKey = "life_vision" | "five_year" | "one_year" | "quarter" | "month";
export type GoalStatus = "active" | "paused" | "completed" | "archived";
export type GoalHealthState = "on_track" | "drifting" | "stalled" | "achieved";
export type GoalMilestoneStatus = "pending" | "completed";
export type GoalMomentumTrend = "up" | "down" | "steady";

export interface GoalDomainItem {
  id: EntityId;
  systemKey: GoalDomainSystemKey | null;
  name: string;
  sortOrder: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GoalDomainInput {
  id?: EntityId;
  systemKey?: GoalDomainSystemKey | null;
  name: string;
  isArchived?: boolean;
}

export interface GoalHorizonItem {
  id: EntityId;
  systemKey: GoalHorizonSystemKey | null;
  name: string;
  sortOrder: number;
  spanMonths: number | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GoalHorizonInput {
  id?: EntityId;
  systemKey?: GoalHorizonSystemKey | null;
  name: string;
  spanMonths?: number | null;
  isArchived?: boolean;
}

export interface GoalSummary {
  id: EntityId;
  title: string;
  domainId: EntityId;
  domain: GoalDomain;
  domainSystemKey: GoalDomainSystemKey | null;
  status: GoalStatus;
}

export interface GoalItem extends GoalSummary {
  horizonId: EntityId | null;
  horizonName: string | null;
  horizonSystemKey: GoalHorizonSystemKey | null;
  horizonSpanMonths: number | null;
  parentGoalId: EntityId | null;
  why: string | null;
  targetDate: IsoDateString | null;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface GoalHierarchySummary extends GoalSummary {
  horizonId: EntityId | null;
  horizonName: string | null;
  horizonSystemKey: GoalHorizonSystemKey | null;
  parentGoalId: EntityId | null;
  sortOrder: number;
  targetDate: IsoDateString | null;
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
  kind: TaskKind;
  reminderAt: string | null;
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
  completedCountToday: number;
  streakCount: number;
  completionRate7d: number;
  riskLevel: "none" | "at_risk" | "drifting";
  riskMessage: string | null;
}

export interface GoalDetailItem extends GoalOverviewItem {
  milestones: GoalMilestoneItem[];
  parent: GoalHierarchySummary | null;
  children: GoalHierarchySummary[];
  ancestors: GoalHierarchySummary[];
  linkedPriorities: GoalLinkedPriorityItem[];
  currentWeekPriorities: GoalLinkedPriorityItem[];
  currentMonthOutcomes: GoalLinkedPriorityItem[];
  linkedTasks: GoalLinkedTaskItem[];
  linkedHabits: GoalLinkedHabitItem[];
}

export interface GoalsWorkspaceTodayAlignment {
  date: IsoDateString;
  priorities: PlanningPriorityItem[];
  tasks: PlanningTaskItem[];
  representedGoalIds: EntityId[];
}

export interface GoalsResponse extends ApiMeta {
  contextDate: IsoDateString;
  goals: GoalOverviewItem[];
}

export interface GoalsConfigResponse extends ApiMeta {
  domains: GoalDomainItem[];
  horizons: GoalHorizonItem[];
}

export interface GoalsWorkspaceResponse extends ApiMeta {
  contextDate: IsoDateString;
  domains: GoalDomainItem[];
  horizons: GoalHorizonItem[];
  goals: GoalOverviewItem[];
  weekPlan: WeekPlanResponse;
  monthPlan: MonthPlanResponse;
  todayAlignment: GoalsWorkspaceTodayAlignment;
}

export interface GoalsQuery {
  domainId?: EntityId;
  horizonId?: EntityId;
  status?: GoalStatus;
  date?: IsoDateString;
}

export interface CreateGoalRequest {
  title: string;
  domainId: EntityId;
  horizonId?: EntityId | null;
  parentGoalId?: EntityId | null;
  why?: string | null;
  targetDate?: IsoDateString | null;
  notes?: string | null;
  sortOrder?: number;
}

export interface UpdateGoalRequest {
  title?: string;
  domainId?: EntityId;
  horizonId?: EntityId | null;
  parentGoalId?: EntityId | null;
  why?: string | null;
  status?: GoalStatus;
  targetDate?: IsoDateString | null;
  notes?: string | null;
  sortOrder?: number;
}

export interface UpdateGoalDomainsRequest {
  domains: GoalDomainInput[];
}

export interface UpdateGoalHorizonsRequest {
  horizons: GoalHorizonInput[];
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
