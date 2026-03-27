import type { PropsWithChildren, ReactNode } from "react";
import { Link } from "react-router-dom";

import type { LinkedGoal } from "../../shared/lib/api";
import { ScoreRing } from "../../shared/ui/ScoreRing";

export type HomeKeyStat = {
  label: string;
  value: string;
  detail?: string;
};

export type HomeAttentionEntry = {
  id: string;
  title: string;
  detail: string;
  route: string;
  actionLabel: string;
  tone: "info" | "warning" | "urgent";
  badge?: string;
};

export type HomeSignalEntry = {
  id: string;
  label: string;
  value: string;
  detail: string;
  route: string;
  actionLabel: string;
  tone?: "default" | "positive" | "warning";
};

type HomePanelProps = PropsWithChildren<{
  eyebrow: string;
  title: string;
  subtitle?: string;
  className?: string;
  action?: ReactNode;
}>;

export function HomePanel({
  action,
  children,
  className,
  eyebrow,
  subtitle,
  title,
}: HomePanelProps) {
  return (
    <section className={className ? `home-panel ${className}` : "home-panel"}>
      <div className="home-panel__header">
        <div>
          <p className="home-panel__eyebrow">{eyebrow}</p>
          <h2 className="home-panel__title">{title}</h2>
          {subtitle ? <p className="home-panel__subtitle">{subtitle}</p> : null}
        </div>
        {action ? <div className="home-panel__action">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function DayStatusPanel({
  detail,
  metrics,
  scoreCopy,
  scoreDetail,
  scoreLabel,
  scoreValue,
}: {
  detail?: string;
  metrics: HomeKeyStat[];
  scoreCopy: string;
  scoreDetail?: string;
  scoreLabel: string;
  scoreValue: number;
}) {
  return (
    <div className="home-status">
      <div className="home-status__ring">
        <ScoreRing value={scoreValue} label={scoreLabel} size={116} />
      </div>
      <div className="home-status__content">
        <div className="home-status__heading">
          <p className="home-status__score-label">{scoreLabel}</p>
          <p className="home-status__copy">{scoreCopy}</p>
          {scoreDetail ? <p className="home-status__detail">{scoreDetail}</p> : null}
          {detail ? <p className="home-status__note">{detail}</p> : null}
        </div>
        <HomeKeyStatList items={metrics} compact />
      </div>
    </div>
  );
}

export function HomeKeyStatList({
  compact = false,
  items,
}: {
  compact?: boolean;
  items: HomeKeyStat[];
}) {
  return (
    <div className={compact ? "home-key-stats home-key-stats--compact" : "home-key-stats"}>
      {items.map((item) => (
        <div key={item.label} className="home-key-stats__item">
          <span className="home-key-stats__label">{item.label}</span>
          <strong className="home-key-stats__value">{item.value}</strong>
          {item.detail ? <span className="home-key-stats__detail">{item.detail}</span> : null}
        </div>
      ))}
    </div>
  );
}

export function GoalChip({ goal }: { goal: LinkedGoal }) {
  return (
    <Link to="/goals" className="goal-chip">
      <span className={`goal-chip__dot goal-chip__dot--${goal.domain}`} />
      <span>{goal.title}</span>
    </Link>
  );
}

export function HomeAttentionList({
  items,
  overflowCount,
}: {
  items: HomeAttentionEntry[];
  overflowCount: number;
}) {
  if (items.length === 0) {
    return (
      <div className="home-empty-state">
        <p className="home-empty-state__title">Nothing is pressing right now.</p>
        <p className="home-empty-state__copy">
          Home is clear. Move into Today when you want to work the next meaningful step.
        </p>
      </div>
    );
  }

  return (
    <div className="home-action-list">
      {items.map((item) => (
        <div
          key={item.id}
          className={`home-action-list__item home-action-list__item--${item.tone}`}
        >
          <div className="home-action-list__body">
            {item.badge ? <span className="home-action-list__badge">{item.badge}</span> : null}
            <div className="home-action-list__title">{item.title}</div>
            <div className="home-action-list__detail">{item.detail}</div>
          </div>
          <Link className="home-inline-link" to={item.route}>
            {item.actionLabel}
          </Link>
        </div>
      ))}
      {overflowCount > 0 ? (
        <p className="home-overflow-note">
          {overflowCount} more item{overflowCount === 1 ? "" : "s"} remain in the queue.
        </p>
      ) : null}
    </div>
  );
}

export function HomeSignalRows({ items }: { items: HomeSignalEntry[] }) {
  return (
    <div className="home-signal-list">
      {items.map((item) => (
        <Link
          key={item.id}
          className={`home-signal-row home-signal-row--${item.tone ?? "default"}`}
          to={item.route}
        >
          <div className="home-signal-row__main">
            <span className="home-signal-row__label">{item.label}</span>
            <span className="home-signal-row__value">{item.value}</span>
          </div>
          <div className="home-signal-row__detail">{item.detail}</div>
          <span className="home-signal-row__action">{item.actionLabel}</span>
        </Link>
      ))}
    </div>
  );
}
