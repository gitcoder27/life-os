import { describe, expect, it, vi } from "vitest";

import { backfillTaskReminders } from "../../../src/modules/planning/reminder-backfill.js";

describe("reminder backfill", () => {
  it("converts legacy quick-capture JSON into first-class reminder fields", async () => {
    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      task: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "task-1",
            notes: JSON.stringify({
              marker: "life_os_capture",
              v: 1,
              kind: "reminder",
              text: "Call the bank",
              reminderDate: "2026-03-14",
            }),
            user: {
              preferences: {
                timezone: "UTC",
              },
            },
          },
        ]),
        update,
      },
    } as any;

    const result = await backfillTaskReminders(prisma);

    expect(result).toEqual({
      updated: 1,
      skipped: 0,
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "task-1" },
        data: expect.objectContaining({
          kind: "REMINDER",
          notes: "Call the bank",
          reminderAt: new Date("2026-03-14T00:00:00.000Z"),
          reminderTriggeredAt: null,
        }),
      }),
    );
  });
});
