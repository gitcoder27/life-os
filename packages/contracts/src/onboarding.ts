import type { ApiMeta, ApiSuccess, IsoDateString } from "./common.js";
import type { GoalDomain } from "./goals.js";

export type OnboardingStep =
  | "account"
  | "life_priorities"
  | "goals"
  | "habits"
  | "routines"
  | "health"
  | "finance";

export interface OnboardingGoalInput {
  title: string;
  domain: GoalDomain;
  targetDate?: IsoDateString | null;
  notes?: string | null;
}

export interface OnboardingHabitInput {
  title: string;
  category?: string | null;
  targetPerDay?: number;
  scheduleRuleJson?: Record<string, unknown>;
}

export interface OnboardingRoutineItemInput {
  title: string;
  isRequired?: boolean;
}

export interface OnboardingRoutineInput {
  name: string;
  period: "morning" | "evening";
  items: OnboardingRoutineItemInput[];
}

export interface OnboardingExpenseCategoryInput {
  name: string;
  color?: string | null;
}

export interface OnboardingMealTemplateInput {
  name: string;
  mealSlot?: "breakfast" | "lunch" | "dinner" | "snack" | null;
  description: string;
}

export interface OnboardingRecurringBillInput {
  title: string;
  categoryName?: string | null;
  defaultAmountMinor?: number | null;
  cadence: "weekly" | "monthly";
  nextDueOn: IsoDateString;
  remindDaysBefore?: number;
}

export interface OnboardingDefaults {
  timezone: string;
  currencyCode: string;
  weekStartsOn: number;
  dailyWaterTargetMl: number;
  dailyReviewStartTime: string | null;
  dailyReviewEndTime: string | null;
  expenseCategorySuggestions: string[];
  habitSuggestions: string[];
  routineTemplates: Array<{
    name: string;
    period: "morning" | "evening";
    items: string[];
  }>;
  mealTemplateSuggestions: Array<{
    name: string;
    mealSlot: "breakfast" | "lunch" | "dinner" | "snack" | null;
  }>;
}

export interface OnboardingStateResponse extends ApiMeta {
  isRequired: boolean;
  isComplete: boolean;
  completedAt: string | null;
  nextStep: OnboardingStep | null;
  defaults: OnboardingDefaults;
}

export interface OnboardingCompleteRequest {
  displayName: string;
  timezone: string;
  currencyCode: string;
  weekStartsOn: number;
  dailyWaterTargetMl: number;
  dailyReviewStartTime?: string | null;
  dailyReviewEndTime?: string | null;
  lifePriorities: string[];
  goals: OnboardingGoalInput[];
  habits: OnboardingHabitInput[];
  routines: OnboardingRoutineInput[];
  expenseCategories: OnboardingExpenseCategoryInput[];
  mealTemplates?: OnboardingMealTemplateInput[];
  firstRecurringBill?: OnboardingRecurringBillInput | null;
  firstWeekStartDate: IsoDateString;
  firstMonthStartDate?: IsoDateString;
}

export interface OnboardingCompleteResponse extends ApiSuccess, ApiMeta {
  completedAt: string;
}
