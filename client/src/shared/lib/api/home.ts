import { useQuery } from "@tanstack/react-query";

import {
  apiRequest,
  queryKeys,
} from "./core";
import type { LinkedGoal } from "./goals";
import type { TaskItem } from "./planning";

type HomeOverviewResponse = {
  date: string;
  generatedAt: string;
  greeting: string;
  phase: "morning" | "midday" | "evening";
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
    kind: TaskItem["kind"];
    reminderAt: string | null;
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
    spentThisMonthMinor: number;
    currencyCode: string;
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
      taskKind: TaskItem["kind"];
      reminderAt: string | null;
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

type HomeQuoteResponse = {
  generatedAt: string;
  quote: {
    text: string;
    author: string;
    attributionUrl: string;
  };
};

export const useHomeOverviewQuery = (date: string) =>
  useQuery({
    queryKey: queryKeys.home(date),
    queryFn: () => apiRequest<HomeOverviewResponse>("/api/home/overview", { query: { date } }),
    retry: false,
  });

export const useHomeQuoteQuery = () =>
  useQuery({
    queryKey: queryKeys.homeQuote,
    queryFn: () => apiRequest<HomeQuoteResponse>("/api/home/quote"),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
