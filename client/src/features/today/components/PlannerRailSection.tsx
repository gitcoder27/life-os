import type { ReactNode, KeyboardEvent } from "react";

export type PlannerRailSectionTone = "rhythm" | "recovery" | "default";

export function PlannerRailSection({
  title,
  count,
  tone = "default",
  expanded,
  className = "",
  ariaLabel,
  headerMeta,
  actions,
  children,
  bodyClassName = "",
  onToggle,
}: {
  title: string;
  count?: number;
  tone?: PlannerRailSectionTone;
  expanded: boolean;
  className?: string;
  ariaLabel?: string;
  headerMeta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  onToggle: () => void;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    onToggle();
  }

  return (
    <section
      className={[
        "planner-rail-section",
        `planner-rail-section--${tone}`,
        expanded ? " planner-rail-section--expanded" : "",
        className ? ` ${className}` : "",
      ].join("")}
      aria-label={ariaLabel ?? title}
    >
      <div
        className="planner-rail-section__header"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
      >
        <div className="planner-rail-section__identity">
          <span className="planner-rail-section__accent" aria-hidden="true" />
          <h3 className="planner-rail-section__title">{title}</h3>
          {typeof count === "number" ? (
            <span className="planner-rail-section__count">{count}</span>
          ) : null}
        </div>

        <div className="planner-rail-section__tools">
          {headerMeta}
          {expanded && actions ? (
            <span
              className="planner-rail-section__actions"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              {actions}
            </span>
          ) : null}
          <span
            className={`planner-rail-section__chevron${expanded ? " planner-rail-section__chevron--open" : ""}`}
            aria-hidden="true"
          >
            ▾
          </span>
        </div>
      </div>

      {expanded ? (
        <div className={`planner-rail-section__body${bodyClassName ? ` ${bodyClassName}` : ""}`}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
