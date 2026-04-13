import type { GoalDomain } from "../../shared/lib/api";

const domainLabels: Record<string, string> = {
  unassigned: "Unassigned",
  health: "Health",
  money: "Wealth",
  work_growth: "Growth",
  home_admin: "Home",
  discipline: "Discipline",
  other: "Other",
};

const domainOptions = Object.entries(domainLabels).map(([value, label]) => ({
  value: value as GoalDomain,
  label,
}));

export function GoalFilters({
  activeDomain,
  onChangeDomain,
}: {
  activeDomain: GoalDomain | undefined;
  onChangeDomain: (domain: GoalDomain | undefined) => void;
}) {
  return (
    <div className="ap-filter-bar">
      <button
        className={`ap-filter-pill${activeDomain === undefined ? " ap-filter-pill--active" : ""}`}
        type="button"
        onClick={() => onChangeDomain(undefined)}
      >
        All Domains
      </button>
      {domainOptions.map((opt) => (
        <button
          key={opt.value}
          className={`ap-filter-pill${activeDomain === opt.value ? " ap-filter-pill--active" : ""}`}
          type="button"
          onClick={() => onChangeDomain(activeDomain === opt.value ? undefined : opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
