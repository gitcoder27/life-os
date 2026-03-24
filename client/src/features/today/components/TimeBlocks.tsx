import { formatTimeLabel } from "../../../shared/lib/api";
import type { TaskItem } from "../../../shared/lib/api";

export function TimeBlocks({ tasks }: { tasks: TaskItem[] }) {
  if (tasks.length === 0) return null;

  return (
    <div className="today-time-blocks">
      <h3 className="today-context-title">Schedule</h3>
      <div className="today-time-blocks__list">
        {tasks.map((task) => (
          <div key={task.id} className="today-time-block">
            <span className="today-time-block__time">{formatTimeLabel(task.dueAt)}</span>
            <span className="today-time-block__label">{task.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
