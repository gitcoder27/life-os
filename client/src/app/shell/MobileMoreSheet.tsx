import { createPortal } from "react-dom";
import { NavLink } from "react-router-dom";

import { DialogSurface } from "../../shared/ui/DialogSurface";
import {
  SettingsIcon,
  mobileMoreNavItems,
} from "./shell-navigation";

type MobileMoreSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function MobileMoreSheet({ open, onClose }: MobileMoreSheetProps) {
  const titleId = "mobile-more-sheet-title";

  return createPortal(
    <DialogSurface
      open={open}
      className={`more-sheet${open ? " more-sheet--open" : ""}`}
      backdropClassName="more-sheet__backdrop"
      panelClassName="more-sheet__panel"
      titleId={titleId}
      onClose={onClose}
    >
      <header className="more-sheet__header">
        <h2 className="more-sheet__title" id={titleId}>More</h2>
        <button
          className="button button--ghost button--small"
          type="button"
          onClick={onClose}
        >
          Close
        </button>
      </header>
      <ul className="more-sheet__list">
        {mobileMoreNavItems.map((item) => {
          const Icon = item.icon;

          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `more-sheet__link${isActive ? " more-sheet__link--active" : ""}`
                }
              >
                <span className="shell-nav__icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="more-sheet__text">
                  <span className="more-sheet__label">{item.label}</span>
                  <span className="more-sheet__hint">{item.hint}</span>
                </span>
              </NavLink>
            </li>
          );
        })}
        <li>
          <NavLink
            to="/settings"
            onClick={onClose}
            className={({ isActive }) =>
              `more-sheet__link${isActive ? " more-sheet__link--active" : ""}`
            }
          >
            <span className="shell-nav__icon" aria-hidden="true">
              <SettingsIcon />
            </span>
            <span className="more-sheet__text">
              <span className="more-sheet__label">Settings</span>
              <span className="more-sheet__hint">profile and preferences</span>
            </span>
          </NavLink>
        </li>
      </ul>
    </DialogSurface>,
    document.body,
  );
}
