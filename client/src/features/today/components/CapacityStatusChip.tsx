import { useState } from "react";
import type { DayCapacityAssessment } from "@life-os/contracts";

type CapacityStatusChipProps = {
  capacity: DayCapacityAssessment | null;
  onShapeDay: () => void;
  onSizeTasks?: () => void;
  onReduceDay?: () => void;
};

const STATUS_LABELS: Record<DayCapacityAssessment["status"], string> = {
  clear: "Clear",
  tight: "Tight",
  overloaded: "Over",
  unclear: "Unclear",
  drifting: "Drifting",
};

export function CapacityStatusChip({
  capacity,
  onShapeDay,
  onSizeTasks,
  onReduceDay,
}: CapacityStatusChipProps) {
  const [open, setOpen] = useState(false);

  if (!capacity) {
    return null;
  }

  const primaryAction =
    capacity.status === "unclear"
      ? { label: "Size tasks", onClick: onSizeTasks ?? onShapeDay }
      : capacity.status === "overloaded"
        ? { label: "Reduce today", onClick: onReduceDay ?? onShapeDay }
        : { label: "Shape day", onClick: onShapeDay };

  return (
    <div className="capacity-chip-wrap">
      <button
        className={`capacity-chip capacity-chip--${capacity.status}`}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span>{STATUS_LABELS[capacity.status]}</span>
        <span>{capacity.summary}</span>
      </button>

      {open ? (
        <div className="capacity-popover">
          <div className="capacity-popover__grid">
            <span>Open</span>
            <strong>{capacity.pendingTaskCount}</strong>
            <span>Unplanned</span>
            <strong>{capacity.unplannedTaskCount}</strong>
            <span>Unsized</span>
            <strong>{capacity.unsizedTaskCount}</strong>
            <span>Over</span>
            <strong>{capacity.overByMinutes} min</strong>
          </div>
          <div className="capacity-popover__actions">
            <button
              className="button button--primary button--small"
              type="button"
              onClick={() => {
                setOpen(false);
                primaryAction.onClick();
              }}
            >
              {primaryAction.label}
            </button>
            {capacity.status !== "clear" ? (
              <button
                className="button button--ghost button--small"
                type="button"
                onClick={() => setOpen(false)}
              >
                Keep plan
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
