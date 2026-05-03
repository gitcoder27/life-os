import type { ApiMeta, EntityId, IsoDateString } from "./common.js";
import type { GoalHealthState, GoalSummary } from "./goals.js";
import type { RecurrenceDefinition, RecurrenceInput, RecurringTaskCarryPolicy } from "./recurrence.js";

export type PriorityStatus = "pending" | "completed" | "dropped";
export type TaskStatus = "pending" | "completed" | "dropped";
export type TaskProgressState = "not_started" | "started" | "advanced";
export type TaskKind = "task" | "note" | "reminder";
export type TaskOriginType =
  | "manual"
  | "quick_capture"
  | "carry_forward"
  | "review_seed"
  | "recurring"
  | "template"
  | "meal_plan";
export type TaskScheduledState = "all" | "scheduled" | "unscheduled";
export type TaskListSort = "newest" | "oldest";
export type TaskStuckReason =
  | "unclear"
  | "too_big"
  | "avoidance"
  | "low_energy"
  | "interrupted"
  | "overloaded";
export type TaskStuckAction = "clarify" | "shrink" | "downgrade" | "reschedule" | "recover";
export type DayMode = "normal" | "rescue" | "recovery";
export type RescueReason = "overload" | "low_energy" | "interruption" | "missed_day";
export type TaskCommitmentReadiness = "ready" | "needs_clarification";
export type TaskCommitmentReason =
  | "missing_next_action"
  | "missing_five_minute_version"
  | "missing_estimate"
  | "missing_obstacle"
  | "missing_focus_length";

export interface TaskCommitmentGuidance {
  readiness: TaskCommitmentReadiness;
  blockingReasons: TaskCommitmentReason[];
  suggestedReasons: TaskCommitmentReason[];
  primaryMessage: string;
}
export type WeeklyCapacityMode = "light" | "standard" | "heavy";
export type WeeklyCapacitySignal =
  | "too_many_priorities"
  | "too_many_estimated_minutes"
  | "too_many_unsized_tasks"
  | "too_many_focus_goals"
  | "deep_work_target_too_high";
export type WeeklyCapacityAssessmentStatus = "healthy" | "tight" | "overloaded";
export type WeeklyCapacityProgressStatus = "within_budget" | "at_budget" | "over_budget";

