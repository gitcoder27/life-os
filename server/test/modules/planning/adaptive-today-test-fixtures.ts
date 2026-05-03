import type {
  DailyLaunchItem,
  DayPlannerBlockItem,
  IsoDateString,
  PlanningPriorityItem,
  PlanningTaskItem,
} from "@life-os/contracts";

import type { AdaptiveTodayContext } from "../../../src/modules/planning/adaptive-today-context.js";

export const TEST_DATE = "2026-05-03" as IsoDateString;

export function makeTask(overrides: Partial<PlanningTaskItem> = {}): PlanningTaskItem {
  const id = overrides.id ?? `task-${Math.random().toString(16).slice(2)}`;

  return {
    id,
    title: "Task",
    notes: null,
    kind: "task",
    reminderAt: null,
    status: "pending",
    scheduledForDate: TEST_DATE,
    dueAt: null,
    goalId: null,
    goal: null,
    originType: "manual",
    carriedFromTaskId: null,
    recurrence: null,
    nextAction: "Open the file",
    fiveMinuteVersion: "Write one note",
    estimatedDurationMinutes: 25,
    likelyObstacle: null,
    focusLengthMinutes: 25,
    progressState: "not_started",
    todaySortOrder: 0,
    startedAt: null,
    lastStuckAt: null,
    completedAt: null,
    createdAt: "2026-05-03T08:00:00.000Z",
    updatedAt: "2026-05-03T08:00:00.000Z",
    ...overrides,
  };
}

export function makeBlock(
  overrides: Partial<DayPlannerBlockItem> & {
    tasks?: PlanningTaskItem[];
  } = {},
): DayPlannerBlockItem {
  const tasks = overrides.tasks ?? [];

  return {
    id: overrides.id ?? `block-${Math.random().toString(16).slice(2)}`,
    title: overrides.title ?? "Block",
    startsAt: overrides.startsAt ?? "2026-05-03T09:00:00.000Z",
    endsAt: overrides.endsAt ?? "2026-05-03T10:00:00.000Z",
    sortOrder: overrides.sortOrder ?? 1,
    tasks: tasks.map((task, index) => ({
      taskId: task.id,
      sortOrder: index + 1,
      task,
    })),
    createdAt: overrides.createdAt ?? "2026-05-03T08:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-05-03T08:00:00.000Z",
  };
}

export function makeLaunch(overrides: Partial<DailyLaunchItem> = {}): DailyLaunchItem {
  return {
    id: "launch-1",
    planningCycleId: "cycle-1",
    mustWinTaskId: null,
    dayMode: "normal",
    rescueReason: null,
    energyRating: 3,
    likelyDerailmentReason: null,
    likelyDerailmentNote: null,
    rescueSuggestedAt: null,
    rescueActivatedAt: null,
    rescueExitedAt: null,
    completedAt: "2026-05-03T08:10:00.000Z",
    createdAt: "2026-05-03T08:00:00.000Z",
    updatedAt: "2026-05-03T08:00:00.000Z",
    ...overrides,
  };
}

export function makePriority(overrides: Partial<PlanningPriorityItem> = {}): PlanningPriorityItem {
  return {
    id: "priority-1",
    slot: 1,
    title: "Priority",
    status: "pending",
    goalId: null,
    goal: null,
    completedAt: null,
    ...overrides,
  };
}

export function makeContext(overrides: Partial<AdaptiveTodayContext> = {}): AdaptiveTodayContext {
  const tasks = overrides.tasks ?? [];

  return {
    userId: "user-1",
    date: TEST_DATE,
    cycleId: "cycle-1",
    timezone: "UTC",
    launch: null,
    mustWinTask: null,
    priorities: [],
    tasks,
    plannerBlocks: [],
    ...overrides,
  };
}
