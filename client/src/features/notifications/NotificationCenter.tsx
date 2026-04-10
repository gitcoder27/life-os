import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";

import {
  useDismissAllNotificationsMutation,
  useDismissNotificationMutation,
  useMarkNotificationReadMutation,
  useNotificationsQuery,
  useSnoozeNotificationMutation,
  type NotificationItem,
  type SnoozePreset,
} from "../../shared/lib/api";
import { NotificationActionCard } from "./NotificationActionCard";
import {
  FILTER_TABS,
  groupBySeverity,
  resolveNotificationTarget,
  type FilterTab,
} from "./notification-center-model";

const MOBILE_BREAKPOINT_QUERY = "(max-width: 960px)";
const DESKTOP_PANEL_WIDTH = 440;
const DESKTOP_PANEL_OFFSET = 12;
const PANEL_VIEWPORT_MARGIN = 16;

type NotificationCenterPosition = {
  left: number;
  top: number;
};

type NotificationCenterProps = {
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  open: boolean;
  panelId?: string;
};

const useMatchesMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia(query);
    const syncMatch = () => setMatches(mediaQuery.matches);

    syncMatch();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncMatch);
      return () => mediaQuery.removeEventListener("change", syncMatch);
    }

    mediaQuery.addListener(syncMatch);
    return () => mediaQuery.removeListener(syncMatch);
  }, [query]);

  return matches;
};

