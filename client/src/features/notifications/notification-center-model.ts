import { getPreferredTimezone, type NotificationItem } from "../../shared/lib/api";
import { resolveHomeActionTarget, type HomeNavigationTarget } from "../../shared/lib/homeNavigation";

export type FilterTab = "all" | "needs_action" | "read";
export type NotificationSeverity = NotificationItem["severity"];

export const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "needs_action", label: "Needs action" },
  { key: "read", label: "Read" },
];

export const SEVERITY_ORDER: Record<NotificationSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export const SEVERITY_CONFIG: Record<NotificationSeverity, { label: string; className: string }> = {
  critical: { label: "Needs attention", className: "notif-severity-group--critical" },
  warning: { label: "Reminders", className: "notif-severity-group--warning" },
  info: { label: "Updates", className: "notif-severity-group--info" },
};

export const CATEGORY_LABELS: Record<NotificationItem["notificationType"], string> = {
  task: "Task",
  inbox: "Inbox",
  review: "Review",
  finance: "Finance",
  health: "Health",
  habit: "Habit",
  routine: "Routine",
};

const resolveLegacyEntityRoute = (
  entityType: string | null,
  entityId: string | null,
): string | null => {
  if (!entityType) {
    return null;
  }

  if (entityType === "admin_item") return "/finance";
  if (entityType === "inbox_zero") return "/inbox";
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
};

export const resolveNotificationTarget = (
  item: NotificationItem,
): HomeNavigationTarget | null => {
  if (item.action) {
    return resolveHomeActionTarget(item.action);
  }

  const route = resolveLegacyEntityRoute(item.entityType, item.entityId);
  return route ? { to: route } : null;
};

export const resolveActionLabel = (entityType: string | null): string => {
  if (!entityType) return "Open";
  if (entityType === "inbox_zero") return "Open inbox";
  if (entityType === "task") return "Open today";
  if (entityType === "admin_item") return "Open bill";
  if (entityType === "health_day" || entityType === "workout_day") return "View health";
  if (entityType === "habit" || entityType === "routine_day") return "View habits";
  if (entityType.includes("review")) return "Open review";
  return "Open";
};

export const formatNotificationTime = (isoDateTime: string) => {
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
};

export const isTonightAvailable = (): boolean => {
  const timezone = getPreferredTimezone();

  if (!timezone) {
    return true;
  }

  try {
    const hourInTimezone = new Date().toLocaleString("en-US", {
      timeZone: timezone,
      hour12: false,
      hour: "2-digit",
    });
    const hour = Number.parseInt(hourInTimezone, 10);
    return hour < 18;
  } catch {
    return true;
  }
};

export const groupBySeverity = (items: NotificationItem[]) => {
  const groups: Record<NotificationSeverity, NotificationItem[]> = {
    critical: [],
    warning: [],
    info: [],
  };

  for (const item of items) {
    groups[item.severity].push(item);
  }

  return (Object.keys(groups) as NotificationSeverity[])
    .filter((severity) => groups[severity].length > 0)
    .sort((left, right) => SEVERITY_ORDER[left] - SEVERITY_ORDER[right])
    .map((severity) => ({
      severity,
      items: groups[severity],
      config: SEVERITY_CONFIG[severity],
    }));
};
