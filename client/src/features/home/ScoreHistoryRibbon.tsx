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

function formatTooltipMeta(entry: ScoreHistoryDay) {
  if (entry.value === null) {
    return entry.isToday ? "Live today" : "Unscored";
  }

  return entry.finalized ? entry.label : `Live · ${entry.label}`;
}

function getTooltipAlign(index: number, total: number) {
  if (index <= 1) {
    return "left";
  }

  if (index >= total - 2) {
    return "right";
  }

  return "center";
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
        ? entries.map((entry, index) => {
            const align = getTooltipAlign(index, entries.length);

            return (
              <span
                key={entry.date}
                className="status-history-ribbon__day-wrap"
                data-align={align}
                data-size={size}
                style={{ "--history-index": index } as CSSProperties}
              >
              <span
                className="status-history-ribbon__tooltip"
                role="presentation"
              >
                <span className="status-history-ribbon__tooltip-date">
                  {entry.isToday ? "Today" : entry.date}
                </span>
                <span className="status-history-ribbon__tooltip-score">
                  {entry.value ?? "—"}
                </span>
                <span className="status-history-ribbon__tooltip-meta">
                  {formatTooltipMeta(entry)}
                </span>
              </span>
              <span
                className="status-history-ribbon__day"
                data-tone={getDayTone(entry)}
                data-today={entry.isToday}
                data-finalized={entry.finalized}
                aria-label={formatDayTitle(entry)}
              />
              </span>
            );
          })
        : placeholders.map((placeholder) => (
            <span
              key={placeholder.key}
              className="status-history-ribbon__day-wrap"
              data-size={size}
              style={{ "--history-index": placeholder.index } as CSSProperties}
            >
              <span
                className="status-history-ribbon__day"
                data-tone="empty"
                data-placeholder="true"
                aria-hidden="true"
              />
            </span>
          ))}
    </div>
  );
}
