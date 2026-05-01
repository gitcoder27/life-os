export const UNPLANNED_TASK_DRAG_TYPE = "unplanned-task";
export const PLANNER_BLOCK_DROP_TYPE = "planner-block";
export const DAILY_RHYTHM_DRAG_TYPE = "daily-rhythm";
export const DAILY_RHYTHM_TIMELINE_DROP_TYPE = "daily-rhythm-timeline";

export function getUnplannedTaskDragId(taskId: string): string {
  return `planner-unplanned-task:${taskId}`;
}

export function getPlannerBlockDropId(blockId: string): string {
  return `planner-block:${blockId}`;
}

export function getDailyRhythmDragId(itemId: string): string {
  return `planner-daily-rhythm:${itemId}`;
}
