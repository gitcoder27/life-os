import type { LinkedGoal } from "../../shared/lib/api";

type Priority = {
  id: string;
  slot: 1 | 2 | 3;
  title: string;
  status: "pending" | "completed" | "dropped";
  goal: LinkedGoal | null;
};

type TodayControlProps = {
  priorities: Priority[];
  openTaskCount: number;
};

function statusMark(status: Priority["status"]) {
  if (status === "completed") return "done";
  if (status === "dropped") return "skip";
  return "";
}

export function TodayControl({ priorities, openTaskCount }: TodayControlProps) {
  if (priorities.length === 0 && openTaskCount === 0) return null;

  const completedCount = priorities.filter((p) => p.status === "completed").length;

  return (
    <div className="today-control">
      <div className="today-control__header">
        <h3 className="section-label">Today</h3>
        {priorities.length > 0 ? (
          <span className="today-control__progress">
            {completedCount}/{priorities.length} priorities
          </span>
        ) : null}
      </div>

      {priorities.length > 0 ? (
        <div className="today-control__priorities">
          {priorities.map((p) => (
            <div
              key={p.id}
              className={`priority-line${p.status !== "pending" ? ` priority-line--${p.status}` : ""}`}
            >
              <span className="priority-line__slot">{p.slot}</span>
              <div className="priority-line__body">
                <span className="priority-line__title">{p.title}</span>
                {p.goal ? (
                  <span className="priority-line__goal">{p.goal.title}</span>
                ) : null}
              </div>
              {p.status !== "pending" ? (
                <span className="priority-line__mark">{statusMark(p.status)}</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {openTaskCount > 0 && priorities.length > 0 ? (
        <div className="today-control__tasks">
          + {openTaskCount} more open task{openTaskCount !== 1 ? "s" : ""}
        </div>
      ) : null}
    </div>
  );
}
