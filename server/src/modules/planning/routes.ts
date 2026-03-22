import type { FastifyPluginAsync } from "fastify";
import type {
  ApplyTaskTemplateResponse,
  BulkTaskMutationResponse,
  BulkUpdateTasksRequest,
  CreateGoalRequest,
  CreateTaskRequest,
  CreateTaskTemplateRequest,
  DayPlanResponse,
  GoalDomain,
  GoalDetailResponse,
  GoalItem,
  GoalLinkedHabitItem,
  GoalLinkedPriorityItem,
  GoalLinkedTaskItem,
  GoalMilestoneInput,
  GoalMilestoneItem,
  GoalMilestonesMutationResponse,
  GoalSummary,
  GoalMutationResponse,
  GoalsQuery,
  GoalStatus,
  GoalsResponse,
  IsoDateString,
  MonthFocusMutationResponse,
  MonthPlanResponse,
  PlanningPriorityInput,
  PlanningPriorityItem,
  PlanningPriorityMutationResponse,
  PriorityMutationResponse,
  PlanningTaskItem,
  TaskKind,
  TasksResponse,
  TaskMutationResponse,
  TaskTemplateItem,
  TaskTemplateMutationResponse,
  TaskTemplatesResponse,
  UpdateDayPrioritiesRequest,
  UpdateGoalRequest,
  UpdateMonthFocusRequest,
  UpdatePriorityRequest,
  UpdateTaskRequest,
  UpdateTaskTemplateRequest,
  UpdateWeekPrioritiesRequest,
  WeekPlanResponse,
  CarryForwardTaskRequest,
  RecurrenceInput,
  RecurringTaskCarryPolicy,
  UpdateGoalMilestonesRequest,
} from "@life-os/contracts";
import type {
  Goal,
  GoalDomain as PrismaGoalDomain,
  GoalMilestone,
  GoalMilestoneStatus as PrismaGoalMilestoneStatus,
  GoalStatus as PrismaGoalStatus,
  Habit,
  HabitStatus as PrismaHabitStatus,
  PlanningCycle,
  PlanningCycleType,
  PriorityStatus as PrismaPriorityStatus,
  Task,
  TaskKind as PrismaTaskKind,
  TaskOriginType as PrismaTaskOriginType,
  TaskStatus as PrismaTaskStatus,
  TaskTemplate,
} from "@prisma/client";
import { z } from "zod";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { AppError } from "../../lib/errors/app-error.js";
import { calculateHabitActiveStreak, calculateHabitRisk } from "../../lib/habits/guidance.js";
import { isHabitDueOnIsoDate, isHabitPermanentlyInactive, resolveHabitRecurrence } from "../../lib/habits/schedule.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { applyRecurringTaskCarryForward, materializeNextRecurringTaskOccurrence, materializeRecurringTasksInRange } from "../../lib/recurrence/tasks.js";
import { serializeRecurrenceDefinition, upsertRecurrenceRuleRecord } from "../../lib/recurrence/store.js";
import { addDays, getMonthEndDate, getMonthStartIsoDate, getWeekEndDate, getWeekStartIsoDate, parseIsoDate } from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import { getUserLocalDate, getUtcDateForLocalTime } from "../../lib/time/user-time.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import { buildGoalInsights } from "./goal-insights.js";
import { buildGoalNudges } from "./goal-nudges.js";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/) as unknown as z.ZodType<IsoDateString>;
const isoDateTimeSchema = z.string().datetime({ offset: true });
const reminderAtSchema = z.union([isoDateSchema, isoDateTimeSchema]);

const goalDomainSchema = z.enum([
  "health",
  "money",
  "work_growth",
  "home_admin",
  "discipline",
  "other",
]);
const goalStatusSchema = z.enum(["active", "paused", "completed", "archived"]);
const goalMilestoneStatusSchema = z.enum(["pending", "completed"]);
const priorityStatusSchema = z.enum(["pending", "completed", "dropped"]);
const taskStatusSchema = z.enum(["pending", "completed", "dropped"]);
const taskKindSchema = z.enum(["task", "note", "reminder"]);
const taskOriginSchema = z.enum([
  "manual",
  "quick_capture",
  "carry_forward",
  "review_seed",
  "recurring",
  "template",
]);
const carryPolicySchema = z.enum(["complete_and_clone", "move_due_date", "cancel"]);
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
});
const priorityInputSchema = z.object({
  id: z.string().uuid().optional(),
  slot: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  title: z.string().min(1).max(200),
  goalId: z.string().uuid().nullable().optional(),
});

const createGoalSchema = z.object({
  title: z.string().min(1).max(200),
  domain: goalDomainSchema,
  targetDate: isoDateSchema.nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
});

const updateGoalSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    domain: goalDomainSchema.optional(),
    status: goalStatusSchema.optional(),
    targetDate: isoDateSchema.nullable().optional(),
    notes: z.string().max(4000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const updateDayPrioritiesSchema = z.object({
  priorities: z.array(priorityInputSchema).max(3),
});

const updateWeekPrioritiesSchema = z.object({
  priorities: z.array(priorityInputSchema).max(3),
});

const updateMonthFocusSchema = z.object({
  theme: z.string().max(200).nullable(),
  topOutcomes: z.array(priorityInputSchema).max(3),
});

const goalsQuerySchema = z.object({
  domain: goalDomainSchema.optional(),
  status: goalStatusSchema.optional(),
  date: isoDateSchema.optional(),
});

const goalContextQuerySchema = z.object({
  date: isoDateSchema.optional(),
});

const goalMilestoneInputSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  targetDate: isoDateSchema.nullable().optional(),
  status: goalMilestoneStatusSchema,
});

const updateGoalMilestonesSchema = z.object({
  milestones: z.array(goalMilestoneInputSchema).max(12),
});

const updatePrioritySchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    status: priorityStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const createTaskSchema = z.object({
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

const updateTaskSchema = z
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
    type: z.literal("link_goal"),
    goalId: z.string().uuid().nullable(),
  }),
  z.object({
    type: z.literal("archive"),
  }),
]);

const bulkUpdateTasksSchema = z.object({
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
});

const carryForwardTaskSchema = z.object({
  targetDate: isoDateSchema,
});

const taskTemplateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

const createTaskTemplateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  tasks: z.array(taskTemplateTaskSchema).min(1).max(20),
});

const updateTaskTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().max(500).nullable().optional(),
    tasks: z.array(taskTemplateTaskSchema).min(1).max(20).optional(),
    archived: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const taskListQuerySchema = z
  .object({
    scheduledForDate: isoDateSchema.optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    status: taskStatusSchema.optional(),
    kind: taskKindSchema.optional(),
    originType: taskOriginSchema.optional(),
    scheduledState: z.enum(["all", "scheduled", "unscheduled"]).optional(),
  })
  .refine(
    (value) =>
      !(value.scheduledForDate && (value.from || value.to)) &&
      !((value.from && !value.to) || (!value.from && value.to)),
    "Use either scheduledForDate or both from and to",
  );

function toPrismaGoalDomain(domain: GoalDomain): PrismaGoalDomain {
  switch (domain) {
    case "health":
      return "HEALTH";
    case "money":
      return "MONEY";
    case "work_growth":
      return "WORK_GROWTH";
    case "home_admin":
      return "HOME_ADMIN";
    case "discipline":
      return "DISCIPLINE";
    case "other":
      return "OTHER";
  }
}

function fromPrismaGoalDomain(domain: PrismaGoalDomain): GoalDomain {
  switch (domain) {
    case "HEALTH":
      return "health";
    case "MONEY":
      return "money";
    case "WORK_GROWTH":
      return "work_growth";
    case "HOME_ADMIN":
      return "home_admin";
    case "DISCIPLINE":
      return "discipline";
    case "OTHER":
      return "other";
  }
}

function toPrismaGoalStatus(status: GoalStatus): PrismaGoalStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "paused":
      return "PAUSED";
    case "completed":
      return "COMPLETED";
    case "archived":
      return "ARCHIVED";
  }
}

