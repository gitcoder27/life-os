import { describe, expect, it } from "vitest";

import {
  addDays,
  normalizeIsoDate,
  getMonthEndDate,
  getWeekEndDate,
  parseIsoDate,
} from "../../src/lib/time/cycle.js";
import { getUtcGreeting, toIsoDateString } from "../../src/lib/time/date.js";
import { getDayWindowUtc, getLocalGreeting, getUserLocalDate } from "../../src/lib/time/user-time.js";

describe("time utilities", () => {
  it("parses ISO dates at UTC midnight", () => {
    const parsed = parseIsoDate("2026-03-14");

    expect(parsed.toISOString()).toBe("2026-03-14T00:00:00.000Z");
  });

  it("adds days across month boundaries", () => {
    const result = addDays(parseIsoDate("2026-01-31"), 1);

    expect(result.toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });

  it("computes week and month end dates", () => {
    const start = parseIsoDate("2026-03-14");

    expect(getWeekEndDate(start).toISOString()).toBe("2026-03-20T00:00:00.000Z");
    expect(getMonthEndDate(start).toISOString()).toBe("2026-03-31T00:00:00.000Z");
  });

  it("serializes dates with a stable UTC date format", () => {
    expect(toIsoDateString(new Date("2026-03-14T12:34:56.789Z"))).toBe("2026-03-14");
  });

  it("returns a UTC-aware greeting", () => {
    expect(getUtcGreeting(new Date("2026-03-14T08:00:00.000Z"))).toBe("Good morning");
    expect(getUtcGreeting(new Date("2026-03-14T15:00:00.000Z"))).toBe("Good afternoon");
    expect(getUtcGreeting(new Date("2026-03-14T22:00:00.000Z"))).toBe("Good evening");
  });

  it("normalizes dates to UTC ISO date start-of-day", () => {
    expect(normalizeIsoDate(new Date("2026-03-14T23:45:00.000Z"))).toBe("2026-03-14");
  });

  it("derives a user-local date from the stored timezone", () => {
    expect(getUserLocalDate(new Date("2026-01-15T05:30:00.000Z"), "America/Los_Angeles")).toBe(
      "2026-01-14",
    );
  });

  it("computes UTC windows for a user-local day", () => {
    const window = getDayWindowUtc("2026-01-15", "America/Los_Angeles");

    expect(window.start.toISOString()).toBe("2026-01-15T08:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-01-16T08:00:00.000Z");
  });

  it("returns a user-local greeting with late-night coverage", () => {
    expect(getLocalGreeting(new Date("2026-03-14T04:00:00.000Z"), "UTC")).toBe("Good night");
    expect(getLocalGreeting(new Date("2026-03-14T05:00:00.000Z"), "UTC")).toBe("Good morning");
    expect(getLocalGreeting(new Date("2026-03-14T12:00:00.000Z"), "UTC")).toBe("Good afternoon");
    expect(getLocalGreeting(new Date("2026-03-14T17:00:00.000Z"), "UTC")).toBe("Good evening");
    expect(getLocalGreeting(new Date("2026-03-14T22:00:00.000Z"), "UTC")).toBe("Good night");
  });
});
