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

type AttentionSectionProps = {
  radarItems: RadarItem[];
  attentionItems: AttentionItem[];
};

function radarRoute(kind: "overdue_task" | "stale_inbox", itemId?: string) {
  if (kind === "stale_inbox") return "/inbox";
  return itemId
    ? `/today?view=overdue&taskId=${encodeURIComponent(itemId)}`
    : "/today?view=overdue";
}

function radarActionLabel(kind: "overdue_task" | "stale_inbox") {
  return kind === "overdue_task" ? "Recover task" : "Open Inbox";
}

function attentionActionLabel(action: AttentionItem["action"]) {
  if (action.type === "open_review") return "Open review";
  switch (action.route) {
    case "/today": return "Open Today";
    case "/habits": return "Open Habits";
    case "/health": return "Open Health";
    case "/finance": return "Open Finance";
    case "/inbox": return "Open Inbox";
    default: return "Open";
  }
}

export function AttentionSection({
  radarItems,
  attentionItems,
}: AttentionSectionProps) {
  if (radarItems.length === 0 && attentionItems.length === 0) {
    return null;
  }

  return (
    <div className="dash-card">
      <h3 className="dash-card__title">Attention Required</h3>
      <div className="attention-rows">
        {radarItems.map((item) => (
          <Link
            key={item.id}
            to={radarRoute(item.kind, item.id)}
            className={`attention-row attention-row--${item.kind}`}
          >
            <div className="attention-row__body">
              <span className="attention-row__title">
                {item.kind === "stale_inbox"
                  ? getQuickCaptureDisplayText(
                      { kind: item.taskKind, notes: item.notes, reminderAt: item.reminderAt },
                      item.title,
                    )
                  : item.title}
              </span>
              <span className="attention-row__detail">{item.label}</span>
            </div>
            <span className="attention-row__action">
              {radarActionLabel(item.kind)} &rarr;
            </span>
          </Link>
        ))}

        {attentionItems.map((item) => (
          <Link
            key={item.id}
            to={item.action.route}
            className="attention-row attention-row--attention"
          >
            <div className="attention-row__body">
              <span className="attention-row__title">{item.title}</span>
              <span className="attention-row__detail">
                {item.detail ?? `${item.kind.replace(/_/g, " ")} · ${item.tone}`}
              </span>
            </div>
            <span className="attention-row__action">
              {attentionActionLabel(item.action)} &rarr;
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
