import { describe, expect, it } from "vitest";

import {
  formatGoalDate,
  getGoalMilestoneDueLabel,
  isGoalMilestoneOverdue,
} from "./goal-date-logic";

describe("goal date logic", () => {
  it("uses an explicit local context date for milestone overdue checks", () => {
    expect(isGoalMilestoneOverdue("2026-05-02", "2026-05-03")).toBe(true);
    expect(isGoalMilestoneOverdue("2026-05-03", "2026-05-03")).toBe(false);
    expect(isGoalMilestoneOverdue("2026-05-04", "2026-05-03")).toBe(false);
  });

  it("formats due labels from date-only context instead of current UTC time", () => {
    expect(getGoalMilestoneDueLabel("2026-05-02", "2026-05-03")).toBe("Overdue");
    expect(getGoalMilestoneDueLabel("2026-05-03", "2026-05-03")).toBe("Due today");
    expect(getGoalMilestoneDueLabel("2026-05-04", "2026-05-03")).toBe("Due tomorrow");
    expect(getGoalMilestoneDueLabel("2026-05-06", "2026-05-03")).toBe("Due in 3 days");
  });

  it("formats ISO date-times by their date portion without constructing invalid dates", () => {
    expect(formatGoalDate("2026-05-03T20:15:00.000Z")).toBe("May 3");
  });
});
