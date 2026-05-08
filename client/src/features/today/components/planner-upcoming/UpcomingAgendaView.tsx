import type { TaskItem } from "../../../../shared/lib/api";
import {
  formatEstimatedMinutes,
  getRelativeUpcomingLabel,
  getTaskKindLabel,
  getUpcomingDayLabel,
  getUpcomingTaskTitle,
  type UpcomingTaskGroup,
} from "../../helpers/upcoming-calendar";

type UpcomingAgendaViewProps = {
  groups: UpcomingTaskGroup[];
  todayDate: string;
  onOpenDate: (date: string) => void;
  onEditTask: (task: TaskItem) => void;
};

export function UpcomingAgendaView({
  groups,
  todayDate,
  onOpenDate,
  onEditTask,
}: UpcomingAgendaViewProps) {
  return (
    <div className="planner-upcoming__list">
      {groups.map((group) => (
        <section className="planner-upcoming__group" key={group.date}>
          <div className="planner-upcoming__date">
            <div>
              <span className="planner-upcoming__relative">
                {getRelativeUpcomingLabel(group.date, todayDate)}
              </span>
              <span className="planner-upcoming__full-date">
                {getUpcomingDayLabel(group.date)}
              </span>
            </div>
            <button
              className="planner-upcoming__open-day"
              type="button"
              onClick={() => onOpenDate(group.date)}
            >
              Open day
            </button>
          </div>

          <div className="planner-upcoming__tasks">
            {group.tasks.map((task) => {
              const estimatedMinutes = formatEstimatedMinutes(task.estimatedDurationMinutes);
              const focusMinutes = task.focusLengthMinutes
                ? `${task.focusLengthMinutes}m focus`
                : null;

              return (
                <div className="planner-upcoming__task" key={task.id}>
                  <button
                    className="planner-upcoming__task-main"
                    type="button"
                    onClick={() => onEditTask(task)}
                  >
                    <span className={`planner-upcoming__kind planner-upcoming__kind--${task.kind}`}>
                      {getTaskKindLabel(task.kind)}
                    </span>
                    <span className="planner-upcoming__task-copy">
                      <span className="planner-upcoming__task-title">{getUpcomingTaskTitle(task)}</span>
                      <span className="planner-upcoming__task-meta">
                        {task.goal ? <span>{task.goal.title}</span> : null}
                        {estimatedMinutes ? <span>{estimatedMinutes}</span> : null}
                        {focusMinutes ? <span>{focusMinutes}</span> : null}
                        {task.recurrence ? <span>Recurring</span> : null}
                      </span>
                    </span>
                  </button>
                  <button
                    className="planner-upcoming__task-action"
                    type="button"
                    onClick={() => onOpenDate(group.date)}
                  >
                    Open day
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

