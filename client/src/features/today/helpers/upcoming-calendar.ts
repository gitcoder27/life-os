import type { EventInput } from "@fullcalendar/core";

import {
  formatLongDate,
  formatMonthLabel,
  formatShortDate,
  getMonthEndDate,
  getMonthStartDate,
  getWeekEndDate,
  getWeekStartDate,
  toIsoDate,
  type TaskItem,
} from "../../../shared/lib/api";
import { getQuickCaptureDisplayText } from "../../../shared/lib/quickCapture";
import { getOffsetDate } from "./date-helpers";

export type UpcomingView = "agenda" | "week" | "month";

export type UpcomingVisibleRange = {
  from: string;
  to: string;
};

export type UpcomingTaskGroup = {
  date: string;
  tasks: TaskItem[];
  totalEstimatedMinutes: number;
};

export type UpcomingDayTotal = {
  date: string;
  tasks: TaskItem[];
  taskCount: number;
  estimatedMinutes: number;
};

export type UpcomingCalendarEventProps = {
  task: TaskItem;
  kind: TaskItem["kind"];
  goalTitle: string | null;
  estimatedMinutes: number | null;
  isRecurring: boolean;
};

export type UpcomingCalendarEvent = EventInput & {
  id: string;
  title: string;
  start: string;
  allDay: true;
  extendedProps: UpcomingCalendarEventProps;
};

const LOOKAHEAD_DAYS = 30;
const DAY_MS = 86_400_000;

export const upcomingViews: UpcomingView[] = ["agenda", "week", "month"];

export const isUpcomingView = (value: string | null): value is UpcomingView =>
  value === "agenda" || value === "week" || value === "month";

export const getUpcomingTaskTitle = (task: TaskItem) =>
  getQuickCaptureDisplayText(task, task.title);

export const getTaskKindLabel = (kind: TaskItem["kind"]) => {
  switch (kind) {
    case "note":
      return "Note";
    case "reminder":
      return "Reminder";
    default:
      return "Task";
  }
};

export const getTaskEstimatedMinutes = (task: TaskItem) =>
  task.estimatedDurationMinutes ?? task.focusLengthMinutes ?? null;

