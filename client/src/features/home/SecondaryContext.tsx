import { Link } from "react-router-dom";
import { getQuickCaptureDisplayText } from "../../shared/lib/quickCapture";

type InboxItem = {
  id: string;
  title: string;
  kind: "task" | "note" | "reminder";
  notes: string | null;
  reminderAt: string | null;
  originType: string;
};

type WeeklyChallenge = {
  habitId: string;
  title: string;
  streakCount: number;
  weekCompletions: number;
  weekTarget: number;
  status: "on_track" | "due_today" | "behind";
};

type SecondaryContextProps = {
  inboxItems: InboxItem[];
  inboxHasMore: boolean;
  weeklyChallenge: WeeklyChallenge | null;
};

export function SecondaryContext({
  inboxItems,
  inboxHasMore,
  weeklyChallenge,
}: SecondaryContextProps) {
  const hasInbox = inboxItems.length > 0;
  const hasChallenge = weeklyChallenge !== null;

  if (!hasInbox && !hasChallenge) return null;

  return (
    <div className="secondary-context">
      {hasInbox ? (
        <Link to="/inbox" className="secondary-context__block">
          <div className="secondary-context__header">
            <span className="section-label section-label--small">Inbox</span>
            <span className="secondary-context__count">{inboxItems.length}{inboxHasMore ? "+" : ""}</span>
          </div>
          <div className="secondary-context__list">
            {inboxItems.map((item) => (
              <span key={item.id} className="secondary-context__item">
                {getQuickCaptureDisplayText(item, item.title)}
              </span>
            ))}
          </div>
        </Link>
      ) : null}

      {hasChallenge ? (
        <Link to="/habits" className="secondary-context__block">
          <div className="secondary-context__header">
            <span className="section-label section-label--small">Weekly Challenge</span>
            <span className={`secondary-context__tag secondary-context__tag--${weeklyChallenge.status}`}>
              {weeklyChallenge.status.replace(/_/g, " ")}
            </span>
          </div>
          <span className="secondary-context__challenge-title">
            {weeklyChallenge.title}
          </span>
          <span className="secondary-context__challenge-meta">
            {weeklyChallenge.weekCompletions}/{weeklyChallenge.weekTarget} this week
            {weeklyChallenge.streakCount > 0
              ? ` · ${weeklyChallenge.streakCount}d streak`
              : ""}
          </span>
        </Link>
      ) : null}
    </div>
  );
}
