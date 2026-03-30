import { useEffect, useState } from "react";

import {
  getReminderDate,
  getTodayDate,
  toIsoDate,
  type TaskItem,
} from "../../shared/lib/api";
import {
  getQuickCaptureDisplayText,
  getQuickCaptureText,
} from "../../shared/lib/quickCapture";
import { GoalCombobox } from "../../shared/ui/GoalCombobox";
import { SmartDatePicker } from "../../shared/ui/SmartDatePicker";

type InboxInspectorProps = {
  item: TaskItem;
  activeGoals: Array<{ id: string; title: string; domain: string; status: string }>;
  goalsLoading: boolean;
  isMutating: boolean;
  onClose: () => void;
  onDoToday: () => void;
  onSchedule: (date: string) => void;
  onLinkGoal: (goalId: string | null) => void;
  onConvertToNote: () => void;
  onArchive: () => void;
  onUpdateTitle: (title: string) => void;
  onUpdateNotes: (notes: string | null) => void;
};

function getTomorrowDate(isoDate: string) {
  const tomorrow = new Date(`${isoDate}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toIsoDate(tomorrow);
}

function formatCreatedAt(isoDateTime: string) {
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

function getKindLabel(kind: TaskItem["kind"]) {
  switch (kind) {
    case "note":
      return "Note";
    case "reminder":
      return "Reminder";
    default:
      return "Task";
  }
}

export function InboxInspector({
  item,
  activeGoals,
  goalsLoading,
  isMutating,
  onClose,
  onDoToday,
  onSchedule,
  onLinkGoal,
  onConvertToNote,
  onArchive,
  onUpdateTitle,
  onUpdateNotes,
}: InboxInspectorProps) {
  const today = getTodayDate();
  const tomorrow = getTomorrowDate(today);

  const displayTitle = getQuickCaptureDisplayText(item, item.title);
  const notesText = getQuickCaptureText(item, "");

  // Editable title state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(displayTitle);

  // Editable notes state
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editNotes, setEditNotes] = useState(notesText);

  // Schedule date state
  const [scheduleDate, setScheduleDate] = useState(
    getReminderDate(item.reminderAt) ?? tomorrow,
  );

  // Reset all local state when the inspected item changes
  useEffect(() => {
    setIsEditingTitle(false);
    setEditTitle(getQuickCaptureDisplayText(item, item.title));
    setIsEditingNotes(false);
    setEditNotes(getQuickCaptureText(item, ""));
    setScheduleDate(getReminderDate(item.reminderAt) ?? getTomorrowDate(getTodayDate()));
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function commitTitle() {
    setIsEditingTitle(false);
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== displayTitle) {
      onUpdateTitle(trimmed);
    } else {
      setEditTitle(displayTitle);
    }
  }

  function cancelTitle() {
    setIsEditingTitle(false);
    setEditTitle(displayTitle);
  }

  function handleTitleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitTitle();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelTitle();
    }
  }

  function commitNotes() {
    setIsEditingNotes(false);
    const trimmed = editNotes.trim();
    if (trimmed !== notesText) {
      onUpdateNotes(trimmed || null);
    } else {
      setEditNotes(notesText);
    }
  }

  function cancelNotes() {
    setIsEditingNotes(false);
    setEditNotes(notesText);
  }

  function handleNotesKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelNotes();
    }
  }

  function handleScheduleClick() {
    if (scheduleDate) {
      onSchedule(scheduleDate);
    }
  }

  function handleGoalChange(goalId: string) {
    onLinkGoal(goalId || null);
  }

  return (
    <div className="inbox-inspector">
      <div className="inbox-inspector__header">
        <button
          className="inbox-inspector__close"
          type="button"
          onClick={onClose}
          aria-label="Close inspector"
          disabled={isMutating}
        >
          ✕
        </button>
      </div>

      <div className="inbox-inspector__body">
        {/* Meta line */}
        <div className="inbox-inspector__meta">
          <span className={`inbox-queue__kind-dot inbox-queue__kind-dot--${item.kind}`} />
          <span>{getKindLabel(item.kind)}</span>
          <span> · </span>
          <span>{formatCreatedAt(item.createdAt)}</span>
        </div>

        {/* Editable title */}
        {isEditingTitle ? (
          <input
            className="inbox-inspector__title-input"
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={handleTitleKeyDown}
            disabled={isMutating}
            autoFocus
          />
        ) : (
          <h2
            className="inbox-inspector__title"
            onClick={() => {
              if (!isMutating) {
                setEditTitle(displayTitle);
                setIsEditingTitle(true);
              }
            }}
          >
            {displayTitle}
          </h2>
        )}

        {/* Editable notes */}
        {isEditingNotes ? (
          <textarea
            className="inbox-inspector__notes-input"
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            onBlur={commitNotes}
            onKeyDown={handleNotesKeyDown}
            disabled={isMutating}
            rows={4}
            autoFocus
          />
        ) : (
          <p
            className={`inbox-inspector__notes${!notesText ? " inbox-inspector__notes--empty" : ""}`}
            onClick={() => {
              if (!isMutating) {
                setEditNotes(notesText);
                setIsEditingNotes(true);
              }
            }}
          >
            {notesText || "Add notes..."}
          </p>
        )}

        <div className="inbox-inspector__divider" />

        {/* Schedule section */}
        <div className="inbox-inspector__section">
          <span className="inbox-inspector__section-label">SCHEDULE</span>
          <div className="inbox-inspector__section-row">
            <button
              className="button button--primary button--small"
              type="button"
              onClick={onDoToday}
              disabled={isMutating}
            >
              Do today
            </button>
            <SmartDatePicker
              value={scheduleDate}
              onChange={setScheduleDate}
              minDate={today}
              disabled={isMutating}
            />
            <button
              className="button button--ghost button--small"
              type="button"
              onClick={handleScheduleClick}
              disabled={isMutating || !scheduleDate}
            >
              Schedule
            </button>
          </div>
        </div>

        {/* Goal section */}
        <div className="inbox-inspector__section">
          <span className="inbox-inspector__section-label">GOAL</span>
          <GoalCombobox
            goals={activeGoals}
            value={item.goalId ?? ""}
            onChange={handleGoalChange}
            disabled={goalsLoading || isMutating}
          />
        </div>

        <div className="inbox-inspector__divider" />

        {/* Secondary actions */}
        <div className="inbox-inspector__secondary-actions">
          {item.kind === "task" ? (
            <button
              className="inbox-inspector__text-btn"
              type="button"
              onClick={onConvertToNote}
              disabled={isMutating}
            >
              Convert to note
            </button>
          ) : null}
          <button
            className="inbox-inspector__text-btn inbox-inspector__text-btn--danger"
            type="button"
            onClick={onArchive}
            disabled={isMutating}
          >
            Archive
          </button>
        </div>
      </div>
    </div>
  );
}
