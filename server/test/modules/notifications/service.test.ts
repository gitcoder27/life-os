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
            title: "Hydrate",
            scheduleRuleJson: {},
            status: "ACTIVE",
            archivedAt: null,
            createdAt: new Date("2026-03-01T00:00:00.000Z"),
            pauseWindows: [],
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

    expect(result.created).toBe(8);
    expect(result.skippedExisting).toBe(0);
  });

  it("suppresses categories disabled by notification preferences", async () => {
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
              notificationPreferences: {
                health: {
                  enabled: false,
                  minSeverity: "warning",
                  repeatCadence: "off",
                },
              },
            },
          },
        ]),
      },
      notification: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      adminItem: {
        findMany: vi.fn().mockResolvedValue([]),
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
        findMany: vi.fn().mockResolvedValue([]),
      },
      routineItemCheckin: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      habit: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      habitCheckin: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      planningCycle: {},
    } as any;

    const result = await generateRuleNotifications(prisma as any, now);

    expect(result.created).toBe(3);
    expect(prisma.notification.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          notificationType: "health",
        }),
      }),
    );
  });

  it("creates bucketed delivery keys for repeatable review notifications", async () => {
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
        findMany: vi.fn().mockResolvedValue([]),
      },
      waterLog: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      workoutDay: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      routine: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      routineItemCheckin: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      habit: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      habitCheckin: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      planningCycle: {},
    } as any;

    const result = await generateRuleNotifications(prisma as any, now);

    expect(result.created).toBe(4);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          notificationType: "review",
          deliveryKey:
            "daily_review_due|daily_review|daily-review:2026-03-14|2026-03-14|h20",
        }),
      }),
    );
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
