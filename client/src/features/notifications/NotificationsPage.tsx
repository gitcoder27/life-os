import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import {
  useDismissNotificationMutation,
  useMarkNotificationReadMutation,
  useNotificationsQuery,
} from "../../shared/lib/api";
import { PageHeader } from "../../shared/ui/PageHeader";
import {
  EmptyState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";

type NotifItem = {
  id: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
  entityType: string | null;
  entityId: string | null;
  read: boolean;
  dismissedAt: string | null;
  createdAt: string;
};

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const SEVERITY_CONFIG: Record<string, { label: string; className: string }> = {
  critical: { label: "Needs attention", className: "notif-severity-group--critical" },
  warning: { label: "Reminders", className: "notif-severity-group--warning" },
  info: { label: "Updates", className: "notif-severity-group--info" },
};

function resolveEntityRoute(
  entityType: string | null,
  entityId: string | null,
): string | null {
  if (!entityType) return null;

  if (entityType === "admin_item") return "/finance";
  if (entityType === "health_day") return "/health";
  if (entityType === "workout_day") return "/health";
  if (entityType === "habit") return "/habits";
  if (entityType === "routine_day") return "/habits";

  if (entityType === "daily_review" && entityId) {
    const datePart = entityId.includes(":") ? entityId.split(":").pop() : entityId;
    return `/reviews/daily?date=${datePart}`;
  }

  if (entityType === "weekly_review" && entityId) {
    const datePart = entityId.includes(":") ? entityId.split(":").pop() : entityId;
    return `/reviews/weekly?date=${datePart}`;
  }

  if (entityType === "monthly_review" && entityId) {
    const datePart = entityId.includes(":") ? entityId.split(":").pop() : entityId;
    return `/reviews/monthly?date=${datePart}`;
  }

  return null;
}

function resolveActionLabel(entityType: string | null): string {
  if (!entityType) return "Open";
  if (entityType === "admin_item") return "View finances";
  if (entityType === "health_day" || entityType === "workout_day") return "View health";
  if (entityType === "habit" || entityType === "routine_day") return "View habits";
  if (entityType.includes("review")) return "Open review";
  return "Open";
}

function formatNotificationTime(isoDateTime: string) {
  const date = new Date(isoDateTime);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function groupBySeverity(items: NotifItem[]) {
  const groups: Record<string, NotifItem[]> = {};

  for (const item of items) {
    const key = item.severity || "info";
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }

  return Object.entries(groups)
    .sort(([a], [b]) => (SEVERITY_ORDER[a] ?? 99) - (SEVERITY_ORDER[b] ?? 99));
}

function ActionCard({
  item,
  onMarkRead,
  onDismiss,
  onOpen,
  isMarkingRead,
  isDismissing,
}: {
  item: NotifItem;
  onMarkRead: () => void;
  onDismiss: () => void;
  onOpen: () => void;
  isMarkingRead: boolean;
  isDismissing: boolean;
}) {
  const route = resolveEntityRoute(item.entityType, item.entityId);
  const isUnread = !item.read;
  const severity = item.severity || "info";

  return (
    <div
      className={[
        "notif-action-card",
        isUnread ? "notif-action-card--unread" : "",
        `notif-action-card--${severity}`,
      ].filter(Boolean).join(" ")}
    >
      <div className="notif-action-card__rail">
        <span className="notif-action-card__dot" />
      </div>

      <div className="notif-action-card__body">
        <div className="notif-action-card__top">
          <span className="notif-action-card__title">{item.title}</span>
          <span className="notif-action-card__time">
            {formatNotificationTime(item.createdAt)}
          </span>
        </div>

        <div className="notif-action-card__text">{item.body}</div>

        <div className="notif-action-card__actions">
          {route && (
            <button
              className="button button--primary button--small"
              type="button"
              onClick={onOpen}
            >
              {resolveActionLabel(item.entityType)}
            </button>
          )}
          {isUnread && (
            <button
              className="button button--ghost button--small"
              type="button"
              onClick={onMarkRead}
              disabled={isMarkingRead}
            >
              Mark read
            </button>
          )}
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={onDismiss}
            disabled={isDismissing}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const notificationsQuery = useNotificationsQuery();
  const markReadMutation = useMarkNotificationReadMutation();
  const dismissMutation = useDismissNotificationMutation();

  const activeItems = useMemo(() => {
    if (!notificationsQuery.data) return [];
    return notificationsQuery.data.notifications.filter(
      (n: NotifItem) => !n.dismissedAt,
    );
  }, [notificationsQuery.data]);

  const severityGroups = useMemo(() => groupBySeverity(activeItems), [activeItems]);

  const counts = useMemo(() => {
    const result: Record<string, number> = { critical: 0, warning: 0, info: 0 };
    for (const item of activeItems) {
      const key = item.severity || "info";
      result[key] = (result[key] ?? 0) + 1;
    }
    return result;
  }, [activeItems]);

  const unreadCount = activeItems.filter((n: NotifItem) => !n.read).length;

  if (notificationsQuery.isLoading && !notificationsQuery.data) {
    return (
      <PageLoadingState
        title="Loading notifications"
        description="Fetching alerts and action items."
      />
    );
  }

  if (notificationsQuery.isError || !notificationsQuery.data) {
    return (
      <PageErrorState
        title="Notifications unavailable"
        message={
          notificationsQuery.error instanceof Error
            ? notificationsQuery.error.message
            : undefined
        }
        onRetry={() => void notificationsQuery.refetch()}
      />
    );
  }

  function handleOpen(entityType: string | null, entityId: string | null) {
    const route = resolveEntityRoute(entityType, entityId);
    if (route) {
      navigate(route);
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Action center"
        title="Notifications"
        description="Alerts, reminders, and items that need your attention — grouped by urgency."
      />

      {activeItems.length === 0 ? (
        <EmptyState
          title="All clear"
          description="No pending notifications. You're caught up — keep the momentum going."
        />
      ) : (
        <>
          {/* Summary strip */}
          <div className="notif-page__summary">
            {unreadCount > 0 && (
              <div className="notif-page__summary-stat">
                <span className="notif-page__summary-count">{unreadCount}</span>
                <span className="notif-page__summary-label">unread</span>
              </div>
            )}
            {counts.critical > 0 && (
              <div className="notif-page__summary-stat notif-page__summary-stat--critical">
                <span className="notif-page__summary-count">{counts.critical}</span>
                <span className="notif-page__summary-label">critical</span>
              </div>
            )}
            {counts.warning > 0 && (
              <div className="notif-page__summary-stat notif-page__summary-stat--warning">
                <span className="notif-page__summary-count">{counts.warning}</span>
                <span className="notif-page__summary-label">warning{counts.warning !== 1 ? "s" : ""}</span>
              </div>
            )}
            {counts.info > 0 && (
              <div className="notif-page__summary-stat notif-page__summary-stat--info">
                <span className="notif-page__summary-count">{counts.info}</span>
                <span className="notif-page__summary-label">info</span>
              </div>
            )}
          </div>

          {/* Severity groups */}
          <div className="stagger">
            {severityGroups.map(([severity, items]) => {
              const config = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.info;
              return (
                <div
                  key={severity}
                  className={`notif-severity-group ${config.className}`}
                >
                  <div className="notif-severity-group__header">
                    <span className="notif-severity-group__indicator" />
                    <span className="notif-severity-group__label">{config.label}</span>
                    <span className="notif-severity-group__count">{items.length}</span>
                  </div>
                  <div className="notif-severity-group__list">
                    {items.map((item) => (
                      <ActionCard
                        key={item.id}
                        item={item}
                        onMarkRead={() => markReadMutation.mutate(item.id)}
                        onDismiss={() => dismissMutation.mutate(item.id)}
                        onOpen={() => handleOpen(item.entityType, item.entityId)}
                        isMarkingRead={markReadMutation.isPending}
                        isDismissing={dismissMutation.isPending}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
