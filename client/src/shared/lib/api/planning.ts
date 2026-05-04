import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import type {
  AdaptiveTodayGuidanceResponse,
  ApplyTaskTemplateResponse,
  ApplyShapeDayRequest,
  BulkTaskMutationResponse,
  BulkUpdateTasksRequest,
  CarryForwardTaskRequest,
  CommitTaskRequest,
  CreateTaskRequest,
  DayCapacityAssessmentResponse,
  DayLaunchMutationResponse,
  DayPlanResponse,
  DayPlannerBlockItem,
  DayPlannerBlockMutationResponse,
  DayPlannerBlocksMutationResponse,
  DayPlannerBlockTaskItem,
  DailyLaunchItem,
  DriftRecoveryRequest,
  DriftRecoveryResponse,
  GoalNudgeItem,
  IsoDateString,
  LogTaskStuckRequest,
  PlanningPriorityInput,
  PlanningPriorityMutationResponse,
  PlanningTaskItem,
  PriorityMutationResponse,
  RecurrenceInput,
  RecurringTaskCarryPolicy,
  RescueSuggestion,
  ShapeDayApplyResponse,
  ShapeDayPreviewRequest,
  ShapeDayPreviewResponse,
  TaskCommitmentGuidance,
  TaskCommitmentReadiness,
  TaskCommitmentReason,
  TaskListCounts,
  TaskMutationResponse,
  TaskTemplateItem,
  TaskTemplateTask,
  TaskTemplateMutationResponse,
  TaskTemplatesResponse,
  TaskStatus,
  TasksQuery,
  TasksResponse,
  UpdateTaskRequest,
} from "@life-os/contracts";
import {
  apiRequest,
  invalidateCoreData,
  invalidateCoreDataForDates,
  invalidateTaskTemplateData,
  queryKeys,
} from "./core";

export type TaskItem = PlanningTaskItem;
export type TaskTemplate = TaskTemplateItem;
export type DayPriorityInput = PlanningPriorityInput;
export type DayPrioritiesMutationResponse = PlanningPriorityMutationResponse;
export type TasksQueryFilters = Omit<TasksQuery, "scheduledForDate" | "from" | "to"> & {
  scheduledForDate?: string;
  from?: string;
  to?: string;
};
export type BulkUpdateTasksInput = {
  taskIds: string[];
  action:
    | {
        type: "schedule";
        scheduledForDate: string;
      }
    | {
        type: "carry_forward";
        targetDate: string;
      }
    | {
        type: "link_goal";
        goalId: string | null;
      }
    | {
        type: "status";
        status: TaskStatus;
      }
    | {
        type: "archive";
      };
};
export type {
  AdaptiveTodayGuidanceResponse,
  DayCapacityAssessmentResponse,
  DailyLaunchItem,
  DayPlannerBlockItem,
  DayPlannerBlockTaskItem,
  DriftRecoveryRequest,
  DriftRecoveryResponse,
  GoalNudgeItem,
  RescueSuggestion,
  ShapeDayApplyResponse,
  ShapeDayPreviewResponse,
  TaskCommitmentGuidance,
  TaskCommitmentReadiness,
  TaskCommitmentReason,
  TaskListCounts,
  TaskTemplateTask,
};

type ReplacePlannerBlockTasksMutationContext = {
  previousDayPlan?: DayPlanResponse;
};

const toIsoDateString = (date: string): IsoDateString => date as IsoDateString;

const toBulkUpdateTasksRequest = (payload: BulkUpdateTasksInput): BulkUpdateTasksRequest => {
  switch (payload.action.type) {
    case "schedule":
      return {
        taskIds: payload.taskIds,
        action: {
          type: "schedule",
          scheduledForDate: toIsoDateString(payload.action.scheduledForDate),
        },
      };
    case "carry_forward":
      return {
        taskIds: payload.taskIds,
        action: {
          type: "carry_forward",
          targetDate: toIsoDateString(payload.action.targetDate),
        },
      };
    case "link_goal":
    case "status":
    case "archive":
      return {
        taskIds: payload.taskIds,
        action: payload.action,
      };
  }
};

export const useDayPlanQuery = (date: string) =>
  useQuery({
    queryKey: queryKeys.dayPlan(date),
    queryFn: () => apiRequest<DayPlanResponse>(`/api/planning/days/${date}`),
    retry: false,
  });