export interface RescueSuggestion {
  mode: Exclude<DayMode, "normal">;
  reason: RescueReason;
  title: string;
  detail: string;
  minimumViableAction: string | null;
}

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
  kind: TaskKind;
  reminderAt: string | null;
  status: TaskStatus;
  scheduledForDate: IsoDateString | null;
  dueAt: string | null;
  goalId: EntityId | null;
  goal: GoalSummary | null;
  originType: TaskOriginType;
  carriedFromTaskId: EntityId | null;
  recurrence: RecurrenceDefinition | null;
  nextAction: string | null;
  fiveMinuteVersion: string | null;
  estimatedDurationMinutes: number | null;
  likelyObstacle: string | null;
  focusLengthMinutes: number | null;
  progressState: TaskProgressState;
  todaySortOrder: number;
  startedAt: string | null;
  lastStuckAt: string | null;
  commitmentGuidance?: TaskCommitmentGuidance | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DailyLaunchItem {
  id: EntityId;
  planningCycleId: EntityId;
  mustWinTaskId: EntityId | null;
  dayMode: DayMode;
  rescueReason: RescueReason | null;
  energyRating: number | null;
  likelyDerailmentReason: TaskStuckReason | null;
  likelyDerailmentNote: string | null;
  rescueSuggestedAt: string | null;
  rescueActivatedAt: string | null;
  rescueExitedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoalNudgeItem {
  goal: GoalSummary;
  health: GoalHealthState;
  progressPercent: number;
  nextBestAction: string;
  suggestedPriorityTitle: string;
}

export interface DayPlannerBlockTaskItem {
  taskId: EntityId;
  sortOrder: number;
  task: PlanningTaskItem;
}

export interface DayPlannerBlockItem {
  id: EntityId;
  title: string | null;
  startsAt: string;
  endsAt: string;
  sortOrder: number;
  tasks: DayPlannerBlockTaskItem[];
  createdAt: string;
  updatedAt: string;
}

export interface DayPlanResponse extends ApiMeta {
  date: IsoDateString;
  launch: DailyLaunchItem | null;
  mustWinTask: PlanningTaskItem | null;
  rescueSuggestion: RescueSuggestion | null;
  priorities: PlanningPriorityItem[];
  tasks: PlanningTaskItem[];
  goalNudges: GoalNudgeItem[];
  plannerBlocks: DayPlannerBlockItem[];
}

export type AdaptiveNextMoveState =
  | "continue_focus"
  | "start_must_win"
  | "clarify_must_win"
  | "work_current_block"
  | "recover_drift"
  | "shape_day"
  | "size_tasks"
  | "reduce_day"
  | "close_day"
  | "review_ready"
  | "empty";

export type AdaptiveNextMoveActionType =
  | "open_focus"
  | "start_task"
  | "clarify_task"
  | "shape_day"
  | "recover_drift"
  | "reduce_day"
  | "close_day"
  | "open_review"
  | "add_task";

export interface AdaptiveNextMoveAction {
  type: AdaptiveNextMoveActionType;
  label: string;
  targetId?: EntityId | null;
}

export interface AdaptiveNextMove {
  state: AdaptiveNextMoveState;
  title: string;
  reason: string;
  primaryAction: AdaptiveNextMoveAction;
  secondaryAction?: AdaptiveNextMoveAction | null;
  taskId?: EntityId | null;
  plannerBlockId?: EntityId | null;
  severity: "neutral" | "helpful" | "attention" | "urgent";
}

export type DayCapacityStatus = "clear" | "tight" | "overloaded" | "unclear" | "drifting";
export type DayCapacitySignal =
  | "no_planner_blocks"
  | "unplanned_tasks"
  | "unsized_tasks"
  | "over_capacity"
  | "slipped_work"
  | "current_block_at_risk"
  | "rescue_mode"
  | "must_win_unclear";

export interface DayCapacityBlockAssessment {
  plannerBlockId: EntityId;
  title: string | null;
  status: Exclude<DayCapacityStatus, "unclear">;
  pendingTaskCount: number;
  estimatedMinutes: number;
  capacityMinutes: number;
  overByMinutes: number;
}

export interface DayCapacityAssessment {
  status: DayCapacityStatus;
  summary: string;
  pendingTaskCount: number;
  plannedTaskCount: number;
  unplannedTaskCount: number;
  unsizedTaskCount: number;
  estimatedTaskMinutes: number;
  plannedBlockMinutes: number;
  overByMinutes: number;
  slippedTaskCount: number;
  currentBlockId?: EntityId | null;
  nextBlockId?: EntityId | null;
  needsEstimateTaskIds: EntityId[];
  signals: DayCapacitySignal[];
  blocks: DayCapacityBlockAssessment[];
}

export interface AdaptiveTodayGuidanceResponse extends ApiMeta {
  date: IsoDateString;
  nextMove: AdaptiveNextMove;
  capacity: DayCapacityAssessment;
}

export interface DayCapacityAssessmentResponse extends ApiMeta {
  date: IsoDateString;
  capacity: DayCapacityAssessment;
}

export interface ShapeDayPreviewRequest {
  preserveExistingBlocks?: boolean;
}

export type ShapeDayUnplacedReason =
  | "needs_estimate"
  | "no_open_window"
  | "already_planned"
  | "not_actionable";

export interface ShapeDayTaskPreviewItem {
  taskId: EntityId;
  title: string;
  estimatedMinutes: number;
  assumedMinutes: boolean;
}

export interface ShapeDayProposedBlock {
  tempId: string;
  title: string | null;
  startsAt: string;
  endsAt: string;
  taskIds: EntityId[];
  tasks: ShapeDayTaskPreviewItem[];
}

export interface ShapeDayPreviewAssignment {
  taskId: EntityId;
  taskTitle: string;
  blockTempId: string;
  startsAt: string;
  endsAt: string;
  estimatedMinutes: number;
  assumedMinutes: boolean;
}

export interface ShapeDayUnplacedTask {
  taskId: EntityId;
  title: string;
  reason: ShapeDayUnplacedReason;
  estimatedMinutes?: number | null;
}

export interface ShapeDayExistingBlockSummary {
  plannerBlockId: EntityId;
  title: string | null;
  startsAt: string;
  endsAt: string;
  taskCount: number;
}

export interface ShapeDayPreviewResponse extends ApiMeta {
  date: IsoDateString;
  summary: string;
  capacity: DayCapacityAssessment;
  proposedBlocks: ShapeDayProposedBlock[];
  proposedAssignments: ShapeDayPreviewAssignment[];
  needsEstimateTasks: ShapeDayTaskPreviewItem[];
  unplacedTasks: ShapeDayUnplacedTask[];
  preservedBlocks: ShapeDayExistingBlockSummary[];
}

export interface ApplyShapeDayRequest {
  proposedBlocks: ShapeDayProposedBlock[];
}

export interface ShapeDayApplyResponse extends ApiMeta {
  date: IsoDateString;
  summary: string;
  plannerBlocks: DayPlannerBlockItem[];
  capacity: DayCapacityAssessment;
}

export type DriftRecoveryAction =
  | "move_to_current_block"
  | "move_to_next_block"
  | "unplan"
  | "carry_forward_tomorrow"
  | "shrink_to_five_minutes"
  | "activate_reduced_day";

export interface DriftRecoveryRequest {
  mode: "preview" | "apply";
  action: DriftRecoveryAction;
  taskIds?: EntityId[];
  targetBlockId?: EntityId | null;
}

export interface DriftRecoveryChangePreview {
  taskId: EntityId;
  title: string;
  from: string;
  to: string;
}

export interface DriftRecoveryResponse extends ApiMeta {
  date: IsoDateString;
  action: DriftRecoveryAction;
  mode: "preview" | "apply";
  summary: string;
  affectedTaskIds: EntityId[];
  changes: DriftRecoveryChangePreview[];
  plannerBlocks?: DayPlannerBlockItem[];
  capacity?: DayCapacityAssessment;
}

export interface WeeklyCapacityProfile {
  capacityMode: WeeklyCapacityMode;
  deepWorkBlockTarget: number;
}

export interface WeeklyCapacityAssessment {
  status: WeeklyCapacityAssessmentStatus;
  plannedPriorityCount: number;
  scheduledTaskCount: number;
  estimatedMinutesTotal: number;
  unsizedTaskCount: number;
  focusGoalCount: number;
  primaryMessage: string;
  signals: WeeklyCapacitySignal[];
}

export interface WeeklyCapacityProgress {
  completedDeepBlocks: number;
  remainingDeepBlocks: number;
  overBudgetBlocks: number;
  status: WeeklyCapacityProgressStatus;
  message: string;
}

export interface WeekPlanResponse extends ApiMeta {
  startDate: IsoDateString;
  endDate: IsoDateString;
  priorities: PlanningPriorityItem[];
  capacityProfile: WeeklyCapacityProfile;
  capacityAssessment: WeeklyCapacityAssessment;
  capacityProgress: WeeklyCapacityProgress;
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

export interface UpdateWeekCapacityRequest {
  capacityMode: WeeklyCapacityMode;
  deepWorkBlockTarget?: number | null;
}

export interface UpdateMonthFocusRequest {
  theme: string | null;
  topOutcomes: PlanningPriorityInput[];
}

export interface PlanningPriorityMutationResponse extends ApiMeta {
  priorities: PlanningPriorityItem[];
}

export interface WeekCapacityMutationResponse extends ApiMeta {
  capacityProfile: WeeklyCapacityProfile;
  capacityAssessment: WeeklyCapacityAssessment;
  capacityProgress: WeeklyCapacityProgress;
}

export interface DayPlannerBlockMutationResponse extends ApiMeta {
  plannerBlock: DayPlannerBlockItem;
}

export interface DayPlannerBlocksMutationResponse extends ApiMeta {
  plannerBlocks: DayPlannerBlockItem[];
}

export interface UpdatePriorityRequest {
  title?: string;
  status?: PriorityStatus;
}

export interface PriorityMutationResponse extends ApiMeta {
  priority: PlanningPriorityItem;
}

export interface CreateDayPlannerBlockRequest {
  title?: string | null;
  startsAt: string;
  endsAt: string;
  taskIds?: EntityId[];
}

export interface UpdateDayPlannerBlockRequest {
  title?: string | null;
  startsAt?: string;
  endsAt?: string;
}

export interface ReplaceDayPlannerBlockTasksRequest {
  taskIds: EntityId[];
}

export interface ReorderDayPlannerBlocksRequest {
  blockIds: EntityId[];
}

export interface MonthFocusMutationResponse extends ApiMeta {
  theme: string | null;
  topOutcomes: PlanningPriorityItem[];
}

export interface CreateTaskRequest {
  title: string;
  notes?: string | null;
  kind?: TaskKind;
  reminderAt?: string | null;
  scheduledForDate?: IsoDateString | null;
  dueAt?: string | null;
  goalId?: EntityId | null;
  originType?: TaskOriginType;
  recurrence?: RecurrenceInput;
  carryPolicy?: RecurringTaskCarryPolicy;
  nextAction?: string | null;
  fiveMinuteVersion?: string | null;
  estimatedDurationMinutes?: number | null;
  likelyObstacle?: string | null;
  focusLengthMinutes?: number | null;
  progressState?: TaskProgressState;
  startedAt?: string | null;
}

export interface UpdateTaskRequest {
  title?: string;
  notes?: string | null;
  kind?: TaskKind;
  reminderAt?: string | null;
  status?: TaskStatus;
  scheduledForDate?: IsoDateString | null;
  dueAt?: string | null;
  goalId?: EntityId | null;
  recurrence?: RecurrenceInput;
  carryPolicy?: RecurringTaskCarryPolicy | null;
  nextAction?: string | null;
  fiveMinuteVersion?: string | null;
  estimatedDurationMinutes?: number | null;
  likelyObstacle?: string | null;
  focusLengthMinutes?: number | null;
  progressState?: TaskProgressState;
  startedAt?: string | null;
}

export interface CommitTaskRequest {
  scheduledForDate: IsoDateString;
  nextAction?: string | null;
  fiveMinuteVersion?: string | null;
  estimatedDurationMinutes?: number | null;
  likelyObstacle?: string | null;
  focusLengthMinutes?: number | null;
}

export interface UpsertDayLaunchRequest {
  mustWinTaskId?: EntityId | null;
  dayMode?: DayMode;
  rescueReason?: RescueReason | null;
  energyRating?: number | null;
  likelyDerailmentReason?: TaskStuckReason | null;
  likelyDerailmentNote?: string | null;
}

export interface DayLaunchResponse extends ApiMeta {
  date: IsoDateString;
  launch: DailyLaunchItem | null;
  mustWinTask: PlanningTaskItem | null;
  rescueSuggestion: RescueSuggestion | null;
}

export interface DayLaunchMutationResponse extends ApiMeta {
  launch: DailyLaunchItem;
  mustWinTask: PlanningTaskItem | null;
  rescueSuggestion: RescueSuggestion | null;
}

export interface LogTaskStuckRequest {
  reason: TaskStuckReason;
  actionTaken: TaskStuckAction;
  note?: string | null;
  targetDate?: IsoDateString | null;
}

export type BulkUpdateTaskAction =
  | {
      type: "schedule";
      scheduledForDate: IsoDateString;
    }
  | {
      type: "carry_forward";
      targetDate: IsoDateString;
    }
  | {
      type: "link_goal";
      goalId: EntityId | null;
    }
  | {
      type: "status";
      status: TaskStatus;
    }
  | {
      type: "archive";
    };

export interface BulkUpdateTasksRequest {
  taskIds: EntityId[];
  action: BulkUpdateTaskAction;
}

export interface ReorderTasksRequest {
  taskIds: EntityId[];
}

export interface CarryForwardTaskRequest {
  targetDate: IsoDateString;
}

export interface TaskMutationResponse extends ApiMeta {
  task: PlanningTaskItem;
}

export interface BulkTaskMutationResponse extends ApiMeta {
  tasks: PlanningTaskItem[];
}

export interface TaskTemplateTask {
  title: string;
}

export interface TaskTemplateItem {
  id: EntityId;
  name: string;
  description: string | null;
  tasks: TaskTemplateTask[];
  lastAppliedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskTemplatesResponse extends ApiMeta {
  taskTemplates: TaskTemplateItem[];
}

export interface CreateTaskTemplateRequest {
  name: string;
  description?: string | null;
  tasks: TaskTemplateTask[];
}

export interface UpdateTaskTemplateRequest {
  name?: string;
  description?: string | null;
  tasks?: TaskTemplateTask[];
  archived?: boolean;
}

export interface TaskTemplateMutationResponse extends ApiMeta {
  taskTemplate: TaskTemplateItem;
}

export interface ApplyTaskTemplateResponse extends ApiMeta {
  taskTemplate: TaskTemplateItem;
  tasks: PlanningTaskItem[];
}

export interface TasksQuery {
  scheduledForDate?: IsoDateString;
  from?: IsoDateString;
  to?: IsoDateString;
  status?: TaskStatus;
  kind?: TaskKind;
  cursor?: string;
  limit?: number;
  includeSummary?: boolean;
  originType?: TaskOriginType;
  scheduledState?: TaskScheduledState;
  sort?: TaskListSort;
}

export interface TaskListCounts {
  all: number;
  task: number;
  note: number;
  reminder: number;
}

export interface TasksResponse extends ApiMeta {
  tasks: PlanningTaskItem[];
  nextCursor: string | null;
  counts?: TaskListCounts;
}
