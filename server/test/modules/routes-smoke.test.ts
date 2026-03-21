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
    prisma.goal = { findMany: vi.fn().mockResolvedValue([]) } as any;

    const response = await app!.inject({ method: "GET", url: "/api/goals?domain=health&status=active" });
    expect(response.statusCode).toBe(200);
    expect(prisma.goal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          domain: "HEALTH",
          status: "ACTIVE",
        }),
      }),
    );
  });

  it("serves reviews endpoint from mocked service", async () => {
    const response = await app!.inject({ method: "GET", url: "/api/reviews/daily/2026-03-14" });
    expect(response.statusCode).toBe(200);
    expect(reviewsMock.getDailyReviewModel).toHaveBeenCalled();
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

  it("serves home overview", async () => {
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
    prisma.task = {
      findMany: vi.fn().mockResolvedValue([
        {
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
          createdAt: new Date(),
          updatedAt: new Date(),
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

    const response = await app!.inject({ method: "GET", url: "/api/home/overview" });
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
        notificationType: "info",
        severity: "INFO",
        title: "Reminder",
        body: "Body",
        entityType: "item",
        entityId: "item-1",
        ruleKey: "rule-1",
        visibleFrom: null,
        expiresAt: null,
        readAt: null,
        dismissedAt: null,
        createdAt: new Date(),
      }),
      update: vi.fn().mockResolvedValue({
        id: "notification-1",
        userId: "user-1",
        notificationType: "info",
        severity: "INFO",
        title: "Reminder",
        body: "Body",
        entityType: "item",
        entityId: "item-1",
        ruleKey: "rule-1",
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
          createdAt: new Date(),
          updatedAt: new Date(),
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
      findMany: vi.fn().mockResolvedValue([
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
      ]),
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
      findMany: vi.fn().mockResolvedValue([
        {
          id: "task-1",
          userId: "user-1",
          title: "Task one",
          notes: null,
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
      ]),
      findFirst: vi.fn().mockResolvedValue({
        id: "task-1",
        userId: "user-1",
        title: "Task one",
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
      create: vi.fn().mockResolvedValue({
        id: "task-2",
        userId: "user-1",
        title: "Task two",
        notes: null,
        status: "PENDING",
        scheduledForDate: new Date("2026-03-15T00:00:00.000Z"),
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
      }),
      update: vi.fn().mockResolvedValue({
        id: "task-1",
        userId: "user-1",
        title: "Task one",
        notes: null,
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
      upsert: vi.fn().mockResolvedValue({
        timezone: "America/Chicago",
        currencyCode: "USD",
        weekStartsOn: 0,
        dailyWaterTargetMl: 3000,
        dailyReviewStartTime: "19:00",
        dailyReviewEndTime: "22:00",
      }),
    } as any;

    const response = await app!.inject({
      method: "PUT",
      url: "/api/settings/profile",
      payload: {
        displayName: "Owner Prime",
        timezone: "America/Chicago",
        weekStartsOn: 0,
        dailyWaterTargetMl: 3000,
        dailyReviewStartTime: "19:00",
        dailyReviewEndTime: "22:00",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        user: expect.objectContaining({ displayName: "Owner Prime" }),
        preferences: expect.objectContaining({ timezone: "America/Chicago", weekStartsOn: 0 }),
      }),
    );
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

  it("filters task list for inbox-style queries", async () => {
    prisma.task = {
      findMany: vi.fn().mockResolvedValue([]),
    } as any;

    const response = await app!.inject({
      method: "GET",
      url: "/api/tasks?status=pending&originType=quick_capture&scheduledState=unscheduled",
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          status: "PENDING",
          originType: "QUICK_CAPTURE",
          scheduledForDate: null,
        }),
      }),
    );
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
