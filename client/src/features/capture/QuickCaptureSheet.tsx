import { useState } from "react";

import { captureTypes } from "../../shared/lib/demo-data";

type QuickCaptureSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function QuickCaptureSheet({
  open,
  onClose,
}: QuickCaptureSheetProps) {
  const [activeType, setActiveType] = useState("Task");

  return (
    <div
      aria-hidden={!open}
      className={`capture-sheet${open ? " capture-sheet--open" : ""}`}
    >
      <div
        className="capture-sheet__backdrop"
        onClick={onClose}
      />
      <section className="capture-sheet__panel">
        <div className="capture-sheet__header">
          <div>
            <p className="page-eyebrow">Quick entry</p>
            <h3 className="capture-sheet__title">Capture</h3>
          </div>
          <button
            className="button button--ghost button--small"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="capture-grid">
          {captureTypes.map((item) => (
            <button
              key={item}
              className={`capture-chip${item === activeType ? " capture-chip--active" : ""}`}
              type="button"
              onClick={() => setActiveType(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="stack-form">
          {activeType === "Expense" && (
            <>
              <label className="field">
                <span>Amount</span>
                <input placeholder="$0.00" type="text" inputMode="decimal" />
              </label>
              <label className="field">
                <span>Description</span>
                <input placeholder="What was it for?" type="text" />
              </label>
            </>
          )}
          {activeType === "Water" && (
            <div className="button-row">
              <button className="button button--ghost" type="button">+250ml</button>
              <button className="button button--ghost" type="button">+500ml</button>
              <button className="button button--primary" type="button">+1L</button>
            </div>
          )}
          {(activeType === "Task" || activeType === "Note" || activeType === "Reminder") && (
            <label className="field">
              <span>{activeType}</span>
              <textarea
                placeholder={`Quick ${activeType.toLowerCase()}...`}
                rows={3}
              />
            </label>
          )}
          {(activeType === "Meal" || activeType === "Workout" || activeType === "Weight") && (
            <label className="field">
              <span>{activeType} details</span>
              <input placeholder={`Log ${activeType.toLowerCase()}...`} type="text" />
            </label>
          )}
          <button className="button button--primary" type="button" style={{ width: "100%" }}>
            Save {activeType.toLowerCase()}
          </button>
        </div>
      </section>
    </div>
  );
}
