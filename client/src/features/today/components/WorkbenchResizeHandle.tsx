import { WORKBENCH_RAIL_WIDTH_STEP } from "../helpers/workbench-layout";

export function WorkbenchResizeHandle({
  width,
  resizing,
  onResizeFromPointer,
  onResizeStart,
  onResizeEnd,
  onReset,
  onStep,
}: {
  width: number;
  resizing: boolean;
  onResizeFromPointer: (clientX: number) => void;
  onResizeStart: () => void;
  onResizeEnd: () => void;
  onReset: () => void;
  onStep: (delta: number) => void;
}) {
  return (
    <div
      className="today-workbench__resize"
      role="separator"
      tabIndex={0}
      aria-label="Resize today context column"
      aria-orientation="vertical"
      aria-valuemin={320}
      aria-valuemax={544}
      aria-valuenow={width}
      title="Drag to resize. Double-click to reset."
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        onResizeStart();
        onResizeFromPointer(event.clientX);
      }}
      onPointerMove={(event) => {
        if (!resizing) {
          return;
        }
        onResizeFromPointer(event.clientX);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        onResizeEnd();
      }}
      onDoubleClick={onReset}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          onStep(WORKBENCH_RAIL_WIDTH_STEP);
          return;
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          onStep(-WORKBENCH_RAIL_WIDTH_STEP);
          return;
        }
        if (event.key === "Home") {
          event.preventDefault();
          onReset();
        }
      }}
    />
  );
}
