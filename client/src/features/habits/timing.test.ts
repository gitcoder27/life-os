import { describe, expect, it } from "vitest";

import {
  formatMinutesToTimeInput,
  parseTimeInputToMinutes,
  sortByTimingStatus,
  timingStatusLabel,
  timingStatusTagClass,
} from "./timing";

describe("habit timing helpers", () => {
  it("parses and formats time inputs", () => {
    expect(parseTimeInputToMinutes("06:30")).toBe(390);
    expect(parseTimeInputToMinutes("bad")).toBeNull();
    expect(parseTimeInputToMinutes("")).toBeNull();
    expect(formatMinutesToTimeInput(390)).toBe("06:30");
    expect(formatMinutesToTimeInput(null)).toBe("");
  });

  it("maps timing status labels and classes", () => {
    expect(timingStatusLabel("due_now")).toBe("Now");
    expect(timingStatusLabel("none")).toBeNull();
    expect(timingStatusTagClass("complete_on_time")).toBe("tag tag--positive");
    expect(timingStatusTagClass("late")).toBe("tag tag--warning");
  });

  it("sorts urgent timing statuses first and titles alphabetically within ties", () => {
    expect(
      sortByTimingStatus([
        { timingStatusToday: "upcoming" as const, title: "Zinc" },
        { timingStatusToday: "late" as const, title: "Beta" },
        { timingStatusToday: "late" as const, title: "Alpha" },
        { timingStatusToday: "complete_on_time" as const, title: "Done" },
      ]).map((item) => item.title),
    ).toEqual(["Alpha", "Beta", "Zinc", "Done"]);
  });
});
