import {
  useEffect,
  useRef,
  type KeyboardEventHandler,
  type ReactNode,
  type RefObject,
} from "react";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusableElements(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true",
  );
}

export function useDialogAccessibility<
  TDialog extends HTMLElement,
  TFocus extends HTMLElement = HTMLElement,
>({
  open,
  onClose,
  dialogRef,
  initialFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  dialogRef: RefObject<TDialog | null>;
  initialFocusRef?: RefObject<TFocus | null>;
}) {
  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog) {
        return;
      }

      const target =
        initialFocusRef?.current ?? getFocusableElements(dialog)[0] ?? dialog;
      target.focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (!dialog) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements(dialog);
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const first = focusableElements[0]!;
      const last = focusableElements[focusableElements.length - 1]!;
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
        return;
      }

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;

      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [dialogRef, initialFocusRef, onClose, open]);
}

type DialogSurfaceProps = {
  open?: boolean;
  className: string;
  backdropClassName: string;
  panelClassName: string;
  titleId?: string;
  ariaLabel?: string;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onPanelKeyDown?: KeyboardEventHandler<HTMLElement>;
  children: ReactNode;
};

export function DialogSurface({
  open = true,
  className,
  backdropClassName,
  panelClassName,
  titleId,
  ariaLabel,
  onClose,
  initialFocusRef,
  onPanelKeyDown,
  children,
}: DialogSurfaceProps) {
  const panelRef = useRef<HTMLElement | null>(null);

  useDialogAccessibility({
    open,
    onClose,
    dialogRef: panelRef,
    initialFocusRef,
  });

  return (
    <div aria-hidden={!open} className={className}>
      <div className={backdropClassName} onClick={onClose} />
      <section
        ref={panelRef}
        className={panelClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={ariaLabel}
        tabIndex={-1}
        onKeyDown={onPanelKeyDown}
      >
        {children}
      </section>
    </div>
  );
}
