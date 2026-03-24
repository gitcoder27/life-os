import type { TaskItem } from "../../../shared/lib/api";
import { getQuickCaptureDisplayText } from "../../../shared/lib/quickCapture";

export function DayNotes({ tasks }: { tasks: TaskItem[] }) {
  if (tasks.length === 0) return null;

  return (
    <div className="today-day-notes">
      <h3 className="today-context-title">Day Notes</h3>
      <ul className="today-day-notes__list">
        {tasks.map((task) => (
          <li key={task.id} className="today-day-note">
            <span className="today-day-note__text">
              {getQuickCaptureDisplayText(task, task.title)}
            </span>
            <span className={`today-day-note__tag ${task.status === "completed" ? "today-day-note__tag--done" : ""}`}>
              {task.status === "completed" ? "Done" : "Open"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
