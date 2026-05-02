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
  timingStatusToday?: "none" | "upcoming" | "due_now" | "late" | "complete_on_time" | "complete_late";
  timingLabel?: string | null;
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
  progressState?: "not_started" | "started" | "advanced";
  lastStuckAt?: string | null;
}

interface GuidancePlanning {
  date: IsoDateString;
  hasPlannerBlocks: boolean;
  pendingPriorityCount: number;
  openTaskCount: number;
  launchComplete: boolean;
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
  mustWinTask: GuidanceTask | null;
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
      detail: `${atRiskHabit.title} — ${atRiskHabit.streakCount}d streak on the line`,
    };
  }

  if (input.score.label === "Recovering Day" || input.score.label === "Off-Track Day") {
    const topReason = input.score.topReasons[0];
    return {
      tone: "recovery",
      title: input.score.label === "Off-Track Day" ? "One move to reset" : "Keep it simple",
      detail: topReason
        ? `Biggest swing: ${topReason.label}`
        : "One small reset beats chasing perfection.",
    };
  }

  if (input.momentum.strongDayStreak >= 2 && input.score.value < 70) {
    return {
      tone: "recovery",
      title: "Protect the run",
      detail: `${input.momentum.strongDayStreak} strong days alive — one action keeps it.`,
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
    !input.planning.launchComplete &&
    input.currentHour >= 11 &&
    (input.planning.pendingPriorityCount > 0 || input.planning.openTaskCount > 0);

  if (hasPlanningGap) {
    addRecommendation({
      id: `launch:${input.planning.date}`,
      kind: "priority",
      title: "Launch the day",
      detail: "Choose the must-win and define the first visible step",
      impactLabel: "Launch",
      action: {
        type: "open_destination",
        destination: {
          kind: "today_execute",
        },
      },
    });
  }

  const hasPlannerGap =
    input.planning.launchComplete &&
    !input.planning.hasPlannerBlocks &&
    (input.planning.pendingPriorityCount > 0 || input.planning.openTaskCount > 0);

  if (hasPlannerGap) {
    addRecommendation({
      id: `planning-gap:${input.planning.date}`,
      kind: "priority",
      title:
        input.planning.pendingPriorityCount > 0
          ? "Plan the day"
          : "Set up before it drifts",
      detail:
        input.planning.pendingPriorityCount > 0
          ? `${input.planning.pendingPriorityCount} priorities, ${input.planning.openTaskCount} tasks unplanned`
          : `${input.planning.openTaskCount} task${input.planning.openTaskCount === 1 ? "" : "s"} without a plan`,
      impactLabel: "Plan",
      action: {
        type: "open_destination",
        destination: {
          kind: "today_planning",
          date: input.planning.date,
        },
      },
    });
  }

  const mustWinTask = input.mustWinTask;
  if (
    mustWinTask &&
    mustWinTask.status === "pending" &&
    mustWinTask.lastStuckAt
  ) {
    addRecommendation({
      id: `must-win-recover:${mustWinTask.id}`,
      kind: "task",
      title: `Recover ${mustWinTask.title}`,
      detail: "You marked this as stuck earlier",
      impactLabel: "Recover",
      action: {
        type: "open_destination",
        destination: {
          kind: "today_execute",
          taskId: mustWinTask.id,
        },
      },
    });
  }

  if (
    mustWinTask &&
    mustWinTask.status === "pending" &&
    mustWinTask.progressState === "not_started" &&
    input.currentHour >= 14
  ) {
    addRecommendation({
      id: `must-win-start:${mustWinTask.id}`,
      kind: "task",
      title: `Start ${mustWinTask.title}`,
      detail: "The must-win still has not started",
      impactLabel: "Start",
      action: {
        type: "open_destination",
        destination: {
          kind: "today_execute",
          taskId: mustWinTask.id,
        },
      },
    });
  }

  if (input.accountability.staleInboxCount > 0) {
    addRecommendation({
      id: `inbox-triage:${input.accountability.staleInboxTaskId ?? "queue"}`,
      kind: "task",
      title: "Clear inbox",
      detail: `${input.accountability.staleInboxCount} item${input.accountability.staleInboxCount === 1 ? "" : "s"} aging`,
      impactLabel: "Triage",
      action: {
        type: "open_destination",
        destination: {
          kind: "inbox_triage",
          focus: "stale",
        },
      },
    });
  }

  if (input.accountability.overdueTaskCount > 0) {
    addRecommendation({
      id: `overdue-recovery:${input.accountability.overdueTaskId ?? "queue"}`,
      kind: "task",
      title: "Recover overdue work",
      detail: `${input.accountability.overdueTaskCount} task${input.accountability.overdueTaskCount === 1 ? "" : "s"} overdue`,
      impactLabel: "Recover",
      action: {
        type: "open_destination",
        destination: {
          kind: "today_overdue",
          taskId: input.accountability.overdueTaskId,
        },
      },
    });
  }

  const timedHabit = input.habits
    .filter((habit) => habit.timingStatusToday === "late" || habit.timingStatusToday === "due_now")
    .sort((left, right) => {
      if (left.timingStatusToday === right.timingStatusToday) {
        return left.title.localeCompare(right.title);
      }

      return left.timingStatusToday === "late" ? -1 : 1;
    })[0];
  if (timedHabit) {
    addRecommendation({
      id: `habit-timing:${timedHabit.id}`,
      kind: "habit",
      title: timedHabit.timingStatusToday === "late" ? `Reset ${timedHabit.title}` : `Do ${timedHabit.title}`,
      detail:
        timedHabit.timingStatusToday === "late"
          ? timedHabit.timingLabel
            ? `Late for ${timedHabit.timingLabel}`
            : "Late today"
          : timedHabit.timingLabel
            ? `Due now · ${timedHabit.timingLabel}`
            : "Due now",
      impactLabel: timedHabit.timingStatusToday === "late" ? "Timing" : "Now",
      action: {
        type: "open_destination",
        destination: {
          kind: "habit_focus",
          habitId: timedHabit.id,
          surface: "due_today",
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
      detail: atRiskHabit.risk.message ?? "Due today, streak at risk",
      impactLabel: "Streak",
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
      title: `Move P1: ${topPriority.title}`,
      detail: "Top priority still open",
      impactLabel: "Focus",
      action: {
        type: "open_destination",
        destination: {
          kind: "today_execute",
          priorityId: topPriority.id,
        },
      },
    });
  }

  const openTask = input.tasks.find((task) => task.status === "pending" && task.id !== mustWinTask?.id);
  if (openTask) {
    addRecommendation({
      id: `task:${openTask.id}`,
      kind: "task",
      title: `Close ${openTask.title}`,
      detail: "Open task in the lane",
      impactLabel: "Clear",
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
      detail: "Seeds tomorrow",
      impactLabel: "Review",
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
      title: "Log water",
      detail: `${input.health.waterMl}ml of ${input.health.waterTargetMl}ml`,
      impactLabel: "Health",
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
