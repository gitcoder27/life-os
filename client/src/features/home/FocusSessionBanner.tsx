import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { FocusSessionItem } from "../../shared/lib/api";

export function FocusSessionBanner({ session }: { session: FocusSessionItem | null }) {
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

  const elapsedMinutes = Math.max(1, Math.floor((now - new Date(session.startedAt).getTime()) / 60_000));

  return (
    <section className="focus-session-banner">
      <div className="focus-session-banner__copy">
        <span className="focus-session-banner__eyebrow">
          {session.depth === "deep" ? "Deep focus active" : "Shallow focus active"}
        </span>
        <strong className="focus-session-banner__title">{session.task.title}</strong>
        <span className="focus-session-banner__detail">
          {session.task.nextAction ?? "Stay with the current step."}
        </span>
      </div>

      <div className="focus-session-banner__meta">
        <span>{elapsedMinutes}m / {session.plannedMinutes}m</span>
        <Link to="/today" className="button button--ghost button--small">
          Resume on Today
        </Link>
      </div>
    </section>
  );
}
