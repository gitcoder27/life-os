import { describe, expect, it } from "vitest";

import {
  buildHabitTimingLabel,
  buildRoutineTimingLabel,
  getHabitTimingStatusToday,
  getRoutineTimingStatusToday,
} from "../../../src/lib/habits/timing.js";

describe("habit and routine timing", () => {
  it("labels exact-time and windowed habits", () => {
    expect(buildHabitTimingLabel({
      timingMode: "exact_time",
      targetTimeMinutes: 540,
    })).toBe("9:00 AM");

    expect(buildHabitTimingLabel({
      timingMode: "time_window",
      windowStartMinutes: 420,
      windowEndMinutes: 510,
    })).toBe("7:00 AM - 8:30 AM");
  });

  it("marks exact-time habits as due now, late, on time, or done late", () => {
    expect(getHabitTimingStatusToday({
      timingMode: "exact_time",
      targetPerDay: 1,
      completedAt: null,
      now: new Date("2026-03-14T09:05:00.000Z"),
      targetIsoDate: "2026-03-14",
      timezone: "UTC",
      targetTimeMinutes: 540,
    })).toBe("due_now");

    expect(getHabitTimingStatusToday({
      timingMode: "exact_time",
      targetPerDay: 1,
      completedAt: null,
      now: new Date("2026-03-14T10:45:00.000Z"),
      targetIsoDate: "2026-03-14",
      timezone: "UTC",
      targetTimeMinutes: 540,
    })).toBe("late");

    expect(getHabitTimingStatusToday({
      timingMode: "exact_time",
      targetPerDay: 1,
      completedAt: new Date("2026-03-14T09:30:00.000Z"),
      now: new Date("2026-03-14T12:00:00.000Z"),
      targetIsoDate: "2026-03-14",
      timezone: "UTC",
      targetTimeMinutes: 540,
    })).toBe("complete_on_time");

    expect(getHabitTimingStatusToday({
      timingMode: "exact_time",
      targetPerDay: 1,
      completedAt: new Date("2026-03-14T10:50:00.000Z"),
      now: new Date("2026-03-14T12:00:00.000Z"),
      targetIsoDate: "2026-03-14",
      timezone: "UTC",
      targetTimeMinutes: 540,
    })).toBe("complete_late");
  });

  it("labels and evaluates period-based routines", () => {
    expect(buildRoutineTimingLabel({
      timingMode: "period",
      period: "morning",
    })).toBe("Morning");

    expect(getRoutineTimingStatusToday({
      timingMode: "period",
      period: "morning",
      completedAt: null,
      now: new Date("2026-03-14T07:30:00.000Z"),
      targetIsoDate: "2026-03-14",
      timezone: "UTC",
    })).toBe("due_now");

    expect(getRoutineTimingStatusToday({
      timingMode: "period",
      period: "morning",
      completedAt: new Date("2026-03-14T11:00:00.000Z"),
      now: new Date("2026-03-14T20:00:00.000Z"),
      targetIsoDate: "2026-03-14",
      timezone: "UTC",
    })).toBe("complete_on_time");
  });
});
