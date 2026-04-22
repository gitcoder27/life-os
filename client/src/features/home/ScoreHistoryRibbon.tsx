import type { CSSProperties } from "react";

import type { ScoreHistoryDay } from "../../shared/lib/api";

type ScoreHistoryRibbonProps = {
  entries: ScoreHistoryDay[] | null;
  size?: "compact" | "expanded";
  placeholderCount?: number;
  ariaLabel: string;
};

function getDayTone(entry: ScoreHistoryDay) {
  if (entry.value === null) {
    return "empty";
  }

  if (entry.value >= 85) {
    return "strong";
  }

  if (entry.value >= 70) {
    return "solid";
  }

  if (entry.value >= 55) {
    return "recovering";
  }

  return "off-track";
}

function formatDayTitle(entry: ScoreHistoryDay) {
  if (entry.value === null) {
    return entry.isToday
      ? `${entry.date}: Today is still in progress.`
      : `${entry.date}: No finalized score.`;
  }

  const suffix = entry.finalized ? entry.label : `Live ${entry.label}`;
  return `${entry.date}: ${entry.value} (${suffix})`;
}

export function ScoreHistoryRibbon({
  entries,
  size = "compact",
  placeholderCount = 0,
  ariaLabel,
}: ScoreHistoryRibbonProps) {
  const placeholders = entries
    ? []
    : Array.from({ length: placeholderCount }, (_, index) => ({
        key: `placeholder-${index}`,
        index,
      }));

  return (
    <div
      className={`status-history-ribbon status-history-ribbon--${size}${entries ? "" : " status-history-ribbon--placeholder"}`}
      role="img"
      aria-label={ariaLabel}
    >
      {entries
        ? entries.map((entry, index) => (
            <span
              key={entry.date}
              className="status-history-ribbon__day"
              data-tone={getDayTone(entry)}
              data-today={entry.isToday}
              data-finalized={entry.finalized}
              title={formatDayTitle(entry)}
              aria-hidden="true"
              style={{ "--history-index": index } as CSSProperties}
            />
          ))
        : placeholders.map((placeholder) => (
            <span
              key={placeholder.key}
              className="status-history-ribbon__day"
              data-tone="empty"
              data-placeholder="true"
              aria-hidden="true"
              style={{ "--history-index": placeholder.index } as CSSProperties}
            />
          ))}
    </div>
  );
}
