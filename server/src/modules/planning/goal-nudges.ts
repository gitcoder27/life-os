import type { GoalHealthState, GoalNudgeItem, GoalSummary } from "@life-os/contracts";

interface GoalNudgeCandidate {
  goal: GoalSummary;
  health: GoalHealthState | null;
  progressPercent: number;
  nextBestAction: string | null;
  targetDate: Date | null;
  lastActivityAt: string | null;
  todayPriorityCount: number;
  todayTaskCount: number;
}

type EligibleGoalNudgeCandidate = GoalNudgeCandidate & {
  health: GoalHealthState;
  nextBestAction: string;
};

const ACTION_PREFIXES = [
  "Complete milestone: ",
  "Finish task: ",
  "Complete habit: ",
] as const;

function getHealthRank(health: GoalHealthState) {
  switch (health) {
    case "stalled":
      return 0;
    case "drifting":
      return 1;
    case "on_track":
      return 2;
    case "achieved":
      return 3;
  }
}

function compareOptionalDates(left: Date | null, right: Date | null) {
  if (left && right) {
    return left.getTime() - right.getTime();
  }

  if (left) {
    return -1;
  }

  if (right) {
    return 1;
  }

  return 0;
}

function compareOptionalIsoStrings(left: string | null, right: string | null) {
  if (left && right) {
    return new Date(left).getTime() - new Date(right).getTime();
  }

  if (left) {
    return -1;
  }

  if (right) {
    return 1;
  }

  return 0;
}

function buildSuggestedPriorityTitle(nextBestAction: string) {
  const matchedPrefix = ACTION_PREFIXES.find((prefix) => nextBestAction.startsWith(prefix));

  if (!matchedPrefix) {
    return nextBestAction;
  }

  return nextBestAction.slice(matchedPrefix.length).trim();
}

function isEligibleGoalNudgeCandidate(
  candidate: GoalNudgeCandidate,
): candidate is EligibleGoalNudgeCandidate {
  return (
    candidate.goal.status === "active"
    && candidate.health !== null
    && candidate.nextBestAction !== null
    && candidate.todayPriorityCount === 0
    && candidate.todayTaskCount === 0
  );
}

export function buildGoalNudges(candidates: GoalNudgeCandidate[]): GoalNudgeItem[] {
  return candidates
    .filter(isEligibleGoalNudgeCandidate)
    .sort((left, right) => {
      const healthDiff = getHealthRank(left.health) - getHealthRank(right.health);
      if (healthDiff !== 0) {
        return healthDiff;
      }

      const targetDateDiff = compareOptionalDates(left.targetDate, right.targetDate);
      if (targetDateDiff !== 0) {
        return targetDateDiff;
      }

      const activityDiff = compareOptionalIsoStrings(left.lastActivityAt, right.lastActivityAt);
      if (activityDiff !== 0) {
        return activityDiff;
      }

      return left.goal.title.localeCompare(right.goal.title);
    })
    .slice(0, 3)
    .map((candidate) => ({
      goal: candidate.goal,
      health: candidate.health,
      progressPercent: candidate.progressPercent,
      nextBestAction: candidate.nextBestAction,
      suggestedPriorityTitle: buildSuggestedPriorityTitle(candidate.nextBestAction),
    }));
}
