import { describe, expect, it } from "vitest";

import { buildDayGroups, dayPartForMinutes, findNextUpId, formatClock } from "./dayGroups";
import { habit, routine } from "./test-fixtures";

describe("habit day groups", () => {
  it("splits the day at noon and 5 PM", () => {
    expect(dayPartForMinutes(null)).toBe("anytime");
    expect(dayPartForMinutes(11 * 60 + 59)).toBe("morning");
    expect(dayPartForMinutes(12 * 60)).toBe("afternoon");
    expect(dayPartForMinutes(17 * 60)).toBe("evening");
  });

  it("groups habits and routines by time of day in time order", () => {
    const groups = buildDayGroups(
      [
        habit({ id: "read", title: "Read", timingMode: "exact_time", targetTimeMinutes: 21 * 60 }),
        habit({ id: "run", title: "Run", timingMode: "exact_time", targetTimeMinutes: 7 * 60 }),
        habit({ id: "water", title: "Water" }),
        habit({ id: "walk", title: "Walk", timingMode: "time_window", windowStartMinutes: 13 * 60, windowEndMinutes: 14 * 60 }),
        habit({ id: "journal", title: "Journal", timingMode: "exact_time", targetTimeMinutes: 6 * 60, completedToday: true }),
      ],
      [
        routine({ id: "evening", name: "Evening routine", windowStartMinutes: 17 * 60 + 30, completedItems: 3, totalItems: 3 }),
        routine({ id: "morning", name: "Morning routine", timingMode: "period", period: "morning" }),
      ],
    );

    expect(groups.map((group) => [group.part, group.entries.map((entry) => entry.id), group.doneCount])).toEqual([
      ["morning", ["morning", "journal", "run"], 1],
      ["afternoon", ["walk"], 0],
      ["evening", ["evening", "read"], 1],
      ["anytime", ["water"], 0],
    ]);
  });

  it("picks one next-up entry, preferring late or due-now over upcoming", () => {
    const groups = buildDayGroups(
      [
        habit({ id: "late-done", timingMode: "exact_time", targetTimeMinutes: 6 * 60, timingStatusToday: "late", completedToday: true }),
        habit({ id: "upcoming", timingMode: "exact_time", targetTimeMinutes: 8 * 60, timingStatusToday: "upcoming" }),
        habit({ id: "now", timingMode: "exact_time", targetTimeMinutes: 9 * 60, timingStatusToday: "due_now" }),
      ],
      [],
    );

    expect(findNextUpId(groups)).toBe("now");
    expect(findNextUpId(buildDayGroups([habit({ id: "untimed" })], []))).toBeNull();
  });

  it("formats clock times in 12-hour form", () => {
    expect(formatClock(0)).toEqual({ time: "12:00", period: "AM" });
    expect(formatClock(17 * 60 + 30)).toEqual({ time: "5:30", period: "PM" });
  });
});
