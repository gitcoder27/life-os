import type { Goal, GoalDomainConfig, GoalHorizonConfig, GoalMilestone } from "@prisma/client";

import { addDays } from "../../lib/time/cycle.js";
import { buildGoalTreeInsights, countsTowardParentGoal } from "./goal-insights.js";
import {
  type GoalLinkedHabitRecord,
  fromPrismaGoalHorizonSystemKey,
  fromPrismaGoalMilestoneStatus,
  fromPrismaGoalStatus,
  serializeGoal,
  serializeGoalLinkedHabit,
} from "./planning-mappers.js";
import { getCurrentGoalCycleFilters, type GoalContext } from "./planning-context.js";
import { goalWithMilestonesInclude } from "./planning-record-shapes.js";
import type { PlanningApp } from "./planning-types.js";

type GoalOverviewRecord = Goal & {
  domain: GoalDomainConfig;
  horizon: GoalHorizonConfig | null;
  milestones: GoalMilestone[];
};

export function buildTodayLinkedGoalCounts(
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

// Returns the requested goals plus every descendant that counts toward their roll-ups.
function collectGoalSubtrees(goals: GoalOverviewRecord[], allUserGoals: GoalOverviewRecord[]) {
  const goalsById = new Map(allUserGoals.map((goal) => [goal.id, goal]));
  for (const goal of goals) {
    goalsById.set(goal.id, goal);
  }

  const childrenByParentId = new Map<string, GoalOverviewRecord[]>();
  for (const goal of goalsById.values()) {
    if (!goal.parentGoalId) {
      continue;
    }

    const bucket = childrenByParentId.get(goal.parentGoalId) ?? [];
    bucket.push(goal);
    childrenByParentId.set(goal.parentGoalId, bucket);
  }

  const subtreeGoals = new Map<string, GoalOverviewRecord>();
  const queue = goals.map((goal) => goalsById.get(goal.id) ?? goal);
  while (queue.length > 0) {
    const goal = queue.shift()!;
    if (subtreeGoals.has(goal.id)) {
      continue;
    }

    subtreeGoals.set(goal.id, goal);
    for (const child of childrenByParentId.get(goal.id) ?? []) {
      if (countsTowardParentGoal(fromPrismaGoalStatus(child.status))) {
        queue.push(child);
      }
    }
  }

  return [...subtreeGoals.values()];
}

export async function buildGoalOverviews(
  app: PlanningApp,
  userId: string,
  goals: GoalOverviewRecord[],
  context: GoalContext,
  options: {
    // Every goal the user owns, when the caller has already loaded them; saves a query.
    allUserGoals?: GoalOverviewRecord[];
  } = {},
) {
  if (goals.length === 0) {
    return [];
  }

  const allUserGoals =
    options.allUserGoals
    ?? (await app.prisma.goal.findMany({
      where: { userId },
      include: goalWithMilestonesInclude,
    }));
  const treeGoals = collectGoalSubtrees(goals, allUserGoals);
  const goalIds = goals.map((goal) => goal.id);
  const treeGoalIds = treeGoals.map((goal) => goal.id);
  const currentCycleFilters = getCurrentGoalCycleFilters(context.contextIsoDate, context.weekStartsOn);
  const habitsCheckinStart = addDays(context.contextDate, -30);

  const [currentPriorities, pendingTasks, completedTasks, completedPriorities, linkedHabits] = await Promise.all([
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
          in: treeGoalIds,
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
          in: treeGoalIds,
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
          in: treeGoalIds,
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
          in: treeGoalIds,
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
  for (const goal of treeGoals) {
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

  const linkedHabitStatesByGoal = new Map(
    treeGoals.map((goal) => [
      goal.id,
      (linkedHabitsByGoal.get(goal.id) ?? []).map((habit) =>
        serializeGoalLinkedHabit(habit as GoalLinkedHabitRecord, context.contextIsoDate),
      ),
    ]),
  );
  const insightsByGoal = buildGoalTreeInsights(
    treeGoals.map((goal) => ({
      id: goal.id,
      parentGoalId: goal.parentGoalId,
      horizonSystemKey: fromPrismaGoalHorizonSystemKey(goal.horizon?.systemKey ?? null),
      horizonSpanMonths: goal.horizon?.spanMonths ?? null,
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
      habits: (linkedHabitStatesByGoal.get(goal.id) ?? []).map((habit) => ({
        title: habit.title,
        dueToday: habit.dueToday,
        completedToday: habit.completedToday,
      })),
      completionDates: completionDatesByGoal.get(goal.id) ?? [],
    })),
    context.contextDate,
  );

  return goals.map((goal) => {
    const linkedHabitStates = linkedHabitStatesByGoal.get(goal.id) ?? [];
    const insights = insightsByGoal.get(goal.id)!;
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
