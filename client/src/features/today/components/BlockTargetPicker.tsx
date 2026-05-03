import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatTimeLabel, type DayPlannerBlockItem } from "../../../shared/lib/api";

const VIEWPORT_MARGIN_PX = 12;
const MENU_GAP_PX = 8;
const MENU_MIN_WIDTH_PX = 240;

type PickerPosition = {
  top: number;
  left: number;
  minWidth: number;
  placement: "top" | "bottom";
};

export function BlockTargetPicker({
  label,
  blocks,
  disabled,
  triggerClassName,
  menuClassName,
  onSelect,
}: {
  label: string;
  blocks: DayPlannerBlockItem[];
  disabled: boolean;
  triggerClassName: string;
  menuClassName?: string;
  onSelect: (block: DayPlannerBlockItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PickerPosition>({
    top: VIEWPORT_MARGIN_PX,
    left: VIEWPORT_MARGIN_PX,
    minWidth: MENU_MIN_WIDTH_PX,
    placement: "bottom",
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (blocks.length === 0 && open) {
      setOpen(false);
    }
  }, [blocks.length, open]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) {
        return;
      }

      const triggerRect = trigger.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const minWidth = Math.max(triggerRect.width, MENU_MIN_WIDTH_PX);
      const safeWidth = Math.min(minWidth, window.innerWidth - VIEWPORT_MARGIN_PX * 2);
      const maxLeft = window.innerWidth - safeWidth - VIEWPORT_MARGIN_PX;
      const left = Math.max(
        VIEWPORT_MARGIN_PX,
        Math.min(triggerRect.right - safeWidth, maxLeft),
      );

      const spaceBelow = window.innerHeight - triggerRect.bottom - VIEWPORT_MARGIN_PX;
      const spaceAbove = triggerRect.top - VIEWPORT_MARGIN_PX;
      const shouldFlipUp =
        spaceBelow < Math.min(menuRect.height, 280) && spaceAbove > spaceBelow;

      const nextTop = shouldFlipUp
        ? Math.max(
            VIEWPORT_MARGIN_PX,
            triggerRect.top - menuRect.height - MENU_GAP_PX,
          )
        : Math.min(
            triggerRect.bottom + MENU_GAP_PX,
            window.innerHeight - menuRect.height - VIEWPORT_MARGIN_PX,
          );

      setPosition({
        top: nextTop,
        left,
        minWidth: safeWidth,
        placement: shouldFlipUp ? "top" : "bottom",
      });
    };

    let frameId: number | null = null;
    const schedulePositionUpdate = () => {
      if (frameId !== null) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        updatePosition();
      });
    };

    updatePosition();
    window.addEventListener("resize", schedulePositionUpdate);
    document.addEventListener("scroll", schedulePositionUpdate, true);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("resize", schedulePositionUpdate);
      document.removeEventListener("scroll", schedulePositionUpdate, true);
    };
  }, [blocks.length, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        className={triggerClassName}
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled || blocks.length === 0}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {label}
      </button>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              className={`block-target-picker__menu block-target-picker__menu--${position.placement}${
                menuClassName ? ` ${menuClassName}` : ""
              }`}
              style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
                minWidth: `${position.minWidth}px`,
              }}
              role="menu"
              aria-label="Choose a planner block"
            >
              {blocks.map((block) => (
                <button
                  key={block.id}
                  className="block-target-picker__item"
                  type="button"
                  onClick={() => {
                    onSelect(block);
                    setOpen(false);
                  }}
                  disabled={disabled}
                  role="menuitem"
                >
                  <span className="block-target-picker__time">
                    {formatTimeLabel(block.startsAt)}
                  </span>
                  <span className="block-target-picker__title">
                    {block.title || "Untitled block"}
                  </span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
