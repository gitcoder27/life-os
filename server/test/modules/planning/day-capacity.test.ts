import { describe, expect, it } from "vitest";

import { assessDayCapacity } from "../../../src/modules/planning/day-capacity.js";
import {
  makeBlock,
  makeLaunch,
  makeTask,
} from "./adaptive-today-test-fixtures.js";

describe("assessDayCapacity", () => {
  it("marks the day as drifting when past blocks still have pending work", () => {
    const task = makeTask({ id: "task-1", title: "Past work" });
    const block = makeBlock({
      id: "block-1",
      startsAt: "2026-05-03T09:00:00.000Z",
      endsAt: "2026-05-03T10:00:00.000Z",
      tasks: [task],
    });

    const capacity = assessDayCapacity({
      tasks: [task],
      plannerBlocks: [block],
      now: new Date("2026-05-03T11:00:00.000Z"),
      isLiveDate: true,
    });

    expect(capacity.status).toBe("drifting");
    expect(capacity.slippedTaskCount).toBe(1);
    expect(capacity.signals).toContain("slipped_work");
  });

  it("surfaces unclear capacity when too much work lacks estimates", () => {
    const tasks = [
      makeTask({ id: "task-1", estimatedDurationMinutes: null, focusLengthMinutes: null }),
      makeTask({ id: "task-2", estimatedDurationMinutes: null, focusLengthMinutes: null }),
      makeTask({ id: "task-3", estimatedDurationMinutes: null, focusLengthMinutes: null }),
    ];

    const capacity = assessDayCapacity({
      tasks,
      plannerBlocks: [],
      now: new Date("2026-05-03T08:00:00.000Z"),
      isLiveDate: true,
    });

    expect(capacity.status).toBe("unclear");
    expect(capacity.needsEstimateTaskIds).toEqual(["task-1", "task-2", "task-3"]);
    expect(capacity.signals).toContain("unsized_tasks");
  });

  it("marks overload when estimated task minutes exceed planned minutes", () => {
    const tasks = [
      makeTask({ id: "task-1", estimatedDurationMinutes: 90 }),
      makeTask({ id: "task-2", estimatedDurationMinutes: 45 }),
    ];
    const block = makeBlock({
      startsAt: "2026-05-03T09:00:00.000Z",
      endsAt: "2026-05-03T10:00:00.000Z",
      tasks,
    });

    const capacity = assessDayCapacity({
      tasks,
      plannerBlocks: [block],
      launch: makeLaunch(),
      now: new Date("2026-05-03T08:00:00.000Z"),
      isLiveDate: true,
    });

    expect(capacity.status).toBe("overloaded");
    expect(capacity.overByMinutes).toBe(75);
    expect(capacity.blocks[0]?.status).toBe("overloaded");
  });
});
