import type { LinkedGoal } from "../../shared/lib/api";

type Priority = {
  id: string;
  slot: 1 | 2 | 3;
  title: string;
  status: "pending" | "completed" | "dropped";
  goal: LinkedGoal | null;
};

type PrioritiesListProps = {
  priorities: Priority[];
};

function statusIcon(status: Priority["status"]) {
  if (status === "completed") return "✓";
  if (status === "dropped") return "—";
  return "";
}

export function PrioritiesList({ priorities }: PrioritiesListProps) {
  if (priorities.length === 0) {
    return null;
  }

  return (
    <div className="dash-card">
      <h3 className="dash-card__title">Top Priorities</h3>
      <div className="priority-rows">
        {priorities.map((p) => (
          <div
            key={p.id}
            className={`priority-row${p.status !== "pending" ? ` priority-row--${p.status}` : ""}`}
          >
            <span className="priority-row__slot">{p.slot}</span>
            <div className="priority-row__body">
              <span className="priority-row__title">{p.title}</span>
              {p.goal ? (
                <span className="priority-row__goal">{p.goal.title}</span>
              ) : null}
            </div>
            {p.status !== "pending" ? (
              <span className="priority-row__status">{statusIcon(p.status)}</span>
            ) : (
              <span className="priority-row__checkbox" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
