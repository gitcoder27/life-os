import type {
  DayPlannerBlockItem,
  DriftRecoveryAction,
  DriftRecoveryChangePreview,
  DriftRecoveryRequest,
  DriftRecoveryResponse,
  IsoDateString,
  PlanningTaskItem,
} from "@life-os/contracts";

import { AppError } from "../../lib/errors/app-error.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { addIsoDays, parseIsoDate } from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import {
  loadPlannerBlocks,
  normalizePlannerBlockTaskSortOrders,
  replacePlannerBlockTasks,
} from "./planning-repository.js";
import type { PlanningApp } from "./planning-types.js";
import type { AdaptiveTodayContext } from "./adaptive-today-context.js";
import { assessDayCapacity } from "./day-capacity.js";

type ExecutionState = {
  orderedBlocks: DayPlannerBlockItem[];
  currentBlock: DayPlannerBlockItem | null;
  nextBlock: DayPlannerBlockItem | null;
  slippedBlocks: DayPlannerBlockItem[];
  taskBlockMap: Map<string, DayPlannerBlockItem>;
};

export function previewDriftRecovery(input: {
  context: AdaptiveTodayContext;
  payload: DriftRecoveryRequest;
  now?: Date;
}): DriftRecoveryResponse {
  const state = buildExecutionState(input.context.plannerBlocks, input.now ?? new Date());
  const taskIds = resolveRecoveryTaskIds(input.payload, state);
  const changes = buildRecoveryChanges({
    context: input.context,
    payload: input.payload,
    state,
    taskIds,
  });

  return withGeneratedAt({
    date: input.context.date,
    action: input.payload.action,
    mode: "preview",
    summary: buildRecoverySummary(input.payload.action, taskIds.length),
    affectedTaskIds: taskIds,
    changes,
  });
}

export async function applyDriftRecovery(
  app: PlanningApp,
  input: {
    context: AdaptiveTodayContext;
    payload: DriftRecoveryRequest;
    now?: Date;
  },
): Promise<DriftRecoveryResponse> {
  const state = buildExecutionState(input.context.plannerBlocks, input.now ?? new Date());
  const taskIds = resolveRecoveryTaskIds(input.payload, state);
  const changes = buildRecoveryChanges({
    context: input.context,
    payload: input.payload,
    state,
    taskIds,
  });

  if (taskIds.length === 0) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Recovery needs at least one slipped task",
    });
  }

  await assertRecoveryTasksBelongToUser(app, input.context.userId, taskIds);

  const updatedPlannerBlocks = await app.prisma.$transaction(async (tx) => {
    if (input.payload.action === "move_to_current_block" || input.payload.action === "move_to_next_block") {
      const targetBlock = resolveTargetBlock(input.payload, state);
      const existingTaskIds = targetBlock.tasks.map((task) => task.taskId);
      const nextTaskIds = [...existingTaskIds, ...taskIds.filter((taskId) => !existingTaskIds.includes(taskId))];

      await replacePlannerBlockTasks(tx, {
        userId: input.context.userId,
        date: input.context.date,
        blockId: targetBlock.id,
        blockStartsAt: new Date(targetBlock.startsAt),
        taskIds: nextTaskIds,
      });
      return loadPlannerBlocks(tx, input.context.cycleId);
    }

    if (input.payload.action === "unplan") {
      await deletePlannerAssignments(tx, taskIds);
      await tx.task.updateMany({
        where: {
          id: {
            in: taskIds,
          },
        },
        data: {
          dueAt: null,
        },
      });
      await normalizeAffectedBlocks(tx, state, taskIds);
      return loadPlannerBlocks(tx, input.context.cycleId);
    }

    if (input.payload.action === "carry_forward_tomorrow") {
      await deletePlannerAssignments(tx, taskIds);
      await tx.task.updateMany({
        where: {
          id: {
            in: taskIds,
          },
        },
        data: {
          scheduledForDate: parseIsoDate(addIsoDays(input.context.date, 1)),
          dueAt: null,
        },
      });
      await normalizeAffectedBlocks(tx, state, taskIds);
      return loadPlannerBlocks(tx, input.context.cycleId);
    }

    if (input.payload.action === "shrink_to_five_minutes") {
      const task = input.context.tasks.find((candidate) => candidate.id === taskIds[0]);
      await tx.task.update({
        where: {
          id: taskIds[0],
        },
        data: {
          nextAction: task?.fiveMinuteVersion?.trim() || task?.nextAction || undefined,
          estimatedDurationMinutes: 5,
          focusLengthMinutes: 5,
        },
      });
      return loadPlannerBlocks(tx, input.context.cycleId);
    }

    const [protectedTaskId, ...deferredTaskIds] = taskIds;
    await tx.dailyLaunch.upsert({
      where: {
        planningCycleId: input.context.cycleId,
      },
      update: {
        mustWinTaskId: protectedTaskId,
        dayMode: "RESCUE",
        rescueReason: "OVERLOAD",
        rescueSuggestedAt: input.context.launch?.rescueSuggestedAt
          ? new Date(input.context.launch.rescueSuggestedAt)
          : new Date(),
        rescueActivatedAt: new Date(),
        rescueExitedAt: null,
      },
      create: {
        userId: input.context.userId,
        planningCycleId: input.context.cycleId,
        mustWinTaskId: protectedTaskId,
        dayMode: "RESCUE",
        rescueReason: "OVERLOAD",
        rescueSuggestedAt: new Date(),
        rescueActivatedAt: new Date(),
      },
    });
    if (deferredTaskIds.length > 0) {
      await deletePlannerAssignments(tx, deferredTaskIds);
      await tx.task.updateMany({
        where: {
          id: {
            in: deferredTaskIds,
          },
        },
        data: {
          scheduledForDate: parseIsoDate(addIsoDays(input.context.date, 1)),
          dueAt: null,
        },
      });
      await normalizeAffectedBlocks(tx, state, deferredTaskIds);
    }

    return loadPlannerBlocks(tx, input.context.cycleId);
  });

  const capacityTasks = getCapacityTasksAfterRecovery(input.context.tasks, input.payload.action, taskIds);
  const capacity = assessDayCapacity({
    tasks: capacityTasks,
    plannerBlocks: updatedPlannerBlocks,
    launch: input.context.launch,
    mustWinTask: input.context.mustWinTask,
    now: input.now,
    isLiveDate: input.context.date === toIsoDateString(input.now ?? new Date()),
  });

  return withGeneratedAt({
    date: input.context.date,
    action: input.payload.action,
    mode: "apply",
    summary: buildAppliedRecoverySummary(input.payload.action, taskIds.length),
    affectedTaskIds: taskIds,
    changes,
    plannerBlocks: updatedPlannerBlocks,
    capacity,
  });
}

