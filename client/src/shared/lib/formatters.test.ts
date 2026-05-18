import { describe, expect, it } from "vitest";

import {
  formatMealSlotLabel,
  formatMinorCurrency,
  formatPercent,
  formatWorkoutStatus,
} from "./formatters";

describe("formatters", () => {
  it("formats currency, percentages, and empty money values", () => {
    expect(formatMinorCurrency(null)).toBe("TBD");
    expect(formatMinorCurrency(123456, "USD")).toBe("$1,234.56");
    expect(formatPercent(72.4)).toBe("72%");
  });

  it("formats health labels for display", () => {
    expect(formatMealSlotLabel(null)).toBe("Any time");
    expect(formatMealSlotLabel("snack")).toBe("Snack");
    expect(formatWorkoutStatus(null)).toBe("Not logged");
    expect(formatWorkoutStatus("recovery_respected")).toBe("Recovery Respected");
  });
});
