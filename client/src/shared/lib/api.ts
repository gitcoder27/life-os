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

type LogoutResponse = {
  success: true;
  generatedAt: string;
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

export type LinkedGoal = {
  id: string;
  title: string;
  domain: "health" | "money" | "work_growth" | "home_admin" | "discipline" | "other";
  status: "active" | "paused" | "completed" | "archived";
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
    goalId: string | null;
    goal: LinkedGoal | null;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: "pending" | "completed" | "dropped";
    scheduledForDate: string | null;
    dueAt: string | null;
    goalId: string | null;
    goal: LinkedGoal | null;
    notes: string | null;
    originType: TaskItem["originType"];
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
  accountabilityRadar: {
    overdueTaskCount: number;
    staleInboxCount: number;
    totalCount: number;
    overflowCount: number;
    items: Array<{
      id: string;
      kind: "overdue_task" | "stale_inbox";
      title: string;
      route: string;
      label: string;
      ageDays: number;
      scheduledForDate: string | null;
      createdAt: string | null;
      notes: string | null;
      originType: TaskItem["originType"];
    }>;
  };
  attentionItems: Array<{
    id: string;
    title: string;
    kind: "task" | "habit" | "routine" | "finance" | "admin" | "review" | "notification";
    tone: "info" | "warning" | "urgent";
    detail?: string;
    action:
      | {
          type: "open_review";
          route: string;
        }
      | {
          type: "open_route";
          route: string;
        };
  }>;
  notifications: Array<{
    id: string;
    title: string;
    body: string;
    read: boolean;
    createdAt: string;
  }>;
  guidance: {
    recovery: {
      tone: "steady" | "recovery";
      title: string;
      detail: string;
    } | null;
    weeklyChallenge: {
      habitId: string;
      title: string;
      streakCount: number;
      completedToday: boolean;
      weekCompletions: number;
      weekTarget: number;
      status: "on_track" | "due_today" | "behind";
      message: string;
    } | null;
    recommendations: Array<{
      id: string;
      kind: "habit" | "priority" | "task" | "review" | "health";
      title: string;
      detail: string;
      impactLabel: string;
      action:
        | { type: "open_review"; route: string }
        | { type: "open_route"; route: string };
    }>;
  };
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

type RecurrenceRuleResponse = {
  frequency: "daily" | "weekly" | "monthly_nth_weekday" | "interval";
  startsOn: string;
  interval?: number;
  daysOfWeek?: number[];
  nthWeekday?: { ordinal: 1 | 2 | 3 | 4 | -1; dayOfWeek: number };
  end?: { type: "never" | "on_date" | "after_occurrences"; until?: string | null; occurrenceCount?: number | null };
};

type RecurrenceDefinitionResponse = {
  id: string;
  rule: RecurrenceRuleResponse;
  exceptions: Array<{ occurrenceDate: string; action: "skip" | "do_once" | "reschedule"; targetDate?: string | null }>;
  carryPolicy?: "complete_and_clone" | "move_due_date" | "cancel" | null;
  legacyRuleText?: string | null;
};

type RecurrenceInputPayload = {
  rule: RecurrenceRuleResponse;
  exceptions?: Array<{ occurrenceDate: string; action: "skip" | "do_once" | "reschedule"; targetDate?: string | null }>;
};

export type TaskItem = {
  id: string;
  title: string;
  notes: string | null;
  status: "pending" | "completed" | "dropped";
  scheduledForDate: string | null;
  dueAt: string | null;
  goalId: string | null;
  goal: LinkedGoal | null;
  originType: "manual" | "quick_capture" | "carry_forward" | "review_seed" | "recurring" | "template";
  carriedFromTaskId: string | null;
  recurrence: RecurrenceDefinitionResponse | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskTemplateTask = {
  title: string;
};

export type TaskTemplate = {
  id: string;
  name: string;
  description: string | null;
  tasks: TaskTemplateTask[];
  lastAppliedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
    goal: LinkedGoal | null;
    completedAt: string | null;
  }>;
  tasks: TaskItem[];
};

export type DayPriorityInput = {
  id?: string;
  slot: 1 | 2 | 3;
  title: string;
  goalId?: string | null;
};

type DayPrioritiesMutationResponse = {
  generatedAt: string;
  priorities: DayPlanResponse["priorities"];
};

type PriorityMutationResponse = {
  generatedAt: string;
  priority: DayPlanResponse["priorities"][number];
};

type TaskMutationResponse = {
  generatedAt: string;
  task: TaskItem;
};

type BulkTaskMutationResponse = {
  generatedAt: string;
  tasks: TaskItem[];
};

type TasksResponse = {
  generatedAt: string;
  tasks: TaskItem[];
};

type TaskTemplatesResponse = {
  generatedAt: string;
  taskTemplates: TaskTemplate[];
};

type TaskTemplateMutationResponse = {
  generatedAt: string;
  taskTemplate: TaskTemplate;
};

type ApplyTaskTemplateResponse = {
  generatedAt: string;
  taskTemplate: TaskTemplate;
  tasks: TaskItem[];
};

export type TasksQueryFilters = {
  scheduledForDate?: string;
  from?: string;
  to?: string;
  status?: "pending" | "completed" | "dropped";
  originType?: "manual" | "quick_capture" | "carry_forward" | "review_seed" | "recurring" | "template";
  scheduledState?: "all" | "scheduled" | "unscheduled";
};

export type BulkUpdateTasksInput =
  | {
      taskIds: string[];
      action: {
        type: "schedule";
        scheduledForDate: string;
      };
    }
  | {
      taskIds: string[];
      action: {
        type: "link_goal";
        goalId: string | null;
      };
    }
  | {
      taskIds: string[];
      action: {
        type: "archive";
      };
    };

type HabitsResponse = {
  generatedAt: string;
  date: string;
  weeklyChallenge: {
    habitId: string;
    title: string;
    streakCount: number;
    completedToday: boolean;
    weekCompletions: number;
    weekTarget: number;
    status: "on_track" | "due_today" | "behind";
    message: string;
  } | null;
  habits: Array<{
    id: string;
    title: string;
    category: string | null;
    scheduleRule: { daysOfWeek?: number[] };
    recurrence: RecurrenceDefinitionResponse | null;
    goalId: string | null;
    goal: LinkedGoal | null;
    targetPerDay: number;
    status: "active" | "paused" | "archived";
    dueToday: boolean;
    completedToday: boolean;
    streakCount: number;
    risk: {
      level: "none" | "at_risk" | "drifting";
      reason: "streak_at_risk" | "missed_recently" | "low_completion_rate" | null;
      message: string | null;
      dueCount7d: number;
      completedCount7d: number;
      completionRate7d: number;
    };
  }>;
  dueHabits: Array<{
    id: string;
    title: string;
    category: string | null;
    scheduleRule: { daysOfWeek?: number[] };
    recurrence: RecurrenceDefinitionResponse | null;
    goalId: string | null;
    goal: LinkedGoal | null;
    targetPerDay: number;
    status: "active" | "paused" | "archived";
    dueToday: boolean;
    completedToday: boolean;
    streakCount: number;
    risk: {
      level: "none" | "at_risk" | "drifting";
      reason: "streak_at_risk" | "missed_recently" | "low_completion_rate" | null;
      message: string | null;
      dueCount7d: number;
      completedCount7d: number;
      completionRate7d: number;
    };
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

type DeleteWaterLogMutationResponse = {
  generatedAt: string;
  deleted: true;
  waterLogId: string;
};

type MealLogMutationResponse = {
  generatedAt: string;
  mealLog: MealLogsResponse["mealLogs"][number];
};

type DeleteMealLogMutationResponse = {
  generatedAt: string;
  deleted: true;
  mealLogId: string;
};

type WorkoutDayMutationResponse = {
  generatedAt: string;
  workoutDay: NonNullable<HealthSummaryResponse["currentDay"]["workoutDay"]>;
};

type WeightLogMutationResponse = {
  generatedAt: string;
  weightLog: NonNullable<HealthSummaryResponse["currentDay"]["latestWeight"]>;
};

type DeleteWeightLogMutationResponse = {
  generatedAt: string;
  deleted: true;
  weightLogId: string;
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
    recurrence: RecurrenceDefinitionResponse | null;
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

type DeleteExpenseMutationResponse = {
  generatedAt: string;
  deleted: true;
  expenseId: string;
};

export type NotificationCategory = "review" | "finance" | "health" | "habit" | "routine";
export type NotificationMinSeverity = "info" | "warning" | "critical";
export type NotificationRepeatCadence = "off" | "hourly" | "every_3_hours";

export type NotificationCategoryPreference = {
  enabled: boolean;
  minSeverity: NotificationMinSeverity;
  repeatCadence: NotificationRepeatCadence;
};

export type NotificationCategoryPreferences = Record<
  NotificationCategory,
  NotificationCategoryPreference
>;

export type NotificationItem = {
  id: string;
  notificationType: NotificationCategory;
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  ruleKey: string;
  visibleFrom: string | null;
  expiresAt: string | null;
  read: boolean;
  readAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
};

type NotificationsResponse = {
  generatedAt: string;
  notifications: NotificationItem[];
};

type NotificationMutationResponse = {
  generatedAt: string;
  notification: NotificationItem;
};

export type SnoozePreset = "one_hour" | "tonight" | "tomorrow";

type SettingsProfileResponse = {
  generatedAt: string;
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  preferences: {
    timezone: string;
    currencyCode: string;
    weekStartsOn: number;
    dailyWaterTargetMl: number;
    dailyReviewStartTime: string | null;
    dailyReviewEndTime: string | null;
    notificationPreferences: NotificationCategoryPreferences;
  };
};

type UpdateSettingsProfileRequest = {
  displayName?: string;
  timezone?: string;
  currencyCode?: string;
  weekStartsOn?: number;
  dailyWaterTargetMl?: number;
  dailyReviewStartTime?: string | null;
  dailyReviewEndTime?: string | null;
  notificationPreferences?: Partial<Record<NotificationCategory, Partial<NotificationCategoryPreference>>>;
};

type GoalMutationResponse = {
  generatedAt: string;
  goal: GoalsResponse["goals"][number];
};

/* ── Goal Planning Types ─────────────────── */

export type GoalHealthState = "on_track" | "drifting" | "stalled" | "achieved";
export type GoalMomentumTrend = "up" | "down" | "steady";

export type GoalMilestoneCounts = {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
};

export type GoalMomentumPoint = {
  startDate: string;
  endDate: string;
  completedCount: number;
};

export type GoalMomentumSummary = {
  trend: GoalMomentumTrend;
  buckets: GoalMomentumPoint[];
};

export type GoalLinkedSummary = {
  currentDayPriorities: number;
  currentWeekPriorities: number;
  currentMonthPriorities: number;
  pendingTasks: number;
  activeHabits: number;
  dueHabitsToday: number;
};

export type GoalOverviewItem = {
  id: string;
  title: string;
  domain: GoalDomain;
  status: GoalStatus;
  targetDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  progressPercent: number;
  health: GoalHealthState | null;
  nextBestAction: string | null;
  milestoneCounts: GoalMilestoneCounts;
  momentum: GoalMomentumSummary;
  linkedSummary: GoalLinkedSummary;
  lastActivityAt: string | null;
};

export type GoalMilestoneItem = {
  id: string;
  goalId: string;
  title: string;
  targetDate: string | null;
  status: "pending" | "completed";
  completedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type GoalLinkedPriorityItem = {
  id: string;
  slot: 1 | 2 | 3;
  title: string;
  status: "pending" | "completed" | "dropped";
  completedAt: string | null;
  cycleType: "day" | "week" | "month";
  cycleStartDate: string;
  cycleEndDate: string;
};

export type GoalLinkedTaskItem = {
  id: string;
  title: string;
  notes: string | null;
  status: "pending" | "completed" | "dropped";
  scheduledForDate: string | null;
  dueAt: string | null;
  originType: TaskItem["originType"];
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GoalLinkedHabitItem = {
  id: string;
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
};

export type GoalDetailItem = GoalOverviewItem & {
  milestones: GoalMilestoneItem[];
  linkedPriorities: GoalLinkedPriorityItem[];
  linkedTasks: GoalLinkedTaskItem[];
  linkedHabits: GoalLinkedHabitItem[];
};

type GoalDetailResponse = {
  generatedAt: string;
  contextDate: string;
  goal: GoalDetailItem;
};

type GoalMilestonesMutationResponse = {
  generatedAt: string;
  milestones: GoalMilestoneItem[];
};

type CategoryMutationResponse = {
  generatedAt: string;
  category: FinanceCategoriesResponse["categories"][number];
};

type RecurringExpenseMutationResponse = {
  generatedAt: string;
  recurringExpense: RecurringExpensesResponse["recurringExpenses"][number];
};

type MealTemplateMutationResponse = {
  generatedAt: string;
  mealTemplate: MealTemplatesResponse["mealTemplates"][number];
};

type GoalsResponse = {
  generatedAt: string;
  contextDate: string;
  goals: GoalOverviewItem[];
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
    goal: LinkedGoal | null;
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
    goal: LinkedGoal | null;
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

type ReviewSubmissionWindow = {
  isOpen: boolean;
  status: "open" | "too_early" | "too_late" | "wrong_period" | "no_open_window";
  requestedDate: string;
  allowedDate: string | null;
  opensAt: string | null;
  closesAt: string | null;
  timezone: string;
};

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
  isCompleted: boolean;
  submissionWindow: ReviewSubmissionWindow;
  seededTomorrowPriorities: DayPlanResponse["priorities"];
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
  seededNextWeekPriorities?: Array<{
    id: string;
    slot: 1 | 2 | 3;
    title: string;
    status: "pending" | "completed" | "dropped";
    goalId: string | null;
    completedAt: string | null;
  }>;
  submissionWindow: ReviewSubmissionWindow;
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
  seededNextMonthTheme?: string | null;
  seededNextMonthOutcomes?: Array<{
    id: string;
    slot: 1 | 2 | 3;
    title: string;
    status: "pending" | "completed" | "dropped";
    goalId: string | null;
    completedAt: string | null;
  }>;
  submissionWindow: ReviewSubmissionWindow;
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

export type ReviewHistoryCadence = "daily" | "weekly" | "monthly";
export type ReviewHistoryCadenceFilter = "all" | ReviewHistoryCadence;
export type ReviewHistoryRange = "30d" | "90d" | "365d" | "all";

export type ReviewHistoryMetric = {
  key: string;
  label: string;
  value: number | string | null;
  valueLabel: string;
};

export type ReviewHistoryItem = {
  id: string;
  cadence: ReviewHistoryCadence;
  periodStart: string;
  periodEnd: string;
  completedAt: string;
  primaryText: string;
  secondaryText: string | null;
  metrics: ReviewHistoryMetric[];
  frictionTags: DailyFrictionTag[];
  route: string;
};

export type ReviewHistorySummary = {
  totalReviews: number;
  countsByCadence: Record<ReviewHistoryCadence, number>;
  topFrictionTags: Array<{ tag: DailyFrictionTag; count: number }>;
};

export type WeeklyReviewHistoryTrendPoint = {
  startDate: string;
  endDate: string;
  averageDailyScore: number;
  habitCompletionRate: number;
  strongDayCount: number;
};

export type MonthlyReviewHistoryTrendPoint = {
  startDate: string;
  endDate: string;
  averageWeeklyMomentum: number;
  waterSuccessRate: number;
  workoutCount: number;
};

export type ReviewHistoryPeriodComparison<TMetrics extends Record<string, number>> = {
  currentPeriodStart: string;
  currentPeriodEnd: string;
  previousPeriodStart: string;
  previousPeriodEnd: string;
  currentLabel: string;
  previousLabel: string;
  currentText: string;
  previousText: string;
  metrics: {
    current: TMetrics;
    previous: TMetrics;
    delta: TMetrics;
  };
};

export type WeeklyComparisonMetrics = {
  averageDailyScore: number;
  habitCompletionRate: number;
  strongDayCount: number;
};

export type MonthlyComparisonMetrics = {
  averageWeeklyMomentum: number;
  waterSuccessRate: number;
  workoutCount: number;
};

export type ReviewHistoryResponse = {
  generatedAt: string;
  items: ReviewHistoryItem[];
  nextCursor: string | null;
  summary: ReviewHistorySummary;
  weeklyTrend: WeeklyReviewHistoryTrendPoint[];
  monthlyTrend: MonthlyReviewHistoryTrendPoint[];
  comparisons: {
    weekly: ReviewHistoryPeriodComparison<WeeklyComparisonMetrics> | null;
    monthly: ReviewHistoryPeriodComparison<MonthlyComparisonMetrics> | null;
  };
};

export type ReviewHistoryQueryParams = {
  cadence?: ReviewHistoryCadenceFilter;
  range?: ReviewHistoryRange;
  q?: string;
  cursor?: string;
  limit?: number;
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

type SectionError = {
  message: string;
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const CSRF_COOKIE_NAMES = [
  import.meta.env.VITE_CSRF_COOKIE_NAME,
  "life_os_csrf_dev",
  "life_os_csrf",
].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const queryKeys = {
  session: ["session"] as const,
  onboarding: ["onboarding"] as const,
  home: (date: string) => ["home", date] as const,
  score: (date: string) => ["score", "daily", date] as const,
  weeklyMomentum: (date: string) => ["score", "weekly-momentum", date] as const,
  dayPlan: (date: string) => ["planning", "day", date] as const,
  tasks: (filters: TasksQueryFilters = {}) =>
    [
      "tasks",
      filters.scheduledForDate ?? "all",
      filters.from ?? "all",
      filters.to ?? "all",
      filters.status ?? "all",
      filters.originType ?? "all",
      filters.scheduledState ?? "all",
    ] as const,
  habits: ["habits"] as const,
  health: (date: string) => ["health", date] as const,
  finance: (month: string) => ["finance", month] as const,
  financeCategories: ["finance", "categories"] as const,
  financeRecurring: ["finance", "recurring"] as const,
  goals: (weekStart: string, monthStart: string) => ["goals", weekStart, monthStart] as const,
  goalsAll: ["goals", "all"] as const,
  goalsFiltered: (domain?: string, status?: string) =>
    ["goals", "filtered", domain ?? "all", status ?? "all"] as const,
  goalDetail: (goalId: string) => ["goals", "detail", goalId] as const,
  review: (cadence: ReviewCadence, dateKey: string) => ["review", cadence, dateKey] as const,
  reviewHistory: (params: ReviewHistoryQueryParams) =>
    ["reviewHistory", params.cadence ?? "all", params.range ?? "90d", params.q ?? "", params.cursor ?? ""] as const,
  notifications: ["notifications"] as const,
  settings: ["settings"] as const,
  mealTemplates: ["health", "meal-templates"] as const,
  taskTemplates: ["planning", "task-templates"] as const,
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

function getCsrfToken() {
  for (const cookieName of CSRF_COOKIE_NAMES) {
    const token = getCookie(cookieName);
    if (token) {
      return token;
    }
  }

  return null;
}

async function readErrorPayload(response: Response) {
  try {
    return (await response.json()) as ApiErrorResponse;
  } catch {
    return undefined;
  }
}

function toSectionError(error: unknown, fallback: string): SectionError {
  if (error instanceof Error && error.message.trim()) {
    return {
      message: error.message,
    };
  }

  return {
    message: fallback,
  };
}

function unwrapRequiredResult<T>(result: PromiseSettledResult<T>, fallback: string) {
  if (result.status === "fulfilled") {
    return result.value;
  }

  throw result.reason instanceof Error ? result.reason : new Error(fallback);
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
    const csrfToken = getCsrfToken();
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

  void queryClient.invalidateQueries({ queryKey: ["tasks"] });
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

function invalidateTaskTemplateData(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.taskTemplates });
}

export function padNumber(value: number) {
  return String(value).padStart(2, "0");
}

export function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

function getResolvedTimezone() {
  const preferredTimezone = getPreferredTimezone();

  if (!preferredTimezone) {
    return undefined;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: preferredTimezone });
    return preferredTimezone;
  } catch {
    return undefined;
  }
}

function formatIsoDateInTimezone(date: Date, timezone?: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  });

  return formatter.format(date);
}

export function getTodayDate() {
  const timezone = getResolvedTimezone();
  return formatIsoDateInTimezone(new Date(), timezone);
}

export function getMonthString(isoDate: string) {
  return isoDate.slice(0, 7);
}

export function getWeekStartDate(isoDate: string) {
  return getPreferenceAwareWeekStartDate(isoDate);
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
  const timezone = getResolvedTimezone();

  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(timezone ? { timeZone: timezone } : {}),
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

export function useTasksQuery(filters: TasksQueryFilters = {}) {
  return useQuery({
    queryKey: queryKeys.tasks(filters),
    queryFn: () =>
      apiRequest<TasksResponse>("/api/tasks", {
        query: {
          scheduledForDate: filters.scheduledForDate,
          from: filters.from,
          to: filters.to,
          status: filters.status,
          originType: filters.originType,
          scheduledState: filters.scheduledState,
        },
      }),
    retry: false,
  });
}

export function useInboxQuery() {
  return useTasksQuery({
    status: "pending",
    scheduledState: "unscheduled",
  });
}

export function useTaskTemplatesQuery() {
  return useQuery({
    queryKey: queryKeys.taskTemplates,
    queryFn: () => apiRequest<TaskTemplatesResponse>("/api/task-templates"),
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
      const [summaryResult, waterLogsResult, mealTemplatesResult, mealLogsResult] =
        await Promise.allSettled([
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
        summary: unwrapRequiredResult(summaryResult, "Health summary could not load."),
        waterLogs:
          waterLogsResult.status === "fulfilled" ? waterLogsResult.value : null,
        mealTemplates:
          mealTemplatesResult.status === "fulfilled" ? mealTemplatesResult.value : null,
        mealLogs:
          mealLogsResult.status === "fulfilled" ? mealLogsResult.value : null,
        sectionErrors: {
          waterLogs:
            waterLogsResult.status === "rejected"
              ? toSectionError(waterLogsResult.reason, "Water logs could not load.")
              : null,
          mealTemplates:
            mealTemplatesResult.status === "rejected"
              ? toSectionError(mealTemplatesResult.reason, "Meal templates could not load.")
              : null,
          mealLogs:
            mealLogsResult.status === "rejected"
              ? toSectionError(mealLogsResult.reason, "Meal logs could not load.")
              : null,
        },
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
      const [summaryResult, expensesResult, recurringExpensesResult, categoriesResult] =
        await Promise.allSettled([
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
        summary: unwrapRequiredResult(summaryResult, "Finance summary could not load."),
        expenses: expensesResult.status === "fulfilled" ? expensesResult.value : null,
        recurringExpenses:
          recurringExpensesResult.status === "fulfilled"
            ? recurringExpensesResult.value
            : null,
        categories:
          categoriesResult.status === "fulfilled" ? categoriesResult.value : null,
        sectionErrors: {
          expenses:
            expensesResult.status === "rejected"
              ? toSectionError(expensesResult.reason, "Expenses could not load.")
              : null,
          recurringExpenses:
            recurringExpensesResult.status === "rejected"
              ? toSectionError(recurringExpensesResult.reason, "Recurring bills could not load.")
              : null,
          categories:
            categoriesResult.status === "rejected"
              ? toSectionError(categoriesResult.reason, "Categories could not load.")
              : null,
        },
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
      const [goalsResult, weekPlanResult, monthPlanResult] = await Promise.allSettled([
        apiRequest<GoalsResponse>("/api/goals"),
        apiRequest<WeekPlanResponse>(`/api/planning/weeks/${weekStart}`),
        apiRequest<MonthPlanResponse>(`/api/planning/months/${monthStart}`),
      ]);

      return {
        goals: unwrapRequiredResult(goalsResult, "Goals could not load."),
        weekPlan: weekPlanResult.status === "fulfilled" ? weekPlanResult.value : null,
        monthPlan: monthPlanResult.status === "fulfilled" ? monthPlanResult.value : null,
        sectionErrors: {
          weekPlan:
            weekPlanResult.status === "rejected"
              ? toSectionError(weekPlanResult.reason, "Weekly priorities could not load.")
              : null,
          monthPlan:
            monthPlanResult.status === "rejected"
              ? toSectionError(monthPlanResult.reason, "Monthly focus could not load.")
              : null,
        },
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
        const [reviewResult, momentumResult] = await Promise.allSettled([
          apiRequest<WeeklyReviewResponse>(`/api/reviews/weekly/${keyDate}`),
          apiRequest<WeeklyMomentumResponse>("/api/scores/weekly-momentum", {
            query: { endingOn: getWeekEndDate(date) },
          }),
        ]);

        return {
          cadence,
          keyDate,
          review: unwrapRequiredResult(reviewResult, "Weekly review data could not load."),
          momentum:
            momentumResult.status === "fulfilled" ? momentumResult.value : null,
          momentumError:
            momentumResult.status === "rejected"
              ? toSectionError(momentumResult.reason, "Weekly momentum could not load.")
              : null,
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

export function useReviewHistoryQuery(params: ReviewHistoryQueryParams) {
  return useQuery({
    queryKey: queryKeys.reviewHistory(params),
    queryFn: () =>
      apiRequest<ReviewHistoryResponse>("/api/reviews/history", {
        query: {
          cadence: params.cadence && params.cadence !== "all" ? params.cadence : undefined,
          range: params.range,
          q: params.q || undefined,
          cursor: params.cursor || undefined,
          limit: params.limit ? String(params.limit) : undefined,
        },
      }),
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
    meta: {
      successMessage: "Signed in.",
      errorMessage: "Sign-in failed.",
    },
    onSuccess: (data) => {
      queryClient.setQueryData<SessionResponse>(queryKeys.session, {
        authenticated: true,
        generatedAt: new Date().toISOString(),
        user: data.user,
      });

      void queryClient.invalidateQueries({ queryKey: queryKeys.session });
      void queryClient.invalidateQueries({ queryKey: queryKeys.onboarding });
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiRequest<LogoutResponse>("/api/auth/logout", {
        method: "POST",
      }),
    meta: {
      successMessage: "Signed out.",
      errorMessage: "Sign-out failed.",
    },
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData<SessionResponse>(queryKeys.session, {
        authenticated: false,
        generatedAt: new Date().toISOString(),
        user: null,
      });
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
    meta: {
      successMessage: "Setup complete.",
      errorMessage: "Setup could not be completed.",
    },
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
    meta: {
      successMessage: "Task updated.",
      errorMessage: "Task update failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
}

export function useCarryForwardTaskMutation(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, targetDate }: { taskId: string; targetDate: string }) =>
      apiRequest<TaskMutationResponse>(`/api/tasks/${taskId}/carry-forward`, {
        method: "POST",
        body: { targetDate },
      }),
    meta: {
      successMessage: "Task rescheduled.",
      errorMessage: "Task reschedule failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
}

export function useUpdatePriorityMutation(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      priorityId,
      title,
      status,
    }: {
      priorityId: string;
      title?: string;
      status?: "pending" | "completed" | "dropped";
    }) =>
      apiRequest<PriorityMutationResponse>(`/api/planning/priorities/${priorityId}`, {
        method: "PATCH",
        body: { title, status },
      }),
    meta: {
      successMessage: "Priority updated.",
      errorMessage: "Priority update failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
}

export function useUpdateDayPrioritiesMutation(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { priorities: DayPriorityInput[] }) =>
      apiRequest<DayPrioritiesMutationResponse>(`/api/planning/days/${date}/priorities`, {
        method: "PUT",
        body: payload,
      }),
    meta: {
      successMessage: "Priorities updated.",
      errorMessage: "Priority update failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
}

export function useUpdateTaskMutation(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      title,
      notes,
      status,
      scheduledForDate,
      goalId,
      dueAt,
      recurrence,
      carryPolicy,
    }: {
      taskId: string;
      title?: string;
      notes?: string | null;
      status?: "pending" | "completed" | "dropped";
      scheduledForDate?: string | null;
      goalId?: string | null;
      dueAt?: string | null;
      recurrence?: RecurrenceInputPayload;
      carryPolicy?: "complete_and_clone" | "move_due_date" | "cancel" | null;
    }) =>
      apiRequest<TaskMutationResponse>(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: {
          title,
          notes,
          status,
          scheduledForDate,
          goalId,
          dueAt,
          recurrence,
          carryPolicy,
        },
      }),
    meta: {
      successMessage: "Task updated.",
      errorMessage: "Task update failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
}

export function useBulkUpdateTasksMutation(
  date: string,
  options?: {
    onSuccess?: (response: BulkTaskMutationResponse) => void;
  },
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BulkUpdateTasksInput) =>
      apiRequest<BulkTaskMutationResponse>("/api/tasks/bulk", {
        method: "PATCH",
        body: payload,
      }),
    meta: {
      errorMessage: "Bulk inbox update failed.",
    },
    onSuccess: (response) => {
      invalidateCoreData(queryClient, date);
      options?.onSuccess?.(response);
    },
  });
}

export function useCreateTaskMutation(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      title: string;
      notes?: string | null;
      scheduledForDate?: string | null;
      originType?: "manual" | "quick_capture" | "carry_forward" | "review_seed" | "recurring" | "template";
      goalId?: string | null;
      dueAt?: string | null;
      recurrence?: RecurrenceInputPayload;
      carryPolicy?: "complete_and_clone" | "move_due_date" | "cancel";
    }) =>
      apiRequest<TaskMutationResponse>("/api/tasks", {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Captured to inbox.",
      errorMessage: "Task capture failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
}

export function useCreateTaskTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      name: string;
      description?: string | null;
      tasks: TaskTemplateTask[];
    }) =>
      apiRequest<TaskTemplateMutationResponse>("/api/task-templates", {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Workflow template created.",
      errorMessage: "Workflow template creation failed.",
    },
    onSuccess: () => invalidateTaskTemplateData(queryClient),
  });
}

export function useUpdateTaskTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskTemplateId,
      name,
      description,
      tasks,
      archived,
    }: {
      taskTemplateId: string;
      name?: string;
      description?: string | null;
      tasks?: TaskTemplateTask[];
      archived?: boolean;
    }) =>
      apiRequest<TaskTemplateMutationResponse>(`/api/task-templates/${taskTemplateId}`, {
        method: "PATCH",
        body: {
          name,
          description,
          tasks,
          archived,
        },
      }),
    meta: {
      successMessage: "Workflow template updated.",
      errorMessage: "Workflow template update failed.",
    },
    onSuccess: () => invalidateTaskTemplateData(queryClient),
  });
}

export function useApplyTaskTemplateMutation(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskTemplateId: string) =>
      apiRequest<ApplyTaskTemplateResponse>(`/api/task-templates/${taskTemplateId}/apply`, {
        method: "POST",
      }),
    meta: {
      successMessage: "Workflow template applied.",
      errorMessage: "Workflow template apply failed.",
    },
    onSuccess: () => {
      invalidateTaskTemplateData(queryClient);
      invalidateCoreData(queryClient, date);
    },
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
    meta: {
      successMessage: "Habit logged.",
      errorMessage: "Habit log failed.",
    },
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
    meta: {
      successMessage: "Routine item completed.",
      errorMessage: "Routine update failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
}

/* ── Habits CRUD ────────────────────────────── */

export function useCreateHabitMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      title: string;
      category?: string | null;
      scheduleRule?: { daysOfWeek?: number[] };
      recurrence?: RecurrenceInputPayload;
      targetPerDay?: number;
      goalId?: string | null;
    }) =>
      apiRequest<HabitMutationResponse>("/api/habits", {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Habit created.",
      errorMessage: "Habit creation failed.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.habits });
    },
  });
}

