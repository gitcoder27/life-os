import {
  getTodayDate,
  useDayPlanQuery,
  useUpdateDayPrioritiesMutation,
} from "../../shared/lib/api";

const todayPrioritySlots: Array<1 | 2 | 3> = [1, 2, 3];
const nextBestActionPrefixes = [
  "Complete milestone: ",
  "Finish task: ",
  "Complete habit: ",
] as const;

export function toSuggestedPriorityTitle(nextBestAction: string) {
  const matchedPrefix = nextBestActionPrefixes.find((prefix) => nextBestAction.startsWith(prefix));
  if (!matchedPrefix) {
    return nextBestAction;
  }

  return nextBestAction.slice(matchedPrefix.length).trim();
}

export function useGoalTodayAction({
  goalId,
  goalStatus,
  nextBestAction,
  onLinkedToToday,
}: {
  goalId: string;
  goalStatus: "active" | "paused" | "completed" | "archived";
  nextBestAction: string | null;
  onLinkedToToday?: () => Promise<unknown> | unknown;
}) {
  const today = getTodayDate();
  const dayPlanQuery = useDayPlanQuery(today);
  const updateDayPrioritiesMutation = useUpdateDayPrioritiesMutation(today);

  const isAvailable = goalStatus === "active" && typeof nextBestAction === "string" && nextBestAction.length > 0;
  const todayPriorities = [...(dayPlanQuery.data?.priorities ?? [])].sort((left, right) => left.slot - right.slot);
  const goalAlreadyInToday = todayPriorities.some((priority) => priority.goalId === goalId);
  const todayStackFull = todayPriorities.length >= 3;
  const todayUnavailable = dayPlanQuery.isError;
  const canAddToToday =
    isAvailable
    && !dayPlanQuery.isLoading
    && !todayUnavailable
    && !goalAlreadyInToday
    && !todayStackFull;
  const suggestedPriorityTitle = nextBestAction ? toSuggestedPriorityTitle(nextBestAction) : "";

  const helperCopy = dayPlanQuery.isLoading
    ? "Checking today's priority stack."
    : todayUnavailable
      ? "Today's priorities could not be checked here. Open Today before changing the stack."
      : goalAlreadyInToday
        ? "This goal is already linked inside today's top three."
        : todayStackFull
          ? "Today's priority stack is full. Open Today to swap something out."
          : "Turn the recommended next step into today's focus without leaving this page.";

  const buttonLabel = dayPlanQuery.isLoading
    ? "Checking Today…"
    : updateDayPrioritiesMutation.isPending
      ? "Adding…"
      : todayUnavailable
        ? "Open Today"
        : goalAlreadyInToday
          ? "Already in Today"
          : todayStackFull
            ? "Today stack full"
            : "Add to Today";

  async function addToToday() {
    if (!canAddToToday) {
      return;
    }

    const priorities = [...todayPriorities, {
      slot: todayPrioritySlots[todayPriorities.length]!,
      title: suggestedPriorityTitle,
      goalId,
    }].map((priority, index) => ({
      id: "id" in priority ? priority.id : undefined,
      slot: todayPrioritySlots[index]!,
      title: priority.title.trim(),
      goalId: priority.goalId ?? null,
    }));

    await updateDayPrioritiesMutation.mutateAsync({ priorities });
    await dayPlanQuery.refetch();
    await onLinkedToToday?.();
  }

  return {
    isAvailable,
    dayPlanQuery,
    updateDayPrioritiesMutation,
    goalAlreadyInToday,
    todayStackFull,
    todayUnavailable,
    canAddToToday,
    suggestedPriorityTitle,
    helperCopy,
    buttonLabel,
    addToToday,
  };
}
