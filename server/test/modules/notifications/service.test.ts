import { describe, expect, it, vi } from "vitest";

import { generateRuleNotifications, cleanupOldNotifications } from "../../../src/modules/notifications/service.js";

vi.mock("../../../src/modules/scoring/service.js", () => ({
  ensureCycle: (...args: unknown[]) => ensureCycleMock(...args),
}));

const ensureCycleMock = vi.fn(async (_prisma: unknown, input: { cycleType: string }) => {
  if (input.cycleType === "DAY") {
    return {
      dailyReview: null,
    };
  }
  if (input.cycleType === "WEEK") {
    return {
      weeklyReview: null,
    };
  }
  if (input.cycleType === "MONTH") {
    return {
      monthlyReview: null,
    };
  }
  return {
    id: "cycle-id",
  };
});

describe("notifications service", () => {
  it("generates notifications for overdue and risk conditions", async () => {
    const now = new Date("2026-03-14T20:30:00.000Z");

    const prisma = {
      user: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "user-1",
            status: "ACTIVE",
            preferences: {
              weekStartsOn: 1,
              dailyWaterTargetMl: 2500,
            },
          },
        ]),
      },
      notification: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      adminItem: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "item-1",
            userId: "user-1",
            title: "Rent",
            dueOn: new Date("2026-03-14T00:00:00.000Z"),
            status: "PENDING",
          },
        ]),
      },
      waterLog: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "water-1",
            amountMl: 1000,
          },
        ]),
      },
      workoutDay: {
        findUnique: vi.fn().mockResolvedValue({
          id: "workout-1",
          planType: "WORKOUT",
          actualStatus: "NONE",
        }),
      },
      routine: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "routine-1",
            status: "ACTIVE",
            items: [{ id: "item-a" }, { id: "item-b" }],
          },
        ]),
      },
      routineItemCheckin: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      habit: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "habit-1",
            userId: "user-1",
            scheduleRuleJson: {},
            status: "ACTIVE",
            archivedAt: null,
          },
        ]),
      },
      habitCheckin: {
        findMany: vi.fn().mockResolvedValue([
          {
            habitId: "habit-1",
            occurredOn: new Date("2026-03-14T00:00:00.000Z"),
            status: "SKIPPED",
          },
          {
            habitId: "habit-1",
            occurredOn: new Date("2026-03-13T00:00:00.000Z"),
            status: "COMPLETED",
          },
          {
            habitId: "habit-1",
            occurredOn: new Date("2026-03-12T00:00:00.000Z"),
            status: "COMPLETED",
          },
        ]),
      },
      planningCycle: {},
    } as any;

    const result = await generateRuleNotifications(prisma as any, now);

    expect(result.created).toBe(9);
    expect(result.skippedExisting).toBe(0);
  });

  it("cleans up old notifications", async () => {
    const prisma = {
      notification: {
        deleteMany: vi.fn().mockResolvedValue({ count: 5 }),
      },
    } as any;

    const result = await cleanupOldNotifications(prisma, new Date("2026-03-14T12:00:00.000Z"));

    expect(result.deleted).toBe(5);
    expect(prisma.notification.deleteMany).toHaveBeenCalled();
  });
});
