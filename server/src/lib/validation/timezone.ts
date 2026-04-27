import { z } from "zod";

import { isValidTimezone } from "../time/user-time.js";

export const timezoneSchema = z
  .string()
  .min(1)
  .max(120)
  .refine(isValidTimezone, "Invalid timezone");

export function parseTimezoneCandidate(candidate: unknown) {
  if (typeof candidate !== "string") {
    return null;
  }

  const timezone = candidate.trim();
  return isValidTimezone(timezone) ? timezone : null;
}
