import { useId } from "react";

import type { Routine } from "../types";
import { CheckMark } from "./CheckMark";
import { Tally } from "./Tally";

type RoutineCardProps = {
  routine: Routine;
  isNext: boolean;
  pendingStepIds: Set<string>;
  onToggleStep: (itemId: string, completed: boolean) => void;
};

export function RoutineCard({ routine, isNext, pendingStepIds, onToggleStep }: RoutineCardProps) {
  const headingId = useId();
  const items = [...routine.items].sort((left, right) => left.sortOrder - right.sortOrder);
  const completed = items.filter((item) => item.completedToday).length;
  const done = items.length > 0 && completed === items.length;

  return (
    <li className="hb-entry--routine" id={`habits-routine-${routine.id}`}>
      <section
        className={`hb-routine${done ? " is-done" : ""}${isNext ? " is-next" : ""}`}
        aria-labelledby={headingId}
      >
        <header className="hb-routine__header">
          <div className="hb-routine__heading">
            <h3 className="hb-routine__name" id={headingId}>
              {isNext ? <span className="sr-only">Next up: </span> : null}
              {routine.name}
            </h3>
            {routine.timingLabel ? (
              <span className="hb-routine__when">{routine.timingLabel}</span>
            ) : null}
          </div>
          <div className="hb-routine__progress">
            <span className="hb-routine__count">
              {done ? "Done" : `${completed} of ${items.length}`}
            </span>
            <Tally
              total={items.length}
              filled={completed}
              label={`${completed} of ${items.length} steps done`}
            />
          </div>
        </header>
        {items.length > 0 ? (
          <ul className="hb-routine__steps">
            {items.map((item) => {
              const isPending = pendingStepIds.has(item.id);

              return (
                <li key={item.id}>
                  <label className={`hb-step${item.completedToday ? " is-done" : ""}`}>
                    <input
                      type="checkbox"
                      className="hb-step__input"
                      checked={item.completedToday}
                      aria-disabled={isPending || undefined}
                      onChange={(event) => {
                        if (isPending) return;
                        onToggleStep(item.id, event.target.checked);
                      }}
                    />
                    <CheckMark done={item.completedToday} size="sm" />
                    <span className="hb-step__title">{item.title}</span>
                    {!item.isRequired ? <span className="hb-step__optional">optional</span> : null}
                  </label>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </li>
  );
}
