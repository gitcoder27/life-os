import type {
  HabitRiskState,
  HomeGuidance,
  HomeGuidanceRecommendation,
  IsoDateString,
  WeeklyHabitChallenge,
} from "@life-os/contracts";

interface GuidanceHabit {
  id: string;
  title: string;
  dueToday: boolean;
  completedToday: boolean;
  streakCount: number;
  risk: HabitRiskState;
}

interface GuidancePriority {
  id: string;
  title: string;
  slot: 1 | 2 | 3;
  status: "pending" | "completed" | "dropped";
}

interface GuidanceTask {
  id: string;
  title: string;
  status: "pending" | "completed" | "dropped";
}

interface GuidancePlanning {
  date: IsoDateString;
  hasPlannerBlocks: boolean;
  pendingPriorityCount: number;
  openTaskCount: number;
}

interface GuidanceAccountability {
  staleInboxCount: number;
  staleInboxTaskId: string | null;
  overdueTaskCount: number;
  overdueTaskId: string | null;
}

interface GuidanceInput {
  score: {
    label: "Strong Day" | "Solid Day" | "Recovering Day" | "Off-Track Day";
    value: number;
    topReasons: Array<{
      label: string;
      missingPoints: number;
    }>;
  };
  momentum: {
    strongDayStreak: number;
  };
  habits: GuidanceHabit[];
  priorities: GuidancePriority[];
  tasks: GuidanceTask[];
  planning: GuidancePlanning;
  accountability: GuidanceAccountability;
  weeklyChallenge: WeeklyHabitChallenge | null;
  dailyReviewAvailable: boolean;
  dailyReviewRoute: string | null;
  currentHour: number;
  health: {
    waterMl: number;
    waterTargetMl: number;
  };
}

function buildRecoveryGuidance(input: GuidanceInput): HomeGuidance["recovery"] {
  const atRiskHabit = input.habits
    .filter((habit) => habit.risk.level === "at_risk")
    .sort((left, right) => right.streakCount - left.streakCount)[0];

  if (atRiskHabit) {
    return {
      tone: input.score.label === "Recovering Day" || input.score.label === "Off-Track Day" ? "recovery" : "steady",
      title: "Protect the streak",
      detail: `${atRiskHabit.title} is due today and a ${atRiskHabit.streakCount}-day streak is on the line.`,
    };
  }

  if (input.score.label === "Recovering Day" || input.score.label === "Off-Track Day") {
    const topReason = input.score.topReasons[0];
    return {
      tone: "recovery",
      title: input.score.label === "Off-Track Day" ? "Reset the day with one useful move" : "Keep the recovery simple",
      detail: topReason
        ? `${topReason.label} is the biggest score swing still available.`
        : "A small reset now is worth more than chasing a perfect day later.",
    };
  }

  if (input.momentum.strongDayStreak >= 2 && input.score.value < 70) {
    return {
      tone: "recovery",
      title: "Protect the strong-day run",
      detail: `Momentum is still alive at ${input.momentum.strongDayStreak} strong days. One clean action keeps it recoverable.`,
    };
  }

  return null;
}

function buildReviewAction(route: string): HomeGuidanceRecommendation["action"] {
  const [pathname, searchString = ""] = route.split("?");
  const cadence = pathname.split("/").filter(Boolean)[1];
  const date = new URLSearchParams(searchString).get("date");

  if (
    (cadence === "daily" || cadence === "weekly" || cadence === "monthly") &&
    date
  ) {
    return {
      type: "open_destination" as const,
      destination: {
        kind: "review" as const,
        cadence: cadence as "daily" | "weekly" | "monthly",
        date: date as IsoDateString,
      },
    };
  }

  return {
    type: "open_review" as const,
    route,
  };
}

