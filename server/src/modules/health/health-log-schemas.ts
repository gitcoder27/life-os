import { z } from "zod";

import { isoDateStringSchema } from "../../lib/validation/date-range.js";

const isoDateTimeSchema = z.string().datetime({ offset: true });
const waterLogSourceSchema = z.enum(["tap", "quick_capture", "manual"]);
const mealSlotSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);
const mealLoggingQualitySchema = z.enum(["partial", "meaningful", "full"]);
const workoutPlanTypeSchema = z.enum(["workout", "recovery", "none"]);
const workoutActualStatusSchema = z.enum([
  "completed",
  "recovery_respected",
  "fallback",
  "missed",
  "none",
]);

export const healthLogIsoDateSchema = isoDateStringSchema;

export const healthLogByDateQuerySchema = z.object({
  date: healthLogIsoDateSchema,
});

export const createWaterLogSchema = z.object({
  occurredAt: isoDateTimeSchema.optional(),
  amountMl: z.number().int().positive().max(10000),
  source: waterLogSourceSchema.optional(),
});

export const updateWaterLogSchema = z
  .object({
    occurredAt: isoDateTimeSchema.optional(),
    amountMl: z.number().int().positive().max(10000).optional(),
    source: waterLogSourceSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

export const updateWorkoutDaySchema = z
  .object({
    planType: workoutPlanTypeSchema.optional(),
    plannedLabel: z.string().max(200).nullable().optional(),
    actualStatus: workoutActualStatusSchema.optional(),
    note: z.string().max(4000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

export const createWeightLogSchema = z.object({
  measuredOn: healthLogIsoDateSchema.optional(),
  weightValue: z.number().positive().max(1000),
  unit: z.string().min(1).max(16).optional(),
  note: z.string().max(4000).nullable().optional(),
});

export const updateWeightLogSchema = z
  .object({
    measuredOn: healthLogIsoDateSchema.optional(),
    weightValue: z.number().positive().max(1000).optional(),
    unit: z.string().min(1).max(16).optional(),
    note: z.string().max(4000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

export const createMealLogSchema = z.object({
  occurredAt: isoDateTimeSchema.optional(),
  mealSlot: mealSlotSchema.nullable().optional(),
  mealTemplateId: z.string().uuid().nullable().optional(),
  mealPlanEntryId: z.string().uuid().nullable().optional(),
  description: z.string().trim().min(1).max(4000),
  loggingQuality: mealLoggingQualitySchema,
});

export const updateMealLogSchema = z
  .object({
    occurredAt: isoDateTimeSchema.optional(),
    mealSlot: mealSlotSchema.nullable().optional(),
    mealTemplateId: z.string().uuid().nullable().optional(),
    mealPlanEntryId: z.string().uuid().nullable().optional(),
    description: z.string().trim().min(1).max(4000).optional(),
    loggingQuality: mealLoggingQualitySchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");