export const NotificationCenter = ({
  anchorRef,
  onClose,
  open,
  panelId = "shell-notification-center",
}: NotificationCenterProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const panelRef = useRef<HTMLElement>(null);
  const previousLocationKeyRef = useRef(location.key);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("needs_action");
  const [panelPosition, setPanelPosition] = useState<NotificationCenterPosition | null>(null);
  const isMobile = useMatchesMediaQuery(MOBILE_BREAKPOINT_QUERY);

  const notificationsQuery = useNotificationsQuery();
  const markReadMutation = useMarkNotificationReadMutation();
  const dismissMutation = useDismissNotificationMutation();
  const dismissAllMutation = useDismissAllNotificationsMutation();
  const snoozeMutation = useSnoozeNotificationMutation();

  useEffect(() => {
    if (previousLocationKeyRef.current !== location.key) {
      previousLocationKeyRef.current = location.key;
      onClose();
    }
  }, [location.key, onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open || isMobile) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) {
        return;
      }

      onClose();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [anchorRef, isMobile, onClose, open]);

  useEffect(() => {
    if (!open || isMobile) {
      setPanelPosition(null);
      return;
    }

    const updatePosition = () => {
      const anchor = anchorRef.current;

      if (!anchor) {
        return;
      }

      const bounds = anchor.getBoundingClientRect();
      const maxLeft = Math.max(
        PANEL_VIEWPORT_MARGIN,
        window.innerWidth - DESKTOP_PANEL_WIDTH - PANEL_VIEWPORT_MARGIN,
      );

      setPanelPosition({
        top: Math.max(PANEL_VIEWPORT_MARGIN, bounds.bottom + DESKTOP_PANEL_OFFSET),
        left: Math.min(
          Math.max(bounds.right - DESKTOP_PANEL_WIDTH, PANEL_VIEWPORT_MARGIN),
          maxLeft,
        ),
      });
    };

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    let resizeObserver: ResizeObserver | null = null;

    if (typeof ResizeObserver !== "undefined" && anchorRef.current) {
      resizeObserver = new ResizeObserver(() => updatePosition());
      resizeObserver.observe(anchorRef.current);
    }

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      resizeObserver?.disconnect();
    };
  }, [anchorRef, isMobile, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      panelRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [open, panelPosition]);

  const activeItems = useMemo(() => {
    if (!notificationsQuery.data) {
      return [];
    }

    return notificationsQuery.data.notifications.filter((item) => !item.dismissedAt);
  }, [notificationsQuery.data]);

  const filteredItems = useMemo(() => {
    switch (activeFilter) {
      case "needs_action":
        return activeItems.filter((item) => !item.read);
      case "read":
        return activeItems.filter((item) => item.read);
      default:
        return activeItems;
    }
  }, [activeFilter, activeItems]);

  const severityGroups = useMemo(() => groupBySeverity(filteredItems), [filteredItems]);
  const unreadCount = activeItems.filter((item) => !item.read).length;
  const readCount = activeItems.filter((item) => item.read).length;

  if (!open || typeof document === "undefined") {
    return null;
  }

  if (!isMobile && !panelPosition) {
    return null;
  }

  const desktopStyle = !isMobile && panelPosition
    ? {
      top: `${panelPosition.top}px`,
      left: `${panelPosition.left}px`,
      width: `${DESKTOP_PANEL_WIDTH}px`,
    } satisfies CSSProperties
    : undefined;

  const handleOpen = (item: NotificationItem) => {
    const target = resolveNotificationTarget(item);

    if (!target) {
      return;
    }

    onClose();
    navigate(target.to, target.state ? { state: target.state } : undefined);
  };

  const handleSnooze = (notificationId: string, preset: SnoozePreset) => {
    snoozeMutation.mutate({ notificationId, preset });
  };

  const content = (
    <div className={`notification-center notification-center--${isMobile ? "mobile" : "desktop"}`}>
      {isMobile ? (
        <button
          className="notification-center__backdrop"
          type="button"
          aria-label="Close notifications"
          onClick={onClose}
        />
      ) : null}

      <section
        id={panelId}
        ref={panelRef}
        role="dialog"
        aria-modal={isMobile}
        aria-labelledby={`${panelId}-title`}
        className="notification-center__panel"
        style={desktopStyle}
        tabIndex={-1}
      >
        <div className="notification-center__header">
          <div className="notification-center__title-block">
            <p className="page-eyebrow">Action center</p>
            <h3 className="notification-center__title" id={`${panelId}-title`}>
              Notifications
            </h3>
            <p className="notification-center__subtitle">
              Alerts, reminders, and updates that need your attention.
            </p>
          </div>
          <div className="notification-center__header-actions">
            {activeItems.length > 0 ? (
              <button
                className="button button--ghost button--small notification-center__clear"
                type="button"
                onClick={() => dismissAllMutation.mutate()}
                disabled={dismissAllMutation.isPending}
              >
                {dismissAllMutation.isPending ? "Clearing..." : "Clear all"}
              </button>
            ) : null}
            <button
              className="button button--ghost button--small notification-center__close"
              type="button"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        <div className="notification-center__summary">
          <div className="notification-center__summary-pill">
            <span className="notification-center__summary-count">{unreadCount}</span>
            <span className="notification-center__summary-label">unread</span>
          </div>
          <div className="notification-center__summary-pill">
            <span className="notification-center__summary-count">{activeItems.length}</span>
            <span className="notification-center__summary-label">active</span>
          </div>
        </div>

        <div className="notif-filter-bar notification-center__filter-bar" role="tablist" aria-label="Notification filters">
          {FILTER_TABS.map((tab) => {
            const count = tab.key === "needs_action"
              ? unreadCount
              : tab.key === "read"
                ? readCount
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
                {count > 0 ? <span className="notif-filter-tab__count">{count}</span> : null}
              </button>
            );
          })}
        </div>

        <div className="notification-center__body">
          {notificationsQuery.isLoading && !notificationsQuery.data ? (
            <div className="notification-center__state">
              <span className="page-eyebrow">Loading</span>
              <h4 className="notification-center__state-title">Loading notifications</h4>
              <p className="notification-center__state-copy">Fetching alerts and action items.</p>
            </div>
          ) : notificationsQuery.isError || !notificationsQuery.data ? (
            <div className="notification-center__state notification-center__state--error">
              <span className="page-eyebrow">Connection issue</span>
              <h4 className="notification-center__state-title">Notifications unavailable</h4>
              <p className="notification-center__state-copy">
                {notificationsQuery.error instanceof Error
                  ? notificationsQuery.error.message
                  : "This panel could not load right now."}
              </p>
              <button
                className="button button--primary button--small"
                type="button"
                onClick={() => void notificationsQuery.refetch()}
              >
                Retry
              </button>
            </div>
          ) : activeItems.length === 0 ? (
            <div className="notification-center__state">
              <span className="page-eyebrow">All clear</span>
              <h4 className="notification-center__state-title">No pending notifications</h4>
              <p className="notification-center__state-copy">
                You&apos;re caught up. New alerts will appear here automatically.
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="notification-center__state">
              <span className="page-eyebrow">Nothing here</span>
              <h4 className="notification-center__state-title">
                {activeFilter === "needs_action" ? "No unread notifications" : "No read notifications"}
              </h4>
              <p className="notification-center__state-copy">
                {activeFilter === "needs_action"
                  ? "Everything has already been addressed. Switch to All to review the full stream."
                  : "Nothing has been marked as read yet."}
              </p>
            </div>
          ) : (
            <div className="notification-center__groups">
              {severityGroups.map((group) => (
                <div
                  key={group.severity}
                  className={`notif-severity-group notification-center__group ${group.config.className}`}
                >
                  <div className="notif-severity-group__header">
                    <span className="notif-severity-group__indicator" />
                    <span className="notif-severity-group__label">{group.config.label}</span>
                    <span className="notif-severity-group__count">{group.items.length}</span>
                  </div>
                  <div className="notif-severity-group__list">
                    {group.items.map((item) => (
                      <NotificationActionCard
                        key={item.id}
                        item={item}
                        onMarkRead={() => markReadMutation.mutate(item.id)}
                        onDismiss={() => dismissMutation.mutate(item.id)}
                        onOpen={() => handleOpen(item)}
                        onSnooze={handleSnooze}
                        isMarkingRead={markReadMutation.isPending}
                        isDismissing={dismissMutation.isPending}
                        isSnoozing={snoozeMutation.isPending}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );

  return createPortal(content, document.body);
};
