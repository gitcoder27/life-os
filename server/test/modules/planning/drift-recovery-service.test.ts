import { describe, expect, it, vi } from "vitest";

import {
  applyDriftRecovery,
  previewDriftRecovery,
} from "../../../src/modules/planning/drift-recovery-service.js";
import {
  makeBlock,
  makeContext,
  makeTask,
} from "./adaptive-today-test-fixtures.js";

describe("drift recovery service", () => {
  it("previews moving slipped work before applying it", () => {
    const slippedTask = makeTask({ id: "slipped", title: "Slipped task" });
    const slippedBlock = makeBlock({
      id: "past",
      title: "Morning",
      startsAt: "2026-05-03T09:00:00.000Z",
      endsAt: "2026-05-03T10:00:00.000Z",
      tasks: [slippedTask],
    });
    const currentBlock = makeBlock({
      id: "current",
      title: "Now",
      startsAt: "2026-05-03T10:00:00.000Z",
      endsAt: "2026-05-03T11:00:00.000Z",
      tasks: [],
    });
    const context = makeContext({
      tasks: [slippedTask],
      plannerBlocks: [slippedBlock, currentBlock],
    });

    const response = previewDriftRecovery({
      context,
      payload: {
        mode: "preview",
        action: "move_to_current_block",
      },
      now: new Date("2026-05-03T10:30:00.000Z"),
    });

    expect(response.mode).toBe("preview");
    expect(response.affectedTaskIds).toEqual(["slipped"]);
    expect(response.changes[0]).toMatchObject({
      from: "Morning",
      to: "Now",
    });
  });

  it("applies carry-forward recovery transactionally", async () => {
    const slippedTask = makeTask({ id: "slipped", title: "Slipped task" });
    const slippedBlock = makeBlock({
      id: "past",
      title: "Morning",
      startsAt: "2026-05-03T09:00:00.000Z",
      endsAt: "2026-05-03T10:00:00.000Z",
      tasks: [slippedTask],
    });
    const context = makeContext({
      tasks: [slippedTask],
      plannerBlocks: [slippedBlock],
    });
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const app = {
      prisma: {
        $transaction: vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback(app.prisma)),
        task: {
          findMany: vi.fn().mockResolvedValue([{ id: slippedTask.id }]),
          updateMany,
        },
        dayPlannerBlockTask: {
          deleteMany,
          findMany: vi.fn().mockResolvedValue([]),
          update: vi.fn(),
        },
        dayPlannerBlock: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: slippedBlock.id,
              title: slippedBlock.title,
              startsAt: new Date(slippedBlock.startsAt),
              endsAt: new Date(slippedBlock.endsAt),
              sortOrder: slippedBlock.sortOrder,
              createdAt: new Date(slippedBlock.createdAt),
              updatedAt: new Date(slippedBlock.updatedAt),
              taskLinks: [],
            },
          ]),
        },
      },
    } as any;

    const response = await applyDriftRecovery(app, {
      context,
      payload: {
        mode: "apply",
        action: "carry_forward_tomorrow",
      },
      now: new Date("2026-05-03T11:00:00.000Z"),
    });

    expect(response.mode).toBe("apply");
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        taskId: {
          in: ["slipped"],
        },
      },
    });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scheduledForDate: new Date("2026-05-04T00:00:00.000Z"),
          dueAt: null,
        }),
      }),
    );
    expect(response.capacity?.pendingTaskCount).toBe(0);
  });
});