export const useAdaptiveTodayQuery = (date: string, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: queryKeys.adaptiveToday(date),
    queryFn: () => apiRequest<AdaptiveTodayGuidanceResponse>(`/api/planning/days/${date}/adaptive-guidance`),
    enabled: options?.enabled,
    retry: false,
  });

export const useDayCapacityQuery = (date: string, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: queryKeys.dayCapacity(date),
    queryFn: () => apiRequest<DayCapacityAssessmentResponse>(`/api/planning/days/${date}/capacity`),
    enabled: options?.enabled,
    retry: false,
  });

export const useTasksQuery = (
  filters: TasksQueryFilters = {},
  options?: {
    enabled?: boolean;
  },
) =>
  useQuery({
    queryKey: queryKeys.tasks(filters),
    queryFn: () =>
      apiRequest<TasksResponse>("/api/tasks", {
        query: {
          scheduledForDate: filters.scheduledForDate,
          from: filters.from,
          to: filters.to,
          completedOn: filters.completedOn,
          status: filters.status,
          kind: filters.kind,
          cursor: filters.cursor,
          limit: filters.limit ? String(filters.limit) : undefined,
          includeSummary: filters.includeSummary ? "true" : undefined,
          originType: filters.originType,
          scheduledState: filters.scheduledState,
          sort: filters.sort,
        },
      }),
    enabled: options?.enabled,
    retry: false,
  });

export const useInboxQuery = (
  filters: Omit<TasksQueryFilters, "status" | "originType" | "scheduledState"> = {},
  options?: {
    enabled?: boolean;
  },
) =>
  useTasksQuery(
    {
      status: "pending",
      kind: filters.kind,
      cursor: filters.cursor,
      limit: filters.limit,
      includeSummary: filters.includeSummary,
      sort: filters.sort,
      scheduledState: "unscheduled",
      originType: "quick_capture",
    },
    options,
  );

export const useTaskTemplatesQuery = () =>
  useQuery({
    queryKey: queryKeys.taskTemplates,
    queryFn: () => apiRequest<TaskTemplatesResponse>("/api/task-templates"),
    retry: false,
  });

const invalidateTaskMutationData = (
  queryClient: QueryClient,
  date: string,
  task?: Pick<TaskItem, "scheduledForDate"> | null,
) => {
  invalidateCoreDataForDates(queryClient, [date, task?.scheduledForDate]);
};

export const useTaskStatusMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskItem["status"] }) =>
      apiRequest<TaskMutationResponse>(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: { status },
      }),
    meta: {
      successMessage: "Task updated.",
      errorMessage: "Task update failed.",
    },
    onSuccess: (response) => invalidateTaskMutationData(queryClient, date, response.task),
  });
};

type ReorderTasksMutationContext = {
  previousDayPlan?: DayPlanResponse;
  previousTaskQueries: Array<[readonly unknown[], TasksResponse | undefined]>;
};

const reorderTaskItems = (tasks: TaskItem[], taskIds: string[]) => {
  const nextTaskIds = new Set(taskIds);
  const orderedTasks = taskIds
    .map((taskId, index) => {
      const task = tasks.find((candidate) => candidate.id === taskId);
      return task
        ? {
            ...task,
            todaySortOrder: index,
          }
        : null;
    })
    .filter((task): task is TaskItem => task !== null);

  if (orderedTasks.length <= 1) {
    return tasks;
  }

  let nextIndex = 0;
  return tasks.map((task) => {
    if (!nextTaskIds.has(task.id)) {
      return task;
    }

    return orderedTasks[nextIndex++] ?? task;
  });
};

