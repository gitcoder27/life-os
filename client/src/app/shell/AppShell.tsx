import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { QuickCaptureSheet } from "../../features/capture/QuickCaptureSheet";
import { navItems } from "../../shared/lib/demo-data";

function navClass(isActive: boolean) {
  return `shell-nav__link${isActive ? " shell-nav__link--active" : ""}`;
}

export function AppShell() {
  const [captureOpen, setCaptureOpen] = useState(false);

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
            owner@life-os
          </div>
        </div>
      </aside>

      <div className="shell-main">
        <header className="shell-header">
          <div>
            <p className="shell-header__eyebrow">Saturday, March 14</p>
            <h2 className="shell-header__title">Good evening</h2>
          </div>
          <div className="shell-header__actions">
            <button
              className="button button--ghost"
              type="button"
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