function fromPrismaGoalStatus(status: PrismaGoalStatus): GoalStatus {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "PAUSED":
      return "paused";
    case "COMPLETED":
      return "completed";
    case "ARCHIVED":
      return "archived";
  }
}

function toPrismaGoalMilestoneStatus(status: GoalMilestoneInput["status"]): PrismaGoalMilestoneStatus {
  switch (status) {
    case "pending":
      return "PENDING";
    case "completed":
      return "COMPLETED";
  }
}

function fromPrismaGoalMilestoneStatus(status: PrismaGoalMilestoneStatus): GoalMilestoneItem["status"] {
  switch (status) {
    case "PENDING":
      return "pending";
    case "COMPLETED":
      return "completed";
  }
}

function fromPrismaPlanningCycleType(
  cycleType: PlanningCycleType,
): GoalLinkedPriorityItem["cycleType"] {
  switch (cycleType) {
    case "DAY":
      return "day";
    case "WEEK":
      return "week";
    case "MONTH":
      return "month";
  }
}

function fromPrismaHabitStatus(status: PrismaHabitStatus): GoalLinkedHabitItem["status"] {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "PAUSED":
      return "paused";
    case "ARCHIVED":
      return "archived";
  }
}

function fromPrismaPriorityStatus(status: PrismaPriorityStatus): PlanningPriorityItem["status"] {
  switch (status) {
    case "PENDING":
      return "pending";
    case "COMPLETED":
      return "completed";
    case "DROPPED":
      return "dropped";
  }
}

function toPrismaTaskStatus(status: PlanningTaskItem["status"]): PrismaTaskStatus {
  switch (status) {
    case "pending":
      return "PENDING";
    case "completed":
      return "COMPLETED";
    case "dropped":
      return "DROPPED";
  }
}

function fromPrismaTaskStatus(status: PrismaTaskStatus): PlanningTaskItem["status"] {
  switch (status) {
    case "PENDING":
      return "pending";
    case "COMPLETED":
      return "completed";
    case "DROPPED":
      return "dropped";
  }
}

function toPrismaTaskKind(kind: TaskKind): PrismaTaskKind {
  switch (kind) {
    case "task":
      return "TASK";
    case "note":
      return "NOTE";
    case "reminder":
      return "REMINDER";
  }
}

function fromPrismaTaskKind(kind: PrismaTaskKind): TaskKind {
  switch (kind) {
    case "TASK":
      return "task";
    case "NOTE":
      return "note";
    case "REMINDER":
      return "reminder";
  }
}

function toPrismaTaskOriginType(originType: PlanningTaskItem["originType"]): PrismaTaskOriginType {
  switch (originType) {
    case "manual":
      return "MANUAL";
    case "quick_capture":
      return "QUICK_CAPTURE";
    case "carry_forward":
      return "CARRY_FORWARD";
    case "review_seed":
      return "REVIEW_SEED";
    case "recurring":
      return "RECURRING";
    case "template":
      return "TEMPLATE";
  }
}

function fromPrismaTaskOriginType(originType: PrismaTaskOriginType): PlanningTaskItem["originType"] {
  switch (originType) {
    case "MANUAL":
      return "manual";
    case "QUICK_CAPTURE":
      return "quick_capture";
    case "CARRY_FORWARD":
      return "carry_forward";
    case "REVIEW_SEED":
      return "review_seed";
    case "RECURRING":
      return "recurring";
    case "TEMPLATE":
      return "template";
  }
}

function serializeGoal(goal: Goal): GoalItem {
  return {
    id: goal.id,
    title: goal.title,
    domain: fromPrismaGoalDomain(goal.domain),
    status: fromPrismaGoalStatus(goal.status),
    targetDate: goal.targetDate ? toIsoDateString(goal.targetDate) : null,
    notes: goal.notes,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
  };
}

