import type {
  CommitTaskRequest,
  TaskCommitmentGuidance,
  TaskCommitmentReason,
} from "@life-os/contracts";
import type { ApiFieldError } from "@life-os/contracts";

type CommitmentTaskLike = {
  kind: "task" | "note" | "reminder";
  nextAction: string | null;
  fiveMinuteVersion: string | null;
  estimatedDurationMinutes: number | null;
  likelyObstacle: string | null;
  focusLengthMinutes: number | null;
};

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function buildPrimaryMessage(input: {
  readiness: TaskCommitmentGuidance["readiness"];
  suggestedReasons: TaskCommitmentReason[];
}) {
  if (input.suggestedReasons.includes("missing_next_action")) {
    return "Ready to schedule. Adding a first visible step can make starting easier.";
  }

  if (input.suggestedReasons.length > 0) {
    return "Ready to schedule. Optional details can make starting easier.";
  }

  return "Ready to schedule.";
}

export function buildTaskCommitmentGuidance(task: CommitmentTaskLike): TaskCommitmentGuidance {
  if (task.kind !== "task") {
    return {
      readiness: "ready",
      blockingReasons: [],
      suggestedReasons: [],
      primaryMessage: "Ready to schedule.",
    };
  }

  const blockingReasons: TaskCommitmentReason[] = [];
  const suggestedReasons: TaskCommitmentReason[] = [];

  if (!hasText(task.nextAction)) {
    suggestedReasons.push("missing_next_action");
  }

  if (!hasText(task.fiveMinuteVersion)) {
    suggestedReasons.push("missing_five_minute_version");
  }

  if (!task.estimatedDurationMinutes) {
    suggestedReasons.push("missing_estimate");
  }

  if (!hasText(task.likelyObstacle)) {
    suggestedReasons.push("missing_obstacle");
  }

  if (!task.focusLengthMinutes) {
    suggestedReasons.push("missing_focus_length");
  }

  return {
    readiness: "ready",
    blockingReasons,
    suggestedReasons,
    primaryMessage: buildPrimaryMessage({ readiness: "ready", suggestedReasons }),
  };
}

export function mergeTaskCommitmentRequest(
  task: CommitmentTaskLike,
  payload: CommitTaskRequest,
): CommitmentTaskLike {
  return {
    kind: task.kind,
    nextAction: payload.nextAction === undefined ? task.nextAction : payload.nextAction,
    fiveMinuteVersion:
      payload.fiveMinuteVersion === undefined ? task.fiveMinuteVersion : payload.fiveMinuteVersion,
    estimatedDurationMinutes:
      payload.estimatedDurationMinutes === undefined
        ? task.estimatedDurationMinutes
        : payload.estimatedDurationMinutes,
    likelyObstacle:
      payload.likelyObstacle === undefined ? task.likelyObstacle : payload.likelyObstacle,
    focusLengthMinutes:
      payload.focusLengthMinutes === undefined
        ? task.focusLengthMinutes
        : payload.focusLengthMinutes,
  };
}

export function buildTaskCommitmentFieldErrors(
  guidance: TaskCommitmentGuidance,
): ApiFieldError[] {
  void guidance;
  return [];
}
