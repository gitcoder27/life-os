import { type ReactNode, useId, useState } from "react";

type CollapsibleSectionProps = {
  id?: string;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  trailing?: ReactNode;
  children: ReactNode;
};

export function CollapsibleSection({
  id,
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
    <section className={`hb-library${isSectionOpen ? " is-open" : ""}`} id={id}>
      <header className="hb-library__header">
        <button
          type="button"
          className="hb-library__toggle"
          onClick={handleToggle}
          aria-expanded={isSectionOpen}
          aria-controls={bodyId}
        >
          <svg className="hb-library__chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M6 3.5 10.5 8 6 12.5" />
          </svg>
          <h2 className="hb-library__title">{title}</h2>
          {subtitle ? <span className="hb-library__count">{subtitle}</span> : null}
        </button>
        {trailing ? <div className="hb-library__trailing">{trailing}</div> : null}
      </header>
      {isSectionOpen ? (
        <div className="hb-library__body" id={bodyId}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
