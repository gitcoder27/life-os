# Review History and Long-Term Reflection Frontend Prompt

You are editing the frontend of the Life OS repository.

Use the repository's frontend implementation workflow and the strongest available frontend design skill. The backend for review history is already implemented and should be treated as the source of truth.

## Objective

Implement a dedicated review-history experience that turns submitted reviews into a usable long-term reflection system.

This is not a form-editing task. The goal is to help users:
- browse past daily, weekly, and monthly reviews
- search for past reflections
- compare recent weekly and monthly periods
- spot recurring friction patterns
- open any archived review in the existing read-only review snapshot flow

## Repository context

- Frontend stack: React + TypeScript + Vite in `client/`
- Existing review UI lives primarily in:
  - `client/src/features/reviews/ReviewsPage.tsx`
  - `client/src/shared/lib/api.ts`
  - `client/src/app/router.tsx`
  - `client/src/styles.css`
- Shared contracts are in `packages/contracts/`
- The app already has:
  - current-period daily / weekly / monthly review flows
  - locked submitted weekly/monthly snapshot states
  - review timing banner behavior
- Preserve the Life OS visual language, but make the history experience feel more like a durable reflection ledger than another plain CRUD page

## Editable paths

- `client/src/features/reviews/**`
- `client/src/shared/lib/api.ts`
- `client/src/app/router.tsx`
- `client/src/styles.css`
- `client/src/app/shell/**` only if needed for review-area navigation polish

## Do not touch

- `server/`
- Prisma schema or migrations
- `packages/contracts/` unless the frontend compile absolutely requires consuming newly added shared types directly
- unrelated goal / habits / planning work already in progress

## Backend contract now available

### New endpoint

`GET /api/reviews/history`

### Query params

- `cadence?: "all" | "daily" | "weekly" | "monthly"`
- `range?: "30d" | "90d" | "365d" | "all"`
- `q?: string`
- `cursor?: string`
- `limit?: number`

Defaults used server-side:
- `cadence = "all"`
- `range = "90d"`
- `limit = 30`

### Response shape

```ts
type ReviewHistoryCadence = "daily" | "weekly" | "monthly";

type ReviewHistoryMetric = {
  key: string;
  label: string;
  value: number | string | null;
  valueLabel: string;
};

type ReviewHistoryItem = {
  id: string;
  cadence: ReviewHistoryCadence;
  periodStart: string;
  periodEnd: string;
  completedAt: string;
  primaryText: string;
  secondaryText: string | null;
  metrics: ReviewHistoryMetric[];
  frictionTags: Array<
    | "low energy"
    | "poor planning"
    | "distraction"
    | "interruptions"
    | "overcommitment"
    | "avoidance"
    | "unclear task"
    | "travel or schedule disruption"
  >;
  route: string;
};

type ReviewHistorySummary = {
  totalReviews: number;
  countsByCadence: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  topFrictionTags: Array<{
    tag:
      | "low energy"
      | "poor planning"
      | "distraction"
      | "interruptions"
      | "overcommitment"
      | "avoidance"
      | "unclear task"
      | "travel or schedule disruption";
    count: number;
  }>;
};

type WeeklyReviewHistoryTrendPoint = {
  startDate: string;
  endDate: string;
  averageDailyScore: number;
  habitCompletionRate: number;
  strongDayCount: number;
};

type MonthlyReviewHistoryTrendPoint = {
  startDate: string;
  endDate: string;
  averageWeeklyMomentum: number;
  waterSuccessRate: number;
  workoutCount: number;
};

type ReviewHistoryResponse = {
  items: ReviewHistoryItem[];
  nextCursor: string | null;
  summary: ReviewHistorySummary;
  weeklyTrend: WeeklyReviewHistoryTrendPoint[];
  monthlyTrend: MonthlyReviewHistoryTrendPoint[];
  comparisons: {
    weekly:
      | {
          currentPeriodStart: string;
          currentPeriodEnd: string;
          previousPeriodStart: string;
          previousPeriodEnd: string;
          currentLabel: string;
          previousLabel: string;
          currentText: string;
          previousText: string;
          metrics: {
            current: {
              averageDailyScore: number;
              habitCompletionRate: number;
              strongDayCount: number;
            };
            previous: {
              averageDailyScore: number;
              habitCompletionRate: number;
              strongDayCount: number;
            };
            delta: {
              averageDailyScore: number;
              habitCompletionRate: number;
              strongDayCount: number;
            };
          };
        }
      | null;
    monthly:
      | {
          currentPeriodStart: string;
          currentPeriodEnd: string;
          previousPeriodStart: string;
          previousPeriodEnd: string;
          currentLabel: string;
          previousLabel: string;
          currentText: string;
          previousText: string;
          metrics: {
            current: {
              averageWeeklyMomentum: number;
              waterSuccessRate: number;
              workoutCount: number;
            };
            previous: {
              averageWeeklyMomentum: number;
              waterSuccessRate: number;
              workoutCount: number;
            };
            delta: {
              averageWeeklyMomentum: number;
              waterSuccessRate: number;
              workoutCount: number;
            };
          };
        }
      | null;
  };
  generatedAt: string;
};
```

