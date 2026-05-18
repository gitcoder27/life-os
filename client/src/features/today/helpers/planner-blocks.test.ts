import { describe, expect, it } from "vitest";

import type { DayPlannerBlockItem } from "../../../shared/lib/api";
import {
  addMinutes,
  buildPlannerDateTime,
  formatDurationMinutes,
  getDuplicateBlockWindow,
  getDurationMinutes,
  getPlannerBlockDate,
  getPlannerBlockTimezoneOffset,
  getSplitBlockTime,
  minutesToTimeString,
  timeStringToMinutes,
  validatePlannerBlockDraft,
} from "./planner-blocks";

const makeBlock = (overrides: Partial<DayPlannerBlockItem>): DayPlannerBlockItem => ({
  id: "block-1",
  title: "Focus",
  startsAt: "2026-05-03T09:00:00",
  endsAt: "2026-05-03T10:00:00",
  sortOrder: 1,
  tasks: [],
  ...overrides,
} as DayPlannerBlockItem);

describe("planner block helpers", () => {
  it("normalizes time math and durations", () => {
    expect(addMinutes("23:50", 30)).toBe("23:59");
    expect(addMinutes("00:10", -30)).toBe("00:00");
    expect(timeStringToMinutes("02:30")).toBe(150);
    expect(timeStringToMinutes("bad")).toBe(0);
    expect(minutesToTimeString(150)).toBe("02:30");
    expect(minutesToTimeString(2000)).toBe("23:59");
    expect(formatDurationMinutes(45)).toBe("45m");
    expect(formatDurationMinutes(120)).toBe("2h");
    expect(formatDurationMinutes(135)).toBe("2h 15m");
  });

  it("builds and reads planner date-time values", () => {
    const dateTime = buildPlannerDateTime("2026-05-03", "09:30", "+05:30");

    expect(dateTime).toBe("2026-05-03T09:30:00+05:30");
    expect(getDurationMinutes("2026-05-03T09:00:00", "2026-05-03T10:15:00")).toBe(75);
    expect(getDurationMinutes("2026-05-03T10:15:00", "2026-05-03T09:00:00")).toBe(0);
    expect(getPlannerBlockDate(makeBlock({ startsAt: "2026-05-03T09:00:00" }))).toBe("2026-05-03");
    expect(getPlannerBlockTimezoneOffset(makeBlock({ startsAt: "2026-05-03T09:00:00+05:30" }))).toBe("+05:30");
  });

  it("finds duplicate windows after existing blocks without overlapping", () => {
    const source = makeBlock({
      id: "source",
      startsAt: "2026-05-03T09:00:00",
      endsAt: "2026-05-03T10:00:00",
    });
    const existingBlocks = [
      source,
      makeBlock({
        id: "other",
        startsAt: "2026-05-03T10:30:00",
        endsAt: "2026-05-03T11:00:00",
      }),
    ];

    expect(getDuplicateBlockWindow({ block: source, existingBlocks })).toEqual({
      startTime: "11:00",
      endTime: "12:00",
    });
    expect(getSplitBlockTime(source)).toBe("09:30");
    expect(getSplitBlockTime(makeBlock({
      startsAt: "2026-05-03T09:00:00",
      endsAt: "2026-05-03T09:20:00",
    }))).toBeNull();
  });

  it("validates required, ordered, parseable, and non-overlapping drafts", () => {
    const existingBlocks = [
      makeBlock({
        id: "existing",
        title: "Existing block",
        startsAt: "2026-05-03T09:00:00+00:00",
        endsAt: "2026-05-03T10:00:00+00:00",
      }),
    ];

    expect(validatePlannerBlockDraft({
      date: "2026-05-03",
      startTime: "",
      endTime: "10:00",
      timezoneOffset: "+00:00",
      existingBlocks,
    }).error).toBe("Start and end times are required.");
    expect(validatePlannerBlockDraft({
      date: "2026-05-03",
      startTime: "10:00",
      endTime: "09:00",
      timezoneOffset: "+00:00",
      existingBlocks,
    }).error).toBe("End time must be after start time.");
    expect(validatePlannerBlockDraft({
      date: "2026-05-03",
      startTime: "09:30",
      endTime: "10:30",
      timezoneOffset: "+00:00",
      existingBlocks,
    }).error).toBe("Overlaps Existing block.");
    expect(validatePlannerBlockDraft({
      date: "2026-05-03",
      startTime: "10:00",
      endTime: "11:00",
      timezoneOffset: "+00:00",
      existingBlocks,
    })).toMatchObject({
      startsAt: "2026-05-03T10:00:00+00:00",
      endsAt: "2026-05-03T11:00:00+00:00",
      error: null,
    });
  });
});
