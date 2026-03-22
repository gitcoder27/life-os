import { describe, expect, it } from "vitest";

import {
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
});