function buildRecommendations(input: GuidanceInput): HomeGuidanceRecommendation[] {
  const recommendations: HomeGuidanceRecommendation[] = [];
  const seenIds = new Set<string>();

  function addRecommendation(recommendation: HomeGuidanceRecommendation | null) {
    if (!recommendation || seenIds.has(recommendation.id) || recommendations.length >= 3) {
      return;
    }

    seenIds.add(recommendation.id);
    recommendations.push(recommendation);
  }

  const hasPlanningGap =
    !input.planning.hasPlannerBlocks &&
    (input.planning.pendingPriorityCount > 0 || input.planning.openTaskCount > 0);

  if (hasPlanningGap) {
    addRecommendation({
      id: `planning-gap:${input.planning.date}`,
      kind: "priority",
      title:
        input.planning.pendingPriorityCount > 0
          ? "Turn Today into a real plan"
          : "Set the day up before it drifts",
      detail:
        input.planning.pendingPriorityCount > 0
          ? `${input.planning.pendingPriorityCount} priority slot${input.planning.pendingPriorityCount === 1 ? "" : "s"} and ${input.planning.openTaskCount} open task${input.planning.openTaskCount === 1 ? "" : "s"} still need a plan.`
          : `${input.planning.openTaskCount} open task${input.planning.openTaskCount === 1 ? "" : "s"} are waiting without a clear plan yet.`,
      impactLabel: "Set the operating system",
      action: {
        type: "open_destination",
        destination: {
          kind: "today_planning",
          date: input.planning.date,
        },
      },
    });
  }

  if (input.accountability.staleInboxCount > 0) {
    addRecommendation({
      id: `inbox-triage:${input.accountability.staleInboxTaskId ?? "queue"}`,
      kind: "task",
      title: "Clear the inbox drag",
      detail: `${input.accountability.staleInboxCount} inbox item${input.accountability.staleInboxCount === 1 ? "" : "s"} are aging and still need triage.`,
      impactLabel: "Get capture under control",
      action: {
        type: "open_destination",
        destination: {
          kind: "inbox_triage",
        },
      },
    });
  }

  if (input.accountability.overdueTaskCount > 0) {
    addRecommendation({
      id: `overdue-recovery:${input.accountability.overdueTaskId ?? "queue"}`,
      kind: "task",
      title: "Recover overdue work",
      detail: `${input.accountability.overdueTaskCount} overdue task${input.accountability.overdueTaskCount === 1 ? "" : "s"} are still pulling attention off the day.`,
      impactLabel: "Stabilize execution",
      action: {
        type: "open_destination",
        destination: {
          kind: "today_overdue",
          taskId: input.accountability.overdueTaskId,
        },
      },
    });
  }

  const atRiskHabit = input.habits
    .filter((habit) => habit.risk.level === "at_risk")
    .sort((left, right) => right.streakCount - left.streakCount)[0];
  if (atRiskHabit) {
    addRecommendation({
      id: `habit-risk:${atRiskHabit.id}`,
      kind: "habit",
      title: `Protect ${atRiskHabit.title}`,
      detail: atRiskHabit.risk.message ?? "This habit is due today and needs attention now.",
      impactLabel: "Protect streak",
      action: {
        type: "open_destination",
        destination: {
          kind: "habit_focus",
          habitId: atRiskHabit.id,
          surface: "due_today",
        },
      },
    });
  }

  const topPriority = input.priorities.find((priority) => priority.slot === 1 && priority.status === "pending");
  if (topPriority) {
    addRecommendation({
      id: `priority:${topPriority.id}`,
      kind: "priority",
      title: `Move Priority 1: ${topPriority.title}`,
      detail: "Your top priority is still open. Re-enter Today and clear the next concrete step.",
      impactLabel: "Protect top focus",
      action: {
        type: "open_destination",
        destination: {
          kind: "today_execute",
          priorityId: topPriority.id,
        },
      },
    });
  }

  const openTask = input.tasks.find((task) => task.status === "pending");
  if (openTask) {
    addRecommendation({
      id: `task:${openTask.id}`,
      kind: "task",
      title: `Close ${openTask.title}`,
      detail: "One open day-task is still dragging the lane.",
      impactLabel: "Clear task lane",
      action: {
        type: "open_destination",
        destination: {
          kind: "today_execute",
          taskId: openTask.id,
        },
      },
    });
  }

  if (input.dailyReviewAvailable && input.dailyReviewRoute) {
    addRecommendation({
      id: "review:daily",
      kind: "review",
      title: "Close the day cleanly",
      detail: "Daily review is still open. Finish it to seed tomorrow instead of carrying clutter.",
      impactLabel: "Seed tomorrow",
      action: buildReviewAction(input.dailyReviewRoute),
    });
  }

  if (
    input.currentHour >= 12 &&
    input.health.waterTargetMl > 0 &&
    input.health.waterMl < input.health.waterTargetMl * 0.5
  ) {
    addRecommendation({
      id: "health:water",
      kind: "health",
      title: "Recover the basics",
      detail: `${input.health.waterMl}ml logged against a ${input.health.waterTargetMl}ml target so far.`,
      impactLabel: "Recover health basics",
      action: {
        type: "open_destination",
        destination: {
          kind: "health_focus",
          surface: "water",
        },
      },
    });
  }

  return recommendations;
}

export function buildHomeGuidance(input: GuidanceInput): HomeGuidance {
  return {
    recovery: buildRecoveryGuidance(input),
    weeklyChallenge: input.weeklyChallenge,
    recommendations: buildRecommendations(input),
  };
}
