import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { DriftRecoveryAction, DriftRecoveryResponse } from "@life-os/contracts";
import { useDriftRecoveryMutation } from "../../../shared/lib/api";
import type { PlannerExecutionModel } from "../helpers/planner-execution";

type DriftRecoverySheetProps = {
  open: boolean;
  date: string;
  execution: PlannerExecutionModel;
  onClose: () => void;
};

export function DriftRecoverySheet({
  open,
  date,
  execution,
  onClose,
}: DriftRecoverySheetProps) {
  const recoveryMutation = useDriftRecoveryMutation(date);
  const [action, setAction] = useState<DriftRecoveryAction>(() =>
    execution.cleanup.state === "replan_now" ? "move_to_current_block" : "carry_forward_tomorrow",
  );
  const taskIds = useMemo(() => execution.cleanup.taskIds, [execution.cleanup.taskIds]);
  const preview = recoveryMutation.data?.mode === "preview" ? recoveryMutation.data : null;

  useEffect(() => {
    if (!open || taskIds.length === 0) {
      return;
    }

    const defaultAction = execution.cleanup.state === "replan_now"
      ? "move_to_current_block"
      : "carry_forward_tomorrow";
    setAction(defaultAction);
    void recoveryMutation.mutateAsync({
      mode: "preview",
      action: defaultAction,
      taskIds,
      targetBlockId: execution.cleanup.targetBlock?.block.id ?? null,
    });
  }, [open, taskIds.join("|"), execution.cleanup.state, execution.cleanup.targetBlock?.block.id]);

  if (!open) {
    return null;
  }

  const previewAction = async (nextAction: DriftRecoveryAction) => {
    setAction(nextAction);
    await recoveryMutation.mutateAsync({
      mode: "preview",
      action: nextAction,
      taskIds,
      targetBlockId: getTargetBlockId(nextAction, execution),
    });
  };

  const applyAction = async () => {
    await recoveryMutation.mutateAsync({
      mode: "apply",
      action,
      taskIds,
      targetBlockId: getTargetBlockId(action, execution),
    });
    onClose();
  };

  const sheet = (
    <div className="capture-sheet capture-sheet--open">
      <div className="capture-sheet__backdrop" onClick={onClose} />
      <section className="capture-sheet__panel adaptive-sheet drift-sheet">
        <div className="capture-sheet__header">
          <div>
            <p className="page-eyebrow">Today</p>
            <h3 className="capture-sheet__title">Recover drift</h3>
          </div>
          <button className="button button--ghost button--small" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="drift-sheet__actions" role="group" aria-label="Recovery action">
          {execution.cleanup.targetBlock ? (
            <RecoveryOption
              active={action === "move_to_current_block"}
              label="Move to current"
              onClick={() => void previewAction("move_to_current_block")}
            />
          ) : null}
          {execution.nextBlock ? (
            <RecoveryOption
              active={action === "move_to_next_block"}
              label="Move to next"
              onClick={() => void previewAction("move_to_next_block")}
            />
          ) : null}
          <RecoveryOption
            active={action === "unplan"}
            label="Unplan"
            onClick={() => void previewAction("unplan")}
          />
          <RecoveryOption
            active={action === "carry_forward_tomorrow"}
            label="Tomorrow"
            onClick={() => void previewAction("carry_forward_tomorrow")}
          />
        </div>

        {recoveryMutation.isPending && !preview ? (
          <div className="adaptive-sheet__state">Building preview...</div>
        ) : recoveryMutation.error instanceof Error ? (
          <div className="adaptive-sheet__error">{recoveryMutation.error.message}</div>
        ) : preview ? (
          <RecoveryPreview preview={preview} />
        ) : null}

        <div className="adaptive-sheet__footer">
          <button className="button button--ghost" type="button" onClick={onClose}>
            Keep plan
          </button>
          <button
            className="button button--primary"
            type="button"
            disabled={!preview || recoveryMutation.isPending}
            onClick={() => void applyAction()}
          >
            {recoveryMutation.isPending ? "Applying..." : "Apply recovery"}
          </button>
        </div>
      </section>
    </div>
  );

  return createPortal(sheet, document.body);
}

function RecoveryOption({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`drift-sheet__option${active ? " drift-sheet__option--active" : ""}`}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function RecoveryPreview({ preview }: { preview: DriftRecoveryResponse }) {
  return (
    <div className="drift-preview">
      <p className="drift-preview__summary">{preview.summary}</p>
      <div className="drift-preview__rows">
        {preview.changes.map((change) => (
          <div className="drift-preview__row" key={change.taskId}>
            <span>{change.title}</span>
            <small>{change.from} to {change.to}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function getTargetBlockId(action: DriftRecoveryAction, execution: PlannerExecutionModel) {
  if (action === "move_to_current_block") {
    return execution.cleanup.targetBlock?.block.id ?? null;
  }
  if (action === "move_to_next_block") {
    return execution.nextBlock?.block.id ?? null;
  }

  return null;
}
