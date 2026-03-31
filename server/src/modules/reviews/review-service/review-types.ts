import type {
  IsoDateString,
  MonthlyReviewHistoryTrendPoint,
  RecurrenceDefinition,
  ReviewHistoryCadence,
  ReviewHistoryCadenceFilter,
  ReviewHistoryItem,
  ReviewHistoryRange,
  ReviewHistoryResponse,
  ReviewHistorySummary,
  ReviewSubmissionWindow,
  WeeklyReviewHistoryTrendPoint,
} from "@life-os/contracts";
import type { Prisma } from "@prisma/client";

export type ReviewFrictionTag =
  | "low energy"
  | "poor planning"
  | "distraction"
  | "interruptions"
  | "overcommitment"
  | "avoidance"
  | "unclear task"
  | "travel or schedule disruption";

export interface ReviewPrioritySeed {
  slot: 1 | 2 | 3;
  title: string;
  goalId?: string | null;
}

export interface ReviewTaskDecision {
  taskId: string;
  targetDate: IsoDateString;
}

export interface SubmitDailyReviewRequest {
  biggestWin: string;
  frictionTag: ReviewFrictionTag;
  frictionNote?: string | null;
  energyRating: number;
  optionalNote?: string | null;
  carryForwardTaskIds: string[];
  droppedTaskIds: string[];
  rescheduledTasks: ReviewTaskDecision[];
  tomorrowPriorities: ReviewPrioritySeed[];
}

export interface SubmitWeeklyReviewRequest {
  biggestWin: string;
  biggestMiss: string;
  mainLesson: string;
  keepText: string;
  improveText: string;
  nextWeekPriorities: ReviewPrioritySeed[];
  focusHabitId?: string | null;
  healthTargetText?: string | null;
  spendingWatchCategoryId?: string | null;
  notes?: string | null;
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

export interface PlanningTaskItem {
  id: string;
  title: string;
  notes: string | null;
  kind: "task" | "note" | "reminder";
  reminderAt: string | null;
  status: "pending" | "completed" | "dropped";
  scheduledForDate: string | null;
  dueAt: string | null;
  goalId: string | null;
  originType: "manual" | "quick_capture" | "carry_forward" | "review_seed" | "recurring" | "template";
  carriedFromTaskId: string | null;
  recurrence: RecurrenceDefinition | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExistingDailyReview {
  biggestWin: string;
  frictionTag: ReviewFrictionTag;
  frictionNote: string | null;
  energyRating: number;
  optionalNote: string | null;
  completedAt: string;
}

export interface ExistingWeeklyReview {
  biggestWin: string;
  biggestMiss: string;
  mainLesson: string;
  keepText: string;
  improveText: string;
  focusHabitId: string | null;
  healthTargetText: string | null;
  spendingWatchCategoryId: string | null;
  notes: string | null;
  completedAt: string;
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

export interface DailyReviewResponse {
  date: string;
  summary: DailyReviewSummary;
  score: Awaited<ReturnType<(typeof import("../../scoring/service.js"))["calculateDailyScore"]>>;
  incompleteTasks: PlanningTaskItem[];
  existingReview: ExistingDailyReview | null;
  isCompleted: boolean;
  canEditSubmittedReview: boolean;
  submissionWindow: ReviewSubmissionWindow;
  seededTomorrowPriorities: Array<{
    id: string;
    slot: 1 | 2 | 3;
    title: string;
    status: "pending" | "completed" | "dropped";
    goalId: string | null;
    completedAt: string | null;
  }>;
  generatedAt: string;
}

export interface WeeklyReviewResponse {
  startDate: string;
  endDate: string;
  summary: {
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
  };
  existingReview: ExistingWeeklyReview | null;
  seededNextWeekPriorities: Array<{
    id: string;
    slot: 1 | 2 | 3;
    title: string;
    status: "pending" | "completed" | "dropped";
    goalId: string | null;
    completedAt: string | null;
  }>;
  submissionWindow: ReviewSubmissionWindow;
  generatedAt: string;
}

export interface MonthlyReviewResponse {
  startDate: string;
  endDate: string;
  summary: {
    averageWeeklyMomentum: number;
    bestScore: number | null;
    worstScore: number | null;
    workoutCount: number;
    waterSuccessRate: number;
    spendingByCategory: Array<{ category: string; amountMinor: number }>;
    topHabits: Array<{ habitId: string; title: string; completionRate: number }>;
    commonFrictionTags: Array<{ tag: ReviewFrictionTag; count: number }>;
  };
  existingReview: ExistingMonthlyReview | null;
  seededNextMonthTheme: string | null;
  seededNextMonthOutcomes: Array<{
    id: string;
    slot: 1 | 2 | 3;
    title: string;
    status: "pending" | "completed" | "dropped";
    goalId: string | null;
    completedAt: string | null;
  }>;
  submissionWindow: ReviewSubmissionWindow;
  generatedAt: string;
}

export interface ReviewHistoryQuery {
  cadence?: ReviewHistoryCadenceFilter;
  range?: ReviewHistoryRange;
  q?: string;
  cursor?: string;
  limit?: number;
}

export interface ReviewHistoryCursorPayload {
  cadence: ReviewHistoryCadence;
  id: string;
  completedAt: string;
}

export interface WeeklyHistoryMetrics {
  averageDailyScore: number;
  habitCompletionRate: number;
  strongDayCount: number;
  topFrictionTags: ReviewFrictionTag[];
}

export interface MonthlyHistoryMetrics {
  averageWeeklyMomentum: number;
  waterSuccessRate: number;
  workoutCount: number;
  topFrictionTags: ReviewFrictionTag[];
}

export type DailyReviewHistoryRow = Prisma.DailyReviewGetPayload<{
  include: {
    planningCycle: {
      include: {
        dailyScore: true;
      };
    };
  };
}>;

export type WeeklyReviewHistoryRow = Prisma.WeeklyReviewGetPayload<{
  include: {
    planningCycle: true;
  };
}>;

export type MonthlyReviewHistoryRow = Prisma.MonthlyReviewGetPayload<{
  include: {
    planningCycle: true;
  };
}>;

export const FRICTION_TAGS = [
  "low energy",
  "poor planning",
  "distraction",
  "interruptions",
  "overcommitment",
  "avoidance",
  "unclear task",
  "travel or schedule disruption",
] as const satisfies readonly ReviewFrictionTag[];

export type {
  MonthlyReviewHistoryTrendPoint,
  ReviewHistoryItem,
  ReviewHistoryResponse,
  ReviewHistorySummary,
  WeeklyReviewHistoryTrendPoint,
};