export function useUpdateHabitMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      habitId,
      ...payload
    }: {
      habitId: string;
      title?: string;
      category?: string | null;
      scheduleRule?: { daysOfWeek?: number[] };
      recurrence?: RecurrenceInputPayload;
      targetPerDay?: number;
      status?: "active" | "paused" | "archived";
      goalId?: string | null;
    }) =>
      apiRequest<HabitMutationResponse>(`/api/habits/${habitId}`, {
        method: "PATCH",
        body: payload,
      }),
    meta: {
      successMessage: "Habit updated.",
      errorMessage: "Habit update failed.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.habits });
    },
  });
}

/* ── Routines CRUD ─────────────────────────── */

export function useCreateRoutineMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      name: string;
      period: "morning" | "evening";
      items: Array<{ title: string; sortOrder: number; isRequired?: boolean }>;
    }) =>
      apiRequest<RoutineMutationResponse>("/api/routines", {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Routine created.",
      errorMessage: "Routine creation failed.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.habits });
    },
  });
}

export function useUpdateRoutineMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      routineId,
      ...payload
    }: {
      routineId: string;
      name?: string;
      status?: "active" | "archived";
      items?: Array<{ title: string; sortOrder: number; isRequired?: boolean }>;
    }) =>
      apiRequest<RoutineMutationResponse>(`/api/routines/${routineId}`, {
        method: "PATCH",
        body: payload,
      }),
    meta: {
      successMessage: "Routine updated.",
      errorMessage: "Routine update failed.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.habits });
    },
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
    meta: {
      successMessage: "Water logged.",
      errorMessage: "Water log failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
}

