import { describe, expect, it, vi } from "vitest";

import { executeDueReminders } from "../../../src/modules/planning/reminder-execution.js";

describe("reminder execution", () => {
  it("promotes due reminders and creates task notifications once", async () => {
    const now = new Date("2026-03-14T06:30:00.000Z");
    const update = vi.fn().mockResolvedValue({});
    const notificationFindFirst = vi.fn().mockResolvedValue(null);
    const notificationCreateMany = vi.fn().mockResolvedValue({ count: 1 });
    const transaction = {
      task: {
        update,
      },
      notification: {
        findFirst: notificationFindFirst,
        createMany: notificationCreateMany,
      },
    };
    const prisma = {
      task: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "task-1",
            userId: "user-1",
            title: "Call the bank",
            notes: "Call the bank",
            scheduledForDate: null,
            reminderAt: new Date("2026-03-14T00:00:00.000Z"),
            user: {
              preferences: {
                timezone: "UTC",
                notificationPreferences: null,
              },
            },
          },
        ]),
      },
      $transaction: vi.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)),
    } as any;

    const result = await executeDueReminders(prisma, now);

    expect(result).toEqual({
      promoted: 1,
      notified: 1,
      skippedNotifications: 0,
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "task-1" },
        data: expect.objectContaining({
          scheduledForDate: new Date("2026-03-14T00:00:00.000Z"),
          reminderTriggeredAt: now,
        }),
      }),
    );
    expect(notificationCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            notificationType: "task",
            entityType: "task",
            ruleKey: "reminder_due",
          }),
        ],
      }),
    );
  });

  it("skips duplicate notifications but still stamps reminder execution", async () => {
    const now = new Date("2026-03-14T06:30:00.000Z");
    const update = vi.fn().mockResolvedValue({});
    const notificationFindFirst = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "existing-notification",
      });
    const notificationCreateMany = vi.fn().mockResolvedValue({ count: 1 });
    const transaction = {
      task: {
        update,
      },
      notification: {
        findFirst: notificationFindFirst,
        createMany: notificationCreateMany,
      },
    };
    const prisma = {
      task: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "task-1",
            userId: "user-1",
            title: "Pay rent",
            notes: null,
            scheduledForDate: new Date("2026-03-15T00:00:00.000Z"),
            reminderAt: new Date("2026-03-14T00:00:00.000Z"),
            user: {
              preferences: {
                timezone: "UTC",
                notificationPreferences: null,
              },
            },
          },
        ]),
      },
      $transaction: vi.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)),
    } as any;

    const result = await executeDueReminders(prisma, now);

    expect(result).toEqual({
      promoted: 0,
      notified: 0,
      skippedNotifications: 1,
    });
    expect(update).toHaveBeenCalledTimes(1);
    expect(notificationCreateMany).not.toHaveBeenCalled();
  });
});
