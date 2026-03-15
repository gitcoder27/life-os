import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

type ApiFieldError = {
  field: string;
  message: string;
};

type SessionUser = {
  id: string;
  email: string;
  displayName: string;
};

type SessionResponse = {
  authenticated: boolean;
  generatedAt: string;
  user: SessionUser | null;
};

type LoginResponse = {
  success: true;
  generatedAt: string;
  user: SessionUser;
};

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
  lifePriorities: string[];
  goals: Array<{
    title: string;
    domain: "health" | "money" | "work_growth" | "home_admin" | "discipline" | "other";
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
  expenseCategories: Array<{
    name: string;
    color?: string | null;
  }>;
  mealTemplates?: Array<{
    name: string;
    mealSlot?: "breakfast" | "lunch" | "dinner" | "snack" | null;
    description: string;
  }>;
  firstWeekStartDate: string;
  firstMonthStartDate?: string;
};

type HomeOverviewResponse = {
  date: string;
  generatedAt: string;
  greeting: string;
  dailyScore: {
    value: number;
    label: string;
    earnedPoints: number;
    possiblePoints: number;
  };
  weeklyMomentum: number;
  topPriorities: Array<{
    id: string;
    title: string;
    slot: 1 | 2 | 3;
    status: "pending" | "completed" | "dropped";
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: "pending" | "completed" | "dropped";
    scheduledForDate: string | null;
  }>;
  routineSummary: {
    completedItems: number;
    totalItems: number;
    currentPeriod: "morning" | "evening" | "none";
  };
  habitSummary: {
    completedToday: number;
    dueToday: number;
    streakHighlights: string[];
  };
  healthSummary: {
    waterMl: number;
    waterTargetMl: number;
    mealsLogged: number;
    workoutStatus: "completed" | "recovery_respected" | "fallback" | "missed" | "none";
  };
  financeSummary: {
    spentThisMonth: number;
    budgetLabel: string;
    upcomingBills: number;
  };
  attentionItems: Array<{
    id: string;
    title: string;
    kind: "task" | "habit" | "routine" | "finance" | "admin" | "review" | "notification";
    tone: "info" | "warning" | "urgent";
  }>;
  notifications: Array<{
    id: string;
    title: string;
    body: string;
    read: boolean;
    createdAt: string;
  }>;
};

type ScoreBucket = {
  key: string;
  label: string;
  earnedPoints: number;
  applicablePoints: number;
  explanation: string;
};

type DailyScoreResponse = {
  generatedAt: string;
  date: string;
  value: number;
  label: string;
  earnedPoints: number;
  possiblePoints: number;
  buckets: ScoreBucket[];
  topReasons: Array<{
    label: string;
    missingPoints: number;
  }>;
  finalizedAt: string | null;
};

type WeeklyMomentumResponse = {
  generatedAt: string;
  endingOn: string;
  value: number;
  basedOnDays: number;
  weeklyReviewBonus: number;
  strongDayStreak: number;
  dailyScores: Array<{
    date: string;
    value: number;
    label: string;
  }>;
};

