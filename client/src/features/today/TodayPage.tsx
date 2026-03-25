import "./today.css";
import { useEffect, useMemo, useState } from "react";
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
import { ModeToggle } from "./components/ModeToggle";
import { DayPlanner } from "./components/DayPlanner";
import { ExecutePlannerFocus } from "./components/ExecutePlannerFocus";
import { buildPlannerExecutionModel } from "./helpers/planner-execution";
import { useTodayData } from "./hooks/useTodayData";
import { usePriorityDraft } from "./hooks/usePriorityDraft";
import { useTaskActions } from "./hooks/useTaskActions";
import { usePlannerActions } from "./hooks/usePlannerActions";

export function TodayPage() {
  const data = useTodayData();
  const [mode, setMode] = useState<"execute" | "plan">("execute");
  const [plannerNow, setPlannerNow] = useState(() => new Date());
  const priorityDraft = usePriorityDraft(
    data.today,
    data.priorities,
    Boolean(data.dayPlanQuery.data),
  );
  const taskActions = useTaskActions(data.today);
  const plannerActions = usePlannerActions(data.today);
  const plannerExecution = useMemo(
    () =>
      buildPlannerExecutionModel({
        blocks: data.plannerBlocks,
        unplannedTasks: data.unplannedTasks,
        now: plannerNow,
      }),
    [data.plannerBlocks, data.unplannedTasks, plannerNow],
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => setPlannerNow(new Date()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

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

  const allErrors = [
    priorityDraft.mutationError instanceof Error
      ? priorityDraft.mutationError.message
      : null,
    taskActions.mutationError,
    plannerActions.mutationError,
  ]
    .filter((e): e is string => typeof e === "string" && e.length > 0)
    .join("; ");

  const canAddGoalNudge =
    priorityDraft.draft.length < 3 || priorityDraft.draft.some((p) => !p.title.trim());

  return (
    <div className="today-layout">
      <div className="today-top-bar">
        <ScoreProgressStrip />
        <ModeToggle
          mode={mode}
          onModeChange={setMode}
          plannerBlockCount={data.plannerBlocks.length}
        />
      </div>

      {allErrors ? (
        <InlineErrorState message={allErrors} onRetry={data.refetchAll} />
      ) : null}

      {mode === "execute" ? (
        <>
          <div className="today-columns">
            <div className="today-focus-zone">
              <PriorityStack
                priorityDraft={priorityDraft}
                activeGoals={data.activeGoals}
              />

              <ExecutePlannerFocus
                execution={plannerExecution}
                plannerActions={plannerActions}
                taskActions={taskActions}
                onSwitchToPlanner={() => setMode("plan")}
              />

              <TaskQueue
                taskGroups={data.taskGroups}
                completedCount={data.completedTaskCount}
                totalCount={data.totalTaskCount}
                taskActions={taskActions}
                plannerBlocks={data.plannerBlocks}
                plannedTaskCount={data.plannedPendingTaskCount}
                unplannedTaskCount={data.unplannedPendingTaskCount}
                onSwitchToPlanner={() => setMode("plan")}
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
              plannerBlocks={data.plannerBlocks}
              plannerExecution={plannerExecution}
              unplannedTaskCount={data.unplannedPendingTaskCount}
              onSwitchToPlanner={() => setMode("plan")}
            />
          </div>

          <RecoveryLane
            overdueTasks={data.overdueTasks}
            overdueTasksQuery={data.overdueTasksQuery}
            taskActions={taskActions}
          />
        </>
      ) : (
        <DayPlanner
          date={data.today}
          blocks={data.plannerBlocks}
          unplannedTasks={data.unplannedTasks}
          execution={plannerExecution}
          actions={plannerActions}
          taskActions={taskActions}
        />
      )}
    </div>
  );
}