export const formatEstimatedMinutes = (minutes: number | null) => {
  if (!minutes) {
    return null;
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
};

export const toCalendarDateKey = (date: Date) => toIsoDate(date);

export const getDateBefore = (date: Date) => {
  const previous = new Date(date);
  previous.setDate(previous.getDate() - 1);
  return toCalendarDateKey(previous);
};

const maxDate = (left: string, right: string) => left > right ? left : right;

const sortUpcomingTasks = (tasks: TaskItem[]) =>
  [...tasks].sort((left, right) => {
    const leftDate = left.scheduledForDate ?? "";
    const rightDate = right.scheduledForDate ?? "";
    const dateDiff = leftDate.localeCompare(rightDate);

    if (dateDiff !== 0) {
      return dateDiff;
    }

    const sortOrderDiff = left.todaySortOrder - right.todaySortOrder;
    if (sortOrderDiff !== 0) {
      return sortOrderDiff;
    }

    return left.createdAt.localeCompare(right.createdAt);
  });

export const filterScheduledPendingTasks = (tasks: TaskItem[], todayDate: string) =>
  sortUpcomingTasks(
    tasks.filter(
      (task) =>
        task.status === "pending" &&
        Boolean(task.scheduledForDate) &&
        (task.scheduledForDate ?? "") > todayDate,
    ),
  );

export const groupUpcomingTasks = (tasks: TaskItem[]) => {
  const groupsByDate = new Map<string, TaskItem[]>();

  for (const task of sortUpcomingTasks(tasks)) {
    if (!task.scheduledForDate) {
      continue;
    }

    groupsByDate.set(task.scheduledForDate, [
      ...(groupsByDate.get(task.scheduledForDate) ?? []),
      task,
    ]);
  }

  return [...groupsByDate.entries()].map(([date, groupTasks]) => ({
    date,
    tasks: groupTasks,
    totalEstimatedMinutes: sumEstimatedMinutes(groupTasks),
  }));
};

export const buildUpcomingDayTotals = (tasks: TaskItem[]) => {
  const totalsByDay = new Map<string, UpcomingDayTotal>();

  for (const task of sortUpcomingTasks(tasks)) {
    if (!task.scheduledForDate) {
      continue;
    }

    const existing = totalsByDay.get(task.scheduledForDate) ?? {
      date: task.scheduledForDate,
      tasks: [],
      taskCount: 0,
      estimatedMinutes: 0,
    };

    existing.tasks.push(task);
    existing.taskCount += 1;
    existing.estimatedMinutes += getTaskEstimatedMinutes(task) ?? 0;
    totalsByDay.set(task.scheduledForDate, existing);
  }

  return totalsByDay;
};

export const mapTasksToCalendarEvents = (tasks: TaskItem[]): UpcomingCalendarEvent[] =>
  sortUpcomingTasks(tasks)
    .filter((task) => task.scheduledForDate && task.status === "pending")
    .map((task) => ({
      id: task.id,
      title: getUpcomingTaskTitle(task),
      start: task.scheduledForDate as string,
      allDay: true,
      extendedProps: {
        task,
        kind: task.kind,
        goalTitle: task.goal?.title ?? null,
        estimatedMinutes: getTaskEstimatedMinutes(task),
        isRecurring: Boolean(task.recurrence),
      },
    }));

export const sumEstimatedMinutes = (tasks: TaskItem[]) =>
  tasks.reduce((total, task) => total + (getTaskEstimatedMinutes(task) ?? 0), 0);

export const getRelativeUpcomingLabel = (date: string, todayDate: string) => {
  if (date === todayDate) {
    return "Today";
  }

  if (date === getOffsetDate(todayDate, 1)) {
    return "Tomorrow";
  }

  const daysAhead = Math.round(
    (new Date(`${date}T12:00:00`).getTime() - new Date(`${todayDate}T12:00:00`).getTime()) /
      DAY_MS,
  );

  if (daysAhead > 1 && daysAhead < 7) {
    return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
      weekday: "long",
    });
  }

  return formatShortDate(date);
};

export const getInitialUpcomingVisibleRange = (
  view: UpcomingView,
  todayDate: string,
): UpcomingVisibleRange => {
  const tomorrow = getOffsetDate(todayDate, 1);

  if (view === "agenda") {
    return {
      from: tomorrow,
      to: getOffsetDate(todayDate, LOOKAHEAD_DAYS),
    };
  }

  if (view === "month") {
    return {
      from: maxDate(tomorrow, getMonthStartDate(tomorrow)),
      to: getMonthEndDate(tomorrow),
    };
  }

  return {
    from: maxDate(tomorrow, getWeekStartDate(tomorrow)),
    to: getWeekEndDate(tomorrow),
  };
};

export const normalizeCalendarVisibleRange = (
  start: Date,
  exclusiveEnd: Date,
  todayDate: string,
): UpcomingVisibleRange => {
  const tomorrow = getOffsetDate(todayDate, 1);
  const from = maxDate(tomorrow, toCalendarDateKey(start));
  const inclusiveEnd = getDateBefore(exclusiveEnd);

  return {
    from,
    to: inclusiveEnd >= from ? inclusiveEnd : from,
  };
};

export const getUpcomingRangeLabel = (
  view: UpcomingView,
  range: UpcomingVisibleRange,
) => {
  if (view === "month") {
    const startTime = new Date(`${range.from}T12:00:00`).getTime();
    const endTime = new Date(`${range.to}T12:00:00`).getTime();
    const midpointDate = new Date(startTime + ((endTime - startTime) / 2));
    return formatMonthLabel(toIsoDate(midpointDate).slice(0, 7));
  }

  return `${formatShortDate(range.from)} to ${formatShortDate(range.to)}`;
};

export const getUpcomingDayLabel = (date: string) => formatLongDate(date);