export const useReorderTasksMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskIds: string[]) =>
      apiRequest<BulkTaskMutationResponse>("/api/tasks/order", {
        method: "PUT",
        body: { taskIds },
      }),
    meta: {
      errorMessage: "Task reorder failed.",
    },
    onMutate: async (taskIds): Promise<ReorderTasksMutationContext> => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.dayPlan(date) }),
        queryClient.cancelQueries({ queryKey: ["tasks"] }),
      ]);

      const previousDayPlan = queryClient.getQueryData<DayPlanResponse>(queryKeys.dayPlan(date));
      const previousTaskQueries = queryClient.getQueriesData<TasksResponse>({ queryKey: ["tasks"] });

      queryClient.setQueryData<DayPlanResponse>(
        queryKeys.dayPlan(date),
        (current) =>
          current
            ? {
                ...current,
                tasks: reorderTaskItems(current.tasks, taskIds),
              }
            : current,
      );
      queryClient.setQueriesData<TasksResponse>(
        { queryKey: ["tasks"] },
        (current) =>
          current
            ? {
                ...current,
                tasks: reorderTaskItems(current.tasks, taskIds),
              }
            : current,
      );

      return { previousDayPlan, previousTaskQueries };
    },
    onError: (_error, _taskIds, context) => {
      if (context?.previousDayPlan) {
        queryClient.setQueryData<DayPlanResponse>(queryKeys.dayPlan(date), context.previousDayPlan);
      }

      for (const [queryKey, response] of context?.previousTaskQueries ?? []) {
        queryClient.setQueryData(queryKey, response);
      }
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dayPlan(date) });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
};

export const useCarryForwardTaskMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, targetDate }: { taskId: string; targetDate: string }) =>
      apiRequest<TaskMutationResponse>(`/api/tasks/${taskId}/carry-forward`, {
        method: "POST",
        body: {
          targetDate: toIsoDateString(targetDate),
        } satisfies CarryForwardTaskRequest,
      }),
    meta: {
      successMessage: "Task rescheduled.",
      errorMessage: "Task reschedule failed.",
    },
    onSuccess: (response, variables) => {
      invalidateCoreDataForDates(queryClient, [
        date,
        variables.targetDate,
        response.task.scheduledForDate,
      ]);
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
};

export const useUpdatePriorityMutation = (date: string) => {
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
};

export const useUpdateDayPrioritiesMutation = (date: string) => {
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
};

export const useCreatePlannerBlockMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      title?: string | null;
      startsAt: string;
      endsAt: string;
      taskIds?: string[];
    }) =>
      apiRequest<DayPlannerBlockMutationResponse>(`/api/planning/days/${date}/planner-blocks`, {
        method: "POST",
        body: payload,
      }),
    meta: { errorMessage: "Block creation failed." },
    onSuccess: (response) => {
      queryClient.setQueryData<DayPlanResponse>(
        queryKeys.dayPlan(date),
        (current) => {
          if (!current) {
            return current;
          }

          const existingIndex = current.plannerBlocks.findIndex(
            (block) => block.id === response.plannerBlock.id,
          );
          const plannerBlocks =
            existingIndex >= 0
              ? current.plannerBlocks.map((block) =>
                  block.id === response.plannerBlock.id ? response.plannerBlock : block,
                )
              : [...current.plannerBlocks, response.plannerBlock];

          return {
            ...current,
            generatedAt: response.generatedAt,
            plannerBlocks,
          };
        },
      );
      invalidateCoreData(queryClient, date);
    },
  });
};

export const useUpdatePlannerBlockMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      blockId,
      title,
      startsAt,
      endsAt,
    }: {
      blockId: string;
      title?: string | null;
      startsAt?: string;
      endsAt?: string;
    }) =>
      apiRequest<DayPlannerBlockMutationResponse>(
        `/api/planning/days/${date}/planner-blocks/${blockId}`,
        { method: "PATCH", body: { title, startsAt, endsAt } },
      ),
    meta: { errorMessage: "Block update failed." },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
};

export const useDeletePlannerBlockMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (blockId: string) =>
      apiRequest<void>(`/api/planning/days/${date}/planner-blocks/${blockId}`, { method: "DELETE" }),
    meta: { errorMessage: "Block deletion failed." },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
};

export const useClearPlannerBlocksMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiRequest<DayPlannerBlocksMutationResponse>(`/api/planning/days/${date}/planner-blocks`, {
        method: "DELETE",
      }),
    meta: { errorMessage: "Timeline clear failed." },
    onSuccess: (response) => {
      queryClient.setQueryData<DayPlanResponse>(
        queryKeys.dayPlan(date),
        (current) =>
          current
            ? {
                ...current,
                generatedAt: response.generatedAt,
                plannerBlocks: response.plannerBlocks,
              }
            : current,
      );
      invalidateCoreData(queryClient, date);
    },
  });
};

