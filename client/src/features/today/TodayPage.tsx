import "./today.css";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
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
import { useDayPlanQuery } from "../../shared/lib/api";
import { isQuickCaptureReferenceTask } from "../../shared/lib/quickCapture";
import { getOffsetDate } from "./helpers/date-helpers";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const isPlannerAssignableTask = (task: { kind: string }) => task.kind === "task";

export function TodayPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const data = useTodayData();
  const [mode, setMode] = useState<"execute" | "plan">("execute");
  const [plannerNow, setPlannerNow] = useState(() => new Date());
  const [todayTaskCaptureOpen, setTodayTaskCaptureOpen] = useState(false);
  const [topRailHeight, setTopRailHeight] = useState(0);
  const [stickyTop, setStickyTop] = useState(0);
  const [topRailElement, setTopRailElement] = useState<HTMLDivElement | null>(null);
  const rawPlannerDate = searchParams.get("planDate");
  const plannerDate = rawPlannerDate && ISO_DATE_PATTERN.test(rawPlannerDate)
    ? rawPlannerDate
    : data.today;
  const isPastPlannerDate = plannerDate < data.today;
  const isLivePlannerDate = plannerDate === data.today;
  const isEditablePlannerDate = plannerDate >= data.today;
  const plannerDayPlanQuery = useDayPlanQuery(plannerDate);
  const priorityDraft = usePriorityDraft(
    data.today,
    data.priorities,
    Boolean(data.dayPlanQuery.data),
  );
  const taskActions = useTaskActions(data.today);
  const plannerTaskActions = useTaskActions(plannerDate);
  const plannerActions = usePlannerActions(plannerDate);
  const plannerDayPlan = plannerDayPlanQuery.data;
  const plannerExecutionTasks = useMemo(
    () => (plannerDayPlan?.tasks ?? []).filter((task) => !isQuickCaptureReferenceTask(task)),
    [plannerDayPlan?.tasks],
  );
  const plannerBlocks = plannerDayPlan?.plannerBlocks ?? [];
  const plannerTaskIds = useMemo(() => {
    const ids = new Set<string>();
    for (const block of plannerBlocks) {
      for (const blockTask of block.tasks) {
        ids.add(blockTask.taskId);
      }
    }
    return ids;
  }, [plannerBlocks]);
  const plannerUnplannedTasks = useMemo(
    () =>
      plannerExecutionTasks.filter(
        (task) =>
          task.status === "pending" &&
          isPlannerAssignableTask(task) &&
          !plannerTaskIds.has(task.id),
      ),
    [plannerExecutionTasks, plannerTaskIds],
  );
  const todayPlannerExecution = useMemo(
    () =>
      buildPlannerExecutionModel({
        blocks: data.plannerBlocks,
        unplannedTasks: data.unplannedTasks,
        now: plannerNow,
        isLiveDate: true,
      }),
    [data.plannerBlocks, data.unplannedTasks, plannerNow],
  );
  const plannerExecution = useMemo(
    () =>
      buildPlannerExecutionModel({
        blocks: plannerBlocks,
        unplannedTasks: plannerUnplannedTasks,
        now: plannerNow,
        isLiveDate: isLivePlannerDate,
      }),
    [isLivePlannerDate, plannerBlocks, plannerNow, plannerUnplannedTasks],
  );

  const phase = getDayPhase(plannerNow);
  const topRailRef = useCallback((node: HTMLDivElement | null) => {
    setTopRailElement(node);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => setPlannerNow(new Date()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useLayoutEffect(() => {
    if (!topRailElement) {
      return;
    }

    let frameId = 0;

    const updateStickyLayout = () => {
      frameId = 0;

      const nextTopRailHeight = topRailElement.getBoundingClientRect().height;
      const shellHeaderHeight = Number.parseFloat(
        getComputedStyle(topRailElement).getPropertyValue("--shell-header-height") || "0",
      ) || 0;
      const rootFontSize = Number.parseFloat(
        getComputedStyle(document.documentElement).fontSize || "16",
      ) || 16;
      const nextStickyTop = Math.max(shellHeaderHeight + nextTopRailHeight + rootFontSize, 0);

      setTopRailHeight(nextTopRailHeight);
      setStickyTop(nextStickyTop);
    };

    const scheduleStickyLayoutUpdate = () => {
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(updateStickyLayout);
    };

    scheduleStickyLayoutUpdate();
    window.addEventListener("resize", scheduleStickyLayoutUpdate);
    window.addEventListener("pageshow", scheduleStickyLayoutUpdate);

    if (typeof ResizeObserver === "undefined") {
      return () => {
        if (frameId !== 0) {
          window.cancelAnimationFrame(frameId);
        }
        window.removeEventListener("resize", scheduleStickyLayoutUpdate);
        window.removeEventListener("pageshow", scheduleStickyLayoutUpdate);
      };
    }

    const resizeObserver = new ResizeObserver(() => scheduleStickyLayoutUpdate());
    resizeObserver.observe(topRailElement);
    const shellHeaderElement = document.querySelector(".shell-header");
    if (shellHeaderElement instanceof HTMLElement) {
      resizeObserver.observe(shellHeaderElement);
    }

    return () => {
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("resize", scheduleStickyLayoutUpdate);
      window.removeEventListener("pageshow", scheduleStickyLayoutUpdate);
      resizeObserver.disconnect();
    };
  }, [topRailElement]);

  useEffect(() => {
    if (!rawPlannerDate) {
      return;
    }

    if (ISO_DATE_PATTERN.test(rawPlannerDate)) {
      return;
    }

    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("planDate");
      return next;
    }, { replace: true });
  }, [rawPlannerDate, setSearchParams]);

  function setPlannerDate(nextDate: string) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (nextDate === data.today) {
        next.delete("planDate");
      } else {
        next.set("planDate", nextDate);
      }
      return next;
    });
  }

  function stepPlannerDate(direction: -1 | 1) {
    setPlannerDate(getOffsetDate(plannerDate, direction));
  }

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

  if (mode === "plan" && plannerDayPlanQuery.isLoading && !plannerDayPlan) {
    return (
      <PageLoadingState
        title="Loading day plan"
        description="Pulling the selected day's planner blocks and tasks."
      />
    );
  }

  if (mode === "plan" && (plannerDayPlanQuery.isError || !plannerDayPlan)) {
    return (
      <PageErrorState
        title="Selected day could not load"
        message={plannerDayPlanQuery.error instanceof Error ? plannerDayPlanQuery.error.message : undefined}
        onRetry={() => {
          void plannerDayPlanQuery.refetch();
        }}
      />
    );
  }

  const activeTaskActions = mode === "plan" ? plannerTaskActions : taskActions;
  const allErrors = [
    priorityDraft.mutationError instanceof Error
      ? priorityDraft.mutationError.message
      : null,
    activeTaskActions.mutationError,
    mode === "plan" ? plannerActions.mutationError : null,
  ]
    .filter((e): e is string => typeof e === "string" && e.length > 0)
    .join("; ");

  const pendingPriorityCount = priorityDraft.draft.filter(
    (p) => p.status === "pending" && p.title.trim(),
  ).length;
  const pendingTaskCount = data.executionTasks.filter((t) => t.status === "pending").length;
  const todayLayoutStyle = {
    "--today-top-rail-height": `${topRailHeight}px`,
    "--today-sticky-offset": `${stickyTop}px`,
  } as CSSProperties;
  const todaySidebarStyle = {
    top: `${stickyTop}px`,
    maxHeight: `calc(100vh - ${stickyTop}px - 1.5rem)`,
  } as CSSProperties;
  const plannerSidebarStyle = {
    top: `${stickyTop}px`,
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
          hasDrift={todayPlannerExecution.slippedBlocks.length > 0}
          onAddTask={() => setTodayTaskCaptureOpen(true)}
          execution={todayPlannerExecution}
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
              execution={todayPlannerExecution}
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
          date={plannerDate}
          todayDate={data.today}
          isEditable={isEditablePlannerDate}
          isLiveDate={isLivePlannerDate}
          isHistoryDate={isPastPlannerDate}
          blocks={plannerBlocks}
          unplannedTasks={plannerUnplannedTasks}
          execution={plannerExecution}
          actions={plannerActions}
          taskActions={plannerTaskActions}
          onSelectDate={setPlannerDate}
          onStepDate={stepPlannerDate}
          sidebarStyle={plannerSidebarStyle}
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
