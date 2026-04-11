import "./today.css";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type CSSProperties } from "react";
import {
  useLocation,
  useSearchParams,
} from "react-router-dom";
import {
  InlineErrorState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import { readHomeDestinationState } from "../../shared/lib/homeNavigation";
import { CommandBar } from "./components/CommandBar";
import { FocusStack } from "./components/FocusStack";
import { ExecutionStream } from "./components/ExecutionStream";
import { DailyEssentials } from "./components/DailyEssentials";
import { RecoveryTray } from "./components/RecoveryTray";
import { DayPlanner } from "./components/DayPlanner";
import { DayNotes } from "./components/DayNotes";
import { TodayTaskCaptureSheet } from "./components/TodayTaskCaptureSheet";
import { DailyLaunchCard } from "./components/DailyLaunchCard";
import { MustWinCard } from "./components/MustWinCard";
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
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const data = useTodayData();
  const [mode, setMode] = useState<"execute" | "plan">("execute");
  const [plannerNow, setPlannerNow] = useState(() => new Date());
  const [todayTaskCaptureOpen, setTodayTaskCaptureOpen] = useState(false);
  const [topRailHeight, setTopRailHeight] = useState(0);
  const [stickyTop, setStickyTop] = useState(0);
  const [topRailElement, setTopRailElement] = useState<HTMLDivElement | null>(null);
  const requestedMode = searchParams.get("mode");
  const rawPlannerDate = searchParams.get("planDate");
  const homeDestination = readHomeDestinationState(location.state);
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

  const setTodayMode = useCallback((nextMode: "execute" | "plan") => {
    setMode(nextMode);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (nextMode === "plan") {
        next.set("mode", "plan");
      } else {
        next.delete("mode");
      }
      return next;
    });
  }, [setSearchParams]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setPlannerNow(new Date()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (requestedMode === "execute" || requestedMode === "plan") {
      setMode((current) => (current === requestedMode ? current : requestedMode));
      return;
    }

    if (requestedMode !== null) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete("mode");
        return next;
      }, { replace: true });
      return;
    }

    if (homeDestination?.kind === "today_execute") {
      setMode("execute");
    }
  }, [homeDestination?.kind, requestedMode, setSearchParams]);

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
          onModeChange={setTodayMode}
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
          topPriorityTitle={data.mustWinTask?.title ?? priorityDraft.draft.find((p) => p.status === "pending")?.title}
          onSwitchToPlanner={() => setTodayMode("plan")}
        />

        {allErrors ? (
          <InlineErrorState message={allErrors} onRetry={data.refetchAll} />
        ) : null}
      </div>

      {mode === "execute" ? (
        <div className="today-execute-v2">
          <div className="today-main-v2">
            {!data.launch?.completedAt ? (
              <DailyLaunchCard
                date={data.today}
                tasks={data.executionTasks}
                launch={data.launch}
                mustWinTask={data.mustWinTask}
              />
            ) : null}

            {data.launch?.completedAt && data.mustWinTask ? (
              <MustWinCard date={data.today} task={data.mustWinTask} />
            ) : null}

            <ExecutionStream
              date={data.today}
              executionTasks={data.executionTasks}
              execution={todayPlannerExecution}
              taskActions={taskActions}
              plannerBlocks={data.plannerBlocks}
              phase={phase}
              onSwitchToPlanner={() => setTodayMode("plan")}
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
            <DayNotes tasks={data.quickCaptureTasks} today={data.today} />
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
