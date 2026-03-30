import { useEffect } from "react";

import { WorkflowTemplatesSection } from "./WorkflowTemplatesSection";

type InboxTemplatesModalProps = {
  onClose: () => void;
};

export function InboxTemplatesModal({ onClose }: InboxTemplatesModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="inbox-templates-modal">
      <div className="inbox-templates-modal__backdrop" onClick={onClose} />
      <div className="inbox-templates-modal__panel">
        <div className="inbox-templates-modal__header">
          <h2 className="inbox-templates-modal__title">Templates</h2>
          <button
            className="inbox-templates-modal__close"
            type="button"
            onClick={onClose}
            aria-label="Close templates"
          >
            ✕
          </button>
        </div>
        <div className="inbox-templates-modal__body">
          <WorkflowTemplatesSection />
        </div>
      </div>
    </div>
  );
}
