import type {
  ApplyShapeDayRequest,
  IsoDateString,
  PlanningTaskItem,
  ShapeDayApplyResponse,
  ShapeDayPreviewResponse,
  ShapeDayProposedBlock,
} from "@life-os/contracts";

import { AppError } from "../../lib/errors/app-error.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { parseIsoDate } from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import { getUtcDateForLocalTime } from "../../lib/time/user-time.js";
import { validatePlannerBlockWindow } from "./planning-context.js";
import {
  assertNoPlannerBlockOverlap,
  loadPlannerBlocks,
  replacePlannerBlockTasks,
} from "./planning-repository.js";
import type { PlanningApp } from "./planning-types.js";
import type { AdaptiveTodayContext } from "./adaptive-today-context.js";
import {
  assessDayCapacity,
  getTaskPlanningMinutes,
  taskNeedsEstimate,
} from "./day-capacity.js";

const DAY_START_TIME = "09:00";
const DAY_END_TIME = "17:00";
const MIN_BLOCK_MINUTES = 15;
const MAX_GENERATED_BLOCK_MINUTES = 120;
const GENERATED_BLOCK_BUFFER_MINUTES = 10;

type ShapeWindow = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  cursor: Date;
  lastBlock: MutableProposedBlock | null;
};

type MutableProposedBlock = {
  tempId: string;
  title: string | null;
  startsAt: Date;
  endsAt: Date;
  taskIds: string[];
  tasks: Array<{
    taskId: string;
    title: string;
    estimatedMinutes: number;
    assumedMinutes: boolean;
  }>;
};

export function buildShapeDayPreview(input: {
  context: AdaptiveTodayContext;
  now?: Date;
}): ShapeDayPreviewResponse {
  const capacity = assessDayCapacity({
    tasks: input.context.tasks,
    plannerBlocks: input.context.plannerBlocks,
    launch: input.context.launch,
    mustWinTask: input.context.mustWinTask,
    now: input.now,
    isLiveDate: input.context.date === toIsoDateString(input.now ?? new Date()),
  });
  const plannedTaskIds = new Set(
    input.context.plannerBlocks.flatMap((block) => block.tasks.map((task) => task.taskId)),
  );
  const candidates = input.context.tasks
    .filter((task) => task.kind === "task" && task.status === "pending")
    .filter((task) => !plannedTaskIds.has(task.id))
    .sort((left, right) => scoreTask(right, input.context) - scoreTask(left, input.context));
  const windows = buildOpenWindows(input.context);
  const mutableBlocks: MutableProposedBlock[] = [];
  const proposedAssignments: ShapeDayPreviewResponse["proposedAssignments"] = [];
  const unplacedTasks: ShapeDayPreviewResponse["unplacedTasks"] = [];
  const needsEstimateTasks = candidates
    .filter(taskNeedsEstimate)
    .map((task) => ({
      taskId: task.id,
      title: task.title,
      estimatedMinutes: getTaskPlanningMinutes(task),
      assumedMinutes: true,
    }));

  for (const task of candidates) {
    const estimatedMinutes = getTaskPlanningMinutes(task);
    const assumedMinutes = taskNeedsEstimate(task);
    const placement = placeTaskInWindow({
      task,
      estimatedMinutes,
      assumedMinutes,
      windows,
      mutableBlocks,
    });

    if (!placement) {
      unplacedTasks.push({
        taskId: task.id,
        title: task.title,
        reason: assumedMinutes ? "needs_estimate" : "no_open_window",
        estimatedMinutes,
      });
      continue;
    }

    proposedAssignments.push({
      taskId: task.id,
      taskTitle: task.title,
      blockTempId: placement.block.tempId,
      startsAt: placement.startsAt.toISOString(),
      endsAt: placement.endsAt.toISOString(),
      estimatedMinutes,
      assumedMinutes,
    });
  }

  const proposedBlocks = mutableBlocks.map(toProposedBlock);

  return withGeneratedAt({
    date: input.context.date,
    summary: buildShapeSummary(proposedBlocks.length, proposedAssignments.length, needsEstimateTasks.length, unplacedTasks.length),
    capacity,
    proposedBlocks,
    proposedAssignments,
    needsEstimateTasks,
    unplacedTasks,
    preservedBlocks: input.context.plannerBlocks.map((block) => ({
      plannerBlockId: block.id,
      title: block.title,
      startsAt: block.startsAt,
      endsAt: block.endsAt,
      taskCount: block.tasks.length,
    })),
  });
}

