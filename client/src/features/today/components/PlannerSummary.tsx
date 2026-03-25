import { formatTimeLabel } from "../../../shared/lib/api";
import type { PlannerExecutionModel } from "../helpers/planner-execution";

export function PlannerSummary({
  execution,
  unplannedTaskCount,
  onSwitchToPlanner,
}: {
  execution: PlannerExecutionModel;
  unplannedTaskCount: number;
  onSwitchToPlanner: () => void;
}) {
  if (execution.orderedBlocks.length === 0) {
    return null;
  }

  const totalTasks = execution.orderedBlocks.reduce((sum, block) => sum + block.totalCount, 0);
  const completedTasks = execution.orderedBlocks.reduce(
    (sum, block) => sum + block.completedCount,
    0,
  );

  return (
    <div className="planner-summary">
      <div className="planner-summary__header">
        <h3 className="today-context-title">Day plan</h3>
        <button
          className="planner-summary__edit-btn"
          type="button"
          onClick={onSwitchToPlanner}
        >
          Edit plan
        </button>
      </div>

      {execution.currentBlock ? (
        <div className="planner-summary__current">
          <div className="planner-summary__now-label">Now</div>
          <div className="planner-summary__block-name">
            {execution.currentBlock.block.title || "Untitled block"}
          </div>
          <div className="planner-summary__block-time">
            {formatTimeLabel(execution.currentBlock.block.startsAt)} -{" "}
            {formatTimeLabel(execution.currentBlock.block.endsAt)}
          </div>
          {execution.currentBlock.tasks.length > 0 ? (
            <div className="planner-summary__block-tasks">
              {execution.currentBlock.tasks.map((task) => (
                <div
                  key={task.taskId}
                  className={`planner-summary__task ${task.task.status === "completed" ? "planner-summary__task--done" : ""}`}
                >
                  {task.task.status === "completed" ? "✓" : "○"} {task.task.title}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : execution.nextBlock ? (
        <div className="planner-summary__next">
          <div className="planner-summary__next-label">
            Up next · {formatTimeLabel(execution.nextBlock.block.startsAt)}
          </div>
          <div className="planner-summary__block-name">
            {execution.nextBlock.block.title || "Untitled block"}
          </div>
        </div>
      ) : null}

      {execution.slippedBlocks.length > 0 ? (
        <div className="planner-summary__alert">
          <span>
            {execution.slippedTaskCount} task{execution.slippedTaskCount === 1 ? "" : "s"} slipped from earlier blocks
          </span>
          <button
            className="planner-summary__alert-btn"
            type="button"
            onClick={onSwitchToPlanner}
          >
            Fix plan
          </button>
        </div>
      ) : execution.currentBlock?.health === "at_risk" ? (
        <div className="planner-summary__alert">
          <span>
            Current block is at risk with {execution.currentBlock.pendingCount} task
            {execution.currentBlock.pendingCount === 1 ? "" : "s"} left
          </span>
          <button
            className="planner-summary__alert-btn"
            type="button"
            onClick={onSwitchToPlanner}
          >
            Adjust
          </button>
        </div>
      ) : null}

      {unplannedTaskCount > 0 ? (
        <div className="planner-summary__alert">
          <span>{unplannedTaskCount} task{unplannedTaskCount === 1 ? "" : "s"} still unplanned</span>
          <button
            className="planner-summary__alert-btn"
            type="button"
            onClick={onSwitchToPlanner}
          >
            Plan remaining
          </button>
        </div>
      ) : null}

      <div className="planner-summary__stats">
        <span>{execution.orderedBlocks.length} block{execution.orderedBlocks.length !== 1 ? "s" : ""}</span>
        <span className="planner-summary__sep">·</span>
        <span>{completedTasks}/{totalTasks} tasks</span>
        {unplannedTaskCount > 0 ? (
          <>
            <span className="planner-summary__sep">·</span>
            <span>{unplannedTaskCount} unplanned</span>
          </>
        ) : null}
      </div>

      <div className="planner-summary__timeline">
        {execution.orderedBlocks.map((block) => {
          const isCurrent = execution.currentBlock?.block.id === block.block.id;
          const isNext = execution.nextBlock?.block.id === block.block.id;
          const isSlipped = block.health === "off_track";
          return (
            <div
              key={block.block.id}
              className={[
                "planner-summary__row",
                isCurrent ? "planner-summary__row--current" : "",
                isNext ? "planner-summary__row--next" : "",
                isSlipped ? "planner-summary__row--slipped" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="planner-summary__row-time">
                {formatTimeLabel(block.block.startsAt)}
              </span>
              <span className="planner-summary__row-title">
                {block.block.title || "Untitled"}
              </span>
              {block.totalCount > 0 ? (
                <span className="planner-summary__row-progress">
                  {block.completedCount}/{block.totalCount}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
