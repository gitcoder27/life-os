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

/* ── Domain & Horizon config types ── */

export type GoalDomainSystemKey =
  | "health"
  | "money"
  | "work_growth"
  | "home_admin"
  | "discipline"
  | "other";

export type GoalHorizonSystemKey =
  | "life_vision"
  | "five_year"
  | "one_year"
  | "quarter"
  | "month";

export type GoalDomainItem = {
  id: string;
  systemKey: GoalDomainSystemKey | null;
  name: string;
  sortOrder: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GoalDomainInput = {
  id?: string;
  systemKey?: GoalDomainSystemKey | null;
  name: string;
  isArchived?: boolean;
};

export type GoalHorizonItem = {
  id: string;
  systemKey: GoalHorizonSystemKey | null;
  name: string;
  sortOrder: number;
  spanMonths: number | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GoalHorizonInput = {
  id?: string;
  systemKey?: GoalHorizonSystemKey | null;
  name: string;
  spanMonths?: number | null;
  isArchived?: boolean;
};

/* ── Goal types ── */

export type GoalDomain = string;
export type GoalStatus = "active" | "paused" | "completed" | "archived";

export type LinkedGoal = {
  id: string;
  title: string;
  domain: GoalDomain;
  domainSystemKey: GoalDomainSystemKey | null;
  status: GoalStatus;
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
  domainId: string;
  domain: GoalDomain;
  domainSystemKey: GoalDomainSystemKey | null;
  horizonId: string | null;
  horizonName: string | null;
  horizonSystemKey: GoalHorizonSystemKey | null;
  horizonSpanMonths: number | null;
  parentGoalId: string | null;
  status: GoalStatus;
  why: string | null;
  targetDate: string | null;
  notes: string | null;
  sortOrder: number;
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

export type GoalHierarchySummary = {
  id: string;
  title: string;
  domainId: string;
  domain: GoalDomain;
  domainSystemKey: GoalDomainSystemKey | null;
  horizonId: string | null;
  horizonName: string | null;
  horizonSystemKey: GoalHorizonSystemKey | null;
  parentGoalId: string | null;
  status: GoalStatus;
  sortOrder: number;
  targetDate: string | null;
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
  completedCountToday: number;
  streakCount: number;
  completionRate7d: number;
  riskLevel: "none" | "at_risk" | "drifting";
  riskMessage: string | null;
};

export type GoalDetailItem = GoalOverviewItem & {
  milestones: GoalMilestoneItem[];
  parent: GoalHierarchySummary | null;
  children: GoalHierarchySummary[];
  ancestors: GoalHierarchySummary[];
  linkedPriorities: GoalLinkedPriorityItem[];
  currentWeekPriorities: GoalLinkedPriorityItem[];
  currentMonthOutcomes: GoalLinkedPriorityItem[];
  linkedTasks: GoalLinkedTaskItem[];
  linkedHabits: GoalLinkedHabitItem[];
};

/* ── Response types ── */

type GoalMutationResponse = {
  generatedAt: string;
  goal: GoalOverviewItem;
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

type GoalsConfigResponse = {
  generatedAt: string;
  domains: GoalDomainItem[];
  horizons: GoalHorizonItem[];
};

export type GoalsWorkspaceTodayAlignment = {
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
  tasks: Array<{
    id: string;
    title: string;
    goalId: string | null;
    status: string;
  }>;
  representedGoalIds: string[];
};

export type WeekPlanResponse = {
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

export type MonthPlanResponse = {
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

type GoalsWorkspaceFullResponse = {
  generatedAt: string;
  contextDate: string;
  domains: GoalDomainItem[];
  horizons: GoalHorizonItem[];
  goals: GoalOverviewItem[];
  weekPlan: WeekPlanResponse;
  monthPlan: MonthPlanResponse;
  todayAlignment: GoalsWorkspaceTodayAlignment;
};

/* ── Invalidation helper ── */

const invalidateGoals = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: queryKeys.goalsAll });
  void queryClient.invalidateQueries({ queryKey: ["goals"] });
};

/* ── Queries ── */

export const useGoalsWorkspaceQuery = (date: string) =>
  useQuery({
    queryKey: ["goals", "workspace", date],
    queryFn: () =>
      apiRequest<GoalsWorkspaceFullResponse>("/api/goals/workspace", {
        query: { date },
      }),
    retry: false,
  });

export const useGoalsConfigQuery = () =>
  useQuery({
    queryKey: ["goals", "config"],
    queryFn: () => apiRequest<GoalsConfigResponse>("/api/goals/config"),
    retry: false,
  });

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

export const useGoalDetailQuery = (goalId: string | null) =>
  useQuery({
    queryKey: queryKeys.goalDetail(goalId ?? ""),
    queryFn: () => apiRequest<GoalDetailResponse>(`/api/goals/${goalId}`),
    enabled: !!goalId,
    retry: false,
  });

/* ── Mutations ── */

export const useCreateGoalMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      title: string;
      domainId: string;
      horizonId?: string | null;
      parentGoalId?: string | null;
      why?: string | null;
      targetDate?: string | null;
      notes?: string | null;
      sortOrder?: number;
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
      domainId?: string;
      horizonId?: string | null;
      parentGoalId?: string | null;
      why?: string | null;
      status?: GoalStatus;
      targetDate?: string | null;
      notes?: string | null;
      sortOrder?: number;
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

export const useUpdateGoalDomainsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { domains: GoalDomainInput[] }) =>
      apiRequest<GoalsConfigResponse>("/api/goals/config/domains", {
        method: "PUT",
        body: payload,
      }),
    meta: {
      successMessage: "Goal domains saved.",
      errorMessage: "Domain update failed.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });
};

export const useUpdateGoalHorizonsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { horizons: GoalHorizonInput[] }) =>
      apiRequest<GoalsConfigResponse>("/api/goals/config/horizons", {
        method: "PUT",
        body: payload,
      }),
    meta: {
      successMessage: "Planning layers saved.",
      errorMessage: "Horizon update failed.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });
};
