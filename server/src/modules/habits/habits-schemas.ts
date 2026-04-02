import type {
  CreateHabitPauseWindowRequest,
  CreateHabitRequest,
  CreateRoutineRequest,
  HabitCheckinRequest,
  HabitScheduleRule,
  IsoDateString,
  RecurrenceInput,
  RoutineItemCheckinRequest,
  UpdateHabitRequest,
  UpdateRoutineRequest,
} from "@life-os/contracts";
import { z } from "zod";

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/) as unknown as z.ZodType<IsoDateString>;

const habitStatusSchema = z.enum(["active", "paused", "archived"]);
const habitPauseKindSchema = z.enum(["rest_day", "vacation"]);
const habitCheckinStatusSchema = z.enum(["completed", "skipped"]);
const routineStatusSchema = z.enum(["active", "archived"]);

const habitScheduleRuleSchema = z.object({
  daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(),
}) as z.ZodType<HabitScheduleRule>;

const recurrenceExceptionActionSchema = z.enum(["skip", "do_once", "reschedule"]);
const recurrenceRuleSchema = z.object({
  frequency: z.enum(["daily", "weekly", "monthly_nth_weekday", "interval"]),
  startsOn: isoDateSchema,
  interval: z.number().int().positive().max(365).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  nthWeekday: z
    .object({
      ordinal: z.union([z.literal(-1), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
      dayOfWeek: z.number().int().min(0).max(6),
    })
    .optional(),
  end: z
    .object({
      type: z.enum(["never", "on_date", "after_occurrences"]),
      until: isoDateSchema.nullable().optional(),
      occurrenceCount: z.number().int().positive().optional(),
    })
    .optional(),
});

const recurrenceInputSchema = z.object({
  rule: recurrenceRuleSchema,
  exceptions: z
    .array(
      z.object({
        occurrenceDate: isoDateSchema,
        action: recurrenceExceptionActionSchema,
        targetDate: isoDateSchema.nullable().optional(),
      }),
    )
    .max(180)
    .optional(),
}) as z.ZodType<RecurrenceInput>;

const routineItemInputSchema = z.object({
  title: z.string().min(1).max(200),
  sortOrder: z.number().int().min(0),
  isRequired: z.boolean().optional(),
});

export const createHabitSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.string().max(120).nullable().optional(),
  scheduleRule: habitScheduleRuleSchema.optional(),
  recurrence: recurrenceInputSchema.optional(),
  goalId: z.string().uuid().nullable().optional(),
  targetPerDay: z.number().int().positive().max(20).optional(),
}) as z.ZodType<CreateHabitRequest>;

export const updateHabitSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    category: z.string().max(120).nullable().optional(),
    scheduleRule: habitScheduleRuleSchema.optional(),
    recurrence: recurrenceInputSchema.optional(),
    goalId: z.string().uuid().nullable().optional(),
    targetPerDay: z.number().int().positive().max(20).optional(),
    status: habitStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated") as z.ZodType<UpdateHabitRequest>;

export const habitCheckinSchema = z.object({
  date: isoDateSchema.optional(),
  status: habitCheckinStatusSchema.optional(),
  note: z.string().max(4000).nullable().optional(),
}) as z.ZodType<HabitCheckinRequest>;

export const createHabitPauseWindowSchema = z
  .object({
    kind: habitPauseKindSchema,
    startsOn: isoDateSchema,
    endsOn: isoDateSchema.optional(),
    note: z.string().max(4000).nullable().optional(),
  })
  .refine((value) => value.kind !== "rest_day" || !value.endsOn || value.endsOn === value.startsOn, {
    message: "Rest day pauses must be a single date",
    path: ["endsOn"],
  })
  .refine((value) => (value.endsOn ?? value.startsOn) >= value.startsOn, {
    message: "Pause window end date must be on or after the start date",
    path: ["endsOn"],
  }) as z.ZodType<CreateHabitPauseWindowRequest>;

export const createRoutineSchema = z.object({
  name: z.string().min(1).max(200),
  items: z.array(routineItemInputSchema),
}) as z.ZodType<CreateRoutineRequest>;

export const updateRoutineSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    sortOrder: z.number().int().min(0).optional(),
    status: routineStatusSchema.optional(),
    items: z.array(routineItemInputSchema).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated") as z.ZodType<UpdateRoutineRequest>;

export const routineItemCheckinSchema = z.object({
  date: isoDateSchema.optional(),
}) as z.ZodType<RoutineItemCheckinRequest>;
