import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calculateDailyScoreMock = vi.fn();
const ensureCycleMock = vi.fn();
const finalizeDailyScoreMock = vi.fn();
const getWeeklyMomentumMock = vi.fn();

vi.mock("../../../src/modules/scoring/service.js", () => ({
  calculateDailyScore: (...args: unknown[]) => calculateDailyScoreMock(...args),
  ensureCycle: (...args: unknown[]) => ensureCycleMock(...args),
  finalizeDailyScore: (...args: unknown[]) => finalizeDailyScoreMock(...args),
  getWeeklyMomentum: (...args: unknown[]) => getWeeklyMomentumMock(...args),
}));

import {
  getDailyReviewModel,
  getMonthlyReviewModel,
  getWeeklyReviewModel,
  submitDailyReview,
  submitMonthlyReview,
  submitWeeklyReview,
} from "../../../src/modules/reviews/service.js";

describe("reviews service", () => {
  beforeEach(() => {
    calculateDailyScoreMock.mockReset();
    ensureCycleMock.mockReset();
    finalizeDailyScoreMock.mockReset();
    getWeeklyMomentumMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds daily review model from cycle summary and persisted review", async () => {
    ensureCycleMock.mockResolvedValue({
      priorities: [],
      dailyReview: {
        biggestWin: "A big win",
        frictionTag: "low energy",
        frictionNote: "note",
        energyRating: 4,
        optionalNote: "optional",
        completedAt: new Date("2026-03-14T12:00:00.000Z"),
      },
    } as any);
    calculateDailyScoreMock.mockResolvedValue({
      date: "2026-03-14",
      value: 80,
      label: "Solid Day",
      earnedPoints: 0,
      possiblePoints: 0,
      buckets: [],
      topReasons: [],
      finalizedAt: null,
      generatedAt: new Date().toISOString(),
    });

    const prisma = {
      planningCycle: {
        findUnique: vi.fn().mockResolvedValue({
          priorities: [
            {
              id: "priority-2",
              slot: 1,
              title: "Tomorrow priority",
              status: "PENDING",
              goalId: null,
              completedAt: null,
            },
          ],
        }),
      },
      task: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "task-1",
            title: "Morning focus",
            notes: "",
            status: "COMPLETED",
            scheduledForDate: new Date("2026-03-14T00:00:00.000Z"),
            dueAt: null,
            goalId: null,
            originType: "MANUAL",
            carriedFromTaskId: null,
            completedAt: new Date("2026-03-14T09:00:00.000Z"),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      },
      routine: { findMany: vi.fn().mockResolvedValue([]) },
      routineItemCheckin: { findMany: vi.fn().mockResolvedValue([]) },
      habit: { findMany: vi.fn().mockResolvedValue([]) },
      habitCheckin: { findMany: vi.fn().mockResolvedValue([]) },
      waterLog: { findMany: vi.fn().mockResolvedValue([{ amountMl: 200 }]) },
      mealLog: { findMany: vi.fn().mockResolvedValue([]) },
      workoutDay: { findUnique: vi.fn().mockResolvedValue(null) },
      expense: { findMany: vi.fn().mockResolvedValue([]) },
      userPreference: { findUnique: vi.fn().mockResolvedValue({ dailyWaterTargetMl: 2500 }) },
    } as any;

    const response = await getDailyReviewModel(prisma, "user-1", new Date("2026-03-14T00:00:00.000Z"));

    expect(response.date).toBe("2026-03-14");
    expect(response.summary.tasksScheduled).toBe(1);
    expect(response.incompleteTasks).toHaveLength(0);
    expect(response.existingReview).toEqual(
      expect.objectContaining({
        biggestWin: "A big win",
        frictionTag: "low energy",
      }),
    );
    expect(response.score.value).toBe(80);
    expect(calculateDailyScoreMock).toHaveBeenCalledWith(prisma, "user-1", expect.any(Date));
  });

  it("prevents submitting review payload with duplicated task IDs", async () => {
    const prisma = {
      $transaction: vi.fn(),
    } as any;

    await expect(
      submitDailyReview(
        prisma,
        "user-1",
        new Date("2026-03-14T00:00:00.000Z"),
        {
          biggestWin: "Focus",
          frictionTag: "low energy",
          frictionNote: null,
          energyRating: 4,
          optionalNote: null,
          carryForwardTaskIds: ["task-1"],
          droppedTaskIds: ["task-1"],
          rescheduledTasks: [],
          tomorrowPriorities: [{ slot: 1, title: "next plan" }],
        },
      ),
    ).rejects.toThrow("Task task-1 appears in more than one review decision");
  });

  it("submits daily review and replaces tomorrow priorities", async () => {
    const dayCycle = {
      id: "day-cycle",
      priorities: [],
      dailyReview: null,
      dailyScore: null,
    };
    const tomorrowCycle = {
      id: "tomorrow-cycle",
      priorities: [{ id: "p-prev", slot: 1, title: "seed", goalId: null, status: "PENDING", completedAt: null }],
    };
    const sharedTask = {
      id: "carry-task",
      title: "Finish summary",
      notes: null,
      dueAt: null,
      goalId: null,
    };
    const rescheduledTask = {
      id: "resched-task",
      title: "Reschedule",
      notes: "note",
      dueAt: null,
      goalId: null,
    };
    const txCyclePriority = {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
      findMany: vi.fn().mockResolvedValue([
        {
          id: "new-priority",
          slot: 1,
          title: "Tomorrow reset",
          status: "PENDING",
          goalId: null,
          completedAt: null,
        },
      ]),
    };
    const txTask = {
      findUniqueOrThrow: vi.fn().mockImplementation(({ where: { id } }: any) => {
        if (id === "carry-task") {
          return Promise.resolve(sharedTask);
        }
        if (id === "resched-task") {
          return Promise.resolve(rescheduledTask);
        }
        throw new Error(`Task not found: ${id}`);
      }),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
    };
    const prisma = {
      task: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "carry-task",
            userId: "user-1",
            status: "PENDING",
            scheduledForDate: new Date("2026-03-14T00:00:00.000Z"),
          },
          {
            id: "drop-task",
            userId: "user-1",
            status: "PENDING",
            scheduledForDate: new Date("2026-03-14T00:00:00.000Z"),
          },
          {
            id: "resched-task",
            userId: "user-1",
            status: "PENDING",
            scheduledForDate: new Date("2026-03-14T00:00:00.000Z"),
          },
        ]),
      },
      $transaction: vi.fn(async (callback: any) =>
        callback({
          dailyReview: { upsert: vi.fn().mockResolvedValue({}) },
          cyclePriority: txCyclePriority,
          task: txTask,
        } as any),
      ),
      cyclePriority: txCyclePriority,
    } as any;

    ensureCycleMock.mockResolvedValueOnce(dayCycle).mockResolvedValueOnce(tomorrowCycle);
    finalizeDailyScoreMock.mockResolvedValue({
      date: "2026-03-14",
      value: 82,
      label: "Solid Day",
      earnedPoints: 0,
      possiblePoints: 0,
      buckets: [],
      topReasons: [],
      finalizedAt: null,
      generatedAt: new Date().toISOString(),
    });

    const response = await submitDailyReview(
      prisma,
      "user-1",
      new Date("2026-03-14T00:00:00.000Z"),
      {
        biggestWin: "Focus",
        frictionTag: "poor planning",
        frictionNote: null,
        energyRating: 3,
        optionalNote: null,
        carryForwardTaskIds: ["carry-task"],
        droppedTaskIds: ["drop-task"],
        rescheduledTasks: [
          {
            taskId: "resched-task",
            targetDate: "2026-03-16",
          },
        ],
        tomorrowPriorities: [
          { slot: 1, title: "tomorrow 1" },
          { slot: 2, title: "tomorrow 2", goalId: null },
        ],
      },
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(txTask.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "drop-task" } }));
    expect(txTask.create).toHaveBeenCalledTimes(2);
    expect(response.tomorrowPriorities).toHaveLength(1);
    expect(response.tomorrowPriorities[0]).toMatchObject({
      slot: 1,
      title: "Tomorrow reset",
      status: "pending",
    });
    expect(finalizeDailyScoreMock).toHaveBeenCalledWith(prisma, "user-1", new Date("2026-03-14T00:00:00.000Z"));
  });

  it("rejects daily review resubmission after the day is already closed", async () => {
    ensureCycleMock.mockResolvedValue({
      id: "day-cycle",
      priorities: [],
      dailyReview: {
        biggestWin: "Already done",
        frictionTag: "poor planning",
        frictionNote: null,
        energyRating: 3,
        optionalNote: null,
        completedAt: new Date("2026-03-14T21:00:00.000Z"),
      },
    } as any);

    await expect(
      submitDailyReview(
        { task: { findMany: vi.fn().mockResolvedValue([]) } } as any,
        "user-1",
        new Date("2026-03-14T00:00:00.000Z"),
        {
          biggestWin: "Focus",
          frictionTag: "poor planning",
          frictionNote: null,
          energyRating: 3,
          optionalNote: null,
          carryForwardTaskIds: [],
          droppedTaskIds: [],
          rescheduledTasks: [],
          tomorrowPriorities: [{ slot: 1, title: "tomorrow 1" }],
        },
      ),
    ).rejects.toThrow("Daily review has already been completed for this date");
  });

  it("requires all pending tasks for the review date to be resolved", async () => {
    ensureCycleMock.mockResolvedValue({
      id: "day-cycle",
      priorities: [],
      dailyReview: null,
      dailyScore: null,
    } as any);

    await expect(
      submitDailyReview(
        {
          task: {
            findMany: vi.fn().mockResolvedValue([
              {
                id: "task-1",
                userId: "user-1",
                status: "PENDING",
                scheduledForDate: new Date("2026-03-14T00:00:00.000Z"),
              },
            ]),
          },
        } as any,
        "user-1",
        new Date("2026-03-14T00:00:00.000Z"),
        {
          biggestWin: "Focus",
          frictionTag: "poor planning",
          frictionNote: null,
          energyRating: 3,
          optionalNote: null,
          carryForwardTaskIds: [],
          droppedTaskIds: [],
          rescheduledTasks: [],
          tomorrowPriorities: [{ slot: 1, title: "tomorrow 1" }],
        },
      ),
    ).rejects.toThrow("Every pending task for the review date must be resolved before submission");
  });

  it("builds weekly review summaries from activity and friction data", async () => {
    ensureCycleMock.mockResolvedValue({
      id: "week-cycle",
      cycleEndDate: new Date("2026-03-20T00:00:00.000Z"),
      weeklyReview: {
        biggestWin: "Done",
        biggestMiss: "Miss",
        mainLesson: "Lesson",
        keepText: "Keep",
        improveText: "Improve",
        focusHabitId: null,
        healthTargetText: null,
        spendingWatchCategoryId: null,
        notes: null,
        completedAt: new Date("2026-03-20T01:00:00.000Z"),
      },
    } as any);

    const prisma = {
      dailyScore: {
        findMany: vi.fn().mockResolvedValue([
          { scoreValue: 70, scoreBand: "Solid Day", planningCycle: { cycleStartDate: new Date("2026-03-14") } },
          { scoreValue: 80, scoreBand: "Strong Day", planningCycle: { cycleStartDate: new Date("2026-03-15") } },
          { scoreValue: 90, scoreBand: "Strong Day", planningCycle: { cycleStartDate: new Date("2026-03-16") } },
        ]),
      },
      habit: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "habit-1",
            title: "Push-up",
            scheduleRuleJson: {},
            checkins: [
              { occurredOn: new Date("2026-03-14T00:00:00.000Z"), status: "COMPLETED" },
              { occurredOn: new Date("2026-03-15T00:00:00.000Z"), status: "COMPLETED" },
            ],
          },
        ]),
      },
      routineItemCheckin: { findMany: vi.fn().mockResolvedValue([]) },
      routineItem: { findMany: vi.fn().mockResolvedValue([]) },
      workoutDay: { findMany: vi.fn().mockResolvedValue([{ actualStatus: "COMPLETED" }, { actualStatus: "FALLBACK" }]) },
      waterLog: { findMany: vi.fn().mockResolvedValue([{ amountMl: 1200 }]) },
      mealLog: { findMany: vi.fn().mockResolvedValue([{ id: "meal" }]) },
      userPreference: { findUnique: vi.fn().mockResolvedValue({ timezone: "UTC", dailyWaterTargetMl: 2500 }) },
      expense: {
        findMany: vi.fn().mockResolvedValue([
          { amountMinor: 2000, expenseCategory: { name: "Transport" } },
          { amountMinor: 1500, expenseCategory: { name: "Dining" } },
        ]),
      },
      dailyReview: { findMany: vi.fn().mockResolvedValue([{ frictionTag: "low energy" }, { frictionTag: "poor planning" }]) },
    } as any;

    const response = await getWeeklyReviewModel(prisma, "user-1", new Date("2026-03-14T00:00:00.000Z"));

    expect(response.startDate).toBe("2026-03-14");
    expect(response.summary.averageDailyScore).toBe(80);
    expect(response.summary.strongDayCount).toBe(3);
    expect(response.summary.topFrictionTags).toHaveLength(2);
    expect(response.summary.topFrictionTags[0]).toEqual({ tag: "low energy", count: 1 });
    expect(response.summary.workoutsCompleted).toBe(1);
  });

  it("builds monthly reviews from score and activity snapshots", async () => {
    ensureCycleMock.mockResolvedValue({
      id: "month-cycle",
      cycleEndDate: new Date("2026-03-31T00:00:00.000Z"),
      monthlyReview: {
        monthVerdict: "Good",
        biggestWin: "Habit",
        biggestLeak: "Money",
        ratingsJson: { discipline: 5 },
        nextMonthTheme: "Focus",
        threeOutcomesJson: ["x", "y", "z"],
        habitChangesJson: ["a"],
        simplifyText: "Simplify",
        notes: null,
        completedAt: new Date("2026-03-31T01:00:00.000Z"),
      },
    } as any);
    getWeeklyMomentumMock.mockResolvedValue({
      endingOn: "2026-03-31",
      value: 73,
      basedOnDays: 7,
      weeklyReviewBonus: 0,
      strongDayStreak: 3,
      dailyScores: [],
      generatedAt: new Date().toISOString(),
    });

    const prisma = {
      dailyScore: {
        findMany: vi.fn().mockResolvedValue([
          { scoreValue: 75, planningCycle: { cycleStartDate: new Date("2026-03-10") } },
          { scoreValue: 85, planningCycle: { cycleStartDate: new Date("2026-03-20") } },
        ]),
      },
      habit: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "habit-1",
            title: "Push-up",
            scheduleRuleJson: { daysOfWeek: [2, 5] },
            checkins: [
              { occurredOn: new Date("2026-03-10T00:00:00.000Z"), status: "COMPLETED" },
              { occurredOn: new Date("2026-03-20T00:00:00.000Z"), status: "COMPLETED" },
            ],
          },
          {
            id: "habit-2",
            title: "Read",
            scheduleRuleJson: { daysOfWeek: [3] },
            checkins: [{ occurredOn: new Date("2026-03-11T00:00:00.000Z"), status: "SKIPPED" }],
          },
        ]),
      },
      workoutDay: { findMany: vi.fn().mockResolvedValue([{ actualStatus: "COMPLETED" }]) },
      waterLog: {
        findMany: vi.fn().mockResolvedValue([
          { occurredAt: new Date("2026-03-10T12:00:00.000Z"), amountMl: 2500 },
          { occurredAt: new Date("2026-03-20T12:00:00.000Z"), amountMl: 2500 },
        ]),
      },
      userPreference: { findUnique: vi.fn().mockResolvedValue({ timezone: "UTC", dailyWaterTargetMl: 2500 }) },
      expense: { findMany: vi.fn().mockResolvedValue([{ amountMinor: 1000, expenseCategory: { name: "Food" } }]) },
      dailyReview: { findMany: vi.fn().mockResolvedValue([{ frictionTag: "low energy" }]) },
    } as any;

    const response = await getMonthlyReviewModel(prisma, "user-1", new Date("2026-03-01T00:00:00.000Z"));

    expect(response.summary.averageWeeklyMomentum).toBe(73);
    expect(response.summary.bestScore).toBe(85);
    expect(response.summary.worstScore).toBe(75);
    expect(response.summary.workoutCount).toBe(1);
    expect(response.summary.topHabits).toEqual([
      { habitId: "habit-1", title: "Push-up", completionRate: 22 },
      { habitId: "habit-2", title: "Read", completionRate: 0 },
    ]);
  });

  it("allows month and week submit operations to resolve", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-18T14:00:00.000Z"));
    ensureCycleMock.mockResolvedValue({ id: "cycle", cycleEndDate: new Date("2026-03-20T00:00:00.000Z") } as any);
    const prisma = {
      userPreference: { findUnique: vi.fn().mockResolvedValue({ timezone: "UTC", weekStartsOn: 1 }) },
      weeklyReview: { upsert: vi.fn().mockResolvedValue({}) },
      monthlyReview: { upsert: vi.fn().mockResolvedValue({}) },
      planningCycle: { update: vi.fn().mockResolvedValue({}) },
      cyclePriority: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
        findMany: vi.fn().mockResolvedValue([
          { id: "pr1", slot: 1, title: "A", status: "PENDING", goalId: null, completedAt: null },
        ]),
      },
    } as any;

    await submitWeeklyReview(prisma, "user-1", new Date("2026-03-09T00:00:00.000Z"), {
      biggestWin: "X",
      biggestMiss: "Y",
      mainLesson: "Lesson",
      keepText: "Keep",
      improveText: "Improve",
      nextWeekPriorities: [
        { slot: 1, title: "Next 1" },
        { slot: 2, title: "Next 2", goalId: null },
      ],
    });

    await submitMonthlyReview(
      prisma,
      "user-1",
      new Date("2026-02-01T00:00:00.000Z"),
      {
        monthVerdict: "Great",
        biggestWin: "Big win",
        biggestLeak: "Big leak",
        ratings: { energy: 4 },
        nextMonthTheme: "Next",
        threeOutcomes: ["One", "Two", "Three"],
        habitChanges: ["Change A"],
        simplifyText: "Less",
        notes: "Okay",
      },
    );
  });

  it("returns the daily submission window in the review model", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T08:30:00.000Z"));

    ensureCycleMock.mockResolvedValue({
      priorities: [],
      dailyReview: null,
    } as any);
    calculateDailyScoreMock.mockResolvedValue({
      date: "2026-03-14",
      value: 80,
      label: "Solid Day",
      earnedPoints: 0,
      possiblePoints: 0,
      buckets: [],
      topReasons: [],
      finalizedAt: null,
      generatedAt: new Date().toISOString(),
    });

    const prisma = {
      planningCycle: {
        findUnique: vi.fn().mockResolvedValue({ priorities: [] }),
      },
      task: { findMany: vi.fn().mockResolvedValue([]) },
      routine: { findMany: vi.fn().mockResolvedValue([]) },
      routineItemCheckin: { findMany: vi.fn().mockResolvedValue([]) },
      habit: { findMany: vi.fn().mockResolvedValue([]) },
      habitCheckin: { findMany: vi.fn().mockResolvedValue([]) },
      waterLog: { findMany: vi.fn().mockResolvedValue([]) },
      mealLog: { findMany: vi.fn().mockResolvedValue([]) },
      workoutDay: { findUnique: vi.fn().mockResolvedValue(null) },
      expense: { findMany: vi.fn().mockResolvedValue([]) },
      userPreference: {
        findUnique: vi.fn().mockResolvedValue({
          timezone: "UTC",
          dailyWaterTargetMl: 2500,
          dailyReviewStartTime: "20:00",
          dailyReviewEndTime: "10:00",
        }),
      },
    } as any;

    const response = await getDailyReviewModel(prisma, "user-1", new Date("2026-03-14T00:00:00.000Z"));

    expect(response.submissionWindow).toEqual(
      expect.objectContaining({
        isOpen: true,
        status: "open",
        requestedDate: "2026-03-14",
        allowedDate: "2026-03-14",
        timezone: "UTC",
      }),
    );
  });

  it("rejects daily review submission outside the active window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));

    const prisma = {
      userPreference: {
        findUnique: vi.fn().mockResolvedValue({
          timezone: "UTC",
          dailyReviewStartTime: "20:00",
          dailyReviewEndTime: "10:00",
        }),
      },
    } as any;

    await expect(
      submitDailyReview(
        prisma,
        "user-1",
        new Date("2026-03-14T00:00:00.000Z"),
        {
          biggestWin: "Focus",
          frictionTag: "poor planning",
          frictionNote: null,
          energyRating: 3,
          optionalNote: null,
          carryForwardTaskIds: [],
          droppedTaskIds: [],
          rescheduledTasks: [],
          tomorrowPriorities: [{ slot: 1, title: "tomorrow 1" }],
        },
      ),
    ).rejects.toThrow("Daily review is closed right now");
  });

  it("rejects weekly and monthly submissions outside their allowed period", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-18T14:00:00.000Z"));

    const prisma = {
      userPreference: { findUnique: vi.fn().mockResolvedValue({ timezone: "UTC", weekStartsOn: 1 }) },
    } as any;

    await expect(
      submitWeeklyReview(prisma, "user-1", new Date("2026-03-16T00:00:00.000Z"), {
        biggestWin: "X",
        biggestMiss: "Y",
        mainLesson: "Lesson",
        keepText: "Keep",
        improveText: "Improve",
        nextWeekPriorities: [{ slot: 1, title: "Next 1" }],
      }),
    ).rejects.toThrow("Weekly review can only be submitted for 2026-03-09 right now");

    await expect(
      submitMonthlyReview(prisma, "user-1", new Date("2026-03-01T00:00:00.000Z"), {
        monthVerdict: "Great",
        biggestWin: "Big win",
        biggestLeak: "Big leak",
        ratings: { energy: 4 },
        nextMonthTheme: "Next",
        threeOutcomes: ["One", "Two", "Three"],
        habitChanges: ["Change A"],
        simplifyText: "Less",
        notes: "Okay",
      }),
    ).rejects.toThrow("Monthly review can only be submitted for 2026-02-01 right now");
  });
});
