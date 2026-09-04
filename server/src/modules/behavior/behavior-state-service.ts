import type {
  AdaptiveNextMove,
  AdaptiveNextMoveAction,
  BehaviorState,
  BehaviorStateSeverity,
  BehaviorStateSignal,
  BehaviorStateSignalKey,
  BehaviorStateSnapshot,
  DayCapacityAssessment,
  FocusSessionItem,
  HomeAction,
  IsoDateString,
  PlanningTaskItem,
} from "@life-os/contracts";

import { parseIsoDate } from "../../lib/time/cycle.js";
import { getUserLocalHour } from "../../lib/time/user-time.js";
import { getActiveFocusSession } from "../focus/service.js";
import {
  buildBehaviorPlanningNextMove,
  loadBehaviorPlanningState,
  type BehaviorPlanningApp,
  type BehaviorPlanningContext,
} from "../planning/behavior-planning-service.js";

type BuildBehaviorStateInput = {
  context: BehaviorPlanningContext;
  capacity: DayCapacityAssessment;
  activeFocusSession?: FocusSessionItem | null;
  now?: Date;
  isLiveDate?: boolean;
  overdueTaskCount?: number;
  hasMissedDayPattern?: boolean;
};

const PENDING_TASK_OVERLOAD_THRESHOLD = 8;
const OVERDUE_TASK_OVERLOAD_THRESHOLD = 3;
const MUST_WIN_STUCK_HOUR = 12;

const behaviorLabels: Record<BehaviorState, string> = {
  clear: "Clear",
  stuck: "Stuck",
  overloaded: "Overloaded",
  drifting: "Drifting",
  low_energy: "Low energy",
  recovery: "Recovery",
  maintenance: "Maintenance",
};

const signalLabels: Record<BehaviorStateSignalKey, string> = {
  focus_active: "Focus running",
  rescue_mode: "Reduced day",
  missed_day_pattern: "Missed-day pattern",
  low_energy: "Low energy",
  slipped_work: "Slipped work",
  current_block_at_risk: "Block at risk",
  over_capacity: "Over capacity",
  too_many_tasks: "Too many tasks",
  overdue_pressure: "Overdue pressure",
  must_win_unclear: "Unclear must-win",
  must_win_stuck: "Stuck must-win",
  must_win_not_started: "Must-win untouched",
  no_pending_work: "No pending work",
  next_move_ready: "Next move ready",
};

