import { afterEach, describe, expect, it, vi } from "vitest";

import {
  daysUntil,
  formatDueLabel,
  formatRelativeDate,
  getMonthEndDate,
  getMonthStartDate,
  getPreferenceAwareWeekStartDate,
  getReminderDate,
  getTodayDate,
  getWeekEndDate,
  getWeekStartDate,
  setPreferredTimezone,
  setPreferredWeekStart,
  toIsoDate,
} from "./date";

afterEach(() => {
  vi.useRealTimers();
  setPreferredTimezone("");
  setPreferredWeekStart(1);
});

describe("date helpers", () => {
  it("formats local dates without UTC date drift", () => {
    expect(toIsoDate(new Date(2026, 4, 3, 23, 30))).toBe("2026-05-03");
    expect(getMonthStartDate("2024-02-29")).toBe("2024-02-01");
    expect(getMonthEndDate("2024-02-10")).toBe("2024-02-29");
  });

  it("uses the preferred week start for week boundaries", () => {
    setPreferredWeekStart(1);
    expect(getWeekStartDate("2026-05-03")).toBe("2026-04-27");
    expect(getWeekEndDate("2026-05-03")).toBe("2026-05-03");

    setPreferredWeekStart(0);
    expect(getPreferenceAwareWeekStartDate("2026-05-03")).toBe("2026-05-03");
    expect(getWeekEndDate("2026-05-03")).toBe("2026-05-09");
  });

  it("computes relative labels against the preferred timezone date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-03T23:30:00.000Z"));
    setPreferredTimezone("UTC");

    expect(getTodayDate()).toBe("2026-05-03");
    expect(daysUntil("2026-05-05")).toBe(2);
    expect(formatDueLabel("2026-05-02")).toBe("overdue");
    expect(formatDueLabel("2026-05-03")).toBe("today");
    expect(formatDueLabel("2026-05-04")).toBe("1 day");
    expect(formatRelativeDate("2026-05-02")).toBe("Yesterday");
    expect(formatRelativeDate("2026-05-03")).toBe("Today");
  });

  it("derives reminder dates in the selected timezone", () => {
    setPreferredTimezone("Asia/Kolkata");

    expect(getReminderDate("2026-05-03T22:00:00.000Z")).toBe("2026-05-04");

    setPreferredTimezone("UTC");
    expect(getReminderDate("2026-05-03T22:00:00.000Z")).toBe("2026-05-03");
  });
});
