import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { getQuickCaptureDisplayText } from "../../shared/lib/quickCapture";
import type {
  HomeAction,
  HomeAttentionItem,
  TaskItem,
} from "../../shared/lib/api";
import { resolveHomeActionTarget } from "../../shared/lib/homeNavigation";

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
  id: HomeAttentionItem["id"];
  title: HomeAttentionItem["title"];
  detail?: HomeAttentionItem["detail"];
  kind: HomeAttentionItem["kind"];
  tone: HomeAttentionItem["tone"];
  dismissible?: HomeAttentionItem["dismissible"];
  action: HomeAction;
};

type AtRiskLaneProps = {
  sessionKey: string;
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
  sessionKey,
  radarItems,
  attentionItems,
  overdueCount,
  staleInboxCount,
}: AtRiskLaneProps) {
  const storageKey = `home-warning-dismissals:${sessionKey}`;
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [hasLoadedDismissals, setHasLoadedDismissals] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const rawValue = window.sessionStorage.getItem(storageKey);
      setDismissedIds(rawValue ? JSON.parse(rawValue) as string[] : []);
    } catch {
      setDismissedIds([]);
    } finally {
      setHasLoadedDismissals(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !hasLoadedDismissals) {
      return;
    }

    window.sessionStorage.setItem(storageKey, JSON.stringify(dismissedIds));
  }, [dismissedIds, hasLoadedDismissals, storageKey]);

  const visibleAttentionItems = useMemo(
    () => attentionItems.filter((item) => !item.dismissible || !dismissedIds.includes(item.id)),
    [attentionItems, dismissedIds],
  );
  const totalRisks = overdueCount + staleInboxCount + visibleAttentionItems.length;

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

        {visibleAttentionItems.slice(0, 3).map((item) => {
          const target = resolveHomeActionTarget(item.action);

          return (
            <div key={item.id} className="risk-row-shell">
              <Link
                to={target.to}
                state={target.state}
                className={`risk-row risk-row--${item.tone}`}
              >
                <span className="risk-row__title">{item.title}</span>
                {item.detail ? (
                  <span className="risk-row__detail">{item.detail}</span>
                ) : null}
              </Link>

              {item.dismissible ? (
                <button
                  className="risk-row__dismiss"
                  type="button"
                  onClick={() => {
                    setDismissedIds((current) => current.includes(item.id) ? current : [...current, item.id]);
                  }}
                >
                  Dismiss
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