export function useUpdateWaterLogMutation(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      waterLogId,
      ...payload
    }: {
      waterLogId: string;
      occurredAt?: string;
      amountMl?: number;
      source?: "tap" | "quick_capture" | "manual";
    }) =>
      apiRequest<WaterLogMutationResponse>(`/api/health/water-logs/${waterLogId}`, {
        method: "PATCH",
        body: payload,
      }),
    meta: {
      successMessage: "Water log updated.",
      errorMessage: "Water log update failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
}

export function useDeleteWaterLogMutation(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (waterLogId: string) =>
      apiRequest<DeleteWaterLogMutationResponse>(`/api/health/water-logs/${waterLogId}`, {
        method: "DELETE",
      }),
    meta: {
      successMessage: "Water log deleted.",
      errorMessage: "Water log deletion failed.",
    },
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
    meta: {
      successMessage: "Meal logged.",
      errorMessage: "Meal log failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
}

export function useUpdateMealLogMutation(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      mealLogId,
      ...payload
    }: {
      mealLogId: string;
      occurredAt?: string;
      mealSlot?: "breakfast" | "lunch" | "dinner" | "snack" | null;
      mealTemplateId?: string | null;
      description?: string;
      loggingQuality?: "partial" | "meaningful" | "full";
    }) =>
      apiRequest<MealLogMutationResponse>(`/api/health/meal-logs/${mealLogId}`, {
        method: "PATCH",
        body: payload,
      }),
    meta: {
      successMessage: "Meal log updated.",
      errorMessage: "Meal log update failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
}

