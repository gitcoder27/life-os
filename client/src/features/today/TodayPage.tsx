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
import { FocusStack } from "./components/FocusStack";
import { ExecutionStream } from "./components/ExecutionStream";
import { DailyEssentials } from "./components/DailyEssentials";
import { RecoveryTray } from "./components/RecoveryTray";
import { DayPlanner } from "./components/DayPlanner";
import { DayNotes } from "./components/DayNotes";
import { TodayTaskCaptureSheet } from "./components/TodayTaskCaptureSheet";
import { DailyLaunchCard } from "./components/DailyLaunchCard";
import { MustWinCard } from "./components/MustWinCard";
import { PreLaunchModeNotice } from "./components/PreLaunchModeNotice";
import { RescueModeCard } from "./components/RescueModeCard";
import { buildPlannerExecutionModel } from "./helpers/planner-execution";
import { getDayPhase } from "./helpers/day-phase";
import { useTodayData } from "./hooks/useTodayData";
import { usePriorityDraft } from "./hooks/usePriorityDraft";
import { useTaskActions } from "./hooks/useTaskActions";
import { usePlannerActions } from "./hooks/usePlannerActions";
import { useActiveFocusSessionQuery, useDayPlanQuery } from "../../shared/lib/api";
import { isQuickCaptureReferenceTask } from "../../shared/lib/quickCapture";
import { getOffsetDate } from "./helpers/date-helpers";
import { FocusSessionPanel } from "./components/FocusSessionPanel";
import { StartProtocolSheet } from "./components/StartProtocolSheet";
import { WeekDeepWorkStrip } from "./components/WeekDeepWorkStrip";

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
    mode === "plan" ? plannerActions.mutationError : null,
  ]
    .filter((e): e is string => typeof e === "string" && e.length > 0)
    .join("; ");
  const refetchEverything = () => {
    data.refetchAll();
    void activeFocusSessionQuery.refetch();
  };

  const pendingPriorityCount = priorityDraft.draft.filter(
    (p) => p.status === "pending" && p.title.trim(),
  ).length;
  const pendingTaskCount = data.executionTasks.filter((t) => t.status === "pending").length;
  const isRescueMode = data.launch?.dayMode === "rescue" || data.launch?.dayMode === "recovery";
  const rescueDeferredCandidates = data.executionTasks.filter(
    (task) => task.status === "pending" && task.id !== data.mustWinTask?.id,
  );
  const launchCompleted = Boolean(data.launch?.completedAt);
  const showStage = launchCompleted;
  const showAdvisory =
    launchCompleted &&
    (Boolean(data.rescueSuggestion) || isRescueMode || Boolean(data.weekPlan));
  const visibleExecutionTasks = isRescueMode ? [] : data.executionTasks;
  const todayLayoutStyle = {
    "--today-top-rail-height": `${topRailHeight}px`,
    "--today-sticky-offset": `${stickyTop}px`,
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
            <FocusSessionPanel
              date={data.today}
              session={activeFocusSession}
              onClarifyTask={(taskId) => setClarifyTaskId(taskId)}
            />

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
            ) : null}

            {showStage ? (
              <section className="today-desk__stage" aria-label="Today's focus">
                {data.mustWinTask ? (
                  <MustWinCard
                    date={data.today}
                    task={data.mustWinTask}
                    activeFocusSession={activeFocusSession}
                  />
                ) : (
                  <TodayStageEmpty
                    pendingTaskCount={pendingTaskCount}
                    onAddTask={() => setTodayTaskCaptureOpen(true)}
                    onPlanDay={() => navigateToMode("plan")}
                  />
                )}

                <aside className="today-sidebar" aria-label="Quiet rail">
                  {!isRescueMode ? (
                    <FocusStack
                      priorityDraft={priorityDraft}
                      activeGoals={data.activeGoals}
                      phase={phase}
                    />
                  ) : null}
                  <DayNotes tasks={data.quickCaptureTasks} today={data.today} />
                  <DailyEssentials
                    currentDay={data.currentDay}
                    phase={phase}
                  />
                </aside>
              </section>
            ) : null}

            {showAdvisory ? (
              <div className="today-advisory">
                <RescueModeCard
                  date={data.today}
                  launch={data.launch}
                  suggestion={data.rescueSuggestion}
                  mustWinTask={data.mustWinTask}
                  deferredCandidates={rescueDeferredCandidates}
                  taskActions={taskActions}
                />
                <WeekDeepWorkStrip weekPlan={data.weekPlan} />
              </div>
            ) : null}

            <ExecutionStream
              date={data.today}
              executionTasks={visibleExecutionTasks}
              execution={todayPlannerExecution}
              taskActions={taskActions}
              plannerBlocks={data.plannerBlocks}
              phase={phase}
              onSwitchToPlanner={() => navigateToMode("plan")}
              activeFocusSession={activeFocusSession}
            />

            <RecoveryTray
              overdueTasks={data.overdueTasks}
              taskActions={taskActions}
            />
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
            ? data.executionTasks.find((task) => task.id === clarifyTaskId) ?? null
            : null
        }
        onClose={() => setClarifyTaskId(null)}
      />
    </div>
  );
}

function TodayStageEmpty({
  pendingTaskCount,
  onAddTask,
  onPlanDay,
}: {
  pendingTaskCount: number;
  onAddTask: () => void;
  onPlanDay: () => void;
}) {
  const headline = pendingTaskCount > 0
    ? `${pendingTaskCount} task${pendingTaskCount === 1 ? "" : "s"} on the table`
    : "All clear.";
  const subline = pendingTaskCount > 0
    ? "Pick one believable move and let the rest wait."
    : "You have room. Set a direction before the day fills itself.";

  return (
    <div className="today-stage-empty">
      <span className="today-stage-empty__eyebrow">Today</span>
      <h2 className="today-stage-empty__headline">{headline}</h2>
      <p className="today-stage-empty__subline">{subline}</p>
      <div className="must-win-card__actions">
        <button
          className="button button--primary button--small"
          type="button"
          onClick={onAddTask}
        >
          Add task
        </button>
        <button
          className="button button--ghost button--small"
          type="button"
          onClick={onPlanDay}
        >
          Plan the day
        </button>
      </div>
    </div>
  );
}