type DayPlanResponse = {
  generatedAt: string;
  date: string;
  priorities: Array<{
    id: string;
    slot: 1 | 2 | 3;
    title: string;
    status: "pending" | "completed" | "dropped";
    goalId: string | null;
    completedAt: string | null;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    notes: string | null;
    status: "pending" | "completed" | "dropped";
    scheduledForDate: string | null;
    dueAt: string | null;
    goalId: string | null;
    originType: string;
    carriedFromTaskId: string | null;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

type TaskMutationResponse = {
  generatedAt: string;
  task: DayPlanResponse["tasks"][number];
};

type HabitsResponse = {
  generatedAt: string;
  date: string;
  habits: Array<{
    id: string;
    title: string;
    category: string | null;
    scheduleRule: { daysOfWeek?: number[] };
    targetPerDay: number;
    status: "active" | "paused" | "archived";
    dueToday: boolean;
    completedToday: boolean;
    streakCount: number;
  }>;
  dueHabits: Array<{
    id: string;
    title: string;
    category: string | null;
    scheduleRule: { daysOfWeek?: number[] };
    targetPerDay: number;
    status: "active" | "paused" | "archived";
    dueToday: boolean;
    completedToday: boolean;
    streakCount: number;
  }>;
  routines: Array<{
    id: string;
    name: string;
    period: "morning" | "evening";
    status: "active" | "archived";
    completedItems: number;
    totalItems: number;
    items: Array<{
      id: string;
      title: string;
      sortOrder: number;
      isRequired: boolean;
      completedToday: boolean;
    }>;
  }>;
};

type HabitMutationResponse = {
  generatedAt: string;
  habit: HabitsResponse["habits"][number];
};

type RoutineMutationResponse = {
  generatedAt: string;
  routine: HabitsResponse["routines"][number];
};

type HealthSummaryResponse = {
  generatedAt: string;
  from: string;
  to: string;
  currentDay: {
    date: string;
    waterMl: number;
    waterTargetMl: number;
    mealCount: number;
    meaningfulMealCount: number;
    workoutDay: {
      id: string;
      date: string;
      planType: "workout" | "recovery" | "none";
      plannedLabel: string | null;
      actualStatus: "completed" | "recovery_respected" | "fallback" | "missed" | "none";
      note: string | null;
      updatedAt: string;
    } | null;
    latestWeight: {
      id: string;
      measuredOn: string;
      weightValue: number;
      unit: string;
      note: string | null;
      createdAt: string;
    } | null;
  };
  range: {
    totalWaterMl: number;
    totalMealsLogged: number;
    workoutsCompleted: number;
    workoutsPlanned: number;
  };
  mealLogs: Array<{
    id: string;
    occurredAt: string;
    mealSlot: "breakfast" | "lunch" | "dinner" | "snack" | null;
    mealTemplateId: string | null;
    description: string;
    loggingQuality: "partial" | "meaningful" | "full";
    createdAt: string;
  }>;
  weightHistory: Array<{
    id: string;
    measuredOn: string;
    weightValue: number;
    unit: string;
    note: string | null;
    createdAt: string;
  }>;
};

type WaterLogsResponse = {
  generatedAt: string;
  date: string;
  waterLogs: Array<{
    id: string;
    occurredAt: string;
    amountMl: number;
    source: "tap" | "quick_capture" | "manual";
    createdAt: string;
  }>;
};

type MealTemplatesResponse = {
  generatedAt: string;
  mealTemplates: Array<{
    id: string;
    name: string;
    mealSlot: "breakfast" | "lunch" | "dinner" | "snack" | null;
    description: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

type MealLogsResponse = {
  generatedAt: string;
  date: string;
  mealLogs: Array<{
    id: string;
    occurredAt: string;
    mealSlot: "breakfast" | "lunch" | "dinner" | "snack" | null;
    mealTemplateId: string | null;
    description: string;
    loggingQuality: "partial" | "meaningful" | "full";
    createdAt: string;
  }>;
};

type WaterLogMutationResponse = {
  generatedAt: string;
  waterLog: WaterLogsResponse["waterLogs"][number];
};

type MealLogMutationResponse = {
  generatedAt: string;
  mealLog: MealLogsResponse["mealLogs"][number];
};

type WorkoutDayMutationResponse = {
  generatedAt: string;
  workoutDay: NonNullable<HealthSummaryResponse["currentDay"]["workoutDay"]>;
};

type WeightLogMutationResponse = {
  generatedAt: string;
  weightLog: NonNullable<HealthSummaryResponse["currentDay"]["latestWeight"]>;
};

type FinanceSummaryResponse = {
  generatedAt: string;
  month: string;
  currencyCode: string;
  totalSpentMinor: number;
  categoryTotals: Array<{
    expenseCategoryId: string | null;
    name: string;
    color: string | null;
    totalAmountMinor: number;
  }>;
  upcomingBills: Array<{
    id: string;
    title: string;
    dueOn: string;
    amountMinor: number | null;
    status: "pending" | "done" | "rescheduled" | "dropped";
  }>;
};

type ExpensesResponse = {
  generatedAt: string;
  from: string;
  to: string;
  expenses: Array<{
    id: string;
    expenseCategoryId: string | null;
    amountMinor: number;
    currencyCode: string;
    spentOn: string;
    description: string | null;
    source: "manual" | "quick_capture" | "template";
    recurringExpenseTemplateId: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

type RecurringExpensesResponse = {
  generatedAt: string;
  recurringExpenses: Array<{
    id: string;
    title: string;
    expenseCategoryId: string | null;
    defaultAmountMinor: number | null;
    currencyCode: string;
    recurrenceRule: string;
    nextDueOn: string;
    remindDaysBefore: number;
    status: "active" | "paused" | "archived";
    createdAt: string;
    updatedAt: string;
  }>;
};

type FinanceCategoriesResponse = {
  generatedAt: string;
  categories: Array<{
    id: string;
    name: string;
    color: string | null;
    sortOrder: number;
    createdAt: string;
    archivedAt: string | null;
  }>;
};

type ExpenseMutationResponse = {
  generatedAt: string;
  expense: ExpensesResponse["expenses"][number];
};

type GoalsResponse = {
  generatedAt: string;
  goals: Array<{
    id: string;
    title: string;
    domain: "health" | "money" | "work_growth" | "home_admin" | "discipline" | "other";
    status: "active" | "paused" | "completed" | "archived";
    targetDate: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

type WeekPlanResponse = {
  generatedAt: string;
  startDate: string;
  endDate: string;
  priorities: Array<{
    id: string;
    slot: 1 | 2 | 3;
    title: string;
    status: "pending" | "completed" | "dropped";
    goalId: string | null;
    completedAt: string | null;
  }>;
};

type MonthPlanResponse = {
  generatedAt: string;
  startDate: string;
  endDate: string;
  theme: string | null;
  topOutcomes: Array<{
    id: string;
    slot: 1 | 2 | 3;
    title: string;
    status: "pending" | "completed" | "dropped";
    goalId: string | null;
    completedAt: string | null;
  }>;
};

export type ReviewCadence = "daily" | "weekly" | "monthly";
export type DailyFrictionTag =
  | "low energy"
  | "poor planning"
  | "distraction"
  | "interruptions"
  | "overcommitment"
  | "avoidance"
  | "unclear task"
  | "travel or schedule disruption";

type DailyReviewResponse = {
  generatedAt: string;
  date: string;
  summary: {
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
  };
  score: DailyScoreResponse;
  incompleteTasks: DayPlanResponse["tasks"];
  existingReview: {
    biggestWin: string;
    frictionTag: DailyFrictionTag;
    frictionNote: string | null;
    energyRating: number;
    optionalNote: string | null;
    completedAt: string;
  } | null;
};

type WeeklyReviewResponse = {
  generatedAt: string;
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
    topFrictionTags: Array<{
      tag: string;
      count: number;
    }>;
  };
  existingReview: {
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
  } | null;
};

type MonthlyReviewResponse = {
  generatedAt: string;
  startDate: string;
  endDate: string;
  summary: {
    averageWeeklyMomentum: number;
    bestScore: number | null;
    worstScore: number | null;
    workoutCount: number;
    waterSuccessRate: number;
    spendingByCategory: Array<{
      category: string;
      amountMinor: number;
    }>;
    topHabits: Array<{
      habitId: string;
      title: string;
      completionRate: number;
    }>;
    commonFrictionTags: Array<{
      tag: string;
      count: number;
    }>;
  };
  existingReview: {
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
  } | null;
};

type DailyReviewMutationResponse = {
  generatedAt: string;
  reviewCompletedAt: string;
  score: DailyScoreResponse;
  tomorrowPriorities: Array<{
    id: string;
    slot: 1 | 2 | 3;
    title: string;
    status: "pending" | "completed" | "dropped";
    goalId: string | null;
    completedAt: string | null;
  }>;
};

type WeeklyReviewMutationResponse = {
  generatedAt: string;
  reviewCompletedAt: string;
  nextWeekPriorities: Array<{
    id: string;
    slot: 1 | 2 | 3;
    title: string;
    status: "pending" | "completed" | "dropped";
    goalId: string | null;
    completedAt: string | null;
  }>;
};

type MonthlyReviewMutationResponse = {
  generatedAt: string;
  reviewCompletedAt: string;
  nextMonthTheme: string;
  nextMonthOutcomes: Array<{
    id: string;
    slot: 1 | 2 | 3;
    title: string;
    status: "pending" | "completed" | "dropped";
    goalId: string | null;
    completedAt: string | null;
  }>;
};

type ApiErrorResponse = {
  success: false;
  code: string;
  message: string;
  fieldErrors?: ApiFieldError[];
  generatedAt: string;
};

export class ApiClientError extends Error {
  status: number;
  code: string;
  fieldErrors?: ApiFieldError[];

  constructor(status: number, payload?: Partial<ApiErrorResponse>) {
    super(payload?.message ?? "Request failed");
    this.name = "ApiClientError";
    this.status = status;
    this.code = payload?.code ?? "UNKNOWN";
    this.fieldErrors = payload?.fieldErrors;
  }
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const CSRF_COOKIE_NAME = import.meta.env.VITE_CSRF_COOKIE_NAME ?? "life_os_csrf";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const queryKeys = {
  session: ["session"] as const,
  onboarding: ["onboarding"] as const,
  home: (date: string) => ["home", date] as const,
  score: (date: string) => ["score", "daily", date] as const,
  weeklyMomentum: (date: string) => ["score", "weekly-momentum", date] as const,
  dayPlan: (date: string) => ["planning", "day", date] as const,
  habits: ["habits"] as const,
  health: (date: string) => ["health", date] as const,
  finance: (month: string) => ["finance", month] as const,
  goals: (weekStart: string, monthStart: string) => ["goals", weekStart, monthStart] as const,
  review: (cadence: ReviewCadence, dateKey: string) => ["review", cadence, dateKey] as const,
};

function buildUrl(path: string, query?: Record<string, string | undefined>) {
  const base = API_BASE_URL ? `${API_BASE_URL}${path}` : path;
  const url = API_BASE_URL ? new URL(base) : new URL(path, window.location.origin);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }
  }

  return url.toString();
}

function getCookie(name: string) {
  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : null;
}

async function readErrorPayload(response: Response) {
  try {
    return (await response.json()) as ApiErrorResponse;
  } catch {
    return undefined;
  }
}

export async function apiRequest<TResponse>(
  path: string,
  init?: {
    method?: string;
    body?: unknown;
    headers?: HeadersInit;
    query?: Record<string, string | undefined>;
  },
): Promise<TResponse> {
  const method = init?.method ?? "GET";
  const headers = new Headers(init?.headers);

  if (init?.body !== undefined) {
    headers.set("content-type", "application/json");
  }

  if (!SAFE_METHODS.has(method.toUpperCase()) && path !== "/api/auth/login") {
    const csrfToken = getCookie(CSRF_COOKIE_NAME);
    if (csrfToken) {
      headers.set("x-csrf-token", csrfToken);
    }
  }

  const response = await fetch(buildUrl(path, init?.query), {
    method,
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: "include",
  });

  if (!response.ok) {
    const payload = await readErrorPayload(response);
    throw new ApiClientError(response.status, payload);
  }

  return response.json() as Promise<TResponse>;
}

function invalidateCoreData(queryClient: ReturnType<typeof useQueryClient>, date: string) {
  const month = getMonthString(date);
  const weekStart = getWeekStartDate(date);
  const monthStart = getMonthStartDate(date);

  void queryClient.invalidateQueries({ queryKey: queryKeys.home(date) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.score(date) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.weeklyMomentum(date) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.dayPlan(date) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.habits });
  void queryClient.invalidateQueries({ queryKey: queryKeys.health(date) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.finance(month) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.goals(weekStart, monthStart) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.review("daily", date) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.review("weekly", weekStart) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.review("monthly", monthStart) });
}

export function padNumber(value: number) {
  return String(value).padStart(2, "0");
}

export function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

export function getTodayDate() {
  return toIsoDate(new Date());
}

export function getMonthString(isoDate: string) {
  return isoDate.slice(0, 7);
}

export function getWeekStartDate(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return toIsoDate(date);
}

export function getWeekEndDate(isoDate: string) {
  const date = new Date(`${getWeekStartDate(isoDate)}T12:00:00`);
  date.setDate(date.getDate() + 6);
  return toIsoDate(date);
}

export function getMonthStartDate(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00`);
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-01`;
}

export function getMonthEndDate(isoDate: string) {
  const date = new Date(`${getMonthStartDate(isoDate)}T12:00:00`);
  date.setMonth(date.getMonth() + 1);
  date.setDate(0);
  return toIsoDate(date);
}

export function formatLongDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatShortDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatMonthLabel(isoMonth: string) {
  return new Date(`${isoMonth}-01T12:00:00`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function formatTimeLabel(isoDateTime: string | null) {
  if (!isoDateTime) {
    return "Any time";
  }

  return new Date(isoDateTime).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatRelativeDate(isoDate: string) {
  const today = getTodayDate();
  if (isoDate === today) {
    return "Today";
  }

  const yesterday = new Date(`${today}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isoDate === toIsoDate(yesterday)) {
    return "Yesterday";
  }

  return formatShortDate(isoDate);
}

export function formatMinorCurrency(amountMinor: number | null, currencyCode = "USD") {
  if (amountMinor === null) {
    return "TBD";
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export function formatMajorCurrency(amount: number, currencyCode = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function formatMealSlotLabel(mealSlot: "breakfast" | "lunch" | "dinner" | "snack" | null) {
  if (!mealSlot) {
    return "Any time";
  }

  return mealSlot.charAt(0).toUpperCase() + mealSlot.slice(1);
}

export function formatWorkoutStatus(
  status: "completed" | "recovery_respected" | "fallback" | "missed" | "none" | null | undefined,
) {
  if (!status || status === "none") {
    return "Not logged";
  }

  return status.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function daysUntil(isoDate: string) {
  const today = new Date(`${getTodayDate()}T12:00:00`);
  const target = new Date(`${isoDate}T12:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function formatDueLabel(isoDate: string) {
  const difference = daysUntil(isoDate);

  if (difference <= 0) {
    return difference === 0 ? "today" : "overdue";
  }

  return difference === 1 ? "1 day" : `${difference} days`;
}

export function parseAmountToMinor(value: string) {
  const normalized = value.replace(/[^0-9.]/g, "");
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed * 100);
}

export function parseNumberValue(value: string) {
  const normalized = value.replace(/[^0-9.]/g, "");
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function splitEntries(value: string) {
  return value
    .split(/\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function toPriorityInputs(values: string[]) {
  return values
    .filter(Boolean)
    .slice(0, 3)
    .map((title, index) => ({
      slot: ([1, 2, 3] as const)[index],
      title,
    }));
}

export function useSessionQuery() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: () => apiRequest<SessionResponse>("/api/auth/session"),
    retry: false,
  });
}

export function useOnboardingStateQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.onboarding,
    queryFn: () => apiRequest<OnboardingStateResponse>("/api/onboarding/state"),
    enabled,
    retry: false,
  });
}

export function useHomeOverviewQuery(date: string) {
  return useQuery({
    queryKey: queryKeys.home(date),
    queryFn: () => apiRequest<HomeOverviewResponse>("/api/home/overview", { query: { date } }),
    retry: false,
  });
}

export function useDailyScoreQuery(date: string) {
  return useQuery({
    queryKey: queryKeys.score(date),
    queryFn: () => apiRequest<DailyScoreResponse>(`/api/scores/daily/${date}`),
    retry: false,
  });
}

export function useWeeklyMomentumQuery(endingOn: string) {
  return useQuery({
    queryKey: queryKeys.weeklyMomentum(endingOn),
    queryFn: () =>
      apiRequest<WeeklyMomentumResponse>("/api/scores/weekly-momentum", {
        query: { endingOn },
      }),
    retry: false,
  });
}

export function useDayPlanQuery(date: string) {
  return useQuery({
    queryKey: queryKeys.dayPlan(date),
    queryFn: () => apiRequest<DayPlanResponse>(`/api/planning/days/${date}`),
    retry: false,
  });
}

export function useHabitsQuery() {
  return useQuery({
    queryKey: queryKeys.habits,
    queryFn: () => apiRequest<HabitsResponse>("/api/habits"),
    retry: false,
  });
}

export function useHealthDataQuery(date: string) {
  return useQuery({
    queryKey: queryKeys.health(date),
    queryFn: async () => {
      const [summary, waterLogs, mealTemplates, mealLogs] = await Promise.all([
        apiRequest<HealthSummaryResponse>("/api/health/summary", {
          query: { from: date, to: date },
        }),
        apiRequest<WaterLogsResponse>("/api/health/water-logs", {
          query: { date },
        }),
        apiRequest<MealTemplatesResponse>("/api/health/meal-templates"),
        apiRequest<MealLogsResponse>("/api/health/meal-logs", {
          query: { date },
        }),
      ]);

      return {
        summary,
        waterLogs,
        mealTemplates,
        mealLogs,
      };
    },
    retry: false,
  });
}

export function useFinanceDataQuery(date: string) {
  const month = getMonthString(date);
  const monthStart = getMonthStartDate(date);
  const monthEnd = getMonthEndDate(date);

  return useQuery({
    queryKey: queryKeys.finance(month),
    queryFn: async () => {
      const [summary, expenses, recurringExpenses, categories] = await Promise.all([
        apiRequest<FinanceSummaryResponse>("/api/finance/summary", {
          query: { month },
        }),
        apiRequest<ExpensesResponse>("/api/finance/expenses", {
          query: { from: monthStart, to: monthEnd },
        }),
        apiRequest<RecurringExpensesResponse>("/api/finance/recurring-expenses"),
        apiRequest<FinanceCategoriesResponse>("/api/finance/categories"),
      ]);

      return {
        summary,
        expenses,
        recurringExpenses,
        categories,
      };
    },
    retry: false,
  });
}

export function useGoalsDataQuery(date: string) {
  const weekStart = getWeekStartDate(date);
  const monthStart = getMonthStartDate(date);

  return useQuery({
    queryKey: queryKeys.goals(weekStart, monthStart),
    queryFn: async () => {
      const [goals, weekPlan, monthPlan] = await Promise.all([
        apiRequest<GoalsResponse>("/api/goals"),
        apiRequest<WeekPlanResponse>(`/api/planning/weeks/${weekStart}`),
        apiRequest<MonthPlanResponse>(`/api/planning/months/${monthStart}`),
      ]);

      return {
        goals,
        weekPlan,
        monthPlan,
      };
    },
    retry: false,
  });
}

export function useReviewDataQuery(cadence: ReviewCadence, date: string) {
  const keyDate =
    cadence === "daily"
      ? date
      : cadence === "weekly"
        ? getWeekStartDate(date)
        : getMonthStartDate(date);

  return useQuery({
    queryKey: queryKeys.review(cadence, keyDate),
    queryFn: async () => {
      if (cadence === "daily") {
        const review = await apiRequest<DailyReviewResponse>(`/api/reviews/daily/${keyDate}`);
        return {
          cadence,
          keyDate,
          review,
        } as const;
      }

      if (cadence === "weekly") {
        const [review, momentum] = await Promise.all([
          apiRequest<WeeklyReviewResponse>(`/api/reviews/weekly/${keyDate}`),
          apiRequest<WeeklyMomentumResponse>("/api/scores/weekly-momentum", {
            query: { endingOn: getWeekEndDate(date) },
          }),
        ]);

        return {
          cadence,
          keyDate,
          review,
          momentum,
        } as const;
      }

      const review = await apiRequest<MonthlyReviewResponse>(`/api/reviews/monthly/${keyDate}`);
      return {
        cadence,
        keyDate,
        review,
      } as const;
    },
    retry: false,
  });
}

export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { email: string; password: string }) =>
      apiRequest<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: payload,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.session });
      void queryClient.invalidateQueries({ queryKey: queryKeys.onboarding });
    },
  });
}