export const useShapeDayPreviewMutation = (date: string) =>
  useMutation({
    mutationFn: (payload: ShapeDayPreviewRequest = {}) =>
      apiRequest<ShapeDayPreviewResponse>(`/api/planning/days/${date}/shape-preview`, {
        method: "POST",
        body: payload,
      }),
    meta: {
      errorMessage: "Could not shape this day.",
    },
  });

export const useApplyShapeDayMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ApplyShapeDayRequest) =>
      apiRequest<ShapeDayApplyResponse>(`/api/planning/days/${date}/shape-apply`, {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Day shaped.",
      errorMessage: "Could not apply this plan.",
    },
    onSuccess: (response) => {
      queryClient.setQueryData<DayPlanResponse>(
        queryKeys.dayPlan(date),
        (current) =>
          current
            ? {
                ...current,
                generatedAt: response.generatedAt,
                plannerBlocks: response.plannerBlocks,
              }
            : current,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.adaptiveToday(date) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dayCapacity(date) });
      invalidateCoreData(queryClient, date);
    },
  });
};

export const useDriftRecoveryMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: DriftRecoveryRequest) =>
      apiRequest<DriftRecoveryResponse>(`/api/planning/days/${date}/drift-recovery`, {
        method: "POST",
        body: payload,
      }),
    meta: {
      errorMessage: "Recovery could not be applied.",
    },
    onSuccess: (response) => {
      if (response.mode !== "apply") {
        return;
      }

      if (response.plannerBlocks) {
        queryClient.setQueryData<DayPlanResponse>(
          queryKeys.dayPlan(date),
          (current) =>
            current
              ? {
                  ...current,
                  generatedAt: response.generatedAt,
                  plannerBlocks: response.plannerBlocks ?? current.plannerBlocks,
                }
              : current,
        );
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.adaptiveToday(date) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dayCapacity(date) });
      invalidateCoreData(queryClient, date);
    },
  });
};

export const useReorderPlannerBlocksMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (blockIds: string[]) =>
      apiRequest<DayPlannerBlocksMutationResponse>(`/api/planning/days/${date}/planner-blocks/order`, {
        method: "PUT",
        body: { blockIds },
      }),
    meta: { errorMessage: "Block reorder failed." },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
};

export const useReplacePlannerBlockTasksMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ blockId, taskIds }: { blockId: string; taskIds: string[] }) =>
      apiRequest<DayPlannerBlockMutationResponse>(
        `/api/planning/days/${date}/planner-blocks/${blockId}/tasks`,
        { method: "PUT", body: { taskIds } },
      ),
    meta: { errorMessage: "Task assignment failed." },
    onMutate: async ({ blockId, taskIds }): Promise<ReplacePlannerBlockTasksMutationContext> => {
      await queryClient.cancelQueries({ queryKey: queryKeys.dayPlan(date) });

      const previousDayPlan = queryClient.getQueryData<DayPlanResponse>(queryKeys.dayPlan(date));
      if (!previousDayPlan) {
        return {};
      }

      const nextDayPlan = optimisticallyReplacePlannerBlockTasks(previousDayPlan, blockId, taskIds);
      queryClient.setQueryData<DayPlanResponse>(queryKeys.dayPlan(date), nextDayPlan);

      return { previousDayPlan };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousDayPlan) {
        queryClient.setQueryData<DayPlanResponse>(queryKeys.dayPlan(date), context.previousDayPlan);
      }
    },
    onSuccess: (response) => {
      queryClient.setQueryData<DayPlanResponse>(
        queryKeys.dayPlan(date),
        (current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            generatedAt: response.generatedAt,
            plannerBlocks: current.plannerBlocks.map((block) =>
              block.id === response.plannerBlock.id ? response.plannerBlock : block,
            ),
          };
        },
      );
      invalidateCoreData(queryClient, date);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dayPlan(date) });
    },
  });
};

export const useRemovePlannerBlockTaskMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ blockId, taskId }: { blockId: string; taskId: string }) =>
      apiRequest<DayPlannerBlockMutationResponse>(
        `/api/planning/days/${date}/planner-blocks/${blockId}/tasks/${taskId}`,
        { method: "DELETE" },
      ),
    meta: { errorMessage: "Task removal failed." },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
};

