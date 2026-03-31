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

type Quote = {
  text: string;
  author: string;
  attributionUrl: string;
};

type SecondaryContextProps = {
  inboxItems: InboxItem[];
  inboxHasMore: boolean;
  weeklyChallenge: WeeklyChallenge | null;
  quote: Quote | null;
};

export function SecondaryContext({
  inboxItems,
  inboxHasMore,
  weeklyChallenge,
  quote,
}: SecondaryContextProps) {
  const hasInbox = inboxItems.length > 0;
  const hasChallenge = weeklyChallenge !== null;
  const hasQuote = quote !== null;

  if (!hasInbox && !hasChallenge && !hasQuote) return null;

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

      {hasQuote ? (
        <section className="secondary-context__block secondary-context__block--quote" aria-label="Quote of the day">
          <div className="secondary-context__header">
            <span className="section-label section-label--small">Quote</span>
          </div>
          <p className="secondary-context__quote-text">"{quote.text}"</p>
          <span className="secondary-context__quote-meta">
            {quote.author}
            {" · "}
            <a
              className="secondary-context__quote-link"
              href={quote.attributionUrl}
              rel="noreferrer"
              target="_blank"
            >
              ZenQuotes
            </a>
          </span>
        </section>
      ) : null}
    </div>
  );
}
