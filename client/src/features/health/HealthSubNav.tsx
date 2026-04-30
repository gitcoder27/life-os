import { NavLink } from "react-router-dom";

export function HealthSubNav() {
  return (
    <nav className="mp-subnav" aria-label="Health sections">
      <NavLink
        to="/health"
        className={({ isActive }) =>
          `mp-subnav__link${isActive ? " mp-subnav__link--active" : ""}`
        }
        end
      >
        Basics
      </NavLink>
      <NavLink
        to="/meals"
        className={({ isActive }) =>
          `mp-subnav__link${isActive ? " mp-subnav__link--active" : ""}`
        }
      >
        Meals
      </NavLink>
    </nav>
  );
}
