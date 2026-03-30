import {
  useCreatePlannerBlockMutation,
  useUpdatePlannerBlockMutation,
  useDeletePlannerBlockMutation,
  useReorderPlannerBlocksMutation,
  useReplacePlannerBlockTasksMutation,
  useRemovePlannerBlockTaskMutation,
  type DayPlannerBlockItem,
} from "../../../shared/lib/api";

export function usePlannerActions(date: string) {
  const createBlock = useCreatePlannerBlockMutation(date);
  const updateBlock = useUpdatePlannerBlockMutation(date);
  const deleteBlock = useDeletePlannerBlockMutation(date);
  const reorderBlocks = useReorderPlannerBlocksMutation(date);
  const replaceBlockTasks = useReplacePlannerBlockTasksMutation(date);
  const removeBlockTask = useRemovePlannerBlockTaskMutation(date);

  const isPending =
    createBlock.isPending ||
    updateBlock.isPending ||
    deleteBlock.isPending ||
    reorderBlocks.isPending ||
    replaceBlockTasks.isPending ||
    removeBlockTask.isPending;

  const mutationError = [
    createBlock.error,
    updateBlock.error,
    deleteBlock.error,
    reorderBlocks.error,
    replaceBlockTasks.error,
    removeBlockTask.error,
  ]
    .filter((e): e is Error => e instanceof Error)
    .map((e) => e.message)
    .join("; ") || null;

  function addBlock(payload: {
    title?: string | null;
    startsAt: string;
    endsAt: string;
    taskIds?: string[];
  }) {
    createBlock.mutate(payload);
  }

  function editBlock(
    blockId: string,
    updates: { title?: string | null; startsAt?: string; endsAt?: string },
  ) {
    return updateBlock.mutateAsync({ blockId, ...updates });
  }

  function removeBlock(blockId: string) {
    deleteBlock.mutate(blockId);
  }

  function reorder(blockIds: string[]) {
    reorderBlocks.mutate(blockIds);
  }

  async function duplicateBlock(payload: {
    title?: string | null;
    startsAt: string;
    endsAt: string;
  }) {
    await createBlock.mutateAsync(payload);
  }

  function assignTaskToBlock(block: DayPlannerBlockItem, taskId: string) {
    const existingTaskIds = block.tasks.map((bt) => bt.taskId);
    if (existingTaskIds.includes(taskId)) return;
    replaceBlockTasks.mutate({
      blockId: block.id,
      taskIds: [...existingTaskIds, taskId],
    });
  }

  async function assignTasksToBlock(block: DayPlannerBlockItem, taskIds: string[]) {
    const existingTaskIds = block.tasks.map((bt) => bt.taskId);
    const nextTaskIds = [...existingTaskIds];

    for (const taskId of taskIds) {
      if (!nextTaskIds.includes(taskId)) {
        nextTaskIds.push(taskId);
      }
    }

    if (nextTaskIds.length === existingTaskIds.length) {
      return;
    }

    await replaceBlockTasks.mutateAsync({
      blockId: block.id,
      taskIds: nextTaskIds,
    });
  }

  function removeTaskFromBlock(blockId: string, taskId: string) {
    removeBlockTask.mutate({ blockId, taskId });
  }

  async function unplanTaskIdsFromBlock(block: DayPlannerBlockItem, taskIds: string[]) {
    const taskIdsToRemove = new Set(taskIds);
    const remainingTaskIds = block.tasks
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((task) => task.taskId)
      .filter((taskId) => !taskIdsToRemove.has(taskId));

    if (remainingTaskIds.length === block.tasks.length) {
      return;
    }

    await replaceBlockTasks.mutateAsync({
      blockId: block.id,
      taskIds: remainingTaskIds,
    });
  }

  async function unplanPendingTasksFromBlocks(blocks: DayPlannerBlockItem[]) {
    for (const block of blocks) {
      const pendingTaskIds = block.tasks
        .filter((bt) => bt.task.status === "pending")
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((bt) => bt.taskId);

      if (pendingTaskIds.length === 0) {
        continue;
      }

      await unplanTaskIdsFromBlock(block, pendingTaskIds);
    }
  }

  function reorderTasksInBlock(block: DayPlannerBlockItem, taskIds: string[]) {
    replaceBlockTasks.mutate({ blockId: block.id, taskIds });
  }

  function moveTaskToBlock(targetBlock: DayPlannerBlockItem, taskId: string) {
    const targetTaskIds = targetBlock.tasks.map((bt) => bt.taskId);
    if (targetTaskIds.includes(taskId)) return;
    replaceBlockTasks.mutate({
      blockId: targetBlock.id,
      taskIds: [...targetTaskIds, taskId],
    });
  }

  async function splitBlock(block: DayPlannerBlockItem, splitStartsAt: string) {
    const originalEnd = block.endsAt;

    await updateBlock.mutateAsync({
      blockId: block.id,
      endsAt: splitStartsAt,
    });

    try {
      await createBlock.mutateAsync({
        title: block.title,
        startsAt: splitStartsAt,
        endsAt: originalEnd,
      });
    } catch (error) {
      await updateBlock.mutateAsync({
        blockId: block.id,
        endsAt: originalEnd,
      });
      throw error;
    }
  }

  async function carryPendingTasksToBlock(
    sourceBlock: DayPlannerBlockItem,
    targetBlock: DayPlannerBlockItem,
  ) {
    const pendingTaskIds = sourceBlock.tasks
      .filter((bt) => bt.task.status === "pending")
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((bt) => bt.taskId);

    if (pendingTaskIds.length === 0) {
      return;
    }

    const targetTaskIds = targetBlock.tasks.map((bt) => bt.taskId);
    const nextTaskIds = [...targetTaskIds];

    for (const taskId of pendingTaskIds) {
      if (!nextTaskIds.includes(taskId)) {
        nextTaskIds.push(taskId);
      }
    }

    await replaceBlockTasks.mutateAsync({
      blockId: targetBlock.id,
      taskIds: nextTaskIds,
    });
  }

  return {
    isPending,
    mutationError,
    addBlock,
    duplicateBlock,
    editBlock,
    removeBlock,
    reorder,
    assignTaskToBlock,
    assignTasksToBlock,
    removeTaskFromBlock,
    unplanTaskIdsFromBlock,
    unplanPendingTasksFromBlocks,
    reorderTasksInBlock,
    moveTaskToBlock,
    splitBlock,
    carryPendingTasksToBlock,
  };
}
