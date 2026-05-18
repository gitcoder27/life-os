import { describe, expect, it } from "vitest";

import type { TaskItem } from "../../../shared/lib/api";
import {
  buildUpcomingDayTotals,
  filterScheduledPendingTasks,
  formatEstimatedMinutes,
  getInitialUpcomingVisibleRange,
  getRelativeUpcomingLabel,
  getTaskEstimatedMinutes,
  getTaskKindLabel,
  getUpcomingRangeLabel,
  getUpcomingTaskTitle,
  groupUpcomingTasks,
  isUpcomingView,
  mapTasksToCalendarEvents,
  normalizeCalendarVisibleRange,
} from "./upcoming-calendar";

const makeTask = (overrides: Partial<TaskItem>): TaskItem => ({
  id: "task-1",
  title: "Task",
  notes: null,
  kind: "task",
  status: "pending",
  scheduledForDate: "2026-05-04",
  todaySortOrder: 1,
  createdAt: "2026-05-01T00:00:00.000Z",
  estimatedDurationMinutes: null,
  focusLengthMinutes: null,
  goal: null,
  recurrence: null,
  reminderAt: null,
  originType: "manual",
  ...overrides,
} as TaskItem);

describe("upcoming calendar helpers", () => {
  it("filters and groups future pending tasks in stable order", () => {
    const tasks = [
      makeTask({ id: "later", scheduledForDate: "2026-05-05", todaySortOrder: 2, estimatedDurationMinutes: 30 }),
      makeTask({ id: "done", status: "completed", scheduledForDate: "2026-05-04" }),
      makeTask({ id: "today", scheduledForDate: "2026-05-03" }),
      makeTask({ id: "first", scheduledForDate: "2026-05-04", todaySortOrder: 1, focusLengthMinutes: 45 }),
    ];

    expect(filterScheduledPendingTasks(tasks, "2026-05-03").map((task) => task.id)).toEqual(["first", "later"]);
    expect(groupUpcomingTasks(filterScheduledPendingTasks(tasks, "2026-05-03"))).toEqual([
      {
        date: "2026-05-04",
        tasks: [tasks[3]],
        totalEstimatedMinutes: 45,
      },
      {
        date: "2026-05-05",
        tasks: [tasks[0]],
        totalEstimatedMinutes: 30,
      },
    ]);
  });

  it("maps tasks to calendar events with quick-capture titles and extended props", () => {
    const task = makeTask({
      id: "reminder-1",
      kind: "reminder",
      title: "Fallback title",
      notes: "Call bank",
      reminderAt: "2026-05-04T09:00:00.000Z",
      goal: { id: "goal-1", title: "Money" } as TaskItem["goal"],
      recurrence: { rule: { frequency: "daily", startsOn: "2026-05-04" } } as TaskItem["recurrence"],
      estimatedDurationMinutes: 20,
    });

    expect(getUpcomingTaskTitle(task)).toContain("Call bank");
    expect(getTaskKindLabel("note")).toBe("Note");
    expect(getTaskEstimatedMinutes(makeTask({ estimatedDurationMinutes: null, focusLengthMinutes: 25 }))).toBe(25);
    expect(formatEstimatedMinutes(90)).toBe("1h 30m");
    expect(mapTasksToCalendarEvents([task])).toMatchObject([
      {
        id: "reminder-1",
        title: expect.stringContaining("Call bank"),
        start: "2026-05-04",
        allDay: true,
        extendedProps: {
          kind: "reminder",
          goalTitle: "Money",
          estimatedMinutes: 20,
          isRecurring: true,
        },
      },
    ]);
  });

  it("builds visible ranges and labels for agenda, week, and month views", () => {
    expect(isUpcomingView("agenda")).toBe(true);
    expect(isUpcomingView("board")).toBe(false);
    expect(getInitialUpcomingVisibleRange("agenda", "2026-05-03")).toEqual({
      from: "2026-05-04",
      to: "2026-06-02",
    });
    expect(getInitialUpcomingVisibleRange("week", "2026-05-03")).toEqual({
      from: "2026-05-04",
      to: "2026-05-10",
    });
    expect(getInitialUpcomingVisibleRange("month", "2026-05-30")).toEqual({
      from: "2026-05-31",
      to: "2026-05-31",
    });
    expect(normalizeCalendarVisibleRange(
      new Date("2026-05-01T00:00:00"),
      new Date("2026-05-04T00:00:00"),
      "2026-05-03",
    )).toEqual({
      from: "2026-05-04",
      to: "2026-05-04",
    });
    expect(getRelativeUpcomingLabel("2026-05-04", "2026-05-03")).toBe("Tomorrow");
    expect(getRelativeUpcomingLabel("2026-05-06", "2026-05-03")).toBe("Wednesday");
    expect(getUpcomingRangeLabel("month", { from: "2026-05-04", to: "2026-05-31" })).toBe("May 2026");
  });

  it("builds day totals by scheduled date", () => {
    const totals = buildUpcomingDayTotals([
      makeTask({ id: "a", scheduledForDate: "2026-05-04", estimatedDurationMinutes: 15 }),
      makeTask({ id: "b", scheduledForDate: "2026-05-04", focusLengthMinutes: 25 }),
      makeTask({ id: "c", scheduledForDate: null }),
    ]);

    expect(totals.get("2026-05-04")).toMatchObject({
      date: "2026-05-04",
      taskCount: 2,
      estimatedMinutes: 40,
    });
    expect(totals.has("")).toBe(false);
  });
});
