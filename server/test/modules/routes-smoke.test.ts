import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";

import type { AppEnv } from "../../src/app/env.js";
import { registerModules } from "../../src/modules/index.js";
import { createMockPrisma } from "../utils/mock-prisma.js";

const scoringMock = {
  calculateDailyScore: vi.fn(),
  getWeeklyMomentum: vi.fn(),
  ensureCycle: vi.fn(),
  finalizeDailyScore: vi.fn(),
};

const reviewsMock = {
  getDailyReviewModel: vi.fn(),
  getReviewHistory: vi.fn(),
  submitDailyReview: vi.fn(),
  getWeeklyReviewModel: vi.fn(),
  submitWeeklyReview: vi.fn(),
  getMonthlyReviewModel: vi.fn(),
  submitMonthlyReview: vi.fn(),
};

vi.mock("../../src/modules/scoring/service.js", () => ({
  calculateDailyScore: (...args: unknown[]) => scoringMock.calculateDailyScore(...args),
  getWeeklyMomentum: (...args: unknown[]) => scoringMock.getWeeklyMomentum(...args),
  ensureCycle: (...args: unknown[]) => scoringMock.ensureCycle(...args),
  finalizeDailyScore: (...args: unknown[]) => scoringMock.finalizeDailyScore(...args),
}));
vi.mock("../../src/modules/reviews/service.js", () => ({
  getDailyReviewModel: (...args: unknown[]) => reviewsMock.getDailyReviewModel(...args),
  getReviewHistory: (...args: unknown[]) => reviewsMock.getReviewHistory(...args),
  submitDailyReview: (...args: unknown[]) => reviewsMock.submitDailyReview(...args),
  getWeeklyReviewModel: (...args: unknown[]) => reviewsMock.getWeeklyReviewModel(...args),
  submitWeeklyReview: (...args: unknown[]) => reviewsMock.submitWeeklyReview(...args),
  getMonthlyReviewModel: (...args: unknown[]) => reviewsMock.getMonthlyReviewModel(...args),
  submitMonthlyReview: (...args: unknown[]) => reviewsMock.submitMonthlyReview(...args),
}));

const testEnv = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 3001,
  APP_ORIGIN: "http://localhost:5173",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/life_os",
  SESSION_COOKIE_NAME: "life_os_session",
  SESSION_SECRET: "dev-only-change-me",
  SESSION_TTL_DAYS: 14,
  CSRF_COOKIE_NAME: "life_os_csrf",
  AUTH_RATE_LIMIT_WINDOW_MINUTES: 15,
  AUTH_RATE_LIMIT_MAX_ATTEMPTS: 5,
  OWNER_DISPLAY_NAME: "Owner",
  OWNER_EMAIL: "owner@example.com",
  OWNER_PASSWORD: "password123",
} as AppEnv;

