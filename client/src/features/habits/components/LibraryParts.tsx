import { type ReactNode, useId, useState } from "react";

export function FormPanel({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();

  return (
    <section className="hb-form-panel" aria-labelledby={headingId}>
      <h3 className="hb-form-panel__title" id={headingId}>
        {title}
      </h3>
      {children}
    </section>
  );
}

type ArchiveConfirmProps = {
  name: string;
  detail: string;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ArchiveConfirm({ name, detail, isPending, onConfirm, onCancel }: ArchiveConfirmProps) {
  return (
    <div className="hb-confirm" role="group" aria-label={`Archive ${name}`}>
      <p className="hb-confirm__text">
        <span className="hb-confirm__question">Archive {name}?</span> {detail}
      </p>
      <div className="hb-confirm__actions">
        <button
          className="button button--ghost button--small hb-confirm__danger"
          type="button"
          onClick={onConfirm}
          disabled={isPending}
        >
          Archive
        </button>
        <button className="button button--ghost button--small" type="button" onClick={onCancel}>
          Keep it
        </button>
      </div>
    </div>
  );
}

type ArchivedListProps = {
  noun: "habit" | "routine";
  items: Array<{ id: string; name: string; meta: string | null }>;
  isPending: boolean;
  onRestore: (id: string) => void;
};

export function ArchivedList({ noun, items, isPending, onRestore }: ArchivedListProps) {
  const [isOpen, setIsOpen] = useState(false);
  const listId = useId();

  return (
    <div className="hb-archived">
      <button
        type="button"
        className="hb-archived__toggle"
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={() => setIsOpen((current) => !current)}
      >
        <svg className="hb-library__chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M6 3.5 10.5 8 6 12.5" />
        </svg>
        {items.length} archived {items.length === 1 ? noun : `${noun}s`}
      </button>
      {isOpen ? (
        <ul className="hb-items hb-items--archived" id={listId}>
          {items.map((item) => (
            <li key={item.id} className="hb-item">
              <div className="hb-item__row">
                <span className="hb-item__dot hb-item__dot--archived" aria-hidden="true" />
                <div className="hb-item__body">
                  <span className="hb-item__name">{item.name}</span>
                  {item.meta ? (
                    <span className="hb-item__meta">
                      <span>{item.meta}</span>
                    </span>
                  ) : null}
                </div>
                <div className="hb-item__actions">
                  <button
                    className="hb-item__edit"
                    type="button"
                    onClick={() => onRestore(item.id)}
                    disabled={isPending}
                    aria-label={`Restore ${item.name}`}
                  >
                    Restore
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function InlineError({ message }: { message: string }) {
  return (
    <div className="inline-state inline-state--error hb-library__error" role="alert">
      {message}
    </div>
  );
}
