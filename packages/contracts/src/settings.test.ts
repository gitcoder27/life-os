import { describe, expect, it } from "vitest";

import { notificationCategories } from "./notifications.js";
import { updateSettingsProfileRequestSchema } from "./settings.js";

describe("settings notification preference contracts", () => {
  it("accepts partial updates for every canonical notification category", () => {
    for (const category of notificationCategories) {
      const parsed = updateSettingsProfileRequestSchema.safeParse({
        notificationPreferences: {
          [category]: {
            enabled: false,
          },
        },
      });

      expect(parsed.success, category).toBe(true);
    }
  });

  it("rejects unknown notification categories", () => {
    const parsed = updateSettingsProfileRequestSchema.safeParse({
      notificationPreferences: {
        unknown: {
          enabled: false,
        },
      },
    });

    expect(parsed.success).toBe(false);
  });
});
