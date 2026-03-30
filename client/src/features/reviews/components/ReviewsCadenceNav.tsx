import { NavLink } from "react-router-dom";

import { reviewCadences, reviewCadenceKeys, type ReviewCadenceKey } from "../reviewCadenceConfig";

type ReviewsCadenceNavProps = {
  cadenceKey: ReviewCadenceKey;
};

export const ReviewsCadenceNav = ({ cadenceKey }: ReviewsCadenceNavProps) => (
  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.25rem" }}>
    {reviewCadenceKeys.map((currentCadence) => (
      <NavLink
        key={currentCadence}
        to={`/reviews/${currentCadence}`}
        className={`button ${currentCadence === cadenceKey ? "button--primary" : "button--ghost"} button--small`}
      >
        {reviewCadences[currentCadence].label}
      </NavLink>
    ))}
    <span style={{ width: "1px", background: "var(--border)", margin: "0 0.15rem" }} />
    <NavLink to="/reviews/history" className="button button--ghost button--small">
      Past reviews
    </NavLink>
  </div>
);
