import { useEffect, useState } from "react";
import {
  useCompleteFocusSessionMutation,
  type FocusSessionItem,
} from "../../../shared/lib/api";

export function FocusSessionPanel({
  date,
  session,
}: {
  date: string;
  session: FocusSessionItem | null;
}) {
  const completeMutation = useCompleteFocusSessionMutation(date);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!session) {
      return;
    }

    const intervalId = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(intervalId);
  }, [session]);

  if (!session) {
    return null;
  }

  const activeSession = session;
  const elapsedMinutes = activeSession
    ? Math.max(1, Math.floor((now - new Date(activeSession.startedAt).getTime()) / 60_000))
    : 0;
  const progressPercent = activeSession
    ? Math.min((elapsedMinutes / activeSession.plannedMinutes) * 100, 100)
    : 0;
  async function handleStopFocus() {
    if (!activeSession) return;
    await completeMutation.mutateAsync({
      sessionId: activeSession.id,
      taskOutcome: "advanced",
      completionNote: null,
    });
  }

  async function handleCompleteTask() {
    if (!activeSession) return;
    await completeMutation.mutateAsync({
      sessionId: activeSession.id,
      taskOutcome: "completed",
      completionNote: null,
    });
  }

  return (
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

      {activeSession.task.nextAction?.trim() ? (
        <div className="focus-session-panel__next-action">
          <span>Next action</span>
          <strong>{activeSession.task.nextAction}</strong>
        </div>
      ) : null}

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
          className="button button--primary button--small focus-session-panel__done"
          type="button"
          disabled={completeMutation.isPending}
          onClick={() => void handleCompleteTask()}
        >
          {completeMutation.isPending ? "Saving..." : "Task done"}
        </button>
        <button
          className="button button--ghost button--small focus-session-panel__stop"
          type="button"
          disabled={completeMutation.isPending}
          onClick={() => void handleStopFocus()}
        >
          Stop focus
        </button>
      </div>
    </section>
  );
}
