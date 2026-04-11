import type { ApiMeta, EntityId, IsoDateString } from "./common.js";
import type { PlanningPriorityInput, PlanningPriorityItem, PlanningTaskItem } from "./planning.js";
import type { DailyScoreBreakdownResponse } from "./scoring.js";

export type ReviewFrictionTag =
  | "low energy"
  | "poor planning"
  | "distraction"
  | "interruptions"
  | "overcommitment"
  | "avoidance"
  | "unclear task"
  | "travel or schedule disruption";

export type DailyTomorrowAdjustment = "keep_standard" | "rescue" | "recovery";

export type DailyTomorrowAdjustmentReason =
  | "missed_day_pattern"
  | "low_energy"
  | "poor_planning"
  | "overcommitment";

export interface DailyTomorrowAdjustmentRecommendation {
  required: boolean;
  suggestedAdjustment: DailyTomorrowAdjustment | null;
  reason: DailyTomorrowAdjustmentReason | null;
  detail: string | null;
}

export interface ReviewTaskDecision {
  taskId: EntityId;
  targetDate: IsoDateString;
}

export interface DailyReviewSummary {
  prioritiesCompleted: number;
  prioritiesTotal: number;
  tasksCompleted: number;
  tasksScheduled: number;
  routinesCompleted: number;
  routinesTotal: number;
  habitsCompleted: number;
  habitsDue: number;
  waterMl: number;
  waterTargetMl: number;
  mealsLogged: number;
  workoutStatus: "completed" | "recovery_respected" | "fallback" | "missed" | "none";
  expensesLogged: number;
}

export interface ExistingDailyReview {
  biggestWin: string;
  frictionTag: ReviewFrictionTag;
  frictionNote: string | null;
  energyRating: number;
  optionalNote: string | null;
  tomorrowAdjustment: DailyTomorrowAdjustment | null;
  completedAt: string;
}

export type ReviewSubmissionWindowStatus =
  | "open"
  | "too_early"
  | "too_late"
  | "wrong_period"
  | "no_open_window";

export interface ReviewSubmissionWindow {
  isOpen: boolean;
  status: ReviewSubmissionWindowStatus;
  requestedDate: IsoDateString;
  allowedDate: IsoDateString | null;
  opensAt: string | null;
  closesAt: string | null;
  timezone: string;
}

export interface DailyReviewResponse extends ApiMeta {
  date: IsoDateString;
  summary: DailyReviewSummary;
  score: DailyScoreBreakdownResponse;
  incompleteTasks: PlanningTaskItem[];
  existingReview: ExistingDailyReview | null;
  isCompleted: boolean;
  canEditSubmittedReview: boolean;
  submissionWindow: ReviewSubmissionWindow;
  seededTomorrowPriorities: PlanningPriorityItem[];
  tomorrowAdjustmentRecommendation: DailyTomorrowAdjustmentRecommendation;
}

export interface SubmitDailyReviewRequest {
  biggestWin: string;
  frictionTag: ReviewFrictionTag;
  frictionNote?: string | null;
  energyRating: number;
  optionalNote?: string | null;
  tomorrowAdjustment?: DailyTomorrowAdjustment | null;
  carryForwardTaskIds: EntityId[];
  droppedTaskIds: EntityId[];
  rescheduledTasks: ReviewTaskDecision[];
  tomorrowPriorities: PlanningPriorityInput[];
}

export interface DailyReviewMutationResponse extends ApiMeta {
  reviewCompletedAt: string;
  score: DailyScoreBreakdownResponse;
  tomorrowPriorities: PlanningPriorityItem[];
  appliedTomorrowAdjustment: DailyTomorrowAdjustment | null;
}

export interface WeeklyReviewSummary {
  averageDailyScore: number;
  strongDayCount: number;
  habitCompletionRate: number;
  routineCompletionRate: number;
  workoutsCompleted: number;
  workoutsPlanned: number;
  waterTargetHitCount: number;
  mealsLoggedCount: number;
  spendingTotal: number;
  topSpendCategory: string | null;
  topFrictionTags: Array<{ tag: ReviewFrictionTag; count: number }>;
}

export interface ExistingWeeklyReview {
  biggestWin: string;
  biggestMiss: string;
  mainLesson: string;
  keepText: string;
  improveText: string;
  focusHabitId: EntityId | null;
  healthTargetText: string | null;
  spendingWatchCategoryId: EntityId | null;
  notes: string | null;
  completedAt: string;
}

export interface WeeklyReviewResponse extends ApiMeta {
  startDate: IsoDateString;
  endDate: IsoDateString;
  summary: WeeklyReviewSummary;
  existingReview: ExistingWeeklyReview | null;
  seededNextWeekPriorities: PlanningPriorityItem[];
  submissionWindow: ReviewSubmissionWindow;
}

