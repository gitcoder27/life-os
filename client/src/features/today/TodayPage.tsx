import "./today.css";
import {
  InlineErrorState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import { ScoreProgressStrip } from "./components/ScoreProgressStrip";
import { PriorityStack } from "./components/PriorityStack";
import { TaskQueue } from "./components/TaskQueue";
import { ContextPanel } from "./components/ContextPanel";
import { RecoveryLane } from "./components/RecoveryLane";
import { useTodayData } from "./hooks/useTodayData";
import { usePriorityDraft } from "./hooks/usePriorityDraft";
import { useTaskActions } from "./hooks/useTaskActions";

export function TodayPage() {
  const data = useTodayData();
  const priorityDraft = usePriorityDraft(
    data.today,
    data.priorities,
    Boolean(data.dayPlanQuery.data),
  );
  const taskActions = useTaskActions(data.today);

  if (data.isLoading) {
    return (
      <PageLoadingState
        title="Loading execution workspace"
        description="Pulling in priorities, scheduled tasks, and the immediate context needed to work the day."
      />
    );
  }

  if (data.isError) {
    return (
      <PageErrorState
        title="Today could not load"
        message={data.error instanceof Error ? data.error.message : undefined}
        onRetry={data.refetchAll}
      />
    );
  }

  const allErrors = [priorityDraft.mutationError, taskActions.mutationError]
    .filter((e): e is Error => e instanceof Error)
    .map((e) => e.message)
    .join("; ");

  const canAddGoalNudge =
    priorityDraft.draft.length < 3 || priorityDraft.draft.some((p) => !p.title.trim());

  return (
    <div className="today-layout">
      <ScoreProgressStrip />

      {allErrors ? (
        <InlineErrorState message={allErrors} onRetry={data.refetchAll} />
      ) : null}

      <div className="today-columns">
        <div className="today-focus-zone">
          <PriorityStack
            priorityDraft={priorityDraft}
            activeGoals={data.activeGoals}
          />

          <TaskQueue
            taskGroups={data.taskGroups}
            completedCount={data.completedTaskCount}
            totalCount={data.totalTaskCount}
            taskActions={taskActions}
          />
        </div>

        <ContextPanel
          currentDay={data.currentDay}
          timedTasks={data.timedTasks}
          quickCaptureTasks={data.quickCaptureTasks}
          goalNudges={data.goalNudges}
          priorityDraft={priorityDraft.draft}
          canAddGoalNudge={canAddGoalNudge}
          onAddGoalNudge={priorityDraft.addGoalNudge}
        />
      </div>

      <RecoveryLane
        overdueTasks={data.overdueTasks}
        overdueTasksQuery={data.overdueTasksQuery}
        taskActions={taskActions}
      />
    </div>
  );
}
