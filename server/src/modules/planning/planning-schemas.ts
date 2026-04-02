import type {
  BulkUpdateTasksRequest,
  GoalDomain,
  GoalMilestoneInput,
  GoalStatus,
  GoalsQuery,
  IsoDateString,
  PlanningTaskItem,
  RecurringTaskCarryPolicy,
  ReviewHistoryCadenceFilter,
  TaskKind,
} from "@life-os/contracts";
import { z } from "zod";

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/) as unknown as z.ZodType<IsoDateString>;
export const isoDateTimeSchema = z.string().datetime({ offset: true });
const reminderAtSchema = z.union([isoDateSchema, isoDateTimeSchema]);

export const goalDomainSchema = z.enum([
  "health",
  "money",
  "work_growth",
  "home_admin",
  "discipline",
  "other",
]) as z.ZodType<GoalDomain>;
export const goalStatusSchema = z.enum(["active", "paused", "completed", "archived"]) as z.ZodType<GoalStatus>;
export const goalMilestoneStatusSchema = z.enum(["pending", "completed"]);
export const priorityStatusSchema = z.enum(["pending", "completed", "dropped"]);
export const taskStatusSchema = z.enum(["pending", "completed", "dropped"]) as z.ZodType<PlanningTaskItem["status"]>;
export const taskKindSchema = z.enum(["task", "note", "reminder"]) as z.ZodType<TaskKind>;
export const taskOriginSchema = z.enum([
  "manual",
  "quick_capture",
  "carry_forward",
  "review_seed",
  "recurring",
  "template",
]) as z.ZodType<PlanningTaskItem["originType"]>;
export const carryPolicySchema = z.enum([
  "complete_and_clone",
  "move_due_date",
  "cancel",
]) as z.ZodType<RecurringTaskCarryPolicy>;
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
  title: z.string().min(1).max(200),
  goalId: z.string().uuid().nullable().optional(),
});

export const createGoalSchema = z.object({
  title: z.string().min(1).max(200),
  domain: goalDomainSchema,
  targetDate: isoDateSchema.nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
});

export const updateGoalSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    domain: goalDomainSchema.optional(),
    status: goalStatusSchema.optional(),
    targetDate: isoDateSchema.nullable().optional(),
    notes: z.string().max(4000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

export const updateDayPrioritiesSchema = z.object({
  priorities: z.array(priorityInputSchema).max(3),
});

export const updateWeekPrioritiesSchema = z.object({
  priorities: z.array(priorityInputSchema).max(3),
});

export const updateMonthFocusSchema = z.object({
  theme: z.string().max(200).nullable(),
  topOutcomes: z.array(priorityInputSchema).max(3),
});

export const goalsQuerySchema = z.object({
  domain: goalDomainSchema.optional(),
  status: goalStatusSchema.optional(),
  date: isoDateSchema.optional(),
}) as z.ZodType<GoalsQuery>;

export const goalContextQuerySchema = z.object({
  date: isoDateSchema.optional(),
});

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
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

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
