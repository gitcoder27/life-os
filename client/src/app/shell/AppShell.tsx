import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type MouseEvent,
} from "react";
import { NavLink, Outlet, useLocation, useNavigationType } from "react-router-dom";
import { createPortal } from "react-dom";

import { QuickCaptureSheet } from "../../features/capture/QuickCaptureSheet";
import { NotificationCenter } from "../../features/notifications/NotificationCenter";
import {
  formatLongDate,
  getTodayDate,
  setPreferredTimezone,
  setPreferredWeekStart,
  useHomeOverviewQuery,
  useNotificationsQuery,
  useSessionQuery,
  useSettingsProfileQuery,
} from "../../shared/lib/api";
import {
  CaptureIcon,
  CollapseIcon,
  ExpandIcon,
  SettingsIcon,
  shellNavItems,
} from "./shell-navigation";

const SHELL_SIDEBAR_STORAGE_KEY = "lifeos:shell-sidebar";
const SHELL_SIDEBAR_STORAGE_VERSION = 1;
const COLLAPSED_TOOLTIP_DELAY_MS = 250;

type StoredShellSidebarPreference = {
  version: 1;
  collapsed: boolean;
};

type CollapsedTooltipState = {
  label: string;
  top: number;
  left: number;
};

const readStoredShellSidebarPreference = () => {
  try {
    const rawValue = localStorage.getItem(SHELL_SIDEBAR_STORAGE_KEY);
    if (!rawValue) {
      return false;
    }

    const parsed = JSON.parse(rawValue) as Partial<StoredShellSidebarPreference>;
    if (
      parsed.version !== SHELL_SIDEBAR_STORAGE_VERSION ||
      typeof parsed.collapsed !== "boolean"
    ) {
      localStorage.removeItem(SHELL_SIDEBAR_STORAGE_KEY);
      return false;
    }

    return parsed.collapsed;
  } catch {
    return false;
  }
};