function normalizeTaskTemplateDescription(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function isIsoDateInput(value: string): value is IsoDateString {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toTaskReminderAt(reminderAt: string | null | undefined, timezone?: string | null) {
  if (reminderAt === undefined) {
    return undefined;
  }

  if (reminderAt === null) {
    return null;
  }

  if (isIsoDateInput(reminderAt)) {
    return getUtcDateForLocalTime(reminderAt, "00:00", timezone);
  }

  return new Date(reminderAt);
}

async function getUserTimezone(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
) {
  const preferences = await app.prisma.userPreference.findUnique({
    where: {
      userId,
    },
    select: {
      timezone: true,
    },
  });

  return preferences?.timezone ?? null;
}

function resolveReminderAtForUpdate(
  payload: Pick<UpdateTaskRequest, "kind" | "reminderAt">,
  existingKind: PrismaTaskKind,
  timezone?: string | null,
) {
  const nextKind = payload.kind ? toPrismaTaskKind(payload.kind) : existingKind;

  if (nextKind !== "REMINDER") {
    return payload.kind !== undefined || payload.reminderAt !== undefined ? null : undefined;
  }

  return toTaskReminderAt(payload.reminderAt, timezone);
}

function parseTaskTemplateTasks(payload: unknown): TaskTemplateItem["tasks"] {
  return z.array(taskTemplateTaskSchema).parse(payload);
}

function compareTaskTemplates(left: TaskTemplate, right: TaskTemplate) {
  const leftLastApplied = left.lastAppliedAt?.getTime() ?? -1;
  const rightLastApplied = right.lastAppliedAt?.getTime() ?? -1;
  if (leftLastApplied !== rightLastApplied) {
    return rightLastApplied - leftLastApplied;
  }

  const updatedAtDiff = right.updatedAt.getTime() - left.updatedAt.getTime();
  if (updatedAtDiff !== 0) {
    return updatedAtDiff;
  }

  return left.name.localeCompare(right.name);
}

function serializeTaskTemplate(template: TaskTemplate): TaskTemplateItem {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    tasks: parseTaskTemplateTasks(template.templatePayloadJson),
    lastAppliedAt: template.lastAppliedAt?.toISOString() ?? null,
    archivedAt: template.archivedAt?.toISOString() ?? null,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

function serializeGoalSummary(goal: {
  id: string;
  title: string;
  domain: PrismaGoalDomain;
  status: PrismaGoalStatus;
}): GoalSummary {
  return {
    id: goal.id,
    title: goal.title,
    domain: fromPrismaGoalDomain(goal.domain),
    status: fromPrismaGoalStatus(goal.status),
  };
}

function serializePriority(priority: {
  id: string;
  slot: number;
  title: string;
  status: PrismaPriorityStatus;
  goalId: string | null;
  goal?: {
    id: string;
    title: string;
    domain: PrismaGoalDomain;
    status: PrismaGoalStatus;
  } | null;
  completedAt: Date | null;
}): PlanningPriorityItem {
  return {
    id: priority.id,
    slot: priority.slot as 1 | 2 | 3,
    title: priority.title,
    status: fromPrismaPriorityStatus(priority.status),
    goalId: priority.goalId,
    goal: priority.goal ? serializeGoalSummary(priority.goal) : null,
    completedAt: priority.completedAt?.toISOString() ?? null,
  };
}

function serializeTask(task: Task & {
  goal?: {
    id: string;
    title: string;
    domain: PrismaGoalDomain;
    status: PrismaGoalStatus;
  } | null;
  recurrenceRule?: Parameters<typeof serializeRecurrenceDefinition>[0];
}): PlanningTaskItem {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    kind: fromPrismaTaskKind(task.kind),
    reminderAt: task.reminderAt?.toISOString() ?? null,
    status: fromPrismaTaskStatus(task.status),
    scheduledForDate: task.scheduledForDate ? toIsoDateString(task.scheduledForDate) : null,
    dueAt: task.dueAt?.toISOString() ?? null,
    goalId: task.goalId,
    goal: task.goal ? serializeGoalSummary(task.goal) : null,
    originType: fromPrismaTaskOriginType(task.originType),
    carriedFromTaskId: task.carriedFromTaskId,
    recurrence: serializeRecurrenceDefinition(task.recurrenceRule),
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function serializeGoalMilestone(milestone: GoalMilestone): GoalMilestoneItem {
  return {
    id: milestone.id,
    goalId: milestone.goalId,
    title: milestone.title,
    targetDate: milestone.targetDate ? toIsoDateString(milestone.targetDate) : null,
    status: fromPrismaGoalMilestoneStatus(milestone.status),
    completedAt: milestone.completedAt?.toISOString() ?? null,
    sortOrder: milestone.sortOrder,
    createdAt: milestone.createdAt.toISOString(),
    updatedAt: milestone.updatedAt.toISOString(),
  };
}

function serializeGoalLinkedPriority(priority: {
  id: string;
  slot: number;
  title: string;
  status: PrismaPriorityStatus;
  completedAt: Date | null;
  planningCycle: {
    cycleType: PlanningCycleType;
    cycleStartDate: Date;
    cycleEndDate: Date;
  };
}): GoalLinkedPriorityItem {
  return {
    id: priority.id,
    slot: priority.slot as 1 | 2 | 3,
    title: priority.title,
    status: fromPrismaPriorityStatus(priority.status),
    completedAt: priority.completedAt?.toISOString() ?? null,
    cycleType: fromPrismaPlanningCycleType(priority.planningCycle.cycleType),
    cycleStartDate: toIsoDateString(priority.planningCycle.cycleStartDate),
    cycleEndDate: toIsoDateString(priority.planningCycle.cycleEndDate),
  };
}

function serializeGoalLinkedTask(task: Task): GoalLinkedTaskItem {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    kind: fromPrismaTaskKind(task.kind),
    reminderAt: task.reminderAt?.toISOString() ?? null,
    status: fromPrismaTaskStatus(task.status),
    scheduledForDate: task.scheduledForDate ? toIsoDateString(task.scheduledForDate) : null,
    dueAt: task.dueAt?.toISOString() ?? null,
    originType: fromPrismaTaskOriginType(task.originType),
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function buildBulkTaskUpdateData(
  task: Pick<Task, "kind">,
  action: BulkUpdateTasksRequest["action"],
  timezone?: string | null,
) {
  if (action.type === "schedule") {
    return {
      scheduledForDate: parseIsoDate(action.scheduledForDate),
      reminderAt:
        task.kind === "REMINDER" ? toTaskReminderAt(action.scheduledForDate, timezone) : undefined,
      reminderTriggeredAt: task.kind === "REMINDER" ? null : undefined,
    };
  }

  if (action.type === "link_goal") {
    return {
      goalId: action.goalId,
    };
  }

  return {
    status: toPrismaTaskStatus("dropped"),
    completedAt: null,
  };
}

function serializeGoalLinkedHabit(
  habit: Habit & {
    recurrenceRule?: {
      id?: string;
      ruleJson: unknown;
      exceptions?: Array<{ occurrenceDate: Date; action: unknown; targetDate: Date | null }>;
      carryPolicy?: unknown;
      legacyRuleText?: string | null;
    } | null;
    pauseWindows?: Array<{ startsOn: Date; endsOn: Date }>;
    checkins: Array<{ occurredOn: Date; status: "COMPLETED" | "SKIPPED" }>;
  },
  targetIsoDate: IsoDateString,
): GoalLinkedHabitItem {
  const recurrence = resolveHabitRecurrence(habit, targetIsoDate);
  const dueToday = isHabitPermanentlyInactive(habit)
    ? false
    : isHabitDueOnIsoDate(recurrence, targetIsoDate, habit.pauseWindows);
  const completedToday = habit.checkins.some(
    (checkin) => toIsoDateString(checkin.occurredOn) === targetIsoDate && checkin.status === "COMPLETED",
  );
  const risk: {
    level: GoalLinkedHabitItem["riskLevel"];
    message: string | null;
    completionRate7d: number;
  } = isHabitPermanentlyInactive(habit)
    ? {
        level: "none",
        message: null,
        completionRate7d: 100,
      }
    : calculateHabitRisk(habit.checkins, recurrence, targetIsoDate, habit.pauseWindows);

  return {
    id: habit.id,
    title: habit.title,
    category: habit.category,
    status: fromPrismaHabitStatus(habit.status),
    targetPerDay: habit.targetPerDay,
    dueToday,
    completedToday,
    streakCount: calculateHabitActiveStreak(habit.checkins, recurrence, targetIsoDate, habit.pauseWindows),
    completionRate7d: risk.completionRate7d,
    riskLevel: risk.level,
    riskMessage: risk.message,
  };
}

async function resolveGoalContext(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  requestedDate?: IsoDateString,
) {
  const preferences = await app.prisma.userPreference.findUnique({
    where: {
      userId,
    },
    select: {
      timezone: true,
      weekStartsOn: true,
    },
  });
  const contextIsoDate = requestedDate ?? getUserLocalDate(new Date(), preferences?.timezone);

  return {
    contextIsoDate,
    contextDate: parseIsoDate(contextIsoDate),
    weekStartsOn: preferences?.weekStartsOn ?? 1,
  };
}

function getCurrentGoalCycleFilters(contextIsoDate: IsoDateString, weekStartsOn: number) {
  const dayStartDate = parseIsoDate(contextIsoDate);
  const weekStartIsoDate = getWeekStartIsoDate(contextIsoDate, weekStartsOn);
  const monthStartIsoDate = getMonthStartIsoDate(contextIsoDate);

  return {
    dayStartDate,
    weekStartDate: parseIsoDate(weekStartIsoDate),
    monthStartDate: parseIsoDate(monthStartIsoDate),
  };
}

async function buildGoalOverviews(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  goals: Array<Goal & { milestones: GoalMilestone[] }>,
  context: Awaited<ReturnType<typeof resolveGoalContext>>,
) {
  if (goals.length === 0) {
    return [];
  }

  const goalIds = goals.map((goal) => goal.id);
  const currentCycleFilters = getCurrentGoalCycleFilters(context.contextIsoDate, context.weekStartsOn);
  const habitsCheckinStart = addDays(context.contextDate, -30);

  const [
    currentPriorities,
    pendingTasks,
    completedTasks,
    completedPriorities,
    linkedHabits,
  ] = await Promise.all([
    app.prisma.cyclePriority.findMany({
      where: {
        goalId: {
          in: goalIds,
        },
        planningCycle: {
          userId,
          OR: [
            {
              cycleType: "DAY",
              cycleStartDate: currentCycleFilters.dayStartDate,
            },
            {
              cycleType: "WEEK",
              cycleStartDate: currentCycleFilters.weekStartDate,
            },
            {
              cycleType: "MONTH",
              cycleStartDate: currentCycleFilters.monthStartDate,
            },
          ],
        },
      },
      include: {
        planningCycle: true,
      },
    }),
    app.prisma.task.findMany({
      where: {
        userId,
        goalId: {
          in: goalIds,
        },
        status: "PENDING",
      },
      select: {
        goalId: true,
        title: true,
        dueAt: true,
        scheduledForDate: true,
        createdAt: true,
      },
      orderBy: [{ dueAt: "asc" }, { scheduledForDate: "asc" }, { createdAt: "asc" }],
    }),
    app.prisma.task.findMany({
      where: {
        userId,
        goalId: {
          in: goalIds,
        },
        completedAt: {
          not: null,
        },
      },
      select: {
        goalId: true,
        completedAt: true,
      },
    }),
    app.prisma.cyclePriority.findMany({
      where: {
        goalId: {
          in: goalIds,
        },
        completedAt: {
          not: null,
        },
        planningCycle: {
          userId,
        },
      },
      select: {
        goalId: true,
        completedAt: true,
      },
    }),
    app.prisma.habit.findMany({
      where: {
        userId,
        goalId: {
          in: goalIds,
        },
      },
      include: {
        pauseWindows: {
          orderBy: {
            startsOn: "asc",
          },
        },
        recurrenceRule: {
          include: {
            exceptions: {
              orderBy: {
                occurrenceDate: "asc",
              },
            },
          },
        },
        checkins: {
          where: {
            occurredOn: {
              gte: habitsCheckinStart,
              lte: context.contextDate,
            },
          },
          orderBy: {
            occurredOn: "asc",
          },
        },
      },
    }),
  ]);

  const currentPriorityCounts = new Map<
    string,
    { currentDayPriorities: number; currentWeekPriorities: number; currentMonthPriorities: number }
  >();
  for (const priority of currentPriorities) {
    const counts = currentPriorityCounts.get(priority.goalId ?? "") ?? {
      currentDayPriorities: 0,
      currentWeekPriorities: 0,
      currentMonthPriorities: 0,
    };

    if (priority.planningCycle.cycleType === "DAY") {
      counts.currentDayPriorities += 1;
    } else if (priority.planningCycle.cycleType === "WEEK") {
      counts.currentWeekPriorities += 1;
    } else if (priority.planningCycle.cycleType === "MONTH") {
      counts.currentMonthPriorities += 1;
    }

    currentPriorityCounts.set(priority.goalId ?? "", counts);
  }

  const pendingTasksByGoal = new Map<string, typeof pendingTasks>();
  for (const task of pendingTasks) {
    if (!task.goalId) {
      continue;
    }

    const bucket = pendingTasksByGoal.get(task.goalId) ?? [];
    bucket.push(task);
    pendingTasksByGoal.set(task.goalId, bucket);
  }

  const completionDatesByGoal = new Map<string, Date[]>();
  for (const goal of goals) {
    completionDatesByGoal.set(
      goal.id,
      goal.milestones.flatMap((milestone) => (milestone.completedAt ? [milestone.completedAt] : [])),
    );
  }
  for (const task of completedTasks) {
    if (!task.goalId || !task.completedAt) {
      continue;
    }

    completionDatesByGoal.set(task.goalId, [...(completionDatesByGoal.get(task.goalId) ?? []), task.completedAt]);
  }
  for (const priority of completedPriorities) {
    if (!priority.goalId || !priority.completedAt) {
      continue;
    }

    completionDatesByGoal.set(
      priority.goalId,
      [...(completionDatesByGoal.get(priority.goalId) ?? []), priority.completedAt],
    );
  }

  const linkedHabitsByGoal = new Map<string, typeof linkedHabits>();
  for (const habit of linkedHabits) {
    if (!habit.goalId) {
      continue;
    }

    const bucket = linkedHabitsByGoal.get(habit.goalId) ?? [];
    bucket.push(habit);
    linkedHabitsByGoal.set(habit.goalId, bucket);
    const habitCompletionDates = habit.checkins
      .filter((checkin) => checkin.status === "COMPLETED")
      .map((checkin) => checkin.occurredOn);
    completionDatesByGoal.set(
      habit.goalId,
      [...(completionDatesByGoal.get(habit.goalId) ?? []), ...habitCompletionDates],
    );
  }

  return goals.map((goal) => {
    const goalHabits = linkedHabitsByGoal.get(goal.id) ?? [];
    const linkedHabitStates = goalHabits.map((habit) =>
      serializeGoalLinkedHabit(
        habit as Habit & {
          recurrenceRule?: {
            id?: string;
            ruleJson: unknown;
            exceptions?: Array<{ occurrenceDate: Date; action: unknown; targetDate: Date | null }>;
            carryPolicy?: unknown;
            legacyRuleText?: string | null;
          } | null;
          checkins: Array<{ occurredOn: Date; status: "COMPLETED" | "SKIPPED" }>;
        },
        context.contextIsoDate,
      ),
    );
    const insights = buildGoalInsights({
      goalStatus: fromPrismaGoalStatus(goal.status),
      targetDate: goal.targetDate,
      milestones: goal.milestones.map((milestone) => ({
        title: milestone.title,
        status: fromPrismaGoalMilestoneStatus(milestone.status),
        targetDate: milestone.targetDate,
        sortOrder: milestone.sortOrder,
      })),
      pendingTasks: (pendingTasksByGoal.get(goal.id) ?? []).map((task) => ({
        title: task.title,
        dueAt: task.dueAt,
        scheduledForDate: task.scheduledForDate,
        createdAt: task.createdAt,
      })),
      habits: linkedHabitStates.map((habit) => ({
        title: habit.title,
        dueToday: habit.dueToday,
        completedToday: habit.completedToday,
      })),
      completionDates: completionDatesByGoal.get(goal.id) ?? [],
      contextDate: context.contextDate,
    });
    const currentCounts = currentPriorityCounts.get(goal.id) ?? {
      currentDayPriorities: 0,
      currentWeekPriorities: 0,
      currentMonthPriorities: 0,
    };

    return {
      ...serializeGoal(goal),
      progressPercent: insights.progressPercent,
      health: insights.health,
      nextBestAction: insights.nextBestAction,
      milestoneCounts: insights.milestoneCounts,
      momentum: insights.momentum,
      linkedSummary: {
        ...currentCounts,
        pendingTasks: (pendingTasksByGoal.get(goal.id) ?? []).length,
        activeHabits: linkedHabitStates.filter((habit) => habit.status === "active").length,
        dueHabitsToday: linkedHabitStates.filter(
          (habit) => habit.status === "active" && habit.dueToday && !habit.completedToday,
        ).length,
      },
      lastActivityAt: insights.lastActivityAt,
    };
  });
}

function buildTodayLinkedGoalCounts(
  priorities: Array<{ goalId: string | null }>,
  tasks: Array<{ goalId: string | null }>,
) {
  const counts = new Map<string, { todayPriorityCount: number; todayTaskCount: number }>();

  for (const priority of priorities) {
    if (!priority.goalId) {
      continue;
    }

    const nextCounts = counts.get(priority.goalId) ?? {
      todayPriorityCount: 0,
      todayTaskCount: 0,
    };
    nextCounts.todayPriorityCount += 1;
    counts.set(priority.goalId, nextCounts);
  }

  for (const task of tasks) {
    if (!task.goalId) {
      continue;
    }

    const nextCounts = counts.get(task.goalId) ?? {
      todayPriorityCount: 0,
      todayTaskCount: 0,
    };
    nextCounts.todayTaskCount += 1;
    counts.set(task.goalId, nextCounts);
  }

  return counts;
}

async function replaceGoalMilestones(
  app: Parameters<FastifyPluginAsync>[0],
  goalId: string,
  milestones: GoalMilestoneInput[],
) {
  const existingMilestones = await app.prisma.goalMilestone.findMany({
    where: {
      goalId,
    },
    orderBy: {
      sortOrder: "asc",
    },
  });
  const existingById = new Map(existingMilestones.map((milestone) => [milestone.id, milestone]));
  const inputIds = milestones.flatMap((milestone) => (milestone.id ? [milestone.id] : []));

  if (new Set(inputIds).size !== inputIds.length) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Milestone IDs must be unique",
    });
  }

  for (const milestoneId of inputIds) {
    if (!existingById.has(milestoneId)) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Milestone not found",
      });
    }
  }

  await app.prisma.$transaction(async (tx) => {
    const keptIds = new Set(inputIds);
    const milestoneIdsToDelete = existingMilestones
      .filter((milestone) => !keptIds.has(milestone.id))
      .map((milestone) => milestone.id);

    if (milestoneIdsToDelete.length > 0) {
      await tx.goalMilestone.deleteMany({
        where: {
          id: {
            in: milestoneIdsToDelete,
          },
        },
      });
    }

    const referencedMilestones = milestones.filter(
      (milestone): milestone is GoalMilestoneInput & { id: string } => Boolean(milestone.id),
    );

    for (const [index, milestone] of referencedMilestones.entries()) {
      await tx.goalMilestone.update({
        where: {
          id: milestone.id,
        },
        data: {
          sortOrder: 100 + index,
        },
      });
    }

    for (const [index, milestone] of milestones.entries()) {
      const status = toPrismaGoalMilestoneStatus(milestone.status);
      const existingMilestone = milestone.id ? existingById.get(milestone.id) : null;
      const completedAt =
        status === "COMPLETED"
          ? existingMilestone?.completedAt ?? new Date()
          : null;
      const data = {
        title: milestone.title,
        targetDate:
          milestone.targetDate === undefined
            ? null
            : milestone.targetDate === null
              ? null
              : parseIsoDate(milestone.targetDate),
        status,
        completedAt,
        sortOrder: index + 1,
      };

      if (milestone.id) {
        await tx.goalMilestone.update({
          where: {
            id: milestone.id,
          },
          data,
        });
        continue;
      }

      await tx.goalMilestone.create({
        data: {
          goalId,
          ...data,
        },
      });
    }
  });

  const refreshed = await app.prisma.goalMilestone.findMany({
    where: {
      goalId,
    },
    orderBy: {
      sortOrder: "asc",
    },
  });

  return refreshed.map(serializeGoalMilestone);
}

