import type { DayPlannerBlockItem, DayPlannerBlockTaskItem, TaskItem } from "../../../shared/lib/api";

const AT_RISK_ELAPSED_PERCENT = 75;

export type PlannerExecutionTimelineStatus = "past" | "current" | "upcoming";
export type PlannerExecutionHealth = "on_track" | "at_risk" | "off_track" | "complete";
export type PlannerExecutionFocusState =
  | "no_plan"
  | "current"
  | "gap_before_next"
  | "off_track"
  | "plan_complete";
export type PlannerExecutionDayHealth = "aligned" | "unplanned" | "at_risk" | "off_track";
export type PlannerCleanupState = "none" | "replan_now" | "close_day";

export type PlannerExecutionBlockModel = {
  block: DayPlannerBlockItem;
  tasks: DayPlannerBlockTaskItem[];
  pendingTasks: DayPlannerBlockTaskItem[];
  completedTasks: DayPlannerBlockTaskItem[];
  pendingCount: number;
  completedCount: number;
  totalCount: number;
  taskProgressPercent: number;
  timeProgressPercent: number;
  elapsedMinutes: number;
  remainingMinutes: number;
  startsInMinutes: number | null;
  endedMinutesAgo: number | null;
  timelineStatus: PlannerExecutionTimelineStatus;
  health: PlannerExecutionHealth;
};

export type PlannerExecutionCleanupModel = {
  state: PlannerCleanupState;
  targetBlock: PlannerExecutionBlockModel | null;
  taskIds: string[];
  blockCount: number;
  taskCount: number;
  dayEndedMinutesAgo: number | null;
};

export type PlannerExecutionModel = {
  orderedBlocks: PlannerExecutionBlockModel[];
  currentBlock: PlannerExecutionBlockModel | null;
  nextBlock: PlannerExecutionBlockModel | null;
  slippedBlocks: PlannerExecutionBlockModel[];
  cleanup: PlannerExecutionCleanupModel;
  focusState: PlannerExecutionFocusState;
  dayHealth: PlannerExecutionDayHealth;
  unplannedTasks: TaskItem[];
  unplannedTaskCount: number;
  slippedTaskCount: number;
};

export const buildPlannerExecutionModel = (input: {
  blocks: DayPlannerBlockItem[];
  unplannedTasks: TaskItem[];
  now: Date;
}): PlannerExecutionModel => {
  const orderedBlocks = sortPlannerBlocksByTime(input.blocks).map((block) =>
    buildExecutionBlock(block, input.now),
  );
  const currentBlock =
    orderedBlocks.find((block) => block.timelineStatus === "current") ?? null;
  const nextBlock =
    orderedBlocks.find((block) => block.timelineStatus === "upcoming") ?? null;
  const slippedBlocks = orderedBlocks.filter((block) => block.health === "off_track");
  const slippedTaskCount = slippedBlocks.reduce((sum, block) => sum + block.pendingCount, 0);

  let focusState: PlannerExecutionFocusState = "plan_complete";
  if (orderedBlocks.length === 0) {
    focusState = "no_plan";
  } else if (currentBlock) {
    focusState = "current";
  } else if (slippedBlocks.length > 0) {
    focusState = "off_track";
  } else if (nextBlock) {
    focusState = "gap_before_next";
  }

  let dayHealth: PlannerExecutionDayHealth = "aligned";
  if (slippedBlocks.length > 0) {
    dayHealth = "off_track";
  } else if (currentBlock?.health === "at_risk") {
    dayHealth = "at_risk";
  } else if (input.unplannedTasks.length > 0) {
    dayHealth = "unplanned";
  }

  const cleanupTargetBlock = currentBlock ?? nextBlock;
  const cleanupState: PlannerCleanupState =
    slippedBlocks.length === 0
      ? "none"
      : cleanupTargetBlock
        ? "replan_now"
        : "close_day";
  const cleanupTaskIds = slippedBlocks.flatMap((block) =>
    block.pendingTasks.map((task) => task.taskId),
  );
  const dayEndedMinutesAgo =
    cleanupState === "close_day" && orderedBlocks.length > 0
      ? orderedBlocks[orderedBlocks.length - 1]?.endedMinutesAgo ?? null
      : null;

  return {
    orderedBlocks,
    currentBlock,
    nextBlock,
    slippedBlocks,
    cleanup: {
      state: cleanupState,
      targetBlock: cleanupTargetBlock,
      taskIds: cleanupTaskIds,
      blockCount: slippedBlocks.length,
      taskCount: cleanupTaskIds.length,
      dayEndedMinutesAgo,
    },
    focusState,
    dayHealth,
    unplannedTasks: input.unplannedTasks,
    unplannedTaskCount: input.unplannedTasks.length,
    slippedTaskCount,
  };
};

