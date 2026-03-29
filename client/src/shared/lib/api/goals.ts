import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  getMonthStartDate,
  getWeekStartDate,
} from "../date";
import {
  apiRequest,
  queryKeys,
  toSectionError,
  unwrapRequiredResult,
} from "./core";
import type { TaskItem } from "./planning";

export type GoalDomain = "health" | "money" | "work_growth" | "home_admin" | "discipline" | "other";
export type GoalStatus = "active" | "paused" | "completed" | "archived";

export type LinkedGoal = {
  id: string;
  title: string;
  domain: GoalDomain;
  status: GoalStatus;
};

type GoalMutationResponse = {
  generatedAt: string;
  goal: GoalsResponse["goals"][number];
};

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
  kind: TaskItem["kind"];
  reminderAt: string | null;
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

const invalidateGoals = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: queryKeys.goalsAll });
  void queryClient.invalidateQueries({ queryKey: ["goals"] });
};

export const useGoalsDataQuery = (date: string) => {
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
};

export const useGoalsListQuery = () =>
  useQuery({
    queryKey: queryKeys.goalsAll,
    queryFn: () => apiRequest<GoalsResponse>("/api/goals"),
    retry: false,
  });

export const useFilteredGoalsQuery = (filters?: { domain?: GoalDomain; status?: GoalStatus }) => {
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
};

export const useCreateGoalMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      title: string;
      domain: GoalDomain;
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
    onSuccess: () => invalidateGoals(queryClient),
  });
};

export const useUpdateGoalMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      goalId,
      ...payload
    }: {
      goalId: string;
      title?: string;
      domain?: GoalDomain;
      status?: GoalStatus;
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
    onSuccess: () => invalidateGoals(queryClient),
  });
};

export const useGoalDetailQuery = (goalId: string | null) =>
  useQuery({
    queryKey: queryKeys.goalDetail(goalId ?? ""),
    queryFn: () => apiRequest<GoalDetailResponse>(`/api/goals/${goalId}`),
    enabled: !!goalId,
    retry: false,
  });

export const useUpdateGoalMilestonesMutation = (goalId: string) => {
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
      invalidateGoals(queryClient);
    },
  });
};

export const useUpdateWeekPrioritiesMutation = (weekStartDate: string) => {
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
      apiRequest<WeekPlanResponse>(`/api/planning/weeks/${weekStartDate}/priorities`, {
        method: "PUT",
        body: payload,
      }),
    meta: {
      successMessage: "Weekly priorities saved.",
      errorMessage: "Weekly priorities update failed.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });
};

export const useUpdateMonthFocusMutation = (monthStartDate: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      theme: string | null;
      topOutcomes: Array<{
        id?: string;
        slot: 1 | 2 | 3;
        title: string;
        goalId?: string | null;
      }>;
    }) =>
      apiRequest<MonthPlanResponse>(`/api/planning/months/${monthStartDate}/focus`, {
        method: "PUT",
        body: payload,
      }),
    meta: {
      successMessage: "Monthly focus saved.",
      errorMessage: "Monthly focus update failed.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });
};