export async function applyShapeDayPlan(
  app: PlanningApp,
  input: {
    context: AdaptiveTodayContext;
    payload: ApplyShapeDayRequest;
    now?: Date;
  },
): Promise<ShapeDayApplyResponse> {
  const proposedBlocks = normalizeProposedBlocks(input.payload.proposedBlocks);
  assertProposedBlocksDoNotOverlap(proposedBlocks);
  const taskIds = proposedBlocks.flatMap((block) => block.taskIds);

  if (taskIds.length === 0) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Shape preview must include at least one task to apply",
    });
  }

  await assertShapeTasksAreStillAssignable(app, {
    userId: input.context.userId,
    date: input.context.date,
    taskIds,
  });

  const plannerBlocks = await app.prisma.$transaction(async (tx) => {
    const existingBlockCount = await tx.dayPlannerBlock.count({
      where: {
        planningCycleId: input.context.cycleId,
      },
    });

    for (const [index, block] of proposedBlocks.entries()) {
      const { startsAt, endsAt } = validatePlannerBlockWindow(
        input.context.date,
        input.context.timezone,
        block.startsAt,
        block.endsAt,
      );
      await assertNoPlannerBlockOverlap(tx, input.context.cycleId, startsAt, endsAt);

      const createdBlock = await tx.dayPlannerBlock.create({
        data: {
          planningCycleId: input.context.cycleId,
          title: block.title?.trim() || null,
          startsAt,
          endsAt,
          sortOrder: existingBlockCount + index + 1,
        },
      });

      await replacePlannerBlockTasks(tx, {
        userId: input.context.userId,
        date: input.context.date,
        blockId: createdBlock.id,
        blockStartsAt: startsAt,
        taskIds: block.taskIds,
      });
    }

    return loadPlannerBlocks(tx, input.context.cycleId);
  });

  const capacity = assessDayCapacity({
    tasks: input.context.tasks,
    plannerBlocks,
    launch: input.context.launch,
    mustWinTask: input.context.mustWinTask,
    now: input.now,
    isLiveDate: input.context.date === toIsoDateString(input.now ?? new Date()),
  });

  return withGeneratedAt({
    date: input.context.date,
    summary: buildApplySummary(proposedBlocks.length, taskIds.length),
    plannerBlocks,
    capacity,
  });
}

function buildOpenWindows(context: AdaptiveTodayContext): ShapeWindow[] {
  const dayStart = getUtcDateForLocalTime(context.date, DAY_START_TIME, context.timezone);
  const dayEnd = getUtcDateForLocalTime(context.date, DAY_END_TIME, context.timezone);
  const windows: ShapeWindow[] = [];
  let cursor = dayStart;

  const existingBlocks = [...context.plannerBlocks]
    .map((block) => ({
      startsAt: new Date(block.startsAt),
      endsAt: new Date(block.endsAt),
    }))
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());

  for (const block of existingBlocks) {
    addWindow(windows, cursor, new Date(Math.min(block.startsAt.getTime(), dayEnd.getTime())));
    cursor = new Date(Math.max(cursor.getTime(), block.endsAt.getTime()));
  }

  addWindow(windows, cursor, dayEnd);

  return windows;
}

function addWindow(windows: ShapeWindow[], startsAt: Date, endsAt: Date) {
  if (endsAt.getTime() - startsAt.getTime() < MIN_BLOCK_MINUTES * 60_000) {
    return;
  }

  windows.push({
    id: `window-${windows.length + 1}`,
    startsAt,
    endsAt,
    cursor: startsAt,
    lastBlock: null,
  });
}

function placeTaskInWindow(input: {
  task: PlanningTaskItem;
  estimatedMinutes: number;
  assumedMinutes: boolean;
  windows: ShapeWindow[];
  mutableBlocks: MutableProposedBlock[];
}) {
  const durationMs = input.estimatedMinutes * 60_000;

  for (const window of input.windows) {
    if (window.lastBlock) {
      const extendedEnd = new Date(window.lastBlock.endsAt.getTime() + durationMs);
      const generatedDuration = Math.round((extendedEnd.getTime() - window.lastBlock.startsAt.getTime()) / 60_000);
      if (extendedEnd <= window.endsAt && generatedDuration <= MAX_GENERATED_BLOCK_MINUTES) {
        const startsAt = window.lastBlock.endsAt;
        window.lastBlock.endsAt = extendedEnd;
        window.lastBlock.taskIds.push(input.task.id);
        window.lastBlock.tasks.push(toTaskPreview(input.task, input.estimatedMinutes, input.assumedMinutes));
        window.cursor = new Date(extendedEnd.getTime() + GENERATED_BLOCK_BUFFER_MINUTES * 60_000);
        return {
          block: window.lastBlock,
          startsAt,
          endsAt: extendedEnd,
        };
      }
    }

    const startsAt = window.cursor;
    const endsAt = new Date(startsAt.getTime() + durationMs);
    if (endsAt > window.endsAt) {
      continue;
    }

    const block: MutableProposedBlock = {
      tempId: `shape-${input.mutableBlocks.length + 1}`,
      title: input.task.goal?.title ?? "Focus block",
      startsAt,
      endsAt,
      taskIds: [input.task.id],
      tasks: [toTaskPreview(input.task, input.estimatedMinutes, input.assumedMinutes)],
    };
    input.mutableBlocks.push(block);
    window.lastBlock = block;
    window.cursor = new Date(endsAt.getTime() + GENERATED_BLOCK_BUFFER_MINUTES * 60_000);
    return {
      block,
      startsAt,
      endsAt,
    };
  }

  return null;
}

