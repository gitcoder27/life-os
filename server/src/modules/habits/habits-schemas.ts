import type {
  CreateHabitPauseWindowRequest,
  CreateHabitRequest,
  CreateRoutineRequest,
  HabitCheckinLevel,
  HabitCheckinRequest,
  HabitType,
  HabitTimingMode,
  HabitScheduleRule,
  IsoDateString,
  RecurrenceInput,
  RoutinePeriod,
  RoutineItemCheckinRequest,
  RoutineTimingMode,
  UpdateHabitRequest,
  UpdateRoutineRequest,
} from "@life-os/contracts";
import { z } from "zod";

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/) as unknown as z.ZodType<IsoDateString>;

const habitStatusSchema = z.enum(["active", "paused", "archived"]);
const habitTypeSchema = z.enum(["maintenance", "growth", "identity"]) as z.ZodType<HabitType>;
const habitPauseKindSchema = z.enum(["rest_day", "vacation"]);
const habitCheckinStatusSchema = z.enum(["completed", "skipped"]);
const habitCheckinLevelSchema = z.enum(["minimum", "standard", "stretch"]) as z.ZodType<HabitCheckinLevel>;
const habitTimingModeSchema = z.enum(["anytime", "anchor", "exact_time", "time_window"]) as z.ZodType<HabitTimingMode>;
const routineStatusSchema = z.enum(["active", "archived"]);
const routineTimingModeSchema = z.enum(["anytime", "period", "custom_window"]) as z.ZodType<RoutineTimingMode>;
const routinePeriodSchema = z.enum(["morning", "evening"]) as z.ZodType<RoutinePeriod>;
const minuteOfDaySchema = z.number().int().min(0).max(1439);
const habitDurationSchema = z.number().int().min(1).max(720);

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
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  sortOrder: z.number().int().min(0),
  isRequired: z.boolean().optional(),
});

export const createHabitSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.string().max(120).nullable().optional(),
  habitType: habitTypeSchema.optional(),
  scheduleRule: habitScheduleRuleSchema.optional(),
  recurrence: recurrenceInputSchema.optional(),
  goalId: z.string().uuid().nullable().optional(),
  targetPerDay: z.number().int().positive().max(20).optional(),
  durationMinutes: habitDurationSchema.optional(),
  timingMode: habitTimingModeSchema.optional(),
  anchorText: z.string().max(240).nullable().optional(),
  targetTimeMinutes: minuteOfDaySchema.nullable().optional(),
  windowStartMinutes: minuteOfDaySchema.nullable().optional(),
  windowEndMinutes: minuteOfDaySchema.nullable().optional(),
  minimumVersion: z.string().max(240).nullable().optional(),
  standardVersion: z.string().max(240).nullable().optional(),
  stretchVersion: z.string().max(240).nullable().optional(),
  obstaclePlan: z.string().max(500).nullable().optional(),
  repairRule: z.string().max(500).nullable().optional(),
  identityMeaning: z.string().max(500).nullable().optional(),
}).superRefine((value, ctx) => {
  const timingMode = value.timingMode ?? "anytime";

  if (timingMode === "anchor" && !value.anchorText?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Anchor timing requires anchor text",
      path: ["anchorText"],
    });
  }

  if (timingMode === "exact_time" && value.targetTimeMinutes == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Exact-time habits require a target time",
      path: ["targetTimeMinutes"],
    });
  }

  if (timingMode === "time_window") {
    if (value.windowStartMinutes == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Windowed habits require a window start",
        path: ["windowStartMinutes"],
      });
    }

    if (value.windowEndMinutes == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Windowed habits require a window end",
        path: ["windowEndMinutes"],
      });
    }

    if (
      value.windowStartMinutes != null &&
      value.windowEndMinutes != null &&
      value.windowStartMinutes >= value.windowEndMinutes
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Window end must be after the window start",
        path: ["windowEndMinutes"],
      });
    }
  }
}) as z.ZodType<CreateHabitRequest>;

export const updateHabitSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    category: z.string().max(120).nullable().optional(),
    habitType: habitTypeSchema.optional(),
    scheduleRule: habitScheduleRuleSchema.optional(),
    recurrence: recurrenceInputSchema.optional(),
    goalId: z.string().uuid().nullable().optional(),
    targetPerDay: z.number().int().positive().max(20).optional(),
    durationMinutes: habitDurationSchema.optional(),
    timingMode: habitTimingModeSchema.optional(),
    anchorText: z.string().max(240).nullable().optional(),
    targetTimeMinutes: minuteOfDaySchema.nullable().optional(),
    windowStartMinutes: minuteOfDaySchema.nullable().optional(),
    windowEndMinutes: minuteOfDaySchema.nullable().optional(),
    minimumVersion: z.string().max(240).nullable().optional(),
    standardVersion: z.string().max(240).nullable().optional(),
    stretchVersion: z.string().max(240).nullable().optional(),
    obstaclePlan: z.string().max(500).nullable().optional(),
    repairRule: z.string().max(500).nullable().optional(),
    identityMeaning: z.string().max(500).nullable().optional(),
    status: habitStatusSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.windowStartMinutes != null &&
      value.windowEndMinutes != null &&
      value.windowStartMinutes >= value.windowEndMinutes
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Window end must be after the window start",
        path: ["windowEndMinutes"],
      });
    }
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated") as z.ZodType<UpdateHabitRequest>;

export const habitCheckinSchema = z.object({
  date: isoDateSchema.optional(),
  status: habitCheckinStatusSchema.optional(),
  level: habitCheckinLevelSchema.nullable().optional(),
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
  timingMode: routineTimingModeSchema.optional(),
  period: routinePeriodSchema.nullable().optional(),
  windowStartMinutes: minuteOfDaySchema.nullable().optional(),
  windowEndMinutes: minuteOfDaySchema.nullable().optional(),
  items: z.array(routineItemInputSchema),
}).superRefine((value, ctx) => {
  const timingMode = value.timingMode ?? "anytime";

  if (timingMode === "period" && !value.period) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Period-timed routines require a period",
      path: ["period"],
    });
  }

  if (timingMode === "custom_window") {
    if (value.windowStartMinutes == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Custom-window routines require a start time",
        path: ["windowStartMinutes"],
      });
    }

    if (value.windowEndMinutes == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Custom-window routines require an end time",
        path: ["windowEndMinutes"],
      });
    }

    if (
      value.windowStartMinutes != null &&
      value.windowEndMinutes != null &&
      value.windowStartMinutes >= value.windowEndMinutes
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Window end must be after the window start",
        path: ["windowEndMinutes"],
      });
    }
  }
}) as z.ZodType<CreateRoutineRequest>;

export const updateRoutineSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    sortOrder: z.number().int().min(0).optional(),
    status: routineStatusSchema.optional(),
    timingMode: routineTimingModeSchema.optional(),
    period: routinePeriodSchema.nullable().optional(),
    windowStartMinutes: minuteOfDaySchema.nullable().optional(),
    windowEndMinutes: minuteOfDaySchema.nullable().optional(),
    items: z.array(routineItemInputSchema).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.windowStartMinutes != null &&
      value.windowEndMinutes != null &&
      value.windowStartMinutes >= value.windowEndMinutes
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Window end must be after the window start",
        path: ["windowEndMinutes"],
      });
    }
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated") as z.ZodType<UpdateRoutineRequest>;

export const routineItemCheckinSchema = z.object({
  date: isoDateSchema.optional(),
}) as z.ZodType<RoutineItemCheckinRequest>;
