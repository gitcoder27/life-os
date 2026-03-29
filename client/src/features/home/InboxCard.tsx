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

type InboxCardProps = {
  items: InboxItem[];
  hasMore: boolean;
};

export function InboxCard({ items, hasMore }: InboxCardProps) {
  return (
    <Link to="/inbox" className="dash-card dash-card--link">
      <h3 className="dash-card__title">
        Inbox
        <span className="dash-card__arrow">&rarr;</span>
      </h3>
      {items.length > 0 ? (
        <div className="inbox-preview">
          {items.map((item) => (
            <div key={item.id} className="inbox-preview__row">
              <span className="inbox-preview__text">
                {getQuickCaptureDisplayText(item, item.title)}
              </span>
              <span className="inbox-preview__badge">Triage</span>
            </div>
          ))}
          {hasMore ? (
            <span className="inbox-preview__more">See all &rarr;</span>
          ) : null}
        </div>
      ) : (
        <span className="inbox-preview__empty">Inbox is clear.</span>
      )}
    </Link>
  );
}
