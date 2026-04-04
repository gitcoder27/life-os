import { type ReactNode, useId, useState } from "react";

type CollapsibleSectionProps = {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  trailing?: ReactNode;
  children: ReactNode;
};

export function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  isOpen,
  onOpenChange,
  trailing,
  children,
}: CollapsibleSectionProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen);
  const bodyId = useId();
  const isSectionOpen = isOpen ?? internalIsOpen;

  function handleToggle() {
    const nextIsOpen = !isSectionOpen;

    if (onOpenChange) {
      onOpenChange(nextIsOpen);
      return;
    }

    setInternalIsOpen(nextIsOpen);
  }

  return (
    <div className="habits-collapsible">
      <div className="habits-collapsible__toggle">
        <button
          type="button"
          className="habits-collapsible__toggle-button"
          onClick={handleToggle}
          aria-expanded={isSectionOpen}
          aria-controls={bodyId}
        >
          <div>
            <h2 className="habits-collapsible__title">{title}</h2>
            {subtitle ? <p className="habits-collapsible__subtitle">{subtitle}</p> : null}
          </div>
          <span
            className={`habits-collapsible__chevron${isSectionOpen ? " habits-collapsible__chevron--open" : ""}`}
          >
            &#x25B8;
          </span>
        </button>
        <div className="habits-collapsible__right">
          {trailing ?? null}
        </div>
      </div>
      {isSectionOpen ? <div className="habits-collapsible__body" id={bodyId}>{children}</div> : null}
    </div>
  );
}
