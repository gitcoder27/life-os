import type {
  GoalDomain,
  GoalItem,
  GoalLinkedHabitItem,
  GoalLinkedPriorityItem,
  GoalLinkedTaskItem,
  GoalMilestoneInput,
  GoalMilestoneItem,
  GoalStatus,
  GoalSummary,
  IsoDateString,
  PlanningPriorityItem,
  PlanningTaskItem,
  TaskKind,
  TaskTemplateItem,
} from "@life-os/contracts";
import type {
  Goal,
  GoalDomain as PrismaGoalDomain,
  GoalMilestone,
  GoalMilestoneStatus as PrismaGoalMilestoneStatus,
  GoalStatus as PrismaGoalStatus,
  Habit,
  HabitStatus as PrismaHabitStatus,
  PlanningCycleType,
  PriorityStatus as PrismaPriorityStatus,
  Task,
  TaskKind as PrismaTaskKind,
  TaskOriginType as PrismaTaskOriginType,
  TaskStatus as PrismaTaskStatus,
  TaskTemplate,
} from "@prisma/client";
import { z } from "zod";

import { calculateHabitActiveStreak, calculateHabitRisk } from "../../lib/habits/guidance.js";
import { isHabitDueOnIsoDate, isHabitPermanentlyInactive, resolveHabitRecurrence } from "../../lib/habits/schedule.js";
import { serializeRecurrenceDefinition } from "../../lib/recurrence/store.js";
import { toIsoDateString } from "../../lib/time/date.js";
import { taskTemplateTaskSchema } from "./planning-schemas.js";

type GoalSummaryRecord = {
  id: string;
  title: string;
  domain: PrismaGoalDomain;
  status: PrismaGoalStatus;
};

type SerializedRecurrenceRule = Parameters<typeof serializeRecurrenceDefinition>[0];

type PlanningTaskRecord = Task & {
  goal?: GoalSummaryRecord | null;
  recurrenceRule?: SerializedRecurrenceRule;
};

type DayPlannerBlockRecord = {
  id: string;
  title: string | null;
  startsAt: Date;
  endsAt: Date;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  taskLinks: Array<{
    taskId: string;
    sortOrder: number;
    task: PlanningTaskRecord;
  }>;
};

export type GoalLinkedHabitRecord = Habit & {
  recurrenceRule?: {
    id?: string;
    ruleJson: unknown;
    exceptions?: Array<{ occurrenceDate: Date; action: unknown; targetDate: Date | null }>;
    carryPolicy?: unknown;
    legacyRuleText?: string | null;
  } | null;
  pauseWindows?: Array<{ startsOn: Date; endsOn: Date }>;
  checkins: Array<{ occurredOn: Date; status: "COMPLETED" | "SKIPPED" }>;
};

export function toPrismaGoalDomain(domain: GoalDomain): PrismaGoalDomain {
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

export function fromPrismaGoalDomain(domain: PrismaGoalDomain): GoalDomain {
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

export function toPrismaGoalStatus(status: GoalStatus): PrismaGoalStatus {
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

export function fromPrismaGoalStatus(status: PrismaGoalStatus): GoalStatus {
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

export function toPrismaGoalMilestoneStatus(status: GoalMilestoneInput["status"]): PrismaGoalMilestoneStatus {
  switch (status) {
    case "pending":
      return "PENDING";
    case "completed":
      return "COMPLETED";
  }
}

export function fromPrismaGoalMilestoneStatus(status: PrismaGoalMilestoneStatus): GoalMilestoneItem["status"] {
  switch (status) {
    case "PENDING":
      return "pending";
    case "COMPLETED":
      return "completed";
  }
}

export function fromPrismaPlanningCycleType(
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

export function fromPrismaHabitStatus(status: PrismaHabitStatus): GoalLinkedHabitItem["status"] {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "PAUSED":
      return "paused";
    case "ARCHIVED":
      return "archived";
  }
}

export function fromPrismaPriorityStatus(status: PrismaPriorityStatus): PlanningPriorityItem["status"] {
  switch (status) {
    case "PENDING":
      return "pending";
    case "COMPLETED":
      return "completed";
    case "DROPPED":
      return "dropped";
  }
}

export function toPrismaTaskStatus(status: PlanningTaskItem["status"]): PrismaTaskStatus {
  switch (status) {
    case "pending":
      return "PENDING";
    case "completed":
      return "COMPLETED";
    case "dropped":
      return "DROPPED";
  }
}

export function fromPrismaTaskStatus(status: PrismaTaskStatus): PlanningTaskItem["status"] {
  switch (status) {
    case "PENDING":
      return "pending";
    case "COMPLETED":
      return "completed";
    case "DROPPED":
      return "dropped";
  }
}

export function toPrismaTaskKind(kind: TaskKind): PrismaTaskKind {
  switch (kind) {
    case "task":
      return "TASK";
    case "note":
      return "NOTE";
    case "reminder":
      return "REMINDER";
  }
}

export function fromPrismaTaskKind(kind: PrismaTaskKind): TaskKind {
  switch (kind) {
    case "TASK":
      return "task";
    case "NOTE":
      return "note";
    case "REMINDER":
      return "reminder";
  }
}

export function toPrismaTaskOriginType(originType: PlanningTaskItem["originType"]): PrismaTaskOriginType {
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

export function fromPrismaTaskOriginType(originType: PrismaTaskOriginType): PlanningTaskItem["originType"] {
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

export function serializeGoal(goal: Goal): GoalItem {
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

export function normalizeTaskTemplateDescription(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

export function normalizePlannerBlockTitle(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

export function parseTaskTemplateTasks(payload: unknown): TaskTemplateItem["tasks"] {
  return z.array(taskTemplateTaskSchema).parse(payload);
}

export function compareTaskTemplates(left: TaskTemplate, right: TaskTemplate) {
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

export function serializeTaskTemplate(template: TaskTemplate): TaskTemplateItem {
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

function serializeGoalSummary(goal: GoalSummaryRecord): GoalSummary {
  return {
    id: goal.id,
    title: goal.title,
    domain: fromPrismaGoalDomain(goal.domain),
    status: fromPrismaGoalStatus(goal.status),
  };
}

export function serializePriority(priority: {
  id: string;
  slot: number;
  title: string;
  status: PrismaPriorityStatus;
  goalId: string | null;
  goal?: GoalSummaryRecord | null;
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

export function serializeTask(task: PlanningTaskRecord): PlanningTaskItem {
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

export function serializeDayPlannerBlock(block: DayPlannerBlockRecord) {
  return {
    id: block.id,
    title: block.title,
    startsAt: block.startsAt.toISOString(),
    endsAt: block.endsAt.toISOString(),
    sortOrder: block.sortOrder,
    tasks: block.taskLinks.map((link) => ({
      taskId: link.taskId,
      sortOrder: link.sortOrder,
      task: serializeTask(link.task),
    })),
    createdAt: block.createdAt.toISOString(),
    updatedAt: block.updatedAt.toISOString(),
  };
}

export function serializeGoalMilestone(milestone: GoalMilestone): GoalMilestoneItem {
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

export function serializeGoalLinkedPriority(priority: {
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

export function serializeGoalLinkedTask(task: Task): GoalLinkedTaskItem {
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

export function serializeGoalLinkedHabit(
  habit: GoalLinkedHabitRecord,
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
