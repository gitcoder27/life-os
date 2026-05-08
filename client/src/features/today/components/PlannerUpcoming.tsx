import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  formatEstimatedMinutes,
  filterScheduledPendingTasks,
  getInitialUpcomingVisibleRange,
  getUpcomingRangeLabel,
  groupUpcomingTasks,
  buildUpcomingDayTotals,
  mapTasksToCalendarEvents,
  type UpcomingDayTotal,
  type UpcomingView,
  type UpcomingVisibleRange,
} from "../helpers/upcoming-calendar";
import {
  useTasksQuery,
  type TaskItem,
} from "../../../shared/lib/api";
import { InlineErrorState } from "../../../shared/ui/PageState";
import { UpcomingAgendaView } from "./planner-upcoming/UpcomingAgendaView";
import { UpcomingCalendarView } from "./planner-upcoming/UpcomingCalendarView";
import { UpcomingDayDetail } from "./planner-upcoming/UpcomingDayDetail";
import { UpcomingViewSwitch } from "./planner-upcoming/UpcomingViewSwitch";

type PlannerUpcomingProps = {
  todayDate: string;
  view: UpcomingView;
  onViewChange: (view: UpcomingView) => void;
  onOpenDate: (date: string) => void;
  onEditTask: (task: TaskItem) => void;
};