export const sortPlannerBlocksByTime = (blocks: DayPlannerBlockItem[]) =>
  [...blocks].sort((left, right) => {
    const timeDiff =
      new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }

    return left.sortOrder - right.sortOrder;
  });

const buildExecutionBlock = (
  block: DayPlannerBlockItem,
  now: Date,
): PlannerExecutionBlockModel => {
  const tasks = [...block.tasks].sort((left, right) => left.sortOrder - right.sortOrder);
  const pendingTasks = tasks.filter((item) => item.task.status === "pending");
  const completedTasks = tasks.filter((item) => item.task.status === "completed");
  const startTime = new Date(block.startsAt).getTime();
  const endTime = new Date(block.endsAt).getTime();
  const nowTime = now.getTime();
  const durationMinutes = Math.max(Math.round((endTime - startTime) / 60_000), 0);
  const elapsedMinutes = getElapsedMinutes(startTime, endTime, nowTime);
  const remainingMinutes = Math.max(durationMinutes - elapsedMinutes, 0);
  const timelineStatus = getTimelineStatus(startTime, endTime, nowTime);
  const timeProgressPercent =
    durationMinutes > 0 ? Math.min((elapsedMinutes / durationMinutes) * 100, 100) : 0;
  const totalCount = tasks.length;
  const completedCount = completedTasks.length;
  const pendingCount = pendingTasks.length;

  let health: PlannerExecutionHealth = "on_track";
  if (pendingCount === 0) {
    health = "complete";
  } else if (timelineStatus === "past") {
    health = "off_track";
  } else if (timelineStatus === "current" && timeProgressPercent >= AT_RISK_ELAPSED_PERCENT) {
    health = "at_risk";
  }

  return {
    block,
    tasks,
    pendingTasks,
    completedTasks,
    pendingCount,
    completedCount,
    totalCount,
    taskProgressPercent: totalCount > 0 ? (completedCount / totalCount) * 100 : 0,
    timeProgressPercent,
    elapsedMinutes,
    remainingMinutes,
    startsInMinutes:
      timelineStatus === "upcoming" ? Math.max(Math.round((startTime - nowTime) / 60_000), 0) : null,
    endedMinutesAgo:
      timelineStatus === "past" ? Math.max(Math.round((nowTime - endTime) / 60_000), 0) : null,
    timelineStatus,
    health,
  };
};

const getTimelineStatus = (
  startTime: number,
  endTime: number,
  nowTime: number,
): PlannerExecutionTimelineStatus => {
  if (nowTime >= endTime) {
    return "past";
  }

  if (nowTime >= startTime && nowTime < endTime) {
    return "current";
  }

  return "upcoming";
};

const getElapsedMinutes = (startTime: number, endTime: number, nowTime: number) => {
  if (nowTime <= startTime) {
    return 0;
  }

  if (nowTime >= endTime) {
    return Math.max(Math.round((endTime - startTime) / 60_000), 0);
  }

  return Math.max(Math.round((nowTime - startTime) / 60_000), 0);
};
