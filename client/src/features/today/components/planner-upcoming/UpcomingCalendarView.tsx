import { useCallback, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type {
  CalendarApi,
  DatesSetArg,
  DayCellContentArg,
  DayHeaderContentArg,
  EventClickArg,
  EventContentArg,
  MoreLinkArg,
} from "@fullcalendar/core";
import type { TaskItem } from "../../../../shared/lib/api";
import {
  formatEstimatedMinutes,
  getInitialUpcomingVisibleRange,
  getRelativeUpcomingLabel,
  getTaskKindLabel,
  getUpcomingTaskTitle,
  normalizeCalendarVisibleRange,
  toCalendarDateKey,
  type UpcomingCalendarEvent,
  type UpcomingCalendarEventProps,
  type UpcomingDayTotal,
  type UpcomingVisibleRange,
} from "../../helpers/upcoming-calendar";
import { getOffsetDate } from "../../helpers/date-helpers";

type UpcomingCalendarMode = "week" | "month";

type UpcomingCalendarViewProps = {
  mode: UpcomingCalendarMode;
  todayDate: string;
  events: UpcomingCalendarEvent[];
  totalsByDay: Map<string, UpcomingDayTotal>;
  visibleRange: UpcomingVisibleRange;
  selectedDate: string | null;
  onVisibleRangeChange: (range: UpcomingVisibleRange) => void;
  onDateOpen: (date: string) => void;
  onDaySelect: (date: string) => void;
  onTaskOpen: (task: TaskItem) => void;
};

const getEventTask = (arg: EventContentArg | EventClickArg) =>
  (arg.event.extendedProps as UpcomingCalendarEventProps).task;

export function UpcomingCalendarView({
  mode,
  todayDate,
  events,
  totalsByDay,
  visibleRange,
  selectedDate,
  onVisibleRangeChange,
  onDateOpen,
  onDaySelect,
  onTaskOpen,
}: UpcomingCalendarViewProps) {
  const calendarRef = useRef<FullCalendar | null>(null);
  const tomorrowDate = getOffsetDate(todayDate, 1);
  const initialRange = useMemo(
    () => getInitialUpcomingVisibleRange(mode, todayDate),
    [mode, todayDate],
  );
  const initialDate = initialRange.from;
  const canGoPrevious = visibleRange.from > tomorrowDate;
  const calendarEyebrow = mode === "week" ? "Upcoming week" : "Month view";
  const [displayTitle, setDisplayTitle] = useState(calendarEyebrow);
  const displayTitleRef = useRef(displayTitle);

  const getCalendarApi = useCallback((): CalendarApi | null =>
    calendarRef.current?.getApi() ?? null, []);

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    if (displayTitleRef.current !== arg.view.title) {
      displayTitleRef.current = arg.view.title;
      setDisplayTitle(arg.view.title);
    }

    onVisibleRangeChange(normalizeCalendarVisibleRange(arg.start, arg.end, todayDate));
  }, [onVisibleRangeChange, todayDate]);

  const handleDateClick = useCallback((date: Date) => {
    const dateKey = toCalendarDateKey(date);
    if (dateKey <= todayDate) {
      return;
    }

    if (mode === "month") {
      onDaySelect(dateKey);
      return;
    }

    onDateOpen(dateKey);
  }, [mode, onDateOpen, onDaySelect, todayDate]);

  const handleEventClick = useCallback((arg: EventClickArg) => {
    arg.jsEvent.preventDefault();
    const task = getEventTask(arg);
    if (task.scheduledForDate) {
      onDaySelect(task.scheduledForDate);
    }
    if (mode === "month") {
      return;
    }
    onTaskOpen(task);
  }, [mode, onDaySelect, onTaskOpen]);

  const renderDayCell = useCallback((arg: DayCellContentArg) => {
    const dateKey = toCalendarDateKey(arg.date);
    const day = totalsByDay.get(dateKey);
    const estimatedLabel = formatEstimatedMinutes(day?.estimatedMinutes ?? null);
    const isPast = dateKey <= todayDate;

    return (
      <span className="planner-upcoming-calendar__day-content">
        <span className="planner-upcoming-calendar__day-number">{arg.dayNumberText}</span>
        {day && !isPast ? (
          <span
            className="planner-upcoming-calendar__day-total"
            aria-label={`${day.taskCount} scheduled item${day.taskCount === 1 ? "" : "s"}${estimatedLabel ? `, ${estimatedLabel}` : ""}`}
          >
            <span aria-hidden="true">{day.taskCount}</span>
            {estimatedLabel ? <span aria-hidden="true">{estimatedLabel}</span> : null}
          </span>
        ) : null}
      </span>
    );
  }, [todayDate, totalsByDay]);

  const renderDayHeader = useCallback((arg: DayHeaderContentArg) => {
    if (mode === "month") {
      return <span className="planner-upcoming-calendar__weekday">{arg.text}</span>;
    }

    const dateKey = toCalendarDateKey(arg.date);
    return (
      <span className="planner-upcoming-calendar__week-header">
        <span>{arg.date.toLocaleDateString(undefined, { weekday: "short" })}</span>
        <strong>{getRelativeUpcomingLabel(dateKey, todayDate)}</strong>
      </span>
    );
  }, [mode, todayDate]);

  const getDayCellClassNames = useCallback((arg: DayCellContentArg) => {
    const dateKey = toCalendarDateKey(arg.date);
    const classes = ["planner-upcoming-calendar__day"];

    if (dateKey <= todayDate) {
      classes.push("planner-upcoming-calendar__day--muted");
    }

    if (dateKey === selectedDate) {
      classes.push("planner-upcoming-calendar__day--selected");
    }

    if (totalsByDay.has(dateKey)) {
      classes.push("planner-upcoming-calendar__day--has-tasks");
    }

    return classes;
  }, [selectedDate, todayDate, totalsByDay]);

  const renderEvent = useCallback((arg: EventContentArg) => {
    const task = getEventTask(arg);
    const estimatedLabel = formatEstimatedMinutes(
      (arg.event.extendedProps as UpcomingCalendarEventProps).estimatedMinutes,
    );
    const title = getUpcomingTaskTitle(task);

    if (mode === "month") {
      return (
        <span
          className={`planner-upcoming-calendar__month-event planner-upcoming-calendar__event-kind--${task.kind}`}
          aria-label={`${title} on ${task.scheduledForDate}`}
        >
          <span className="planner-upcoming-calendar__month-dot" aria-hidden="true" />
          <span className="planner-upcoming-calendar__sr">{title}</span>
        </span>
      );
    }

    return (
      <span
        className={`planner-upcoming-calendar__event planner-upcoming-calendar__event-kind--${task.kind}`}
        aria-label={`${getTaskKindLabel(task.kind)}: ${title}${estimatedLabel ? `, ${estimatedLabel}` : ""}`}
      >
        <span className="planner-upcoming-calendar__event-kind" aria-hidden="true" />
        <span className="planner-upcoming-calendar__event-title">{title}</span>
        {estimatedLabel ? (
          <span className="planner-upcoming-calendar__event-meta">{estimatedLabel}</span>
        ) : null}
      </span>
    );
  }, [mode]);

  const handleMoreLinkClick = useCallback((arg: MoreLinkArg) => {
    const dateKey = toCalendarDateKey(arg.date);
    onDaySelect(dateKey);
    return mode === "month" ? undefined : "popover";
  }, [mode, onDaySelect]);

  return (
    <div className={`planner-upcoming-calendar planner-upcoming-calendar--${mode}`}>
      <div className="planner-upcoming-calendar__nav" aria-label={displayTitle}>
        <div className="planner-upcoming-calendar__nav-copy">
          <span>{calendarEyebrow}</span>
          <strong className="planner-upcoming-calendar__title">{displayTitle}</strong>
          <small>{visibleRange.from} / {visibleRange.to}</small>
        </div>
        <div className="planner-upcoming-calendar__nav-actions">
          <button
            className="planner-upcoming-calendar__nav-btn"
            type="button"
            disabled={!canGoPrevious}
            aria-label={`Previous ${mode}`}
            onClick={() => getCalendarApi()?.prev()}
          >
            &lt;
          </button>
          <button
            className="planner-upcoming-calendar__nav-btn planner-upcoming-calendar__nav-btn--wide"
            type="button"
            onClick={() => getCalendarApi()?.gotoDate(tomorrowDate)}
          >
            Current
          </button>
          <button
            className="planner-upcoming-calendar__nav-btn"
            type="button"
            aria-label={`Next ${mode}`}
            onClick={() => getCalendarApi()?.next()}
          >
            &gt;
          </button>
        </div>
      </div>

      <FullCalendar
        key={mode}
        ref={calendarRef}
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView={mode === "week" ? "dayGridWeek" : "dayGridMonth"}
        initialDate={initialDate}
        events={events}
        firstDay={1}
        headerToolbar={false}
        height="auto"
        contentHeight="auto"
        fixedWeekCount={mode === "month"}
        showNonCurrentDates
        dayMaxEvents={mode === "week" ? 3 : 2}
        moreLinkClick={handleMoreLinkClick}
        moreLinkText={(count) => `+${count}`}
        navLinks
        navLinkDayClick={(date) => handleDateClick(date)}
        datesSet={handleDatesSet}
        dateClick={(arg) => handleDateClick(arg.date)}
        eventClick={handleEventClick}
        eventContent={renderEvent}
        dayCellContent={renderDayCell}
        dayCellClassNames={getDayCellClassNames}
        dayHeaderContent={renderDayHeader}
        displayEventTime={false}
        eventDisplay="block"
        eventInteractive
        moreLinkHint={(count) => `${count} more scheduled item${count === 1 ? "" : "s"}`}
        noEventsText=""
        titleFormat={mode === "month"
          ? { month: "long", year: "numeric" }
          : { month: "short", day: "numeric", year: "numeric" }}
        views={{
          dayGridWeek: {
            dayHeaderFormat: { weekday: "short", month: "short", day: "numeric" },
          },
        }}
      />
    </div>
  );
}
