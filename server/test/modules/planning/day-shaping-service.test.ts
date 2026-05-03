import { describe, expect, it, vi } from "vitest";

import {
  applyShapeDayPlan,
  buildShapeDayPreview,
} from "../../../src/modules/planning/day-shaping-service.js";
import {
  makeBlock,
  makeContext,
  makeLaunch,
  makePriority,
  makeTask,
  TEST_DATE,
} from "./adaptive-today-test-fixtures.js";

describe("day shaping service", () => {
  it("preserves existing blocks and places the must-win first in open windows", () => {
    const mustWin = makeTask({ id: "must-win", title: "Draft proposal", estimatedDurationMinutes: 45 });
    const support = makeTask({ id: "support", title: "Send recap", estimatedDurationMinutes: 25 });
    const existing = makeBlock({
      id: "existing-block",
      title: "Standing meeting",
      startsAt: "2026-05-03T10:00:00.000Z",
      endsAt: "2026-05-03T11:00:00.000Z",
      tasks: [],
    });
    const context = makeContext({
      tasks: [support, mustWin],
      mustWinTask: mustWin,
      launch: makeLaunch({ mustWinTaskId: mustWin.id }),
      plannerBlocks: [existing],
    });

    const preview = buildShapeDayPreview({ context });

    expect(preview.preservedBlocks).toHaveLength(1);
    expect(preview.proposedAssignments[0]?.taskId).toBe("must-win");
    expect(preview.proposedBlocks.every((block) =>
      new Date(block.endsAt) <= new Date(existing.startsAt) ||
      new Date(block.startsAt) >= new Date(existing.endsAt),
    )).toBe(true);
  });

  it("uses goal priorities and flags unsized work without hiding it", () => {
    const priorityTask = makeTask({
      id: "priority-task",
      title: "Goal task",
      goalId: "goal-1",
      estimatedDurationMinutes: 30,
    });
    const unsizedTask = makeTask({
      id: "unsized",
      title: "Estimate me",
      estimatedDurationMinutes: null,
      focusLengthMinutes: null,
    });
    const context = makeContext({
      tasks: [unsizedTask, priorityTask],
      priorities: [makePriority({ goalId: "goal-1" })],
    });

    const preview = buildShapeDayPreview({ context });

    expect(preview.proposedAssignments[0]?.taskId).toBe("priority-task");
    expect(preview.needsEstimateTasks.map((task) => task.taskId)).toContain("unsized");
  });

  it("rejects apply when a preview would rewrite an existing assignment", async () => {
    const task = makeTask({ id: "task-1" });
    const context = makeContext({ tasks: [task] });
    const app = {
      prisma: {
        task: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: task.id,
              kind: "TASK",
              status: "PENDING",
              scheduledForDate: new Date(`${TEST_DATE}T00:00:00.000Z`),
            },
          ]),
        },
        dayPlannerBlockTask: {
          findMany: vi.fn().mockResolvedValue([{ taskId: task.id }]),
        },
      },
    } as any;

    await expect(
      applyShapeDayPlan(app, {
        context,
        payload: {
          proposedBlocks: [
            {
              tempId: "shape-1",
              title: "Focus block",
              startsAt: "2026-05-03T09:00:00.000Z",
              endsAt: "2026-05-03T09:25:00.000Z",
              taskIds: [task.id],
              tasks: [
                {
                  taskId: task.id,
                  title: task.title,
                  estimatedMinutes: 25,
                  assumedMinutes: false,
                },
              ],
            },
          ],
        },
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});