export function useDeleteMealLogMutation(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mealLogId: string) =>
      apiRequest<DeleteMealLogMutationResponse>(`/api/health/meal-logs/${mealLogId}`, {
        method: "DELETE",
      }),
    meta: {
      successMessage: "Meal log deleted.",
      errorMessage: "Meal log deletion failed.",
    },
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
    meta: {
      successMessage: "Workout updated.",
      errorMessage: "Workout update failed.",
    },
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
    meta: {
      successMessage: "Weight logged.",
      errorMessage: "Weight log failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
}

export function useUpdateWeightLogMutation(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      weightLogId,
      ...payload
    }: {
      weightLogId: string;
      measuredOn?: string;
      weightValue?: number;
      unit?: string;
      note?: string | null;
    }) =>
      apiRequest<WeightLogMutationResponse>(`/api/health/weight-logs/${weightLogId}`, {
        method: "PATCH",
        body: payload,
      }),
    meta: {
      successMessage: "Weight log updated.",
      errorMessage: "Weight log update failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
}

export function useDeleteWeightLogMutation(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (weightLogId: string) =>
      apiRequest<DeleteWeightLogMutationResponse>(`/api/health/weight-logs/${weightLogId}`, {
        method: "DELETE",
      }),
    meta: {
      successMessage: "Weight log deleted.",
      errorMessage: "Weight log deletion failed.",
    },
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
    meta: {
      successMessage: "Expense logged.",
      errorMessage: "Expense log failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
}

export function useUpdateExpenseMutation(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      expenseId,
      ...payload
    }: {
      expenseId: string;
      spentOn?: string;
      amountMinor?: number;
      currencyCode?: string;
      description?: string | null;
      expenseCategoryId?: string | null;
    }) =>
      apiRequest<ExpenseMutationResponse>(`/api/finance/expenses/${expenseId}`, {
        method: "PATCH",
        body: payload,
      }),
    meta: {
      successMessage: "Expense updated.",
      errorMessage: "Expense update failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
}

