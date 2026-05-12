import { describe, expect, it } from "vitest";
import type { FocusSessionItem } from "@life-os/contracts";

import { buildBehaviorState } from "../../../src/modules/behavior/behavior-state-service.js";
import { assessDayCapacity } from "../../../src/modules/planning/day-capacity.js";
import {
  makeBlock,
  makeContext,
  makeLaunch,
  makeTask,
} from "../planning/adaptive-today-test-fixtures.js";

describe("buildBehaviorState", () => {
  it("treats an active focus session as clear and keeps the focus action", () => {
    const task = makeTask({ id: "task-1", title: "Draft memo" });
    const context = makeContext({ tasks: [task] });
    const capacity = assessDayCapacity({ tasks: [task], plannerBlocks: [] });
    const behaviorState = buildBehaviorState({
      context,
      capacity,
      activeFocusSession: makeFocusSession(task),
      now: new Date("2026-05-03T09:00:00.000Z"),
      isLiveDate: true,
    });

    expect(behaviorState.state).toBe("clear");
    expect(behaviorState.nextMove.primaryAction.type).toBe("open_focus");
  });

  it("puts low energy ahead of normal must-win work", () => {
    const task = makeTask({ id: "task-1", title: "Write memo" });
    const context = makeContext({
      tasks: [task],
      mustWinTask: task,
      launch: makeLaunch({ energyRating: 2, mustWinTaskId: task.id }),
    });
    const capacity = assessDayCapacity({
      tasks: [task],
      plannerBlocks: [],
      launch: context.launch,
      mustWinTask: task,
    });
    const behaviorState = buildBehaviorState({
      context,
      capacity,
      now: new Date("2026-05-03T09:00:00.000Z"),
      isLiveDate: true,
    });

    expect(behaviorState.state).toBe("low_energy");
    expect(behaviorState.nextMove.primaryAction.type).toBe("reduce_day");
  });

  it("recommends drift recovery for slipped planned work", () => {
    const task = makeTask({ id: "task-1", title: "Past task" });
    const block = makeBlock({
      startsAt: "2026-05-03T09:00:00.000Z",
      endsAt: "2026-05-03T10:00:00.000Z",
      tasks: [task],
    });
    const context = makeContext({ tasks: [task], plannerBlocks: [block] });
    const capacity = assessDayCapacity({
      tasks: [task],
      plannerBlocks: [block],
      now: new Date("2026-05-03T11:00:00.000Z"),
      isLiveDate: true,
    });
    const behaviorState = buildBehaviorState({
      context,
      capacity,
      now: new Date("2026-05-03T11:00:00.000Z"),
      isLiveDate: true,
    });

    expect(behaviorState.state).toBe("drifting");
    expect(behaviorState.nextMove.primaryAction.type).toBe("recover_drift");
  });

  it("reduces an overloaded day", () => {
    const tasks = Array.from({ length: 8 }, (_, index) =>
      makeTask({ id: `task-${index + 1}`, title: `Task ${index + 1}` }),
    );
    const context = makeContext({ tasks });
    const capacity = assessDayCapacity({ tasks, plannerBlocks: [] });
    const behaviorState = buildBehaviorState({
      context,
      capacity,
      now: new Date("2026-05-03T09:00:00.000Z"),
      isLiveDate: true,
    });

    expect(behaviorState.state).toBe("overloaded");
    expect(behaviorState.nextMove.primaryAction.type).toBe("reduce_day");
  });

  it("clarifies an unclear must-win", () => {
    const task = makeTask({ id: "task-1", title: "Vague task", nextAction: null });
    const context = makeContext({
      tasks: [task],
      mustWinTask: task,
      launch: makeLaunch({ mustWinTaskId: task.id }),
    });
    const capacity = assessDayCapacity({
      tasks: [task],
      plannerBlocks: [],
      launch: context.launch,
      mustWinTask: task,
    });
    const behaviorState = buildBehaviorState({
      context,
      capacity,
      now: new Date("2026-05-03T09:00:00.000Z"),
      isLiveDate: true,
    });

    expect(behaviorState.state).toBe("stuck");
    expect(behaviorState.nextMove.primaryAction.type).toBe("clarify_task");
  });

  it("uses maintenance when the day is clear late enough to review", () => {
    const context = makeContext({ tasks: [] });
    const capacity = assessDayCapacity({ tasks: [], plannerBlocks: [] });
    const behaviorState = buildBehaviorState({
      context,
      capacity,
      now: new Date("2026-05-03T17:00:00.000Z"),
      isLiveDate: true,
    });

    expect(behaviorState.state).toBe("maintenance");
    expect(behaviorState.nextMove.primaryAction.type).toBe("open_review");
  });
});

function makeFocusSession(task: ReturnType<typeof makeTask>): FocusSessionItem {
  return {
    id: "focus-1",
    taskId: task.id,
    task: {
      id: task.id,
      title: task.title,
      nextAction: task.nextAction,
      status: task.status,
      progressState: task.progressState,
      goalId: task.goalId,
      goal: task.goal,
      focusLengthMinutes: task.focusLengthMinutes,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
    },
    depth: "deep",
    plannedMinutes: 25,
    actualMinutes: 0,
    startedAt: "2026-05-03T09:00:00.000Z",
    endedAt: null,
    status: "active",
    exitReason: null,
    distractionNotes: null,
    completionNote: null,
    createdAt: "2026-05-03T09:00:00.000Z",
    updatedAt: "2026-05-03T09:00:00.000Z",
  };
}
