import "./today.css";
import { useEffect, useMemo, useState } from "react";
import {
  InlineErrorState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import { CommandBar } from "./components/CommandBar";
import { FocusStack } from "./components/FocusStack";
import { ExecutionStream } from "./components/ExecutionStream";
import { DailyEssentials } from "./components/DailyEssentials";
import { RecoveryTray } from "./components/RecoveryTray";
import { DayPlanner } from "./components/DayPlanner";
import { TodayTaskCaptureSheet } from "./components/TodayTaskCaptureSheet";
import { buildPlannerExecutionModel } from "./helpers/planner-execution";
import { getDayPhase } from "./helpers/day-phase";
import { useTodayData } from "./hooks/useTodayData";
import { usePriorityDraft } from "./hooks/usePriorityDraft";
import { useTaskActions } from "./hooks/useTaskActions";
import { usePlannerActions } from "./hooks/usePlannerActions";

export function TodayPage() {
  const data = useTodayData();
  const [mode, setMode] = useState<"execute" | "plan">("execute");
  const [plannerNow, setPlannerNow] = useState(() => new Date());
  const [todayTaskCaptureOpen, setTodayTaskCaptureOpen] = useState(false);
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

  const phase = getDayPhase(plannerNow);

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

  const pendingPriorityCount = priorityDraft.draft.filter(
    (p) => p.status === "pending" && p.title.trim(),
  ).length;
  const pendingTaskCount = data.executionTasks.filter((t) => t.status === "pending").length;

  return (
    <div className="today-layout today-layout--v2">
      <CommandBar
        mode={mode}
        onModeChange={setMode}
        plannerBlockCount={data.plannerBlocks.length}
        now={plannerNow}
        pendingPriorityCount={pendingPriorityCount}
        totalPriorityCount={priorityDraft.draft.filter((p) => p.title.trim()).length}
        pendingTaskCount={pendingTaskCount}
        completedTaskCount={data.completedTaskCount}
        totalTaskCount={data.totalTaskCount}
        overdueCount={data.overdueTasks.length}
        hasDrift={plannerExecution.slippedBlocks.length > 0}
        onAddTask={() => setTodayTaskCaptureOpen(true)}
      />

      {allErrors ? (
        <InlineErrorState message={allErrors} onRetry={data.refetchAll} />
      ) : null}

      {mode === "execute" ? (
        <div className="today-execute-v2">
          <div className="today-main-v2">
            <FocusStack
              priorityDraft={priorityDraft}
              activeGoals={data.activeGoals}
              execution={plannerExecution}
              phase={phase}
              onSwitchToPlanner={() => setMode("plan")}
            />

            <ExecutionStream
              executionTasks={data.executionTasks}
              execution={plannerExecution}
              taskActions={taskActions}
              plannerBlocks={data.plannerBlocks}
              phase={phase}
              onSwitchToPlanner={() => setMode("plan")}
            />

            <RecoveryTray
              overdueTasks={data.overdueTasks}
              taskActions={taskActions}
            />
          </div>

          <DailyEssentials
            currentDay={data.currentDay}
            phase={phase}
          />
        </div>
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

      <TodayTaskCaptureSheet
        open={todayTaskCaptureOpen}
        today={data.today}
        onClose={() => setTodayTaskCaptureOpen(false)}
      />
    </div>
  );
}
