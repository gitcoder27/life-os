import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type {
  RecurrenceDefinition,
  RecurrenceInput,
  RecurringTaskCarryPolicy,
} from "../recurrence";
import {
  apiRequest,
  invalidateCoreData,
  invalidateTaskTemplateData,
  queryKeys,
} from "./core";
import type {
  GoalHealthState,
  LinkedGoal,
} from "./goals";

export type TaskItem = {
  id: string;
  title: string;
  notes: string | null;
  kind: "task" | "note" | "reminder";
  reminderAt: string | null;
  status: "pending" | "completed" | "dropped";
  scheduledForDate: string | null;
  dueAt: string | null;
  goalId: string | null;
  goal: LinkedGoal | null;
  originType: "manual" | "quick_capture" | "carry_forward" | "review_seed" | "recurring" | "template";
  carriedFromTaskId: string | null;
  recurrence: RecurrenceDefinition | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskListCounts = {
  all: number;
  task: number;
  note: number;
  reminder: number;
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

export type GoalNudgeItem = {
  goal: LinkedGoal;
  health: GoalHealthState;
  progressPercent: number;
  nextBestAction: string;
  suggestedPriorityTitle: string;
};

export type DayPlannerBlockTaskItem = {
  taskId: string;
  sortOrder: number;
  task: TaskItem;
};

export type DayPlannerBlockItem = {
  id: string;
  title: string | null;
  startsAt: string;
  endsAt: string;
  sortOrder: number;
  tasks: DayPlannerBlockTaskItem[];
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
  goalNudges: GoalNudgeItem[];
  plannerBlocks: DayPlannerBlockItem[];
};

type DayPlannerBlockMutationResponse = {
  generatedAt: string;
  plannerBlock: DayPlannerBlockItem;
};

type DayPlannerBlocksMutationResponse = {
  generatedAt: string;
  plannerBlocks: DayPlannerBlockItem[];
};

type ReplacePlannerBlockTasksMutationContext = {
  previousDayPlan?: DayPlanResponse;
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
  nextCursor: string | null;
  counts?: TaskListCounts;
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
  kind?: TaskItem["kind"];
  cursor?: string;
  limit?: number;
  includeSummary?: boolean;
  originType?: TaskItem["originType"];
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
        type: "carry_forward";
        targetDate: string;
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
        type: "status";
        status: TaskItem["status"];
      };
    }
  | {
      taskIds: string[];
      action: {
        type: "archive";
      };
    };

export const useDayPlanQuery = (date: string) =>
  useQuery({
    queryKey: queryKeys.dayPlan(date),
    queryFn: () => apiRequest<DayPlanResponse>(`/api/planning/days/${date}`),
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
          status: filters.status,
          kind: filters.kind,
          cursor: filters.cursor,
          limit: filters.limit ? String(filters.limit) : undefined,
          includeSummary: filters.includeSummary ? "true" : undefined,
          originType: filters.originType,
          scheduledState: filters.scheduledState,
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
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
};

export const useCarryForwardTaskMutation = (date: string) => {
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
    onSuccess: () => invalidateCoreData(queryClient, date),
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
    }) =>
      apiRequest<TaskMutationResponse>(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: {
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
        },
      }),
    meta: {
      successMessage: "Task updated.",
      errorMessage: "Task update failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
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
    mutationFn: (payload: {
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
    }) =>
      apiRequest<TaskMutationResponse>("/api/tasks", {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: options?.successMessage ?? "Captured to inbox.",
      errorMessage: options?.errorMessage ?? "Task capture failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, date),
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
