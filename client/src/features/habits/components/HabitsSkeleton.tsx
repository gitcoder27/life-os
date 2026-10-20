export function HabitsSkeleton() {
  return (
    <div className="page habits-page" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading habits</span>
      <div className="hb-skeleton" aria-hidden="true">
        <span className="hb-skeleton__block hb-skeleton__block--title" />
        <span className="hb-skeleton__block hb-skeleton__block--line" />
        <div className="hb-skeleton__hero">
          <span className="hb-skeleton__block hb-skeleton__block--figure" />
          <span className="hb-skeleton__block hb-skeleton__block--tally" />
        </div>
        <ul className="hb-skeleton__rows">
          {Array.from({ length: 5 }, (_, index) => (
            <li key={index} className="hb-skeleton__row">
              <span className="hb-skeleton__block hb-skeleton__block--time" />
              <span className="hb-skeleton__block hb-skeleton__block--name" />
              <span className="hb-skeleton__block hb-skeleton__block--check" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
