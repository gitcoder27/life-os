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
  actions,
}: {
  date: string;
  blocks: DayPlannerBlockItem[];
  unplannedTasks: TaskItem[];
  actions: PlannerActions;
}) {
  const [showForm, setShowForm] = useState(false);
  const orderedBlocks = [...blocks].sort((a, b) => a.sortOrder - b.sortOrder);

  function handleMoveBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= orderedBlocks.length) {
      return;
    }

    const blockIds = orderedBlocks.map((block) => block.id);
    [blockIds[index], blockIds[target]] = [blockIds[target], blockIds[index]];
    actions.reorder(blockIds);
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

      <div className="planner__body">
        <div className="planner__timeline">
          {showForm ? (
            <PlannerBlockForm
              date={date}
              existingBlocks={orderedBlocks}
              onSubmit={(payload) => {
                actions.addBlock(payload);
                setShowForm(false);
              }}
              onCancel={() => setShowForm(false)}
            />
          ) : null}

          {orderedBlocks.length === 0 && !showForm ? (
            <div className="planner__empty">
              <div className="planner__empty-icon">📅</div>
              <p className="planner__empty-title">Build the shape of the day first</p>
              <p className="planner__empty-desc">
                Start with one block, add a few core sessions, then drop tasks into the right
                places.
              </p>
              <div className="planner__empty-steps">
                <span>1. Create your first block.</span>
                <span>2. Use the quick presets if they help.</span>
                <span>3. Assign tasks from the unplanned lane or from inside each block.</span>
              </div>
              <button
                className="button button--primary button--small"
                type="button"
                onClick={() => setShowForm(true)}
              >
                Create first block
              </button>
            </div>
          ) : null}

          {orderedBlocks.map((block, index) => (
            <PlannerBlock
              key={block.id}
              block={block}
              existingBlocks={orderedBlocks}
              availableTasks={unplannedTasks}
              availableBlocks={orderedBlocks}
              canMoveUp={index > 0}
              canMoveDown={index < orderedBlocks.length - 1}
              onMoveBlock={(direction) => handleMoveBlock(index, direction)}
              onAddTask={(taskId) => actions.assignTaskToBlock(block, taskId)}
              onMoveTaskToBlock={(taskId, targetBlock) =>
                actions.moveTaskToBlock(targetBlock, taskId)
              }
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
          blocks={orderedBlocks}
          onQuickAssign={(taskId, block) => actions.assignTaskToBlock(block, taskId)}
        />
      </div>
    </div>
  );
}
