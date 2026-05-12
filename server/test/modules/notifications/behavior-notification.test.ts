import { describe, expect, it, vi } from "vitest";

const getBehaviorStateForUserDateMock = vi.fn();
const ensureCycleMock = vi.fn(async (_prisma: unknown, input: { cycleType: string }) => {
  if (input.cycleType === "DAY") {
    return { dailyReview: { id: "daily-review-1" } };
  }
  if (input.cycleType === "WEEK") {
    return { weeklyReview: { id: "weekly-review-1" } };
  }
  if (input.cycleType === "MONTH") {
    return { monthlyReview: { id: "monthly-review-1" } };
  }

  return { id: "cycle-id" };
});

vi.mock("../../../src/modules/behavior/behavior-state-service.js", () => ({
  getBehaviorStateForUserDate: (...args: unknown[]) => getBehaviorStateForUserDateMock(...args),
}));

vi.mock("../../../src/modules/scoring/service.js", () => ({
  ensureCycle: (...args: unknown[]) => ensureCycleMock(...args),
}));

const { generateRuleNotifications } = await import("../../../src/modules/notifications/service.js");

describe("behavior notification generation", () => {
  it("creates a behavior notification for attention states", async () => {
    const now = new Date("2026-03-14T12:30:00.000Z");
    getBehaviorStateForUserDateMock.mockResolvedValue({
      date: "2026-03-14",
      state: "overloaded",
      severity: "urgent",
      label: "Overloaded",
      title: "Reduce today",
      reason: "The plan is carrying more work than the day can absorb.",
      signals: [],
      nextMove: {
        state: "reduce_day",
        title: "Reduce today",
        reason: "Protect one believable task and remove the rest.",
        primaryAction: {
          type: "reduce_day",
          label: "Reduce today",
          targetId: null,
        },
        secondaryAction: null,
        taskId: null,
        plannerBlockId: null,
        severity: "urgent",
      },
      homeAction: {
        type: "open_route",
        route: "/planner",
      },
    });

    const prisma = {
      user: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "user-1",
            status: "ACTIVE",
            preferences: {
              timezone: "UTC",
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
      task: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      planningCycle: {
        upsert: vi.fn(),
        findMany: vi.fn(),
      },
      dailyLaunch: {
        findUnique: vi.fn(),
      },
      dayPlannerBlock: {
        findMany: vi.fn(),
      },
      focusSession: {
        findFirst: vi.fn(),
      },
      recurrenceRule: {
        findMany: vi.fn(),
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
    } as any;

    const result = await generateRuleNotifications(prisma, now);

    expect(result.created).toBe(1);
    expect(prisma.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            notificationType: "behavior",
            severity: "CRITICAL",
            title: "Reduce today",
            entityType: "behavior_state",
            entityId: "behavior:overloaded:2026-03-14",
            ruleKey: "behavior_state_overloaded",
          }),
        ],
      }),
    );
    expect(getBehaviorStateForUserDateMock).toHaveBeenCalledWith(
      expect.objectContaining({ prisma }),
      expect.objectContaining({
        userId: "user-1",
        date: "2026-03-14",
      }),
    );
  });
});
