import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { QuickCaptureSheet } from "../../features/capture/QuickCaptureSheet";
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

type StoredShellSidebarPreference = {
  version: 1;
  collapsed: boolean;
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

export function AppShell() {
  const [captureOpen, setCaptureOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readStoredShellSidebarPreference());
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const today = getTodayDate();
  const sessionQuery = useSessionQuery();
  const homeQuery = useHomeOverviewQuery(today);
  const settingsQuery = useSettingsProfileQuery();
  const notificationsQuery = useNotificationsQuery();
  const userEmail = sessionQuery.data?.user?.email ?? "owner@life-os";
  const greeting = homeQuery.data?.greeting ?? "Good day";

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

  const sidebarClassName = `shell${sidebarCollapsed ? " shell--sidebar-collapsed" : ""}`;
  const sidebarToggleLabel = sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar";
  const shellMainStyle = {
    "--shell-header-height": `${headerHeight}px`,
  } as CSSProperties;

  return (
    <div className={sidebarClassName}>
      <aside className="shell-sidebar" aria-label="Primary navigation">
        <div className="brand-block">
          <div className="brand-block__toolbar">
            <span className="brand-block__eyebrow">Personal command center</span>
            <button
              className="button button--ghost button--small shell-sidebar__toggle shell-collapsed-label"
              type="button"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              aria-label={sidebarToggleLabel}
              aria-expanded={!sidebarCollapsed}
              data-shell-label={sidebarToggleLabel}
            >
              <span className="shell-action__icon" aria-hidden="true">
                {sidebarCollapsed ? <ExpandIcon /> : <CollapseIcon />}
              </span>
            </button>
          </div>
          <div className="brand-block__title-row">
            <span className="brand-block__mark">L</span>
            <div className="brand-block__copy">
              <h1 className="brand-block__title">Life OS</h1>
              <p className="brand-block__subtitle">
                Run the day. Protect momentum.
              </p>
            </div>
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
              >
                <span className="shell-nav__icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="shell-nav__meta">
                  <span className="shell-nav__label">{item.label}</span>
                  <span className="shell-nav__hint">{item.hint}</span>
                </span>
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
          >
            <span className="shell-action__icon" aria-hidden="true">
              <CaptureIcon />
            </span>
            <span className="shell-sidebar__action-text">Quick capture</span>
            <span className="kbd shell-sidebar__action-kbd">⌘K</span>
          </button>
          <div
            className={`account-chip${sidebarCollapsed ? " account-chip--collapsed shell-collapsed-label" : ""}`}
            data-shell-label={userEmail}
            title={sidebarCollapsed ? userEmail : undefined}
          >
            <span className="account-chip__dot" />
            <span className="account-chip__text">{userEmail}</span>
          </div>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `button button--ghost button--small shell-sidebar__action shell-collapsed-label${isActive ? " button--active" : ""}`
            }
            aria-label={sidebarCollapsed ? "Settings" : undefined}
            data-shell-label="Settings"
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
          <div>
            <p className="shell-header__eyebrow">{formatLongDate(today)}</p>
            <h2 className="shell-header__title">{greeting}</h2>
          </div>
          <div className="shell-header__actions">
            <button
              className="button button--ghost shell-notif-btn"
              type="button"
              onClick={() => navigate("/notifications")}
            >
              Notifications
              {unreadCount > 0 && (
                <span className="shell-notif-badge" aria-label={`${unreadCount} unread`}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
            <button
              className="button button--primary shell-header__capture"
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
    </div>
  );
}
