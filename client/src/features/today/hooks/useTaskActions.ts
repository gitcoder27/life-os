import { useState } from "react";
import {
  useCarryForwardTaskMutation,
  useTaskStatusMutation,
} from "../../../shared/lib/api";
import { getTomorrowDate } from "../helpers/date-helpers";

export function useTaskActions(today: string) {
  const tomorrow = getTomorrowDate(today);
  const updateTaskMutation = useTaskStatusMutation(today);
  const carryForwardMutation = useCarryForwardTaskMutation(today);
  const [rescheduleDates, setRescheduleDates] = useState<Record<string, string>>({});

  const isPending = updateTaskMutation.isPending || carryForwardMutation.isPending;

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

  function moveToToday(taskId: string, onSuccess?: () => void) {
    carryForwardMutation.mutate({ taskId, targetDate: today }, { onSuccess });
  }

  function moveToTomorrow(taskId: string, onSuccess?: () => void) {
    carryForwardMutation.mutate({ taskId, targetDate: tomorrow }, { onSuccess });
  }

  function reschedule(taskId: string, onSuccess?: () => void) {
    const date = getRescheduleDate(taskId);
    carryForwardMutation.mutate({ taskId, targetDate: date }, { onSuccess });
  }

  const mutationError =
    updateTaskMutation.error instanceof Error
      ? updateTaskMutation.error.message
      : carryForwardMutation.error instanceof Error
        ? carryForwardMutation.error.message
        : null;

  return {
    isPending,
    mutationError,
    getRescheduleDate,
    setRescheduleDate,
    changeStatus,
    carryForward,
    moveToToday,
    moveToTomorrow,
    reschedule,
    tomorrow,
  };
}
