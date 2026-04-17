import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";

import { registerPlanningRoutes } from "../../../src/modules/planning/routes.js";
import { createMockPrisma } from "../../utils/mock-prisma.js";

vi.mock("../../../src/lib/recurrence/tasks.js", () => ({
  materializeRecurringTasksInRange: vi.fn().mockResolvedValue(undefined),
  materializeNextRecurringTaskOccurrence: vi.fn().mockResolvedValue(null),
  applyRecurringTaskCarryForward: vi.fn().mockResolvedValue(null),
}));

const WEEK_START = new Date("2026-03-09T00:00:00.000Z");
const WEEK_END = new Date("2026-03-15T00:00:00.000Z");
const DAY_DATE = new Date("2026-03-12T00:00:00.000Z");
const MONTH_START = new Date("2026-03-01T00:00:00.000Z");
const MONTH_END = new Date("2026-03-31T00:00:00.000Z");

describe("weekly capacity routes", () => {
  let app: Awaited<ReturnType<typeof Fastify>> | undefined;
  let prisma: Record<string, unknown>;
  let weekCycle: any;

  const authenticatedUser = {
    id: "user-1",
    email: "owner@example.com",
    displayName: "Owner",
  };

  beforeEach(async () => {
    if (app) {
      await app.close();
    }

    vi.clearAllMocks();
    prisma = createMockPrisma();
    weekCycle = {
      id: "week-cycle-1",
      userId: "user-1",
      cycleType: "WEEK",
      cycleStartDate: WEEK_START,
      cycleEndDate: WEEK_END,
      theme: null,
      weeklyCapacityMode: null,
      weeklyDeepWorkBlockTarget: null,
      priorities: [
        {
          id: "priority-1",
          slot: 1,
          title: "Protect deep work",
          status: "PENDING",
          goalId: "goal-1",
          goal: null,
          completedAt: null,
        },
        {
          id: "priority-2",
          slot: 2,
          title: "Close open loop",
          status: "PENDING",
          goalId: "goal-2",
          goal: null,
          completedAt: null,
        },
      ],
    };

    prisma.$transaction = vi.fn(async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => callback(prisma)) as any;
    prisma.userPreference = {
      findUnique: vi.fn().mockResolvedValue({ timezone: "UTC", weekStartsOn: 1 }),
    } as any;
    prisma.goalDomainConfig = {
      count: vi.fn().mockResolvedValue(1),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
    } as any;
    prisma.goalHorizonConfig = {
      count: vi.fn().mockResolvedValue(1),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
    } as any;
    prisma.goal = {
      findMany: vi.fn().mockResolvedValue([]),
    } as any;
    prisma.planningCycle = {
      upsert: vi.fn().mockImplementation(async ({ where, create }: any) => {
        const cycleType =
          where?.userId_cycleType_cycleStartDate?.cycleType ?? create?.cycleType;

        if (cycleType === "WEEK") {
          return weekCycle;
        }

        if (cycleType === "DAY") {
          return {
            id: "day-cycle-1",
            userId: "user-1",
            cycleType: "DAY",
            cycleStartDate: DAY_DATE,
            cycleEndDate: DAY_DATE,
            theme: null,
            priorities: [],
          };
        }

        return {
          id: "month-cycle-1",
          userId: "user-1",
          cycleType: "MONTH",
          cycleStartDate: MONTH_START,
          cycleEndDate: MONTH_END,
          theme: null,
          priorities: [],
        };
      }),
      update: vi.fn().mockImplementation(async ({ data }: any) => {
        weekCycle = {
          ...weekCycle,
          ...data,
        };

        return weekCycle;
      }),
    } as any;
    prisma.task = {
      findMany: vi.fn().mockImplementation(async ({ where }: any) => {
        if (where?.scheduledForDate?.gte) {
          return [
            { goalId: "goal-1", estimatedDurationMinutes: 180 },
            { goalId: "goal-2", estimatedDurationMinutes: null },
          ];
        }

        return [];
      }),
    } as any;

    app = Fastify({ logger: false });
    app.decorate("prisma", prisma);
    app.decorateRequest("auth", null);
    app.addHook("onRequest", async (request) => {
      request.auth = {
        sessionToken: "session-token",
        sessionId: "session-id",
        userId: authenticatedUser.id,
        user: authenticatedUser,
      };
    });

    await app.register(registerPlanningRoutes, { prefix: "/api" });
    await app.ready();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it("returns weekly capacity defaults from the week plan endpoint", async () => {
    const response = await app!.inject({
      method: "GET",
      url: "/api/planning/weeks/2026-03-09",
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        capacityProfile: {
          capacityMode: "standard",
          deepWorkBlockTarget: 4,
        },
        capacityAssessment: expect.objectContaining({
          status: "healthy",
          plannedPriorityCount: 2,
          scheduledTaskCount: 2,
          estimatedMinutesTotal: 180,
          unsizedTaskCount: 1,
          focusGoalCount: 2,
        }),
      }),
    );
  });

  it("persists the weekly capacity profile and resolves the default target", async () => {
    const response = await app!.inject({
      method: "PUT",
      url: "/api/planning/weeks/2026-03-09/capacity",
      payload: {
        capacityMode: "light",
        deepWorkBlockTarget: null,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.planningCycle.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          weeklyCapacityMode: "LIGHT",
          weeklyDeepWorkBlockTarget: 2,
        },
      }),
    );
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        capacityProfile: {
          capacityMode: "light",
          deepWorkBlockTarget: 2,
        },
      }),
    );
  });

  it("rejects invalid deep work targets", async () => {
    const response = await app!.inject({
      method: "PUT",
      url: "/api/planning/weeks/2026-03-09/capacity",
      payload: {
        capacityMode: "standard",
        deepWorkBlockTarget: 11,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("includes weekly capacity in goals workspace weekPlan", async () => {
    const response = await app!.inject({
      method: "GET",
      url: "/api/goals/workspace?date=2026-03-12",
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        weekPlan: expect.objectContaining({
          capacityProfile: {
            capacityMode: "standard",
            deepWorkBlockTarget: 4,
          },
          capacityAssessment: expect.objectContaining({
            status: "healthy",
          }),
        }),
      }),
    );
  });
});