async function ensurePlanningCycle(
  app: Parameters<FastifyPluginAsync>[0],
  input: {
    userId: string;
    cycleType: PlanningCycleType;
    cycleStartDate: Date;
    cycleEndDate: Date;
  },
) {
  return app.prisma.planningCycle.upsert({
    where: {
      userId_cycleType_cycleStartDate: {
        userId: input.userId,
        cycleType: input.cycleType,
        cycleStartDate: input.cycleStartDate,
      },
    },
    update: {
      cycleEndDate: input.cycleEndDate,
    },
    create: input,
    include: {
      priorities: {
        orderBy: {
          slot: "asc",
        },
        include: {
          goal: true,
        },
      },
    },
  });
}

async function syncTaskRecurrence(
  tx: any,
  taskId: string,
  recurrence: RecurrenceInput | undefined,
  carryPolicy: RecurringTaskCarryPolicy | null | undefined,
) {
  if (!recurrence) {
    return null;
  }

  const recurrenceRecord = await upsertRecurrenceRuleRecord(tx, {
    ownerType: "TASK",
    ownerId: taskId,
    recurrence,
    carryPolicy,
  });

  await tx.task.update({
    where: {
      id: taskId,
    },
    data: {
      recurrenceRuleId: recurrenceRecord.id,
    },
  });

  return recurrenceRecord;
}