export async function getBehaviorStateForUserDate(
  app: BehaviorPlanningApp,
  input: {
    userId: string;
    date: IsoDateString;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const [activeFocusSession, overdueTaskCount] = await Promise.all([
    getActiveFocusSession(app.prisma, input.userId),
    countOverdueTasksForBehavior(app, input.userId, input.date),
  ]);
  const planningState = await loadBehaviorPlanningState(app, {
    userId: input.userId,
    date: input.date,
    now,
    overdueTaskCount,
  });

  return buildBehaviorState({
    context: planningState.context,
    capacity: planningState.capacity,
    activeFocusSession,
    now,
    isLiveDate: planningState.isLiveDate,
    overdueTaskCount,
    hasMissedDayPattern: planningState.hasMissedDayPattern,
  });
}

export function buildBehaviorState(input: BuildBehaviorStateInput): BehaviorStateSnapshot {
  const now = input.now ?? new Date();
  const localHour = input.isLiveDate ? getUserLocalHour(now, input.context.timezone) : 9;
  const baseNextMove = buildBehaviorPlanningNextMove({
    context: input.context,
    capacity: input.capacity,
    activeFocusSession: input.activeFocusSession,
    now,
  });
  const pendingTasks = input.context.tasks.filter(
    (task) => task.kind === "task" && task.status === "pending",
  );
  const protectedTask = findProtectedTask(input.context.mustWinTask, pendingTasks);
  const stuckSignal = getMustWinStuckSignal(input.context.mustWinTask, localHour);
  const signals: BehaviorStateSignal[] = [];

  if (input.activeFocusSession?.status === "active") {
    signals.push(signal("focus_active", input.activeFocusSession.task.title));

    return snapshot(input, {
      state: "clear",
      severity: "helpful",
      title: "Focus is running",
      reason: `${input.activeFocusSession.task.title} is already in motion.`,
      signals,
      nextMove: baseNextMove,
    });
  }

  const reducedModeActive =
    input.context.launch?.dayMode === "rescue" ||
    input.context.launch?.dayMode === "recovery";
  if (reducedModeActive || input.hasMissedDayPattern) {
    if (reducedModeActive) {
      signals.push(signal("rescue_mode", "Reduced mode is active."));
    }
    if (input.hasMissedDayPattern) {
      signals.push(signal("missed_day_pattern", "Recent days need a lighter reset."));
    }

    return snapshot(input, {
      state: "recovery",
      severity: "urgent",
      title: "Recover the day",
      reason: "Reset to one believable action and keep the plan small.",
      signals,
      nextMove: reduceDayMove("Keep it small", protectedTask),
    });
  }

  if ((input.context.launch?.energyRating ?? 3) <= 2) {
    signals.push(signal("low_energy", `Energy ${input.context.launch?.energyRating}/5.`));

    return snapshot(input, {
      state: "low_energy",
      severity: "attention",
      title: "Keep it light",
      reason: "Low energy logged. Protect one believable task.",
      signals,
      nextMove: reduceDayMove("Reduce today", protectedTask),
    });
  }

  if (
    input.capacity.slippedTaskCount > 0 ||
    input.capacity.signals.includes("current_block_at_risk")
  ) {
    if (input.capacity.slippedTaskCount > 0) {
      signals.push(signal(
        "slipped_work",
        `${input.capacity.slippedTaskCount} task${input.capacity.slippedTaskCount === 1 ? "" : "s"} slipped.`,
      ));
    }
    if (input.capacity.signals.includes("current_block_at_risk")) {
      signals.push(signal("current_block_at_risk", "The current block is running out of room."));
    }

    return snapshot(input, {
      state: "drifting",
      severity: "attention",
      title: "Recover drift",
      reason: input.capacity.slippedTaskCount > 0
        ? `${input.capacity.slippedTaskCount} task${input.capacity.slippedTaskCount === 1 ? "" : "s"} slipped past the plan.`
        : "Current work needs a quick reset.",
      signals,
      nextMove: nextMove({
        state: "recover_drift",
        title: "Recover drift",
        reason: "Move slipped work before starting more.",
        primaryAction: action("recover_drift", "Recover drift"),
        plannerBlockId: input.capacity.currentBlockId ?? input.capacity.nextBlockId ?? null,
        severity: "attention",
      }),
    });
  }

  if (
    input.capacity.status === "overloaded" ||
    input.capacity.pendingTaskCount >= PENDING_TASK_OVERLOAD_THRESHOLD ||
    (input.overdueTaskCount ?? 0) >= OVERDUE_TASK_OVERLOAD_THRESHOLD
  ) {
    if (input.capacity.overByMinutes > 0) {
      signals.push(signal("over_capacity", `${input.capacity.overByMinutes} minutes over capacity.`));
    }
    if (input.capacity.pendingTaskCount >= PENDING_TASK_OVERLOAD_THRESHOLD) {
      signals.push(signal("too_many_tasks", `${input.capacity.pendingTaskCount} pending tasks today.`));
    }
    if ((input.overdueTaskCount ?? 0) >= OVERDUE_TASK_OVERLOAD_THRESHOLD) {
      signals.push(signal("overdue_pressure", `${input.overdueTaskCount} overdue tasks waiting.`));
    }

    return snapshot(input, {
      state: "overloaded",
      severity: "urgent",
      title: "Reduce today",
      reason: "The plan is carrying more work than the day can absorb.",
      signals,
      nextMove: reduceDayMove("Reduce today", protectedTask),
    });
  }

  if (stuckSignal) {
    signals.push(stuckSignal);

    return snapshot(input, {
      state: "stuck",
      severity: "attention",
      title: "Clarify the block",
      reason: "The must-win needs a smaller visible step.",
      signals,
      nextMove: nextMove({
        state: "clarify_must_win",
        title: input.context.mustWinTask?.title ?? "Clarify must-win",
        reason: "Define the next visible step before pushing forward.",
        primaryAction: action("clarify_task", "Clarify", input.context.mustWinTask?.id ?? null),
        taskId: input.context.mustWinTask?.id ?? null,
        severity: "attention",
      }),
    });
  }

  if (pendingTasks.length === 0 && localHour >= 16) {
    signals.push(signal("no_pending_work", "No urgent work is waiting."));

    return snapshot(input, {
      state: "maintenance",
      severity: "neutral",
      title: "Maintenance mode",
      reason: "No urgent work is waiting. Close the loop when ready.",
      signals,
      nextMove: nextMove({
        state: "review_ready",
        title: "Review ready",
        reason: "No urgent work is waiting.",
        primaryAction: action("open_review", "Review"),
        severity: "neutral",
      }),
    });
  }

  signals.push(signal("next_move_ready", baseNextMove.reason));

  return snapshot(input, {
    state: "clear",
    severity: baseNextMove.severity === "urgent" ? "attention" : baseNextMove.severity,
    title: baseNextMove.title,
    reason: baseNextMove.reason,
    signals,
    nextMove: baseNextMove,
  });
}

function snapshot(
  input: BuildBehaviorStateInput,
  values: {
    state: BehaviorState;
    severity: BehaviorStateSeverity;
    title: string;
    reason: string;
    signals: BehaviorStateSignal[];
    nextMove: AdaptiveNextMove;
  },
): BehaviorStateSnapshot {
  return {
    date: input.context.date,
    state: values.state,
    severity: values.severity,
    label: behaviorLabels[values.state],
    title: values.title,
    reason: values.reason,
    signals: values.signals,
    nextMove: values.nextMove,
    homeAction: resolveHomeAction(values.nextMove),
  };
}

function signal(key: BehaviorStateSignalKey, detail: string | null = null): BehaviorStateSignal {
  return {
    key,
    label: signalLabels[key],
    detail,
  };
}

function getMustWinStuckSignal(
  mustWinTask: PlanningTaskItem | null,
  localHour: number,
): BehaviorStateSignal | null {
  if (!mustWinTask || mustWinTask.status !== "pending") {
    return null;
  }

  if (mustWinTask.lastStuckAt) {
    return signal("must_win_stuck", "This task was marked stuck recently.");
  }

  if (!mustWinTask.nextAction?.trim()) {
    return signal("must_win_unclear", "No next action is set.");
  }

  if (localHour >= MUST_WIN_STUCK_HOUR && mustWinTask.progressState === "not_started") {
    return signal("must_win_not_started", "Must-win is still untouched after midday.");
  }

  return null;
}

function findProtectedTask(
  mustWinTask: PlanningTaskItem | null,
  pendingTasks: PlanningTaskItem[],
) {
  if (mustWinTask?.status === "pending") {
    return mustWinTask;
  }

  return pendingTasks[0] ?? null;
}

function reduceDayMove(label: string, protectedTask: PlanningTaskItem | null): AdaptiveNextMove {
  return nextMove({
    state: "reduce_day",
    title: "Reduce today",
    reason: "Protect one believable task and remove the rest.",
    primaryAction: action("reduce_day", label),
    secondaryAction: protectedTask ? action("start_task", "Start this", protectedTask.id) : null,
    taskId: protectedTask?.id ?? null,
    severity: "urgent",
  });
}

function nextMove(move: AdaptiveNextMove): AdaptiveNextMove {
  return {
    secondaryAction: null,
    taskId: null,
    plannerBlockId: null,
    ...move,
  };
}

function action(
  type: AdaptiveNextMoveAction["type"],
  label: string,
  targetId?: string | null,
): AdaptiveNextMoveAction {
  return {
    type,
    label,
    targetId: targetId ?? null,
  };
}

function resolveHomeAction(move: AdaptiveNextMove): HomeAction {
  const taskId = move.primaryAction.targetId ?? move.taskId ?? null;

  switch (move.primaryAction.type) {
    case "shape_day":
    case "size_tasks":
    case "reduce_day":
    case "recover_drift":
      return {
        type: "open_route",
        route: "/planner",
      };
    case "close_day":
    case "open_review":
      return {
        type: "open_route",
        route: "/reviews",
      };
    case "start_task":
    case "clarify_task":
      return {
        type: "open_destination",
        destination: {
          kind: "today_execute",
          taskId,
        },
      };
    case "open_focus":
    case "add_task":
      return {
        type: "open_route",
        route: "/today",
      };
  }
}

export async function countOverdueTasksForBehavior(
  app: BehaviorPlanningApp,
  userId: string,
  date: IsoDateString,
) {
  if (typeof app.prisma.task?.count !== "function") {
    return 0;
  }

  return app.prisma.task.count({
    where: {
      userId,
      status: "PENDING",
      scheduledForDate: {
        lt: parseIsoDate(date),
      },
    },
  });
}
