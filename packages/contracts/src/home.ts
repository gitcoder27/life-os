import type { ApiMeta, EntityId, IsoDateString } from "./common.js";
import type { GoalSummary } from "./goals.js";
import type { WeeklyHabitChallenge } from "./habits.js";
import type { TaskKind, TaskOriginType } from "./planning.js";

export interface DailyScoreSnapshot {
  value: number;
  label: "Strong Day" | "Solid Day" | "Recovering Day" | "Off-Track Day";
  earnedPoints: number;
  possiblePoints: number;
}

export interface PriorityItem {
  id: EntityId;
  title: string;
  slot: 1 | 2 | 3;
  status: "pending" | "completed" | "dropped";
  goalId: EntityId | null;
  goal: GoalSummary | null;
}

export interface TaskItem {
  id: EntityId;
  title: string;
  status: "pending" | "completed" | "dropped";
  scheduledForDate: IsoDateString | null;
  dueAt: string | null;
  goalId: EntityId | null;
  goal: GoalSummary | null;
  notes: string | null;
  kind: TaskKind;
  reminderAt: string | null;
  originType: TaskOriginType;
}

export interface RoutineSummary {
  completedItems: number;
  totalItems: number;
  currentPeriod: "morning" | "evening" | "none";
}

export interface HabitSummary {
  completedToday: number;
  dueToday: number;
  streakHighlights: string[];
}

export interface HealthSummary {
  waterMl: number;
  waterTargetMl: number;
  mealsLogged: number;
  workoutStatus: "completed" | "recovery_respected" | "fallback" | "missed" | "none";
}

export interface FinanceSummary {
  spentThisMonthMinor: number;
  currencyCode: string;
  budgetLabel: string;
  upcomingBills: number;
  focusBill: {
    id: EntityId;
    title: string;
    dueOn: IsoDateString;
    amountMinor: number | null;
    status: "pending" | "rescheduled";
  } | null;
  action: HomeAction;
}

export interface AccountabilityRadarItem {
  id: EntityId;
  kind: "overdue_task" | "stale_inbox";
  title: string;
  route: string;
  label: string;
  ageDays: number;
  scheduledForDate: IsoDateString | null;
  createdAt: string | null;
  notes: string | null;
  taskKind: TaskKind;
  reminderAt: string | null;
  originType: TaskOriginType;
}

export interface AccountabilityRadar {
  overdueTaskCount: number;
  staleInboxCount: number;
  totalCount: number;
  overflowCount: number;
  items: AccountabilityRadarItem[];
}

export interface AttentionItem {
  id: EntityId;
  title: string;
  kind: "task" | "habit" | "routine" | "finance" | "admin" | "review" | "notification";
  tone: "info" | "warning" | "urgent";
  detail?: string;
  dismissible?: boolean;
  action: HomeAction;
}

export type HomeDestination =
  | {
      kind: "today_planning";
      date: IsoDateString;
    }
  | {
      kind: "today_execute";
      priorityId?: EntityId | null;
      taskId?: EntityId | null;
    }
  | {
      kind: "today_overdue";
      taskId?: EntityId | null;
    }
  | {
      kind: "inbox_triage";
    }
  | {
      kind: "habit_focus";
      habitId?: EntityId | null;
      surface: "due_today" | "weekly_challenge";
    }
  | {
      kind: "health_focus";
      surface: "water" | "meals" | "workout" | "patterns";
    }
  | {
      kind: "finance_bills";
      adminItemId?: EntityId | null;
      section: "due_now" | "pending_bills";
    }
  | {
      kind: "goal_plan";
      goalId?: EntityId | null;
      mode: "overview" | "plan";
    }
  | {
      kind: "review";
      cadence: "daily" | "weekly" | "monthly";
      date: IsoDateString;
    };

export type HomeAction =
  | {
      type: "open_review";
      route: string;
    }
  | {
      type: "open_route";
      route: string;
    }
  | {
      type: "open_destination";
      destination: HomeDestination;
    };

export interface HomeNotificationItem {
  id: EntityId;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface HomeRecoveryGuidance {
  tone: "steady" | "recovery";
  title: string;
  detail: string;
}

export interface HomeGuidanceRecommendation {
  id: EntityId;
  kind: "habit" | "priority" | "task" | "review" | "health";
  title: string;
  detail: string;
  impactLabel: string;
  action: HomeAction;
}

export interface HomeGuidance {
  recovery: HomeRecoveryGuidance | null;
  weeklyChallenge: WeeklyHabitChallenge | null;
  recommendations: HomeGuidanceRecommendation[];
}

export interface HomeQuote {
  text: string;
  author: string;
  attributionUrl: string;
}

export interface HomeQuoteResponse extends ApiMeta {
  quote: HomeQuote;
}

export interface HomeOverviewResponse extends ApiMeta {
  date: IsoDateString;
  greeting: string;
  phase: "morning" | "midday" | "evening";
  dailyScore: DailyScoreSnapshot;
  weeklyMomentum: number;
  topPriorities: PriorityItem[];
  tasks: TaskItem[];
  routineSummary: RoutineSummary;
  habitSummary: HabitSummary;
  healthSummary: HealthSummary;
  financeSummary: FinanceSummary;
  accountabilityRadar: AccountabilityRadar;
  attentionItems: AttentionItem[];
  notifications: HomeNotificationItem[];
  guidance: HomeGuidance;
}
