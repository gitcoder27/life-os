export type GoalsMode = "overview" | "plan";

export function GoalsModeToggle({
  mode,
  onModeChange,
}: {
  mode: GoalsMode;
  onModeChange: (mode: GoalsMode) => void;
}) {
  return (
    <div className="goals-mode-toggle">
      <button
        className={`goals-mode-toggle__btn${mode === "overview" ? " goals-mode-toggle__btn--active" : ""}`}
        type="button"
        onClick={() => onModeChange("overview")}
      >
        <span className="goals-mode-toggle__icon">◉</span>
        Overview
      </button>
      <button
        className={`goals-mode-toggle__btn${mode === "plan" ? " goals-mode-toggle__btn--active" : ""}`}
        type="button"
        onClick={() => onModeChange("plan")}
      >
        <span className="goals-mode-toggle__icon">◫</span>
        Plan
      </button>
    </div>
  );
}
