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
    updateBlock.mutate({ blockId, ...updates });
  }

  function removeBlock(blockId: string) {
    deleteBlock.mutate(blockId);
  }

  function reorder(blockIds: string[]) {
    reorderBlocks.mutate(blockIds);
  }

  function assignTaskToBlock(block: DayPlannerBlockItem, taskId: string) {
    const existingTaskIds = block.tasks.map((bt) => bt.taskId);
    if (existingTaskIds.includes(taskId)) return;
    replaceBlockTasks.mutate({
      blockId: block.id,
      taskIds: [...existingTaskIds, taskId],
    });
  }

  function removeTaskFromBlock(blockId: string, taskId: string) {
    removeBlockTask.mutate({ blockId, taskId });
  }

  function reorderTasksInBlock(block: DayPlannerBlockItem, taskIds: string[]) {
    replaceBlockTasks.mutate({ blockId: block.id, taskIds });
  }

  function moveTaskBetweenBlocks(
    sourceBlock: DayPlannerBlockItem,
    targetBlock: DayPlannerBlockItem,
    taskId: string,
  ) {
    const targetTaskIds = targetBlock.tasks.map((bt) => bt.taskId);
    if (targetTaskIds.includes(taskId)) return;
    replaceBlockTasks.mutate({
      blockId: targetBlock.id,
      taskIds: [...targetTaskIds, taskId],
    });
  }

  return {
    isPending,
    mutationError,
    addBlock,
    editBlock,
    removeBlock,
    reorder,
    assignTaskToBlock,
    removeTaskFromBlock,
    reorderTasksInBlock,
    moveTaskBetweenBlocks,
  };
}
