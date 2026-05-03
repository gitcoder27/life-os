import type {
  DailyLaunchItem,
  DayCapacityAssessment,
  DayCapacityBlockAssessment,
  DayCapacitySignal,
  DayCapacityStatus,
  DayPlannerBlockItem,
  PlanningTaskItem,
} from "@life-os/contracts";

const CURRENT_BLOCK_RISK_REMAINING_MINUTES = 15;
const DEFAULT_UNSIZED_TASK_MINUTES = 25;

export type DayCapacityInput = {
  tasks: PlanningTaskItem[];
  plannerBlocks: DayPlannerBlockItem[];
  launch?: DailyLaunchItem | null;
  mustWinTask?: PlanningTaskItem | null;
  now?: Date;
  isLiveDate?: boolean;
};

type TimelineBlock = {
  block: DayPlannerBlockItem;
  pendingTasks: PlanningTaskItem[];
  pendingCount: number;
  capacityMinutes: number;
  estimatedMinutes: number;
  overByMinutes: number;
  startsAt: Date;
  endsAt: Date;
  status: "past" | "current" | "upcoming";
};

export const getTaskPlanningMinutes = (task: PlanningTaskItem) =>
  task.estimatedDurationMinutes ?? task.focusLengthMinutes ?? DEFAULT_UNSIZED_TASK_MINUTES;

export const taskNeedsEstimate = (task: PlanningTaskItem) =>
  task.estimatedDurationMinutes == null && task.focusLengthMinutes == null;

export function assessDayCapacity(input: DayCapacityInput): DayCapacityAssessment {
  const now = input.now ?? new Date();
  const pendingTasks = input.tasks.filter((task) => task.kind === "task" && task.status === "pending");
  const taskIdsInBlocks = new Set<string>();
  for (const block of input.plannerBlocks) {
    for (const blockTask of block.tasks) {
      taskIdsInBlocks.add(blockTask.taskId);
    }
  }

  const plannedPendingTasks = pendingTasks.filter((task) => taskIdsInBlocks.has(task.id));
  const unplannedPendingTasks = pendingTasks.filter((task) => !taskIdsInBlocks.has(task.id));
  const needsEstimateTasks = pendingTasks.filter(taskNeedsEstimate);
  const timelineBlocks = input.plannerBlocks
    .map((block) => buildTimelineBlock(block, now, Boolean(input.isLiveDate)))
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());

  const currentBlock = timelineBlocks.find((block) => block.status === "current") ?? null;
  const nextBlock = timelineBlocks.find((block) => block.status === "upcoming") ?? null;
  const slippedBlocks = timelineBlocks.filter((block) => block.status === "past" && block.pendingCount > 0);
  const slippedTaskCount = slippedBlocks.reduce((sum, block) => sum + block.pendingCount, 0);
  const plannedBlockMinutes = timelineBlocks.reduce((sum, block) => sum + block.capacityMinutes, 0);
  const estimatedTaskMinutes = pendingTasks.reduce((sum, task) => sum + getTaskPlanningMinutes(task), 0);
  const plannedEstimatedMinutes = plannedPendingTasks.reduce((sum, task) => sum + getTaskPlanningMinutes(task), 0);
  const overByMinutes = Math.max(estimatedTaskMinutes - plannedBlockMinutes, 0);
  const signals = buildCapacitySignals({
    input,
    pendingTasks,
    unplannedPendingTasks,
    needsEstimateTasks,
    overByMinutes,
    slippedTaskCount,
    currentBlock,
  });
  const status = resolveCapacityStatus({
    signals,
    overByMinutes,
    unsizedTaskCount: needsEstimateTasks.length,
    pendingTaskCount: pendingTasks.length,
  });

  return {
    status,
    summary: buildCapacitySummary(status, {
      overByMinutes,
      slippedTaskCount,
      unsizedTaskCount: needsEstimateTasks.length,
      pendingTaskCount: pendingTasks.length,
      plannedEstimatedMinutes,
      plannedBlockMinutes,
    }),
    pendingTaskCount: pendingTasks.length,
    plannedTaskCount: plannedPendingTasks.length,
    unplannedTaskCount: unplannedPendingTasks.length,
    unsizedTaskCount: needsEstimateTasks.length,
    estimatedTaskMinutes,
    plannedBlockMinutes,
    overByMinutes,
    slippedTaskCount,
    currentBlockId: currentBlock?.block.id ?? null,
    nextBlockId: nextBlock?.block.id ?? null,
    needsEstimateTaskIds: needsEstimateTasks.map((task) => task.id),
    signals,
    blocks: timelineBlocks.map(toBlockAssessment),
  };
}