export function useDeleteExpenseMutation(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (expenseId: string) =>
      apiRequest<DeleteExpenseMutationResponse>(`/api/finance/expenses/${expenseId}`, {
        method: "DELETE",
      }),
    meta: {
      successMessage: "Expense deleted.",
      errorMessage: "Expense deletion failed.",
    },
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
        id?: string;
        slot: 1 | 2 | 3;
        title: string;
        goalId?: string | null;
      }>;
    }) =>
      apiRequest<DailyReviewMutationResponse>(`/api/reviews/daily/${date}`, {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Daily review submitted.",
      errorMessage: "Daily review submission failed.",
    },
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
    meta: {
      successMessage: "Weekly review submitted.",
      errorMessage: "Weekly review submission failed.",
    },
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
    meta: {
      successMessage: "Monthly review submitted.",
      errorMessage: "Monthly review submission failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
}

/* ── Notifications ─────────────────────────── */

export function useNotificationsQuery() {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => apiRequest<NotificationsResponse>("/api/notifications"),
    retry: false,
  });
}

export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      apiRequest<NotificationMutationResponse>(
        `/api/notifications/${notificationId}/read`,
        { method: "POST" },
      ),
    meta: {
      successMessage: "Notification marked as read.",
      errorMessage: "Could not mark notification as read.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}

export function useDismissNotificationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      apiRequest<NotificationMutationResponse>(
        `/api/notifications/${notificationId}/dismiss`,
        { method: "POST" },
      ),
    meta: {
      successMessage: "Notification dismissed.",
      errorMessage: "Could not dismiss notification.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}

export function useSnoozeNotificationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ notificationId, preset }: { notificationId: string; preset: SnoozePreset }) =>
      apiRequest<NotificationMutationResponse>(
        `/api/notifications/${notificationId}/snooze`,
        { method: "POST", body: { preset } },
      ),
    meta: {
      successMessage: "Notification snoozed.",
      errorMessage: "Could not snooze notification.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}

/* ── Settings ──────────────────────────────── */

export function useSettingsProfileQuery() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => apiRequest<SettingsProfileResponse>("/api/settings/profile"),
    retry: false,
  });
}

