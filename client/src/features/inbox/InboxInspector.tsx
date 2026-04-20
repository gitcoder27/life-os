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
import { formatCreatedAt } from "./inbox-utils";

type InboxInspectorProps = {
  item: TaskItem;
  activeGoals: Array<{ id: string; title: string; domain: string; status: string }>;
  goalsLoading: boolean;
  isMutating: boolean;
  onClose: () => void;
  onCommit: (date: string, protocol: ClarificationProtocol) => void;
  onDoToday: () => void;
  onSchedule: (date: string) => void;
  onLinkGoal: (goalId: string | null) => void;
  onConvertToNote: () => void;
  onConvertToReminder: () => void;
  onArchive: () => void;
  onUpdateTitle: (title: string) => void;
  onUpdateNotes: (notes: string | null) => void;
  promptClarification?: boolean;
  pendingCommitDate?: string | null;
  onClarificationHandled?: () => void;
};

export type ClarificationProtocol = {
  nextAction: string | null;
  fiveMinuteVersion: string | null;
  estimatedDurationMinutes: number | null;
  likelyObstacle: string | null;
  focusLengthMinutes: number | null;
};

function getTomorrowDate(isoDate: string) {
  const tomorrow = new Date(`${isoDate}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toIsoDate(tomorrow);
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

function isTaskReady(item: TaskItem): boolean {
  if (item.kind !== "task") return true;
  if (item.commitmentGuidance) {
    return item.commitmentGuidance.readiness === "ready";
  }
  return Boolean(item.nextAction?.trim());
}

function normalizeInspectorText(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

export function InboxInspector({
  item,
  activeGoals,
  goalsLoading,
  isMutating,
  onClose,
  onCommit,
  onDoToday,
  onSchedule,
  onLinkGoal,
  onConvertToNote,
  onConvertToReminder,
  onArchive,
  onUpdateTitle,
  onUpdateNotes,
  promptClarification,
  pendingCommitDate,
  onClarificationHandled,
}: InboxInspectorProps) {
  const today = getTodayDate();
  const tomorrow = getTomorrowDate(today);

  const displayTitle = getQuickCaptureDisplayText(item, item.title);
  const notesText = getQuickCaptureText(item, "");
  const shouldShowNotes = (() => {
    const normalizedNotes = normalizeInspectorText(notesText);
    if (!normalizedNotes) {
      return false;
    }

    return normalizedNotes !== normalizeInspectorText(displayTitle);
  })();

  const isTask = item.kind === "task";
  const ready = isTaskReady(item);
  const guidance = item.commitmentGuidance;

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

  // Clarification field state
  const [nextAction, setNextAction] = useState(item.nextAction ?? "");
  const [fiveMinuteVersion, setFiveMinuteVersion] = useState(item.fiveMinuteVersion ?? "");
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    item.estimatedDurationMinutes ? String(item.estimatedDurationMinutes) : "",
  );
  const [likelyObstacle, setLikelyObstacle] = useState(item.likelyObstacle ?? "");
  const [focusLength, setFocusLength] = useState(
    item.focusLengthMinutes ? String(item.focusLengthMinutes) : "",
  );
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [showClarification, setShowClarification] = useState(!ready && isTask);

  // Pending date from failed schedule attempt
  const [pendingDate, setPendingDate] = useState<string | null>(null);

  // Reset all local state when the inspected item changes
  useEffect(() => {
    setIsEditingTitle(false);
    setEditTitle(getQuickCaptureDisplayText(item, item.title));
    setIsEditingNotes(false);
    setEditNotes(getQuickCaptureText(item, ""));
    setScheduleDate(getReminderDate(item.reminderAt) ?? getTomorrowDate(getTodayDate()));
    setNextAction(item.nextAction ?? "");
    setFiveMinuteVersion(item.fiveMinuteVersion ?? "");
    setEstimatedMinutes(item.estimatedDurationMinutes ? String(item.estimatedDurationMinutes) : "");
    setLikelyObstacle(item.likelyObstacle ?? "");
    setFocusLength(item.focusLengthMinutes ? String(item.focusLengthMinutes) : "");
    setShowOptionalFields(false);
    setPendingDate(null);

    const taskReady = isTaskReady(item);
    setShowClarification(!taskReady && item.kind === "task");
  }, [item.id, item.reminderAt, item.scheduledForDate, item.goalId]);

  // Handle external prompt to clarify (from failed schedule attempt)
  useEffect(() => {
    if (promptClarification && isTask && !ready) {
      setPendingDate(pendingCommitDate ?? today);
      setShowClarification(true);
      onClarificationHandled?.();
    }
  }, [pendingCommitDate, promptClarification, isTask, ready, onClarificationHandled, today]);

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

  function buildProtocol(): ClarificationProtocol {
    return {
      nextAction: nextAction.trim() || null,
      fiveMinuteVersion: fiveMinuteVersion.trim() || null,
      estimatedDurationMinutes: estimatedMinutes.trim() ? Number(estimatedMinutes) : null,
      likelyObstacle: likelyObstacle.trim() || null,
      focusLengthMinutes: focusLength.trim() ? Number(focusLength) : null,
    };
  }

  function handleDoToday() {
    if (!isTask) {
      onDoToday();
      return;
    }
    onCommit(today, buildProtocol());
  }

  function handleScheduleClick() {
    if (!scheduleDate) return;
    if (!isTask) {
      onSchedule(scheduleDate);
      return;
    }
    onCommit(scheduleDate, buildProtocol());
  }

  function handleClarifyAndCommit() {
    const date = pendingDate ?? today;
    const protocol = buildProtocol();
    onCommit(date, protocol);
  }

  function handleGoalChange(goalId: string) {
    onLinkGoal(goalId || null);
  }

  const hasNextAction = Boolean(nextAction.trim());
  const hasSuggestedImprovements = isTask && guidance && guidance.suggestedReasons.length > 0;

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
        ) : shouldShowNotes ? (
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
        ) : null}

        <div className="inbox-inspector__divider" />

        {/* Readiness + Clarification (tasks only) */}
        {isTask && (
          <>
            <div className="inbox-inspector__section">
              <div className={`inbox-inspector__readiness inbox-inspector__readiness--${ready ? "ready" : "needs-clarification"}`}>
                <span className="inbox-inspector__readiness-icon">{ready ? "✓" : "○"}</span>
                <span className="inbox-inspector__readiness-text">
                  {guidance?.primaryMessage ?? "Ready to schedule. Adding a first visible step can make starting easier."}
                </span>
              </div>

              {/* Show toggle to expand/collapse clarification when task is ready */}
              {ready && !showClarification && hasSuggestedImprovements && (
                <button
                  className="inbox-inspector__text-btn"
                  type="button"
                  onClick={() => setShowClarification(true)}
                  disabled={isMutating}
                >
                  Add optional details
                </button>
              )}
            </div>

            {showClarification && (
              <div className="inbox-inspector__clarify">
                <label className="inbox-inspector__field">
                  <span className="inbox-inspector__field-label">Next visible action (optional)</span>
                  <input
                    className="inbox-inspector__field-input"
                    type="text"
                    value={nextAction}
                    onChange={(e) => setNextAction(e.target.value)}
                    placeholder="Open the file and write the first paragraph"
                    disabled={isMutating}
                    autoFocus={!hasNextAction}
                  />
                </label>

                {showOptionalFields && (
                  <>
                    <label className="inbox-inspector__field">
                      <span className="inbox-inspector__field-label">5-minute version</span>
                      <input
                        className="inbox-inspector__field-input"
                        type="text"
                        value={fiveMinuteVersion}
                        onChange={(e) => setFiveMinuteVersion(e.target.value)}
                        placeholder="Write three bullets"
                        disabled={isMutating}
                      />
                    </label>
                    <div className="inbox-inspector__field-pair">
                      <label className="inbox-inspector__field">
                        <span className="inbox-inspector__field-label">Estimated min</span>
                        <input
                          className="inbox-inspector__field-input"
                          type="text"
                          inputMode="numeric"
                          value={estimatedMinutes}
                          onChange={(e) => setEstimatedMinutes(e.target.value)}
                          placeholder="45"
                          disabled={isMutating}
                        />
                      </label>
                      <label className="inbox-inspector__field">
                        <span className="inbox-inspector__field-label">Focus length</span>
                        <input
                          className="inbox-inspector__field-input"
                          type="text"
                          inputMode="numeric"
                          value={focusLength}
                          onChange={(e) => setFocusLength(e.target.value)}
                          placeholder="25"
                          disabled={isMutating}
                        />
                      </label>
                    </div>
                    <label className="inbox-inspector__field">
                      <span className="inbox-inspector__field-label">Likely obstacle</span>
                      <input
                        className="inbox-inspector__field-input"
                        type="text"
                        value={likelyObstacle}
                        onChange={(e) => setLikelyObstacle(e.target.value)}
                        placeholder="I keep avoiding the blank page"
                        disabled={isMutating}
                      />
                    </label>
                  </>
                )}

                {!showOptionalFields && (
                  <button
                    className="inbox-inspector__text-btn inbox-inspector__text-btn--subtle"
                    type="button"
                    onClick={() => setShowOptionalFields(true)}
                    disabled={isMutating}
                  >
                    + Optional details
                  </button>
                )}

                {pendingDate && (
                  <button
                    className="button button--primary button--small"
                    type="button"
                    onClick={handleClarifyAndCommit}
                    disabled={isMutating}
                  >
                    {pendingDate === today ? "Save details & do today" : "Save details & schedule"}
                  </button>
                )}
              </div>
            )}

            <div className="inbox-inspector__divider" />
          </>
        )}

        {/* Schedule section */}
        <div className="inbox-inspector__section">
          <span className="inbox-inspector__section-label">SCHEDULE</span>
          <div className="inbox-inspector__section-row">
            <button
              className="button button--primary button--small"
              type="button"
              onClick={handleDoToday}
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
          {item.kind !== "reminder" && (
            <button
              className="inbox-inspector__text-btn"
              type="button"
              onClick={onConvertToReminder}
              disabled={isMutating}
            >
              Convert to reminder
            </button>
          )}
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
