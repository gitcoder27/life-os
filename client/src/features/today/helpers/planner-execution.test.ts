import { describe, expect, it } from "vitest";

import type {
  DayPlannerBlockItem,
  DayPlannerBlockTaskItem,
  TaskItem,
} from "../../../shared/lib/api";
import {
  buildPlannerExecutionModel,
  sortPlannerBlocksByTime,
} from "./planner-execution";

const makePlannerTask = (
  taskId: string,
  status: TaskItem["status"],
  sortOrder: number,
): DayPlannerBlockTaskItem => ({
  id: `link-${taskId}`,
  taskId,
  sortOrder,
  task: {
    id: taskId,
    title: taskId,
    status,
  },
} as unknown as DayPlannerBlockTaskItem);

const makeBlock = (overrides: Partial<DayPlannerBlockItem>): DayPlannerBlockItem => ({
  id: "block-1",
  title: "Focus",
  startsAt: "2026-05-03T09:00:00",
  endsAt: "2026-05-03T10:00:00",
  sortOrder: 1,
  tasks: [],
  ...overrides,
} as DayPlannerBlockItem);

describe("planner execution model", () => {
  it("orders blocks by time and sort order", () => {
    expect(sortPlannerBlocksByTime([
      makeBlock({ id: "b", startsAt: "2026-05-03T10:00:00", sortOrder: 2 }),
      makeBlock({ id: "a", startsAt: "2026-05-03T09:00:00", sortOrder: 2 }),
      makeBlock({ id: "c", startsAt: "2026-05-03T09:00:00", sortOrder: 1 }),
    ]).map((block) => block.id)).toEqual(["c", "a", "b"]);
  });

  it("classifies current, slipped, and upcoming blocks for a live day", () => {
    const model = buildPlannerExecutionModel({
      now: new Date("2026-05-03T10:45:00"),
      isLiveDate: true,
      unplannedTasks: [{ id: "unplanned" } as TaskItem],
      blocks: [
        makeBlock({
          id: "past",
          startsAt: "2026-05-03T09:00:00",
          endsAt: "2026-05-03T10:00:00",
          tasks: [makePlannerTask("late-task", "pending", 1)],
        }),
        makeBlock({
          id: "current",
          startsAt: "2026-05-03T10:00:00",
          endsAt: "2026-05-03T11:00:00",
          tasks: [
            makePlannerTask("done-task", "completed", 2),
            makePlannerTask("current-task", "pending", 1),
          ],
        }),
        makeBlock({
          id: "next",
          startsAt: "2026-05-03T12:00:00",
          endsAt: "2026-05-03T13:00:00",
          tasks: [makePlannerTask("next-task", "pending", 1)],
        }),
      ],
    });

    expect(model.currentBlock?.block.id).toBe("current");
    expect(model.currentBlock?.health).toBe("at_risk");
    expect(model.currentBlock?.pendingTasks.map((task) => task.taskId)).toEqual(["current-task"]);
    expect(model.currentBlock?.completedTasks.map((task) => task.taskId)).toEqual(["done-task"]);
    expect(model.nextBlock?.block.id).toBe("next");
    expect(model.slippedBlocks.map((block) => block.block.id)).toEqual(["past"]);
    expect(model.focusState).toBe("current");
    expect(model.dayHealth).toBe("off_track");
    expect(model.cleanup).toMatchObject({
      state: "replan_now",
      taskIds: ["late-task"],
      blockCount: 1,
      taskCount: 1,
    });
  });

  it("uses neutral timing for non-live dates and detects completed plans", () => {
    const model = buildPlannerExecutionModel({
      now: new Date("2026-05-03T10:45:00"),
      isLiveDate: false,
      unplannedTasks: [],
      blocks: [
        makeBlock({
          tasks: [makePlannerTask("done-task", "completed", 1)],
        }),
      ],
    });

    expect(model.orderedBlocks[0]?.timelineStatus).toBe("neutral");
    expect(model.orderedBlocks[0]?.health).toBe("complete");
    expect(model.focusState).toBe("plan_complete");
    expect(model.dayHealth).toBe("aligned");
    expect(model.cleanup.state).toBe("none");
  });
});
