import type { PlannerExecutionModel } from "../helpers/planner-execution";

export function DriftRecoveryBar({
  execution,
  onOpen,
}: {
  execution: PlannerExecutionModel;
  onOpen: () => void;
}) {
  if (execution.cleanup.state === "none" || execution.cleanup.taskCount === 0) {
    return null;
  }

  return (
    <div className="drift-recovery-bar">
      <span className="drift-recovery-bar__mark" />
      <span className="drift-recovery-bar__copy">
        {execution.cleanup.taskCount} slipped task{execution.cleanup.taskCount === 1 ? "" : "s"} need a new place.
      </span>
      <button className="drift-recovery-bar__action" type="button" onClick={onOpen}>
        Recover drift
      </button>
    </div>
  );
}
