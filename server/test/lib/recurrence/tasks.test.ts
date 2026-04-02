import { describe, expect, it, vi } from "vitest";

import { applyRecurringTaskCarryForward } from "../../../src/lib/recurrence/tasks.js";

describe("applyRecurringTaskCarryForward", () => {
  it("preserves the source occurrence and creates a target occurrence for move_due_date", async () => {
    const sourceTask = {
      id: "task-1",
      userId: "user-1",
      title: "Recurring planning block",
      notes: null,
      kind: "TASK",
      reminderAt: null,
      reminderTriggeredAt: null,
      status: "PENDING",
      scheduledForDate: new Date("2026-03-14T00:00:00.000Z"),
      dueAt: new Date("2026-03-14T09:00:00.000Z"),
      goalId: null,
      originType: "RECURRING",
      carriedFromTaskId: null,
      recurrenceRuleId: "rule-1",
      completedAt: null,
      createdAt: new Date("2026-03-14T08:00:00.000Z"),
      updatedAt: new Date("2026-03-14T08:00:00.000Z"),
    };
    const createdTargetTask = {
      ...sourceTask,
      id: "task-2",
      scheduledForDate: new Date("2026-03-15T00:00:00.000Z"),
      carriedFromTaskId: "task-1",
    };
    const tx = {
      recurrenceRule: {
        findFirst: vi.fn().mockResolvedValue({
          id: "rule-1",
          ownerId: "task-1",
          carryPolicy: "MOVE_DUE_DATE",
          exceptions: [],
          tasks: [{ ...sourceTask }],
        }),
      },
      recurrenceException: {
        upsert: vi.fn().mockResolvedValue({
          id: "exception-1",
        }),
      },
      userPreference: {
        findUnique: vi.fn().mockResolvedValue({ timezone: "UTC" }),
      },
      task: {
        update: vi.fn().mockResolvedValue({
          ...sourceTask,
          status: "DROPPED",
        }),
        findFirstOrThrow: vi.fn(),
        create: vi.fn().mockResolvedValue(createdTargetTask),
      },
    } as any;

    const result = await applyRecurringTaskCarryForward(
      tx,
      "user-1",
      sourceTask as any,
      "2026-03-15",
    );

    expect(tx.recurrenceException.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          action: "RESCHEDULE",
          targetDate: new Date("2026-03-15T00:00:00.000Z"),
        }),
      }),
    );
    expect(tx.task.update).toHaveBeenCalledWith({
      where: {
        id: "task-1",
      },
      data: {
        status: "DROPPED",
        completedAt: null,
      },
    });
    expect(tx.task.findFirstOrThrow).not.toHaveBeenCalled();
    expect(tx.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recurrenceRuleId: "rule-1",
          scheduledForDate: new Date("2026-03-15T00:00:00.000Z"),
          carriedFromTaskId: "task-1",
          dueAt: new Date("2026-03-14T09:00:00.000Z"),
        }),
      }),
    );
    expect(result).toEqual(createdTargetTask);
  });
});
