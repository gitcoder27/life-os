import { afterEach, describe, expect, it, vi } from "vitest";

import {
  detectFrictionTag,
  evaluateTomorrowAdjustmentRequirement,
  fillThreePriorityDraft,
  formatClosedWindowStatus,
  formatCount,
  formatDraftStatus,
  formatTomorrowAdjustmentLabel,
  getTomorrowDate,
  hasMeaningfulDailyDraft,
  hasMeaningfulPromptResponses,
  normalizePromptResponses,
  parseEnergyRating,
} from "./reviewDraftModel";

afterEach(() => {
  vi.useRealTimers();
});

describe("review draft model", () => {
  it("normalizes review inputs and friction signals", () => {
    expect(detectFrictionTag("Too many interruptions")).toBe("interruptions");
    expect(detectFrictionTag("I overcommitted")).toBe("overcommitment");
    expect(detectFrictionTag("No idea what mattered")).toBe("poor planning");
    expect(parseEnergyRating("Energy 9")).toBe(5);
    expect(parseEnergyRating("0")).toBe(1);
    expect(parseEnergyRating("none")).toBe(3);
    expect(formatTomorrowAdjustmentLabel("rescue")).toBe("Rescue Mode");
    expect(formatTomorrowAdjustmentLabel(null)).toBe("No change");
  });

  it("requires tomorrow adjustment for low energy or risky friction", () => {
    const baseRecommendation = {
      required: false,
      suggestedAdjustment: "keep_standard" as const,
      reason: null,
      detail: "Standard day is fine.",
    };

    expect(evaluateTomorrowAdjustmentRequirement({
      recommendation: baseRecommendation,
      energyRating: 2,
    })).toMatchObject({
      required: true,
      suggestedAdjustment: "rescue",
      reason: "low_energy",
    });
    expect(evaluateTomorrowAdjustmentRequirement({
      recommendation: baseRecommendation,
      energyRating: 4,
      frictionTag: "overcommitment",
    })).toMatchObject({
      required: true,
      reason: "overcommitment",
    });
    expect(evaluateTomorrowAdjustmentRequirement({
      recommendation: {
        ...baseRecommendation,
        required: true,
        suggestedAdjustment: "recovery",
        reason: "missed_day_pattern" as const,
      },
      energyRating: 5,
    })).toMatchObject({
      required: true,
      suggestedAdjustment: "recovery",
      reason: "missed_day_pattern",
    });
  });

  it("detects meaningful drafts and normalizes prompt arrays", () => {
    expect(fillThreePriorityDraft([{ title: "A" }])).toEqual([{ title: "A" }, { title: "" }]);
    expect(normalizePromptResponses(["A"], 3)).toEqual(["A", "", ""]);
    expect(hasMeaningfulPromptResponses(["", "  "])).toBe(false);
    expect(hasMeaningfulPromptResponses(["", "Done"])).toBe(true);
    expect(hasMeaningfulDailyDraft({
      dailyInputs: {
        biggestWin: "",
        frictionNote: "",
        energyRating: "3",
        optionalNote: "",
        tomorrowAdjustment: "",
      },
      dailyTaskDecisions: {},
      dailyTomorrowPriorities: [],
    })).toBe(false);
    expect(hasMeaningfulDailyDraft({
      dailyInputs: {
        biggestWin: "Shipped",
        frictionNote: "",
        energyRating: "3",
        optionalNote: "",
        tomorrowAdjustment: "",
      },
      dailyTaskDecisions: {},
      dailyTomorrowPriorities: [],
    })).toBe(true);
    expect(getTomorrowDate("2026-05-03")).toBe("2026-05-04");
  });

  it("formats draft and closed-window status messages", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-03T12:00:00.000Z"));

    expect(formatDraftStatus(null)).toBe("Draft autosaves on this device as you type.");
    expect(formatDraftStatus("2026-05-03T12:00:00.000Z")).toContain("Draft autosaves on this device. Last saved");
    expect(formatClosedWindowStatus(null)).toBe("Submission is currently disabled - the review window is not open.");
    expect(formatClosedWindowStatus({
      status: "too_early",
      isOpen: false,
      headline: "Too early",
      description: "Not open",
      opensAtLocal: "Sun, May 3, 7:00 PM",
      closesAtLocal: "Mon, May 4, 9:00 AM",
      timezone: "UTC",
      allowedDate: "2026-05-03",
      tagLabel: "Too early",
      tagVariant: "warning",
    })).toBe("Submission is currently disabled - the next review window opens Sun, May 3, 7:00 PM and closes Mon, May 4, 9:00 AM (UTC).");
    expect(formatCount(1, "task", "tasks")).toBe("1 task");
    expect(formatCount(2, "task", "tasks")).toBe("2 tasks");
  });
});