function buildExecutionState(blocks: DayPlannerBlockItem[], now: Date): ExecutionState {
  const orderedBlocks = [...blocks].sort(
    (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
  );
  const taskBlockMap = new Map<string, DayPlannerBlockItem>();
  for (const block of orderedBlocks) {
    for (const blockTask of block.tasks) {
      taskBlockMap.set(blockTask.taskId, block);
    }
  }

  return {
    orderedBlocks,
    currentBlock: orderedBlocks.find((block) => {
      const startsAt = new Date(block.startsAt);
      const endsAt = new Date(block.endsAt);
      return now >= startsAt && now < endsAt;
    }) ?? null,
    nextBlock: orderedBlocks.find((block) => new Date(block.startsAt) > now) ?? null,
    slippedBlocks: orderedBlocks.filter((block) =>
      new Date(block.endsAt) <= now && block.tasks.some((task) => task.task.status === "pending"),
    ),
    taskBlockMap,
  };
}

function resolveRecoveryTaskIds(payload: DriftRecoveryRequest, state: ExecutionState) {
  const requestedTaskIds = payload.taskIds?.filter(Boolean) ?? [];
  if (requestedTaskIds.length > 0) {
    return [...new Set(requestedTaskIds)];
  }

  return [
    ...new Set(
      state.slippedBlocks.flatMap((block) =>
        block.tasks
          .filter((blockTask) => blockTask.task.status === "pending")
          .map((blockTask) => blockTask.taskId),
      ),
    ),
  ];
}

function buildRecoveryChanges(input: {
  context: AdaptiveTodayContext;
  payload: DriftRecoveryRequest;
  state: ExecutionState;
  taskIds: string[];
}): DriftRecoveryChangePreview[] {
  const targetLabel = getRecoveryTargetLabel(input.payload, input.state, input.context.date);

  return input.taskIds.map((taskId) => {
    const task = input.context.tasks.find((candidate) => candidate.id === taskId);
    const fromBlock = input.state.taskBlockMap.get(taskId);

    if (!task || !fromBlock) {
      throw new AppError({
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Recovery tasks must still be planned in this day",
      });
    }

    return {
      taskId,
      title: task.title,
      from: fromBlock.title ?? "Past block",
      to: targetLabel,
    };
  });
}

function getRecoveryTargetLabel(payload: DriftRecoveryRequest, state: ExecutionState, date: IsoDateString) {
  if (payload.action === "move_to_current_block") {
    return (payload.targetBlockId
      ? state.orderedBlocks.find((block) => block.id === payload.targetBlockId)?.title
      : state.currentBlock?.title) ?? "Current block";
  }
  if (payload.action === "move_to_next_block") {
    return (payload.targetBlockId
      ? state.orderedBlocks.find((block) => block.id === payload.targetBlockId)?.title
      : state.nextBlock?.title) ?? "Next block";
  }
  if (payload.action === "unplan") {
    return "Unplanned";
  }
  if (payload.action === "carry_forward_tomorrow") {
    return addIsoDays(date, 1);
  }
  if (payload.action === "shrink_to_five_minutes") {
    return "Five-minute version";
  }
  return "Reduced day";
}

function resolveTargetBlock(payload: DriftRecoveryRequest, state: ExecutionState) {
  const inferredBlock =
    payload.action === "move_to_current_block"
      ? state.currentBlock
      : payload.action === "move_to_next_block"
        ? state.nextBlock
        : null;
  const targetBlock = payload.targetBlockId
    ? state.orderedBlocks.find((block) => block.id === payload.targetBlockId) ?? inferredBlock
    : inferredBlock;

  if (!targetBlock) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Recovery target block is not available",
    });
  }

  return targetBlock;
}

