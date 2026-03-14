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
  completedAt: string;
}

export interface DailyReviewResponse extends ApiMeta {
  date: IsoDateString;
  summary: DailyReviewSummary;
  score: DailyScoreBreakdownResponse;
  incompleteTasks: PlanningTaskItem[];
  existingReview: ExistingDailyReview | null;
}

export interface SubmitDailyReviewRequest {
  biggestWin: string;
  frictionTag: ReviewFrictionTag;
  frictionNote?: string | null;
  energyRating: number;
  optionalNote?: string | null;
  carryForwardTaskIds: EntityId[];
  droppedTaskIds: EntityId[];
  rescheduledTasks: ReviewTaskDecision[];
  tomorrowPriorities: PlanningPriorityInput[];
}

export interface DailyReviewMutationResponse extends ApiMeta {
  reviewCompletedAt: string;
  score: DailyScoreBreakdownResponse;
  tomorrowPriorities: PlanningPriorityItem[];
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
  threeOutcomes: string[];
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
}

export interface SubmitMonthlyReviewRequest {
  monthVerdict: string;
  biggestWin: string;
  biggestLeak: string;
  ratings: Record<string, number>;
  nextMonthTheme: string;
  threeOutcomes: string[];
  habitChanges: string[];
  simplifyText: string;
  notes?: string | null;
}

export interface MonthlyReviewMutationResponse extends ApiMeta {
  reviewCompletedAt: string;
  nextMonthTheme: string;
  nextMonthOutcomes: PlanningPriorityItem[];
}
