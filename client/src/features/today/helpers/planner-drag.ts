export const UNPLANNED_TASK_DRAG_TYPE = "unplanned-task";
export const PLANNER_BLOCK_DROP_TYPE = "planner-block";

export function getUnplannedTaskDragId(taskId: string): string {
  return `planner-unplanned-task:${taskId}`;
}

export function getPlannerBlockDropId(blockId: string): string {
  return `planner-block:${blockId}`;
}
