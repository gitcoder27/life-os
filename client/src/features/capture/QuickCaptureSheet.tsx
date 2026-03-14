import { captureTypes } from "../../shared/lib/demo-data";

type QuickCaptureSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function QuickCaptureSheet({
  open,
  onClose,
}: QuickCaptureSheetProps) {
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
            <p className="page-eyebrow">Global action surface</p>
            <h3 className="capture-sheet__title">Quick capture</h3>
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
              className="capture-chip"
              type="button"
            >
              {item}
            </button>
          ))}
        </div>

        <label className="field">
          <span>Quick note</span>
          <textarea
            placeholder="Sketch the minimal input form here first."
            rows={4}
          />
        </label>
      </section>
    </div>
  );
}
