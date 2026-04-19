import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  useAbortFocusSessionMutation,
  useCaptureFocusDistractionMutation,
  useCompleteFocusSessionMutation,
  useFocusTaskInsightQuery,
  useUpdateTaskMutation,
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

type EndedSessionSnapshot = {
  session: FocusSessionItem;
  outcome: "completed" | "aborted";
};

export function FocusSessionPanel({
  date,
  session,
  onClarifyTask,
}: {
  date: string;
  session: FocusSessionItem | null;
  onClarifyTask?: (taskId: string) => void;
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
  const [endedSnapshot, setEndedSnapshot] = useState<EndedSessionSnapshot | null>(null);

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

  if (!session && !endedSnapshot) {
    return null;
  }

  const activeSession = session;
  const elapsedMinutes = activeSession
    ? Math.max(1, Math.floor((now - new Date(activeSession.startedAt).getTime()) / 60_000))
    : 0;
  const progressPercent = activeSession
    ? Math.min((elapsedMinutes / activeSession.plannedMinutes) * 100, 100)
    : 0;
  const activeMutationPending =
    captureMutation.isPending || completeMutation.isPending || abortMutation.isPending;

  async function handleCaptureDistraction() {
    if (!activeSession) return;
    await captureMutation.mutateAsync({
      sessionId: activeSession.id,
      note: distractionNote.trim(),
    });
    setDistractionNote("");
    setDistractionOpen(false);
  }

  async function handleCompleteSession() {
    if (!activeSession) return;
    await completeMutation.mutateAsync({
      sessionId: activeSession.id,
      taskOutcome,
      completionNote: completionNote.trim() || null,
    });
    setEndedSnapshot({ session: activeSession, outcome: "completed" });
    setCompleteOpen(false);
  }

  async function handleAbortSession() {
    if (!activeSession) return;
    await abortMutation.mutateAsync({
      sessionId: activeSession.id,
      exitReason: abortReason,
      note: abortNote.trim() || null,
    });
    setEndedSnapshot({ session: activeSession, outcome: "aborted" });
    setAbortOpen(false);
  }

  return (
    <>
      {activeSession ? (
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
      ) : null}

      {distractionOpen && activeSession
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

      {completeOpen && activeSession
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

      {abortOpen && activeSession
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

      {endedSnapshot
        ? createPortal(
            <FocusSessionRecapSheet
              date={date}
              snapshot={endedSnapshot}
              onClose={() => setEndedSnapshot(null)}
              onClarify={
                onClarifyTask
                  ? () => {
                      onClarifyTask(endedSnapshot.session.taskId);
                      setEndedSnapshot(null);
                    }
                  : undefined
              }
            />,
            document.body,
          )
        : null}
    </>
  );
}

function FocusSessionRecapSheet({
  date,
  snapshot,
  onClose,
  onClarify,
}: {
  date: string;
  snapshot: EndedSessionSnapshot;
  onClose: () => void;
  onClarify?: () => void;
}) {
  const insightQuery = useFocusTaskInsightQuery(snapshot.session.taskId);
  const updateTaskMutation = useUpdateTaskMutation(date);
  const insight = insightQuery.data?.insight ?? null;

  const headline =
    snapshot.outcome === "completed" ? "Session completed" : "Session ended early";
  const fallbackMessage =
    snapshot.outcome === "completed"
      ? "Nice work wrapping up this session."
      : "Noted. Saving that for next time.";
  const message = insight?.summaryMessage ?? fallbackMessage;

  const canClarify =
    Boolean(onClarify) && insight?.suggestedAdjustment === "clarify_next_action";
  const recommendedMinutes = insight?.recommendedPlannedMinutes ?? null;
  const canUseRecommendedMinutes =
    insight?.suggestedAdjustment === "shorten_session" && recommendedMinutes !== null;
  const primaryCtaLabel = canClarify
    ? "Tighten next action"
    : canUseRecommendedMinutes
      ? `Use ${recommendedMinutes} minutes next time`
      : "Keep this setup";

  async function handlePrimary() {
    if (canClarify && onClarify) {
      onClarify();
      return;
    }

    if (canUseRecommendedMinutes && recommendedMinutes !== null) {
      await updateTaskMutation.mutateAsync({
        taskId: snapshot.session.taskId,
        focusLengthMinutes: recommendedMinutes,
      });
    }

    onClose();
  }

  return (
    <div className="capture-sheet capture-sheet--open">
      <div className="capture-sheet__backdrop" onClick={onClose} />
      <section className="capture-sheet__panel focus-session-sheet focus-session-recap">
        <div className="capture-sheet__header">
          <div>
            <p className="page-eyebrow">Learning moment</p>
            <h3 className="capture-sheet__title">{snapshot.session.task.title}</h3>
          </div>
          <button className="button button--ghost button--small" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="stack-form">
          <div className="focus-session-recap__body">
            <p className="focus-session-recap__headline">{headline}</p>
            <p className="focus-session-recap__message">
              {insightQuery.isLoading && !insight ? "Checking recent sessions…" : message}
            </p>
          </div>

          <div className="button-row">
            <button
              className="button button--primary"
              type="button"
              onClick={() => void handlePrimary()}
              disabled={updateTaskMutation.isPending}
            >
              {updateTaskMutation.isPending ? "Saving..." : primaryCtaLabel}
            </button>
            {canClarify ? (
              <button className="button button--ghost" type="button" onClick={onClose}>
                Dismiss
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
