import { useMemo } from "react";
import {
  getTodayDate,
  getWeekStartDate,
  useDailyScoreQuery,
  useDayPlanQuery,
  useGoalsListQuery,
  useHealthDataQuery,
  useWeekPlanQuery,
  useTasksQuery,
  type TaskItem,
  type DayPlannerBlockItem,
} from "../../../shared/lib/api";
import { isQuickCaptureReferenceTask } from "../../../shared/lib/quickCapture";
import { getOffsetDate } from "../helpers/date-helpers";

const isPlannerAssignableTask = (task: TaskItem) => task.kind === "task";

export function useTodayData() {
  const today = getTodayDate();
  const weekStart = getWeekStartDate(today);
  const overdueLookbackStart = getOffsetDate(today, -30);
  const yesterday = getOffsetDate(today, -1);

  const dayPlanQuery = useDayPlanQuery(today);
  const weekPlanQuery = useWeekPlanQuery(weekStart);
  const overdueTasksQuery = useTasksQuery({
    from: overdueLookbackStart,
    to: yesterday,
    status: "pending",
  });
  const completedTodayTasksQuery = useTasksQuery({
    completedOn: today,
    status: "completed",
  });
  const healthQuery = useHealthDataQuery(today);
  const goalsListQuery = useGoalsListQuery();
  const scoreQuery = useDailyScoreQuery(today);

  const priorities = dayPlanQuery.data?.priorities ?? [];
  const launch = dayPlanQuery.data?.launch ?? null;
  const mustWinTask = dayPlanQuery.data?.mustWinTask ?? null;
  const rescueSuggestion = dayPlanQuery.data?.rescueSuggestion ?? null;
  const allTasks = dayPlanQuery.data?.tasks ?? [];
  const goalNudges = dayPlanQuery.data?.goalNudges ?? [];
  const plannerBlocks = dayPlanQuery.data?.plannerBlocks ?? [];
  const overdueTasks = overdueTasksQuery.data?.tasks ?? [];
  const completedTodayTasks = completedTodayTasksQuery.data?.tasks ?? [];
  const currentDay = healthQuery.data?.summary.currentDay;
  const score = scoreQuery.data;

  const activeGoals = useMemo(
    () => (goalsListQuery.data?.goals ?? []).filter((g) => g.status === "active"),
    [goalsListQuery.data],
  );

  const executionTasks = useMemo(
    () => allTasks.filter((t) => !isQuickCaptureReferenceTask(t)),
    [allTasks],
  );

  const quickCaptureTasks = useMemo(
    () => allTasks.filter(isQuickCaptureReferenceTask),
    [allTasks],
  );

  const completedTasks = useMemo(() => {
    const tasksById = new Map<string, TaskItem>();
    for (const task of executionTasks) {
      if (task.status === "completed") {
        tasksById.set(task.id, task);
      }
    }
    for (const task of completedTodayTasks) {
      if (!isQuickCaptureReferenceTask(task)) {
        tasksById.set(task.id, task);
      }
    }
    return [...tasksById.values()];
  }, [completedTodayTasks, executionTasks]);

  const timedTasks = useMemo(
    () => executionTasks.filter((t) => t.dueAt),
    [executionTasks],
  );

  const plannedTaskIds = useMemo(() => {
    const ids = new Set<string>();
    for (const block of plannerBlocks) {
      for (const bt of block.tasks) {
        ids.add(bt.taskId);
      }
    }
    return ids;
  }, [plannerBlocks]);

  const unplannedTasks = useMemo(
    () =>
      executionTasks.filter(
        (t) => t.status === "pending" && isPlannerAssignableTask(t) && !plannedTaskIds.has(t.id),
      ),
    [executionTasks, plannedTaskIds],
  );

  const taskGroups = useMemo(() => groupTasks(executionTasks), [executionTasks]);

  const completedTaskCount = useMemo(
    () => completedTasks.length,
    [completedTasks],
  );
  const totalTaskCount = useMemo(() => {
    const taskIds = new Set<string>();
    for (const task of executionTasks) {
      taskIds.add(task.id);
    }
    for (const task of completedTasks) {
      taskIds.add(task.id);
    }
    return taskIds.size;
  }, [completedTasks, executionTasks]);
  const plannedPendingTaskCount = useMemo(
    () =>
      executionTasks.filter((t) => t.status === "pending" && plannedTaskIds.has(t.id)).length,
    [executionTasks, plannedTaskIds],
  );

  const refetchAll = () => {
    void dayPlanQuery.refetch();
    void weekPlanQuery.refetch();
    void overdueTasksQuery.refetch();
    void completedTodayTasksQuery.refetch();
    void healthQuery.refetch();
    void scoreQuery.refetch();
  };

  return {
    today,
    isLoading: dayPlanQuery.isLoading && !dayPlanQuery.data,
    isError: dayPlanQuery.isError || !dayPlanQuery.data,
    error: dayPlanQuery.error,
    priorities,
    launch,
    mustWinTask,
    rescueSuggestion,
    executionTasks,
    completedTasks,
    taskGroups,
    completedTaskCount,
    totalTaskCount,
    quickCaptureTasks,
    timedTasks,
    goalNudges,
    plannerBlocks,
    plannedTaskIds,
    unplannedTasks,
    plannedPendingTaskCount,
    unplannedPendingTaskCount: unplannedTasks.length,
    overdueTasks,
    overdueTasksQuery,
    completedTodayTasksQuery,
    currentDay,
    activeGoals,
    score,
    scoreQuery,
    healthQuery,
    goalsListQuery,
    dayPlanQuery,
    weekPlan: weekPlanQuery.data ?? null,
    weekPlanQuery,
    refetchAll,
  };
}

export type TaskGroup = {
  key: "carried" | "scheduled" | "recurring";
  label: string;
  tasks: TaskItem[];
};

function groupTasks(tasks: TaskItem[]): TaskGroup[] {
  const carried: TaskItem[] = [];
  const scheduled: TaskItem[] = [];
  const recurring: TaskItem[] = [];

  for (const task of tasks) {
    if (task.originType === "carry_forward") {
      carried.push(task);
    } else if (task.originType === "recurring" || task.recurrence) {
      recurring.push(task);
    } else {
      scheduled.push(task);
    }
  }

  const groups: TaskGroup[] = [];
  if (carried.length > 0) groups.push({ key: "carried", label: "Carried Forward", tasks: carried });
  if (scheduled.length > 0) groups.push({ key: "scheduled", label: "Scheduled Today", tasks: scheduled });
  if (recurring.length > 0) groups.push({ key: "recurring", label: "Recurring", tasks: recurring });
  return groups;
}