export function useUpdateSettingsProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateSettingsProfileRequest) =>
      apiRequest<SettingsProfileResponse>("/api/settings/profile", {
        method: "PUT",
        body: payload,
      }),
    meta: {
      successMessage: "Settings saved.",
      errorMessage: "Settings could not be saved.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
      void queryClient.invalidateQueries({ queryKey: queryKeys.session });
    },
  });
}

/* ── Goals CRUD ────────────────────────────── */

export function useGoalsListQuery() {
  return useQuery({
    queryKey: queryKeys.goalsAll,
    queryFn: () => apiRequest<GoalsResponse>("/api/goals"),
    retry: false,
  });
}

export type GoalDomain = "health" | "money" | "work_growth" | "home_admin" | "discipline" | "other";
export type GoalStatus = "active" | "paused" | "completed" | "archived";

export function useFilteredGoalsQuery(filters?: { domain?: GoalDomain; status?: GoalStatus }) {
  const domain = filters?.domain;
  const status = filters?.status;

  return useQuery({
    queryKey: queryKeys.goalsFiltered(domain, status),
    queryFn: () =>
      apiRequest<GoalsResponse>("/api/goals", {
        query: {
          domain,
          status,
        },
      }),
    retry: false,
  });
}

export function useCreateGoalMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      title: string;
      domain: "health" | "money" | "work_growth" | "home_admin" | "discipline" | "other";
      targetDate?: string | null;
      notes?: string | null;
    }) =>
      apiRequest<GoalMutationResponse>("/api/goals", {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Goal created.",
      errorMessage: "Goal creation failed.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.goalsAll });
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });
}

