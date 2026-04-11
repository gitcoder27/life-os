import type {
  DayMode,
  DailyLaunchItem,
  GoalDomainItem,
  GoalEngagementState,
  GoalDomainSystemKey,
  GoalHierarchySummary,
  GoalHorizonItem,
  GoalHorizonSystemKey,
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
  RescueReason,
  TaskKind,
  TaskProgressState,
  TaskStuckAction,
  TaskStuckReason,
  TaskTemplateItem,
} from "@life-os/contracts";
import type {
  DayMode as PrismaDayMode,
  DailyDerailmentReason as PrismaDailyDerailmentReason,
  Goal,
  GoalEngagementState as PrismaGoalEngagementState,
  GoalDomainConfig,
  GoalDomainSystemKey as PrismaGoalDomainSystemKey,
  GoalHorizonConfig,
  GoalHorizonSystemKey as PrismaGoalHorizonSystemKey,
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
  TaskProgressState as PrismaTaskProgressState,
  RescueReason as PrismaRescueReason,
  TaskStatus as PrismaTaskStatus,
  TaskStuckAction as PrismaTaskStuckAction,
  TaskTemplate,
} from "@prisma/client";
import { z } from "zod";

import { calculateHabitActiveStreak, calculateHabitRisk } from "../../lib/habits/guidance.js";
import {
  getHabitCompletionCountForIsoDate,
  isHabitCompletedOnIsoDate,
  isHabitDueOnIsoDate,
  isHabitPermanentlyInactive,
  resolveHabitRecurrence,
} from "../../lib/habits/schedule.js";
import { serializeRecurrenceDefinition } from "../../lib/recurrence/store.js";
import { toIsoDateString } from "../../lib/time/date.js";
import { taskTemplateTaskSchema } from "./planning-schemas.js";

type GoalDomainRecord = Pick<
  GoalDomainConfig,
  "id" | "systemKey" | "name" | "sortOrder" | "isArchived" | "createdAt" | "updatedAt"
>;

type GoalHorizonRecord = Pick<
  GoalHorizonConfig,
  "id" | "systemKey" | "name" | "sortOrder" | "spanMonths" | "isArchived" | "createdAt" | "updatedAt"
>;

type GoalSummaryRecord = Pick<Goal, "id" | "title" | "status" | "domainId"> & {
  engagementState?: PrismaGoalEngagementState | null;
  domain: GoalDomainRecord;
};

type GoalHierarchyRecord = Pick<
  Goal,
  "id" | "title" | "status" | "engagementState" | "domainId" | "horizonId" | "parentGoalId" | "sortOrder" | "targetDate"
> & {
  domain: GoalDomainRecord;
  horizon?: GoalHorizonRecord | null;
};

