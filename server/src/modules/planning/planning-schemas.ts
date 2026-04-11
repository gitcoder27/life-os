import type {
  BulkUpdateTasksRequest,
  GoalMilestoneInput,
  GoalEngagementState,
  GoalStatus,
  GoalsQuery,
  IsoDateString,
  PlanningTaskItem,
  RescueReason,
  RecurringTaskCarryPolicy,
  ReviewHistoryCadenceFilter,
  TaskKind,
  TaskProgressState,
  TaskStuckAction,
  TaskStuckReason,
  UpdateGoalDomainsRequest,
  UpdateGoalHorizonsRequest,
} from "@life-os/contracts";
import { z } from "zod";

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/) as unknown as z.ZodType<IsoDateString>;
export const isoDateTimeSchema = z.string().datetime({ offset: true });
const reminderAtSchema = z.union([isoDateSchema, isoDateTimeSchema]);
const entityIdSchema = z.string().trim().min(1);

export const goalStatusSchema = z.enum(["active", "paused", "completed", "archived"]) as z.ZodType<GoalStatus>;
export const goalEngagementStateSchema = z.enum(["primary", "secondary", "parked", "maintenance"]) as z.ZodType<GoalEngagementState>;
export const goalMilestoneStatusSchema = z.enum(["pending", "completed"]);
export const priorityStatusSchema = z.enum(["pending", "completed", "dropped"]);
export const taskStatusSchema = z.enum(["pending", "completed", "dropped"]) as z.ZodType<PlanningTaskItem["status"]>;
export const taskProgressStateSchema = z.enum(["not_started", "started", "advanced"]) as z.ZodType<TaskProgressState>;
export const taskKindSchema = z.enum(["task", "note", "reminder"]) as z.ZodType<TaskKind>;
export const taskOriginSchema = z.enum([
  "manual",
  "quick_capture",
  "carry_forward",
  "review_seed",
  "recurring",
  "template",
  "meal_plan",
]) as z.ZodType<PlanningTaskItem["originType"]>;
export const carryPolicySchema = z.enum([
  "complete_and_clone",
  "move_due_date",
  "cancel",
]) as z.ZodType<RecurringTaskCarryPolicy>;
export const taskStuckReasonSchema = z.enum([
  "unclear",
  "too_big",
  "avoidance",
  "low_energy",
  "interrupted",
  "overloaded",
]) as z.ZodType<TaskStuckReason>;
export const taskStuckActionSchema = z.enum([
  "clarify",
  "shrink",
  "downgrade",
  "reschedule",
  "recover",
]) as z.ZodType<TaskStuckAction>;
export const dayModeSchema = z.enum(["normal", "rescue", "recovery"]);
export const rescueReasonSchema = z.enum([
  "overload",
  "low_energy",
  "interruption",
  "missed_day",
]) as z.ZodType<RescueReason>;
const taskProtocolTextSchema = z.string().trim().max(300).nullable().optional();
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

export const recurrenceInputSchema = z.object({
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
});

export const priorityInputSchema = z.object({
  id: z.string().uuid().optional(),
  slot: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  title: z.string().trim().min(1).max(200),
  goalId: z.string().uuid().nullable().optional(),
});

export const dayPriorityInputSchema = z.object({
  id: z.string().uuid().optional(),
  slot: z.union([z.literal(1), z.literal(2)]),
  title: z.string().trim().min(1).max(200),
  goalId: z.string().uuid().nullable().optional(),
});