async function replaceCyclePriorities(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  cycle: PlanningCycle,
  priorities: PlanningPriorityInput[],
) {
  const existing = await app.prisma.cyclePriority.findMany({
    where: {
      planningCycleId: cycle.id,
    },
    orderBy: {
      slot: "asc",
    },
  });
  const existingById = new Map(existing.map((priority) => [priority.id, priority]));
  const inputIds = priorities.flatMap((priority) => (priority.id ? [priority.id] : []));
  const uniqueInputIds = new Set(inputIds);
  const uniqueSlots = new Set(priorities.map((priority) => priority.slot));

  if (uniqueInputIds.size !== inputIds.length) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Priority IDs must be unique",
    });
  }

  if (uniqueSlots.size !== priorities.length) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Priority slots must be unique",
    });
  }

  for (const priorityId of inputIds) {
    if (!existingById.has(priorityId)) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Priority not found",
      });
    }
  }

  await Promise.all(priorities.map((priority) => assertOwnedGoalReference(app, userId, priority.goalId)));

  await app.prisma.$transaction(async (tx) => {
    const keptIds = new Set(inputIds);
    const priorityIdsToDelete = existing
      .filter((priority) => !keptIds.has(priority.id))
      .map((priority) => priority.id);

    if (priorityIdsToDelete.length > 0) {
      await tx.cyclePriority.deleteMany({
        where: {
          id: {
            in: priorityIdsToDelete,
          },
        },
      });
    }

    const referencedPriorities = priorities.filter(
      (priority): priority is PlanningPriorityInput & { id: string } => Boolean(priority.id),
    );

    for (const [index, priority] of referencedPriorities.entries()) {
      await tx.cyclePriority.update({
        where: {
          id: priority.id,
        },
        data: {
          slot: 100 + index,
        },
      });
    }

    for (const priority of priorities) {
      if (priority.id) {
        await tx.cyclePriority.update({
          where: {
            id: priority.id,
          },
          data: {
            slot: priority.slot,
            title: priority.title,
            goalId: priority.goalId ?? null,
          },
        });
        continue;
      }

      await tx.cyclePriority.create({
        data: {
          planningCycleId: cycle.id,
          slot: priority.slot,
          title: priority.title,
          goalId: priority.goalId ?? null,
        },
      });
    }
  });

  const refreshed = await app.prisma.cyclePriority.findMany({
    where: {
      planningCycleId: cycle.id,
    },
    orderBy: {
      slot: "asc",
    },
    include: {
      goal: true,
    },
  });

  return refreshed.map(serializePriority);
}

async function findOwnedGoal(app: Parameters<FastifyPluginAsync>[0], userId: string, goalId: string) {
  const goal = await app.prisma.goal.findFirst({
    where: {
      id: goalId,
      userId,
    },
  });

  if (!goal) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Goal not found",
    });
  }

  return goal;
}

async function assertOwnedGoalReference(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  goalId: string | null | undefined,
) {
  if (!goalId) {
    return;
  }

  await findOwnedGoal(app, userId, goalId);
}

async function findOwnedTask(app: Parameters<FastifyPluginAsync>[0], userId: string, taskId: string) {
  const task = await app.prisma.task.findFirst({
    where: {
      id: taskId,
      userId,
    },
  });

  if (!task) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Task not found",
    });
  }

  return task;
}

async function findOwnedTaskTemplate(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  taskTemplateId: string,
  options?: { activeOnly?: boolean },
) {
  const taskTemplate = await app.prisma.taskTemplate.findFirst({
    where: {
      id: taskTemplateId,
      userId,
      archivedAt: options?.activeOnly ? null : undefined,
    },
  });

  if (!taskTemplate) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Task template not found",
    });
  }

  return taskTemplate;
}

async function findOwnedPriority(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  priorityId: string,
) {
  const priority = await app.prisma.cyclePriority.findFirst({
    where: {
      id: priorityId,
      planningCycle: {
        userId,
      },
    },
  });

  if (!priority) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Priority not found",
    });
  }

  return priority;
}

