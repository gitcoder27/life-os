import { describe, expect, it } from "vitest";

import {
  calculateHabitActiveStreak,
  calculateHabitRecentDays,
  calculateHabitRisk,
  calculateWeeklyHabitChallenge,
} from "../../src/lib/habits/guidance.js";

describe("habit guidance helpers", () => {
  it("marks a due streak as at risk", () => {
    const risk = calculateHabitRisk(
      [
        { occurredOn: new Date("2026-03-12T00:00:00.000Z"), status: "COMPLETED" },
        { occurredOn: new Date("2026-03-13T00:00:00.000Z"), status: "COMPLETED" },
        { occurredOn: new Date("2026-03-14T00:00:00.000Z"), status: "COMPLETED" },
      ],
      {},
      "2026-03-15",
    );

    expect(risk).toEqual(
      expect.objectContaining({
        level: "at_risk",
        reason: "streak_at_risk",
        dueCount7d: 7,
        completedCount7d: 3,
      }),
    );
  });

  it("marks weak recent completion as drifting", () => {
    const risk = calculateHabitRisk(
      [
        { occurredOn: new Date("2026-03-10T00:00:00.000Z"), status: "COMPLETED" },
        { occurredOn: new Date("2026-03-12T00:00:00.000Z"), status: "COMPLETED" },
      ],
      {},
      "2026-03-15",
    );

    expect(risk).toEqual(
      expect.objectContaining({
        level: "drifting",
        reason: "missed_recently",
      }),
    );
  });

  it("builds a due-today weekly challenge from the focus habit", () => {
    const challenge = calculateWeeklyHabitChallenge({
      habit: {
        id: "habit-1",
        title: "Hydrate",
      },
      checkins: [
        { occurredOn: new Date("2026-03-09T00:00:00.000Z"), status: "COMPLETED" },
        { occurredOn: new Date("2026-03-10T00:00:00.000Z"), status: "COMPLETED" },
        { occurredOn: new Date("2026-03-11T00:00:00.000Z"), status: "COMPLETED" },
      ],
      scheduleInput: {},
      weekStartIsoDate: "2026-03-09",
      targetIsoDate: "2026-03-12",
    });

    expect(challenge).toEqual(
      expect.objectContaining({
        habitId: "habit-1",
        status: "due_today",
        weekCompletions: 3,
        weekTarget: 7,
      }),
    );
  });

  it("freezes streaks across a paused rest day", () => {
    const streak = calculateHabitActiveStreak(
      [
        { occurredOn: new Date("2026-03-12T00:00:00.000Z"), status: "COMPLETED" },
        { occurredOn: new Date("2026-03-13T00:00:00.000Z"), status: "COMPLETED" },
      ],
      {},
      "2026-03-14",
      [{ startsOn: new Date("2026-03-14T00:00:00.000Z"), endsOn: new Date("2026-03-14T00:00:00.000Z") }],
    );

    expect(streak).toBe(2);
  });

  it("ignores vacation dates when calculating recent risk", () => {
    const risk = calculateHabitRisk(
      [
        { occurredOn: new Date("2026-03-08T00:00:00.000Z"), status: "COMPLETED" },
        { occurredOn: new Date("2026-03-09T00:00:00.000Z"), status: "COMPLETED" },
        { occurredOn: new Date("2026-03-10T00:00:00.000Z"), status: "COMPLETED" },
        { occurredOn: new Date("2026-03-11T00:00:00.000Z"), status: "COMPLETED" },
      ],
      {},
      "2026-03-14",
      [{ startsOn: new Date("2026-03-12T00:00:00.000Z"), endsOn: new Date("2026-03-14T00:00:00.000Z") }],
    );

    expect(risk).toEqual(
      expect.objectContaining({
        level: "none",
        dueCount7d: 4,
        completedCount7d: 4,
      }),
    );
  });

  it("builds the last seven days oldest first with rest and open states", () => {
    const checkins = [
      { occurredOn: new Date("2026-03-09T00:00:00.000Z"), status: "COMPLETED" as const },
      { occurredOn: new Date("2026-03-11T00:00:00.000Z"), status: "SKIPPED" as const },
      { occurredOn: new Date("2026-03-13T00:00:00.000Z"), status: "COMPLETED" as const },
    ];
    const pauseWindows = [
      { startsOn: new Date("2026-03-12T00:00:00.000Z"), endsOn: new Date("2026-03-12T00:00:00.000Z") },
    ];

    expect(calculateHabitRecentDays(checkins, {}, "2026-03-15", pauseWindows)).toEqual([
      { date: "2026-03-09", state: "done" },
      { date: "2026-03-10", state: "missed" },
      { date: "2026-03-11", state: "missed" },
      { date: "2026-03-12", state: "rest" },
      { date: "2026-03-13", state: "done" },
      { date: "2026-03-14", state: "missed" },
      { date: "2026-03-15", state: "open" },
    ]);

    const completedToday = calculateHabitRecentDays(
      [...checkins, { occurredOn: new Date("2026-03-15T00:00:00.000Z"), status: "COMPLETED" as const }],
      {},
      "2026-03-15",
      pauseWindows,
    );

    expect(completedToday.at(-1)).toEqual({ date: "2026-03-15", state: "done" });
  });

  it("marks partial multi-target days and unscheduled days", () => {
    const days = calculateHabitRecentDays(
      [
        { occurredOn: new Date("2026-03-09T00:00:00.000Z"), status: "COMPLETED", completionCount: 1 },
        { occurredOn: new Date("2026-03-10T00:00:00.000Z"), status: "COMPLETED", completionCount: 2 },
        { occurredOn: new Date("2026-03-14T00:00:00.000Z"), status: "COMPLETED", completionCount: 2 },
      ],
      { daysOfWeek: [1, 2, 3, 4, 5] },
      "2026-03-15",
      [],
      2,
    );

    expect(days.map((day) => day.state)).toEqual([
      "partial",
      "done",
      "missed",
      "missed",
      "missed",
      "done",
      "not_due",
    ]);
  });
});