export interface SubmitWeeklyReviewRequest {
  biggestWin: string;
  biggestMiss: string;
  mainLesson: string;
  keepText: string;
  improveText: string;
  nextWeekPriorities: PlanningPriorityInput[];
  focusHabitId?: EntityId | null;
  healthTargetText?: string | null;
  spendingWatchCategoryId?: EntityId | null;
  notes?: string | null;
}

export interface WeeklyReviewMutationResponse extends ApiMeta {
  reviewCompletedAt: string;
  nextWeekPriorities: PlanningPriorityItem[];
}

export interface MonthlyReviewSummary {
  averageWeeklyMomentum: number;
  bestScore: number | null;
  worstScore: number | null;
  workoutCount: number;
  waterSuccessRate: number;
  spendingByCategory: Array<{ category: string; amountMinor: number }>;
  topHabits: Array<{ habitId: EntityId; title: string; completionRate: number }>;
  commonFrictionTags: Array<{ tag: ReviewFrictionTag; count: number }>;
}

export interface ExistingMonthlyReview {
  monthVerdict: string;
  biggestWin: string;
  biggestLeak: string;
  ratings: Record<string, number>;
  nextMonthTheme: string;
  nextMonthOutcomes: PlanningPriorityItem[];
  habitChanges: string[];
  simplifyText: string;
  notes: string | null;
  completedAt: string;
}

export interface MonthlyReviewResponse extends ApiMeta {
  startDate: IsoDateString;
  endDate: IsoDateString;
  summary: MonthlyReviewSummary;
  existingReview: ExistingMonthlyReview | null;
  seededNextMonthTheme: string | null;
  seededNextMonthOutcomes: PlanningPriorityItem[];
  submissionWindow: ReviewSubmissionWindow;
}

export interface SubmitMonthlyReviewRequest {
  monthVerdict: string;
  biggestWin: string;
  biggestLeak: string;
  ratings: Record<string, number>;
  nextMonthTheme: string;
  nextMonthOutcomes: PlanningPriorityInput[];
  habitChanges: string[];
  simplifyText: string;
  notes?: string | null;
}

export interface MonthlyReviewMutationResponse extends ApiMeta {
  reviewCompletedAt: string;
  nextMonthTheme: string;
  nextMonthOutcomes: PlanningPriorityItem[];
}

export type ReviewHistoryCadence = "daily" | "weekly" | "monthly";
export type ReviewHistoryCadenceFilter = "all" | ReviewHistoryCadence;
export type ReviewHistoryRange = "30d" | "90d" | "365d" | "all";

export interface ReviewHistoryMetric {
  key: string;
  label: string;
  value: number | string | null;
  valueLabel: string;
}

export interface ReviewHistoryItem {
  id: EntityId;
  cadence: ReviewHistoryCadence;
  periodStart: IsoDateString;
  periodEnd: IsoDateString;
  completedAt: string;
  primaryText: string;
  secondaryText: string | null;
  metrics: ReviewHistoryMetric[];
  frictionTags: ReviewFrictionTag[];
  route: string;
}

export interface ReviewHistorySummary {
  totalReviews: number;
  countsByCadence: Record<ReviewHistoryCadence, number>;
  topFrictionTags: Array<{ tag: ReviewFrictionTag; count: number }>;
}

export interface WeeklyReviewHistoryTrendPoint {
  startDate: IsoDateString;
  endDate: IsoDateString;
  averageDailyScore: number;
  habitCompletionRate: number;
  strongDayCount: number;
}

export interface MonthlyReviewHistoryTrendPoint {
  startDate: IsoDateString;
  endDate: IsoDateString;
  averageWeeklyMomentum: number;
  waterSuccessRate: number;
  workoutCount: number;
}

export interface ReviewHistoryPeriodComparison<TMetrics extends Record<string, number>> {
  currentPeriodStart: IsoDateString;
  currentPeriodEnd: IsoDateString;
  previousPeriodStart: IsoDateString;
  previousPeriodEnd: IsoDateString;
  currentLabel: string;
  previousLabel: string;
  currentText: string;
  previousText: string;
  metrics: {
    current: TMetrics;
    previous: TMetrics;
    delta: TMetrics;
  };
}

export interface ReviewHistoryResponse extends ApiMeta {
  items: ReviewHistoryItem[];
  nextCursor: string | null;
  summary: ReviewHistorySummary;
  weeklyTrend: WeeklyReviewHistoryTrendPoint[];
  monthlyTrend: MonthlyReviewHistoryTrendPoint[];
  comparisons: {
    weekly: ReviewHistoryPeriodComparison<{
      averageDailyScore: number;
      habitCompletionRate: number;
      strongDayCount: number;
    }> | null;
    monthly: ReviewHistoryPeriodComparison<{
      averageWeeklyMomentum: number;
      waterSuccessRate: number;
      workoutCount: number;
    }> | null;
  };
}
