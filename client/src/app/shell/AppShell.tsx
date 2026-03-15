import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { QuickCaptureSheet } from "../../features/capture/QuickCaptureSheet";
import {
  formatLongDate,
  getTodayDate,
  setPreferredTimezone,
  setPreferredWeekStart,
  useHomeOverviewQuery,
  useSessionQuery,
  useSettingsProfileQuery,
} from "../../shared/lib/api";

const navItems = [
  { to: "/", label: "Home", hint: "daily command center" },
  { to: "/today", label: "Today", hint: "execution lane" },
  { to: "/habits", label: "Habits", hint: "consistency system" },
  { to: "/health", label: "Health", hint: "body basics" },
  { to: "/finance", label: "Finance", hint: "spend visibility" },
  { to: "/goals", label: "Goals", hint: "weekly and monthly direction" },
  { to: "/reviews/daily", label: "Reviews", hint: "reflection loop" },
] as const;

function navClass(isActive: boolean) {
  return `shell-nav__link${isActive ? " shell-nav__link--active" : ""}`;
}

export function AppShell() {
  const [captureOpen, setCaptureOpen] = useState(false);
  const navigate = useNavigate();
  const today = getTodayDate();
  const sessionQuery = useSessionQuery();
  const homeQuery = useHomeOverviewQuery(today);
  const settingsQuery = useSettingsProfileQuery();
  const userEmail = sessionQuery.data?.user?.email ?? "owner@life-os";
  const greeting = homeQuery.data?.greeting ?? "Good day";

  useEffect(() => {
    if (!settingsQuery.data) return;
    const { preferences } = settingsQuery.data;
    setPreferredWeekStart(preferences.weekStartsOn);
    if (preferences.timezone) {
      setPreferredTimezone(preferences.timezone);
    }
  }, [settingsQuery.data]);

  return (
    <div className="shell">
      <aside className="shell-sidebar">
        <div className="brand-block">
          <span className="brand-block__eyebrow">Personal command center</span>
          <div className="brand-block__title-row">
            <span className="brand-block__mark">L</span>
            <div>
              <h1 className="brand-block__title">Life OS</h1>
              <p className="brand-block__subtitle">
                Run the day. Protect momentum.
              </p>
            </div>
          </div>
        </div>

        <nav className="shell-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              className={({ isActive }) => navClass(isActive)}
              to={item.to}
            >
              <span className="shell-nav__label">{item.label}</span>
              <span className="shell-nav__hint">{item.hint}</span>
            </NavLink>
          ))}
        </nav>

        <div className="shell-sidebar__footer">
          <button
            className="button button--primary"
            onClick={() => setCaptureOpen(true)}
            type="button"
          >
            Quick capture
          </button>
          <div className="account-chip">
            <span className="account-chip__dot" />
            {userEmail}
          </div>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `button button--ghost button--small${isActive ? " button--active" : ""}`
            }
          >
            Settings
          </NavLink>
        </div>
      </aside>

      <div className="shell-main">
        <header className="shell-header">
          <div>
            <p className="shell-header__eyebrow">{formatLongDate(today)}</p>
            <h2 className="shell-header__title">{greeting}</h2>
          </div>
          <div className="shell-header__actions">
            <button
              className="button button--ghost"
              type="button"
              onClick={() => navigate("/notifications")}
            >
              Notifications
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
          {navItems.slice(0, 5).map((item) => (
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
