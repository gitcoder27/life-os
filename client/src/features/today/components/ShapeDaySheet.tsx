import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useShapeDay } from "../hooks/useShapeDay";
import { ShapeDayPreview } from "./ShapeDayPreview";

type ShapeDaySheetProps = {
  open: boolean;
  date: string;
  onClose: () => void;
};

export function ShapeDaySheet({
  open,
  date,
  onClose,
}: ShapeDaySheetProps) {
  const shapeDay = useShapeDay(date);

  useEffect(() => {
    if (!open) {
      shapeDay.resetPreview();
      return;
    }

    void shapeDay.previewDay({ preserveExistingBlocks: true });
  }, [open]);

  if (!open) {
    return null;
  }

  const canApply = Boolean(shapeDay.preview?.proposedBlocks.length) && !shapeDay.isApplying;
  const sheet = (
    <div className="capture-sheet capture-sheet--open">
      <div className="capture-sheet__backdrop" onClick={onClose} />
      <section className="capture-sheet__panel adaptive-sheet shape-day-sheet">
        <div className="capture-sheet__header">
          <div>
            <p className="page-eyebrow">Today</p>
            <h3 className="capture-sheet__title">Shape day</h3>
          </div>
          <button className="button button--ghost button--small" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        {shapeDay.isPreviewing ? (
          <div className="adaptive-sheet__state">Building preview...</div>
        ) : shapeDay.error ? (
          <div className="adaptive-sheet__error">
            <span>{shapeDay.error}</span>
            <button
              className="button button--ghost button--small"
              type="button"
              onClick={() => void shapeDay.previewDay({ preserveExistingBlocks: true })}
            >
              Try again
            </button>
          </div>
        ) : shapeDay.preview ? (
          <ShapeDayPreview preview={shapeDay.preview} />
        ) : null}

        <div className="adaptive-sheet__footer">
          <button
            className="button button--ghost"
            type="button"
            onClick={onClose}
          >
            Keep current plan
          </button>
          <button
            className="button button--primary"
            type="button"
            disabled={!canApply}
            onClick={async () => {
              if (!shapeDay.preview) {
                return;
              }

              await shapeDay.applyPreview({
                proposedBlocks: shapeDay.preview.proposedBlocks,
              });
              onClose();
            }}
          >
            {shapeDay.isApplying ? "Applying..." : "Apply plan"}
          </button>
        </div>
      </section>
    </div>
  );

  return createPortal(sheet, document.body);
}
