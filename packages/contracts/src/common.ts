import { z } from "zod";

export type IsoDateString = string;
export type IsoMonthString = string;
export type EntityId = string;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH_PATTERN = /^\d{4}-\d{2}$/;

const isValidIsoDate = (value: string) => {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
};

const isValidIsoMonth = (value: string) => {
  if (!ISO_MONTH_PATTERN.test(value)) {
    return false;
  }

  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
};

const compareIsoDates = (left: IsoDateString, right: IsoDateString) =>
  left.localeCompare(right);

const addIsoDays = (isoDate: IsoDateString, days: number) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  parsed.setUTCDate(parsed.getUTCDate() + days);

  return [
    parsed.getUTCFullYear(),
    String(parsed.getUTCMonth() + 1).padStart(2, "0"),
    String(parsed.getUTCDate()).padStart(2, "0"),
  ].join("-") as IsoDateString;
};

export const isoDateStringSchema = z
  .string()
  .regex(ISO_DATE_PATTERN)
  .refine(isValidIsoDate, "Invalid date") as unknown as z.ZodType<IsoDateString>;

export const isoMonthStringSchema = z
  .string()
  .regex(ISO_MONTH_PATTERN)
  .refine(isValidIsoMonth, "Invalid month") as unknown as z.ZodType<IsoMonthString>;

export const entityIdSchema = z.string().trim().min(1) as z.ZodType<EntityId>;

export const lifecycleStatusSchema = z.enum(["active", "inactive"]);
export type LifecycleStatus = z.infer<typeof lifecycleStatusSchema>;

export const apiErrorCodeSchema = z.enum([
  "BAD_REQUEST",
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "REVIEW_ALREADY_SUBMITTED",
  "REVIEW_OUT_OF_WINDOW",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
]);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiMetaSchema = z.object({
  generatedAt: z.string().datetime({ offset: true }),
});

export interface ApiMeta {
  generatedAt: string;
}

export const apiSuccessSchema = z.object({
  success: z.literal(true),
});

export interface ApiSuccess {
  success: true;
}

export const apiFieldErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
});

export interface ApiFieldError {
  field: string;
  message: string;
}

export const apiErrorSchema = apiMetaSchema.extend({
  success: z.literal(false),
  code: apiErrorCodeSchema,
  message: z.string(),
  fieldErrors: z.array(apiFieldErrorSchema).optional(),
}) satisfies z.ZodType<ApiError>;

export interface ApiError extends ApiMeta {
  success: false;
  code: ApiErrorCode;
  message: string;
  fieldErrors?: ApiFieldError[];
}

export const createIsoDateRangeQuerySchema = (options: { maxDays: number }) =>
  z
    .object({
      from: isoDateStringSchema,
      to: isoDateStringSchema,
    })
    .superRefine((value, context) => {
      if (compareIsoDates(value.to, value.from) < 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["to"],
          message: "End date must be on or after start date",
        });
        return;
      }

      const maxEndDate = addIsoDays(value.from, options.maxDays - 1);
      if (compareIsoDates(value.to, maxEndDate) > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["to"],
          message: `Date range must be ${options.maxDays} days or fewer`,
        });
      }
    });
