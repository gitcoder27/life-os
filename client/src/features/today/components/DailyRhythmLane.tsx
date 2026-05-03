import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { formatTimeLabel } from "../../../shared/lib/api";
import type {
  DailyRhythmItem,
  DailyRhythmPlan,
  DailyRhythmReservation,
} from "../helpers/daily-rhythm";
import {
  DAILY_RHYTHM_DRAG_TYPE,
  getDailyRhythmDragId,
} from "../helpers/planner-drag";
import { PlannerRailSection } from "./PlannerRailSection";

export function DailyRhythmLane({
  plan,
  readOnly,
  isPending,
  onReserve,
  onComplete,
  onSkip,
}: {
  plan: DailyRhythmPlan;
  readOnly: boolean;
  isPending: boolean;
  onReserve: (item: DailyRhythmItem) => void;
  onComplete: (item: DailyRhythmItem) => void;
  onSkip: (item: DailyRhythmItem) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const focusItems = plan.items.filter(
    (item) => item.state !== "done" && item.state !== "skipped" && item.state !== "planned",
  );
  const visibleItems = focusItems.length > 0
    ? focusItems
    : plan.items.filter((item) => item.state === "done" || item.state === "planned").slice(0, 3);

  if (plan.items.length === 0) {
    return null;
  }

  return (
    <PlannerRailSection
      title="Rhythm"
      count={focusItems.length}
      tone="rhythm"
      expanded={expanded}
      className="daily-rhythm"
      ariaLabel="Daily rhythm"
      headerMeta={
        <span className="planner-rail-section__meta">
          {plan.counts.reserved + plan.counts.planned}/{plan.counts.total}
        </span>
      }
      onToggle={() => setExpanded((current) => !current)}
    >
      <div className="daily-rhythm__rail" aria-hidden="true">
        <span
          className="daily-rhythm__rail-fill"
          style={{
            width: `${Math.round(((plan.counts.reserved + plan.counts.planned + plan.counts.done + plan.counts.skipped) / Math.max(plan.counts.total, 1)) * 100)}%`,
          }}
        />
      </div>

      <div className="daily-rhythm__list">
        {visibleItems.map((item) => (
          <DailyRhythmRow
            key={item.id}
            item={item}
            readOnly={readOnly}
            isPending={isPending}
            onReserve={onReserve}
            onComplete={onComplete}
            onSkip={onSkip}
          />
        ))}
      </div>
    </PlannerRailSection>
  );
}

export function DailyRhythmTimelineBlock({
  reservation,
  item,
  topPx,
  heightPx,
  readOnly,
  isPending,
  onReserve,
  onComplete,
  onSkip,
}: {
  reservation: DailyRhythmReservation;
  item: DailyRhythmItem | null;
  topPx: number;
  heightPx: number;
  readOnly: boolean;
  isPending: boolean;
  onReserve: (item: DailyRhythmItem) => void;
  onComplete: (item: DailyRhythmItem) => void;
  onSkip: (item: DailyRhythmItem) => void;
}) {
  return (
    <div
      className={`daily-rhythm-block daily-rhythm-block--${reservation.kind}`}
      style={{
        position: "absolute",
        top: `${topPx}px`,
        minHeight: `${heightPx}px`,
        left: 0,
        right: 0,
      }}
    >
      <div className="daily-rhythm-block__copy">
        <span className="daily-rhythm-block__time">
          {formatTimeLabel(reservation.startsAt)} - {formatTimeLabel(reservation.endsAt)}
        </span>
        <span className="daily-rhythm-block__title">{reservation.title}</span>
        <span className="daily-rhythm-block__detail">{reservation.detailLabel}</span>
      </div>
      {item && !readOnly ? (
        <div className="daily-rhythm-block__actions">
          <button
            className="daily-rhythm__icon-btn"
            type="button"
            onClick={() => onReserve(item)}
            disabled={isPending}
            title="Make time block"
            aria-label={`Make ${item.title} a time block`}
          >
            <BlockIcon />
          </button>
          <button
            className="daily-rhythm__icon-btn"
            type="button"
            onClick={() => onComplete(item)}
            disabled={isPending || item.completed}
            title={item.kind === "routine" ? "Complete routine" : "Mark done"}
            aria-label={item.kind === "routine" ? `Complete ${item.title}` : `Mark ${item.title} done`}
          >
            <CheckMiniIcon />
          </button>
          {item.kind === "habit" && !item.skipped && !item.completed ? (
            <button
              className="daily-rhythm__icon-btn"
              type="button"
              onClick={() => onSkip(item)}
              disabled={isPending}
              title="Skip today"
              aria-label={`Skip ${item.title} today`}
            >
              <SkipMiniIcon />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DailyRhythmRow({
  item,
  readOnly,
  isPending,
  onReserve,
  onComplete,
  onSkip,
}: {
  item: DailyRhythmItem;
  readOnly: boolean;
  isPending: boolean;
  onReserve: (item: DailyRhythmItem) => void;
  onComplete: (item: DailyRhythmItem) => void;
  onSkip: (item: DailyRhythmItem) => void;
}) {
  const canReserve = !readOnly && item.state !== "done" && item.state !== "skipped" && item.state !== "planned";
  const canComplete = !readOnly && !item.completed && !item.skipped;
  const canSkip = !readOnly && item.kind === "habit" && !item.completed && !item.skipped;
  const canDrag = canReserve && !isPending;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: getDailyRhythmDragId(item.id),
    data: {
      type: DAILY_RHYTHM_DRAG_TYPE,
      itemId: item.id,
    },
    disabled: !canDrag,
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        "daily-rhythm-item",
        ` daily-rhythm-item--${item.state}`,
        canDrag ? " daily-rhythm-item--draggable" : "",
        isDragging ? " daily-rhythm-item--dragging" : "",
      ].join("")}
      aria-grabbed={isDragging}
    >
      {canDrag ? (
        <button
          className="daily-rhythm-item__drag-handle"
          type="button"
          aria-label={`Drag ${item.title} to the timeline`}
          {...attributes}
          {...listeners}
        >
          <span className="daily-rhythm-item__mark" aria-hidden="true" />
        </button>
      ) : (
        <div className="daily-rhythm-item__mark" aria-hidden="true" />
      )}
      <div className="daily-rhythm-item__body">
        <div className="daily-rhythm-item__header">
          <span className="daily-rhythm-item__title">{item.title}</span>
          <span className="daily-rhythm-item__state">{getStateLabel(item)}</span>
        </div>
        <div className="daily-rhythm-item__meta">
          <span>{buildRhythmMeta(item)}</span>
          {item.conflictLabel ? (
            <span className="daily-rhythm-item__conflict">{item.conflictLabel}</span>
          ) : null}
        </div>
        {canReserve || canComplete || canSkip ? (
          <div
            className="daily-rhythm-item__actions"
            onPointerDown={(event) => event.stopPropagation()}
          >
            {canReserve ? (
              <button
                className="daily-rhythm__text-btn daily-rhythm__text-btn--primary"
                type="button"
                onClick={() => onReserve(item)}
                disabled={isPending}
              >
                {item.state === "reserved" ? "Make block" : item.state === "conflict" ? "Move" : "Reserve"}
              </button>
            ) : null}
            {canComplete ? (
              <button
                className="daily-rhythm__icon-btn"
                type="button"
                onClick={() => onComplete(item)}
                disabled={isPending}
                title={item.kind === "routine" ? "Complete routine" : "Mark done"}
                aria-label={item.kind === "routine" ? `Complete ${item.title}` : `Mark ${item.title} done`}
              >
                <CheckMiniIcon />
              </button>
            ) : null}
            {canSkip ? (
              <button
                className="daily-rhythm__text-btn daily-rhythm__text-btn--quiet"
                type="button"
                onClick={() => onSkip(item)}
                disabled={isPending}
              >
                Skip
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getStateLabel(item: DailyRhythmItem) {
  if (item.state === "reserved") {
    return "Reserved";
  }

  if (item.state === "planned") {
    return "Planned";
  }

  if (item.state === "conflict") {
    return "Conflict";
  }

  if (item.state === "needs_slot") {
    return "Needs time";
  }

  if (item.state === "done") {
    return "Done";
  }

  if (item.state === "skipped") {
    return "Skipped";
  }

  return "Anytime";
}

function buildRhythmMeta(item: DailyRhythmItem) {
  if (item.progressLabel) {
    return `${item.detailLabel} · ${item.progressLabel}`;
  }

  return item.detailLabel;
}

function SkipMiniIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3l7 7M10 3l-7 7" />
    </svg>
  );
}

function CheckMiniIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 6.8l2.4 2.4 5.6-5.8" />
    </svg>
  );
}

function BlockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2.5" width="9" height="8" rx="1.5" />
      <path d="M4 5h5M4 7.5h3" />
    </svg>
  );
}
