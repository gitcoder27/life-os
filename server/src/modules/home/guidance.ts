import type {
  HabitRiskState,
  HomeGuidance,
  HomeGuidanceRecommendation,
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
  weeklyChallenge: WeeklyHabitChallenge | null;
  dayReviewCompleted: boolean;
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

  if (input.weeklyChallenge?.status === "due_today") {
    addRecommendation({
      id: `weekly-challenge:${input.weeklyChallenge.habitId}`,
      kind: "habit",
      title: `Keep ${input.weeklyChallenge.title} alive`,
      detail: input.weeklyChallenge.message,
      impactLabel: "Protect weekly focus",
      action: {
        type: "complete_habit",
        entityId: input.weeklyChallenge.habitId,
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
        type: "complete_habit",
        entityId: atRiskHabit.id,
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
        type: "open_route",
        route: "/today",
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
        type: "complete_task",
        entityId: openTask.id,
      },
    });
  }

  if (!input.dayReviewCompleted && input.currentHour >= 18) {
    addRecommendation({
      id: "review:daily",
      kind: "review",
      title: "Close the day cleanly",
      detail: "Daily review is still open. Finish it to seed tomorrow instead of carrying clutter.",
      impactLabel: "Seed tomorrow",
      action: {
        type: "open_review",
        route: "/reviews/daily",
      },
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
        type: "open_route",
        route: "/health",
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
