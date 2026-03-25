export function ModeToggle({
  mode,
  onModeChange,
  plannerBlockCount,
}: {
  mode: "execute" | "plan";
  onModeChange: (mode: "execute" | "plan") => void;
  plannerBlockCount: number;
}) {
  return (
    <div className="mode-toggle">
      <button
        className={`mode-toggle__btn ${mode === "execute" ? "mode-toggle__btn--active" : ""}`}
        type="button"
        onClick={() => onModeChange("execute")}
      >
        <span className="mode-toggle__icon">▶</span>
        Execute
      </button>
      <button
        className={`mode-toggle__btn ${mode === "plan" ? "mode-toggle__btn--active" : ""}`}
        type="button"
        onClick={() => onModeChange("plan")}
      >
        <span className="mode-toggle__icon">◫</span>
        Plan
        {plannerBlockCount > 0 ? (
          <span className="mode-toggle__badge">{plannerBlockCount}</span>
        ) : null}
      </button>
    </div>
  );
}