const writeStoredShellSidebarPreference = (collapsed: boolean) => {
  try {
    const payload: StoredShellSidebarPreference = {
      version: SHELL_SIDEBAR_STORAGE_VERSION,
      collapsed,
    };
    localStorage.setItem(SHELL_SIDEBAR_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    return;
  }
};

function navClass(isActive: boolean) {
  return `shell-nav__link${isActive ? " shell-nav__link--active" : ""}`;
}

const toTitleCaseToken = (value: string) => {
  if (!value) {
    return value;
  }

  return value.charAt(0).toLocaleUpperCase() + value.slice(1).toLocaleLowerCase();
};

const formatGreetingName = (displayName?: string | null, email?: string | null) => {
  const fallbackName = email?.split("@")[0]?.replace(/[._]+/g, " ");
  const rawName = displayName?.trim() || fallbackName?.trim();

  if (!rawName) {
    return null;
  }

  return rawName
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      word
        .split(/([-'])/)
        .map((segment) => (segment === "-" || segment === "'" ? segment : toTitleCaseToken(segment)))
        .join(""),
    )
    .join(" ");
};

export function AppShell() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const [captureOpen, setCaptureOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readStoredShellSidebarPreference());
  const [collapsedTooltip, setCollapsedTooltip] = useState<CollapsedTooltipState | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerRef = useRef<HTMLElement>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const collapsedTooltipTimeoutRef = useRef<number | null>(null);
  const today = getTodayDate();
  const sessionQuery = useSessionQuery();
  const homeQuery = useHomeOverviewQuery(today);
  const settingsQuery = useSettingsProfileQuery();
  const notificationsQuery = useNotificationsQuery();
  const userEmail = sessionQuery.data?.user?.email ?? "owner@life-os";
  const greeting = homeQuery.data?.greeting ?? "Good day";
  const greetingName = formatGreetingName(sessionQuery.data?.user?.displayName, userEmail);
  const headerGreeting = greetingName ? `${greeting}, ${greetingName}` : greeting;

  const unreadCount = useMemo(() => {
    if (!notificationsQuery.data) return 0;
    return notificationsQuery.data.notifications.filter(
      (n: { read: boolean; dismissedAt: string | null }) => !n.read && !n.dismissedAt,
    ).length;
  }, [notificationsQuery.data]);

  useEffect(() => {
    if (!settingsQuery.data) return;
    const { preferences } = settingsQuery.data;
    setPreferredWeekStart(preferences.weekStartsOn);
    if (preferences.timezone) {
      setPreferredTimezone(preferences.timezone);
    }
  }, [settingsQuery.data]);

  // Global keyboard shortcut: Ctrl+K / Cmd+K to toggle Quick Capture
  const handleGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      setCaptureOpen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [handleGlobalKeyDown]);

  useEffect(() => {
    writeStoredShellSidebarPreference(sidebarCollapsed);
  }, [sidebarCollapsed]);

  useEffect(() => {
    setCollapsedTooltip(null);
  }, [sidebarCollapsed]);

  useEffect(() => () => {
    if (collapsedTooltipTimeoutRef.current !== null) {
      window.clearTimeout(collapsedTooltipTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    const headerElement = headerRef.current;
    if (!headerElement) {
      return;
    }

    const updateHeaderHeight = () => {
      setHeaderHeight(headerElement.getBoundingClientRect().height);
    };

    updateHeaderHeight();
    window.addEventListener("resize", updateHeaderHeight);

    if (typeof ResizeObserver === "undefined") {
      return () => window.removeEventListener("resize", updateHeaderHeight);
    }

    const resizeObserver = new ResizeObserver(() => updateHeaderHeight());
    resizeObserver.observe(headerElement);

    return () => {
      window.removeEventListener("resize", updateHeaderHeight);
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!collapsedTooltip) {
      return;
    }

    const dismissTooltip = () => setCollapsedTooltip(null);

    window.addEventListener("scroll", dismissTooltip, true);
    window.addEventListener("resize", dismissTooltip);

    return () => {
      window.removeEventListener("scroll", dismissTooltip, true);
      window.removeEventListener("resize", dismissTooltip);
    };
  }, [collapsedTooltip]);

  useLayoutEffect(() => {
    if (navigationType === "POP") {
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, navigationType]);

  const hideCollapsedTooltip = useCallback(() => {
    if (collapsedTooltipTimeoutRef.current !== null) {
      window.clearTimeout(collapsedTooltipTimeoutRef.current);
      collapsedTooltipTimeoutRef.current = null;
    }
    setCollapsedTooltip(null);
  }, []);

  const getTooltipLabel = useCallback((target: HTMLElement) => {
    const label = target.dataset.shellLabel;
    const shortcut = target.dataset.shellShortcut;

    if (sidebarCollapsed) {
      if (label && shortcut) {
        return `${label} · ${shortcut}`;
      }

      return label ?? null;
    }

    if (shortcut) {
      return `Shortcut: ${shortcut}`;
    }

    return null;
  }, [sidebarCollapsed]);

  const showCollapsedTooltip = useCallback((target: HTMLElement) => {
    const label = getTooltipLabel(target);
    if (!label) {
      return;
    }

    const bounds = target.getBoundingClientRect();
    setCollapsedTooltip({
      label,
      top: bounds.top + bounds.height / 2,
      left: bounds.right + 14,
    });
  }, [getTooltipLabel]);

  const queueCollapsedTooltip = useCallback((target: HTMLElement) => {
    hideCollapsedTooltip();
    collapsedTooltipTimeoutRef.current = window.setTimeout(() => {
      showCollapsedTooltip(target);
      collapsedTooltipTimeoutRef.current = null;
    }, COLLAPSED_TOOLTIP_DELAY_MS);
  }, [hideCollapsedTooltip, showCollapsedTooltip]);

  const handleCollapsedTooltipMouseEnter = useCallback((event: MouseEvent<HTMLElement>) => {
    queueCollapsedTooltip(event.currentTarget);
  }, [queueCollapsedTooltip]);

  const handleCollapsedTooltipFocus = useCallback((event: FocusEvent<HTMLElement>) => {
    queueCollapsedTooltip(event.currentTarget);
  }, [queueCollapsedTooltip]);

  const sidebarClassName = `shell${sidebarCollapsed ? " shell--sidebar-collapsed" : ""}`;
  const sidebarToggleLabel = sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar";
  const shellMainStyle = {
    "--shell-header-height": `${headerHeight}px`,
  } as CSSProperties;

  return (
    <div className={sidebarClassName}>
      <aside className="shell-sidebar" aria-label="Primary navigation">
        <div className="brand-block">
          <div className="brand-block__title-row">
            <span className="brand-block__mark">L</span>
            <h1 className="brand-block__title">Life OS</h1>
            <button
              className="button button--ghost button--small shell-sidebar__toggle shell-collapsed-label"
              type="button"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              aria-label={sidebarToggleLabel}
              aria-expanded={!sidebarCollapsed}
              data-shell-label={sidebarToggleLabel}
              onMouseEnter={handleCollapsedTooltipMouseEnter}
              onMouseLeave={hideCollapsedTooltip}
              onFocus={handleCollapsedTooltipFocus}
              onBlur={hideCollapsedTooltip}
            >
              <span className="shell-action__icon" aria-hidden="true">
                {sidebarCollapsed ? <ExpandIcon /> : <CollapseIcon />}
              </span>
            </button>
          </div>
        </div>

        <nav className="shell-nav">
          {shellNavItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                className={({ isActive }) => navClass(isActive)}
                to={item.to}
                aria-label={sidebarCollapsed ? item.label : undefined}
                data-shell-label={item.label}
                onMouseEnter={handleCollapsedTooltipMouseEnter}
                onMouseLeave={hideCollapsedTooltip}
                onFocus={handleCollapsedTooltipFocus}
                onBlur={hideCollapsedTooltip}
              >
                <span className="shell-nav__icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="shell-nav__label">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="shell-sidebar__footer">
          <button
            className="button button--primary shell-sidebar__action shell-sidebar__action--primary shell-collapsed-label"
            onClick={() => setCaptureOpen(true)}
            type="button"
            aria-label={sidebarCollapsed ? "Quick capture" : undefined}
            data-shell-label="Quick capture"
            data-shell-shortcut="Ctrl+K / Cmd+K"
            onMouseEnter={handleCollapsedTooltipMouseEnter}
            onMouseLeave={hideCollapsedTooltip}
            onFocus={handleCollapsedTooltipFocus}
            onBlur={hideCollapsedTooltip}
          >
            <span className="shell-action__icon" aria-hidden="true">
              <CaptureIcon />
            </span>
            <span className="shell-sidebar__action-text">Quick capture</span>
          </button>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `button button--ghost button--small shell-sidebar__action shell-collapsed-label${isActive ? " button--active" : ""}`
            }
            aria-label={sidebarCollapsed ? "Settings" : undefined}
            data-shell-label="Settings"
            onMouseEnter={handleCollapsedTooltipMouseEnter}
            onMouseLeave={hideCollapsedTooltip}
            onFocus={handleCollapsedTooltipFocus}
            onBlur={hideCollapsedTooltip}
          >
            <span className="shell-action__icon" aria-hidden="true">
              <SettingsIcon />
            </span>
            <span className="shell-sidebar__action-text">Settings</span>
          </NavLink>
        </div>
      </aside>

      <div className="shell-main" style={shellMainStyle}>
        <header className="shell-header" ref={headerRef}>
          <div className="shell-header__left">
            <h2 className="shell-header__title">{headerGreeting}</h2>
            <span className="shell-header__date">{formatLongDate(today)}</span>
          </div>
          <div className="shell-header__actions">
            <button
              ref={notificationButtonRef}
              className={`shell-notif-btn${notificationsOpen ? " shell-notif-btn--active" : ""}`}
              type="button"
              onClick={() => setNotificationsOpen((prev) => !prev)}
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
              aria-controls="shell-notification-center"
              aria-expanded={notificationsOpen}
              aria-haspopup="dialog"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="shell-notif-badge" aria-label={`${unreadCount} unread`}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
            <button
              className="shell-header__capture"
              onClick={() => setCaptureOpen(true)}
              type="button"
            >
              Capture
            </button>
          </div>
        </header>

        <main className="shell-content">
          <Outlet />
        </main>

        <nav className="mobile-nav">
          {shellNavItems.slice(0, 5).map((item) => (
            <NavLink
              key={item.to}
              className={({ isActive }) => navClass(isActive)}
              to={item.to}
            >
              <span className="shell-nav__label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <button
          className="mobile-capture"
          onClick={() => setCaptureOpen(true)}
          type="button"
        >
          +
        </button>
      </div>

      <QuickCaptureSheet
        onClose={() => setCaptureOpen(false)}
        open={captureOpen}
      />
      <NotificationCenter
        anchorRef={notificationButtonRef}
        onClose={() => setNotificationsOpen(false)}
        open={notificationsOpen}
      />
      {collapsedTooltip
        ? createPortal(
          <div
            className="shell-collapsed-tooltip"
            role="tooltip"
            style={{
              top: `${collapsedTooltip.top}px`,
              left: `${collapsedTooltip.left}px`,
            }}
          >
            {collapsedTooltip.label}
          </div>,
          document.body,
        )
        : null}
    </div>
  );
}
