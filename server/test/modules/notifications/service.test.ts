import { describe, expect, it, vi } from "vitest";

import {
  cleanupOldNotifications,
  ensureGeneratedNotification,
  generateRuleNotifications,
} from "../../../src/modules/notifications/service.js";

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
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
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
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
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
    expect(prisma.notification.createMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ notificationType: "health" })],
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
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
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
    expect(prisma.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            notificationType: "review",
            deliveryKey:
              "daily_review_due|daily_review|daily-review:2026-03-14|2026-03-14|h20",
          }),
        ],
      }),
    );
  });

  it("treats duplicate active notification inserts as skipped generation", async () => {
    const prisma = {
      notification: {
        findFirst: vi.fn().mockResolvedValue(null),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    } as any;

    const created = await ensureGeneratedNotification(prisma, {
      userId: "user-1",
      notificationType: "review",
      severity: "WARNING",
      title: "Daily review is still open",
      body: "Complete the review.",
      entityType: "daily_review",
      entityId: "daily-review:2026-03-14",
      ruleKey: "daily_review_due",
      now: new Date("2026-03-14T20:30:00.000Z"),
      notificationPreferences: {
        task: { enabled: true, minSeverity: "warning", repeatCadence: "off" },
        inbox: { enabled: true, minSeverity: "info", repeatCadence: "off" },
        review: { enabled: true, minSeverity: "info", repeatCadence: "hourly" },
        finance: { enabled: true, minSeverity: "warning", repeatCadence: "every_3_hours" },
        health: { enabled: true, minSeverity: "warning", repeatCadence: "off" },
        habit: { enabled: true, minSeverity: "warning", repeatCadence: "off" },
        routine: { enabled: true, minSeverity: "warning", repeatCadence: "off" },
      },
    });

    expect(created).toBe(false);
    expect(prisma.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
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