function toTaskPreview(task: PlanningTaskItem, estimatedMinutes: number, assumedMinutes: boolean) {
  return {
    taskId: task.id,
    title: task.title,
    estimatedMinutes,
    assumedMinutes,
  };
}

function toProposedBlock(block: MutableProposedBlock): ShapeDayProposedBlock {
  return {
    tempId: block.tempId,
    title: block.title,
    startsAt: block.startsAt.toISOString(),
    endsAt: block.endsAt.toISOString(),
    taskIds: block.taskIds,
    tasks: block.tasks,
  };
}

function scoreTask(task: PlanningTaskItem, context: AdaptiveTodayContext) {
  let score = 0;
  if (context.mustWinTask?.id === task.id) {
    score += 1000;
  }
  if (context.priorities.some((priority) => priority.goalId && priority.goalId === task.goalId)) {
    score += 180;
  }
  if (task.progressState === "started" || task.progressState === "advanced") {
    score += 120;
  }
  if (task.dueAt) {
    const dueAt = new Date(task.dueAt).getTime();
    const dayStart = parseIsoDate(context.date).getTime();
    score += Math.max(0, 100 - Math.round((dueAt - dayStart) / 3_600_000));
  }
  if (task.nextAction?.trim()) {
    score += 20;
  }
  if (taskNeedsEstimate(task)) {
    score -= 10;
  }

  return score;
}

function normalizeProposedBlocks(proposedBlocks: ShapeDayProposedBlock[]) {
  if (!Array.isArray(proposedBlocks) || proposedBlocks.length === 0 || proposedBlocks.length > 24) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Shape preview is empty or too large",
    });
  }

  const taskIds = proposedBlocks.flatMap((block) => block.taskIds);
  if (new Set(taskIds).size !== taskIds.length) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Shape preview cannot assign a task more than once",
    });
  }

  return [...proposedBlocks].sort(
    (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
  );
}

function assertProposedBlocksDoNotOverlap(proposedBlocks: ShapeDayProposedBlock[]) {
  for (let index = 1; index < proposedBlocks.length; index += 1) {
    const previous = proposedBlocks[index - 1]!;
    const current = proposedBlocks[index]!;
    if (new Date(previous.endsAt) > new Date(current.startsAt)) {
      throw new AppError({
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Shape preview blocks cannot overlap",
      });
    }
  }
}

async function assertShapeTasksAreStillAssignable(
  app: PlanningApp,
  input: {
    userId: string;
    date: IsoDateString;
    taskIds: string[];
  },
) {
  const [tasks, existingAssignments] = await Promise.all([
    app.prisma.task.findMany({
      where: {
        id: {
          in: input.taskIds,
        },
        userId: input.userId,
      },
      select: {
        id: true,
        kind: true,
        status: true,
        scheduledForDate: true,
      },
    }),
    app.prisma.dayPlannerBlockTask.findMany({
      where: {
        taskId: {
          in: input.taskIds,
        },
      },
      select: {
        taskId: true,
      },
    }),
  ]);

  if (tasks.length !== input.taskIds.length) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Task not found",
    });
  }

  const invalidTask = tasks.find((task: {
    kind: string;
    status: string;
    scheduledForDate: Date | null;
  }) => (
    task.kind !== "TASK" ||
    task.status !== "PENDING" ||
    !task.scheduledForDate ||
    toIsoDateString(task.scheduledForDate) !== input.date
  ));

  if (invalidTask) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Only pending tasks scheduled for the selected day can be shaped",
    });
  }

  if (existingAssignments.length > 0) {
    throw new AppError({
      statusCode: 409,
      code: "CONFLICT",
      message: "This plan changed in another tab. Refresh and try again.",
    });
  }
}

function buildShapeSummary(blockCount: number, placementCount: number, unsizedCount: number, unplacedCount: number) {
  const parts = [
    `Adds ${blockCount} block${blockCount === 1 ? "" : "s"}`,
    `places ${placementCount} task${placementCount === 1 ? "" : "s"}`,
  ];
  if (unsizedCount > 0) {
    parts.push(`flags ${unsizedCount} unsized`);
  }
  if (unplacedCount > 0) {
    parts.push(`leaves ${unplacedCount} unplaced`);
  }

  return `${parts.join(", ")}.`;
}

function buildApplySummary(blockCount: number, taskCount: number) {
  return `Added ${blockCount} block${blockCount === 1 ? "" : "s"} and placed ${taskCount} task${taskCount === 1 ? "" : "s"}.`;
}