export function useCompleteOnboardingMutation() {
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.onboarding });
      void queryClient.invalidateQueries({ queryKey: queryKeys.session });
    },
  });
}

export function useTaskStatusMutation(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: "pending" | "completed" | "dropped" }) =>
      apiRequest<TaskMutationResponse>(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: { status },
      }),
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
}

export function useCreateTaskMutation(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      title: string;
      notes?: string | null;
      scheduledForDate?: string | null;
      originType?: "manual" | "quick_capture" | "carry_forward" | "review_seed" | "recurring";
    }) =>
      apiRequest<TaskMutationResponse>("/api/tasks", {
        method: "POST",
        body: payload,
      }),
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
}

export function useHabitCheckinMutation(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (habitId: string) =>
      apiRequest<HabitMutationResponse>(`/api/habits/${habitId}/checkins`, {
        method: "POST",
        body: { date, status: "completed" },
      }),
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
}

export function useRoutineCheckinMutation(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) =>
      apiRequest<RoutineMutationResponse>(`/api/routine-items/${itemId}/checkins`, {
        method: "POST",
        body: { date },
      }),
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
}

export function useAddWaterMutation(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (amountMl: number) =>
      apiRequest<WaterLogMutationResponse>("/api/health/water-logs", {
        method: "POST",
        body: {
          amountMl,
          source: "quick_capture",
        },
      }),
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
}

