import { z } from "zod";

import {
  entityIdSchema,
  isoDateStringSchema,
} from "./common.js";

export const recurrenceFrequencySchema = z.enum([
  "daily",
  "weekly",
  "monthly_nth_weekday",
  "interval",
]);
export type RecurrenceFrequency = z.infer<typeof recurrenceFrequencySchema>;

export const recurrenceIntervalUnitSchema = z.enum(["day", "week", "month"]);
export type RecurrenceIntervalUnit = z.infer<typeof recurrenceIntervalUnitSchema>;

export const recurrenceEndTypeSchema = z.enum(["never", "on_date", "after_occurrences"]);
export type RecurrenceEndType = z.infer<typeof recurrenceEndTypeSchema>;

export const recurrenceExceptionActionSchema = z.enum(["skip", "do_once", "reschedule"]);
export type RecurrenceExceptionAction = z.infer<typeof recurrenceExceptionActionSchema>;

export const recurringTaskCarryPolicySchema = z.enum([
  "complete_and_clone",
  "move_due_date",
  "cancel",
]);
export type RecurringTaskCarryPolicy = z.infer<typeof recurringTaskCarryPolicySchema>;

export const recurrenceEndConditionSchema = z.object({
  type: recurrenceEndTypeSchema,
  until: isoDateStringSchema.nullable().optional(),
  occurrenceCount: z.number().int().positive().optional(),
});
export type RecurrenceEndCondition = z.infer<typeof recurrenceEndConditionSchema>;

export const monthlyNthWeekdayRuleSchema = z.object({
  ordinal: z.union([
    z.literal(-1),
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
  ]),
  dayOfWeek: z.number().int().min(0).max(6),
});
export type MonthlyNthWeekdayRule = z.infer<typeof monthlyNthWeekdayRuleSchema>;

export const recurrenceRuleInputSchema = z.object({
  frequency: recurrenceFrequencySchema,
  startsOn: isoDateStringSchema,
  interval: z.number().int().positive().max(365).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  nthWeekday: monthlyNthWeekdayRuleSchema.optional(),
  end: recurrenceEndConditionSchema.optional(),
});
export type RecurrenceRuleInput = z.infer<typeof recurrenceRuleInputSchema>;

export const recurrenceExceptionItemSchema = z.object({
  occurrenceDate: isoDateStringSchema,
  action: recurrenceExceptionActionSchema,
  targetDate: isoDateStringSchema.nullable().optional(),
});
export type RecurrenceExceptionItem = z.infer<typeof recurrenceExceptionItemSchema>;

export const recurrenceInputSchema = z.object({
  rule: recurrenceRuleInputSchema,
  exceptions: z.array(recurrenceExceptionItemSchema).max(180).optional(),
});
export type RecurrenceInput = z.infer<typeof recurrenceInputSchema>;

export const recurrenceDefinitionSchema = z.object({
  id: entityIdSchema,
  rule: recurrenceRuleInputSchema,
  exceptions: z.array(recurrenceExceptionItemSchema),
  carryPolicy: recurringTaskCarryPolicySchema.nullable().optional(),
  legacyRuleText: z.string().nullable().optional(),
});
export type RecurrenceDefinition = z.infer<typeof recurrenceDefinitionSchema>;