function optimisticallyReplacePlannerBlockTasks(
  dayPlan: DayPlanResponse,
  targetBlockId: string,
  nextTaskIds: string[],
): DayPlanResponse {
  const knownTasks = new Map<string, TaskItem>();
  for (const task of dayPlan.tasks) {
    knownTasks.set(task.id, task);
  }

  for (const block of dayPlan.plannerBlocks) {
    for (const blockTask of block.tasks) {
      knownTasks.set(blockTask.taskId, blockTask.task);
    }
  }

  const nextTaskIdSet = new Set(nextTaskIds);

  return {
    ...dayPlan,
    plannerBlocks: dayPlan.plannerBlocks.map((block) => {
      if (block.id === targetBlockId) {
        return {
          ...block,
          tasks: nextTaskIds
            .map((taskId, index) => {
              const task = knownTasks.get(taskId);
              if (!task) {
                return null;
              }

              return {
                taskId,
                sortOrder: index,
                task,
              };
            })
            .filter((item): item is DayPlannerBlockTaskItem => item !== null),
        };
      }

      const filteredTasks = block.tasks
        .filter((blockTask) => !nextTaskIdSet.has(blockTask.taskId))
        .map((blockTask, index) => ({
          ...blockTask,
          sortOrder: index,
        }));

      if (filteredTasks.length === block.tasks.length) {
        return block;
      }

      return {
        ...block,
        tasks: filteredTasks,
      };
    }),
  };
}

export const useUpdateTaskMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      title,
      notes,
      kind,
      reminderAt,
      status,
      scheduledForDate,
      goalId,
      dueAt,
      recurrence,
      carryPolicy,
      nextAction,
      fiveMinuteVersion,
      estimatedDurationMinutes,
      likelyObstacle,
      focusLengthMinutes,
      progressState,
      startedAt,
    }: {
      taskId: string;
      title?: string;
      notes?: string | null;
      kind?: TaskItem["kind"];
      reminderAt?: string | null;
      status?: TaskItem["status"];
      scheduledForDate?: string | null;
      goalId?: string | null;
      dueAt?: string | null;
      recurrence?: RecurrenceInput;
      carryPolicy?: RecurringTaskCarryPolicy | null;
      nextAction?: string | null;
      fiveMinuteVersion?: string | null;
      estimatedDurationMinutes?: number | null;
      likelyObstacle?: string | null;
      focusLengthMinutes?: number | null;
      progressState?: TaskItem["progressState"];
      startedAt?: string | null;
    }) =>
      apiRequest<TaskMutationResponse>(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: {
          title,
          notes,
          kind,
          reminderAt,
          status,
          scheduledForDate: scheduledForDate == null ? scheduledForDate : toIsoDateString(scheduledForDate),
          goalId,
          dueAt,
          recurrence,
          carryPolicy,
          nextAction,
          fiveMinuteVersion,
          estimatedDurationMinutes,
          likelyObstacle,
          focusLengthMinutes,
          progressState,
          startedAt,
        } satisfies UpdateTaskRequest,
      }),
    meta: {
      successMessage: "Task updated.",
      errorMessage: "Task update failed.",
    },
    onSuccess: (response) => invalidateTaskMutationData(queryClient, date, response.task),
  });
};

export type CommitTaskInput = {
  taskId: string;
  scheduledForDate: string;
  nextAction?: string | null;
  fiveMinuteVersion?: string | null;
  estimatedDurationMinutes?: number | null;
  likelyObstacle?: string | null;
  focusLengthMinutes?: number | null;
};

export const useCommitTaskMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, scheduledForDate, ...body }: CommitTaskInput) =>
      apiRequest<TaskMutationResponse>(`/api/tasks/${taskId}/commit`, {
        method: "POST",
        body: {
          ...body,
          scheduledForDate: toIsoDateString(scheduledForDate),
        } satisfies CommitTaskRequest,
      }),
    meta: {
      successMessage: "Task scheduled.",
      errorMessage: "Task scheduling failed.",
    },
    onSuccess: (response, variables) =>
      invalidateCoreDataForDates(queryClient, [
        date,
        variables.scheduledForDate,
        response.task.scheduledForDate,
      ]),
  });
};

