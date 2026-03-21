import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router-dom";

import {
  type MonthlyComparisonMetrics,
  type MonthlyReviewHistoryTrendPoint,
  type ReviewHistoryCadenceFilter,
  type ReviewHistoryItem,
  type ReviewHistoryPeriodComparison,
  type ReviewHistoryQueryParams,
  type ReviewHistoryRange,
  type ReviewHistoryResponse,
  type ReviewHistorySummary,
  type WeeklyComparisonMetrics,
  type WeeklyReviewHistoryTrendPoint,
  formatShortDate,
  useReviewHistoryQuery,
} from "../../shared/lib/api";
import { PageHeader } from "../../shared/ui/PageHeader";
import {
  EmptyState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";

/* ── Constants ──────────────────────────────────────────── */

const CADENCE_OPTIONS: Array<{ value: ReviewHistoryCadenceFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const RANGE_OPTIONS: Array<{ value: ReviewHistoryRange; label: string }> = [
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "365d", label: "1 year" },
  { value: "all", label: "All time" },
];

const CADENCE_ACCENT: Record<string, string> = {
  daily: "rh-cadence--daily",
  weekly: "rh-cadence--weekly",
  monthly: "rh-cadence--monthly",
};

const DEBOUNCE_MS = 350;

/* ── Helpers ─────────────────────────────────────────────── */

function formatPeriodRange(start: string, end: string) {
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}

function formatDelta(value: number, suffix = ""): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${typeof value === "number" && !Number.isInteger(value) ? value.toFixed(1) : value}${suffix}`;
}

function deltaClass(value: number): string {
  if (value > 0) return "rh-delta--positive";
  if (value < 0) return "rh-delta--negative";
  return "rh-delta--neutral";
}

/* ── Sub-Components ──────────────────────────────────────── */

function ReviewsSubNav() {
  return (
    <div className="rh-subnav">
      <NavLink
        to="/reviews/daily"
        className={({ isActive }) =>
          `rh-subnav__link ${isActive ? "rh-subnav__link--active" : ""}`
        }
        end
      >
        Current review
      </NavLink>
      <NavLink
        to="/reviews/history"
        className={({ isActive }) =>
          `rh-subnav__link ${isActive ? "rh-subnav__link--active" : ""}`
        }
      >
        History
      </NavLink>
    </div>
  );
}

function HistoryFilters({
  cadence,
  range,
  search,
  onCadenceChange,
  onRangeChange,
  onSearchChange,
}: {
  cadence: ReviewHistoryCadenceFilter;
  range: ReviewHistoryRange;
  search: string;
  onCadenceChange: (c: ReviewHistoryCadenceFilter) => void;
  onRangeChange: (r: ReviewHistoryRange) => void;
  onSearchChange: (q: string) => void;
}) {
  const [localSearch, setLocalSearch] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  function handleSearchInput(value: string) {
    setLocalSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearchChange(value), DEBOUNCE_MS);
  }

  return (
    <div className="rh-filters">
      <div className="rh-filters__cadence">
        {CADENCE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`rh-pill ${cadence === opt.value ? "rh-pill--active" : ""}`}
            onClick={() => onCadenceChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="rh-filters__controls">
        <select
          className="rh-select"
          value={range}
          onChange={(e) => onRangeChange(e.target.value as ReviewHistoryRange)}
        >
          {RANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <div className="rh-search">
          <svg className="rh-search__icon" viewBox="0 0 16 16" fill="none" width="14" height="14">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5L14.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            className="rh-search__input"
            type="text"
            placeholder="Search reflections…"
            value={localSearch}
            onChange={(e) => handleSearchInput(e.target.value)}
          />
          {localSearch && (
            <button
              type="button"
              className="rh-search__clear"
              onClick={() => handleSearchInput("")}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryStrip({ summary }: { summary: ReviewHistorySummary }) {
  return (
    <div className="rh-summary">
      <div className="rh-summary__counts">
        <div className="rh-summary__stat">
          <span className="rh-summary__stat-value">{summary.totalReviews}</span>
          <span className="rh-summary__stat-label">Reviews</span>
        </div>
        <div className="rh-summary__stat">
          <span className="rh-summary__stat-value rh-cadence--daily">{summary.countsByCadence.daily}</span>
          <span className="rh-summary__stat-label">Daily</span>
        </div>
        <div className="rh-summary__stat">
          <span className="rh-summary__stat-value rh-cadence--weekly">{summary.countsByCadence.weekly}</span>
          <span className="rh-summary__stat-label">Weekly</span>
        </div>
        <div className="rh-summary__stat">
          <span className="rh-summary__stat-value rh-cadence--monthly">{summary.countsByCadence.monthly}</span>
          <span className="rh-summary__stat-label">Monthly</span>
        </div>
      </div>

      {summary.topFrictionTags.length > 0 && (
        <div className="rh-summary__friction">
          <span className="rh-summary__friction-label">Recurring friction</span>
          <div className="rh-summary__friction-tags">
            {summary.topFrictionTags.slice(0, 4).map((entry) => (
              <span key={entry.tag} className="rh-friction-chip">
                {entry.tag}
                <span className="rh-friction-chip__count">{entry.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ArchiveItem({ item }: { item: ReviewHistoryItem }) {
  const navigate = useNavigate();

  return (
    <div className={`rh-entry ${CADENCE_ACCENT[item.cadence] ?? ""}`}>
      <div className="rh-entry__rail">
        <span className="rh-entry__cadence-dot" />
        <span className="rh-entry__cadence-label">{item.cadence}</span>
      </div>

      <div className="rh-entry__body">
        <div className="rh-entry__header">
          <span className="rh-entry__period">{formatPeriodRange(item.periodStart, item.periodEnd)}</span>
          <span className="rh-entry__completed">
            {formatShortDate(item.completedAt.slice(0, 10))}
          </span>
        </div>

        <p className="rh-entry__primary">{item.primaryText}</p>
        {item.secondaryText && (
          <p className="rh-entry__secondary">{item.secondaryText}</p>
        )}

        {item.metrics.length > 0 && (
          <div className="rh-entry__metrics">
            {item.metrics.map((m) => (
              <span key={m.key} className="rh-metric-chip">
                <span className="rh-metric-chip__label">{m.label}</span>
                <span className="rh-metric-chip__value">{m.valueLabel}</span>
              </span>
            ))}
          </div>
        )}

        {item.frictionTags.length > 0 && (
          <div className="rh-entry__friction">
            {item.frictionTags.map((tag) => (
              <span key={tag} className="rh-friction-marker">{tag}</span>
            ))}
          </div>
        )}

        <button
          type="button"
          className="rh-entry__open"
          onClick={() => navigate(item.route)}
        >
          Open review →
        </button>
      </div>
    </div>
  );
}

function ArchiveTimeline({
  items,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: {
  items: ReviewHistoryItem[];
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No reviews match"
        description="Try adjusting the cadence, range, or search filters."
      />
    );
  }

  return (
    <div className="rh-timeline">
      <div className="rh-timeline__list stagger">
        {items.map((item) => (
          <ArchiveItem key={item.id} item={item} />
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          className="rh-timeline__load-more"
          onClick={onLoadMore}
          disabled={isLoadingMore}
        >
          {isLoadingMore ? "Loading…" : "Load older reviews"}
        </button>
      )}
    </div>
  );
}

function TrendSection({
  weeklyTrend,
  monthlyTrend,
}: {
  weeklyTrend: WeeklyReviewHistoryTrendPoint[];
  monthlyTrend: MonthlyReviewHistoryTrendPoint[];
}) {
  if (weeklyTrend.length === 0 && monthlyTrend.length === 0) {
    return null;
  }

  return (
    <div className="rh-trends">
      <h3 className="rh-section-title">Trends</h3>
      <div className="rh-trends__grid">
        {weeklyTrend.length > 0 && (
          <div className="rh-trend-card">
            <div className="rh-trend-card__header">
              <span className="rh-trend-card__label">Weekly trend</span>
              <span className="rh-trend-card__range">
                {weeklyTrend.length} week{weeklyTrend.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="rh-sparkline-group">
              <SparklineRow
                label="Avg daily score"
                points={weeklyTrend.map((p) => p.averageDailyScore)}
                format={(v) => v.toFixed(1)}
              />
              <SparklineRow
                label="Habit completion"
                points={weeklyTrend.map((p) => p.habitCompletionRate)}
                format={(v) => `${Math.round(v)}%`}
              />
              <SparklineRow
                label="Strong days"
                points={weeklyTrend.map((p) => p.strongDayCount)}
                format={(v) => String(Math.round(v))}
              />
            </div>
          </div>
        )}

        {monthlyTrend.length > 0 && (
          <div className="rh-trend-card">
            <div className="rh-trend-card__header">
              <span className="rh-trend-card__label">Monthly trend</span>
              <span className="rh-trend-card__range">
                {monthlyTrend.length} month{monthlyTrend.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="rh-sparkline-group">
              <SparklineRow
                label="Weekly momentum"
                points={monthlyTrend.map((p) => p.averageWeeklyMomentum)}
                format={(v) => v.toFixed(1)}
              />
              <SparklineRow
                label="Water success"
                points={monthlyTrend.map((p) => p.waterSuccessRate)}
                format={(v) => `${Math.round(v)}%`}
              />
              <SparklineRow
                label="Workouts"
                points={monthlyTrend.map((p) => p.workoutCount)}
                format={(v) => String(Math.round(v))}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SparklineRow({
  label,
  points,
  format,
}: {
  label: string;
  points: number[];
  format: (v: number) => string;
}) {
  const max = Math.max(...points, 1);
  const latest = points[points.length - 1] ?? 0;

  return (
    <div className="rh-sparkline">
      <span className="rh-sparkline__label">{label}</span>
      <div className="rh-sparkline__bars">
        {points.map((value, i) => (
          <div
            key={i}
            className={`rh-sparkline__bar ${i === points.length - 1 ? "rh-sparkline__bar--current" : ""}`}
            style={{ height: `${Math.max((value / max) * 100, 4)}%` }}
            title={format(value)}
          />
        ))}
      </div>
      <span className="rh-sparkline__latest">{format(latest)}</span>
    </div>
  );
}

function ComparisonSection({
  comparisons,
}: {
  comparisons: ReviewHistoryResponse["comparisons"];
}) {
  if (!comparisons.weekly && !comparisons.monthly) {
    return null;
  }

  return (
    <div className="rh-comparisons">
      <h3 className="rh-section-title">Period comparison</h3>
      <div className="rh-comparisons__grid">
        {comparisons.weekly ? (
          <WeeklyComparison comparison={comparisons.weekly} />
        ) : (
          <ComparisonEmpty label="Weekly" />
        )}
        {comparisons.monthly ? (
          <MonthlyComparison comparison={comparisons.monthly} />
        ) : (
          <ComparisonEmpty label="Monthly" />
        )}
      </div>
    </div>
  );
}

function WeeklyComparison({
  comparison,
}: {
  comparison: ReviewHistoryPeriodComparison<WeeklyComparisonMetrics>;
}) {
  return (
    <div className="rh-compare-card">
      <div className="rh-compare-card__header">
        <span className="rh-compare-card__type rh-cadence--weekly">Weekly</span>
      </div>
      <div className="rh-compare-card__periods">
        <div className="rh-compare-period rh-compare-period--current">
          <span className="rh-compare-period__label">{comparison.currentLabel}</span>
          <p className="rh-compare-period__text">{comparison.currentText}</p>
        </div>
        <div className="rh-compare-period rh-compare-period--previous">
          <span className="rh-compare-period__label">{comparison.previousLabel}</span>
          <p className="rh-compare-period__text">{comparison.previousText}</p>
        </div>
      </div>
      <div className="rh-compare-card__deltas">
        <DeltaStat label="Avg score" value={comparison.metrics.delta.averageDailyScore} suffix="" />
        <DeltaStat label="Habit rate" value={comparison.metrics.delta.habitCompletionRate} suffix="%" />
        <DeltaStat label="Strong days" value={comparison.metrics.delta.strongDayCount} suffix="" />
      </div>
    </div>
  );
}

function MonthlyComparison({
  comparison,
}: {
  comparison: ReviewHistoryPeriodComparison<MonthlyComparisonMetrics>;
}) {
  return (
    <div className="rh-compare-card">
      <div className="rh-compare-card__header">
        <span className="rh-compare-card__type rh-cadence--monthly">Monthly</span>
      </div>
      <div className="rh-compare-card__periods">
        <div className="rh-compare-period rh-compare-period--current">
          <span className="rh-compare-period__label">{comparison.currentLabel}</span>
          <p className="rh-compare-period__text">{comparison.currentText}</p>
        </div>
        <div className="rh-compare-period rh-compare-period--previous">
          <span className="rh-compare-period__label">{comparison.previousLabel}</span>
          <p className="rh-compare-period__text">{comparison.previousText}</p>
        </div>
      </div>
      <div className="rh-compare-card__deltas">
        <DeltaStat label="Momentum" value={comparison.metrics.delta.averageWeeklyMomentum} suffix="" />
        <DeltaStat label="Water rate" value={comparison.metrics.delta.waterSuccessRate} suffix="%" />
        <DeltaStat label="Workouts" value={comparison.metrics.delta.workoutCount} suffix="" />
      </div>
    </div>
  );
}

function DeltaStat({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  return (
    <div className={`rh-delta-stat ${deltaClass(value)}`}>
      <span className="rh-delta-stat__value">{formatDelta(value, suffix)}</span>
      <span className="rh-delta-stat__label">{label}</span>
    </div>
  );
}

function ComparisonEmpty({ label }: { label: string }) {
  return (
    <div className="rh-compare-card rh-compare-card--empty">
      <div className="rh-compare-card__header">
        <span className="rh-compare-card__type">{label}</span>
      </div>
      <p className="rh-compare-card__empty-text">
        Not enough history yet for a {label.toLowerCase()} comparison. Complete more {label.toLowerCase()} reviews to see trends here.
      </p>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────── */

export function ReviewHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const cadence = (searchParams.get("cadence") ?? "all") as ReviewHistoryCadenceFilter;
  const range = (searchParams.get("range") ?? "90d") as ReviewHistoryRange;
  const search = searchParams.get("q") ?? "";

  const [allItems, setAllItems] = useState<ReviewHistoryItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const params: ReviewHistoryQueryParams = { cadence, range, q: search || undefined };
  const historyQuery = useReviewHistoryQuery(params);

  // When base params change, reset accumulated items
  const prevParamsRef = useRef("");
  const paramsKey = `${cadence}|${range}|${search}`;
  useEffect(() => {
    if (paramsKey !== prevParamsRef.current) {
      prevParamsRef.current = paramsKey;
      setAllItems([]);
      setCursor(null);
    }
  }, [paramsKey]);

  // When base query completes, set initial items
  useEffect(() => {
    if (historyQuery.data && !cursor) {
      setAllItems(historyQuery.data.items);
      setCursor(historyQuery.data.nextCursor);
    }
  }, [historyQuery.data, cursor]);

  const loadMoreQuery = useReviewHistoryQuery(
    cursor ? { ...params, cursor } : { ...params, cursor: "__disabled__" },
  );

  const handleLoadMore = useCallback(() => {
    if (!cursor || isLoadingMore) return;
    setIsLoadingMore(true);
  }, [cursor, isLoadingMore]);

  // When load-more completes, append items
  useEffect(() => {
    if (isLoadingMore && loadMoreQuery.data && loadMoreQuery.data !== historyQuery.data) {
      setAllItems((prev) => [...prev, ...loadMoreQuery.data!.items]);
      setCursor(loadMoreQuery.data.nextCursor);
      setIsLoadingMore(false);
    }
  }, [loadMoreQuery.data, isLoadingMore, historyQuery.data]);

  function updateParam(key: string, value: string, defaultValue: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === defaultValue) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      // Reset cursor on filter changes
      next.delete("cursor");
      return next;
    }, { replace: true });
    setAllItems([]);
    setCursor(null);
  }

  if (historyQuery.isLoading && !historyQuery.data) {
    return (
      <div className="page">
        <ReviewsSubNav />
        <PageLoadingState
          eyebrow="Review history"
          title="Loading your reflection archive"
          description="Pulling past reviews, trends, and comparison data."
        />
      </div>
    );
  }

  if (historyQuery.isError || !historyQuery.data) {
    return (
      <div className="page">
        <ReviewsSubNav />
        <PageErrorState
          title="Could not load review history"
          message={
            historyQuery.error instanceof Error
              ? historyQuery.error.message
              : undefined
          }
          onRetry={() => void historyQuery.refetch()}
        />
      </div>
    );
  }

  const data = historyQuery.data;
  const displayItems = allItems.length > 0 ? allItems : data.items;
  const hasMore = cursor !== null;

  const isEmpty = data.summary.totalReviews === 0 && !search;

  return (
    <div className="page">
      <ReviewsSubNav />

      <PageHeader
        eyebrow="Reflection archive"
        title="Review history"
        description="Browse past reflections, spot patterns, and compare periods. Your personal operating record."
      />

      {isEmpty ? (
        <EmptyState
          title="No reviews yet"
          description="Complete your first daily, weekly, or monthly review to start building your reflection history."
          actionLabel="Start a review"
          onAction={() => window.location.assign("/reviews/daily")}
        />
      ) : (
        <div className="rh-layout stagger">
          <SummaryStrip summary={data.summary} />

          <HistoryFilters
            cadence={cadence}
            range={range}
            search={search}
            onCadenceChange={(c) => updateParam("cadence", c, "all")}
            onRangeChange={(r) => updateParam("range", r, "90d")}
            onSearchChange={(q) => updateParam("q", q, "")}
          />

          <ArchiveTimeline
            items={displayItems}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore || loadMoreQuery.isFetching}
            onLoadMore={handleLoadMore}
          />

          <TrendSection
            weeklyTrend={data.weeklyTrend}
            monthlyTrend={data.monthlyTrend}
          />

          <ComparisonSection comparisons={data.comparisons} />
        </div>
      )}
    </div>
  );
}