function buildTaskRecord(
  overrides: Partial<{
    id: string;
    userId: string;
    title: string;
    notes: string | null;
    kind: "TASK" | "NOTE" | "REMINDER";
    reminderAt: Date | null;
    reminderTriggeredAt: Date | null;
    status: "PENDING" | "COMPLETED" | "DROPPED";
    scheduledForDate: Date | null;
    dueAt: Date | null;
    goalId: string | null;
    goal: {
      id: string;
      title: string;
      domain: "HEALTH" | "MONEY" | "WORK_GROWTH" | "HOME_ADMIN" | "DISCIPLINE" | "OTHER";
      status: "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
    } | null;
    originType: "MANUAL" | "QUICK_CAPTURE" | "CARRY_FORWARD" | "REVIEW_SEED" | "RECURRING" | "TEMPLATE";
    carriedFromTaskId: string | null;
    recurrenceRuleId: string | null;
    recurrenceRule: {
      id: string;
      ruleJson: Record<string, unknown>;
      carryPolicy: null;
      legacyRuleText: null;
      exceptions: [];
    } | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
) {
  return {
    id: "task-1",
    userId: "user-1",
    title: "Inbox task",
    notes: null,
    kind: "TASK" as const,
    reminderAt: null,
    reminderTriggeredAt: null,
    status: "PENDING" as const,
    scheduledForDate: null,
    dueAt: null,
    goalId: null,
    goal: null,
    originType: "QUICK_CAPTURE" as const,
    carriedFromTaskId: null,
    recurrenceRuleId: null,
    recurrenceRule: null,
    completedAt: null,
    createdAt: new Date("2026-03-14T08:00:00.000Z"),
    updatedAt: new Date("2026-03-14T08:00:00.000Z"),
    ...overrides,
  };
}

describe("module route smoke tests", () => {
  let app: Awaited<ReturnType<typeof Fastify>> | undefined;
  let prisma: Record<string, unknown>;

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
    prisma.recurrenceRule = {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({ id: "recurrence-1" }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: "recurrence-1",
        ruleJson: { frequency: "daily", startsOn: "2026-03-14" },
        carryPolicy: null,
        legacyRuleText: null,
        exceptions: [],
      }),
    } as any;
    prisma.recurrenceException = {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    } as any;

    scoringMock.ensureCycle.mockResolvedValue({
      id: "cycle-id",
      priorities: [{ slot: 1, title: "Plan", status: "COMPLETED", goalId: null }],
      dailyReview: null,
      dailyScore: null,
      plan: [],
    } as any);
    scoringMock.calculateDailyScore.mockResolvedValue({
      date: "2026-03-14",
      value: 70,
      label: "Solid Day",
      earnedPoints: 0,
      possiblePoints: 0,
      buckets: [],
      topReasons: [],
      finalizedAt: null,
      generatedAt: new Date().toISOString(),
    });

    reviewsMock.getDailyReviewModel.mockResolvedValue({
      date: "2026-03-14",
      summary: {},
      score: {
        date: "2026-03-14",
        value: 70,
        label: "Solid Day",
        earnedPoints: 0,
        possiblePoints: 0,
        buckets: [],
        topReasons: [],
        finalizedAt: null,
        generatedAt: new Date().toISOString(),
      },
      incompleteTasks: [],
      existingReview: null,
      generatedAt: new Date().toISOString(),
    } as any);
    reviewsMock.getReviewHistory.mockResolvedValue({
      items: [],
      nextCursor: null,
      summary: {
        totalReviews: 0,
        countsByCadence: {
          daily: 0,
          weekly: 0,
          monthly: 0,
        },
        topFrictionTags: [],
      },
      weeklyTrend: [],
      monthlyTrend: [],
      comparisons: {
        weekly: null,
        monthly: null,
      },
      generatedAt: new Date().toISOString(),
    } as any);
    reviewsMock.getWeeklyReviewModel.mockResolvedValue({
      startDate: "2026-03-14",
      endDate: "2026-03-20",
      summary: {
        averageDailyScore: 80,
        strongDayCount: 2,
        habitCompletionRate: 50,
        routineCompletionRate: 0,
        workoutsCompleted: 1,
        workoutsPlanned: 1,
        waterTargetHitCount: 0,
        mealsLoggedCount: 1,
        spendingTotal: 1200,
        topSpendCategory: "Food",
        topFrictionTags: [],
      },
      existingReview: null,
      generatedAt: new Date().toISOString(),
    } as any);
    reviewsMock.getMonthlyReviewModel.mockResolvedValue({
      startDate: "2026-03-01",
      endDate: "2026-03-31",
      summary: {
        averageWeeklyMomentum: 72,
        bestScore: 90,
        worstScore: 50,
        workoutCount: 5,
        waterSuccessRate: 60,
        spendingByCategory: [],
        topHabits: [],
        commonFrictionTags: [],
      },
      existingReview: null,
      generatedAt: new Date().toISOString(),
    } as any);
    scoringMock.getWeeklyMomentum.mockResolvedValue({
      endingOn: "2026-03-14",
      value: 70,
      basedOnDays: 3,
      weeklyReviewBonus: 0,
      strongDayStreak: 2,
      dailyScores: [],
      generatedAt: new Date().toISOString(),
    });

    app = Fastify({ logger: false });
    app.decorate("prisma", prisma);
    app.decorateRequest("auth", null);
    app.addHook("onRequest", async (request) => {
      request.cookies = {
        [testEnv.CSRF_COOKIE_NAME]: "csrf-token",
      };
      request.auth = {
        sessionToken: "session-token",
        sessionId: "session-id",
        userId: authenticatedUser.id,
        user: authenticatedUser,
      };
    });

    await app.register(registerModules, { env: testEnv, prefix: "/api" });
    await app.ready();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it("serves admin endpoints", async () => {
    prisma.adminItem = { findMany: vi.fn().mockResolvedValue([
      {
        id: "admin-1",
        userId: "user-1",
        title: "Pay utilities",
        itemType: "BILL",
        dueOn: new Date("2026-03-14T00:00:00.000Z"),
        status: "PENDING",
        relatedTaskId: null,
        recurringExpenseTemplateId: null,
        amountMinor: 12000,
        note: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]) };

    const response = await app!.inject({ method: "GET", url: "/api/admin-items" });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).adminItems).toHaveLength(1);
  });

  it("serves finance endpoints", async () => {
    prisma.expenseCategory = { findMany: vi.fn().mockResolvedValue([]) } as any;
    prisma.expense = { findMany: vi.fn().mockResolvedValue([]) } as any;
    prisma.userPreference = { findUnique: vi.fn().mockResolvedValue({ currencyCode: "USD", weeklyWindow: null }) } as any;
    prisma.adminItem = { findMany: vi.fn().mockResolvedValue([]) } as any;

    const response = await app!.inject({
      method: "GET",
      url: "/api/finance/summary?month=2026-03",
    });

    expect(response.statusCode).toBe(200);
  });

  it("serves health endpoints", async () => {
    prisma.userPreference = { findUnique: vi.fn().mockResolvedValue({ dailyWaterTargetMl: 2500 }) } as any;
    prisma.waterLog = { findMany: vi.fn().mockResolvedValue([]) } as any;
    prisma.mealLog = { findMany: vi.fn().mockResolvedValue([]) } as any;
    prisma.weightLog = { findMany: vi.fn().mockResolvedValue([]) } as any;
    prisma.workoutDay = {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    } as any;

    const response = await app!.inject({
      method: "GET",
      url: "/api/health/summary?from=2026-03-01&to=2026-03-14",
    });

    expect(response.statusCode).toBe(200);
  });

  it("serves habits list", async () => {
    scoringMock.ensureCycle.mockImplementation(async (_prisma: unknown, input: { cycleType: string }) => {
      if (input.cycleType === "WEEK") {
        return {
          id: "week-cycle",
          weeklyReview: {
            focusHabitId: "habit-1",
          },
        };
      }

      return {
        id: "day-cycle",
        priorities: [],
        dailyReview: null,
        dailyScore: null,
        weeklyReview: null,
        plan: [],
      };
    });
    prisma.habit = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "habit-1",
          userId: "user-1",
          title: "Hydrate",
          category: "Health",
          scheduleRuleJson: {},
          targetPerDay: 1,
          status: "ACTIVE",
          archivedAt: null,
          checkins: [
            { habitId: "habit-1", occurredOn: new Date("2026-03-10T00:00:00.000Z"), status: "COMPLETED" },
            { habitId: "habit-1", occurredOn: new Date("2026-03-11T00:00:00.000Z"), status: "COMPLETED" },
          ],
        },
      ]),
    } as any;
    prisma.routine = { findMany: vi.fn().mockResolvedValue([]) } as any;
    prisma.userPreference = {
      findUnique: vi.fn().mockResolvedValue({ timezone: "UTC", weekStartsOn: 1 }),
    } as any;

    const response = await app!.inject({ method: "GET", url: "/api/habits" });
    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body);
    expect(payload.habits[0].risk).toEqual(
      expect.objectContaining({
        level: expect.any(String),
        dueCount7d: expect.any(Number),
      }),
    );
    expect(payload.weeklyChallenge).toEqual(
      expect.objectContaining({
        habitId: "habit-1",
      }),
    );
  });

  it("supports habit goal linkage", async () => {
    scoringMock.ensureCycle.mockResolvedValue({
      id: "week-cycle",
      weeklyReview: null,
    } as any);
    const goalId = "11111111-1111-4111-8111-111111111111";
    prisma.goal = {
      findFirst: vi.fn().mockResolvedValue({
        id: goalId,
        userId: "user-1",
        title: "Stay on track",
        domain: "HEALTH",
        status: "ACTIVE",
      }),
    } as any;
    prisma.habit = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "habit-1",
          userId: "user-1",
          title: "Hydrate",
          category: "Health",
          scheduleRuleJson: {},
          goalId,
          goal: {
            id: goalId,
            title: "Stay on track",
            domain: "HEALTH",
            status: "ACTIVE",
          },
          targetPerDay: 1,
          status: "ACTIVE",
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
          checkins: [],
        },
      ]),
      create: vi.fn().mockResolvedValue({
        id: "habit-1",
        userId: "user-1",
        title: "Hydrate",
        category: "Health",
        scheduleRuleJson: {},
        goalId,
        targetPerDay: 1,
        status: "ACTIVE",
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
      }),
      findFirst: vi.fn().mockResolvedValue({
        id: "habit-1",
        userId: "user-1",
      }),
      update: vi.fn().mockResolvedValue({}),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: "habit-1",
        userId: "user-1",
        title: "Hydrate",
        category: "Health",
        scheduleRuleJson: {},
        goalId,
        goal: {
          id: goalId,
          title: "Stay on track",
          domain: "HEALTH",
          status: "ACTIVE",
        },
        targetPerDay: 1,
        status: "ACTIVE",
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        updatedAt: new Date("2026-03-22T00:00:00.000Z"),
        checkins: [],
      }),
    } as any;
    prisma.routine = { findMany: vi.fn().mockResolvedValue([]) } as any;
    prisma.userPreference = {
      findUnique: vi.fn().mockResolvedValue({ timezone: "UTC", weekStartsOn: 1 }),
    } as any;
    prisma.$transaction = vi.fn(async (callback: any) => callback(prisma)) as any;

    const list = await app!.inject({ method: "GET", url: "/api/habits" });
    const created = await app!.inject({
      method: "POST",
      url: "/api/habits",
      payload: {
        title: "Hydrate",
        category: "Health",
        goalId,
      },
    });
    const updated = await app!.inject({
      method: "PATCH",
      url: "/api/habits/habit-1",
      payload: {
        goalId,
      },
    });

    expect(list.statusCode).toBe(200);
    expect(JSON.parse(list.body).habits[0]).toEqual(
      expect.objectContaining({
        goalId,
        goal: expect.objectContaining({
          id: goalId,
          title: "Stay on track",
        }),
      }),
    );
    expect(created.statusCode).toBe(201);
    expect(JSON.parse(created.body).habit).toEqual(
      expect.objectContaining({
        goalId,
        goal: expect.objectContaining({
          id: goalId,
        }),
      }),
    );
    expect(updated.statusCode).toBe(200);
    expect(prisma.goal.findFirst).toHaveBeenCalled();
  });

  it("serves notifications", async () => {
    prisma.notification = { findMany: vi.fn().mockResolvedValue([]) } as any;

    const response = await app!.inject({ method: "GET", url: "/api/notifications" });
    expect(response.statusCode).toBe(200);
  });

  it("serves settings profile", async () => {
    prisma.user = {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: "user-1",
        email: "owner@example.com",
        displayName: "Owner",
      }),
    } as any;
    prisma.userPreference = {
      findUnique: vi.fn().mockResolvedValue({
        timezone: "America/New_York",
        currencyCode: "USD",
        weekStartsOn: 1,
        dailyWaterTargetMl: 2800,
        dailyReviewStartTime: "20:00",
        dailyReviewEndTime: "23:00",
        notificationPreferences: {
          review: { enabled: true, minSeverity: "info", repeatCadence: "hourly" },
          finance: { enabled: true, minSeverity: "warning", repeatCadence: "every_3_hours" },
          health: { enabled: false, minSeverity: "critical", repeatCadence: "off" },
        },
      }),
    } as any;

    const response = await app!.inject({ method: "GET", url: "/api/settings/profile" });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        user: expect.objectContaining({
          id: "user-1",
          email: "owner@example.com",
        }),
        preferences: expect.objectContaining({
          timezone: "America/New_York",
          dailyWaterTargetMl: 2800,
          notificationPreferences: expect.objectContaining({
            inbox: expect.objectContaining({
              enabled: true,
              minSeverity: "info",
              repeatCadence: "off",
            }),
            review: expect.objectContaining({
              enabled: true,
              minSeverity: "info",
              repeatCadence: "hourly",
            }),
            health: expect.objectContaining({
              enabled: false,
              minSeverity: "critical",
              repeatCadence: "off",
            }),
            habit: expect.objectContaining({
              enabled: true,
              minSeverity: "warning",
              repeatCadence: "off",
            }),
          }),
        }),
      }),
    );
  });

  it("serves onboarding state", async () => {
    prisma.userPreference = { findUnique: vi.fn().mockResolvedValue({}) } as any;
    prisma.user = { findUniqueOrThrow: vi.fn().mockResolvedValue({ onboardedAt: null }) } as any;

    const response = await app!.inject({ method: "GET", url: "/api/onboarding/state" });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        isRequired: false,
        isComplete: false,
      }),
    );
  });

  it("serves planning goals", async () => {
    prisma.userPreference = {
      findUnique: vi.fn().mockResolvedValue({ timezone: "UTC", weekStartsOn: 1 }),
    } as any;
    prisma.goal = {
      findMany: vi.fn().mockResolvedValue([]),
    } as any;
    prisma.cyclePriority = {
      findMany: vi.fn().mockResolvedValue([]),
    } as any;
    prisma.task = {
      findMany: vi.fn().mockResolvedValue([]),
    } as any;
    prisma.habit = {
      findMany: vi.fn().mockResolvedValue([]),
    } as any;

    const response = await app!.inject({ method: "GET", url: "/api/goals?domain=health&status=active" });
    expect(response.statusCode).toBe(200);
    expect(prisma.goal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          domain: "HEALTH",
          status: "ACTIVE",
        }),
        include: expect.objectContaining({
          milestones: expect.any(Object),
        }),
      }),
    );
  });

  it("serves goal detail and milestone updates", async () => {
    const goalId = "11111111-1111-4111-8111-111111111111";
    const milestoneId = "22222222-2222-4222-8222-222222222222";
    prisma.userPreference = {
      findUnique: vi.fn().mockResolvedValue({ timezone: "UTC", weekStartsOn: 1 }),
    } as any;
    prisma.goal = {
      findFirst: vi.fn().mockResolvedValue({
        id: goalId,
        userId: "user-1",
        title: "Stay on track",
        domain: "HEALTH",
        status: "ACTIVE",
        targetDate: new Date("2026-03-31T00:00:00.000Z"),
        notes: "Goal notes",
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        updatedAt: new Date("2026-03-20T00:00:00.000Z"),
        milestones: [
          {
            id: milestoneId,
            goalId,
            title: "Milestone one",
            targetDate: new Date("2026-03-25T00:00:00.000Z"),
            status: "PENDING",
            completedAt: null,
            sortOrder: 1,
            createdAt: new Date("2026-03-01T00:00:00.000Z"),
            updatedAt: new Date("2026-03-01T00:00:00.000Z"),
          },
        ],
      }),
    } as any;
    prisma.goalMilestone = {
      findMany: vi
        .fn()
        .mockResolvedValueOnce([
          {
            id: milestoneId,
            goalId,
            title: "Milestone one",
            targetDate: new Date("2026-03-25T00:00:00.000Z"),
            status: "PENDING",
            completedAt: null,
            sortOrder: 1,
            createdAt: new Date("2026-03-01T00:00:00.000Z"),
            updatedAt: new Date("2026-03-01T00:00:00.000Z"),
          },
        ])
        .mockResolvedValueOnce([
          {
            id: milestoneId,
            goalId,
            title: "Milestone one updated",
            targetDate: new Date("2026-03-26T00:00:00.000Z"),
            status: "COMPLETED",
            completedAt: new Date("2026-03-22T00:00:00.000Z"),
            sortOrder: 1,
            createdAt: new Date("2026-03-01T00:00:00.000Z"),
            updatedAt: new Date("2026-03-22T00:00:00.000Z"),
          },
        ]),
      deleteMany: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
    } as any;
    prisma.cyclePriority = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "priority-1",
          planningCycleId: "cycle-1",
          slot: 1,
          title: "Priority",
          status: "PENDING",
          goalId,
          completedAt: null,
          planningCycle: {
            cycleType: "WEEK",
            cycleStartDate: new Date("2026-03-16T00:00:00.000Z"),
            cycleEndDate: new Date("2026-03-22T00:00:00.000Z"),
          },
        },
      ]),
    } as any;
    prisma.task = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "task-1",
          userId: "user-1",
          title: "Linked task",
          notes: null,
          status: "PENDING",
          scheduledForDate: new Date("2026-03-22T00:00:00.000Z"),
          dueAt: new Date("2026-03-23T09:00:00.000Z"),
          goalId,
          originType: "MANUAL",
          carriedFromTaskId: null,
          completedAt: null,
          createdAt: new Date("2026-03-18T00:00:00.000Z"),
          updatedAt: new Date("2026-03-18T00:00:00.000Z"),
        },
      ]),
    } as any;
    prisma.habit = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "habit-1",
          userId: "user-1",
          title: "Hydrate",
          category: "Health",
          scheduleRuleJson: {},
          goalId,
          targetPerDay: 1,
          status: "ACTIVE",
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
          updatedAt: new Date("2026-03-18T00:00:00.000Z"),
          archivedAt: null,
          recurrenceRule: null,
          checkins: [{ occurredOn: new Date("2026-03-21T00:00:00.000Z"), status: "COMPLETED" }],
        },
      ]),
    } as any;
    prisma.$transaction = vi.fn(async (callback: any) => callback(prisma)) as any;

    const detail = await app!.inject({ method: "GET", url: `/api/goals/${goalId}?date=2026-03-22` });
    const milestoneUpdate = await app!.inject({
      method: "PUT",
      url: `/api/goals/${goalId}/milestones`,
      payload: {
        milestones: [
          {
            id: milestoneId,
            title: "Milestone one updated",
            targetDate: "2026-03-26",
            status: "completed",
          },
        ],
      },
    });

    expect(detail.statusCode).toBe(200);
    expect(JSON.parse(detail.body)).toEqual(
      expect.objectContaining({
        contextDate: "2026-03-22",
        goal: expect.objectContaining({
          id: goalId,
          nextBestAction: expect.any(String),
          milestones: [
            expect.objectContaining({
              id: milestoneId,
              title: "Milestone one",
            }),
          ],
          linkedPriorities: [
            expect.objectContaining({
              cycleType: "week",
            }),
          ],
          linkedTasks: [
            expect.objectContaining({
              id: "task-1",
            }),
          ],
          linkedHabits: [
            expect.objectContaining({
              id: "habit-1",
            }),
          ],
        }),
      }),
    );
    expect(milestoneUpdate.statusCode).toBe(200);
    expect(JSON.parse(milestoneUpdate.body).milestones[0]).toEqual(
      expect.objectContaining({
        id: milestoneId,
        status: "completed",
        title: "Milestone one updated",
      }),
    );
  });

  it("serves reviews endpoint from mocked service", async () => {
    const response = await app!.inject({ method: "GET", url: "/api/reviews/daily/2026-03-14" });
    expect(response.statusCode).toBe(200);
    expect(reviewsMock.getDailyReviewModel).toHaveBeenCalled();
  });

  it("serves review history endpoint from mocked service", async () => {
    const response = await app!.inject({
      method: "GET",
      url: "/api/reviews/history?cadence=weekly&range=90d&q=lesson&limit=10",
    });

    expect(response.statusCode).toBe(200);
    expect(reviewsMock.getReviewHistory).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      expect.objectContaining({
        cadence: "weekly",
        range: "90d",
        q: "lesson",
        limit: 10,
      }),
    );
  });

  it("serves weekly reviews endpoint from mocked service", async () => {
    const response = await app!.inject({ method: "GET", url: "/api/reviews/weekly/2026-03-14" });

    expect(response.statusCode).toBe(200);
    expect(reviewsMock.getWeeklyReviewModel).toHaveBeenCalled();
  });

  it("serves monthly reviews endpoint from mocked service", async () => {
    const response = await app!.inject({ method: "GET", url: "/api/reviews/monthly/2026-03-01" });

    expect(response.statusCode).toBe(200);
    expect(reviewsMock.getMonthlyReviewModel).toHaveBeenCalled();
  });

  it("serves weekly momentum endpoint from mocked service", async () => {
    const response = await app!.inject({ method: "GET", url: "/api/scores/weekly-momentum?endingOn=2026-03-14" });

    expect(response.statusCode).toBe(200);
    expect(scoringMock.getWeeklyMomentum).toHaveBeenCalled();
  });

  it("serves scoring daily score endpoint from mocked service", async () => {
    const response = await app!.inject({ method: "GET", url: "/api/scores/daily/2026-03-14" });

    expect(response.statusCode).toBe(200);
    expect(scoringMock.calculateDailyScore).toHaveBeenCalled();
  });

  it("serves home overview with accountability radar data", async () => {
    scoringMock.ensureCycle.mockImplementation(async (_prisma: unknown, input: { cycleType: string }) => {
      if (input.cycleType === "WEEK") {
        return {
          id: "week-cycle",
          weeklyReview: {
            focusHabitId: "habit-1",
          },
        };
      }

      return {
        id: "cycle-id",
        priorities: [
          {
            id: "priority-1",
            slot: 1,
            title: "Protect gym slot",
            status: "PENDING",
            goalId: "goal-1",
            goal: {
              id: "goal-1",
              title: "Build lifting consistency",
              domain: "HEALTH",
              status: "ACTIVE",
            },
          },
        ],
        dailyReview: null,
        dailyScore: null,
        weeklyReview: null,
        plan: [],
      };
    });

    const todayTask = {
      id: "task-1",
      userId: "user-1",
      title: "Open task",
      notes: null,
      status: "PENDING",
      scheduledForDate: new Date("2026-03-14T00:00:00.000Z"),
      dueAt: null,
      goalId: "goal-1",
      goal: {
        id: "goal-1",
        title: "Build lifting consistency",
        domain: "HEALTH",
        status: "ACTIVE",
      },
      originType: "MANUAL",
      carriedFromTaskId: null,
      completedAt: null,
      createdAt: new Date("2026-03-14T08:00:00.000Z"),
      updatedAt: new Date("2026-03-14T08:00:00.000Z"),
    };
    const overdueTask = {
      id: "task-overdue-1",
      userId: "user-1",
      title: "Missed Tuesday task",
      notes: null,
      status: "PENDING",
      scheduledForDate: new Date("2026-03-11T00:00:00.000Z"),
      dueAt: null,
      goalId: null,
      goal: null,
      originType: "MANUAL",
      carriedFromTaskId: null,
      completedAt: null,
      createdAt: new Date("2026-03-10T10:00:00.000Z"),
      updatedAt: new Date("2026-03-10T10:00:00.000Z"),
    };
    const staleInboxTask = {
      id: "task-stale-1",
      userId: "user-1",
      title: "Inbox reminder",
      notes: "Follow up with landlord",
      status: "PENDING",
      scheduledForDate: null,
      dueAt: null,
      goalId: null,
      goal: null,
      originType: "QUICK_CAPTURE",
      carriedFromTaskId: null,
      completedAt: null,
      createdAt: new Date("2026-03-09T12:00:00.000Z"),
      updatedAt: new Date("2026-03-09T12:00:00.000Z"),
    };
    prisma.task = {
      findMany: vi
        .fn()
        .mockResolvedValueOnce([todayTask])
        .mockResolvedValueOnce([overdueTask])
        .mockResolvedValueOnce([staleInboxTask]),
    } as any;
    prisma.habit = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "habit-1",
          userId: "user-1",
          title: "Hydrate",
          category: "Health",
          scheduleRuleJson: {},
          targetPerDay: 1,
          status: "ACTIVE",
          archivedAt: null,
        },
      ]),
    } as any;
    prisma.waterLog = { findMany: vi.fn().mockResolvedValue([]) } as any;
    prisma.mealLog = { findMany: vi.fn().mockResolvedValue([]) } as any;
    prisma.adminItem = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "admin-1",
          userId: "user-1",
          title: "Pay utilities",
          itemType: "BILL",
          dueOn: new Date("2026-03-14T00:00:00.000Z"),
          status: "PENDING",
          relatedTaskId: null,
          recurringExpenseTemplateId: null,
          amountMinor: 12000,
          note: null,
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
    } as any;
    prisma.habitCheckin = {
      findMany: vi.fn().mockResolvedValue([
        {
          habitId: "habit-1",
          occurredOn: new Date("2026-03-12T00:00:00.000Z"),
          status: "COMPLETED",
        },
        {
          habitId: "habit-1",
          occurredOn: new Date("2026-03-13T00:00:00.000Z"),
          status: "COMPLETED",
        },
      ]),
    } as any;
    prisma.routine = { findMany: vi.fn().mockResolvedValue([{ id: "routine-1", items: [] }]) } as any;
    prisma.routineItemCheckin = { findMany: vi.fn().mockResolvedValue([]) } as any;
    prisma.expense = { findMany: vi.fn().mockResolvedValue([]) } as any;
    prisma.notification = { findMany: vi.fn().mockResolvedValue([]) } as any;
    prisma.userPreference = {
      findUnique: vi.fn().mockResolvedValue({ dailyWaterTargetMl: 2500, timezone: "UTC", weekStartsOn: 1 }),
    } as any;
    prisma.workoutDay = { findUnique: vi.fn().mockResolvedValue(null) } as any;
    prisma.routineItem = { findMany: vi.fn().mockResolvedValue([]) } as any;

    const response = await app!.inject({ method: "GET", url: "/api/home/overview?date=2026-03-14" });
    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body);
    expect(payload.topPriorities[0]).toEqual(
      expect.objectContaining({
        goalId: "goal-1",
        goal: expect.objectContaining({
          id: "goal-1",
          title: "Build lifting consistency",
          domain: "health",
          status: "active",
        }),
      }),
    );
    expect(payload.tasks[0]).toEqual(
      expect.objectContaining({
        goalId: "goal-1",
        goal: expect.objectContaining({
          id: "goal-1",
          title: "Build lifting consistency",
        }),
      }),
    );
    expect(payload.accountabilityRadar).toEqual(
      expect.objectContaining({
        overdueTaskCount: 1,
        staleInboxCount: 1,
        totalCount: 2,
        overflowCount: 0,
      }),
    );
    expect(payload.accountabilityRadar.items[0]).toEqual(
      expect.objectContaining({
        id: "task-overdue-1",
        kind: "overdue_task",
        route: "/today",
        label: "Overdue by 3 days",
      }),
    );
    expect(payload.accountabilityRadar.items[1]).toEqual(
      expect.objectContaining({
        id: "task-stale-1",
        kind: "stale_inbox",
        route: "/inbox",
        label: "Inbox for 5 days",
      }),
    );
    expect(payload.attentionItems[0]).toEqual(
      expect.objectContaining({
        kind: "task",
        action: {
          type: "open_route",
          route: "/today",
        },
      }),
    );
    expect(payload.guidance.weeklyChallenge).toEqual(
      expect.objectContaining({
        habitId: "habit-1",
      }),
    );
    expect(payload.guidance.recommendations[0]).toEqual(
      expect.objectContaining({
        kind: "habit",
      }),
    );
    expect(prisma.recurrenceRule.findMany).toHaveBeenCalled();
    expect((prisma.task as { findMany: ReturnType<typeof vi.fn> }).findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          status: "PENDING",
          scheduledForDate: expect.objectContaining({
            lt: new Date("2026-03-14T00:00:00.000Z"),
          }),
        }),
      }),
    );
    expect((prisma.task as { findMany: ReturnType<typeof vi.fn> }).findMany).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: expect.objectContaining({
          status: "PENDING",
          originType: "QUICK_CAPTURE",
          scheduledForDate: null,
          createdAt: expect.objectContaining({
            lt: new Date("2026-03-11T00:00:00.000Z"),
          }),
        }),
      }),
    );
  });

  it("limits accountability radar items and materializes recurring task occurrences", async () => {
    const overdueTasks = Array.from({ length: 6 }, (_, index) => ({
      id: index === 0 ? "recurring-overdue-1" : `overdue-${index}`,
      userId: "user-1",
      title: index === 0 ? "Recurring cleanup" : `Overdue item ${index}`,
      notes: null,
      status: "PENDING",
      scheduledForDate: new Date(`2026-03-${String(2 + index).padStart(2, "0")}T00:00:00.000Z`),
      dueAt: null,
      goalId: null,
      goal: null,
      originType: index === 0 ? "RECURRING" : "MANUAL",
      carriedFromTaskId: null,
      completedAt: null,
      createdAt: new Date(`2026-03-${String(2 + index).padStart(2, "0")}T08:00:00.000Z`),
      updatedAt: new Date(`2026-03-${String(2 + index).padStart(2, "0")}T08:00:00.000Z`),
    }));
    prisma.recurrenceRule = {
      ...prisma.recurrenceRule,
      findMany: vi.fn().mockResolvedValue([
        {
          id: "recurrence-1",
          ownerType: "TASK",
          ownerId: "prototype-task-1",
          ruleJson: { frequency: "daily", startsOn: "2026-03-01" },
          exceptions: [],
          tasks: [
            {
              id: "prototype-task-1",
              userId: "user-1",
              title: "Recurring cleanup",
              notes: null,
              status: "PENDING",
              scheduledForDate: new Date("2026-03-01T00:00:00.000Z"),
              dueAt: null,
              goalId: null,
              originType: "RECURRING",
              carriedFromTaskId: null,
              recurrenceRuleId: "recurrence-1",
              completedAt: null,
              createdAt: new Date("2026-03-01T08:00:00.000Z"),
              updatedAt: new Date("2026-03-01T08:00:00.000Z"),
            },
          ],
        },
      ]),
    } as any;
    prisma.task = {
      create: vi.fn().mockResolvedValue({
        id: "recurring-overdue-1",
        userId: "user-1",
        title: "Recurring cleanup",
        notes: null,
        status: "PENDING",
        scheduledForDate: new Date("2026-03-02T00:00:00.000Z"),
        dueAt: null,
        goalId: null,
        goal: null,
        originType: "RECURRING",
        carriedFromTaskId: null,
        completedAt: null,
        createdAt: new Date("2026-03-02T08:00:00.000Z"),
        updatedAt: new Date("2026-03-02T08:00:00.000Z"),
      }),
      findMany: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(overdueTasks)
        .mockResolvedValueOnce([]),
    } as any;
    prisma.habit = { findMany: vi.fn().mockResolvedValue([]) } as any;
    prisma.habitCheckin = { findMany: vi.fn().mockResolvedValue([]) } as any;
    prisma.routine = { findMany: vi.fn().mockResolvedValue([]) } as any;
    prisma.routineItemCheckin = { findMany: vi.fn().mockResolvedValue([]) } as any;
    prisma.waterLog = { findMany: vi.fn().mockResolvedValue([]) } as any;
    prisma.mealLog = { findMany: vi.fn().mockResolvedValue([]) } as any;
    prisma.workoutDay = { findUnique: vi.fn().mockResolvedValue(null) } as any;
    prisma.expense = { findMany: vi.fn().mockResolvedValue([]) } as any;
    prisma.adminItem = { findMany: vi.fn().mockResolvedValue([]) } as any;
    prisma.notification = { findMany: vi.fn().mockResolvedValue([]) } as any;
    prisma.userPreference = {
      findUnique: vi.fn().mockResolvedValue({ dailyWaterTargetMl: 2500, timezone: "UTC", weekStartsOn: 1 }),
    } as any;

    const response = await app!.inject({ method: "GET", url: "/api/home/overview?date=2026-03-14" });
    expect(response.statusCode).toBe(200);

    const payload = JSON.parse(response.body);
    expect(payload.accountabilityRadar.totalCount).toBe(6);
    expect(payload.accountabilityRadar.items).toHaveLength(5);
    expect(payload.accountabilityRadar.overflowCount).toBe(1);
    expect(payload.accountabilityRadar.items[0]).toEqual(
      expect.objectContaining({
        id: "recurring-overdue-1",
        kind: "overdue_task",
      }),
    );
    expect((prisma.task as { create: ReturnType<typeof vi.fn> }).create).toHaveBeenCalled();
  });

  it("serves auth session status", async () => {
    const response = await app!.inject({ method: "GET", url: "/api/auth/session" });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).authenticated).toBe(true);
  });

  it("updates an admin item", async () => {
    prisma.adminItem = {
      findFirst: vi.fn().mockResolvedValue({
        id: "admin-1",
        userId: "user-1",
        title: "Pay utilities",
        itemType: "BILL",
        dueOn: new Date("2026-03-14T00:00:00.000Z"),
        status: "PENDING",
        relatedTaskId: null,
        recurringExpenseTemplateId: null,
        amountMinor: 12000,
        note: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      update: vi.fn().mockResolvedValue({
        id: "admin-1",
        userId: "user-1",
        title: "Pay utilities",
        itemType: "BILL",
        dueOn: new Date("2026-03-14T00:00:00.000Z"),
        status: "DONE",
        relatedTaskId: null,
        recurringExpenseTemplateId: null,
        amountMinor: 12000,
        note: null,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as any;
    prisma.task = { findFirst: vi.fn().mockResolvedValue({ id: "task-1", userId: "user-1" }) } as any;

    const response = await app!.inject({
      method: "PATCH",
      url: "/api/admin-items/admin-1",
      payload: { status: "done" },
    });

    expect(response.statusCode).toBe(200);
  });

  it("serves finance categories", async () => {
    prisma.expenseCategory = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "cat-1",
          userId: "user-1",
          name: "Utilities",
          color: "#ff0000",
          sortOrder: 1,
          createdAt: new Date("2026-03-14T00:00:00.000Z"),
          archivedAt: null,
        },
      ]),
      create: vi.fn().mockResolvedValue({
        id: "cat-2",
        userId: "user-1",
        name: "Dining",
        color: "#00ff00",
        sortOrder: 2,
        createdAt: new Date(),
        archivedAt: null,
      }),
      findFirst: vi.fn().mockResolvedValue({ id: "cat-1", userId: "user-1", archivedAt: null }),
      update: vi.fn().mockResolvedValue({
        id: "cat-1",
        userId: "user-1",
        name: "Utilities & Bills",
        color: "#ff0000",
        sortOrder: 3,
        createdAt: new Date("2026-03-14T00:00:00.000Z"),
        archivedAt: null,
      }),
    } as any;
    prisma.expense = {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({
        id: "expense-1",
        userId: "user-1",
        expenseCategoryId: "cat-1",
        amountMinor: 3000,
        currencyCode: "USD",
        spentOn: new Date("2026-03-14T00:00:00.000Z"),
        description: "Electricity",
        source: "MANUAL",
        recurringExpenseTemplateId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      findFirst: vi.fn().mockResolvedValue({
        id: "expense-1",
        userId: "user-1",
      }),
      update: vi.fn().mockResolvedValue({
        id: "expense-1",
        userId: "user-1",
        expenseCategoryId: "cat-1",
        amountMinor: 4500,
        currencyCode: "USD",
        spentOn: new Date("2026-03-14T00:00:00.000Z"),
        description: "Electricity",
        source: "MANUAL",
        recurringExpenseTemplateId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as any;
    prisma.recurringExpenseTemplate = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "template-1",
          userId: "user-1",
          title: "Rent",
          expenseCategoryId: "cat-1",
          defaultAmountMinor: 10000,
          currencyCode: "USD",
          recurrenceRule: "monthly",
          nextDueOn: new Date("2026-03-20T00:00:00.000Z"),
          remindDaysBefore: 1,
          status: "ACTIVE",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
      findFirst: vi.fn().mockResolvedValue({
        id: "template-1",
        userId: "user-1",
      }),
      create: vi.fn().mockResolvedValue({
        id: "template-2",
        userId: "user-1",
        title: "Utilities",
        expenseCategoryId: "cat-1",
        defaultAmountMinor: 12000,
        currencyCode: "USD",
        recurrenceRule: "monthly",
        nextDueOn: new Date("2026-03-20T00:00:00.000Z"),
        remindDaysBefore: 2,
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      update: vi.fn().mockResolvedValue({
        id: "template-1",
        userId: "user-1",
        title: "Rent updated",
        expenseCategoryId: "cat-1",
        defaultAmountMinor: 10500,
        currencyCode: "USD",
        recurrenceRule: "monthly",
        nextDueOn: new Date("2026-03-22T00:00:00.000Z"),
        remindDaysBefore: 2,
        status: "PAUSED",
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: "template-2",
        userId: "user-1",
        title: "Gym",
        expenseCategoryId: "cat-1",
        defaultAmountMinor: 12000,
        currencyCode: "USD",
        recurrenceRule: "monthly",
        nextDueOn: new Date("2026-03-30T00:00:00.000Z"),
        remindDaysBefore: 3,
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as any;

    const financeCategories = await app!.inject({ method: "GET", url: "/api/finance/categories" });
    const financeExpenses = await app!.inject({
      method: "GET",
      url: "/api/finance/expenses?from=2026-03-01&to=2026-03-31",
    });
    const financeCreateCategory = await app!.inject({
      method: "POST",
      url: "/api/finance/categories",
      payload: {
        name: "Subscriptions",
        color: "#0000ff",
        sortOrder: 2,
      },
    });
    const financePatchCategory = await app!.inject({
      method: "PATCH",
      url: "/api/finance/categories/cat-1",
      payload: {
        name: "Utilities & Bills",
        sortOrder: 3,
      },
    });
    const financeCreateExpense = await app!.inject({
      method: "POST",
      url: "/api/finance/expenses",
      payload: {
        expenseCategoryId: "11111111-1111-4111-8111-111111111111",
        amountMinor: 4200,
        currencyCode: "USD",
        spentOn: "2026-03-14",
        description: "Groceries",
      },
    });
    const financePatchExpense = await app!.inject({
      method: "PATCH",
      url: "/api/finance/expenses/expense-1",
      payload: { amountMinor: 4500, description: "Internet" },
    });
    const recurringExpenses = await app!.inject({ method: "GET", url: "/api/finance/recurring-expenses" });
    const recurringExpenseCreate = await app!.inject({
      method: "POST",
      url: "/api/finance/recurring-expenses",
      payload: {
        title: "Gym",
        expenseCategoryId: "11111111-1111-4111-8111-111111111111",
        defaultAmountMinor: 12000,
        currencyCode: "USD",
        recurrenceRule: "monthly",
        nextDueOn: "2026-03-30",
        remindDaysBefore: 3,
      },
    });
    const recurringExpensePatch = await app!.inject({
      method: "PATCH",
      url: "/api/finance/recurring-expenses/template-1",
      payload: {
        title: "Rent updated",
        defaultAmountMinor: 10500,
        recurrenceRule: "monthly",
        nextDueOn: "2026-03-22",
        status: "paused",
      },
    });

    expect(financeCategories.statusCode).toBe(200);
    expect(financeExpenses.statusCode).toBe(200);
    expect(financeCreateCategory.statusCode).toBe(201);
    expect(financePatchCategory.statusCode).toBe(200);
    expect(financeCreateExpense.statusCode).toBe(201);
    expect(financePatchExpense.statusCode).toBe(200);
    expect(recurringExpenses.statusCode).toBe(200);
    expect(recurringExpenseCreate.statusCode).toBe(201);
    expect(recurringExpensePatch.statusCode).toBe(200);
  });

  it("serves habit write paths", async () => {
    prisma.habit = {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({
        id: "habit-1",
        userId: "user-1",
        title: "Morning stretch",
        category: "Health",
        scheduleRuleJson: {},
        targetPerDay: 1,
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      findFirst: vi.fn().mockResolvedValue({
        id: "habit-1",
        userId: "user-1",
        title: "Morning stretch",
        category: "Health",
        scheduleRuleJson: {},
        targetPerDay: 1,
        status: "ACTIVE",
      }),
      update: vi.fn().mockResolvedValue({
        id: "habit-1",
        userId: "user-1",
        title: "Morning stretch",
        category: "Health",
        scheduleRuleJson: {},
        targetPerDay: 1,
        status: "ARCHIVED",
        createdAt: new Date(),
        updatedAt: new Date(),
        checkins: [],
      }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: "habit-1",
        userId: "user-1",
        title: "Morning stretch",
        category: "Health",
        scheduleRuleJson: {},
        targetPerDay: 1,
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
        checkins: [],
      }),
    } as any;
    prisma.habitCheckin = {
      upsert: vi.fn().mockResolvedValue({}),
    } as any;
    prisma.routine = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "routine-1",
          name: "Morning",
          period: "MORNING",
          status: "ACTIVE",
          createdAt: new Date(),
          items: [],
        },
      ]),
      findFirst: vi.fn().mockResolvedValue({ id: "routine-1", userId: "user-1" }),
      create: vi.fn().mockResolvedValue({
        id: "routine-1",
        userId: "user-1",
        name: "Evening",
        period: "EVENING",
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
      }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: "routine-1",
        name: "Evening",
        period: "EVENING",
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
      }),
      update: vi.fn().mockResolvedValue({}),
    } as any;
    prisma.routineItem = {
      findFirst: vi.fn().mockResolvedValue({
        id: "routine-item-1",
        routineId: "routine-1",
        title: "Drink",
        sortOrder: 1,
        isRequired: true,
      }),
      deleteMany: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({}),
    } as any;
    prisma.routineItemCheckin = {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
    } as any;
    prisma.cyclePriority = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "priority-1",
          slot: 1,
          title: "Priority",
          status: "PENDING",
          goalId: null,
          completedAt: null,
        },
      ]),
      findFirst: vi.fn().mockResolvedValue({
        id: "priority-1",
        planningCycleId: "cycle-1",
        slot: 1,
        title: "Priority",
        status: "PENDING",
        goalId: null,
        completedAt: null,
      }),
      deleteMany: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({
        id: "priority-1",
        slot: 1,
        title: "Priority",
        status: "PENDING",
        goalId: null,
        completedAt: null,
      }),
      update: vi.fn().mockResolvedValue({
        id: "priority-1",
        slot: 1,
        title: "Priority",
        status: "COMPLETED",
        goalId: null,
        completedAt: new Date(),
      }),
    } as any;
    prisma.$transaction = vi.fn(async (callback: any) => {
      return callback(prisma);
    }) as any;

    const habitsList = await app!.inject({ method: "GET", url: "/api/habits" });
    const habitsCreate = await app!.inject({
      method: "POST",
      url: "/api/habits",
      payload: { title: "Evening walk", category: "Health" },
    });
    const habitsPatch = await app!.inject({
      method: "PATCH",
      url: "/api/habits/habit-1",
      payload: { status: "archived" },
    });
    const habitCheckin = await app!.inject({
      method: "POST",
      url: "/api/habits/habit-1/checkins",
      payload: { status: "completed" },
    });
    const routinesList = await app!.inject({ method: "GET", url: "/api/routines" });
    const routinesCreate = await app!.inject({
      method: "POST",
      url: "/api/routines",
      payload: { name: "Night", period: "evening", items: [{ title: "Read", sortOrder: 1 }] },
    });
    const routinesPatch = await app!.inject({
      method: "PATCH",
      url: "/api/routines/routine-1",
      payload: {
        name: "Night update",
        items: [{ title: "Read more", sortOrder: 1, isRequired: false }],
      },
    });
    const routineItemCheckin = await app!.inject({
      method: "POST",
      url: "/api/routine-items/routine-item-1/checkins",
      payload: {},
    });

    expect(habitsList.statusCode).toBe(200);
    expect(habitsCreate.statusCode).toBe(201);
    expect(habitsPatch.statusCode).toBe(200);
    expect(habitCheckin.statusCode).toBe(200);
    expect(routinesList.statusCode).toBe(200);
    expect(routinesCreate.statusCode).toBe(201);
    expect(routinesPatch.statusCode).toBe(200);
    expect(routineItemCheckin.statusCode).toBe(200);
  });

  it("supports temporary habit pause windows", async () => {
    prisma.userPreference = {
      findUnique: vi.fn().mockResolvedValue({ timezone: "UTC", weekStartsOn: 1 }),
    } as any;
    prisma.habit = {
      findFirst: vi.fn().mockResolvedValue({
        id: "habit-1",
        userId: "user-1",
        title: "Morning stretch",
        category: "Health",
        scheduleRuleJson: {},
        targetPerDay: 1,
        status: "ACTIVE",
        archivedAt: null,
        pauseWindows: [],
      }),
      findUniqueOrThrow: vi.fn()
        .mockResolvedValueOnce({
          id: "habit-1",
          userId: "user-1",
          title: "Morning stretch",
          category: "Health",
          scheduleRuleJson: {},
          targetPerDay: 1,
          status: "ACTIVE",
          archivedAt: null,
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
          updatedAt: new Date("2026-03-22T00:00:00.000Z"),
          goal: null,
          recurrenceRule: null,
          checkins: [],
          pauseWindows: [
            {
              id: "pause-1",
              kind: "VACATION",
              startsOn: new Date("2026-03-22T00:00:00.000Z"),
              endsOn: new Date("2026-03-24T00:00:00.000Z"),
              note: "Trip",
            },
          ],
        })
        .mockResolvedValueOnce({
          id: "habit-1",
          userId: "user-1",
          title: "Morning stretch",
          category: "Health",
          scheduleRuleJson: {},
          targetPerDay: 1,
          status: "ACTIVE",
          archivedAt: null,
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
          updatedAt: new Date("2026-03-22T00:00:00.000Z"),
          goal: null,
          recurrenceRule: null,
          checkins: [],
          pauseWindows: [],
        }),
    } as any;
    prisma.habitPauseWindow = {
      findFirst: vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "pause-1",
          habitId: "habit-1",
          kind: "VACATION",
          startsOn: new Date("2026-03-22T00:00:00.000Z"),
          endsOn: new Date("2026-03-24T00:00:00.000Z"),
          note: "Trip",
        }),
      create: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    } as any;
    prisma.$transaction = vi.fn(async (callback: any) => callback(prisma)) as any;

    const created = await app!.inject({
      method: "POST",
      url: "/api/habits/habit-1/pause-windows",
      payload: {
        kind: "vacation",
        startsOn: "2026-03-22",
        endsOn: "2026-03-24",
        note: "Trip",
      },
    });
    const removed = await app!.inject({
      method: "DELETE",
      url: "/api/habits/habit-1/pause-windows/pause-1",
    });

    expect(created.statusCode).toBe(201);
    expect(JSON.parse(created.body).habit.pauseWindows).toEqual([
      expect.objectContaining({
        id: "pause-1",
        kind: "vacation",
        startsOn: "2026-03-22",
        endsOn: "2026-03-24",
      }),
    ]);
    expect(removed.statusCode).toBe(200);
    expect(JSON.parse(removed.body).habit.pauseWindows).toEqual([]);
  });

  it("rejects habit checkins during a temporary pause", async () => {
    prisma.userPreference = {
      findUnique: vi.fn().mockResolvedValue({ timezone: "UTC", weekStartsOn: 1 }),
    } as any;
    prisma.habit = {
      findFirst: vi.fn().mockResolvedValue({
        id: "habit-1",
        userId: "user-1",
        title: "Morning stretch",
        category: "Health",
        scheduleRuleJson: {},
        targetPerDay: 1,
        status: "ACTIVE",
        archivedAt: null,
        pauseWindows: [
          {
            id: "pause-1",
            kind: "REST_DAY",
            startsOn: new Date("2026-03-22T00:00:00.000Z"),
            endsOn: new Date("2026-03-22T00:00:00.000Z"),
            note: null,
          },
        ],
      }),
    } as any;
    prisma.habitCheckin = {
      upsert: vi.fn(),
    } as any;

    const response = await app!.inject({
      method: "POST",
      url: "/api/habits/habit-1/checkins",
      payload: {
        date: "2026-03-22",
        status: "completed",
      },
    });

    expect(response.statusCode).toBe(409);
    expect(prisma.habitCheckin.upsert).not.toHaveBeenCalled();
  });

  it("covers health write and read endpoints", async () => {
    prisma.waterLog = {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({
        id: "water-1",
        userId: "user-1",
        occurredAt: new Date("2026-03-14T10:00:00.000Z"),
        amountMl: 250,
        source: "TAP",
        createdAt: new Date(),
      }),
    } as any;
    prisma.mealTemplate = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "meal-template-1",
          userId: "user-1",
          name: "Breakfast",
          mealSlot: "BREAKFAST",
          templatePayloadJson: { description: "Protein" },
          createdAt: new Date(),
          updatedAt: new Date(),
          archivedAt: null,
        },
      ]),
      create: vi.fn().mockResolvedValue({
        id: "meal-template-2",
        userId: "user-1",
        name: "Lunch",
        mealSlot: "LUNCH",
        templatePayloadJson: { description: "Soup" },
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null,
      }),
      findFirst: vi.fn().mockResolvedValue({
        id: "meal-template-1",
        userId: "user-1",
        name: "Breakfast",
        mealSlot: "BREAKFAST",
        templatePayloadJson: { description: "Protein" },
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null,
      }),
      update: vi.fn().mockResolvedValue({
        id: "meal-template-1",
        userId: "user-1",
        name: "Breakfast upgrade",
        mealSlot: "BREAKFAST",
        templatePayloadJson: { description: "Eggs" },
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null,
      }),
      deleteMany: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({}),
    } as any;
    prisma.mealLog = {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({
        id: "meal-1",
        userId: "user-1",
        occurredAt: new Date("2026-03-14T12:00:00.000Z"),
        mealSlot: "BREAKFAST",
        mealTemplateId: null,
        description: "Toast",
        loggingQuality: "MEANINGFUL",
        createdAt: new Date(),
      }),
    } as any;
    prisma.workoutDay = {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({
        id: "workout-1",
        userId: "user-1",
        date: new Date("2026-03-14T00:00:00.000Z"),
        planType: "NONE",
        plannedLabel: null,
        actualStatus: "NONE",
        note: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as any;
    prisma.weightLog = {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({
        id: "weight-1",
        userId: "user-1",
        measuredOn: new Date("2026-03-14T00:00:00.000Z"),
        weightValue: 75,
        unit: "kg",
        note: null,
        createdAt: new Date(),
      }),
    } as any;

    const getWaterLogs = await app!.inject({ method: "GET", url: "/api/health/water-logs?date=2026-03-14" });
    const getMealTemplates = await app!.inject({ method: "GET", url: "/api/health/meal-templates" });
    const getMealLogs = await app!.inject({ method: "GET", url: "/api/health/meal-logs?date=2026-03-14" });
    const createMealTemplate = await app!.inject({
      method: "POST",
      url: "/api/health/meal-templates",
      payload: {
        name: "Dinner",
        mealSlot: "dinner",
        description: "Rice bowl",
      },
    });
    const patchMealTemplate = await app!.inject({
      method: "PATCH",
      url: "/api/health/meal-templates/meal-template-1",
      payload: {
        name: "Breakfast upgrade",
        description: "Eggs",
      },
    });
    const postWaterLog = await app!.inject({
      method: "POST",
      url: "/api/health/water-logs",
      payload: { amountMl: 500 },
    });
    const postMealLog = await app!.inject({
      method: "POST",
      url: "/api/health/meal-logs",
      payload: {
        description: "Salad",
        loggingQuality: "full",
        mealTemplateId: "11111111-1111-4111-8111-111111111111",
      },
    });
    const upsertWorkout = await app!.inject({
      method: "PUT",
      url: "/api/health/workout-days/2026-03-14",
      payload: { planType: "workout" },
    });
    const postWeightLog = await app!.inject({
      method: "POST",
      url: "/api/health/weight-logs",
      payload: { weightValue: 75, unit: "kg" },
    });

    expect(getWaterLogs.statusCode).toBe(200);
    expect(getMealTemplates.statusCode).toBe(200);
    expect(getMealLogs.statusCode).toBe(200);
    expect(createMealTemplate.statusCode).toBe(201);
    expect(patchMealTemplate.statusCode).toBe(200);
    expect(postWaterLog.statusCode).toBe(201);
    expect(postMealLog.statusCode).toBe(201);
    expect(upsertWorkout.statusCode).toBe(200);
    expect(postWeightLog.statusCode).toBe(201);
  });

  it("manages notification read and dismiss actions", async () => {
    prisma.notification = {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue({
        id: "notification-1",
        userId: "user-1",
        notificationType: "review",
        severity: "INFO",
        title: "Reminder",
        body: "Body",
        entityType: "item",
        entityId: "item-1",
        ruleKey: "rule-1",
        deliveryKey: "rule-1|item|item-1",
        visibleFrom: null,
        expiresAt: null,
        readAt: null,
        dismissedAt: null,
        createdAt: new Date(),
      }),
      update: vi.fn().mockResolvedValue({
        id: "notification-1",
        userId: "user-1",
        notificationType: "review",
        severity: "INFO",
        title: "Reminder",
        body: "Body",
        entityType: "item",
        entityId: "item-1",
        ruleKey: "rule-1",
        deliveryKey: "rule-1|item|item-1",
        visibleFrom: null,
        expiresAt: null,
        readAt: new Date(),
        dismissedAt: new Date(),
        createdAt: new Date(),
      }),
    } as any;

    const read = await app!.inject({ method: "POST", url: "/api/notifications/notification-1/read" });
    const dismiss = await app!.inject({ method: "POST", url: "/api/notifications/notification-1/dismiss" });

    expect(read.statusCode).toBe(200);
    expect(dismiss.statusCode).toBe(200);
  });

  it("snoozes notifications", async () => {
    prisma.notification = {
      findFirst: vi.fn().mockResolvedValue({
        id: "notification-1",
        userId: "user-1",
        notificationType: "review",
        severity: "INFO",
        title: "Reminder",
        body: "Body",
        entityType: "daily_review",
        entityId: "daily-review:2026-03-14",
        ruleKey: "daily_review_due",
        deliveryKey: "daily_review_due|daily_review|daily-review:2026-03-14",
        visibleFrom: null,
        expiresAt: new Date("2026-03-14T23:59:59.000Z"),
        readAt: new Date("2026-03-14T18:30:00.000Z"),
        dismissedAt: null,
        createdAt: new Date("2026-03-14T17:30:00.000Z"),
      }),
      update: vi.fn().mockResolvedValue({
        id: "notification-1",
        userId: "user-1",
        notificationType: "review",
        severity: "INFO",
        title: "Reminder",
        body: "Body",
        entityType: "daily_review",
        entityId: "daily-review:2026-03-14",
        ruleKey: "daily_review_due",
        deliveryKey: "daily_review_due|daily_review|daily-review:2026-03-14",
        visibleFrom: new Date("2026-03-15T03:30:00.000Z"),
        expiresAt: new Date("2026-03-15T23:59:59.000Z"),
        readAt: null,
        dismissedAt: null,
        createdAt: new Date("2026-03-14T17:30:00.000Z"),
      }),
    } as any;
    prisma.userPreference = {
      findUnique: vi.fn().mockResolvedValue({
        timezone: "UTC",
      }),
    } as any;

    const response = await app!.inject({
      method: "POST",
      url: "/api/notifications/notification-1/snooze",
      payload: {
        preset: "tomorrow",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          readAt: null,
          visibleFrom: expect.any(Date),
        }),
      }),
    );
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        notification: expect.objectContaining({
          id: "notification-1",
          read: false,
          visibleFrom: "2026-03-15T03:30:00.000Z",
        }),
      }),
    );
  });

  it("completes onboarding payload", async () => {
    prisma.userPreference = {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
    } as any;
    prisma.user = {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "user-1", onboardedAt: null, displayName: "Owner" }),
      update: vi.fn().mockResolvedValue({}),
    } as any;
    prisma.auditEvent = { create: vi.fn().mockResolvedValue({}) } as any;
    prisma.goal = {
      deleteMany: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({}),
    } as any;
    prisma.habit = {
      deleteMany: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({}),
    } as any;
    prisma.routine = {
      deleteMany: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({ id: "routine-onboarding-1" }),
      createMany: vi.fn().mockResolvedValue({}),
    } as any;
    prisma.routineItem = { createMany: vi.fn().mockResolvedValue({}) } as any;
    prisma.expenseCategory = {
      deleteMany: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn().mockResolvedValue({ id: "cat-1" }),
    } as any;
    prisma.mealTemplate = {
      deleteMany: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({}),
    } as any;
    prisma.planningCycle = {
      upsert: vi.fn().mockResolvedValue({}),
    } as any;

    const response = await app!.inject({
      method: "POST",
      url: "/api/onboarding/complete",
      payload: {
        displayName: "Owner",
        timezone: "UTC",
        currencyCode: "USD",
        weekStartsOn: 1,
        dailyWaterTargetMl: 2500,
        dailyReviewStartTime: "20:00",
        dailyReviewEndTime: "10:00",
        lifePriorities: ["Discipline", "Health"],
        goals: [
          {
            title: "Save monthly",
            domain: "money",
            targetDate: null,
            notes: null,
          },
        ],
        habits: [
          {
            title: "Drink water",
            category: "Health",
            targetPerDay: 2,
          },
        ],
        routines: [
          {
            name: "Morning",
            period: "morning",
            items: [{ title: "Hydrate", isRequired: true }],
          },
        ],
        expenseCategories: [{ name: "Utilities", color: "#111111" }],
        mealTemplates: [{ name: "Breakfast", mealSlot: "breakfast", description: "Eggs" }],
        firstWeekStartDate: "2026-03-09",
        firstMonthStartDate: "2026-03-01",
      },
    });

    expect(response.statusCode).toBe(202);
  });

  it("covers planning read and mutation endpoints", async () => {
    const planningCyclePayload = {
      id: "cycle-1",
      cycleEndDate: new Date("2026-03-14T00:00:00.000Z"),
      theme: "Health",
      priorities: [
        {
          id: "priority-1",
          slot: 1,
          title: "Focus",
          status: "PENDING",
          goalId: "goal-1",
          goal: {
            id: "goal-1",
            title: "Stay on track",
            domain: "HEALTH",
            status: "ACTIVE",
          },
          completedAt: null,
        },
      ],
    };
    prisma.userPreference = {
      findUnique: vi.fn().mockResolvedValue({ timezone: "UTC", weekStartsOn: 1 }),
    } as any;
    prisma.goal = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "goal-1",
          userId: "user-1",
          title: "Stay on track",
          domain: "HEALTH",
          status: "ACTIVE",
          targetDate: null,
          notes: null,
          milestones: [],
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
          updatedAt: new Date("2026-03-10T00:00:00.000Z"),
        },
        {
          id: "goal-2",
          userId: "user-1",
          title: "Marathon prep",
          domain: "HEALTH",
          status: "ACTIVE",
          targetDate: new Date("2026-03-18T00:00:00.000Z"),
          notes: null,
          milestones: [
            {
              id: "milestone-1",
              goalId: "goal-2",
              title: "Plan training block",
              targetDate: new Date("2026-03-17T00:00:00.000Z"),
              status: "PENDING",
              completedAt: null,
              sortOrder: 1,
              createdAt: new Date("2026-03-01T00:00:00.000Z"),
              updatedAt: new Date("2026-03-01T00:00:00.000Z"),
            },
          ],
          createdAt: new Date("2026-03-02T00:00:00.000Z"),
          updatedAt: new Date("2026-03-11T00:00:00.000Z"),
        },
      ]),
      findFirst: vi.fn().mockResolvedValue({
        id: "goal-1",
        userId: "user-1",
      }),
      create: vi.fn().mockResolvedValue({
        id: "goal-1",
        userId: "user-1",
        title: "Stay on track",
        domain: "HEALTH",
        status: "ACTIVE",
        targetDate: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      update: vi.fn().mockResolvedValue({
        id: "goal-1",
        userId: "user-1",
        title: "Stay on track",
        domain: "HEALTH",
        status: "COMPLETED",
        targetDate: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as any;
    prisma.planningCycle = {
      upsert: vi.fn().mockResolvedValue(planningCyclePayload),
      findUniqueOrThrow: vi.fn().mockResolvedValue(planningCyclePayload),
      update: vi.fn().mockResolvedValue({ id: "cycle-1", theme: "Focus" }),
    } as any;
    prisma.cyclePriority = {
      findMany: vi.fn().mockImplementation(async (args: any) => {
        if (args?.include?.planningCycle) {
          return [
            {
              id: "priority-1",
              planningCycleId: "cycle-1",
              slot: 1,
              title: "Priority",
              status: "PENDING",
              goalId: "goal-1",
              completedAt: null,
              planningCycle: {
                cycleType: "DAY",
                cycleStartDate: new Date("2026-03-14T00:00:00.000Z"),
                cycleEndDate: new Date("2026-03-14T00:00:00.000Z"),
              },
            },
          ];
        }

        if (args?.select?.completedAt) {
          return [];
        }

        return [
          {
            id: "priority-1",
            slot: 1,
            title: "Priority",
            status: "PENDING",
            goalId: "goal-1",
            goal: {
              id: "goal-1",
              title: "Stay on track",
              domain: "HEALTH",
              status: "ACTIVE",
            },
            completedAt: null,
          },
        ];
      }),
      findFirst: vi.fn().mockResolvedValue({
        id: "priority-1",
        planningCycleId: "cycle-1",
        slot: 1,
        title: "Priority",
        status: "PENDING",
        goalId: "goal-1",
        goal: {
          id: "goal-1",
          title: "Stay on track",
          domain: "HEALTH",
          status: "ACTIVE",
        },
        completedAt: null,
      }),
      deleteMany: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({
        id: "priority-1",
        slot: 1,
        title: "Priority",
        status: "PENDING",
        goalId: null,
        completedAt: null,
      }),
      update: vi.fn().mockResolvedValue({
        id: "priority-1",
        slot: 1,
        title: "Priority",
        status: "COMPLETED",
        goalId: "goal-1",
        goal: {
          id: "goal-1",
          title: "Stay on track",
          domain: "HEALTH",
          status: "ACTIVE",
        },
        completedAt: new Date(),
      }),
    } as any;
    prisma.task = {
      findMany: vi.fn().mockImplementation(async (args: any) => {
        if (args?.select?.createdAt) {
          return [];
        }

        if (args?.select?.completedAt) {
          return [];
        }

        return [
          {
            id: "task-1",
            userId: "user-1",
            title: "Task one",
            notes: null,
            kind: "TASK",
            reminderAt: null,
            status: "PENDING",
            scheduledForDate: new Date("2026-03-14T00:00:00.000Z"),
            dueAt: null,
            goalId: "goal-1",
            goal: {
              id: "goal-1",
              title: "Stay on track",
              domain: "HEALTH",
              status: "ACTIVE",
            },
            originType: "MANUAL",
            carriedFromTaskId: null,
            completedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];
      }),
      findFirst: vi.fn().mockResolvedValue({
        id: "task-1",
        userId: "user-1",
        title: "Task one",
        kind: "TASK",
        reminderAt: null,
        status: "PENDING",
        notes: null,
        scheduledForDate: new Date("2026-03-14T00:00:00.000Z"),
        dueAt: null,
        goalId: "goal-1",
        goal: {
          id: "goal-1",
          title: "Stay on track",
          domain: "HEALTH",
          status: "ACTIVE",
        },
        originType: "MANUAL",
        carriedFromTaskId: null,
        completedAt: null,
      }),
      create: vi.fn().mockImplementation(async ({ data }: any) => ({
        id:
          data.originType === "TEMPLATE"
            ? `template-task-${String(data.title).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
            : "task-2",
        userId: "user-1",
        title: data.title,
        notes: data.notes ?? null,
        kind: data.kind ?? "TASK",
        reminderAt: data.reminderAt ?? null,
        status: "PENDING",
        scheduledForDate:
          data.scheduledForDate ?? (data.originType === "TEMPLATE" ? null : new Date("2026-03-15T00:00:00.000Z")),
        dueAt: data.dueAt ?? null,
        goalId: data.goalId ?? (data.originType === "TEMPLATE" ? null : "goal-1"),
        goal:
          data.originType === "TEMPLATE"
            ? null
            : {
                id: "goal-1",
                title: "Stay on track",
                domain: "HEALTH",
                status: "ACTIVE",
              },
        originType: data.originType ?? "MANUAL",
        carriedFromTaskId: data.carriedFromTaskId ?? null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      update: vi.fn().mockResolvedValue({
        id: "task-1",
        userId: "user-1",
        title: "Task one",
        notes: null,
        kind: "TASK",
        reminderAt: null,
        status: "COMPLETED",
        scheduledForDate: new Date("2026-03-14T00:00:00.000Z"),
        dueAt: null,
        goalId: "goal-1",
        goal: {
          id: "goal-1",
          title: "Stay on track",
          domain: "HEALTH",
          status: "ACTIVE",
        },
        originType: "MANUAL",
        carriedFromTaskId: null,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: "task-2",
        userId: "user-1",
        title: "New task",
        notes: null,
        kind: "TASK",
        reminderAt: null,
        status: "PENDING",
        scheduledForDate: null,
        dueAt: null,
        goalId: null,
        goal: null,
        originType: "MANUAL",
        carriedFromTaskId: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      count: vi.fn().mockResolvedValue(0),
    } as any;
    prisma.habit = {
      findMany: vi.fn().mockResolvedValue([]),
    } as any;
    prisma.taskTemplate = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "task-template-1",
          userId: "user-1",
          name: "Travel prep",
          description: "Standard pre-trip checklist",
          templatePayloadJson: [{ title: "Check passport" }, { title: "Pack chargers" }],
          lastAppliedAt: null,
          archivedAt: null,
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
          updatedAt: new Date("2026-03-10T00:00:00.000Z"),
        },
      ]),
      findFirst: vi.fn().mockResolvedValue({
        id: "task-template-1",
        userId: "user-1",
        name: "Travel prep",
        description: "Standard pre-trip checklist",
        templatePayloadJson: [{ title: "Check passport" }, { title: "Pack chargers" }],
        lastAppliedAt: null,
        archivedAt: null,
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        updatedAt: new Date("2026-03-10T00:00:00.000Z"),
      }),
      create: vi.fn().mockImplementation(async ({ data }: any) => ({
        id: "task-template-2",
        userId: "user-1",
        name: data.name,
        description: data.description ?? null,
        templatePayloadJson: data.templatePayloadJson,
        lastAppliedAt: null,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      update: vi.fn().mockImplementation(async ({ where, data }: any) => ({
        id: where.id,
        userId: "user-1",
        name: data.name ?? "Travel prep",
        description:
          data.description === undefined
            ? "Standard pre-trip checklist"
            : data.description,
        templatePayloadJson: data.templatePayloadJson ?? [{ title: "Check passport" }, { title: "Pack chargers" }],
        lastAppliedAt: data.lastAppliedAt ?? null,
        archivedAt: data.archivedAt ?? null,
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        updatedAt: new Date(),
      })),
    } as any;
    prisma.$transaction = vi.fn(async (callback: any) => {
      return callback(prisma);
    }) as any;

    const goalsCreate = await app!.inject({
      method: "POST",
      url: "/api/goals",
      payload: {
        title: "Quarter focus",
        domain: "work_growth",
        notes: null,
      },
    });
    const goalsPatch = await app!.inject({
      method: "PATCH",
      url: "/api/goals/goal-1",
      payload: {
        title: "Quarter focus updated",
        status: "completed",
      },
    });
    const planningDay = await app!.inject({ method: "GET", url: "/api/planning/days/2026-03-14" });
    const planningDayPriorities = await app!.inject({
      method: "PUT",
      url: "/api/planning/days/2026-03-14/priorities",
      payload: {
        priorities: [
          { slot: 1, title: "Priority", goalId: "11111111-1111-4111-8111-111111111111" },
        ],
      },
    });
    const planningWeek = await app!.inject({ method: "GET", url: "/api/planning/weeks/2026-03-09" });
    const planningWeekPriorities = await app!.inject({
      method: "PUT",
      url: "/api/planning/weeks/2026-03-09/priorities",
      payload: {
        priorities: [
          { slot: 1, title: "Priority", goalId: "11111111-1111-4111-8111-111111111111" },
        ],
      },
    });
    const planningMonth = await app!.inject({ method: "GET", url: "/api/planning/months/2026-03-01" });
    const planningMonthFocus = await app!.inject({
      method: "PUT",
      url: "/api/planning/months/2026-03-01/focus",
      payload: {
        theme: "Health focus",
        topOutcomes: [{ slot: 1, title: "Top", goalId: "11111111-1111-4111-8111-111111111111" }],
      },
    });
    const taskTemplatesList = await app!.inject({
      method: "GET",
      url: "/api/task-templates",
    });
    const taskTemplateCreate = await app!.inject({
      method: "POST",
      url: "/api/task-templates",
      payload: {
        name: "Month-end admin",
        description: "Recurring finance closeout",
        tasks: [{ title: "Reconcile statements" }, { title: "File receipts" }],
      },
    });
    const taskTemplatePatch = await app!.inject({
      method: "PATCH",
      url: "/api/task-templates/task-template-1",
      payload: {
        name: "Travel prep v2",
        tasks: [{ title: "Check passport" }, { title: "Download tickets" }],
      },
    });
    const taskTemplateApply = await app!.inject({
      method: "POST",
      url: "/api/task-templates/task-template-1/apply",
    });
    const tasksList = await app!.inject({ method: "GET", url: "/api/tasks?status=pending" });
    const taskCreate = await app!.inject({
      method: "POST",
      url: "/api/tasks",
      payload: {
        title: "New task",
      },
    });
    const taskPatch = await app!.inject({
      method: "PATCH",
      url: "/api/tasks/task-1",
      payload: {
        status: "completed",
      },
    });
    const priorityPatch = await app!.inject({
      method: "PATCH",
      url: "/api/planning/priorities/priority-1",
      payload: {
        status: "completed",
      },
    });
    const taskCarryForward = await app!.inject({
      method: "POST",
      url: "/api/tasks/task-1/carry-forward",
      payload: { targetDate: "2026-03-15" },
    });

    expect(goalsCreate.statusCode).toBe(201);
    expect(goalsPatch.statusCode).toBe(200);
    expect(planningDay.statusCode).toBe(200);
    expect(planningDayPriorities.statusCode).toBe(200);
    expect(planningWeek.statusCode).toBe(200);
    expect(planningWeekPriorities.statusCode).toBe(200);
    expect(planningMonth.statusCode).toBe(200);
    expect(planningMonthFocus.statusCode).toBe(200);
    expect(taskTemplatesList.statusCode).toBe(200);
    expect(taskTemplateCreate.statusCode).toBe(201);
    expect(taskTemplatePatch.statusCode).toBe(200);
    expect(taskTemplateApply.statusCode).toBe(201);
    expect(tasksList.statusCode).toBe(200);
    expect(taskCreate.statusCode).toBe(201);
    expect(taskPatch.statusCode).toBe(200);
    expect(priorityPatch.statusCode).toBe(200);
    expect(taskCarryForward.statusCode).toBe(201);
    expect(JSON.parse(planningDay.body).priorities[0]).toEqual(
      expect.objectContaining({
        goalId: "goal-1",
        goal: expect.objectContaining({
          id: "goal-1",
          title: "Stay on track",
          domain: "health",
          status: "active",
        }),
      }),
    );
    expect(JSON.parse(planningDay.body).tasks[0]).toEqual(
      expect.objectContaining({
        goalId: "goal-1",
        goal: expect.objectContaining({
          id: "goal-1",
          title: "Stay on track",
        }),
      }),
    );
    expect(JSON.parse(planningDay.body).goalNudges[0]).toEqual(
      expect.objectContaining({
        goal: expect.objectContaining({
          id: "goal-2",
          title: "Marathon prep",
        }),
        nextBestAction: "Complete milestone: Plan training block",
        suggestedPriorityTitle: "Plan training block",
      }),
    );
    expect(JSON.parse(taskTemplateApply.body)).toEqual(
      expect.objectContaining({
        taskTemplate: expect.objectContaining({
          id: "task-template-1",
        }),
        tasks: expect.arrayContaining([
          expect.objectContaining({
            title: "Check passport",
            originType: "template",
            scheduledForDate: null,
          }),
        ]),
      }),
    );
  });

  it("updates settings profile", async () => {
    prisma.user = {
      update: vi.fn().mockResolvedValue({
        id: "user-1",
        email: "owner@example.com",
        displayName: "Owner Prime",
      }),
    } as any;
    prisma.userPreference = {
      findUnique: vi.fn().mockResolvedValue({
        notificationPreferences: {
          inbox: { enabled: true, minSeverity: "info", repeatCadence: "off" },
          review: { enabled: true, minSeverity: "info", repeatCadence: "hourly" },
        },
      }),
      upsert: vi.fn().mockResolvedValue({
        timezone: "America/Chicago",
        currencyCode: "USD",
        weekStartsOn: 0,
        dailyWaterTargetMl: 3000,
        dailyReviewStartTime: "19:00",
        dailyReviewEndTime: "22:00",
        notificationPreferences: {
          inbox: { enabled: true, minSeverity: "info", repeatCadence: "off" },
          review: { enabled: true, minSeverity: "warning", repeatCadence: "hourly" },
          finance: { enabled: false, minSeverity: "critical", repeatCadence: "every_3_hours" },
          health: { enabled: true, minSeverity: "warning", repeatCadence: "off" },
          habit: { enabled: true, minSeverity: "warning", repeatCadence: "off" },
          routine: { enabled: true, minSeverity: "warning", repeatCadence: "off" },
        },
      }),
    } as any;

    const response = await app!.inject({
      method: "PUT",
      url: "/api/settings/profile",
      payload: {
        displayName: "Owner Prime",
        timezone: "America/Chicago",
        currencyCode: "usd",
        weekStartsOn: 0,
        dailyWaterTargetMl: 3000,
        dailyReviewStartTime: "19:00",
        dailyReviewEndTime: "22:00",
        notificationPreferences: {
          review: {
            minSeverity: "warning",
          },
          finance: {
            enabled: false,
            minSeverity: "critical",
          },
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.userPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          currencyCode: "USD",
        }),
        update: expect.objectContaining({
          currencyCode: "USD",
        }),
      }),
    );
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        user: expect.objectContaining({ displayName: "Owner Prime" }),
        preferences: expect.objectContaining({
          timezone: "America/Chicago",
          currencyCode: "USD",
          weekStartsOn: 0,
          notificationPreferences: expect.objectContaining({
            inbox: expect.objectContaining({
              enabled: true,
              minSeverity: "info",
              repeatCadence: "off",
            }),
            review: expect.objectContaining({
              enabled: true,
              minSeverity: "warning",
              repeatCadence: "hourly",
            }),
            finance: expect.objectContaining({
              enabled: false,
              minSeverity: "critical",
              repeatCadence: "every_3_hours",
            }),
          }),
        }),
      }),
    );
  });

  it("rejects invalid locale values on settings profile update", async () => {
    const response = await app!.inject({
      method: "PUT",
      url: "/api/settings/profile",
      payload: {
        timezone: "Mars/Phobos",
        currencyCode: "ZZZ",
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("rejects foreign goal references on task creation", async () => {
    prisma.goal = {
      findFirst: vi.fn().mockResolvedValue(null),
    } as any;

    const response = await app!.inject({
      method: "POST",
      url: "/api/tasks",
      payload: {
        title: "Linked task",
        goalId: "11111111-1111-4111-8111-111111111111",
      },
    });

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body).message).toBe("Goal not found");
  });

  it("filters task list for inbox-style queries and returns exact counts", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi
      .fn()
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(3);

    prisma.task = {
      findMany,
      count,
    } as any;

    const response = await app!.inject({
      method: "GET",
      url: "/api/tasks?status=pending&originType=quick_capture&scheduledState=unscheduled&includeSummary=true",
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        tasks: [],
        nextCursor: null,
        counts: {
          all: 12,
          task: 5,
          note: 4,
          reminder: 3,
        },
      }),
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          status: "PENDING",
          originType: "QUICK_CAPTURE",
          scheduledForDate: null,
        }),
      }),
    );
    expect(count).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          status: "PENDING",
          originType: "QUICK_CAPTURE",
          scheduledForDate: null,
        }),
      }),
    );
    expect(count).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          kind: "TASK",
        }),
      }),
    );
    expect(count).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: expect.objectContaining({
          kind: "NOTE",
        }),
      }),
    );
    expect(count).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        where: expect.objectContaining({
          kind: "REMINDER",
        }),
      }),
    );
  });

  it("paginates task lists with a cursor", async () => {
    const firstTask = buildTaskRecord({
      id: "33333333-3333-4333-8333-333333333333",
      createdAt: new Date("2026-03-16T08:00:00.000Z"),
    });
    const secondTask = buildTaskRecord({
      id: "22222222-2222-4222-8222-222222222222",
      createdAt: new Date("2026-03-15T08:00:00.000Z"),
    });
    const thirdTask = buildTaskRecord({
      id: "11111111-1111-4111-8111-111111111111",
      createdAt: new Date("2026-03-14T08:00:00.000Z"),
    });
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([firstTask, secondTask, thirdTask])
      .mockResolvedValueOnce([thirdTask]);

    prisma.task = {
      findMany,
    } as any;

    const firstResponse = await app!.inject({
      method: "GET",
      url: "/api/tasks?status=pending&originType=quick_capture&scheduledState=unscheduled&limit=2",
    });

    expect(firstResponse.statusCode).toBe(200);
    const firstBody = JSON.parse(firstResponse.body);
    expect(firstBody.tasks).toHaveLength(2);
    expect(firstBody.nextCursor).toEqual(expect.any(String));
    expect(findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        take: 3,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    );

    const secondResponse = await app!.inject({
      method: "GET",
      url: `/api/tasks?status=pending&originType=quick_capture&scheduledState=unscheduled&limit=2&cursor=${encodeURIComponent(firstBody.nextCursor)}`,
    });

    expect(secondResponse.statusCode).toBe(200);
    expect(JSON.parse(secondResponse.body)).toEqual(
      expect.objectContaining({
        tasks: [expect.objectContaining({ id: thirdTask.id })],
        nextCursor: null,
      }),
    );
    expect(findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.any(Array),
        }),
        take: 3,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    );
  });

  it("rejects invalid task cursors", async () => {
    prisma.task = {
      findMany: vi.fn(),
    } as any;

    const response = await app!.inject({
      method: "GET",
      url: "/api/tasks?status=pending&originType=quick_capture&scheduledState=unscheduled&limit=2&cursor=not-a-valid-cursor",
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toBe("Invalid task cursor");
  });

  it("applies bulk scheduling and updates reminder timestamps directly", async () => {
    const firstTaskId = "11111111-1111-4111-8111-111111111111";
    const secondTaskId = "22222222-2222-4222-8222-222222222222";
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([
        buildTaskRecord({ id: firstTaskId }),
        buildTaskRecord({
          id: secondTaskId,
          kind: "REMINDER",
          notes: "Call the bank",
          reminderAt: new Date("2026-03-14T00:00:00.000Z"),
        }),
      ])
      .mockResolvedValueOnce([
        buildTaskRecord({
          id: firstTaskId,
          scheduledForDate: new Date("2026-03-16T00:00:00.000Z"),
        }),
        buildTaskRecord({
          id: secondTaskId,
          kind: "REMINDER",
          notes: "Call the bank",
          reminderAt: new Date("2026-03-16T00:00:00.000Z"),
          scheduledForDate: new Date("2026-03-16T00:00:00.000Z"),
        }),
      ]);
    const update = vi.fn().mockResolvedValue({});
    const count = vi.fn().mockResolvedValue(0);

    prisma.task = {
      findMany,
      count,
      update,
    } as any;

    const response = await app!.inject({
      method: "PATCH",
      url: "/api/tasks/bulk",
      payload: {
        taskIds: [firstTaskId, secondTaskId],
        action: {
          type: "schedule",
          scheduledForDate: "2026-03-16",
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: firstTaskId },
        data: expect.objectContaining({
          scheduledForDate: new Date("2026-03-16T00:00:00.000Z"),
        }),
      }),
    );
    expect(update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: secondTaskId },
        data: expect.objectContaining({
          scheduledForDate: new Date("2026-03-16T00:00:00.000Z"),
          reminderAt: new Date("2026-03-16T00:00:00.000Z"),
          reminderTriggeredAt: null,
        }),
      }),
    );
    expect(JSON.parse(response.body).tasks).toHaveLength(2);
  });

  it("records Inbox Zero when bulk scheduling clears the last stale capture", async () => {
    const taskId = "11111111-1111-4111-8111-111111111111";
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([
        buildTaskRecord({
          id: taskId,
          createdAt: new Date("2026-03-09T08:00:00.000Z"),
        }),
      ])
      .mockResolvedValueOnce([
        buildTaskRecord({
          id: taskId,
          createdAt: new Date("2026-03-09T08:00:00.000Z"),
          scheduledForDate: new Date("2026-03-16T00:00:00.000Z"),
        }),
      ]);
    const count = vi
      .fn()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    const update = vi.fn().mockResolvedValue({});
    const notificationFindFirst = vi.fn().mockResolvedValue(null);
    const notificationCreate = vi.fn().mockResolvedValue({});
    const auditEventCreate = vi.fn().mockResolvedValue({});

    prisma.task = {
      findMany,
      count,
      update,
    } as any;
    prisma.userPreference = {
      findUnique: vi.fn().mockResolvedValue({
        timezone: "UTC",
        notificationPreferences: {
          inbox: {
            enabled: true,
            minSeverity: "info",
            repeatCadence: "off",
          },
        },
      }),
    } as any;
    prisma.notification = {
      findFirst: notificationFindFirst,
      create: notificationCreate,
    } as any;
    prisma.auditEvent = {
      create: auditEventCreate,
    } as any;

    const response = await app!.inject({
      method: "PATCH",
      url: "/api/tasks/bulk",
      payload: {
        taskIds: [taskId],
        action: {
          type: "schedule",
          scheduledForDate: "2026-03-16",
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(count).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          originType: "QUICK_CAPTURE",
          scheduledForDate: null,
          status: "PENDING",
        }),
      }),
    );
    expect(auditEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "inbox.zero_achieved",
        }),
      }),
    );
    expect(notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          notificationType: "inbox",
          entityType: "inbox_zero",
          entityId: expect.any(String),
        }),
      }),
    );
    expect(notificationFindFirst).toHaveBeenCalled();
  });

  it("rejects bulk goal linking when the goal is foreign", async () => {
    prisma.goal = {
      findFirst: vi.fn().mockResolvedValue(null),
    } as any;

    const response = await app!.inject({
      method: "PATCH",
      url: "/api/tasks/bulk",
      payload: {
        taskIds: ["11111111-1111-4111-8111-111111111111"],
        action: {
          type: "link_goal",
          goalId: "22222222-2222-4222-8222-222222222222",
        },
      },
    });

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body).message).toBe("Goal not found");
  });

  it("rejects bulk updates when any task is missing", async () => {
    const findMany = vi.fn().mockResolvedValue([
      buildTaskRecord({ id: "11111111-1111-4111-8111-111111111111" }),
    ]);
    const update = vi.fn().mockResolvedValue({});

    prisma.task = {
      findMany,
      update,
    } as any;

    const response = await app!.inject({
      method: "PATCH",
      url: "/api/tasks/bulk",
      payload: {
        taskIds: [
          "11111111-1111-4111-8111-111111111111",
          "33333333-3333-4333-8333-333333333333",
        ],
        action: {
          type: "archive",
        },
      },
    });

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body).message).toBe("Task not found");
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects foreign goal references on day priority updates", async () => {
    prisma.goal = {
      findFirst: vi.fn().mockResolvedValue(null),
    } as any;
    prisma.planningCycle = {
      upsert: vi.fn().mockResolvedValue({
        id: "cycle-1",
        cycleEndDate: new Date("2026-03-14T00:00:00.000Z"),
        theme: null,
        priorities: [],
      }),
    } as any;
    prisma.cyclePriority = {
      findMany: vi.fn().mockResolvedValue([]),
    } as any;

    const response = await app!.inject({
      method: "PUT",
      url: "/api/planning/days/2026-03-14/priorities",
      payload: {
        priorities: [
          {
            slot: 1,
            title: "Linked priority",
            goalId: "11111111-1111-4111-8111-111111111111",
          },
        ],
      },
    });

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body).message).toBe("Goal not found");
  });

  it("rejects foreign meal template references on meal log creation", async () => {
    prisma.mealTemplate = {
      findFirst: vi.fn().mockResolvedValue(null),
    } as any;

    const response = await app!.inject({
      method: "POST",
      url: "/api/health/meal-logs",
      payload: {
        mealTemplateId: "11111111-1111-4111-8111-111111111111",
        description: "Lunch",
        loggingQuality: "meaningful",
      },
    });

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body).message).toBe("Meal template not found");
  });

  it("supports health log correction endpoints", async () => {
    prisma.waterLog = {
      findFirst: vi.fn().mockResolvedValue({
        id: "water-log-1",
        userId: "user-1",
      }),
      update: vi.fn().mockResolvedValue({
        id: "water-log-1",
        userId: "user-1",
        occurredAt: new Date("2026-03-14T10:00:00.000Z"),
        amountMl: 500,
        source: "MANUAL",
        createdAt: new Date("2026-03-14T09:00:00.000Z"),
      }),
      delete: vi.fn().mockResolvedValue({
        id: "water-log-1",
      }),
    } as any;
    prisma.mealTemplate = {
      findFirst: vi.fn().mockResolvedValue({
        id: "11111111-1111-4111-8111-111111111111",
        userId: "user-1",
      }),
    } as any;
    prisma.mealLog = {
      findFirst: vi.fn().mockResolvedValue({
        id: "meal-log-1",
        userId: "user-1",
      }),
      update: vi.fn().mockResolvedValue({
        id: "meal-log-1",
        userId: "user-1",
        occurredAt: new Date("2026-03-14T12:00:00.000Z"),
        mealSlot: "LUNCH",
        mealTemplateId: "11111111-1111-4111-8111-111111111111",
        description: "Chicken bowl",
        loggingQuality: "FULL",
        createdAt: new Date("2026-03-14T12:00:00.000Z"),
      }),
      delete: vi.fn().mockResolvedValue({
        id: "meal-log-1",
      }),
    } as any;
    prisma.weightLog = {
      findFirst: vi.fn().mockResolvedValue({
        id: "weight-log-1",
        userId: "user-1",
      }),
      update: vi.fn().mockResolvedValue({
        id: "weight-log-1",
        userId: "user-1",
        measuredOn: new Date("2026-03-14T00:00:00.000Z"),
        weightValue: 82.4,
        unit: "kg",
        note: "After workout",
        createdAt: new Date("2026-03-14T07:00:00.000Z"),
      }),
      delete: vi.fn().mockResolvedValue({
        id: "weight-log-1",
      }),
    } as any;

    const waterPatch = await app!.inject({
      method: "PATCH",
      url: "/api/health/water-logs/water-log-1",
      payload: {
        amountMl: 500,
        source: "manual",
      },
    });
    const waterDelete = await app!.inject({
      method: "DELETE",
      url: "/api/health/water-logs/water-log-1",
    });
    const mealPatch = await app!.inject({
      method: "PATCH",
      url: "/api/health/meal-logs/meal-log-1",
      payload: {
        mealTemplateId: "11111111-1111-4111-8111-111111111111",
        description: "Chicken bowl",
        loggingQuality: "full",
        mealSlot: "lunch",
      },
    });
    const mealDelete = await app!.inject({
      method: "DELETE",
      url: "/api/health/meal-logs/meal-log-1",
    });
    const weightPatch = await app!.inject({
      method: "PATCH",
      url: "/api/health/weight-logs/weight-log-1",
      payload: {
        weightValue: 82.4,
        unit: "kg",
        note: "After workout",
      },
    });
    const weightDelete = await app!.inject({
      method: "DELETE",
      url: "/api/health/weight-logs/weight-log-1",
    });

    expect(waterPatch.statusCode).toBe(200);
    expect(JSON.parse(waterPatch.body).waterLog).toEqual(
      expect.objectContaining({
        id: "water-log-1",
        amountMl: 500,
        source: "manual",
      }),
    );
    expect(waterDelete.statusCode).toBe(200);
    expect(JSON.parse(waterDelete.body)).toEqual(
      expect.objectContaining({
        deleted: true,
        waterLogId: "water-log-1",
      }),
    );
    expect(mealPatch.statusCode).toBe(200);
    expect(JSON.parse(mealPatch.body).mealLog).toEqual(
      expect.objectContaining({
        id: "meal-log-1",
        description: "Chicken bowl",
        loggingQuality: "full",
        mealSlot: "lunch",
      }),
    );
    expect(mealDelete.statusCode).toBe(200);
    expect(JSON.parse(mealDelete.body)).toEqual(
      expect.objectContaining({
        deleted: true,
        mealLogId: "meal-log-1",
      }),
    );
    expect(weightPatch.statusCode).toBe(200);
    expect(JSON.parse(weightPatch.body).weightLog).toEqual(
      expect.objectContaining({
        id: "weight-log-1",
        weightValue: 82.4,
        note: "After workout",
      }),
    );
    expect(weightDelete.statusCode).toBe(200);
    expect(JSON.parse(weightDelete.body)).toEqual(
      expect.objectContaining({
        deleted: true,
        weightLogId: "weight-log-1",
      }),
    );
  });

  it("supports expense deletion", async () => {
    prisma.expense = {
      findFirst: vi.fn().mockResolvedValue({
        id: "expense-1",
        userId: "user-1",
      }),
      delete: vi.fn().mockResolvedValue({
        id: "expense-1",
      }),
    } as any;

    const response = await app!.inject({
      method: "DELETE",
      url: "/api/finance/expenses/expense-1",
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        deleted: true,
        expenseId: "expense-1",
      }),
    );
  });

  it("rejects deleting a foreign expense", async () => {
    prisma.expense = {
      findFirst: vi.fn().mockResolvedValue(null),
    } as any;

    const response = await app!.inject({
      method: "DELETE",
      url: "/api/finance/expenses/expense-1",
    });

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body).message).toBe("Expense not found");
  });
});
