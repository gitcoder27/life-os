import { describe, expect, it } from "vitest";

import { isoDateStringSchema, isoMonthStringSchema } from "./common.js";
import { recurrenceInputSchema } from "./recurrence.js";
import { resetWorkspaceRequestSchema } from "./settings.js";

describe("common contract schemas", () => {
  it("validates real ISO dates and months", () => {
    expect(isoDateStringSchema.safeParse("2026-02-28").success).toBe(true);
    expect(isoDateStringSchema.safeParse("2026-02-30").success).toBe(false);
    expect(isoMonthStringSchema.safeParse("2026-12").success).toBe(true);
    expect(isoMonthStringSchema.safeParse("2026-13").success).toBe(false);
  });

  it("validates recurrence rule and exception shapes", () => {
    expect(
      recurrenceInputSchema.safeParse({
        rule: {
          frequency: "weekly",
          startsOn: "2026-05-18",
          interval: 1,
          daysOfWeek: [1, 3, 5],
          end: {
            type: "after_occurrences",
            occurrenceCount: 10,
          },
        },
        exceptions: [
          {
            occurrenceDate: "2026-05-25",
            action: "reschedule",
            targetDate: "2026-05-26",
          },
        ],
      }).success,
    ).toBe(true);

    expect(
      recurrenceInputSchema.safeParse({
        rule: {
          frequency: "weekly",
          startsOn: "2026-05-18",
          daysOfWeek: [7],
        },
      }).success,
    ).toBe(false);
  });

  it("requires exact reset confirmation text after trimming", () => {
    expect(resetWorkspaceRequestSchema.safeParse({ confirmationText: " RESET " }).success).toBe(true);
    expect(resetWorkspaceRequestSchema.safeParse({ confirmationText: "reset" }).success).toBe(false);
  });
});
