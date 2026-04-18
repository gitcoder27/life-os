import { describe, expect, it } from "vitest";

import {
  computeWeeklyCapacityAssessment,
  computeWeeklyCapacityProgress,
  resolveWeeklyCapacityProfile,
} from "../../../src/modules/planning/weekly-capacity.js";

describe("weekly capacity assessment", () => {
  it("resolves legacy null profile values to standard defaults", () => {
    expect(
      resolveWeeklyCapacityProfile({
        weeklyCapacityMode: null,
        weeklyDeepWorkBlockTarget: null,
      }),
    ).toEqual({
      capacityMode: "standard",
      deepWorkBlockTarget: 4,
    });
  });

  it.each([
    {
      mode: "light" as const,
      deepWorkBlockTarget: 2,
      priorities: [{ goalId: "goal-1" }, { goalId: "goal-2" }],
      tasks: [{ goalId: "goal-1", estimatedDurationMinutes: 120 }],
    },
    {
      mode: "standard" as const,
      deepWorkBlockTarget: 4,
      priorities: [{ goalId: "goal-1" }, { goalId: "goal-2" }, { goalId: "goal-3" }],
      tasks: [
        { goalId: "goal-1", estimatedDurationMinutes: 180 },
        { goalId: "goal-2", estimatedDurationMinutes: 240 },
      ],
    },
    {
      mode: "heavy" as const,
      deepWorkBlockTarget: 6,
      priorities: [{ goalId: "goal-1" }, { goalId: "goal-2" }, { goalId: "goal-3" }],
      tasks: [
        { goalId: "goal-1", estimatedDurationMinutes: 240 },
        { goalId: "goal-2", estimatedDurationMinutes: 240 },
        { goalId: "goal-3", estimatedDurationMinutes: 120 },
      ],
    },
  ])("returns healthy for a believable $mode week", ({ mode, deepWorkBlockTarget, priorities, tasks }) => {
    const result = computeWeeklyCapacityAssessment({
      capacityProfile: {
        capacityMode: mode,
        deepWorkBlockTarget,
      },
      priorities,
      tasks,
    });

    expect(result.status).toBe("healthy");
    expect(result.signals).toEqual([]);
  });

  it("returns tight when load exceeds healthy thresholds without crossing overloaded thresholds", () => {
    const result = computeWeeklyCapacityAssessment({
      capacityProfile: {
        capacityMode: "standard",
        deepWorkBlockTarget: 4,
      },
      priorities: [{ goalId: "goal-1" }, { goalId: "goal-2" }, { goalId: "goal-3" }],
      tasks: [
        { goalId: "goal-1", estimatedDurationMinutes: 300 },
        { goalId: "goal-2", estimatedDurationMinutes: 250 },
      ],
    });

    expect(result.status).toBe("tight");
    expect(result.signals).toEqual(["too_many_estimated_minutes"]);
    expect(result.primaryMessage).toContain("getting tight");
  });

  it("returns overloaded with signals in precedence order", () => {
    const result = computeWeeklyCapacityAssessment({
      capacityProfile: {
        capacityMode: "standard",
        deepWorkBlockTarget: 9,
      },
      priorities: [
        { goalId: "goal-1" },
        { goalId: "goal-2" },
        { goalId: "goal-3" },
        { goalId: "goal-4" },
      ],
      tasks: [
        { goalId: "goal-1", estimatedDurationMinutes: 500 },
        { goalId: "goal-2", estimatedDurationMinutes: 300 },
        { goalId: "goal-3", estimatedDurationMinutes: null },
        { goalId: "goal-4", estimatedDurationMinutes: null },
        { goalId: "goal-5", estimatedDurationMinutes: null },
        { goalId: "goal-6", estimatedDurationMinutes: null },
        { goalId: "goal-7", estimatedDurationMinutes: null },
        { goalId: "goal-8", estimatedDurationMinutes: null },
        { goalId: "goal-9", estimatedDurationMinutes: null },
      ],
    });

    expect(result.status).toBe("overloaded");
    expect(result.signals).toEqual([
      "too_many_priorities",
      "too_many_estimated_minutes",
      "too_many_unsized_tasks",
      "too_many_focus_goals",
      "deep_work_target_too_high",
    ]);
    expect(result.primaryMessage).toContain("trimming a weekly priority");
  });

  it("counts unique focus goals across priorities and tasks", () => {
    const result = computeWeeklyCapacityAssessment({
      capacityProfile: {
        capacityMode: "standard",
        deepWorkBlockTarget: 4,
      },
      priorities: [{ goalId: "goal-1" }, { goalId: "goal-2" }],
      tasks: [
        { goalId: "goal-1", estimatedDurationMinutes: 60 },
        { goalId: "goal-2", estimatedDurationMinutes: 60 },
        { goalId: "goal-3", estimatedDurationMinutes: 60 },
        { goalId: null, estimatedDurationMinutes: 60 },
      ],
    });

    expect(result.focusGoalCount).toBe(3);
  });

  it("computes remaining deep-work budget while within range", () => {
    expect(
      computeWeeklyCapacityProgress({
        capacityProfile: {
          capacityMode: "standard",
          deepWorkBlockTarget: 4,
        },
        completedDeepBlocks: 2,
      }),
    ).toEqual({
      completedDeepBlocks: 2,
      remainingDeepBlocks: 2,
      overBudgetBlocks: 0,
      status: "within_budget",
      message: "2 deep-work blocks remaining this week.",
    });
  });

  it("marks budget reached when completed deep work matches plan", () => {
    expect(
      computeWeeklyCapacityProgress({
        capacityProfile: {
          capacityMode: "light",
          deepWorkBlockTarget: 2,
        },
        completedDeepBlocks: 2,
      }).status,
    ).toBe("at_budget");
  });

  it("marks over-budget when completed deep work exceeds the plan", () => {
    expect(
      computeWeeklyCapacityProgress({
        capacityProfile: {
          capacityMode: "heavy",
          deepWorkBlockTarget: 6,
        },
        completedDeepBlocks: 8,
      }),
    ).toEqual({
      completedDeepBlocks: 8,
      remainingDeepBlocks: 0,
      overBudgetBlocks: 2,
      status: "over_budget",
      message: "2 deep-work blocks over budget this week.",
    });
  });
});
