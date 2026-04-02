import { describe, expect, it } from "vitest";

import { buildHealthSummaryEnhancements } from "../../src/modules/health/summary-builder.js";

describe("health summary builder", () => {
  it("builds coaching signals, recommendations, and a unified timeline", () => {
    const summary = buildHealthSummaryEnhancements({
      currentIsoDate: "2026-04-02",
      currentHour: 15,
      timezone: "UTC",
      waterTargetMl: 2500,
      currentDayWaterMl: 700,
      currentDayWaterLogs: [
        {
          id: "water-1",
          occurredAt: "2026-04-02T09:00:00.000Z",
          amountMl: 300,
          source: "quick_capture",
          createdAt: "2026-04-02T09:00:00.000Z",
        },
        {
          id: "water-2",
          occurredAt: "2026-04-02T12:30:00.000Z",
          amountMl: 400,
          source: "tap",
          createdAt: "2026-04-02T12:30:00.000Z",
        },
      ],
      currentDayMealLogs: [
        {
          id: "meal-1",
          occurredAt: "2026-04-02T13:00:00.000Z",
          mealSlot: "lunch",
          mealTemplateId: null,
          description: "Rice bowl",
          loggingQuality: "meaningful",
          createdAt: "2026-04-02T13:00:00.000Z",
        },
      ],
      currentWorkout: {
        id: "workout-1",
        date: "2026-04-02",
        planType: "workout",
        plannedLabel: "Strength session",
        actualStatus: "none",
        note: null,
        updatedAt: "2026-04-02T07:00:00.000Z",
      },
      latestWeight: {
        id: "weight-1",
        measuredOn: "2026-04-02",
        weightValue: 81.4,
        unit: "kg",
        note: null,
        createdAt: "2026-04-02T06:45:00.000Z",
      },
      rangeWaterLogs: [
        {
          id: "water-range-1",
          occurredAt: "2026-03-31T09:00:00.000Z",
          amountMl: 2600,
          source: "tap",
          createdAt: "2026-03-31T09:00:00.000Z",
        },
        {
          id: "water-range-2",
          occurredAt: "2026-04-01T09:00:00.000Z",
          amountMl: 1200,
          source: "tap",
          createdAt: "2026-04-01T09:00:00.000Z",
        },
        {
          id: "water-range-3",
          occurredAt: "2026-04-02T09:00:00.000Z",
          amountMl: 700,
          source: "tap",
          createdAt: "2026-04-02T09:00:00.000Z",
        },
      ],
      rangeMealLogs: [
        {
          id: "range-meal-1",
          occurredAt: "2026-03-31T08:00:00.000Z",
          mealSlot: "breakfast",
          mealTemplateId: null,
          description: "Oats",
          loggingQuality: "full",
          createdAt: "2026-03-31T08:00:00.000Z",
        },
        {
          id: "range-meal-2",
          occurredAt: "2026-04-02T13:00:00.000Z",
          mealSlot: "lunch",
          mealTemplateId: null,
          description: "Rice bowl",
          loggingQuality: "meaningful",
          createdAt: "2026-04-02T13:00:00.000Z",
        },
      ],
      rangeWorkoutDays: [
        {
          id: "workout-a",
          date: "2026-03-31",
          planType: "workout",
          plannedLabel: "Push day",
          actualStatus: "completed",
          note: null,
          updatedAt: "2026-03-31T07:00:00.000Z",
        },
        {
          id: "workout-b",
          date: "2026-04-01",
          planType: "workout",
          plannedLabel: "Leg day",
          actualStatus: "missed",
          note: null,
          updatedAt: "2026-04-01T07:00:00.000Z",
        },
      ],
      rangeWeightHistory: [
        {
          id: "weight-1",
          measuredOn: "2026-04-02",
          weightValue: 81.4,
          unit: "kg",
          note: null,
          createdAt: "2026-04-02T06:45:00.000Z",
        },
        {
          id: "weight-0",
          measuredOn: "2026-03-28",
          weightValue: 82.2,
          unit: "kg",
          note: null,
          createdAt: "2026-03-28T06:45:00.000Z",
        },
      ],
    });

    expect(summary.currentDay.phase).toBe("midday");
    expect(summary.currentDay.signals.water.status).toBe("behind");
    expect(summary.currentDay.signals.meals.status).toBe("behind");
    expect(summary.currentDay.score.label).toBe("needs_attention");
    expect(summary.currentDay.timeline.map((item) => item.kind)).toEqual([
      "meal",
      "water",
      "water",
      "workout",
      "weight",
    ]);
    expect(summary.guidance.focus).toMatchObject({
      kind: "water",
      intent: "log_water",
    });
    expect(summary.guidance.recommendations).toHaveLength(2);
    expect(summary.range.insights).toMatchObject({
      waterDaysOnTarget: 1,
      mealLoggingDays: 2,
      meaningfulMealDays: 2,
      workoutsMissed: 1,
      workoutCompletionRate: 50,
      weightChange: -0.8,
      weightUnit: "kg",
    });
  });

  it("returns a positive focus when the day is steady", () => {
    const summary = buildHealthSummaryEnhancements({
      currentIsoDate: "2026-04-02",
      currentHour: 20,
      timezone: "UTC",
      waterTargetMl: 2500,
      currentDayWaterMl: 2600,
      currentDayWaterLogs: [],
      currentDayMealLogs: [
        {
          id: "meal-1",
          occurredAt: "2026-04-02T08:00:00.000Z",
          mealSlot: "breakfast",
          mealTemplateId: null,
          description: "Eggs",
          loggingQuality: "full",
          createdAt: "2026-04-02T08:00:00.000Z",
        },
        {
          id: "meal-2",
          occurredAt: "2026-04-02T13:00:00.000Z",
          mealSlot: "lunch",
          mealTemplateId: null,
          description: "Bowl",
          loggingQuality: "meaningful",
          createdAt: "2026-04-02T13:00:00.000Z",
        },
        {
          id: "meal-3",
          occurredAt: "2026-04-02T19:00:00.000Z",
          mealSlot: "dinner",
          mealTemplateId: null,
          description: "Dinner",
          loggingQuality: "meaningful",
          createdAt: "2026-04-02T19:00:00.000Z",
        },
      ],
      currentWorkout: {
        id: "workout-1",
        date: "2026-04-02",
        planType: "workout",
        plannedLabel: "Run",
        actualStatus: "completed",
        note: null,
        updatedAt: "2026-04-02T18:00:00.000Z",
      },
      latestWeight: null,
      rangeWaterLogs: [],
      rangeMealLogs: [],
      rangeWorkoutDays: [],
      rangeWeightHistory: [],
    });

    expect(summary.guidance.focus.tone).toBe("positive");
    expect(summary.guidance.focus.title).toBe("Health basics are steady");
  });
});