type GoalRecord = Goal & {
  domain: GoalDomainRecord;
  horizon?: GoalHorizonRecord | null;
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

type DailyLaunchRecord = {
  id: string;
  planningCycleId: string;
  mustWinTaskId: string | null;
  dayMode: PrismaDayMode;
  rescueReason: PrismaRescueReason | null;
  energyRating: number | null;
  likelyDerailmentReason: PrismaDailyDerailmentReason | null;
  likelyDerailmentNote: string | null;
  rescueSuggestedAt: Date | null;
  rescueActivatedAt: Date | null;
  rescueExitedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
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

export function toPrismaGoalDomainSystemKey(
  systemKey: GoalDomainSystemKey,
): PrismaGoalDomainSystemKey {
  switch (systemKey) {
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

export function fromPrismaGoalDomainSystemKey(
  systemKey: PrismaGoalDomainSystemKey | null,
): GoalDomainSystemKey | null {
  switch (systemKey) {
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
    default:
      return null;
  }
}

export function toPrismaGoalHorizonSystemKey(
  systemKey: GoalHorizonSystemKey,
): PrismaGoalHorizonSystemKey {
  switch (systemKey) {
    case "life_vision":
      return "LIFE_VISION";
    case "five_year":
      return "FIVE_YEAR";
    case "one_year":
      return "ONE_YEAR";
    case "quarter":
      return "QUARTER";
    case "month":
      return "MONTH";
  }
}

export function fromPrismaGoalHorizonSystemKey(
  systemKey: PrismaGoalHorizonSystemKey | null,
): GoalHorizonSystemKey | null {
  switch (systemKey) {
    case "LIFE_VISION":
      return "life_vision";
    case "FIVE_YEAR":
      return "five_year";
    case "ONE_YEAR":
      return "one_year";
    case "QUARTER":
      return "quarter";
    case "MONTH":
      return "month";
    default:
      return null;
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

export function toPrismaGoalEngagementState(
  engagementState: GoalEngagementState,
): PrismaGoalEngagementState {
  switch (engagementState) {
    case "primary":
      return "PRIMARY";
    case "secondary":
      return "SECONDARY";
    case "parked":
      return "PARKED";
    case "maintenance":
      return "MAINTENANCE";
  }
}

export function fromPrismaGoalEngagementState(
  engagementState: PrismaGoalEngagementState | null | undefined,
): GoalEngagementState | null {
  switch (engagementState) {
    case "PRIMARY":
      return "primary";
    case "SECONDARY":
      return "secondary";
    case "PARKED":
      return "parked";
    case "MAINTENANCE":
      return "maintenance";
    default:
      return null;
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

export function toPrismaTaskProgressState(progressState: TaskProgressState): PrismaTaskProgressState {
  switch (progressState) {
    case "not_started":
      return "NOT_STARTED";
    case "started":
      return "STARTED";
    case "advanced":
      return "ADVANCED";
  }
}

export function fromPrismaTaskProgressState(progressState: PrismaTaskProgressState): TaskProgressState {
  switch (progressState) {
    case "NOT_STARTED":
      return "not_started";
    case "STARTED":
      return "started";
    case "ADVANCED":
      return "advanced";
  }
}

export function toPrismaDayMode(dayMode: DayMode): PrismaDayMode {
  switch (dayMode) {
    case "normal":
      return "NORMAL";
    case "rescue":
      return "RESCUE";
    case "recovery":
      return "RECOVERY";
  }
}

export function fromPrismaDayMode(dayMode: PrismaDayMode): DayMode {
  switch (dayMode) {
    case "NORMAL":
      return "normal";
    case "RESCUE":
      return "rescue";
    case "RECOVERY":
      return "recovery";
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
    case "meal_plan":
      return "MEAL_PLAN";
  }
}

export function toPrismaTaskStuckReason(reason: TaskStuckReason): PrismaDailyDerailmentReason {
  switch (reason) {
    case "unclear":
      return "UNCLEAR";
    case "too_big":
      return "TOO_BIG";
    case "avoidance":
      return "AVOIDANCE";
    case "low_energy":
      return "LOW_ENERGY";
    case "interrupted":
      return "INTERRUPTED";
    case "overloaded":
      return "OVERLOADED";
  }
}

export function toPrismaRescueReason(reason: RescueReason): PrismaRescueReason {
  switch (reason) {
    case "overload":
      return "OVERLOAD";
    case "low_energy":
      return "LOW_ENERGY";
    case "interruption":
      return "INTERRUPTION";
    case "missed_day":
      return "MISSED_DAY";
  }
}

export function fromPrismaRescueReason(reason: PrismaRescueReason | null | undefined): RescueReason | null {
  switch (reason) {
    case "OVERLOAD":
      return "overload";
    case "LOW_ENERGY":
      return "low_energy";
    case "INTERRUPTION":
      return "interruption";
    case "MISSED_DAY":
      return "missed_day";
    default:
      return null;
  }
}

export function fromPrismaTaskStuckReason(reason: PrismaDailyDerailmentReason | null): TaskStuckReason | null {
  switch (reason) {
    case "UNCLEAR":
      return "unclear";
    case "TOO_BIG":
      return "too_big";
    case "AVOIDANCE":
      return "avoidance";
    case "LOW_ENERGY":
      return "low_energy";
    case "INTERRUPTED":
      return "interrupted";
    case "OVERLOADED":
      return "overloaded";
    default:
      return null;
  }
}

export function toPrismaTaskStuckAction(action: TaskStuckAction): PrismaTaskStuckAction {
  switch (action) {
    case "clarify":
      return "CLARIFY";
    case "shrink":
      return "SHRINK";
    case "downgrade":
      return "DOWNGRADE";
    case "reschedule":
      return "RESCHEDULE";
    case "recover":
      return "RECOVER";
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
    case "MEAL_PLAN":
      return "meal_plan";
  }
}

export function serializeGoalDomainConfig(domain: GoalDomainRecord): GoalDomainItem {
  return {
    id: domain.id,
    systemKey: fromPrismaGoalDomainSystemKey(domain.systemKey),
    name: domain.name,
    sortOrder: domain.sortOrder,
    isArchived: domain.isArchived,
    createdAt: domain.createdAt.toISOString(),
    updatedAt: domain.updatedAt.toISOString(),
  };
}

export function serializeGoalHorizonConfig(horizon: GoalHorizonRecord): GoalHorizonItem {
  return {
    id: horizon.id,
    systemKey: fromPrismaGoalHorizonSystemKey(horizon.systemKey),
    name: horizon.name,
    sortOrder: horizon.sortOrder,
    spanMonths: horizon.spanMonths,
    isArchived: horizon.isArchived,
    createdAt: horizon.createdAt.toISOString(),
    updatedAt: horizon.updatedAt.toISOString(),
  };
}

function serializeGoalSummary(goal: GoalSummaryRecord): GoalSummary {
  return {
    id: goal.id,
    title: goal.title,
    domainId: goal.domainId,
    domain: goal.domain.name,
    domainSystemKey: fromPrismaGoalDomainSystemKey(goal.domain.systemKey),
    status: fromPrismaGoalStatus(goal.status),
    engagementState: fromPrismaGoalEngagementState(goal.engagementState),
  };
}

export function serializeGoalHierarchySummary(goal: GoalHierarchyRecord): GoalHierarchySummary {
  return {
    ...serializeGoalSummary(goal),
    horizonId: goal.horizonId,
    horizonName: goal.horizon?.name ?? null,
    horizonSystemKey: fromPrismaGoalHorizonSystemKey(goal.horizon?.systemKey ?? null),
    parentGoalId: goal.parentGoalId,
    sortOrder: goal.sortOrder,
    targetDate: goal.targetDate ? toIsoDateString(goal.targetDate) : null,
  };
}

export function serializeGoal(goal: GoalRecord): GoalItem {
  return {
    ...serializeGoalSummary(goal),
    horizonId: goal.horizonId,
    horizonName: goal.horizon?.name ?? null,
    horizonSystemKey: fromPrismaGoalHorizonSystemKey(goal.horizon?.systemKey ?? null),
    horizonSpanMonths: goal.horizon?.spanMonths ?? null,
    parentGoalId: goal.parentGoalId,
    why: goal.why,
    targetDate: goal.targetDate ? toIsoDateString(goal.targetDate) : null,
    notes: goal.notes,
    weeklyProofText: goal.weeklyProofText ?? null,
    knownObstacle: goal.knownObstacle ?? null,
    parkingRule: goal.parkingRule ?? null,
    sortOrder: goal.sortOrder,
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
    nextAction: task.nextAction ?? null,
    fiveMinuteVersion: task.fiveMinuteVersion ?? null,
    estimatedDurationMinutes: task.estimatedDurationMinutes ?? null,
    likelyObstacle: task.likelyObstacle ?? null,
    focusLengthMinutes: task.focusLengthMinutes ?? null,
    progressState: fromPrismaTaskProgressState(task.progressState),
    startedAt: task.startedAt?.toISOString() ?? null,
    lastStuckAt: task.lastStuckAt?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export function serializeDailyLaunch(launch: DailyLaunchRecord): DailyLaunchItem {
  return {
    id: launch.id,
    planningCycleId: launch.planningCycleId,
    mustWinTaskId: launch.mustWinTaskId,
    dayMode: fromPrismaDayMode(launch.dayMode),
    rescueReason: fromPrismaRescueReason(launch.rescueReason),
    energyRating: launch.energyRating ?? null,
    likelyDerailmentReason: fromPrismaTaskStuckReason(launch.likelyDerailmentReason),
    likelyDerailmentNote: launch.likelyDerailmentNote ?? null,
    rescueSuggestedAt: launch.rescueSuggestedAt?.toISOString() ?? null,
    rescueActivatedAt: launch.rescueActivatedAt?.toISOString() ?? null,
    rescueExitedAt: launch.rescueExitedAt?.toISOString() ?? null,
    completedAt: launch.completedAt?.toISOString() ?? null,
    createdAt: launch.createdAt.toISOString(),
    updatedAt: launch.updatedAt.toISOString(),
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
  const completedToday = isHabitCompletedOnIsoDate(habit.checkins, targetIsoDate, habit.targetPerDay);
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
    : calculateHabitRisk(habit.checkins, recurrence, targetIsoDate, habit.pauseWindows, habit.targetPerDay);

  return {
    id: habit.id,
    title: habit.title,
    category: habit.category,
    status: fromPrismaHabitStatus(habit.status),
    targetPerDay: habit.targetPerDay,
    dueToday,
    completedToday,
    completedCountToday: getHabitCompletionCountForIsoDate(habit.checkins, targetIsoDate),
    streakCount: calculateHabitActiveStreak(habit.checkins, recurrence, targetIsoDate, habit.pauseWindows, habit.targetPerDay),
    completionRate7d: risk.completionRate7d,
    riskLevel: risk.level,
    riskMessage: risk.message,
  };
}