export function useAddMealMutation(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      description: string;
      loggingQuality: "partial" | "meaningful" | "full";
      mealSlot?: "breakfast" | "lunch" | "dinner" | "snack" | null;
      mealTemplateId?: string | null;
    }) =>
      apiRequest<MealLogMutationResponse>("/api/health/meal-logs", {
        method: "POST",
        body: payload,
      }),
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
}

export function useWorkoutMutation(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      planType?: "workout" | "recovery" | "none";
      plannedLabel?: string | null;
      actualStatus?: "completed" | "recovery_respected" | "fallback" | "missed" | "none";
      note?: string | null;
    }) =>
      apiRequest<WorkoutDayMutationResponse>(`/api/health/workout-days/${date}`, {
        method: "PUT",
        body: payload,
      }),
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
}

export function useAddWeightMutation(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      weightValue: number;
      unit?: string;
      measuredOn?: string;
      note?: string | null;
    }) =>
      apiRequest<WeightLogMutationResponse>("/api/health/weight-logs", {
        method: "POST",
        body: payload,
      }),
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
}

export function useCreateExpenseMutation(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      spentOn: string;
      amountMinor: number;
      currencyCode?: string;
      description?: string | null;
      expenseCategoryId?: string | null;
      source?: "manual" | "quick_capture" | "template";
      recurringExpenseTemplateId?: string | null;
    }) =>
      apiRequest<ExpenseMutationResponse>("/api/finance/expenses", {
        method: "POST",
        body: payload,
      }),
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
}

