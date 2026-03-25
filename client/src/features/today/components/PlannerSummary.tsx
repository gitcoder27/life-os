import { formatTimeLabel } from "../../../shared/lib/api";
import type { DayPlannerBlockItem } from "../../../shared/lib/api";

export function PlannerSummary({
  blocks,
  unplannedTaskCount,
  onSwitchToPlanner,
}: {
  blocks: DayPlannerBlockItem[];
  unplannedTaskCount: number;
  onSwitchToPlanner: () => void;
}) {
  if (blocks.length === 0) return null;

  const sorted = [...blocks].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );

  const now = new Date();
  const currentBlock = sorted.find((b) => {
    const start = new Date(b.startsAt);
    const end = new Date(b.endsAt);
    return now >= start && now < end;
  });

  const nextBlock = sorted.find((b) => new Date(b.startsAt) > now);

  const totalTasks = sorted.reduce((sum, b) => sum + b.tasks.length, 0);
  const completedTasks = sorted.reduce(
    (sum, b) => sum + b.tasks.filter((bt) => bt.task.status === "completed").length,
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

      {currentBlock ? (
        <div className="planner-summary__current">
          <div className="planner-summary__now-label">Now</div>
          <div className="planner-summary__block-name">
            {currentBlock.title || "Untitled block"}
          </div>
          <div className="planner-summary__block-time">
            {formatTimeLabel(currentBlock.startsAt)} – {formatTimeLabel(currentBlock.endsAt)}
          </div>
          {currentBlock.tasks.length > 0 ? (
            <div className="planner-summary__block-tasks">
              {currentBlock.tasks
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((bt) => (
                  <div
                    key={bt.taskId}
                    className={`planner-summary__task ${bt.task.status === "completed" ? "planner-summary__task--done" : ""}`}
                  >
                    {bt.task.status === "completed" ? "✓" : "○"} {bt.task.title}
                  </div>
                ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {nextBlock && !currentBlock ? (
        <div className="planner-summary__next">
          <div className="planner-summary__next-label">
            Up next · {formatTimeLabel(nextBlock.startsAt)}
          </div>
          <div className="planner-summary__block-name">
            {nextBlock.title || "Untitled block"}
          </div>
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
        <span>{sorted.length} block{sorted.length !== 1 ? "s" : ""}</span>
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
        {sorted.map((block) => {
          const tasksDone = block.tasks.filter((bt) => bt.task.status === "completed").length;
          const isCurrent = currentBlock?.id === block.id;
          return (
            <div
              key={block.id}
              className={`planner-summary__row ${isCurrent ? "planner-summary__row--current" : ""}`}
            >
              <span className="planner-summary__row-time">
                {formatTimeLabel(block.startsAt)}
              </span>
              <span className="planner-summary__row-title">
                {block.title || "Untitled"}
              </span>
              {block.tasks.length > 0 ? (
                <span className="planner-summary__row-progress">
                  {tasksDone}/{block.tasks.length}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
