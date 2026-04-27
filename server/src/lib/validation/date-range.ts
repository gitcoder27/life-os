import type { IsoDateString } from "@life-os/contracts";
import { z } from "zod";

import { parseIsoDate } from "../time/cycle.js";
import { toIsoDateString } from "../time/date.js";

export const isoDateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsedDate = parseIsoDate(value as IsoDateString);
    return Number.isFinite(parsedDate.getTime()) && toIsoDateString(parsedDate) === value;
  }, "Invalid date") as unknown as z.ZodType<IsoDateString>;

export function createIsoDateRangeQuerySchema(options: { maxDays: number }) {
  return z
    .object({
      from: isoDateStringSchema,
      to: isoDateStringSchema,
    })
    .superRefine((value, context) => {
      const fromDate = parseIsoDate(value.from);
      const toDate = parseIsoDate(value.to);
      const dayCount = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;

      if (dayCount < 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["to"],
          message: "End date must be on or after start date",
        });
        return;
      }

      if (dayCount > options.maxDays) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["to"],
          message: `Date range must be ${options.maxDays} days or fewer`,
        });
      }
    });
}