function PlannerUpcomingSkeleton({ view }: { view: UpcomingView }) {
  if (view !== "agenda") {
    return (
      <div className="planner-upcoming__calendar-skeleton" aria-label="Loading upcoming calendar">
        <div className="planner-upcoming__calendar-skeleton-nav" />
        <div className="planner-upcoming__calendar-skeleton-grid">
          {Array.from({ length: view === "week" ? 7 : 35 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="planner-upcoming__skeleton" aria-label="Loading upcoming work">
      {[0, 1, 2].map((index) => (
        <div className="planner-upcoming__skeleton-group" key={index}>
          <div className="planner-upcoming__skeleton-date" />
          <div className="planner-upcoming__skeleton-lines">
            <span />
            <span />
          </div>
        </div>
      ))}
    </div>
  );
}

const getFallbackDay = (
  selectedDate: string | null,
  visibleRange: UpcomingVisibleRange,
  totalsByDay: Map<string, UpcomingDayTotal>,
) => {
  if (
    selectedDate &&
    selectedDate >= visibleRange.from &&
    selectedDate <= visibleRange.to
  ) {
    return selectedDate;
  }

  return [...totalsByDay.keys()].find(
    (date) => date >= visibleRange.from && date <= visibleRange.to,
  ) ?? visibleRange.from;
};

const visibleRangesMatch = (
  left: UpcomingVisibleRange,
  right: UpcomingVisibleRange,
) => left.from === right.from && left.to === right.to;

export function PlannerUpcoming({
  todayDate,
  view,
  onViewChange,
  onOpenDate,
  onEditTask,
}: PlannerUpcomingProps) {
  const [visibleRange, setVisibleRange] = useState<UpcomingVisibleRange>(() =>
    getInitialUpcomingVisibleRange(view, todayDate),
  );
  const visibleRangeRef = useRef(visibleRange);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const updateVisibleRange = useCallback((nextRange: UpcomingVisibleRange) => {
    if (visibleRangesMatch(visibleRangeRef.current, nextRange)) {
      return;
    }

    visibleRangeRef.current = nextRange;
    setVisibleRange(nextRange);
  }, []);

  useEffect(() => {
    updateVisibleRange(getInitialUpcomingVisibleRange(view, todayDate));
  }, [todayDate, updateVisibleRange, view]);

  const tasksQuery = useTasksQuery({
    from: visibleRange.from,
    to: visibleRange.to,
    status: "pending",
  });

  const tasks = useMemo(
    () => filterScheduledPendingTasks(tasksQuery.data?.tasks ?? [], todayDate),
    [tasksQuery.data?.tasks, todayDate],
  );
  const groups = useMemo(() => groupUpcomingTasks(tasks), [tasks]);
  const totalsByDay = useMemo(() => buildUpcomingDayTotals(tasks), [tasks]);
  const events = useMemo(() => mapTasksToCalendarEvents(tasks), [tasks]);
  const selectedDayDate = useMemo(
    () => view === "agenda" ? null : getFallbackDay(selectedDate, visibleRange, totalsByDay),
    [selectedDate, totalsByDay, view, visibleRange],
  );
  const selectedDay = selectedDayDate ? totalsByDay.get(selectedDayDate) ?? {
    date: selectedDayDate,
    tasks: [],
    taskCount: 0,
    estimatedMinutes: 0,
  } : null;
  const taskCount = tasks.length;
  const estimatedMinutes = formatEstimatedMinutes(
    [...totalsByDay.values()].reduce((total, day) => total + day.estimatedMinutes, 0),
  );
  const rangeLabel = getUpcomingRangeLabel(view, visibleRange);
  const isInitialLoading = tasksQuery.isLoading && !tasksQuery.data;
  const hasBlockingError = tasksQuery.isError && !tasksQuery.data;

  return (
    <section className="planner-upcoming" aria-labelledby="planner-upcoming-title">
      <div className="planner-upcoming__header">
        <div className="planner-upcoming__heading">
          <p className="planner-upcoming__eyebrow">Upcoming</p>
          <h2 className="planner-upcoming__title" id="planner-upcoming-title">
            Scheduled work
          </h2>
        </div>
        <div className="planner-upcoming__header-tools">
          <div className="planner-upcoming__summary" aria-label="Upcoming summary">
            <span>{taskCount} item{taskCount === 1 ? "" : "s"}</span>
            {estimatedMinutes ? <span>{estimatedMinutes}</span> : null}
            <span>{rangeLabel}</span>
          </div>
          <UpcomingViewSwitch value={view} onChange={onViewChange} />
        </div>
      </div>

      {tasksQuery.isError ? (
        <InlineErrorState
          message={tasksQuery.error instanceof Error ? tasksQuery.error.message : "Upcoming work could not load."}
          onRetry={() => void tasksQuery.refetch()}
        />
      ) : null}

      {hasBlockingError ? null : view === "agenda" && isInitialLoading ? (
        <PlannerUpcomingSkeleton view={view} />
      ) : view === "agenda" ? (
        groups.length > 0 ? (
          <UpcomingAgendaView
            groups={groups}
            todayDate={todayDate}
            onOpenDate={onOpenDate}
            onEditTask={onEditTask}
          />
        ) : (
          <div className="planner-upcoming__empty">
            <div className="planner-upcoming__empty-mark" aria-hidden="true" />
            <h3>No upcoming work scheduled.</h3>
            <p>Items scheduled from Inbox or Today will collect here.</p>
          </div>
        )
      ) : (
        <div className={`planner-upcoming__calendar-layout planner-upcoming__calendar-layout--${view}`}>
          <div className="planner-upcoming__calendar-main">
            <UpcomingCalendarView
              mode={view}
              todayDate={todayDate}
              events={events}
              totalsByDay={totalsByDay}
              visibleRange={visibleRange}
              selectedDate={selectedDayDate}
              onVisibleRangeChange={updateVisibleRange}
              onDateOpen={onOpenDate}
              onDaySelect={setSelectedDate}
              onTaskOpen={onEditTask}
            />
            {!tasksQuery.isFetching && tasks.length === 0 ? (
              <p className="planner-upcoming__calendar-empty">
                No upcoming work scheduled in this range.
              </p>
            ) : null}
          </div>

          {view === "month" ? (
            <UpcomingDayDetail
              day={selectedDay}
              date={selectedDayDate}
              onOpenDate={onOpenDate}
              onEditTask={onEditTask}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}