async function assertRecoveryTasksBelongToUser(app: PlanningApp, userId: string, taskIds: string[]) {
  const tasks = await app.prisma.task.findMany({
    where: {
      id: {
        in: taskIds,
      },
      userId,
    },
    select: {
      id: true,
    },
  });

  if (tasks.length !== taskIds.length) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Task not found",
    });
  }
}

async function deletePlannerAssignments(tx: any, taskIds: string[]) {
  if (taskIds.length === 0) {
    return;
  }

  await tx.dayPlannerBlockTask.deleteMany({
    where: {
      taskId: {
        in: taskIds,
      },
    },
  });
}

async function normalizeAffectedBlocks(tx: any, state: ExecutionState, taskIds: string[]) {
  const blockIds = [
    ...new Set(
      taskIds.flatMap((taskId) => {
        const block = state.taskBlockMap.get(taskId);
        return block ? [block.id] : [];
      }),
    ),
  ];

  await Promise.all(blockIds.map((blockId) => normalizePlannerBlockTaskSortOrders(tx, blockId)));
}

function getCapacityTasksAfterRecovery(
  tasks: PlanningTaskItem[],
  action: DriftRecoveryAction,
  taskIds: string[],
) {
  if (action === "carry_forward_tomorrow") {
    const movedIds = new Set(taskIds);
    return tasks.filter((task) => !movedIds.has(task.id));
  }
  if (action !== "activate_reduced_day") {
    return tasks;
  }

  const [, ...deferredTaskIds] = taskIds;
  const movedIds = new Set(deferredTaskIds);
  return tasks.filter((task) => !movedIds.has(task.id));
}

function buildRecoverySummary(action: DriftRecoveryAction, count: number) {
  if (action === "move_to_current_block") {
    return `Move ${count} slipped task${count === 1 ? "" : "s"} into the current block.`;
  }
  if (action === "move_to_next_block") {
    return `Move ${count} slipped task${count === 1 ? "" : "s"} into the next block.`;
  }
  if (action === "unplan") {
    return `Return ${count} slipped task${count === 1 ? "" : "s"} to unplanned.`;
  }
  if (action === "carry_forward_tomorrow") {
    return `Carry ${count} slipped task${count === 1 ? "" : "s"} to tomorrow.`;
  }
  if (action === "shrink_to_five_minutes") {
    return "Shrink the first slipped task to five minutes.";
  }
  return `Protect one task and defer ${Math.max(count - 1, 0)}.`;
}

function buildAppliedRecoverySummary(action: DriftRecoveryAction, count: number) {
  if (action === "carry_forward_tomorrow") {
    return `Moved ${count} task${count === 1 ? "" : "s"} to tomorrow.`;
  }
  if (action === "unplan") {
    return `Unplanned ${count} slipped task${count === 1 ? "" : "s"}.`;
  }
  if (action === "shrink_to_five_minutes") {
    return "Shrank one task to five minutes.";
  }
  if (action === "activate_reduced_day") {
    return "Reduced day is active.";
  }
  return `Moved ${count} slipped task${count === 1 ? "" : "s"}.`;
}