function buildTimelineBlock(
  block: DayPlannerBlockItem,
  now: Date,
  isLiveDate: boolean,
): TimelineBlock {
  const startsAt = new Date(block.startsAt);
  const endsAt = new Date(block.endsAt);
  const pendingTasks = block.tasks
    .filter((blockTask) => blockTask.task.status === "pending")
    .map((blockTask) => blockTask.task);
  const capacityMinutes = Math.max(Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000), 0);
  const estimatedMinutes = pendingTasks.reduce((sum, task) => sum + getTaskPlanningMinutes(task), 0);
  let status: TimelineBlock["status"] = "upcoming";

  if (!isLiveDate) {
    status = "upcoming";
  } else if (now >= endsAt) {
    status = "past";
  } else if (now >= startsAt) {
    status = "current";
  }

  return {
    block,
    pendingTasks,
    pendingCount: pendingTasks.length,
    capacityMinutes,
    estimatedMinutes,
    overByMinutes: Math.max(estimatedMinutes - capacityMinutes, 0),
    startsAt,
    endsAt,
    status,
  };
}

function buildCapacitySignals(input: {
  input: DayCapacityInput;
  pendingTasks: PlanningTaskItem[];
  unplannedPendingTasks: PlanningTaskItem[];
  needsEstimateTasks: PlanningTaskItem[];
  overByMinutes: number;
  slippedTaskCount: number;
  currentBlock: TimelineBlock | null;
}): DayCapacitySignal[] {
  const signals = new Set<DayCapacitySignal>();

  if (input.pendingTasks.length > 0 && input.input.plannerBlocks.length === 0) {
    signals.add("no_planner_blocks");
  }
  if (input.unplannedPendingTasks.length > 0) {
    signals.add("unplanned_tasks");
  }
  if (input.needsEstimateTasks.length > 0) {
    signals.add("unsized_tasks");
  }
  if (input.overByMinutes > 0) {
    signals.add("over_capacity");
  }
  if (input.slippedTaskCount > 0) {
    signals.add("slipped_work");
  }
  if (input.currentBlock && input.currentBlock.pendingCount > 0) {
    const remainingMinutes = Math.max(
      Math.round((input.currentBlock.endsAt.getTime() - (input.input.now ?? new Date()).getTime()) / 60_000),
      0,
    );
    if (remainingMinutes <= CURRENT_BLOCK_RISK_REMAINING_MINUTES || input.currentBlock.overByMinutes > 0) {
      signals.add("current_block_at_risk");
    }
  }
  if (input.input.launch?.dayMode === "rescue" || input.input.launch?.dayMode === "recovery") {
    signals.add("rescue_mode");
  }
  if (input.input.mustWinTask && !input.input.mustWinTask.nextAction?.trim()) {
    signals.add("must_win_unclear");
  }

  return [...signals];
}

function resolveCapacityStatus(input: {
  signals: DayCapacitySignal[];
  overByMinutes: number;
  unsizedTaskCount: number;
  pendingTaskCount: number;
}): DayCapacityStatus {
  if (input.signals.includes("slipped_work")) {
    return "drifting";
  }
  if (input.signals.includes("rescue_mode")) {
    return "overloaded";
  }
  if (input.unsizedTaskCount >= 3 || input.unsizedTaskCount > Math.max(input.pendingTaskCount / 2, 1)) {
    return "unclear";
  }
  if (input.overByMinutes >= 45) {
    return "overloaded";
  }
  if (input.overByMinutes > 0 || input.signals.some((signal) => signal !== "must_win_unclear")) {
    return "tight";
  }

  return "clear";
}

function buildCapacitySummary(
  status: DayCapacityStatus,
  input: {
    overByMinutes: number;
    slippedTaskCount: number;
    unsizedTaskCount: number;
    pendingTaskCount: number;
    plannedEstimatedMinutes: number;
    plannedBlockMinutes: number;
  },
) {
  if (status === "drifting") {
    return `${input.slippedTaskCount} slipped`;
  }
  if (status === "overloaded") {
    return input.overByMinutes > 0 ? `${input.overByMinutes} min over` : "Reduced day";
  }
  if (status === "unclear") {
    return `${input.unsizedTaskCount} need size`;
  }
  if (status === "tight") {
    if (input.overByMinutes > 0) {
      return `${input.overByMinutes} min over`;
    }
    return `${input.pendingTaskCount} open`;
  }
  if (input.plannedBlockMinutes > 0) {
    return `${input.plannedEstimatedMinutes}/${input.plannedBlockMinutes} min planned`;
  }

  return "Plan fits";
}

function toBlockAssessment(block: TimelineBlock): DayCapacityBlockAssessment {
  let status: DayCapacityBlockAssessment["status"] = "clear";
  if (block.status === "past" && block.pendingCount > 0) {
    status = "drifting";
  } else if (block.overByMinutes > 15) {
    status = "overloaded";
  } else if (block.overByMinutes > 0) {
    status = "tight";
  }

  return {
    plannerBlockId: block.block.id,
    title: block.block.title,
    status,
    pendingTaskCount: block.pendingCount,
    estimatedMinutes: block.estimatedMinutes,
    capacityMinutes: block.capacityMinutes,
    overByMinutes: block.overByMinutes,
  };
}
