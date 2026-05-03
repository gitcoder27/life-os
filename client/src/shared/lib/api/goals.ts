import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  CreateGoalRequest,
  GoalDetailResponse,
  GoalDomain,
  GoalMilestonesMutationResponse,
  GoalMutationResponse,
  GoalStatus,
  GoalSummary,
  GoalsConfigResponse,
  GoalsResponse,
  GoalsWorkspaceResponse,
  GoalsWorkspaceTodayAlignment,
  MonthFocusMutationResponse,
  MonthPlanResponse,
  PlanningPriorityMutationResponse,
  UpdateGoalDomainsRequest,
  UpdateGoalHorizonsRequest,
  UpdateGoalMilestonesRequest,
  UpdateGoalRequest,
  UpdateMonthFocusRequest,
  UpdateWeekCapacityRequest,
  UpdateWeekPrioritiesRequest,
  WeekCapacityMutationResponse,
  WeekPlanResponse,
} from "@life-os/contracts";

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

export type LinkedGoal = GoalSummary;

export type {
  GoalDetailItem,
  GoalDomain,
  GoalDomainInput,
  GoalDomainItem,
  GoalDomainSystemKey,
  GoalEngagementState,
  GoalHealthState,
  GoalHierarchySummary,
  GoalHorizonInput,
  GoalHorizonItem,
  GoalHorizonSystemKey,
  GoalLinkedHabitItem,
  GoalLinkedPriorityItem,
  GoalLinkedSummary,
  GoalLinkedTaskItem,
  GoalMilestoneCounts,
  GoalMilestoneItem,
  GoalMomentumPoint,
  GoalMomentumSummary,
  GoalMomentumTrend,
  GoalOverviewItem,
  GoalStatus,
  GoalsWorkspaceTodayAlignment,
  MonthPlanResponse,
  WeekPlanResponse,
} from "@life-os/contracts";

type GoalsWorkspaceFullResponse = GoalsWorkspaceResponse;

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

export const useWeekPlanQuery = (weekStartDate: string) =>
  useQuery({
    queryKey: queryKeys.weekPlan(weekStartDate),
    queryFn: () => apiRequest<WeekPlanResponse>(`/api/planning/weeks/${weekStartDate}`),
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
          domainId: domain,
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
    mutationFn: (payload: CreateGoalRequest) =>
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
    }: UpdateGoalRequest & {
      goalId: string;
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
    mutationFn: (payload: UpdateGoalMilestonesRequest) =>
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

export const useUpdateWeekCapacityMutation = (weekStartDate: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateWeekCapacityRequest) =>
      apiRequest<WeekCapacityMutationResponse>(`/api/planning/weeks/${weekStartDate}/capacity`, {
        method: "PUT",
        body: payload,
      }),
    meta: {
      successMessage: "Week capacity updated.",
      errorMessage: "Week capacity update failed.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.weekPlan(weekStartDate) });
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });
};

export const useUpdateWeekPrioritiesMutation = (weekStartDate: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateWeekPrioritiesRequest) =>
      apiRequest<PlanningPriorityMutationResponse>(`/api/planning/weeks/${weekStartDate}/priorities`, {
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
    mutationFn: (payload: UpdateMonthFocusRequest) =>
      apiRequest<MonthFocusMutationResponse>(`/api/planning/months/${monthStartDate}/focus`, {
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
    mutationFn: (payload: UpdateGoalDomainsRequest) =>
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
    mutationFn: (payload: UpdateGoalHorizonsRequest) =>
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
