import "./today.css";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type CSSProperties } from "react";
import {
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  InlineErrorState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import { readHomeDestinationState } from "../../shared/lib/homeNavigation";
import { CommandBar } from "./components/CommandBar";
import { ExecutionStream } from "./components/ExecutionStream";
import { DailyEssentials } from "./components/DailyEssentials";
import { DayPlanner } from "./components/DayPlanner";
import { DayNotes } from "./components/DayNotes";
import { TodayTaskCaptureSheet } from "./components/TodayTaskCaptureSheet";
import { DailyLaunchCard } from "./components/DailyLaunchCard";
import { PreLaunchModeNotice } from "./components/PreLaunchModeNotice";
import { buildPlannerExecutionModel } from "./helpers/planner-execution";
import { getDayPhase } from "./helpers/day-phase";
import { useTodayData } from "./hooks/useTodayData";
import { usePriorityDraft } from "./hooks/usePriorityDraft";
import { useTaskActions } from "./hooks/useTaskActions";
import { usePlannerActions } from "./hooks/usePlannerActions";
import {
  useActiveFocusSessionQuery,
  useCreateTaskMutation,
  useDayPlanQuery,
  type GoalNudgeItem,
} from "../../shared/lib/api";
import { isQuickCaptureReferenceTask } from "../../shared/lib/quickCapture";
import { getOffsetDate } from "./helpers/date-helpers";
import { StartProtocolSheet } from "./components/StartProtocolSheet";
import { WeekDeepWorkStrip } from "./components/WeekDeepWorkStrip";
import { GoalNudges } from "./components/GoalNudges";
import { TaskInspectorPanel } from "./components/TaskInspectorPanel";
import {
  clearStoredWorkbenchRailWidth,
  clampWorkbenchRailWidth,
  DEFAULT_WORKBENCH_RAIL_WIDTH,
  readStoredWorkbenchRailWidth,
  WORKBENCH_RAIL_WIDTH_STEP,
  writeStoredWorkbenchRailWidth,
} from "./helpers/workbench-layout";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const isPlannerAssignableTask = (task: { kind: string }) => task.kind === "task";

function toSearchString(params: URLSearchParams) {
  const search = params.toString();
  return search ? `?${search}` : "";
}

export function TodayPage({ routeMode }: { routeMode?: "execute" | "plan" }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const data = useTodayData();
  const [mode, setMode] = useState<"execute" | "plan">(() => {
    if (routeMode) {
      return routeMode;
    }

    return searchParams.get("mode") === "plan" ? "plan" : "execute";
  });
  const [plannerNow, setPlannerNow] = useState(() => new Date());
  const [todayTaskCaptureOpen, setTodayTaskCaptureOpen] = useState(false);
  const [topRailHeight, setTopRailHeight] = useState(0);
  const [stickyTop, setStickyTop] = useState(0);
  const [topRailElement, setTopRailElement] = useState<HTMLDivElement | null>(null);
  const [clarifyTaskId, setClarifyTaskId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [workbenchRailWidth, setWorkbenchRailWidth] = useState(readStoredWorkbenchRailWidth);
  const [workbenchResizing, setWorkbenchResizing] = useState(false);
  const [workbenchElement, setWorkbenchElement] = useState<HTMLElement | null>(null);
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
  const activeFocusSessionQuery = useActiveFocusSessionQuery();
  const createGoalTaskMutation = useCreateTaskMutation(data.today, {
    successMessage: "Goal task added to Today.",
    errorMessage: "Goal task could not be added.",
  });
  const priorityDraft = usePriorityDraft(
    data.today,
    data.priorities,
    Boolean(data.dayPlanQuery.data),
  );
  const taskActions = useTaskActions(data.today);
  const plannerTaskActions = useTaskActions(plannerDate);
  const plannerActions = usePlannerActions(plannerDate);
  const plannerDayPlan = plannerDayPlanQuery.data;
  const activeFocusSession = activeFocusSessionQuery.data?.session ?? null;
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
  const plannerRecoveryTasks = useMemo(
    () =>
      isLivePlannerDate
        ? data.overdueTasks.filter(
            (task) =>
              task.status === "pending" &&
              isPlannerAssignableTask(task) &&
              !plannerTaskIds.has(task.id),
          )
        : [],
    [data.overdueTasks, isLivePlannerDate, plannerTaskIds],
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
  const selectableTasks = useMemo(
    () => [...data.executionTasks, ...data.overdueTasks],
    [data.executionTasks, data.overdueTasks],
  );
  const selectedTask = useMemo(
    () => selectableTasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectableTasks, selectedTaskId],
  );
  const defaultSelectedTaskId =
    activeFocusSession?.taskId ??
    data.mustWinTask?.id ??
    data.executionTasks.find((task) => task.status === "pending")?.id ??
    data.overdueTasks.find((task) => task.status === "pending")?.id ??
    null;

  const phase = getDayPhase(plannerNow);
  const topRailRef = useCallback((node: HTMLDivElement | null) => {
    setTopRailElement(node);
  }, []);
  const workbenchRef = useCallback((node: HTMLElement | null) => {
    setWorkbenchElement(node);
  }, []);

  useEffect(() => {
    if (mode !== "execute") {
      return;
    }

    if (selectedTaskId && selectableTasks.some((task) => task.id === selectedTaskId)) {
      return;
    }

    setSelectedTaskId(defaultSelectedTaskId);
  }, [defaultSelectedTaskId, mode, selectableTasks, selectedTaskId]);

  useEffect(() => {
    if (!workbenchResizing) {
      return;
    }

    function stopResizing() {
      setWorkbenchResizing(false);
    }

    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("blur", stopResizing);
    return () => {
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("blur", stopResizing);
    };
  }, [workbenchResizing]);

  const updateWorkbenchRailWidth = useCallback((nextWidth: number, persist = true) => {
    const clampedWidth = clampWorkbenchRailWidth(nextWidth);
    setWorkbenchRailWidth(clampedWidth);
    if (persist) {
      writeStoredWorkbenchRailWidth(clampedWidth);
    }
  }, []);

  const resizeWorkbenchRailFromPointer = useCallback((clientX: number) => {
    if (!workbenchElement) {
      return;
    }

    const bounds = workbenchElement.getBoundingClientRect();
    updateWorkbenchRailWidth(bounds.right - clientX);
  }, [updateWorkbenchRailWidth, workbenchElement]);

  const resetWorkbenchRailWidth = useCallback(() => {
    clearStoredWorkbenchRailWidth();
    setWorkbenchRailWidth(DEFAULT_WORKBENCH_RAIL_WIDTH);
  }, []);

  const navigateToMode = useCallback((nextMode: "execute" | "plan", replace = false) => {
    setMode(nextMode);
    const next = new URLSearchParams(searchParams);
    next.delete("mode");

    if (nextMode === "plan") {
      if (plannerDate === data.today) {
        next.delete("planDate");
      } else {
        next.set("planDate", plannerDate);
      }

      navigate(
        {
          pathname: "/planner",
          search: toSearchString(next),
        },
        { replace },
      );
      return;
    }

    next.delete("planDate");
    navigate(
      {
        pathname: "/today",
        search: toSearchString(next),
      },
      { replace },
    );
  }, [data.today, navigate, plannerDate, searchParams]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setPlannerNow(new Date()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (routeMode === "plan") {
      setMode("plan");
      return;
    }

    if (routeMode === "execute") {
      if (requestedMode === "plan") {
        navigateToMode("plan", true);
        return;
      }

      setMode("execute");
      return;
    }

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
  }, [homeDestination?.kind, navigateToMode, requestedMode, routeMode, setSearchParams]);

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
    activeFocusSessionQuery.error instanceof Error
      ? activeFocusSessionQuery.error.message
      : null,
    createGoalTaskMutation.error instanceof Error
      ? createGoalTaskMutation.error.message
      : null,
    mode === "plan" ? plannerActions.mutationError : null,
  ]
    .filter((e): e is string => typeof e === "string" && e.length > 0)
    .join("; ");
  const refetchEverything = () => {
    data.refetchAll();
    void activeFocusSessionQuery.refetch();
  };

  async function handleAddGoalNudge(nudge: GoalNudgeItem) {
    await createGoalTaskMutation.mutateAsync({
      title: nudge.suggestedPriorityTitle,
      notes: nudge.nextBestAction,
      kind: "task",
      scheduledForDate: data.today,
      goalId: nudge.goal.id,
      originType: "manual",
      nextAction: nudge.suggestedPriorityTitle,
      fiveMinuteVersion: nudge.suggestedPriorityTitle,
      estimatedDurationMinutes: 25,
      focusLengthMinutes: 25,
    });
  }

  const pendingPriorityCount = priorityDraft.draft.filter(
    (p) => p.status === "pending" && p.title.trim(),
  ).length;
  const pendingTaskCount = data.executionTasks.filter((t) => t.status === "pending").length;
  const launchCompleted = Boolean(data.launch?.completedAt);
  const todayLayoutStyle = {
    "--today-top-rail-height": `${topRailHeight}px`,
    "--today-sticky-offset": `${stickyTop}px`,
    "--today-workbench-rail-width": `${workbenchRailWidth}px`,
  } as CSSProperties;
  const plannerSidebarStyle = {
    top: `${stickyTop}px`,
  } as CSSProperties;

  const deskClass = mode === "execute" ? "today-desk " : "";

  return (
    <div className={`${deskClass}today-layout today-layout--v2`} style={todayLayoutStyle}>
      <div className="today-top-rail" ref={topRailRef}>
        <CommandBar
          mode={mode}
          onModeChange={navigateToMode}
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
          onSwitchToPlanner={() => navigateToMode("plan")}
        />

        {allErrors ? (
          <InlineErrorState message={allErrors} onRetry={refetchEverything} />
        ) : null}
      </div>

      {mode === "execute" ? (
        <div className="today-execute-v2">
          <div className="today-main-v2">
            {!launchCompleted ? (
              <>
                <PreLaunchModeNotice
                  date={data.today}
                  launch={data.launch}
                  suggestion={data.rescueSuggestion}
                />
                <DailyLaunchCard
                  date={data.today}
                  tasks={data.executionTasks}
                  launch={data.launch}
                  mustWinTask={data.mustWinTask}
                />
              </>
            ) : (
              <section
                className={`today-workbench${workbenchResizing ? " today-workbench--resizing" : ""}`}
                aria-label="Today workbench"
                ref={workbenchRef}
              >
                <div className="today-workbench__queue">
                  <ExecutionStream
                    date={data.today}
                    executionTasks={data.executionTasks}
                    overdueTasks={data.overdueTasks}
                    execution={todayPlannerExecution}
                    taskActions={taskActions}
                    plannerBlocks={data.plannerBlocks}
                    onSwitchToPlanner={() => navigateToMode("plan")}
                    activeFocusSession={activeFocusSession}
                    mustWinTaskId={data.mustWinTask?.id ?? null}
                    selectedTaskId={selectedTaskId}
                    onSelectTask={(task) => setSelectedTaskId(task.id)}
                  />
                </div>

                <div
                  className="today-workbench__resize"
                  role="separator"
                  tabIndex={0}
                  aria-label="Resize today context column"
                  aria-orientation="vertical"
                  aria-valuemin={320}
                  aria-valuemax={544}
                  aria-valuenow={workbenchRailWidth}
                  title="Drag to resize. Double-click to reset."
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setWorkbenchResizing(true);
                    resizeWorkbenchRailFromPointer(event.clientX);
                  }}
                  onPointerMove={(event) => {
                    if (!workbenchResizing) {
                      return;
                    }
                    resizeWorkbenchRailFromPointer(event.clientX);
                  }}
                  onPointerUp={(event) => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    }
                    setWorkbenchResizing(false);
                  }}
                  onDoubleClick={resetWorkbenchRailWidth}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowLeft") {
                      event.preventDefault();
                      updateWorkbenchRailWidth(workbenchRailWidth + WORKBENCH_RAIL_WIDTH_STEP);
                      return;
                    }
                    if (event.key === "ArrowRight") {
                      event.preventDefault();
                      updateWorkbenchRailWidth(workbenchRailWidth - WORKBENCH_RAIL_WIDTH_STEP);
                      return;
                    }
                    if (event.key === "Home") {
                      event.preventDefault();
                      resetWorkbenchRailWidth();
                    }
                  }}
                />

                <aside className="today-workbench__side" aria-label="Today context">
                  <TaskInspectorPanel
                    date={data.today}
                    task={selectedTask}
                    taskActions={taskActions}
                    activeFocusSession={activeFocusSession}
                    onAddTask={() => setTodayTaskCaptureOpen(true)}
                    onPlanDay={() => navigateToMode("plan")}
                    onClarifyTask={(taskId) => setClarifyTaskId(taskId)}
                  />

                  <div className="today-workbench__support">
                    <GoalNudges
                      date={data.today}
                      nudges={data.goalNudges}
                      onAdd={handleAddGoalNudge}
                      isAdding={createGoalTaskMutation.isPending}
                      compact
                    />

                    <DailyEssentials
                      currentDay={data.currentDay}
                      phase={phase}
                    />
                    <WeekDeepWorkStrip weekPlan={data.weekPlan} />
                    <DayNotes tasks={data.quickCaptureTasks} today={data.today} />
                  </div>
                </aside>
              </section>
            )}
          </div>
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
          recoveryTasks={plannerRecoveryTasks}
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

      <StartProtocolSheet
        open={Boolean(clarifyTaskId)}
        date={data.today}
        task={
          clarifyTaskId
            ? selectableTasks.find((task) => task.id === clarifyTaskId) ?? null
            : null
        }
        onClose={() => setClarifyTaskId(null)}
      />
    </div>
  );
}
