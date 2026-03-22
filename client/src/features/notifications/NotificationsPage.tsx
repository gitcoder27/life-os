import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getPreferredTimezone,
  useDismissNotificationMutation,
  useMarkNotificationReadMutation,
  useNotificationsQuery,
  useSnoozeNotificationMutation,
} from "../../shared/lib/api";
import type { NotificationItem, SnoozePreset } from "../../shared/lib/api";
import { PageHeader } from "../../shared/ui/PageHeader";
import {
  EmptyState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";

type FilterTab = "all" | "needs_action" | "read";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "needs_action", label: "Needs action" },
  { key: "read", label: "Read" },
];

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

const CATEGORY_LABELS: Record<string, string> = {
  task: "Task",
  review: "Review",
  finance: "Finance",
  health: "Health",
  habit: "Habit",
  routine: "Routine",
};

function resolveEntityRoute(
  entityType: string | null,
  entityId: string | null,
): string | null {
  if (!entityType) return null;

  if (entityType === "admin_item") return "/finance";
  if (entityType === "task") return "/today";
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
  if (entityType === "task") return "Open today";
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

function isTonightAvailable(): boolean {
  const tz = getPreferredTimezone();
  if (!tz) return true;
  try {
    const nowInTz = new Date().toLocaleString("en-US", { timeZone: tz, hour12: false, hour: "2-digit" });
    const hour = parseInt(nowInTz, 10);
    return hour < 18;
  } catch {
    return true;
  }
}

function groupBySeverity(items: NotificationItem[]) {
  const groups: Record<string, NotificationItem[]> = {};

  for (const item of items) {
    const key = item.severity || "info";
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }

  return Object.entries(groups)
    .sort(([a], [b]) => (SEVERITY_ORDER[a] ?? 99) - (SEVERITY_ORDER[b] ?? 99));
}

function SnoozeMenu({
  notificationId,
  onSnooze,
  isSnooping,
}: {
  notificationId: string;
  onSnooze: (notificationId: string, preset: SnoozePreset) => void;
  isSnooping: boolean;
}) {
  const [open, setOpen] = useState(false);
  const tonightOk = isTonightAvailable();

  if (!open) {
    return (
      <button
        className="button button--ghost button--small"
        type="button"
        onClick={() => setOpen(true)}
        disabled={isSnooping}
      >
        Snooze
      </button>
    );
  }

  return (
    <div className="notif-snooze-group">
      <button
        className="button button--ghost button--small notif-snooze-btn"
        type="button"
        disabled={isSnooping}
        onClick={() => { onSnooze(notificationId, "one_hour"); setOpen(false); }}
      >
        1h
      </button>
      {tonightOk && (
        <button
          className="button button--ghost button--small notif-snooze-btn"
          type="button"
          disabled={isSnooping}
          onClick={() => { onSnooze(notificationId, "tonight"); setOpen(false); }}
        >
          Tonight
        </button>
      )}
      <button
        className="button button--ghost button--small notif-snooze-btn"
        type="button"
        disabled={isSnooping}
        onClick={() => { onSnooze(notificationId, "tomorrow"); setOpen(false); }}
      >
        Tomorrow
      </button>
      <button
        className="button button--ghost button--small"
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Cancel snooze"
      >
        ✕
      </button>
    </div>
  );
}

function ActionCard({
  item,
  onMarkRead,
  onDismiss,
  onOpen,
  onSnooze,
  isMarkingRead,
  isDismissing,
  isSnooping,
}: {
  item: NotificationItem;
  onMarkRead: () => void;
  onDismiss: () => void;
  onOpen: () => void;
  onSnooze: (notificationId: string, preset: SnoozePreset) => void;
  isMarkingRead: boolean;
  isDismissing: boolean;
  isSnooping: boolean;
}) {
  const route = resolveEntityRoute(item.entityType, item.entityId);
  const isUnread = !item.read;
  const severity = item.severity || "info";
  const category = item.notificationType || "routine";

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
          <span className={`notif-category-badge notif-category-badge--${category}`}>
            {CATEGORY_LABELS[category] ?? category}
          </span>
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
          <SnoozeMenu
            notificationId={item.id}
            onSnooze={onSnooze}
            isSnooping={isSnooping}
          />
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
  const snoozeMutation = useSnoozeNotificationMutation();

  const [activeFilter, setActiveFilter] = useState<FilterTab>("needs_action");

  const activeItems = useMemo(() => {
    if (!notificationsQuery.data) return [];
    return notificationsQuery.data.notifications.filter(
      (n: NotificationItem) => !n.dismissedAt,
    );
  }, [notificationsQuery.data]);

  const filteredItems = useMemo(() => {
    switch (activeFilter) {
      case "needs_action":
        return activeItems.filter((n) => !n.read);
      case "read":
        return activeItems.filter((n) => n.read);
      default:
        return activeItems;
    }
  }, [activeItems, activeFilter]);

  const severityGroups = useMemo(() => groupBySeverity(filteredItems), [filteredItems]);

  const unreadCount = activeItems.filter((n: NotificationItem) => !n.read).length;
  const readCount = activeItems.filter((n: NotificationItem) => n.read).length;

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

  function handleSnooze(notificationId: string, preset: SnoozePreset) {
    snoozeMutation.mutate({ notificationId, preset });
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Action center"
        title="Notifications"
        description="Alerts, reminders, and items that need your attention — grouped by urgency."
      />

      {/* Filter tabs */}
      <div className="notif-filter-bar" role="tablist" aria-label="Notification filters">
        {FILTER_TABS.map((tab) => {
          const count = tab.key === "needs_action" ? unreadCount
            : tab.key === "read" ? readCount
            : activeItems.length;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeFilter === tab.key}
              className={`notif-filter-tab${activeFilter === tab.key ? " notif-filter-tab--active" : ""}`}
              type="button"
              onClick={() => setActiveFilter(tab.key)}
            >
              {tab.label}
              {count > 0 && <span className="notif-filter-tab__count">{count}</span>}
            </button>
          );
        })}
      </div>

      {activeItems.length === 0 ? (
        <EmptyState
          title="All clear"
          description="No pending notifications. You're caught up — keep the momentum going."
        />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title={activeFilter === "needs_action" ? "No unread notifications" : "No read notifications"}
          description={activeFilter === "needs_action"
            ? "Everything has been addressed. Check All to see your full list."
            : "No notifications have been read yet."}
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
                        onSnooze={handleSnooze}
                        isMarkingRead={markReadMutation.isPending}
                        isDismissing={dismissMutation.isPending}
                        isSnooping={snoozeMutation.isPending}
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