export const registerPlanningRoutes: FastifyPluginAsync = async (app) => {
  app.get("/goals", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(goalsQuerySchema, request.query as GoalsQuery);
    const context = await resolveGoalContext(app, user.id, query.date);
    const goals = await app.prisma.goal.findMany({
      where: {
        userId: user.id,
        domain: query.domain ? toPrismaGoalDomain(query.domain) : undefined,
        status: query.status ? toPrismaGoalStatus(query.status) : undefined,
      },
      orderBy: [
        { status: "asc" },
        { createdAt: "desc" },
      ],
      include: {
        milestones: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });
    const goalOverviews = await buildGoalOverviews(app, user.id, goals, context);

    const response: GoalsResponse = withGeneratedAt({
      contextDate: context.contextIsoDate,
      goals: goalOverviews,
    });

    return reply.send(response);
  });

  app.post("/goals", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createGoalSchema, request.body as CreateGoalRequest);
    const goal = await app.prisma.goal.create({
      data: {
        userId: user.id,
        title: payload.title,
        domain: toPrismaGoalDomain(payload.domain),
        targetDate: payload.targetDate ? parseIsoDate(payload.targetDate) : null,
        notes: payload.notes ?? null,
      },
    });

    const response: GoalMutationResponse = withGeneratedAt({
      goal: serializeGoal(goal),
    });

    return reply.status(201).send(response);
  });

  app.get("/goals/:goalId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { goalId } = request.params as { goalId: string };
    const query = parseOrThrow(goalContextQuerySchema, request.query);
    const context = await resolveGoalContext(app, user.id, query.date);
    const goal = await app.prisma.goal.findFirst({
      where: {
        id: goalId,
        userId: user.id,
      },
      include: {
        milestones: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });

    if (!goal) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Goal not found",
      });
    }

    const [overview] = await buildGoalOverviews(app, user.id, [goal], context);
    const currentCycleFilters = getCurrentGoalCycleFilters(context.contextIsoDate, context.weekStartsOn);
    const habitsCheckinStart = addDays(context.contextDate, -30);
    const [linkedPriorities, linkedTasks, linkedHabits] = await Promise.all([
      app.prisma.cyclePriority.findMany({
        where: {
          goalId,
          planningCycle: {
            userId: user.id,
            OR: [
              {
                cycleType: "DAY",
                cycleStartDate: currentCycleFilters.dayStartDate,
              },
              {
                cycleType: "WEEK",
                cycleStartDate: currentCycleFilters.weekStartDate,
              },
              {
                cycleType: "MONTH",
                cycleStartDate: currentCycleFilters.monthStartDate,
              },
            ],
          },
        },
        include: {
          planningCycle: true,
        },
        orderBy: [{ planningCycle: { cycleStartDate: "asc" } }, { slot: "asc" }],
      }),
      app.prisma.task.findMany({
        where: {
          userId: user.id,
          goalId,
          status: "PENDING",
        },
        orderBy: [{ dueAt: "asc" }, { scheduledForDate: "asc" }, { createdAt: "asc" }],
        take: 5,
      }),
      app.prisma.habit.findMany({
        where: {
          userId: user.id,
          goalId,
          status: "ACTIVE",
        },
      include: {
          pauseWindows: {
            orderBy: {
              startsOn: "asc",
            },
          },
          recurrenceRule: {
            include: {
              exceptions: {
                orderBy: {
                  occurrenceDate: "asc",
                },
              },
            },
          },
          checkins: {
            where: {
              occurredOn: {
                gte: habitsCheckinStart,
                lte: context.contextDate,
              },
            },
            orderBy: {
              occurredOn: "asc",
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
    ]);

    const response: GoalDetailResponse = withGeneratedAt({
      contextDate: context.contextIsoDate,
      goal: {
        ...overview,
        milestones: goal.milestones.map(serializeGoalMilestone),
        linkedPriorities: linkedPriorities.map(serializeGoalLinkedPriority),
        linkedTasks: linkedTasks.map(serializeGoalLinkedTask),
        linkedHabits: linkedHabits.map((habit) =>
          serializeGoalLinkedHabit(
            habit as Habit & {
              recurrenceRule?: {
                id?: string;
                ruleJson: unknown;
                exceptions?: Array<{ occurrenceDate: Date; action: unknown; targetDate: Date | null }>;
                carryPolicy?: unknown;
                legacyRuleText?: string | null;
              } | null;
              checkins: Array<{ occurredOn: Date; status: "COMPLETED" | "SKIPPED" }>;
            },
            context.contextIsoDate,
          ),
        ),
      },
    });

    return reply.send(response);
  });

  app.patch("/goals/:goalId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(updateGoalSchema, request.body as UpdateGoalRequest);
    const { goalId } = request.params as { goalId: string };
    await findOwnedGoal(app, user.id, goalId);

    const goal = await app.prisma.goal.update({
      where: {
        id: goalId,
      },
      data: {
        title: payload.title,
        domain: payload.domain ? toPrismaGoalDomain(payload.domain) : undefined,
        status: payload.status ? toPrismaGoalStatus(payload.status) : undefined,
        targetDate:
          payload.targetDate === undefined
            ? undefined
            : payload.targetDate === null
              ? null
              : parseIsoDate(payload.targetDate),
        notes: payload.notes,
      },
    });

    const response: GoalMutationResponse = withGeneratedAt({
      goal: serializeGoal(goal),
    });

    return reply.send(response);
  });

  app.put("/goals/:goalId/milestones", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { goalId } = request.params as { goalId: string };
    const payload = parseOrThrow(
      updateGoalMilestonesSchema,
      request.body as UpdateGoalMilestonesRequest,
    );
    await findOwnedGoal(app, user.id, goalId);
    const milestones = await replaceGoalMilestones(app, goalId, payload.milestones);

    const response: GoalMilestonesMutationResponse = withGeneratedAt({
      milestones,
    });

    return reply.send(response);
  });

  app.get("/planning/days/:date", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { date } = request.params as { date: IsoDateString };
    const parsedDate = parseOrThrow(isoDateSchema, date);
    const cycleStartDate = parseIsoDate(parsedDate);
    const goalContext = await resolveGoalContext(app, user.id, parsedDate);
    await materializeRecurringTasksInRange(app.prisma, user.id, cycleStartDate, cycleStartDate);
    const cycle = await ensurePlanningCycle(app, {
      userId: user.id,
      cycleType: "DAY",
      cycleStartDate,
      cycleEndDate: cycleStartDate,
    });
    const tasks = await app.prisma.task.findMany({
      where: {
        userId: user.id,
        scheduledForDate: cycleStartDate,
      },
      orderBy: [
        { status: "asc" },
        { createdAt: "asc" },
      ],
      include: {
        goal: true,
        recurrenceRule: {
          include: {
            exceptions: {
              orderBy: {
                occurrenceDate: "asc",
              },
            },
          },
        },
      },
    });
    const activeGoals = await app.prisma.goal.findMany({
      where: {
        userId: user.id,
        status: "ACTIVE",
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        milestones: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });
    const goalOverviews = await buildGoalOverviews(app, user.id, activeGoals, goalContext);
    const todayLinkedGoalCounts = buildTodayLinkedGoalCounts(cycle.priorities, tasks);
    const goalNudges = buildGoalNudges(
      goalOverviews.map((goal) => {
        const todayCounts = todayLinkedGoalCounts.get(goal.id) ?? {
          todayPriorityCount: 0,
          todayTaskCount: 0,
        };

        return {
          goal: {
            id: goal.id,
            title: goal.title,
            domain: goal.domain,
            status: goal.status,
          },
          health: goal.health,
          progressPercent: goal.progressPercent,
          nextBestAction: goal.nextBestAction,
          targetDate: goal.targetDate ? parseIsoDate(goal.targetDate) : null,
          lastActivityAt: goal.lastActivityAt,
          todayPriorityCount: todayCounts.todayPriorityCount,
          todayTaskCount: todayCounts.todayTaskCount,
        };
      }),
    );

    const response: DayPlanResponse = withGeneratedAt({
      date: parsedDate,
      priorities: cycle.priorities.map(serializePriority),
      tasks: tasks.map(serializeTask),
      goalNudges,
    });

    return reply.send(response);
  });

  app.put("/planning/days/:date/priorities", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { date } = request.params as { date: IsoDateString };
    const parsedDate = parseOrThrow(isoDateSchema, date);
    const payload = parseOrThrow(updateDayPrioritiesSchema, request.body as UpdateDayPrioritiesRequest);
    const cycleStartDate = parseIsoDate(parsedDate);
    const cycle = await ensurePlanningCycle(app, {
      userId: user.id,
      cycleType: "DAY",
      cycleStartDate,
      cycleEndDate: cycleStartDate,
    });
    const priorities = await replaceCyclePriorities(app, user.id, cycle, payload.priorities);

    const response: PlanningPriorityMutationResponse = withGeneratedAt({
      priorities,
    });

    return reply.send(response);
  });

  app.patch("/planning/priorities/:priorityId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { priorityId } = request.params as { priorityId: string };
    const payload = parseOrThrow(updatePrioritySchema, request.body as UpdatePriorityRequest);

    await findOwnedPriority(app, user.id, priorityId);

    const priority = await app.prisma.cyclePriority.update({
      where: {
        id: priorityId,
      },
      data: {
        title: payload.title,
        status:
          payload.status === undefined
            ? undefined
            : payload.status === "completed"
              ? "COMPLETED"
              : payload.status === "dropped"
                ? "DROPPED"
                : "PENDING",
        completedAt:
          payload.status === "completed"
            ? new Date()
            : payload.status === "pending" || payload.status === "dropped"
              ? null
              : undefined,
      },
    });

    const response: PriorityMutationResponse = withGeneratedAt({
      priority: serializePriority(priority),
    });

    return reply.send(response);
  });

  app.get("/planning/weeks/:startDate", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { startDate } = request.params as { startDate: IsoDateString };
    const parsedDate = parseOrThrow(isoDateSchema, startDate);
    const cycleStartDate = parseIsoDate(parsedDate);
    const cycle = await ensurePlanningCycle(app, {
      userId: user.id,
      cycleType: "WEEK",
      cycleStartDate,
      cycleEndDate: getWeekEndDate(cycleStartDate),
    });

    const response: WeekPlanResponse = withGeneratedAt({
      startDate: parsedDate,
      endDate: toIsoDateString(cycle.cycleEndDate),
      priorities: cycle.priorities.map(serializePriority),
    });

    return reply.send(response);
  });

  app.put("/planning/weeks/:startDate/priorities", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { startDate } = request.params as { startDate: IsoDateString };
    const parsedDate = parseOrThrow(isoDateSchema, startDate);
    const payload = parseOrThrow(updateWeekPrioritiesSchema, request.body as UpdateWeekPrioritiesRequest);
    const cycleStartDate = parseIsoDate(parsedDate);
    const cycle = await ensurePlanningCycle(app, {
      userId: user.id,
      cycleType: "WEEK",
      cycleStartDate,
      cycleEndDate: getWeekEndDate(cycleStartDate),
    });
    const priorities = await replaceCyclePriorities(app, user.id, cycle, payload.priorities);

    const response: PlanningPriorityMutationResponse = withGeneratedAt({
      priorities,
    });

    return reply.send(response);
  });

  app.get("/planning/months/:startDate", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { startDate } = request.params as { startDate: IsoDateString };
    const parsedDate = parseOrThrow(isoDateSchema, startDate);
    const cycleStartDate = parseIsoDate(parsedDate);
    const cycle = await ensurePlanningCycle(app, {
      userId: user.id,
      cycleType: "MONTH",
      cycleStartDate,
      cycleEndDate: getMonthEndDate(cycleStartDate),
    });

    const response: MonthPlanResponse = withGeneratedAt({
      startDate: parsedDate,
      endDate: toIsoDateString(cycle.cycleEndDate),
      theme: cycle.theme,
      topOutcomes: cycle.priorities.map(serializePriority),
    });

    return reply.send(response);
  });

  app.put("/planning/months/:startDate/focus", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { startDate } = request.params as { startDate: IsoDateString };
    const parsedDate = parseOrThrow(isoDateSchema, startDate);
    const payload = parseOrThrow(updateMonthFocusSchema, request.body as UpdateMonthFocusRequest);
    const cycleStartDate = parseIsoDate(parsedDate);
    const cycle = await ensurePlanningCycle(app, {
      userId: user.id,
      cycleType: "MONTH",
      cycleStartDate,
      cycleEndDate: getMonthEndDate(cycleStartDate),
    });

    await app.prisma.planningCycle.update({
      where: {
        id: cycle.id,
      },
      data: {
        theme: payload.theme,
      },
    });

    const topOutcomes = await replaceCyclePriorities(app, user.id, cycle, payload.topOutcomes);

    const response: MonthFocusMutationResponse = withGeneratedAt({
      theme: payload.theme,
      topOutcomes,
    });

    return reply.send(response);
  });

  app.get("/task-templates", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const taskTemplates = await app.prisma.taskTemplate.findMany({
      where: {
        userId: user.id,
        archivedAt: null,
      },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    });

    const response: TaskTemplatesResponse = withGeneratedAt({
      taskTemplates: [...taskTemplates].sort(compareTaskTemplates).map(serializeTaskTemplate),
    });

    return reply.send(response);
  });

  app.post("/task-templates", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createTaskTemplateSchema, request.body as CreateTaskTemplateRequest);
    const taskTemplate = await app.prisma.taskTemplate.create({
      data: {
        userId: user.id,
        name: payload.name,
        description: normalizeTaskTemplateDescription(payload.description),
        templatePayloadJson: payload.tasks.map((task) => ({ title: task.title })),
      },
    });

    const response: TaskTemplateMutationResponse = withGeneratedAt({
      taskTemplate: serializeTaskTemplate(taskTemplate),
    });

    return reply.status(201).send(response);
  });

  app.patch("/task-templates/:taskTemplateId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(updateTaskTemplateSchema, request.body as UpdateTaskTemplateRequest);
    const { taskTemplateId } = request.params as { taskTemplateId: string };
    await findOwnedTaskTemplate(app, user.id, taskTemplateId);

    const taskTemplate = await app.prisma.taskTemplate.update({
      where: {
        id: taskTemplateId,
      },
      data: {
        name: payload.name,
        description:
          payload.description === undefined
            ? undefined
            : normalizeTaskTemplateDescription(payload.description),
        templatePayloadJson:
          payload.tasks === undefined
            ? undefined
            : payload.tasks.map((task) => ({ title: task.title })),
        archivedAt:
          payload.archived === undefined ? undefined : payload.archived ? new Date() : null,
      },
    });

    const response: TaskTemplateMutationResponse = withGeneratedAt({
      taskTemplate: serializeTaskTemplate(taskTemplate),
    });

    return reply.send(response);
  });

  app.post("/task-templates/:taskTemplateId/apply", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { taskTemplateId } = request.params as { taskTemplateId: string };
    const taskTemplate = await findOwnedTaskTemplate(app, user.id, taskTemplateId, {
      activeOnly: true,
    });
    const templateTasks = parseTaskTemplateTasks(taskTemplate.templatePayloadJson);
    const appliedAt = new Date();

    const result = await app.prisma.$transaction(async (tx) => {
      const tasks = await Promise.all(
        templateTasks.map((templateTask) =>
          tx.task.create({
            data: {
              userId: user.id,
              title: templateTask.title,
              originType: "TEMPLATE",
            },
          }),
        ),
      );
      const updatedTaskTemplate = await tx.taskTemplate.update({
        where: {
          id: taskTemplate.id,
        },
        data: {
          lastAppliedAt: appliedAt,
        },
      });

      return {
        tasks,
        taskTemplate: updatedTaskTemplate,
      };
    });

    const response: ApplyTaskTemplateResponse = withGeneratedAt({
      taskTemplate: serializeTaskTemplate(result.taskTemplate),
      tasks: result.tasks.map(serializeTask),
    });

    return reply.status(201).send(response);
  });

  app.get("/tasks", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(taskListQuerySchema, request.query);
    const scheduledForDate = query.scheduledForDate ? parseIsoDate(query.scheduledForDate) : null;
    const fromDate = query.from ? parseIsoDate(query.from) : null;
    const toDateExclusive = query.to ? addDays(parseIsoDate(query.to), 1) : null;
    const scheduledDateFilter =
      scheduledForDate
        ? scheduledForDate
        : fromDate && toDateExclusive
          ? {
              gte: fromDate,
              lt: toDateExclusive,
            }
          : query.scheduledState === "scheduled"
            ? { not: null }
            : query.scheduledState === "unscheduled"
              ? null
              : undefined;
    if (scheduledForDate) {
      await materializeRecurringTasksInRange(app.prisma, user.id, scheduledForDate, scheduledForDate);
    } else if (fromDate && toDateExclusive) {
      await materializeRecurringTasksInRange(app.prisma, user.id, fromDate, addDays(toDateExclusive, -1));
    }
    const tasks = await app.prisma.task.findMany({
      where: {
        userId: user.id,
        status: query.status ? toPrismaTaskStatus(query.status) : undefined,
        kind: query.kind ? toPrismaTaskKind(query.kind) : undefined,
        originType: query.originType ? toPrismaTaskOriginType(query.originType) : undefined,
        scheduledForDate: scheduledDateFilter,
      },
      orderBy: [{ scheduledForDate: "asc" }, { createdAt: "asc" }],
      include: {
        goal: true,
        recurrenceRule: {
          include: {
            exceptions: {
              orderBy: {
                occurrenceDate: "asc",
              },
            },
          },
        },
      },
    });

    const response: TasksResponse = withGeneratedAt({
      tasks: tasks.map(serializeTask),
    });

    return reply.send(response);
  });

  app.post("/tasks", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createTaskSchema, request.body as CreateTaskRequest);
    await assertOwnedGoalReference(app, user.id, payload.goalId);
    const timezone = await getUserTimezone(app, user.id);
    const task = await app.prisma.$transaction(async (tx) => {
      const createdTask = await tx.task.create({
        data: {
          userId: user.id,
          title: payload.title,
          notes: payload.notes ?? null,
          kind: toPrismaTaskKind(payload.kind ?? "task"),
          reminderAt:
            payload.kind === "reminder" ? (toTaskReminderAt(payload.reminderAt, timezone) ?? null) : null,
          scheduledForDate: payload.scheduledForDate ? parseIsoDate(payload.scheduledForDate) : null,
          dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
          goalId: payload.goalId ?? null,
          originType: toPrismaTaskOriginType(
            payload.recurrence ? "recurring" : (payload.originType ?? "manual"),
          ),
        },
      });

      await syncTaskRecurrence(tx, createdTask.id, payload.recurrence, payload.carryPolicy);

      return tx.task.findUniqueOrThrow({
        where: {
          id: createdTask.id,
        },
        include: {
          goal: true,
          recurrenceRule: {
            include: {
              exceptions: {
                orderBy: {
                  occurrenceDate: "asc",
                },
              },
            },
          },
        },
      });
    });

    const response: TaskMutationResponse = withGeneratedAt({
      task: serializeTask(task),
    });

    return reply.status(201).send(response);
  });

  app.patch("/tasks/bulk", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(bulkUpdateTasksSchema, request.body as BulkUpdateTasksRequest);
    const timezone = await getUserTimezone(app, user.id);

    if (payload.action.type === "link_goal") {
      await assertOwnedGoalReference(app, user.id, payload.action.goalId);
    }

    const existingTasks = await app.prisma.task.findMany({
      where: {
        id: {
          in: payload.taskIds,
        },
        userId: user.id,
      },
      select: {
        id: true,
        kind: true,
      },
    });

    if (existingTasks.length !== payload.taskIds.length) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Task not found",
      });
    }

    const taskById = new Map(existingTasks.map((task) => [task.id, task]));

    const tasks = await app.prisma.$transaction(async (tx) => {
      await Promise.all(
        payload.taskIds.map((taskId) => {
          const task = taskById.get(taskId);

          if (!task) {
            throw new AppError({
              statusCode: 404,
              code: "NOT_FOUND",
              message: "Task not found",
            });
          }

          return tx.task.update({
            where: {
              id: taskId,
            },
            data: buildBulkTaskUpdateData(task, payload.action, timezone),
          });
        }),
      );

      return tx.task.findMany({
        where: {
          id: {
            in: payload.taskIds,
          },
        },
        include: {
          goal: true,
          recurrenceRule: {
            include: {
              exceptions: {
                orderBy: {
                  occurrenceDate: "asc",
                },
              },
            },
          },
        },
      });
    });

    const serializedTasksById = new Map(tasks.map((task) => [task.id, serializeTask(task)]));
    const response: BulkTaskMutationResponse = withGeneratedAt({
      tasks: payload.taskIds
        .map((taskId) => serializedTasksById.get(taskId))
        .filter((task): task is PlanningTaskItem => Boolean(task)),
    });

    return reply.send(response);
  });

  app.patch("/tasks/:taskId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(updateTaskSchema, request.body as UpdateTaskRequest);
    const { taskId } = request.params as { taskId: string };
    const timezone = await getUserTimezone(app, user.id);
    const existingTask = await app.prisma.task.findFirst({
      where: {
        id: taskId,
        userId: user.id,
      },
      include: {
        recurrenceRule: {
          include: {
            exceptions: {
              orderBy: {
                occurrenceDate: "asc",
              },
            },
          },
        },
      },
    });
    if (!existingTask) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Task not found",
      });
    }
    await assertOwnedGoalReference(app, user.id, payload.goalId);
    const task = await app.prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: {
          id: taskId,
        },
        data: {
          title: payload.title,
          notes: payload.notes,
          kind: payload.kind ? toPrismaTaskKind(payload.kind) : undefined,
          reminderAt: resolveReminderAtForUpdate(payload, existingTask.kind, timezone),
          reminderTriggeredAt:
            payload.kind !== undefined || payload.reminderAt !== undefined ? null : undefined,
          status: payload.status ? toPrismaTaskStatus(payload.status) : undefined,
          scheduledForDate:
            payload.scheduledForDate === undefined
              ? undefined
              : payload.scheduledForDate === null
                ? null
                : parseIsoDate(payload.scheduledForDate),
          dueAt:
            payload.dueAt === undefined ? undefined : payload.dueAt === null ? null : new Date(payload.dueAt),
          goalId: payload.goalId,
          completedAt:
            payload.status === "completed"
              ? new Date()
              : payload.status === "pending" || payload.status === "dropped"
                ? null
                : undefined,
          originType:
            payload.recurrence || existingTask.recurrenceRuleId
              ? toPrismaTaskOriginType("recurring")
              : undefined,
        },
      });

      await syncTaskRecurrence(
        tx,
        taskId,
        payload.recurrence,
        payload.carryPolicy === undefined ? undefined : payload.carryPolicy,
      );

      if (payload.status === "completed" && existingTask.recurrenceRuleId && existingTask.scheduledForDate) {
        await materializeNextRecurringTaskOccurrence(
          tx,
          user.id,
          existingTask.recurrenceRuleId,
          toIsoDateString(existingTask.scheduledForDate),
        );
      }

      return tx.task.findUniqueOrThrow({
        where: {
          id: taskId,
        },
        include: {
          goal: true,
          recurrenceRule: {
            include: {
              exceptions: {
                orderBy: {
                  occurrenceDate: "asc",
                },
              },
            },
          },
        },
      });
    });

    const response: TaskMutationResponse = withGeneratedAt({
      task: serializeTask(task),
    });

    return reply.send(response);
  });

  app.post("/tasks/:taskId/carry-forward", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(carryForwardTaskSchema, request.body as CarryForwardTaskRequest);
    const { taskId } = request.params as { taskId: string };
    const timezone = await getUserTimezone(app, user.id);
    const existingTask = await app.prisma.task.findFirst({
      where: {
        id: taskId,
        userId: user.id,
      },
      include: {
        goal: true,
        recurrenceRule: {
          include: {
            exceptions: {
              orderBy: {
                occurrenceDate: "asc",
              },
            },
          },
        },
      },
    });
    if (!existingTask) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Task not found",
      });
    }

    const task = await app.prisma.$transaction(async (tx) => {
      if (existingTask.recurrenceRuleId) {
        const recurringTask = await applyRecurringTaskCarryForward(
          tx,
          user.id,
          existingTask,
          payload.targetDate,
        );
        if (recurringTask) {
          return recurringTask;
        }
      }

      await tx.task.update({
        where: {
          id: existingTask.id,
        },
        data: {
          status: "DROPPED",
        },
      });

      return tx.task.create({
        data: {
          userId: user.id,
          title: existingTask.title,
          notes: existingTask.notes,
          kind: existingTask.kind,
          reminderAt:
            existingTask.kind === "REMINDER"
              ? toTaskReminderAt(payload.targetDate, timezone) ?? null
              : existingTask.reminderAt,
          reminderTriggeredAt: null,
          scheduledForDate: parseIsoDate(payload.targetDate),
          dueAt: existingTask.dueAt,
          goalId: existingTask.goalId,
          originType: "CARRY_FORWARD",
          carriedFromTaskId: existingTask.id,
        },
        include: {
          goal: true,
          recurrenceRule: {
            include: {
              exceptions: {
                orderBy: {
                  occurrenceDate: "asc",
                },
              },
            },
          },
        },
      });
    });

    const response: TaskMutationResponse = withGeneratedAt({
      task: serializeTask(task),
    });

    return reply.status(201).send(response);
  });
};
