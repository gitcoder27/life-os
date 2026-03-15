import type { ApiMeta, EntityId, IsoDateString } from "./common.js";

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
}

export interface TaskItem {
  id: EntityId;
  title: string;
  status: "pending" | "completed" | "dropped";
  scheduledForDate: IsoDateString | null;
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
  spentThisMonth: number;
  budgetLabel: string;
  upcomingBills: number;
}

export interface AttentionItem {
  id: EntityId;
  title: string;
  kind: "task" | "habit" | "routine" | "finance" | "admin" | "review" | "notification";
  tone: "info" | "warning" | "urgent";
  detail?: string;
  action:
    | {
        type: "complete_task";
        entityId: EntityId;
      }
    | {
        type: "complete_habit";
        entityId: EntityId;
      }
    | {
        type: "open_review";
        route: string;
      }
    | {
        type: "open_route";
        route: string;
      };
}

export interface HomeNotificationItem {
  id: EntityId;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface HomeOverviewResponse extends ApiMeta {
  date: IsoDateString;
  greeting: string;
  dailyScore: DailyScoreSnapshot;
  weeklyMomentum: number;
  topPriorities: PriorityItem[];
  tasks: TaskItem[];
  routineSummary: RoutineSummary;
  habitSummary: HabitSummary;
  healthSummary: HealthSummary;
  financeSummary: FinanceSummary;
  attentionItems: AttentionItem[];
  notifications: HomeNotificationItem[];
}