export const createGoalSchema = z.object({
  title: z.string().trim().min(1).max(200),
  domainId: entityIdSchema,
  horizonId: entityIdSchema.nullable().optional(),
  parentGoalId: entityIdSchema.nullable().optional(),
  why: z.string().max(2000).nullable().optional(),
  targetDate: isoDateSchema.nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  engagementState: goalEngagementStateSchema.nullable().optional(),
  weeklyProofText: z.string().max(500).nullable().optional(),
  knownObstacle: z.string().max(500).nullable().optional(),
  parkingRule: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateGoalSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    domainId: entityIdSchema.optional(),
    horizonId: entityIdSchema.nullable().optional(),
    parentGoalId: entityIdSchema.nullable().optional(),
    why: z.string().max(2000).nullable().optional(),
    status: goalStatusSchema.optional(),
    targetDate: isoDateSchema.nullable().optional(),
    notes: z.string().max(4000).nullable().optional(),
    engagementState: goalEngagementStateSchema.nullable().optional(),
    weeklyProofText: z.string().max(500).nullable().optional(),
    knownObstacle: z.string().max(500).nullable().optional(),
    parkingRule: z.string().max(500).nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

export const updateDayPrioritiesSchema = z.object({
  priorities: z.array(dayPriorityInputSchema).max(2),
});

export const updateWeekPrioritiesSchema = z.object({
  priorities: z.array(priorityInputSchema).max(3),
});

export const updateMonthFocusSchema = z.object({
  theme: z.string().max(200).nullable(),
  topOutcomes: z.array(priorityInputSchema).max(3),
});

export const goalsQuerySchema = z.object({
  domainId: entityIdSchema.optional(),
  horizonId: entityIdSchema.optional(),
  status: goalStatusSchema.optional(),
  date: isoDateSchema.optional(),
}) as z.ZodType<GoalsQuery>;

export const goalContextQuerySchema = z.object({
  date: isoDateSchema.optional(),
});

const goalDomainConfigInputSchema = z.object({
  id: entityIdSchema.optional(),
  systemKey: z.enum(["health", "money", "work_growth", "home_admin", "discipline", "other"]).nullable().optional(),
  name: z.string().trim().min(1).max(80),
  isArchived: z.boolean().optional(),
});

const goalHorizonConfigInputSchema = z.object({
  id: entityIdSchema.optional(),
  systemKey: z.enum(["life_vision", "five_year", "one_year", "quarter", "month"]).nullable().optional(),
  name: z.string().trim().min(1).max(80),
  spanMonths: z.number().int().positive().max(600).nullable().optional(),
  isArchived: z.boolean().optional(),
});

export const updateGoalDomainsSchema = z.object({
  domains: z.array(goalDomainConfigInputSchema).max(20),
}) as z.ZodType<UpdateGoalDomainsRequest>;

export const updateGoalHorizonsSchema = z.object({
  horizons: z.array(goalHorizonConfigInputSchema).max(10),
}) as z.ZodType<UpdateGoalHorizonsRequest>;

export const goalMilestoneInputSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  targetDate: isoDateSchema.nullable().optional(),
  status: goalMilestoneStatusSchema,
}) as z.ZodType<GoalMilestoneInput>;

export const updateGoalMilestonesSchema = z.object({
  milestones: z.array(goalMilestoneInputSchema).max(12),
});

export const updatePrioritySchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    status: priorityStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const plannerBlockTaskIdsSchema = z
  .array(z.string().uuid())
  .max(50)
  .superRefine((taskIds, context) => {
    const seen = new Set<string>();

    taskIds.forEach((taskId, index) => {
      if (seen.has(taskId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index],
          message: "Task ids must be unique",
        });
        return;
      }

      seen.add(taskId);
    });
  });

export const createDayPlannerBlockSchema = z.object({
  title: z.string().trim().max(120).nullable().optional(),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema,
  taskIds: plannerBlockTaskIdsSchema.optional(),
});

export const updateDayPlannerBlockSchema = z
  .object({
    title: z.string().trim().max(120).nullable().optional(),
    startsAt: isoDateTimeSchema.optional(),
    endsAt: isoDateTimeSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

export const replaceDayPlannerBlockTasksSchema = z.object({
  taskIds: plannerBlockTaskIdsSchema,
});

export const reorderDayPlannerBlocksSchema = z.object({
  blockIds: plannerBlockTaskIdsSchema,
});

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  notes: z.string().max(4000).nullable().optional(),
  kind: taskKindSchema.optional(),
  reminderAt: reminderAtSchema.nullable().optional(),
  scheduledForDate: isoDateSchema.nullable().optional(),
  dueAt: isoDateTimeSchema.nullable().optional(),
  goalId: z.string().uuid().nullable().optional(),
  originType: taskOriginSchema.optional(),
  recurrence: recurrenceInputSchema.optional(),
  carryPolicy: carryPolicySchema.optional(),
  nextAction: taskProtocolTextSchema,
  fiveMinuteVersion: taskProtocolTextSchema,
  estimatedDurationMinutes: z.number().int().min(1).max(480).nullable().optional(),
  likelyObstacle: taskProtocolTextSchema,
  focusLengthMinutes: z.number().int().min(5).max(180).nullable().optional(),
  progressState: taskProgressStateSchema.optional(),
  startedAt: isoDateTimeSchema.nullable().optional(),
});

