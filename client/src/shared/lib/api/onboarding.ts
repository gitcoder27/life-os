import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  apiRequest,
  queryKeys,
} from "./core";

type OnboardingDefaults = {
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
};

type OnboardingStateResponse = {
  generatedAt: string;
  isRequired: boolean;
  isComplete: boolean;
  completedAt: string | null;
  nextStep: string | null;
  defaults: OnboardingDefaults;
};

type OnboardingCompleteRequest = {
  displayName: string;
  timezone: string;
  currencyCode: string;
  weekStartsOn: number;
  dailyWaterTargetMl: number;
  dailyReviewStartTime?: string | null;
  dailyReviewEndTime?: string | null;
  lifePriorities?: string[];
  goals: Array<{
    title: string;
    domain: "unassigned" | "health" | "money" | "work_growth" | "home_admin" | "discipline" | "other";
    targetDate?: string | null;
    notes?: string | null;
  }>;
  habits: Array<{
    title: string;
    category?: string | null;
    targetPerDay?: number;
    scheduleRuleJson?: Record<string, unknown>;
  }>;
  routines: Array<{
    name: string;
    period: "morning" | "evening";
    items: Array<{
      title: string;
      isRequired?: boolean;
    }>;
  }>;
  expenseCategories?: Array<{
    name: string;
    color?: string | null;
  }>;
  mealTemplates?: Array<{
    name: string;
    mealSlot?: "breakfast" | "lunch" | "dinner" | "snack" | null;
    description: string;
  }>;
  firstRecurringBill?: {
    title: string;
    categoryName?: string | null;
    defaultAmountMinor?: number | null;
    cadence: "weekly" | "monthly";
    nextDueOn: string;
    remindDaysBefore?: number;
  } | null;
  firstWeekStartDate: string;
  firstMonthStartDate?: string;
};

export const useOnboardingStateQuery = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.onboarding,
    queryFn: () => apiRequest<OnboardingStateResponse>("/api/onboarding/state"),
    enabled,
    retry: false,
  });

export const useCompleteOnboardingMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: OnboardingCompleteRequest) =>
      apiRequest<{ success: true; generatedAt: string; completedAt: string }>(
        "/api/onboarding/complete",
        {
          method: "POST",
          body: payload,
        },
      ),
    meta: {
      successMessage: "Setup complete.",
      errorMessage: "Setup could not be completed.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.onboarding });
      void queryClient.invalidateQueries({ queryKey: queryKeys.session });
    },
  });
};