### Important backend behavior

- `summary` is based on the filtered result set.
- `weeklyTrend`, `monthlyTrend`, and `comparisons` are based on cadence/range filtering, not on free-text search narrowing.
- `nextCursor` is opaque. Treat it as an opaque pagination token only.
- `item.route` already points to the existing review detail route, for example:
  - `/reviews/daily?date=2026-03-18`
  - `/reviews/weekly?date=2026-03-09`
  - `/reviews/monthly?date=2026-02-01`

## Target frontend behavior

### Information architecture

- Keep the existing current-review flow at `/reviews/:cadence`.
- Add a dedicated history route at `/reviews/history`.
- Inside the reviews area, add a local reviews sub-navigation with:
  - `Current review`
  - `History`
- Do not replace the existing sidebar `Reviews` nav destination. It should continue to behave as today for current review work.

### History page responsibilities

The new history page should have four functional layers:

1. A strong page-level frame for long-term reflection.
2. A summary / pattern snapshot section powered by `response.summary`.
3. A searchable, filterable archive timeline powered by `response.items`.
4. A comparison / trends area powered by `weeklyTrend`, `monthlyTrend`, and `comparisons`.

### URL state

Persist history controls in the URL:

- `cadence`
- `range`
- `q`

Use `cursor` only for pagination requests. It does not need to remain visible in a polished way once results append, but the implementation should not break deep-linking or back/forward navigation.

### Filter defaults

On first load, default to:

- `cadence=all`
- `range=90d`
- empty search

### Archive timeline behavior

- Show reverse-chronological items.
- Support mixed cadence browsing in one feed.
- Make cadence instantly scannable.
- Use `primaryText` as the main archive headline.
- Use `secondaryText` as supporting context when present.
- Render `metrics` as compact high-signal chips / rows / statlets.
- Render `frictionTags` as pattern markers, not as dominant decoration.
- Each item must expose a clear action to open the existing review snapshot using `item.route`.
- If `nextCursor` is present, show a `Load more` interaction that appends older items.

### Search behavior

- Search should feel fast and lightweight.
- Debounced input is acceptable if implemented cleanly.
- Searching should update the archive result set and summary state.
- Do not recompute client-side trend logic from searched results; trust the backend response.

### Comparison and trend behavior

- Weekly and monthly insights should feel distinct from the archive list.
- Weekly trend should visualize:
  - average daily score
  - habit completion rate
  - strong day count
- Monthly trend should visualize:
  - average weekly momentum
  - water success rate
  - workout count
- Comparison blocks should surface:
  - current vs previous period label
  - delta values
  - current reflection text vs previous reflection text
- If a comparison is `null`, render an explicit “not enough history yet” state.
- If a trend array is empty, render an intentional empty state, not a broken chart shell.

## Design direction

Let the frontend design expert choose the final visual system, but the page should feel:

- reflective, not administrative
- high-signal, not dashboard clutter
- durable, not ephemeral
- intentional on desktop and mobile

Strong directions that fit this feature:
- reflection ledger
- pattern observatory
- personal operating record

Avoid:
- a generic table-only archive
- grey disabled form aesthetics
- over-carded UI with weak hierarchy
- analytics chrome that feels more like finance software than personal reflection

## Interaction and UX expectations

- Preserve accessibility and readable contrast.
- Make cadence filters clearly stateful.
- Make empty states helpful:
  - no review history yet
  - no matches for current filters
  - not enough data for comparisons
- The page should still be useful with:
  - only daily reviews
  - only weekly reviews
  - only monthly reviews
  - very sparse history

## Data wiring expectations

- Add a dedicated review-history query in `client/src/shared/lib/api.ts`.
- Reuse the app’s existing React Query patterns.
- Keep request parameter handling centralized and predictable.
- Use `item.route` from the backend as the navigation source of truth for archive items.
- Do not recreate server comparison logic in the client.

## Non-goals

- Do not change backend behavior.
- Do not add draft saving.
- Do not add editing or revision history for submitted reviews.
- Do not redesign the current review forms unless a very small shared reviews-area navigation adjustment is necessary.
- Do not introduce AI-generated reflection summaries.

## Acceptance criteria

- `/reviews/history` exists and loads history from the backend.
- The reviews area exposes a clear `History` entry without breaking current review flows.
- Users can filter by cadence and range.
- Users can search archived reflections.
- Users can load additional archive items when `nextCursor` is present.
- Users can open any archived review snapshot using the archive item CTA.
- Summary, trends, and comparisons render correctly from the backend payload.
- Empty and sparse-data states are intentional and legible.
- The page is responsive and visually polished.

## Validation

- `cd client && npm run typecheck`
- `cd client && npm run build`

## Deliverables

- Apply the frontend changes directly.
- At the end, list the files changed.
- Summarize any follow-up risks in 3 bullets or fewer.
