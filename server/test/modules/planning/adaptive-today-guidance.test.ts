import { describe, expect, it } from "vitest";
import type { FocusSessionItem } from "@life-os/contracts";

import { buildAdaptiveNextMove } from "../../../src/modules/planning/adaptive-today-guidance.js";
import { assessDayCapacity } from "../../../src/modules/planning/day-capacity.js";
import {
  makeBlock,
  makeContext,
  makeLaunch,
  makeTask,
} from "./adaptive-today-test-fixtures.js";

describe("buildAdaptiveNextMove", () => {
  it("lets an active focus session win", () => {
    const task = makeTask({ id: "task-1", title: "Draft memo" });
    const context = makeContext({ tasks: [task] });
    const capacity = assessDayCapacity({ tasks: [task], plannerBlocks: [] });
    const activeFocusSession = makeFocusSession(task);

    const move = buildAdaptiveNextMove({
      context,
      capacity,
      activeFocusSession,
      now: new Date("2026-05-03T09:00:00.000Z"),
    });

    expect(move.state).toBe("continue_focus");
    expect(move.primaryAction.type).toBe("open_focus");
    expect(move.taskId).toBe("task-1");
  });

  it("prioritizes rescue mode before normal work", () => {
    const task = makeTask({ id: "task-1", title: "Protected task" });
    const context = makeContext({
      tasks: [task],
      mustWinTask: task,
      launch: makeLaunch({ dayMode: "rescue", mustWinTaskId: task.id }),
    });
    const capacity = assessDayCapacity({
      tasks: [task],
      plannerBlocks: [],
      launch: context.launch,
      mustWinTask: task,
    });

    const move = buildAdaptiveNextMove({
      context,
      capacity,
      now: new Date("2026-05-03T09:00:00.000Z"),
    });

    expect(move.state).toBe("reduce_day");
    expect(move.primaryAction.type).toBe("reduce_day");
  });

  it("recommends drift recovery when planned work has slipped", () => {
    const task = makeTask({ id: "task-1", title: "Past task" });
    const block = makeBlock({
      id: "block-1",
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

    const move = buildAdaptiveNextMove({
      context,
      capacity,
      now: new Date("2026-05-03T11:00:00.000Z"),
    });

    expect(move.state).toBe("recover_drift");
    expect(move.primaryAction.type).toBe("recover_drift");
  });

  it("starts an actionable must-win and clarifies a vague one", () => {
    const ready = makeTask({ id: "ready", title: "Ready must-win", nextAction: "Open draft" });
    const vague = makeTask({ id: "vague", title: "Vague must-win", nextAction: null });

    const readyContext = makeContext({
      tasks: [ready],
      mustWinTask: ready,
      launch: makeLaunch({ mustWinTaskId: ready.id }),
    });
    const vagueContext = makeContext({
      tasks: [vague],
      mustWinTask: vague,
      launch: makeLaunch({ mustWinTaskId: vague.id }),
    });

    expect(buildAdaptiveNextMove({
      context: readyContext,
      capacity: assessDayCapacity({ tasks: [ready], plannerBlocks: [], mustWinTask: ready }),
    }).state).toBe("start_must_win");
    expect(buildAdaptiveNextMove({
      context: vagueContext,
      capacity: assessDayCapacity({ tasks: [vague], plannerBlocks: [], mustWinTask: vague }),
    }).state).toBe("clarify_must_win");
  });

  it("asks for task sizing before shaping an unclear day", () => {
    const tasks = [
      makeTask({ id: "task-1", estimatedDurationMinutes: null, focusLengthMinutes: null }),
      makeTask({ id: "task-2", estimatedDurationMinutes: null, focusLengthMinutes: null }),
      makeTask({ id: "task-3", estimatedDurationMinutes: null, focusLengthMinutes: null }),
    ];
    const context = makeContext({ tasks });
    const capacity = assessDayCapacity({ tasks, plannerBlocks: [] });

    const move = buildAdaptiveNextMove({
      context,
      capacity,
      now: new Date("2026-05-03T09:00:00.000Z"),
    });

    expect(move.state).toBe("size_tasks");
  });

  it("falls back to add task for an empty day", () => {
    const context = makeContext({ tasks: [] });
    const capacity = assessDayCapacity({ tasks: [], plannerBlocks: [] });

    const move = buildAdaptiveNextMove({
      context,
      capacity,
      now: new Date("2026-05-03T09:00:00.000Z"),
    });

    expect(move.state).toBe("empty");
    expect(move.primaryAction.type).toBe("add_task");
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
