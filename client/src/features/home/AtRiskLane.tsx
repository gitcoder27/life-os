import { Link } from "react-router-dom";
import { getQuickCaptureDisplayText } from "../../shared/lib/quickCapture";
import type { TaskItem } from "../../shared/lib/api";

type RadarItem = {
  id: string;
  kind: "overdue_task" | "stale_inbox";
  title: string;
  label: string;
  notes: string | null;
  taskKind: TaskItem["kind"];
  reminderAt: string | null;
};

type AttentionItem = {
  id: string;
  title: string;
  detail?: string;
  kind: string;
  tone: string;
  action:
    | { type: "open_review"; route: string }
    | { type: "open_route"; route: string };
};

type AtRiskLaneProps = {
  radarItems: RadarItem[];
  attentionItems: AttentionItem[];
  overdueCount: number;
  staleInboxCount: number;
};

function radarRoute(kind: "overdue_task" | "stale_inbox", itemId?: string) {
  if (kind === "stale_inbox") return "/inbox";
  return itemId
    ? `/today?view=overdue&taskId=${encodeURIComponent(itemId)}`
    : "/today?view=overdue";
}

export function AtRiskLane({
  radarItems,
  attentionItems,
  overdueCount,
  staleInboxCount,
}: AtRiskLaneProps) {
  const totalRisks = overdueCount + staleInboxCount + attentionItems.length;

  if (totalRisks === 0) return null;

  return (
    <div className="at-risk-lane">
      <div className="at-risk-lane__header">
        <h3 className="section-label">At Risk</h3>
        <span className="at-risk-lane__count">{totalRisks}</span>
      </div>

      <div className="at-risk-lane__summary">
        {overdueCount > 0 ? (
          <Link to="/today?view=overdue" className="risk-badge risk-badge--overdue">
            <span className="risk-badge__count">{overdueCount}</span>
            <span className="risk-badge__label">overdue task{overdueCount !== 1 ? "s" : ""}</span>
          </Link>
        ) : null}
        {staleInboxCount > 0 ? (
          <Link to="/inbox" className="risk-badge risk-badge--stale">
            <span className="risk-badge__count">{staleInboxCount}</span>
            <span className="risk-badge__label">stale inbox</span>
          </Link>
        ) : null}
      </div>

      <div className="at-risk-lane__items">
        {radarItems.slice(0, 3).map((item) => (
          <Link
            key={item.id}
            to={radarRoute(item.kind, item.id)}
            className="risk-row"
          >
            <span className="risk-row__title">
              {item.kind === "stale_inbox"
                ? getQuickCaptureDisplayText(
                    { kind: item.taskKind, notes: item.notes, reminderAt: item.reminderAt },
                    item.title,
                  )
                : item.title}
            </span>
            <span className="risk-row__detail">{item.label}</span>
          </Link>
        ))}

        {attentionItems.slice(0, 3).map((item) => (
          <Link
            key={item.id}
            to={item.action.route}
            className={`risk-row risk-row--${item.tone}`}
          >
            <span className="risk-row__title">{item.title}</span>
            {item.detail ? (
              <span className="risk-row__detail">{item.detail}</span>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
