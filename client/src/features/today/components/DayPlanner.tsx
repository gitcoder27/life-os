import { useState } from "react";
import type { DayPlannerBlockItem, TaskItem } from "../../../shared/lib/api";
import type { usePlannerActions } from "../hooks/usePlannerActions";
import { PlannerBlock } from "./PlannerBlock";
import { PlannerBlockForm } from "./PlannerBlockForm";
import { UnplannedTasks } from "./UnplannedTasks";

type PlannerActions = ReturnType<typeof usePlannerActions>;

export function DayPlanner({
  date,
  blocks,
  unplannedTasks,
  plannedTaskIds,
  actions,
}: {
  date: string;
  blocks: DayPlannerBlockItem[];
  unplannedTasks: TaskItem[];
  plannedTaskIds: Set<string>;
  actions: PlannerActions;
}) {
  const [showForm, setShowForm] = useState(false);
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);

  const sortedBlocks = [...blocks].sort((a, b) => {
    const timeDiff = new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.sortOrder - b.sortOrder;
  });

  function handleAssignTask(taskId: string) {
    setAssigningTaskId(taskId);
  }

  function handleSelectBlock(block: DayPlannerBlockItem) {
    if (!assigningTaskId) return;
    actions.assignTaskToBlock(block, assigningTaskId);
    setAssigningTaskId(null);
  }

  function handleCancelAssign() {
    setAssigningTaskId(null);
  }

  return (
    <div className="planner">
      <div className="planner__header">
        <h2 className="planner__title">Day Plan</h2>
        <button
          className="button button--primary button--small"
          type="button"
          onClick={() => setShowForm(true)}
          disabled={showForm}
        >
          + Add block
        </button>
      </div>

      {actions.mutationError ? (
        <div className="planner__error">{actions.mutationError}</div>
      ) : null}

      {assigningTaskId ? (
        <div className="planner__assign-banner">
          <span>Select a block to place this task</span>
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={handleCancelAssign}
          >
            Cancel
          </button>
        </div>
      ) : null}

      <div className="planner__body">
        <div className="planner__timeline">
          {showForm ? (
            <PlannerBlockForm
              date={date}
              existingBlocks={sortedBlocks}
              onSubmit={(payload) => {
                actions.addBlock(payload);
                setShowForm(false);
              }}
              onCancel={() => setShowForm(false)}
            />
          ) : null}

          {sortedBlocks.length === 0 && !showForm ? (
            <div className="planner__empty">
              <div className="planner__empty-icon">📅</div>
              <p className="planner__empty-title">No blocks yet</p>
              <p className="planner__empty-desc">
                Create your first time block to start organizing the day.
              </p>
            </div>
          ) : null}

          {sortedBlocks.map((block) => (
            <PlannerBlock
              key={block.id}
              block={block}
              isAssigning={assigningTaskId !== null}
              onSelectForAssign={() => handleSelectBlock(block)}
              onEditBlock={(updates) => actions.editBlock(block.id, updates)}
              onDeleteBlock={() => actions.removeBlock(block.id)}
              onRemoveTask={(taskId) => actions.removeTaskFromBlock(block.id, taskId)}
              onReorderTasks={(taskIds) => actions.reorderTasksInBlock(block, taskIds)}
              isPending={actions.isPending}
            />
          ))}
        </div>

        <UnplannedTasks
          tasks={unplannedTasks}
          blocks={sortedBlocks}
          assigningTaskId={assigningTaskId}
          onAssignTask={handleAssignTask}
          onQuickAssign={(taskId, block) => actions.assignTaskToBlock(block, taskId)}
          onCancelAssign={handleCancelAssign}
        />
      </div>
    </div>
  );
}
