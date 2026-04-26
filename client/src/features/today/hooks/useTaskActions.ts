import { useState } from "react";
import { useAppFeedback } from "../../../app/providers";
import {
  useBulkUpdateTasksMutation,
  useCarryForwardTaskMutation,
  useReorderTasksMutation,
  useTaskStatusMutation,
} from "../../../shared/lib/api";
import { getTomorrowDate } from "../helpers/date-helpers";

export function useTaskActions(today: string) {
  const { pushFeedback } = useAppFeedback();
  const tomorrow = getTomorrowDate(today);
  const updateTaskMutation = useTaskStatusMutation(today);
  const carryForwardMutation = useCarryForwardTaskMutation(today);
  const bulkUpdateTasksMutation = useBulkUpdateTasksMutation(today);
  const reorderTasksMutation = useReorderTasksMutation(today);
  const [rescheduleDates, setRescheduleDates] = useState<Record<string, string>>({});

  const isPending =
    updateTaskMutation.isPending ||
    carryForwardMutation.isPending ||
    bulkUpdateTasksMutation.isPending ||
    reorderTasksMutation.isPending;

  function getRescheduleDate(taskId: string) {
    return rescheduleDates[taskId] ?? tomorrow;
  }

  function setRescheduleDate(taskId: string, date: string) {
    setRescheduleDates((prev) => ({ ...prev, [taskId]: date }));
  }

  function changeStatus(taskId: string, status: "pending" | "completed" | "dropped", onSuccess?: () => void) {
    updateTaskMutation.mutate({ taskId, status }, { onSuccess });
  }

  function carryForward(taskId: string, targetDate: string, onSuccess?: () => void) {
    carryForwardMutation.mutate({ taskId, targetDate }, { onSuccess });
  }

  async function carryForwardTasks(taskIds: string[], targetDate: string) {
    if (taskIds.length === 0) {
      return;
    }

    await bulkUpdateTasksMutation.mutateAsync({
      taskIds,
      action: {
        type: "carry_forward",
        targetDate,
      },
    });
  }

  function moveToToday(taskId: string, onSuccess?: () => void) {
    carryForwardMutation.mutate({ taskId, targetDate: today }, { onSuccess });
  }

  function moveToTomorrow(taskId: string, onSuccess?: () => void) {
    carryForwardMutation.mutate({ taskId, targetDate: tomorrow }, { onSuccess });
  }

  async function moveTasksToToday(taskIds: string[]) {
    await carryForwardTasks(taskIds, today);
    pushFeedback(`Moved ${taskIds.length} task${taskIds.length === 1 ? "" : "s"} to today.`, "success");
  }

  async function moveTasksToTomorrow(taskIds: string[]) {
    await carryForwardTasks(taskIds, tomorrow);
    pushFeedback(`Moved ${taskIds.length} task${taskIds.length === 1 ? "" : "s"} to tomorrow.`, "success");
  }

  async function changeStatuses(taskIds: string[], status: "pending" | "completed" | "dropped") {
    if (taskIds.length === 0) {
      return;
    }

    await bulkUpdateTasksMutation.mutateAsync({
      taskIds,
      action: {
        type: "status",
        status,
      },
    });

    const verb =
      status === "completed"
        ? "Completed"
        : status === "dropped"
          ? "Dropped"
          : "Updated";
    pushFeedback(`${verb} ${taskIds.length} task${taskIds.length === 1 ? "" : "s"}.`, "success");
  }

  function reschedule(taskId: string, onSuccess?: () => void) {
    const date = getRescheduleDate(taskId);
    carryForwardMutation.mutate({ taskId, targetDate: date }, { onSuccess });
  }

  function reorderTasks(taskIds: string[]) {
    if (taskIds.length < 2) {
      return;
    }

    reorderTasksMutation.mutate(taskIds);
  }

  const mutationError =
    updateTaskMutation.error instanceof Error
      ? updateTaskMutation.error.message
      : carryForwardMutation.error instanceof Error
        ? carryForwardMutation.error.message
        : bulkUpdateTasksMutation.error instanceof Error
        ? bulkUpdateTasksMutation.error.message
        : reorderTasksMutation.error instanceof Error
          ? reorderTasksMutation.error.message
          : null;

  return {
    isPending,
    mutationError,
    getRescheduleDate,
    setRescheduleDate,
    changeStatus,
    changeStatuses,
    carryForward,
    carryForwardTasks,
    moveToToday,
    moveTasksToToday,
    moveToTomorrow,
    moveTasksToTomorrow,
    reorderTasks,
    reschedule,
    tomorrow,
  };
}
