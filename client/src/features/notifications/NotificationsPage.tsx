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

const severityLabel: Record<string, string> = {
  info: "Info",
  warning: "Warning",
  critical: "Critical",
};

const severityTag: Record<string, string> = {
  info: "tag tag--neutral",
  warning: "tag tag--warning",
  critical: "tag tag--negative",
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

export function NotificationsPage() {
  const navigate = useNavigate();
  const notificationsQuery = useNotificationsQuery();
  const markReadMutation = useMarkNotificationReadMutation();
  const dismissMutation = useDismissNotificationMutation();

  if (notificationsQuery.isLoading && !notificationsQuery.data) {
    return (
      <PageLoadingState
        title="Loading notifications"
        description="Fetching your inbox from the backend."
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

  const all = notificationsQuery.data.notifications.filter(
    (n) => !n.dismissedAt,
  );
  const unread = all.filter((n) => !n.read);
  const read = all.filter((n) => n.read);

  function handleOpen(entityType: string | null, entityId: string | null) {
    const route = resolveEntityRoute(entityType, entityId);
    if (route) {
      navigate(route);
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="System alerts, reminders, and action items. Mark read, dismiss, or navigate to the source."
      />

      {all.length === 0 ? (
        <EmptyState
          title="All clear"
          description="No pending notifications right now."
        />
      ) : (
        <div className="notification-feed stagger">
          {unread.length > 0 && (
            <div className="notification-group">
              <div className="notification-group__label">Unread ({unread.length})</div>
              {unread.map((item) => {
                const route = resolveEntityRoute(item.entityType, item.entityId);
                return (
                  <div
                    key={item.id}
                    className="notification-row notification-row--unread"
                  >
                    <div className="notification-row__indicator" />
                    <div className="notification-row__body">
                      <div className="notification-row__header">
                        <span className={severityTag[item.severity] ?? "tag tag--neutral"}>
                          {severityLabel[item.severity] ?? item.severity}
                        </span>
                        <span className="notification-row__time">
                          {formatNotificationTime(item.createdAt)}
                        </span>
                      </div>
                      <div className="notification-row__title">{item.title}</div>
                      <div className="notification-row__text">{item.body}</div>
                      <div className="button-row button-row--tight" style={{ marginTop: "0.45rem" }}>
                        <button
                          className="button button--ghost button--small"
                          type="button"
                          onClick={() => markReadMutation.mutate(item.id)}
                          disabled={markReadMutation.isPending}
                        >
                          Mark read
                        </button>
                        <button
                          className="button button--ghost button--small"
                          type="button"
                          onClick={() => dismissMutation.mutate(item.id)}
                          disabled={dismissMutation.isPending}
                        >
                          Dismiss
                        </button>
                        {route && (
                          <button
                            className="button button--primary button--small"
                            type="button"
                            onClick={() => handleOpen(item.entityType, item.entityId)}
                          >
                            Open
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {read.length > 0 && (
            <div className="notification-group">
              <div className="notification-group__label">Read ({read.length})</div>
              {read.map((item) => {
                const route = resolveEntityRoute(item.entityType, item.entityId);
                return (
                  <div
                    key={item.id}
                    className="notification-row"
                  >
                    <div className="notification-row__body">
                      <div className="notification-row__header">
                        <span className={severityTag[item.severity] ?? "tag tag--neutral"}>
                          {severityLabel[item.severity] ?? item.severity}
                        </span>
                        <span className="notification-row__time">
                          {formatNotificationTime(item.createdAt)}
                        </span>
                      </div>
                      <div className="notification-row__title">{item.title}</div>
                      <div className="notification-row__text">{item.body}</div>
                      <div className="button-row button-row--tight" style={{ marginTop: "0.45rem" }}>
                        <button
                          className="button button--ghost button--small"
                          type="button"
                          onClick={() => dismissMutation.mutate(item.id)}
                          disabled={dismissMutation.isPending}
                        >
                          Dismiss
                        </button>
                        {route && (
                          <button
                            className="button button--ghost button--small"
                            type="button"
                            onClick={() => handleOpen(item.entityType, item.entityId)}
                          >
                            Open
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
