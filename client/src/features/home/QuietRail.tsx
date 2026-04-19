import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getQuickCaptureDisplayText } from "../../shared/lib/quickCapture";
import type {
  HomeAction,
  HomeAttentionItem,
  LinkedGoal,
  TaskItem,
} from "../../shared/lib/api";
import { resolveHomeActionTarget } from "../../shared/lib/homeNavigation";

type RadarItem = {
  id: string;
  kind: "overdue_task" | "stale_inbox";
  title: string;
  label: string;
  notes: string | null;
  taskKind: TaskItem["kind"];
  reminderAt: string | null;
};

type AttentionItem = {
  id: HomeAttentionItem["id"];
  title: HomeAttentionItem["title"];
  detail?: HomeAttentionItem["detail"];
  kind: HomeAttentionItem["kind"];
  tone: HomeAttentionItem["tone"];
  dismissible?: HomeAttentionItem["dismissible"];
  action: HomeAction;
};

type InboxItem = {
  id: string;
  title: string;
  kind: "task" | "note" | "reminder";
  notes: string | null;
  reminderAt: string | null;
  originType: string;
};

type Priority = {
  id: string;
  slot: 1 | 2 | 3;
  title: string;
  status: "pending" | "completed" | "dropped";
  goal: LinkedGoal | null;
};

type QuietRailProps = {
  sessionKey: string;
  radarItems: RadarItem[];
  attentionItems: AttentionItem[];
  overdueCount: number;
  staleInboxCount: number;
  priorities: Priority[];
  openTaskCount: number;
  inboxItems: InboxItem[];
  inboxHasMore: boolean;
};

function radarRoute(kind: "overdue_task" | "stale_inbox", itemId?: string) {
  if (kind === "stale_inbox") return "/inbox";
  return itemId
    ? `/today?view=overdue&taskId=${encodeURIComponent(itemId)}`
    : "/today?view=overdue";
}

function formatInboxPreview(item: InboxItem) {
  const text = getQuickCaptureDisplayText(item, item.title).replace(/\s+/g, " ").trim();
  return text.length > 72 ? `${text.slice(0, 71).trimEnd()}…` : text;
}

export function QuietRail({
  sessionKey,
  radarItems,
  attentionItems,
  overdueCount,
  staleInboxCount,
  priorities,
  openTaskCount,
  inboxItems,
  inboxHasMore,
}: QuietRailProps) {
  const storageKey = `home-warning-dismissals:${sessionKey}`;
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      setDismissedIds(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setDismissedIds([]);
    } finally {
      setHasLoaded(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !hasLoaded) return;
    window.sessionStorage.setItem(storageKey, JSON.stringify(dismissedIds));
  }, [dismissedIds, hasLoaded, storageKey]);

  const visibleAttentionItems = useMemo(
    () => attentionItems.filter((item) => !item.dismissible || !dismissedIds.includes(item.id)),
    [attentionItems, dismissedIds],
  );

  const completedPriorities = priorities.filter((p) => p.status === "completed").length;

  return (
    <aside className="quiet-rail" aria-label="Quiet rail">
      <AtRiskSection
        overdueCount={overdueCount}
        staleInboxCount={staleInboxCount}
        radarItems={radarItems}
        attentionItems={visibleAttentionItems}
        onDismiss={(id) =>
          setDismissedIds((current) => (current.includes(id) ? current : [...current, id]))
        }
      />

      <TodaySection
        priorities={priorities}
        completed={completedPriorities}
        openTaskCount={openTaskCount}
      />

      <InboxSection
        inboxItems={inboxItems}
        inboxHasMore={inboxHasMore}
      />
    </aside>
  );
}

/* ──────────────────────────────────────────
   At risk
   ────────────────────────────────────────── */