export const updateTaskSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    notes: z.string().max(4000).nullable().optional(),
    kind: taskKindSchema.optional(),
    reminderAt: reminderAtSchema.nullable().optional(),
    status: taskStatusSchema.optional(),
    scheduledForDate: isoDateSchema.nullable().optional(),
    dueAt: isoDateTimeSchema.nullable().optional(),
    goalId: z.string().uuid().nullable().optional(),
    recurrence: recurrenceInputSchema.optional(),
    carryPolicy: carryPolicySchema.nullable().optional(),
    nextAction: taskProtocolTextSchema,
    fiveMinuteVersion: taskProtocolTextSchema,
    estimatedDurationMinutes: z.number().int().min(1).max(480).nullable().optional(),
    likelyObstacle: taskProtocolTextSchema,
    focusLengthMinutes: z.number().int().min(5).max(180).nullable().optional(),
    progressState: taskProgressStateSchema.optional(),
    startedAt: isoDateTimeSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

export const upsertDayLaunchSchema = z
  .object({
    mustWinTaskId: z.string().uuid().nullable().optional(),
    dayMode: dayModeSchema.optional(),
    rescueReason: rescueReasonSchema.nullable().optional(),
    energyRating: z.number().int().min(1).max(5).nullable().optional(),
    likelyDerailmentReason: taskStuckReasonSchema.nullable().optional(),
    likelyDerailmentNote: z.string().trim().max(300).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

export const logTaskStuckSchema = z.object({
  reason: taskStuckReasonSchema,
  actionTaken: taskStuckActionSchema,
  note: z.string().trim().max(300).nullable().optional(),
  targetDate: isoDateSchema.nullable().optional(),
});

const bulkTaskActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("schedule"),
    scheduledForDate: isoDateSchema,
  }),
  z.object({
    type: z.literal("carry_forward"),
    targetDate: isoDateSchema,
  }),
  z.object({
    type: z.literal("link_goal"),
    goalId: z.string().uuid().nullable(),
  }),
  z.object({
    type: z.literal("status"),
    status: taskStatusSchema,
  }),
  z.object({
    type: z.literal("archive"),
  }),
]);

export const bulkUpdateTasksSchema = z.object({
  taskIds: z
    .array(z.string().uuid())
    .min(1)
    .max(100)
    .superRefine((taskIds, context) => {
      const seen = new Set<string>();

      taskIds.forEach((taskId, index) => {
        if (seen.has(taskId)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index],
            message: "Task ids must be unique",
          });
          return;
        }

        seen.add(taskId);
      });
    }),
  action: bulkTaskActionSchema,
}) as z.ZodType<BulkUpdateTasksRequest>;

export const carryForwardTaskSchema = z.object({
  targetDate: isoDateSchema,
});

export const taskTemplateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

export const createTaskTemplateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  tasks: z.array(taskTemplateTaskSchema).min(1).max(20),
});

export const updateTaskTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().max(500).nullable().optional(),
    tasks: z.array(taskTemplateTaskSchema).min(1).max(20).optional(),
    archived: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

export const taskListQuerySchema = z
  .object({
    scheduledForDate: isoDateSchema.optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    status: taskStatusSchema.optional(),
    kind: taskKindSchema.optional(),
    cursor: z.string().min(1).max(500).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    includeSummary: z.enum(["true", "false"]).optional(),
    originType: taskOriginSchema.optional(),
    scheduledState: z.enum(["all", "scheduled", "unscheduled"]).optional(),
  })
  .refine(
    (value) =>
      !(value.scheduledForDate && (value.from || value.to)) &&
      !((value.from && !value.to) || (!value.from && value.to)),
    "Use either scheduledForDate or both from and to",
  );
