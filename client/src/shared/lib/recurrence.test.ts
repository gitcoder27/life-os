import { describe, expect, it } from "vitest";
import type { RecurrenceInput } from "@life-os/contracts";

import {
  formatFullRecurrenceSummary,
  listUpcomingRecurrenceDates,
} from "./recurrence";

describe("recurrence helpers", () => {
  it("accepts contract recurrence inputs with exceptions at the client boundary", () => {
    const recurrence: RecurrenceInput = {
      rule: {
        frequency: "weekly",
        startsOn: "2026-05-04",
        daysOfWeek: [1],
        end: { type: "never" },
      },
      exceptions: [
        {
          occurrenceDate: "2026-05-11",
          action: "reschedule",
          targetDate: "2026-05-12",
        },
      ],
    };

    expect(recurrence.exceptions?.[0]?.targetDate).toBe("2026-05-12");
    expect(formatFullRecurrenceSummary(recurrence.rule)).toContain("Mon");
  });

  it("lists upcoming dates from the shared recurrence rule shape", () => {
    expect(
      listUpcomingRecurrenceDates({
        frequency: "interval",
        startsOn: "2026-05-01",
        interval: 2,
        end: { type: "after_occurrences", occurrenceCount: 3 },
      }, 5),
    ).toEqual(["2026-05-01", "2026-05-03", "2026-05-05"]);
  });
});
