import type {
  AdaptiveNextMove,
  AdaptiveNextMoveAction,
  DayCapacityAssessment,
  DayPlannerBlockItem,
  PlanningTaskItem,
} from "@life-os/contracts";
import type { FocusSessionItem } from "@life-os/contracts";

import type { AdaptiveTodayContext } from "./adaptive-today-context.js";

type BuildAdaptiveNextMoveInput = {
  context: AdaptiveTodayContext;
  capacity: DayCapacityAssessment;
  activeFocusSession?: FocusSessionItem | null;
  now?: Date;
};

export function buildAdaptiveNextMove(input: BuildAdaptiveNextMoveInput): AdaptiveNextMove {
  const now = input.now ?? new Date();
  const { context, capacity, activeFocusSession } = input;
  const pendingTasks = context.tasks.filter((task) => task.kind === "task" && task.status === "pending");
  const currentBlock = capacity.currentBlockId
    ? context.plannerBlocks.find((block) => block.id === capacity.currentBlockId) ?? null
    : null;
  const currentBlockPendingTask = currentBlock ? firstPendingBlockTask(currentBlock) : null;

  if (activeFocusSession?.status === "active") {
    return nextMove({
      state: "continue_focus",
      title: "Focus is running",
      reason: `${activeFocusSession.task.title} is already in motion.`,
      primaryAction: {
        type: "open_focus",
        label: "Open focus",
        targetId: activeFocusSession.id,
      },
      taskId: activeFocusSession.taskId,
      severity: "helpful",
    });
  }

  if (context.launch?.dayMode === "rescue" || context.launch?.dayMode === "recovery") {
    const protectedTask = context.mustWinTask ?? pendingTasks[0] ?? null;
    return nextMove({
      state: "reduce_day",
      title: "Keep the day small",
      reason: "Reduced mode is active. Protect one believable task.",
      primaryAction: action("reduce_day", "Reduce today", protectedTask?.id),
      secondaryAction: protectedTask ? action("start_task", "Start this", protectedTask.id) : null,
      taskId: protectedTask?.id ?? null,
      severity: "urgent",
    });
  }

  if (capacity.slippedTaskCount > 0) {
    return nextMove({
      state: "recover_drift",
      title: "Move slipped work",
      reason: `${capacity.slippedTaskCount} task${capacity.slippedTaskCount === 1 ? "" : "s"} slipped past the plan.`,
      primaryAction: action("recover_drift", "Recover drift"),
      plannerBlockId: capacity.currentBlockId ?? capacity.nextBlockId ?? null,
      severity: "attention",
    });
  }

  if (currentBlockPendingTask && capacity.signals.includes("current_block_at_risk")) {
    return nextMove({
      state: "work_current_block",
      title: currentBlockPendingTask.title,
      reason: "Current block is ending with work left.",
      primaryAction: action("start_task", "Start this", currentBlockPendingTask.id),
      taskId: currentBlockPendingTask.id,
      plannerBlockId: currentBlock?.id ?? null,
      severity: "attention",
    });
  }

  if (context.mustWinTask?.status === "pending" && context.mustWinTask.nextAction?.trim()) {
    return nextMove({
      state: "start_must_win",
      title: context.mustWinTask.title,
      reason: "Must-win is ready and still untouched.",
      primaryAction: action("start_task", "Start this", context.mustWinTask.id),
      secondaryAction: action("clarify_task", "Protocol", context.mustWinTask.id),
      taskId: context.mustWinTask.id,
      severity: "helpful",
    });
  }

  if (context.mustWinTask?.status === "pending") {
    return nextMove({
      state: "clarify_must_win",
      title: context.mustWinTask.title,
      reason: "Must-win needs a first visible step.",
      primaryAction: action("clarify_task", "Clarify", context.mustWinTask.id),
      taskId: context.mustWinTask.id,
      severity: "attention",
    });
  }

  if (currentBlockPendingTask) {
    return nextMove({
      state: "work_current_block",
      title: currentBlockPendingTask.title,
      reason: `${currentBlock?.title ?? "Current block"} is live now.`,
      primaryAction: action("start_task", "Start this", currentBlockPendingTask.id),
      taskId: currentBlockPendingTask.id,
      plannerBlockId: currentBlock?.id ?? null,
      severity: "helpful",
    });
  }

  const dueSoonTask = findDueSoonTask(pendingTasks, now);
  if (dueSoonTask) {
    return nextMove({
      state: "work_current_block",
      title: dueSoonTask.title,
      reason: "Time-bound work is due soon.",
      primaryAction: action("start_task", "Start this", dueSoonTask.id),
      taskId: dueSoonTask.id,
      severity: "attention",
    });
  }

  if (capacity.status === "unclear") {
    return nextMove({
      state: "size_tasks",
      title: "Size tasks",
      reason: `${capacity.unsizedTaskCount} tasks need estimates before planning.`,
      primaryAction: action("shape_day", "Size tasks"),
      severity: "attention",
    });
  }

  if (capacity.status === "overloaded") {
    return nextMove({
      state: "reduce_day",
      title: "Reduce today",
      reason: capacity.overByMinutes > 0
        ? `Today is over capacity by ${capacity.overByMinutes} minutes.`
        : "Today needs a smaller plan.",
      primaryAction: action("reduce_day", "Reduce today"),
      secondaryAction: action("shape_day", "Shape day"),
      severity: "urgent",
    });
  }

  if (capacity.signals.includes("no_planner_blocks") || capacity.unplannedTaskCount > 0) {
    return nextMove({
      state: "shape_day",
      title: "Shape the day",
      reason: capacity.unplannedTaskCount > 0
        ? `${capacity.unplannedTaskCount} task${capacity.unplannedTaskCount === 1 ? "" : "s"} still outside the timeline.`
        : "Today has work but no useful structure.",
      primaryAction: action("shape_day", "Shape day"),
      severity: "neutral",
    });
  }

  if (isCloseDayWindow(context.plannerBlocks, pendingTasks, now)) {
    return nextMove({
      state: "close_day",
      title: "Close the day",
      reason: "Planned work has ended with tasks left.",
      primaryAction: action("close_day", "Close day"),
      severity: "attention",
    });
  }

  if (pendingTasks.length === 0 && now.getHours() >= 16) {
    return nextMove({
      state: "review_ready",
      title: "Review ready",
      reason: "No urgent work is waiting.",
      primaryAction: action("open_review", "Review"),
      severity: "neutral",
    });
  }

  if (pendingTasks.length > 0) {
    const nextTask = pendingTasks[0]!;
    return nextMove({
      state: "work_current_block",
      title: nextTask.title,
      reason: "This is the next open task.",
      primaryAction: action("start_task", "Start this", nextTask.id),
      taskId: nextTask.id,
      severity: "neutral",
    });
  }

  return nextMove({
    state: "empty",
    title: "No work scheduled",
    reason: "Today is open.",
    primaryAction: action("add_task", "Add task"),
    severity: "neutral",
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

function firstPendingBlockTask(block: DayPlannerBlockItem) {
  return [...block.tasks]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .find((blockTask) => blockTask.task.status === "pending")?.task ?? null;
}

function findDueSoonTask(tasks: PlanningTaskItem[], now: Date) {
  const twoHoursFromNow = now.getTime() + 2 * 60 * 60 * 1000;

  return [...tasks]
    .filter((task) => task.dueAt && new Date(task.dueAt).getTime() <= twoHoursFromNow)
    .sort((left, right) => new Date(left.dueAt ?? "").getTime() - new Date(right.dueAt ?? "").getTime())[0] ?? null;
}

function isCloseDayWindow(blocks: DayPlannerBlockItem[], pendingTasks: PlanningTaskItem[], now: Date) {
  if (pendingTasks.length === 0 || blocks.length === 0) {
    return false;
  }

  const lastEnd = Math.max(...blocks.map((block) => new Date(block.endsAt).getTime()));
  return now.getTime() > lastEnd;
}
