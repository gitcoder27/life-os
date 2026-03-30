import "./today.css";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
  const [topRailHeight, setTopRailHeight] = useState(0);
  const topRailRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const topRailElement = topRailRef.current;
    if (!topRailElement) {
      return;
    }

    const updateTopRailHeight = () => {
      setTopRailHeight(topRailElement.getBoundingClientRect().height);
    };

    updateTopRailHeight();
    window.addEventListener("resize", updateTopRailHeight);

    if (typeof ResizeObserver === "undefined") {
      return () => window.removeEventListener("resize", updateTopRailHeight);
    }

    const resizeObserver = new ResizeObserver(() => updateTopRailHeight());
    resizeObserver.observe(topRailElement);

    return () => {
      window.removeEventListener("resize", updateTopRailHeight);
      resizeObserver.disconnect();
    };
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
  const todayLayoutStyle = {
    "--today-top-rail-height": `${topRailHeight}px`,
  } as CSSProperties;
  const todaySidebarStyle = {
    top: `calc(var(--shell-header-height, 0px) + ${topRailHeight}px + 1rem)`,
    maxHeight: `calc(100vh - var(--shell-header-height, 0px) - ${topRailHeight}px - 1.5rem)`,
  } as CSSProperties;

  return (
    <div className="today-layout today-layout--v2" style={todayLayoutStyle}>
      <div className="today-top-rail" ref={topRailRef}>
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
          execution={plannerExecution}
          topPriorityTitle={priorityDraft.draft.find((p) => p.status === "pending")?.title}
          onSwitchToPlanner={() => setMode("plan")}
        />

        {allErrors ? (
          <InlineErrorState message={allErrors} onRetry={data.refetchAll} />
        ) : null}
      </div>

      {mode === "execute" ? (
        <div className="today-execute-v2">
          <div className="today-main-v2">
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

          <aside className="today-sidebar" style={todaySidebarStyle}>
            <FocusStack
              priorityDraft={priorityDraft}
              activeGoals={data.activeGoals}
              phase={phase}
            />
            <DailyEssentials
              currentDay={data.currentDay}
              phase={phase}
            />
          </aside>
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