function AtRiskSection({
  overdueCount,
  staleInboxCount,
  radarItems,
  attentionItems,
  onDismiss,
}: {
  overdueCount: number;
  staleInboxCount: number;
  radarItems: RadarItem[];
  attentionItems: AttentionItem[];
  onDismiss: (id: string) => void;
}) {
  const total = overdueCount + staleInboxCount + attentionItems.length;
  const isClear = total === 0;

  return (
    <section className={`rail-block rail-block--at-risk${isClear ? " rail-block--clear" : ""}`}>
      <div className="rail-block__head">
        <span className="rail-block__label">At risk</span>
        <span className={`rail-block__meta${isClear ? " rail-block__meta--clear" : ""}`}>
          {isClear ? "All clear" : total}
        </span>
      </div>

      {isClear ? (
        <p className="rail-block__text">
          Nothing overdue. Inbox is current.
        </p>
      ) : (
        <>
          <ul className="rail-list">
            {radarItems.slice(0, 3).map((item) => (
              <li key={item.id} className="rail-list__item">
                <Link
                  to={radarRoute(item.kind, item.id)}
                  className="rail-list__link"
                >
                  <span className="rail-list__title">
                    {item.kind === "stale_inbox"
                      ? getQuickCaptureDisplayText(
                          { kind: item.taskKind, notes: item.notes, reminderAt: item.reminderAt },
                          item.title,
                        )
                      : item.title}
                  </span>
                  <span className="rail-list__detail">{item.label}</span>
                </Link>
              </li>
            ))}

            {attentionItems.slice(0, 3).map((item) => {
              const target = resolveHomeActionTarget(item.action);
              return (
                <li key={item.id} className="rail-list__item">
                  <Link
                    to={target.to}
                    state={target.state}
                    className={`rail-list__link rail-list__link--${item.tone}`}
                  >
                    <span className="rail-list__title">{item.title}</span>
                    {item.detail ? (
                      <span className="rail-list__detail">{item.detail}</span>
                    ) : null}
                  </Link>
                  {item.dismissible ? (
                    <button
                      className="rail-list__dismiss"
                      type="button"
                      aria-label={`Dismiss ${item.title}`}
                      onClick={() => onDismiss(item.id)}
                    >
                      ×
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <div className="rail-block__foot">
            {overdueCount > 0 ? (
              <Link to="/today?view=overdue" className="rail-block__link">
                {overdueCount} overdue
              </Link>
            ) : null}
            {staleInboxCount > 0 ? (
              <Link to="/inbox" className="rail-block__link">
                {staleInboxCount} stale inbox
              </Link>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

/* ──────────────────────────────────────────
   Today
   ────────────────────────────────────────── */

function TodaySection({
  priorities,
  completed,
  openTaskCount,
}: {
  priorities: Priority[];
  completed: number;
  openTaskCount: number;
}) {
  const hasPriorities = priorities.length > 0;
  const hasTasks = openTaskCount > 0;

  if (!hasPriorities && !hasTasks) {
    return (
      <section className="rail-block rail-block--today">
        <div className="rail-block__head">
          <span className="rail-block__label">Today</span>
          <Link to="/today" className="rail-block__meta-link">
            Open
          </Link>
        </div>
        <p className="rail-block__text">
          Nothing scheduled. Set priorities when you&apos;re ready.
        </p>
      </section>
    );
  }

  return (
    <section className="rail-block rail-block--today">
      <div className="rail-block__head">
        <span className="rail-block__label">Today</span>
        {hasPriorities ? (
          <span className="rail-block__meta">
            {completed}/{priorities.length}
          </span>
        ) : (
          <Link to="/today" className="rail-block__meta-link">
            Open
          </Link>
        )}
      </div>

      {hasPriorities ? (
        <ul className="rail-list rail-list--priorities">
          {priorities.map((p) => (
            <li
              key={p.id}
              className={`rail-priority${p.status !== "pending" ? ` rail-priority--${p.status}` : ""}`}
            >
              <span className="rail-priority__slot">{p.slot}</span>
              <span className="rail-priority__title">{p.title}</span>
              {p.status === "completed" ? (
                <span className="rail-priority__mark" aria-label="Completed">✓</span>
              ) : p.status === "dropped" ? (
                <span className="rail-priority__mark" aria-label="Dropped">–</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rail-block__text">
          No priorities set yet.
        </p>
      )}

      {openTaskCount > 0 && hasPriorities ? (
        <Link to="/today" className="rail-block__foot-link">
          + {openTaskCount} more task{openTaskCount !== 1 ? "s" : ""}
        </Link>
      ) : null}
    </section>
  );
}

/* ──────────────────────────────────────────
   Inbox
   ────────────────────────────────────────── */

function InboxSection({
  inboxItems,
  inboxHasMore,
}: {
  inboxItems: InboxItem[];
  inboxHasMore: boolean;
}) {
  const hasInbox = inboxItems.length > 0;

  if (!hasInbox) {
    return (
      <section className="rail-block rail-block--inbox">
        <div className="rail-block__head">
          <span className="rail-block__label">Inbox</span>
          <span className="rail-block__meta rail-block__meta--clear">Clear</span>
        </div>
        <p className="rail-block__text">
          Inbox is empty. Captures appear here.
        </p>
      </section>
    );
  }

  const preview = inboxItems[0];

  return (
    <section className="rail-block rail-block--inbox">
      <div className="rail-block__head">
        <span className="rail-block__label">Inbox</span>
        <span className="rail-block__meta">
          {inboxItems.length}
          {inboxHasMore ? "+" : ""}
        </span>
      </div>

      <Link to="/inbox" className="rail-inbox-preview">
        <span className="rail-inbox-preview__text">{formatInboxPreview(preview)}</span>
        <span className="rail-inbox-preview__detail">
          {inboxItems.length === 1
            ? "1 waiting for triage"
            : `${inboxItems.length}${inboxHasMore ? "+" : ""} waiting for triage`}
        </span>
      </Link>
    </section>
  );
}
