import { useEffect, useRef, useState } from "react";

import type { TaskItem } from "../../shared/lib/api";
import { getQuickCaptureDisplayText } from "../../shared/lib/quickCapture";
import { SmartDatePicker } from "../../shared/ui/SmartDatePicker";

type InboxQueueItemProps = {
  item: TaskItem;
  isActive: boolean;
  isChecked: boolean;
  isStale: boolean;
  isMutating: boolean;
  today: string;
  onSelect: () => void;
  onToggleCheck: () => void;
  onDoToday: () => void;
  onSchedule: (date: string) => void;
  onArchive: () => void;
  onConvertToNote: () => void;
  onLinkGoal: () => void;
};

const domainColors: Record<string, string> = {
  health: "#5db86a",
  money: "#d9993a",
  work_growth: "#6b9fc4",
  home_admin: "#a08ed4",
  discipline: "#d97a73",
  other: "#8a8270",
};

function formatCreatedAt(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function InboxQueueItem({
  item,
  isActive,
  isChecked,
  isStale,
  isMutating,
  today,
  onSelect,
  onToggleCheck,
  onDoToday,
  onSchedule,
  onArchive,
  onConvertToNote,
  onLinkGoal,
}: InboxQueueItemProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  const displayText = getQuickCaptureDisplayText(item, item.title);

  // Close menus when clicking outside
  useEffect(() => {
    if (!showMoreMenu && !showCalendar) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (showMoreMenu && moreMenuRef.current && !moreMenuRef.current.contains(target)) {
        setShowMoreMenu(false);
      }
      if (showCalendar && calendarRef.current && !calendarRef.current.contains(target)) {
        setShowCalendar(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMoreMenu, showCalendar]);

  let itemClassName = "inbox-queue__item";
  if (isActive) itemClassName += " inbox-queue__item--active";
  if (isStale) itemClassName += " inbox-queue__item--stale";

  return (
    <div
      className={itemClassName}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {/* Main row */}
      <div className="inbox-queue__row">
        <input
          type="checkbox"
          className="inbox-queue__checkbox"
          checked={isChecked}
          disabled={isMutating}
          aria-label={`Select ${displayText}`}
          onChange={onToggleCheck}
          onClick={(e) => e.stopPropagation()}
        />

        <span className={`inbox-queue__kind-dot inbox-queue__kind-dot--${item.kind}`} />

        <span className="inbox-queue__title">{displayText}</span>

        <span className="inbox-queue__right">
          <span className="inbox-queue__age">{formatCreatedAt(item.createdAt)}</span>
          {isStale ? <span className="inbox-queue__stale-icon" aria-label="Stale item">!</span> : null}

          <span className="inbox-queue__hover-actions">
            <button
              className="inbox-queue__hover-btn inbox-queue__hover-btn--primary"
              type="button"
              disabled={isMutating}
              onClick={(e) => {
                e.stopPropagation();
                onDoToday();
              }}
            >
              Today
            </button>

            <div ref={calendarRef} style={{ position: "relative" }}>
              <button
                className="inbox-queue__hover-btn"
                type="button"
                disabled={isMutating}
                aria-label="Schedule for date"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCalendar((prev) => !prev);
                  setShowMoreMenu(false);
                }}
              >
                Cal
              </button>
              {showCalendar ? (
                <div
                  style={{ position: "absolute", right: 0, top: "100%", zIndex: 20 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <SmartDatePicker
                    value={today}
                    onChange={(date) => {
                      onSchedule(date);
                      setShowCalendar(false);
                    }}
                    minDate={today}
                    disabled={isMutating}
                  />
                </div>
              ) : null}
            </div>

            <div ref={moreMenuRef} style={{ position: "relative" }}>
              <button
                className="inbox-queue__hover-btn"
                type="button"
                disabled={isMutating}
                aria-label="More actions"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMoreMenu((prev) => !prev);
                  setShowCalendar(false);
                }}
              >
                &middot;&middot;&middot;
              </button>
              {showMoreMenu ? (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "100%",
                    zIndex: 20,
                    background: "var(--panel-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-xs)",
                    padding: "0.25rem 0",
                    minWidth: "140px",
                    boxShadow: "var(--shadow-lg)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {item.kind === "task" ? (
                    <button
                      className="inbox-inspector__text-btn"
                      type="button"
                      style={{ width: "100%", padding: "0.4rem 0.75rem" }}
                      disabled={isMutating}
                      onClick={() => {
                        onConvertToNote();
                        setShowMoreMenu(false);
                      }}
                    >
                      Convert to note
                    </button>
                  ) : null}
                  <button
                    className="inbox-inspector__text-btn"
                    type="button"
                    style={{ width: "100%", padding: "0.4rem 0.75rem" }}
                    disabled={isMutating}
                    onClick={() => {
                      onLinkGoal();
                      setShowMoreMenu(false);
                    }}
                  >
                    Link goal
                  </button>
                  <button
                    className="inbox-inspector__text-btn inbox-inspector__text-btn--danger"
                    type="button"
                    style={{ width: "100%", padding: "0.4rem 0.75rem" }}
                    disabled={isMutating}
                    onClick={() => {
                      onArchive();
                      setShowMoreMenu(false);
                    }}
                  >
                    Archive
                  </button>
                </div>
              ) : null}
            </div>
          </span>
        </span>
      </div>

      {/* Goal sub-row */}
      {item.goal ? (
        <div className="inbox-queue__goal">
          <span
            className="inbox-queue__goal-dot"
            style={{ background: domainColors[item.goal.domain] ?? domainColors.other }}
          />
          <span>{item.goal.title}</span>
        </div>
      ) : null}
    </div>
  );
}