export function useUpdateGoalMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      goalId,
      ...payload
    }: {
      goalId: string;
      title?: string;
      domain?: "health" | "money" | "work_growth" | "home_admin" | "discipline" | "other";
      status?: "active" | "paused" | "completed" | "archived";
      targetDate?: string | null;
      notes?: string | null;
    }) =>
      apiRequest<GoalMutationResponse>(`/api/goals/${goalId}`, {
        method: "PATCH",
        body: payload,
      }),
    meta: {
      successMessage: "Goal updated.",
      errorMessage: "Goal update failed.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.goalsAll });
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });
}

export function useGoalDetailQuery(goalId: string | null) {
  return useQuery({
    queryKey: queryKeys.goalDetail(goalId ?? ""),
    queryFn: () => apiRequest<GoalDetailResponse>(`/api/goals/${goalId}`),
    enabled: !!goalId,
    retry: false,
  });
}

export function useUpdateGoalMilestonesMutation(goalId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      milestones: Array<{
        id?: string;
        title: string;
        targetDate?: string | null;
        status: "pending" | "completed";
      }>;
    }) =>
      apiRequest<GoalMilestonesMutationResponse>(
        `/api/goals/${goalId}/milestones`,
        { method: "PUT", body: payload },
      ),
    meta: {
      successMessage: "Milestones saved.",
      errorMessage: "Milestones could not be saved.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.goalDetail(goalId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.goalsAll });
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });
}

