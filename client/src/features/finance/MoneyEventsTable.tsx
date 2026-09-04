import {
  formatMinorCurrency,
} from "../../shared/lib/api";
import { EmptyState } from "../../shared/ui/PageState";
import type { MoneyEvent } from "./finance-page-model";

export function MoneyEventsTable({
  events,
  currency,
  showGroups = false,
}: {
  events: MoneyEvent[];
  currency: string;
  showGroups?: boolean;
}) {
  if (events.length === 0) {
    return <EmptyState title="No upcoming events" description="Add income, bills, cards, or loans from setup." />;
  }

  const rows = showGroups
    ? events.flatMap((event, index) => {
      const previous = events[index - 1];
      const shouldShowGroup = event.groupTitle && previous?.groupTitle !== event.groupTitle;
      return shouldShowGroup
        ? [{ type: "group" as const, id: `group-${event.groupTitle}`, title: event.groupTitle }, { type: "event" as const, event }]
        : [{ type: "event" as const, event }];
    })
    : events.map((event) => ({ type: "event" as const, event }));

  return (
    <div className="fc-event-table">
      <div className="fc-event-table__head">
        <span>Date</span>
        <span>Type</span>
        <span>Title</span>
        <span>Amount</span>
        <span>Account</span>
        <span>Status</span>
        <span>Action</span>
      </div>
      {rows.map((row) => {
        if (row.type === "group") {
          return <div key={row.id} className="fc-event-group">{row.title}</div>;
        }

        const event = row.event;
        return (
          <div key={event.id} className="fc-event-row">
            <span>{event.dateLabel}</span>
            <span className={`fc-event-type fc-event-type--${event.type}`}>{event.type}</span>
            <strong>{event.title}</strong>
            <span className={event.tone === "positive" ? "fc-money-positive" : event.tone === "negative" ? "fc-money-negative" : ""}>
              {formatMinorCurrency(event.amountMinor, currency)}
            </span>
            <span>{event.accountName}</span>
            <span className={`fc-status fc-status--${event.tone}`}>{event.status}</span>
            {event.onAction ? (
              <button className="button button--ghost button--small" type="button" onClick={event.onAction}>{event.actionLabel}</button>
            ) : (
              <span className="fc-event-action-muted">{event.actionLabel}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