export const useBulkUpdateTasksMutation = (
  date: string,
  options?: {
    onSuccess?: (response: BulkTaskMutationResponse) => void;
  },
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BulkUpdateTasksInput) =>
      apiRequest<BulkTaskMutationResponse>("/api/tasks/bulk", {
        method: "PATCH",
        body: toBulkUpdateTasksRequest(payload),
      }),
    meta: {
      errorMessage: "Bulk inbox update failed.",
    },
    onSuccess: (response, variables) => {
      const actionDate =
        variables.action.type === "schedule"
          ? variables.action.scheduledForDate
          : variables.action.type === "carry_forward"
            ? variables.action.targetDate
            : null;

      invalidateCoreDataForDates(queryClient, [
        date,
        actionDate,
        ...response.tasks.map((task) => task.scheduledForDate),
      ]);
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      options?.onSuccess?.(response);
    },
  });
};

export const useCreateTaskMutation = (
  date: string,
  options?: {
    successMessage?: string;
    errorMessage?: string;
  },
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scheduledForDate,
      ...payload
    }: {
      title: string;
      notes?: string | null;
      kind?: TaskItem["kind"];
      reminderAt?: string | null;
      scheduledForDate?: string | null;
      originType?: TaskItem["originType"];
      goalId?: string | null;
      dueAt?: string | null;
      recurrence?: RecurrenceInput;
      carryPolicy?: RecurringTaskCarryPolicy;
      nextAction?: string | null;
      fiveMinuteVersion?: string | null;
      estimatedDurationMinutes?: number | null;
      likelyObstacle?: string | null;
      focusLengthMinutes?: number | null;
      progressState?: TaskItem["progressState"];
      startedAt?: string | null;
    }) =>
      apiRequest<TaskMutationResponse>("/api/tasks", {
        method: "POST",
        body: {
          ...payload,
          scheduledForDate: scheduledForDate == null ? scheduledForDate : toIsoDateString(scheduledForDate),
        } satisfies CreateTaskRequest,
      }),
    meta: {
      successMessage: options?.successMessage ?? "Captured to inbox.",
      errorMessage: options?.errorMessage ?? "Task capture failed.",
    },
    onSuccess: (response, variables) =>
      invalidateCoreDataForDates(queryClient, [
        date,
        variables.scheduledForDate,
        response.task.scheduledForDate,
      ]),
  });
};

export const useUpsertDayLaunchMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      mustWinTaskId?: string | null;
      dayMode?: DailyLaunchItem["dayMode"];
      rescueReason?: DailyLaunchItem["rescueReason"];
      energyRating?: number | null;
      likelyDerailmentReason?: DailyLaunchItem["likelyDerailmentReason"];
      likelyDerailmentNote?: string | null;
    }) =>
      apiRequest<DayLaunchMutationResponse>(`/api/planning/days/${date}/launch`, {
        method: "PUT",
        body: payload,
      }),
    meta: {
      successMessage: "Launch updated.",
      errorMessage: "Launch update failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
};

export const useLogTaskStuckMutation = (date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      reason,
      actionTaken,
      note,
      targetDate,
    }: {
      taskId: string;
      reason: NonNullable<DailyLaunchItem["likelyDerailmentReason"]>;
      actionTaken: "clarify" | "shrink" | "downgrade" | "reschedule" | "recover";
      note?: string | null;
      targetDate?: string | null;
    }) =>
      apiRequest<TaskMutationResponse>(`/api/tasks/${taskId}/stuck`, {
        method: "POST",
        body: {
          reason,
          actionTaken,
          note,
          targetDate: targetDate == null ? targetDate : toIsoDateString(targetDate),
        } satisfies LogTaskStuckRequest,
      }),
    meta: {
      successMessage: "Stuck step captured.",
      errorMessage: "Could not save stuck step.",
    },
    onSuccess: (response, variables) =>
      invalidateCoreDataForDates(queryClient, [
        date,
        variables.targetDate,
        response.task.scheduledForDate,
      ]),
  });
};

export const useCreateTaskTemplateMutation = () => {
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
};

export const useUpdateTaskTemplateMutation = () => {
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
};

export const useApplyTaskTemplateMutation = (date: string) => {
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
};