export function useUpdateWeekPrioritiesMutation(weekStartDate: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      priorities: Array<{
        id?: string;
        slot: 1 | 2 | 3;
        title: string;
        goalId?: string | null;
      }>;
    }) =>
      apiRequest<WeekPlanResponse>(
        `/api/planning/weeks/${weekStartDate}/priorities`,
        { method: "PUT", body: payload },
      ),
    meta: {
      successMessage: "Weekly priorities saved.",
      errorMessage: "Weekly priorities update failed.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });
}

export function useUpdateMonthFocusMutation(monthStartDate: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      theme?: string;
      topOutcomes?: Array<{
        id?: string;
        slot: 1 | 2 | 3;
        title: string;
        goalId?: string | null;
      }>;
    }) =>
      apiRequest<MonthPlanResponse>(
        `/api/planning/months/${monthStartDate}/focus`,
        { method: "PUT", body: payload },
      ),
    meta: {
      successMessage: "Monthly focus saved.",
      errorMessage: "Monthly focus update failed.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });
}

/* ── Finance CRUD ──────────────────────────── */

export function useCreateCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { name: string; color?: string | null }) =>
      apiRequest<CategoryMutationResponse>("/api/finance/categories", {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Category created.",
      errorMessage: "Category creation failed.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.financeCategories });
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
  });
}

export function useUpdateCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      categoryId,
      ...payload
    }: {
      categoryId: string;
      name?: string;
      color?: string | null;
      archivedAt?: string | null;
    }) =>
      apiRequest<CategoryMutationResponse>(
        `/api/finance/categories/${categoryId}`,
        { method: "PATCH", body: payload },
      ),
    meta: {
      successMessage: "Category updated.",
      errorMessage: "Category update failed.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.financeCategories });
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
  });
}

export function useCreateRecurringExpenseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      title: string;
      expenseCategoryId?: string | null;
      defaultAmountMinor?: number | null;
      currencyCode?: string;
      recurrenceRule?: string;
      recurrence?: RecurrenceInputPayload;
      nextDueOn: string;
      remindDaysBefore?: number;
    }) =>
      apiRequest<RecurringExpenseMutationResponse>("/api/finance/recurring-expenses", {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Recurring expense created.",
      errorMessage: "Recurring expense creation failed.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.financeRecurring });
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
  });
}

export function useUpdateRecurringExpenseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recurringExpenseId,
      ...payload
    }: {
      recurringExpenseId: string;
      title?: string;
      expenseCategoryId?: string | null;
      defaultAmountMinor?: number | null;
      recurrenceRule?: string;
      recurrence?: RecurrenceInputPayload;
      nextDueOn?: string;
      remindDaysBefore?: number;
      status?: "active" | "paused" | "archived";
    }) =>
      apiRequest<RecurringExpenseMutationResponse>(
        `/api/finance/recurring-expenses/${recurringExpenseId}`,
        { method: "PATCH", body: payload },
      ),
    meta: {
      successMessage: "Recurring expense updated.",
      errorMessage: "Recurring expense update failed.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.financeRecurring });
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
  });
}

/* ── Meal templates CRUD ───────────────────── */

export function useMealTemplatesQuery() {
  return useQuery({
    queryKey: queryKeys.mealTemplates,
    queryFn: () => apiRequest<MealTemplatesResponse>("/api/health/meal-templates"),
    retry: false,
  });
}

export function useCreateMealTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      name: string;
      mealSlot?: "breakfast" | "lunch" | "dinner" | "snack" | null;
      description?: string;
    }) =>
      apiRequest<MealTemplateMutationResponse>("/api/health/meal-templates", {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Meal template created.",
      errorMessage: "Meal template creation failed.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.mealTemplates });
      void queryClient.invalidateQueries({ queryKey: ["health"] });
    },
  });
}

export function useUpdateMealTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      mealTemplateId,
      ...payload
    }: {
      mealTemplateId: string;
      name?: string;
      mealSlot?: "breakfast" | "lunch" | "dinner" | "snack" | null;
      description?: string | null;
      archived?: boolean;
    }) =>
      apiRequest<MealTemplateMutationResponse>(
        `/api/health/meal-templates/${mealTemplateId}`,
        { method: "PATCH", body: payload },
      ),
    meta: {
      successMessage: "Meal template updated.",
      errorMessage: "Meal template update failed.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.mealTemplates });
      void queryClient.invalidateQueries({ queryKey: ["health"] });
    },
  });
}

/* ── Preference-aware date helpers ─────────── */

let _cachedWeekStartsOn: number | null = null;
let _cachedTimezone: string | null = null;

export function setPreferredWeekStart(day: number) {
  _cachedWeekStartsOn = day;
}

export function setPreferredTimezone(tz: string) {
  _cachedTimezone = tz;
}

export function getPreferredWeekStartsOn(): number {
  return _cachedWeekStartsOn ?? 1;
}

export function getPreferredTimezone(): string | null {
  return _cachedTimezone;
}

export function getPreferenceAwareWeekStartDate(isoDate: string) {
  const weekStartsOn = getPreferredWeekStartsOn();
  const date = new Date(`${isoDate}T12:00:00`);
  const day = date.getDay();
  const diff = ((day - weekStartsOn + 7) % 7);
  date.setDate(date.getDate() - diff);
  return toIsoDate(date);
}
