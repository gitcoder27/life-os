import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  useAbortFocusSessionMutation,
  useCaptureFocusDistractionMutation,
  useCompleteFocusSessionMutation,
  type FocusSessionExitReason,
  type FocusSessionItem,
  type FocusSessionTaskOutcome,
} from "../../../shared/lib/api";

const EXIT_REASONS: Array<{ value: FocusSessionExitReason; label: string }> = [
  { value: "interrupted", label: "Interrupted" },
  { value: "low_energy", label: "Low energy" },
  { value: "unclear", label: "Unclear" },
  { value: "switched_context", label: "Switched context" },
  { value: "done_enough", label: "Done enough" },
];

const TASK_OUTCOMES: Array<{ value: FocusSessionTaskOutcome; label: string; detail: string }> = [
  { value: "started", label: "Started", detail: "Count it as started and keep it moving later." },
  { value: "advanced", label: "Advanced", detail: "Mark meaningful progress without closing the task." },
  { value: "completed", label: "Completed", detail: "Finish the task and close it out." },
];

export function FocusSessionPanel({
  date,
  session,
}: {
  date: string;
  session: FocusSessionItem | null;
}) {
  const captureMutation = useCaptureFocusDistractionMutation(date);
  const completeMutation = useCompleteFocusSessionMutation(date);
  const abortMutation = useAbortFocusSessionMutation(date);
  const [now, setNow] = useState(() => Date.now());
  const [distractionOpen, setDistractionOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [abortOpen, setAbortOpen] = useState(false);
  const [distractionNote, setDistractionNote] = useState("");
  const [completionNote, setCompletionNote] = useState("");
  const [taskOutcome, setTaskOutcome] = useState<FocusSessionTaskOutcome>("advanced");
  const [abortReason, setAbortReason] = useState<FocusSessionExitReason>("interrupted");
  const [abortNote, setAbortNote] = useState("");

  useEffect(() => {
    if (!session) {
      return;
    }

    const intervalId = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(intervalId);
  }, [session]);

  useEffect(() => {
    if (!completeOpen) {
      return;
    }

    setTaskOutcome("advanced");
    setCompletionNote("");
  }, [completeOpen]);

  useEffect(() => {
    if (!distractionOpen) {
      return;
    }

    setDistractionNote("");
  }, [distractionOpen]);

  useEffect(() => {
    if (!abortOpen) {
      return;
    }

    setAbortReason("interrupted");
    setAbortNote("");
  }, [abortOpen]);

  if (!session) {
    return null;
  }

  const activeSession = session;
  const elapsedMinutes = Math.max(1, Math.floor((now - new Date(activeSession.startedAt).getTime()) / 60_000));
  const progressPercent = Math.min((elapsedMinutes / activeSession.plannedMinutes) * 100, 100);
  const activeMutationPending =
    captureMutation.isPending || completeMutation.isPending || abortMutation.isPending;

  async function handleCaptureDistraction() {
    await captureMutation.mutateAsync({
      sessionId: activeSession.id,
      note: distractionNote.trim(),
    });
    setDistractionNote("");
    setDistractionOpen(false);
  }

  async function handleCompleteSession() {
    await completeMutation.mutateAsync({
      sessionId: activeSession.id,
      taskOutcome,
      completionNote: completionNote.trim() || null,
    });
    setCompleteOpen(false);
  }

  async function handleAbortSession() {
    await abortMutation.mutateAsync({
      sessionId: activeSession.id,
      exitReason: abortReason,
      note: abortNote.trim() || null,
    });
    setAbortOpen(false);
  }

  return (
    <>
      <section className="focus-session-panel">
        <div className="focus-session-panel__header">
          <div>
            <p className="focus-session-panel__eyebrow">
              {activeSession.depth === "deep" ? "Deep focus" : "Shallow focus"}
            </p>
            <h2 className="focus-session-panel__title">{activeSession.task.title}</h2>
          </div>
          <div className="focus-session-panel__timing">
            <strong>{elapsedMinutes}m</strong>
            <span>of {activeSession.plannedMinutes}m</span>
          </div>
        </div>

        <div className="focus-session-panel__next-action">
          <span>Next action</span>
          <strong>{activeSession.task.nextAction ?? "Stay with the current step."}</strong>
        </div>

        <div className="focus-session-panel__progress">
          <div className="focus-session-panel__progress-bar">
            <div className="focus-session-panel__progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="focus-session-panel__progress-copy">
            Started {new Date(activeSession.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </span>
        </div>

        {activeSession.distractionNotes ? (
          <p className="focus-session-panel__notes">{activeSession.distractionNotes}</p>
        ) : null}

        <div className="focus-session-panel__actions">
          <button
            className="button button--ghost button--small"
            type="button"
            disabled={activeMutationPending}
            onClick={() => setDistractionOpen(true)}
          >
            Capture distraction
          </button>
          <button
            className="button button--primary button--small"
            type="button"
            disabled={activeMutationPending}
            onClick={() => setCompleteOpen(true)}
          >
            Complete session
          </button>
          <button
            className="button button--ghost button--small"
            type="button"
            disabled={activeMutationPending}
            onClick={() => setAbortOpen(true)}
          >
            End early
          </button>
        </div>
      </section>

      {distractionOpen
        ? createPortal(
            <div className="capture-sheet capture-sheet--open">
              <div className="capture-sheet__backdrop" onClick={() => setDistractionOpen(false)} />
              <section className="capture-sheet__panel focus-session-sheet">
                <div className="capture-sheet__header">
                  <div>
                    <p className="page-eyebrow">Capture Distraction</p>
                    <h3 className="capture-sheet__title">{activeSession.task.title}</h3>
                  </div>
                  <button className="button button--ghost button--small" type="button" onClick={() => setDistractionOpen(false)}>
                    Close
                  </button>
                </div>

                <div className="stack-form">
                  <label className="field">
                    <span>What pulled you away?</span>
                    <textarea
                      value={distractionNote}
                      onChange={(event) => setDistractionNote(event.target.value)}
                      rows={4}
                      placeholder="Slack ping, browser drift, random admin thought..."
                    />
                  </label>

                  <div className="button-row">
                    <button
                      className="button button--primary"
                      type="button"
                      onClick={() => void handleCaptureDistraction()}
                      disabled={captureMutation.isPending || !distractionNote.trim()}
                    >
                      {captureMutation.isPending ? "Saving..." : "Save note"}
                    </button>
                  </div>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}

      {completeOpen
        ? createPortal(
            <div className="capture-sheet capture-sheet--open">
              <div className="capture-sheet__backdrop" onClick={() => setCompleteOpen(false)} />
              <section className="capture-sheet__panel focus-session-sheet">
                <div className="capture-sheet__header">
                  <div>
                    <p className="page-eyebrow">Wrap Up</p>
                    <h3 className="capture-sheet__title">{activeSession.task.title}</h3>
                  </div>
                  <button className="button button--ghost button--small" type="button" onClick={() => setCompleteOpen(false)}>
                    Close
                  </button>
                </div>

                <div className="stack-form">
                  <div className="field">
                    <span>How should this task move forward?</span>
                    <div className="focus-session-option-list">
                      {TASK_OUTCOMES.map((option) => (
                        <button
                          key={option.value}
                          className={`focus-session-option${taskOutcome === option.value ? " focus-session-option--active" : ""}`}
                          type="button"
                          onClick={() => setTaskOutcome(option.value)}
                        >
                          <strong>{option.label}</strong>
                          <span>{option.detail}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="field">
                    <span>Completion note</span>
                    <textarea
                      value={completionNote}
                      onChange={(event) => setCompletionNote(event.target.value)}
                      rows={4}
                      placeholder="What moved forward in this session?"
                    />
                  </label>

                  <div className="button-row">
                    <button
                      className="button button--primary"
                      type="button"
                      onClick={() => void handleCompleteSession()}
                      disabled={completeMutation.isPending}
                    >
                      {completeMutation.isPending ? "Saving..." : "Finish session"}
                    </button>
                  </div>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}

      {abortOpen
        ? createPortal(
            <div className="capture-sheet capture-sheet--open">
              <div className="capture-sheet__backdrop" onClick={() => setAbortOpen(false)} />
              <section className="capture-sheet__panel focus-session-sheet">
                <div className="capture-sheet__header">
                  <div>
                    <p className="page-eyebrow">End Early</p>
                    <h3 className="capture-sheet__title">{activeSession.task.title}</h3>
                  </div>
                  <button className="button button--ghost button--small" type="button" onClick={() => setAbortOpen(false)}>
                    Close
                  </button>
                </div>

                <div className="stack-form">
                  <div className="field">
                    <span>Why are you stopping?</span>
                    <div className="focus-session-choice-row focus-session-choice-row--wrap">
                      {EXIT_REASONS.map((reason) => (
                        <button
                          key={reason.value}
                          className={`focus-session-choice${abortReason === reason.value ? " focus-session-choice--active" : ""}`}
                          type="button"
                          onClick={() => setAbortReason(reason.value)}
                        >
                          {reason.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="field">
                    <span>Note</span>
                    <textarea
                      value={abortNote}
                      onChange={(event) => setAbortNote(event.target.value)}
                      rows={4}
                      placeholder="Optional context for why this session stopped."
                    />
                  </label>

                  <div className="button-row">
                    <button
                      className="button button--primary"
                      type="button"
                      onClick={() => void handleAbortSession()}
                      disabled={abortMutation.isPending}
                    >
                      {abortMutation.isPending ? "Saving..." : "End session"}
                    </button>
                  </div>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
