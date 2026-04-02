import { type ReactNode, useState } from "react";

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
      <button
        type="button"
        className="habits-collapsible__toggle"
        onClick={handleToggle}
      >
        <div>
          <h2 className="habits-collapsible__title">{title}</h2>
          {subtitle ? <p className="habits-collapsible__subtitle">{subtitle}</p> : null}
        </div>
        <div className="habits-collapsible__right">
          {trailing ?? null}
          <span
            className={`habits-collapsible__chevron${isSectionOpen ? " habits-collapsible__chevron--open" : ""}`}
          >
            &#x25B8;
          </span>
        </div>
      </button>
      {isSectionOpen ? <div className="habits-collapsible__body">{children}</div> : null}
    </div>
  );
}