export function useSubmitDailyReviewMutation(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      biggestWin: string;
      frictionTag: DailyFrictionTag;
      frictionNote?: string | null;
      energyRating: number;
      optionalNote?: string | null;
      carryForwardTaskIds: string[];
      droppedTaskIds: string[];
      rescheduledTasks: Array<{
        taskId: string;
        targetDate: string;
      }>;
      tomorrowPriorities: Array<{
        slot: 1 | 2 | 3;
        title: string;
      }>;
    }) =>
      apiRequest<DailyReviewMutationResponse>(`/api/reviews/daily/${date}`, {
        method: "POST",
        body: payload,
      }),
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
}

export function useSubmitWeeklyReviewMutation(date: string) {
  const queryClient = useQueryClient();
  const startDate = getWeekStartDate(date);

  return useMutation({
    mutationFn: (payload: {
      biggestWin: string;
      biggestMiss: string;
      mainLesson: string;
      keepText: string;
      improveText: string;
      nextWeekPriorities: Array<{
        slot: 1 | 2 | 3;
        title: string;
      }>;
      focusHabitId?: string | null;
      healthTargetText?: string | null;
      spendingWatchCategoryId?: string | null;
      notes?: string | null;
    }) =>
      apiRequest<WeeklyReviewMutationResponse>(`/api/reviews/weekly/${startDate}`, {
        method: "POST",
        body: payload,
      }),
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
}

export function useSubmitMonthlyReviewMutation(date: string) {
  const queryClient = useQueryClient();
  const startDate = getMonthStartDate(date);

  return useMutation({
    mutationFn: (payload: {
      monthVerdict: string;
      biggestWin: string;
      biggestLeak: string;
      ratings: Record<string, number>;
      nextMonthTheme: string;
      threeOutcomes: string[];
      habitChanges: string[];
      simplifyText: string;
      notes?: string | null;
    }) =>
      apiRequest<MonthlyReviewMutationResponse>(`/api/reviews/monthly/${startDate}`, {
        method: "POST",
        body: payload,
      }),
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
}
