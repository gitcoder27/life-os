import { describe, expect, it, vi } from "vitest";

import {
  calculateDailyScore,
  ensureCycle,
  getScoreHistory,
  getWeeklyMomentum,
} from "../../../src/modules/scoring/service.js";

describe("scoring service", () => {
  it("upserts day/week/month cycles through ensureCycle", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "cycle-1", priorities: [] });
    const prisma = { planningCycle: { upsert } } as any;

    const cycle = await ensureCycle(prisma, {
      userId: "user-1",
      cycleType: "DAY",
      cycleStartDate: new Date("2026-03-14T00:00:00.000Z"),
      cycleEndDate: new Date("2026-03-14T00:00:00.000Z"),
    });

    expect(cycle.id).toBe("cycle-1");
    expect(upsert).toHaveBeenCalled();
  });

  it("returns the created cycle when concurrent upserts collide on the unique key", async () => {
    const cycleStartDate = new Date("2026-03-14T00:00:00.000Z");
    const conflict = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
    });
    const findUnique = vi.fn().mockResolvedValue({
      id: "cycle-1",
      cycleEndDate: cycleStartDate,
      priorities: [],
      dailyReview: null,
      dailyScore: null,
      weeklyReview: null,
      monthlyReview: null,
    });
    const update = vi.fn();
    const prisma = {
      planningCycle: {
        upsert: vi.fn().mockRejectedValueOnce(conflict),
        findUnique,
        update,
      },
    } as any;

    const cycle = await ensureCycle(prisma, {
      userId: "user-1",
      cycleType: "DAY",
      cycleStartDate,
      cycleEndDate: cycleStartDate,
    });

    expect(cycle.id).toBe("cycle-1");
    expect(findUnique).toHaveBeenCalledOnce();
    expect(update).not.toHaveBeenCalled();
  });

  it("builds weekly momentum for finalized scores", async () => {
    const dailyScoreFindMany = vi.fn().mockResolvedValue([
      {
        scoreValue: 82,
        planningCycle: { cycleStartDate: new Date("2026-03-12T00:00:00.000Z"), cycleEndDate: new Date("2026-03-12T00:00:00.000Z") },
      },
      {
        scoreValue: 76,
        planningCycle: { cycleStartDate: new Date("2026-03-13T00:00:00.000Z"), cycleEndDate: new Date("2026-03-13T00:00:00.000Z") },
      },
      {
        scoreValue: 64,
        planningCycle: { cycleStartDate: new Date("2026-03-14T00:00:00.000Z"), cycleEndDate: new Date("2026-03-14T00:00:00.000Z") },
      },
    ]);
    const weeklyReviewFindFirst = vi.fn().mockResolvedValue(null);
    const prisma = {
      dailyScore: {
        findMany: dailyScoreFindMany,
      },
      weeklyReview: {
        findFirst: weeklyReviewFindFirst,
      },
      user: {},
    } as any;
  prisma.dailyScore.findMany
      .mockResolvedValueOnce([
        {
          scoreValue: 82,
          planningCycle: { cycleStartDate: new Date("2026-03-12T00:00:00.000Z"), cycleEndDate: new Date("2026-03-12T00:00:00.000Z") },
        },
        {
          scoreValue: 76,
          planningCycle: { cycleStartDate: new Date("2026-03-13T00:00:00.000Z"), cycleEndDate: new Date("2026-03-13T00:00:00.000Z") },
        },
      ]);
    // The second call used for strongDayStreak should be able to iterate over all recent scores.
    prisma.dailyScore.findMany.mockResolvedValueOnce([
      {
        scoreValue: 90,
        planningCycle: { cycleStartDate: new Date("2026-03-14T00:00:00.000Z"), cycleEndDate: new Date("2026-03-14T00:00:00.000Z") },
      },
      {
        scoreValue: 86,
        planningCycle: { cycleStartDate: new Date("2026-03-13T00:00:00.000Z"), cycleEndDate: new Date("2026-03-13T00:00:00.000Z") },
      },
      {
        scoreValue: 64,
        planningCycle: { cycleStartDate: new Date("2026-03-12T00:00:00.000Z"), cycleEndDate: new Date("2026-03-12T00:00:00.000Z") },
      },
    ]);

    const momentum = await getWeeklyMomentum(prisma, "user-1", new Date("2026-03-14T00:00:00.000Z"));

    expect(momentum.value).toBe(79);
    expect(momentum.strongDayStreak).toBe(2);
  });

  it("builds score history summaries from finalized days in the requested window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T08:00:00.000Z"));

    try {
      const prisma = {
        userPreference: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
        dailyScore: {
          findMany: vi.fn().mockResolvedValue([
            {
              scoreValue: 77,
              scoreBand: "Solid Day",
              planningCycle: { cycleStartDate: new Date("2026-03-03T00:00:00.000Z") },
            },
            {
              scoreValue: 69,
              scoreBand: "Recovering Day",
              planningCycle: { cycleStartDate: new Date("2026-03-05T00:00:00.000Z") },
            },
            {
              scoreValue: 71,
              scoreBand: "Solid Day",
              planningCycle: { cycleStartDate: new Date("2026-03-08T00:00:00.000Z") },
            },
            {
              scoreValue: 86,
              scoreBand: "Strong Day",
              planningCycle: { cycleStartDate: new Date("2026-03-10T00:00:00.000Z") },
            },
            {
              scoreValue: 62,
              scoreBand: "Recovering Day",
              planningCycle: { cycleStartDate: new Date("2026-03-12T00:00:00.000Z") },
            },
            {
              scoreValue: 74,
              scoreBand: "Solid Day",
              planningCycle: { cycleStartDate: new Date("2026-03-13T00:00:00.000Z") },
            },
            {
              scoreValue: 88,
              scoreBand: "Strong Day",
              planningCycle: { cycleStartDate: new Date("2026-03-14T00:00:00.000Z") },
            },
          ]),
        },
      } as any;

      const history = await getScoreHistory(prisma, "user-1", new Date("2026-03-14T00:00:00.000Z"), 14);

      expect(history.entries).toHaveLength(14);
      expect(history.summary).toMatchObject({
        consistencyRun: 2,
        solidPlusDays: 5,
        strongDays: 2,
        current7DayAverage: 76,
        previous7DayAverage: 73,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns zero score with zero-activity day context", async () => {
    const prisma = {
      planningCycle: {
        upsert: vi
          .fn()
          .mockResolvedValueOnce({
            id: "day",
            priorities: [],
            dailyScore: null,
          })
          .mockResolvedValueOnce({
            id: "tomorrow",
            priorities: [],
            dailyScore: null,
          })
          .mockResolvedValueOnce({
            id: "week",
            priorities: [],
          })
          .mockResolvedValueOnce({
            id: "month",
            priorities: [],
          })
          .mockResolvedValueOnce({
            id: "next-month",
            priorities: [],
          }),
      },
      task: { findMany: vi.fn().mockResolvedValue([]) },
      habit: { findMany: vi.fn().mockResolvedValue([]) },
      habitCheckin: { findMany: vi.fn().mockResolvedValue([]) },
      routine: { findMany: vi.fn().mockResolvedValue([]) },
      routineItemCheckin: { findMany: vi.fn().mockResolvedValue([]) },
      waterLog: { findMany: vi.fn().mockResolvedValue([]) },
      mealLog: { findMany: vi.fn().mockResolvedValue([]) },
      workoutDay: { findUnique: vi.fn().mockResolvedValue(null) },
      expense: { findMany: vi.fn().mockResolvedValue([]) },
      adminItem: { findMany: vi.fn().mockResolvedValue([]) },
      userPreference: { findUnique: vi.fn().mockResolvedValue(null) },
    } as any;

    const score = await calculateDailyScore(prisma, "user-1", new Date("2026-03-14T00:00:00.000Z"));

    expect(score.value).toBe(0);
    expect(score.label).toBe("Off-Track Day");
    expect(score.buckets).toHaveLength(3);
    expect(score.topReasons).toHaveLength(3);
  });

  it("scores only due habits and splits routine points across all active routines", async () => {
    const prisma = {
      planningCycle: {
        upsert: vi
          .fn()
          .mockResolvedValueOnce({
            id: "day",
            priorities: [],
            dailyReview: null,
            dailyScore: null,
          })
          .mockResolvedValueOnce({
            id: "tomorrow",
            priorities: [],
            dailyReview: null,
            dailyScore: null,
          })
          .mockResolvedValueOnce({
            id: "week",
            priorities: [],
          })
          .mockResolvedValueOnce({
            id: "month",
            priorities: [],
          })
          .mockResolvedValueOnce({
            id: "next-month",
            priorities: [],
          }),
      },
      userPreference: {
        findUnique: vi.fn().mockResolvedValue({
          timezone: "UTC",
          weekStartsOn: 1,
          dailyWaterTargetMl: 2500,
        }),
      },
      task: { findMany: vi.fn().mockResolvedValue([]) },
      habit: {
        findMany: vi.fn().mockResolvedValue([
          { id: "habit-due", scheduleRuleJson: { daysOfWeek: [6] }, status: "ACTIVE", archivedAt: null, targetPerDay: 1 },
          { id: "habit-not-due", scheduleRuleJson: { daysOfWeek: [1] }, status: "ACTIVE", archivedAt: null, targetPerDay: 1 },
        ]),
      },
      habitCheckin: {
        findMany: vi.fn().mockResolvedValue([
          { habitId: "habit-due", occurredOn: new Date("2026-03-14T00:00:00.000Z"), status: "COMPLETED" },
        ]),
      },
      routine: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "routine-1",
            sortOrder: 0,
            items: [{ id: "item-1", isRequired: true }, { id: "item-2", isRequired: true }],
          },
          {
            id: "routine-2",
            sortOrder: 1,
            items: [{ id: "item-3", isRequired: true }, { id: "item-4", isRequired: true }],
          },
        ]),
      },
      routineItemCheckin: {
        findMany: vi.fn().mockResolvedValue([
          { routineItemId: "item-1", occurredOn: new Date("2026-03-14T00:00:00.000Z") },
          { routineItemId: "item-3", occurredOn: new Date("2026-03-14T00:00:00.000Z") },
        ]),
      },
      waterLog: { findMany: vi.fn().mockResolvedValue([]) },
      mealLog: { findMany: vi.fn().mockResolvedValue([]) },
      workoutDay: { findUnique: vi.fn().mockResolvedValue(null) },
      expense: { findMany: vi.fn().mockResolvedValue([]) },
      adminItem: { findMany: vi.fn().mockResolvedValue([]) },
    } as any;

    const score = await calculateDailyScore(prisma, "user-1", new Date("2026-03-14T00:00:00.000Z"));
    const routinesBucket = score.buckets.find((bucket) => bucket.key === "routines_and_habits");

    expect(routinesBucket).toMatchObject({
      earnedPoints: 16,
      applicablePoints: 20,
    });
  });

  it("awards punctuality points for timed habits and routines completed on time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-14T20:00:00.000Z"));

    try {
      const prisma = {
        planningCycle: {
          upsert: vi
            .fn()
            .mockResolvedValueOnce({
              id: "day",
              priorities: [],
              dailyReview: null,
              dailyScore: null,
            })
            .mockResolvedValueOnce({
              id: "tomorrow",
              priorities: [],
              dailyReview: null,
              dailyScore: null,
            })
            .mockResolvedValueOnce({
              id: "week",
              priorities: [],
            })
            .mockResolvedValueOnce({
              id: "month",
              priorities: [],
            })
            .mockResolvedValueOnce({
              id: "next-month",
              priorities: [],
            }),
        },
        userPreference: {
          findUnique: vi.fn().mockResolvedValue({
            timezone: "UTC",
            weekStartsOn: 1,
            dailyWaterTargetMl: 2500,
          }),
        },
        task: { findMany: vi.fn().mockResolvedValue([]) },
        dailyLaunch: { findUnique: vi.fn().mockResolvedValue(null) },
        habit: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "habit-timed",
              timingMode: "EXACT_TIME",
              targetTimeMinutes: 540,
              windowStartMinutes: null,
              windowEndMinutes: null,
              scheduleRuleJson: { daysOfWeek: [6] },
              status: "ACTIVE",
              archivedAt: null,
              targetPerDay: 1,
            },
          ]),
        },
        habitCheckin: {
          findMany: vi.fn().mockResolvedValue([
            {
              habitId: "habit-timed",
              occurredOn: new Date("2026-03-14T00:00:00.000Z"),
              status: "COMPLETED",
              completedAt: new Date("2026-03-14T09:30:00.000Z"),
            },
          ]),
        },
        routine: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "routine-morning",
              timingMode: "PERIOD",
              period: "MORNING",
              windowStartMinutes: null,
              windowEndMinutes: null,
              sortOrder: 0,
              items: [{ id: "item-1", isRequired: true }],
            },
          ]),
        },
        routineItemCheckin: {
          findMany: vi.fn().mockResolvedValue([
            {
              routineItemId: "item-1",
              occurredOn: new Date("2026-03-14T00:00:00.000Z"),
              completedAt: new Date("2026-03-14T11:00:00.000Z"),
            },
          ]),
        },
        waterLog: { findMany: vi.fn().mockResolvedValue([]) },
        mealLog: { findMany: vi.fn().mockResolvedValue([]) },
        workoutDay: { findUnique: vi.fn().mockResolvedValue(null) },
        expense: { findMany: vi.fn().mockResolvedValue([]) },
        adminItem: { findMany: vi.fn().mockResolvedValue([]) },
      } as any;

      const score = await calculateDailyScore(prisma, "user-1", new Date("2026-03-14T00:00:00.000Z"));
      const routinesBucket = score.buckets.find((bucket) => bucket.key === "routines_and_habits");

      expect(routinesBucket).toMatchObject({
        earnedPoints: 25,
        applicablePoints: 25,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not award full meal points when today's intended meal target is not met", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-14T20:00:00.000Z"));

    try {
      const prisma = {
        planningCycle: {
          upsert: vi
            .fn()
            .mockResolvedValueOnce({
              id: "day",
              priorities: [],
              dailyReview: null,
              dailyScore: null,
            })
            .mockResolvedValueOnce({
              id: "tomorrow",
              priorities: [],
              dailyReview: null,
              dailyScore: null,
            })
            .mockResolvedValueOnce({
              id: "week",
              priorities: [],
            })
            .mockResolvedValueOnce({
              id: "month",
              priorities: [],
            })
            .mockResolvedValueOnce({
              id: "next-month",
              priorities: [],
            }),
        },
        userPreference: {
          findUnique: vi.fn().mockResolvedValue({
            timezone: "UTC",
            weekStartsOn: 1,
            dailyWaterTargetMl: 2500,
          }),
        },
        task: { findMany: vi.fn().mockResolvedValue([]) },
        habit: { findMany: vi.fn().mockResolvedValue([]) },
        habitCheckin: { findMany: vi.fn().mockResolvedValue([]) },
        routine: { findMany: vi.fn().mockResolvedValue([]) },
        routineItemCheckin: { findMany: vi.fn().mockResolvedValue([]) },
        waterLog: {
          findMany: vi.fn().mockResolvedValue([{ amountMl: 2500 }]),
        },
        mealLog: {
          findMany: vi.fn().mockResolvedValue([
            { loggingQuality: "MEANINGFUL" },
            { loggingQuality: "MEANINGFUL" },
          ]),
        },
        workoutDay: { findUnique: vi.fn().mockResolvedValue(null) },
        expense: { findMany: vi.fn().mockResolvedValue([]) },
        adminItem: { findMany: vi.fn().mockResolvedValue([]) },
      } as any;

      const score = await calculateDailyScore(prisma, "user-1", new Date("2026-03-14T00:00:00.000Z"));
      const healthBucket = score.buckets.find((bucket) => bucket.key === "health_basics");

      expect(healthBucket).toMatchObject({
        earnedPoints: 12,
        applicablePoints: 15,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("awards partial habit score for multi-per-day habits until the target is met", async () => {
    const prisma = {
      planningCycle: {
        upsert: vi
          .fn()
          .mockResolvedValueOnce({ id: "day", priorities: [], dailyReview: null, dailyScore: null })
          .mockResolvedValueOnce({ id: "tomorrow", priorities: [], dailyReview: null, dailyScore: null })
          .mockResolvedValueOnce({ id: "week", priorities: [] })
          .mockResolvedValueOnce({ id: "month", priorities: [] })
          .mockResolvedValueOnce({ id: "next-month", priorities: [] }),
      },
      userPreference: {
        findUnique: vi.fn().mockResolvedValue({ timezone: "UTC", weekStartsOn: 1, dailyWaterTargetMl: 2500 }),
      },
      task: { findMany: vi.fn().mockResolvedValue([]) },
      habit: {
        findMany: vi.fn().mockResolvedValue([
          { id: "habit-due", scheduleRuleJson: { daysOfWeek: [6] }, status: "ACTIVE", archivedAt: null, targetPerDay: 2 },
        ]),
      },
      habitCheckin: {
        findMany: vi.fn().mockResolvedValue([
          { habitId: "habit-due", occurredOn: new Date("2026-03-14T00:00:00.000Z"), status: "COMPLETED", completionCount: 1 },
        ]),
      },
      routine: { findMany: vi.fn().mockResolvedValue([]) },
      routineItemCheckin: { findMany: vi.fn().mockResolvedValue([]) },
      waterLog: { findMany: vi.fn().mockResolvedValue([]) },
      mealLog: { findMany: vi.fn().mockResolvedValue([]) },
      workoutDay: { findUnique: vi.fn().mockResolvedValue(null) },
      expense: { findMany: vi.fn().mockResolvedValue([]) },
      adminItem: { findMany: vi.fn().mockResolvedValue([]) },
    } as any;

    const score = await calculateDailyScore(prisma, "user-1", new Date("2026-03-14T00:00:00.000Z"));
    const routinesBucket = score.buckets.find((bucket) => bucket.key === "routines_and_habits");

    expect(routinesBucket).toMatchObject({
      earnedPoints: 6,
      applicablePoints: 12,
    });
  });
});
