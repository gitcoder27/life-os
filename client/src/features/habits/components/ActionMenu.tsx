import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export type ActionMenuItem = {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  tone?: "danger";
};

type ActionMenuProps = {
  label: string;
  items: ActionMenuItem[];
};

/** A small menu button: arrow keys move, Escape closes and returns focus. */
export function ActionMenu({ label, items }: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const enabledIndexes = items
    .map((item, index) => (item.disabled ? -1 : index))
    .filter((index) => index >= 0);

  useEffect(() => {
    if (!isOpen) return;

    itemRefs.current[enabledIndexes[0] ?? 0]?.focus();

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
    // Focus moves to the first item only when the menu opens, not on every render.
  }, [isOpen]);

  function close(returnFocus: boolean) {
    setIsOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  function moveFocus(step: 1 | -1 | "first" | "last") {
    if (enabledIndexes.length === 0) return;

    const current = itemRefs.current.findIndex((node) => node === document.activeElement);
    const position = enabledIndexes.indexOf(current);
    let next: number;
    if (step === "first") next = 0;
    else if (step === "last") next = enabledIndexes.length - 1;
    else next = (position + step + enabledIndexes.length) % enabledIndexes.length;

    itemRefs.current[enabledIndexes[next]]?.focus();
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveFocus(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveFocus(-1);
        break;
      case "Home":
        event.preventDefault();
        moveFocus("first");
        break;
      case "End":
        event.preventDefault();
        moveFocus("last");
        break;
      case "Escape":
        event.preventDefault();
        close(true);
        break;
      case "Tab":
        close(false);
        break;
      default:
        break;
    }
  }

  return (
    <div className="hb-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="hb-menu__button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !isOpen) {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <circle cx="4.5" cy="10" r="1.6" />
          <circle cx="10" cy="10" r="1.6" />
          <circle cx="15.5" cy="10" r="1.6" />
        </svg>
      </button>
      {isOpen ? (
        <div
          className="hb-menu__list"
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={handleMenuKeyDown}
        >
          {items.map((item, index) => (
            <button
              key={item.label}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={`hb-menu__item${item.tone === "danger" ? " hb-menu__item--danger" : ""}`}
              disabled={item.disabled}
              onClick={() => {
                close(true);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
