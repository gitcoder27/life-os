# Weekly/Monthly Review Lock Frontend Prompt

You are editing the frontend of the Life OS repository.

Use the repository's frontend implementation workflow and, if available in your environment, use both the frontend execution skill and the frontend design skill. The backend work for this feature is already complete and should be treated as the source of truth.

## Objective

Implement a polished locked-state experience for weekly and monthly reviews so submitted periods are no longer editable in the UI. Locked periods must render as read-only historical snapshots with the generated summary and the seeded planning outputs that were produced by that review.

## Repository context

- Frontend stack: React + TypeScript + Vite in `client/`
- Shared contracts exist in `packages/contracts/`, but this frontend currently uses local API response typings in `client/src/shared/lib/api.ts`
- Review UI lives primarily in:
  - `client/src/features/reviews/ReviewsPage.tsx`
  - `client/src/features/reviews/reviewWindowModel.ts`
  - `client/src/features/reviews/ReviewWindowBanner.tsx`
  - `client/src/shared/lib/api.ts`
  - `client/src/styles.css`
- The daily review flow already has a useful read-only closed state. Weekly/monthly should reach parity in behavior, but not by copying the exact layout mechanically

## Editable paths

- `client/src/features/reviews/**`
- `client/src/shared/lib/api.ts`
- `client/src/styles.css`

## Do not touch

- `server/`
- `packages/contracts/`
- Prisma schema or migrations
- Unrelated routes, pages, or app-wide refactors

## Backend contract you can rely on

This backend behavior is implemented and verified already.

### Error behavior

- `POST /api/reviews/weekly/:startDate`
  - returns `409` with code `REVIEW_ALREADY_SUBMITTED` if the weekly review for that period already exists
- `POST /api/reviews/monthly/:startDate`
  - returns `409` with code `REVIEW_ALREADY_SUBMITTED` if the monthly review for that period already exists
- Existing out-of-window behavior still applies through `REVIEW_OUT_OF_WINDOW`

### Weekly GET response additions

`GET /api/reviews/weekly/:startDate` now includes:

```ts
seededNextWeekPriorities: Array<{
  id: string;
  slot: 1 | 2 | 3;
  title: string;
  status: "pending" | "completed" | "dropped";
  goalId: string | null;
  completedAt: string | null;
}>
```

### Monthly GET response additions

`GET /api/reviews/monthly/:startDate` now includes:

```ts
seededNextMonthTheme: string | null;
seededNextMonthOutcomes: Array<{
  id: string;
  slot: 1 | 2 | 3;
  title: string;
  status: "pending" | "completed" | "dropped";
  goalId: string | null;
  completedAt: string | null;
}>
```

## Current behavior

- Weekly and monthly reviews load `existingReview` values into editable textareas
- The page still presents those periods as submittable forms
- The submit button remains visible whenever the time window is open
- If a user reopens an old submitted weekly/monthly review during an allowed period, the UI implies it can be edited and resubmitted
- There is no read-only historical snapshot for weekly/monthly periods
- There is no UI handling for `REVIEW_ALREADY_SUBMITTED`

## Target behavior

### Core locking behavior

- If `review.existingReview` is present for weekly or monthly cadence, treat the period as locked/final
- Locked weekly/monthly periods must not show editable prompt textareas
- Locked weekly/monthly periods must not show the submit button
- Locked weekly/monthly periods must render a read-only snapshot

### Weekly locked snapshot

- Keep the generated summary card visible
- Replace the editable prompts card with a read-only submitted review card that shows:
  - biggest win
  - biggest miss
  - main lesson
  - keep text
  - improve text
  - focus habit selection if present
  - notes if present
  - completed timestamp
- Add a seeded outputs card showing `seededNextWeekPriorities`
- If there are no seeded priorities, show an explicit empty state rather than omitting the section

### Monthly locked snapshot

- Keep the generated summary card visible
- Replace the editable prompts card with a read-only submitted review card that shows:
  - month verdict
  - biggest win
  - biggest leak
  - next month theme
  - three outcomes
  - habit changes
  - simplify text
  - notes if present
  - completed timestamp
- Add a seeded outputs card showing:
  - `seededNextMonthTheme`
  - `seededNextMonthOutcomes`
- If seeded theme or outcomes are missing, show explicit empty/fallback copy

### Submit-race behavior

- If the user attempts to submit and the API responds with `REVIEW_ALREADY_SUBMITTED`, do not leave the page in a generic error state
- Instead:
  - surface a concise inline message that the period is already locked
  - refetch the review query
  - transition the page into the locked snapshot state

### Non-goals

- Do not add draft saving
- Do not add revision history
- Do not add admin override controls
- Do not change daily review behavior except where shared code cleanup is necessary

## UX and design direction

Design this as a durable historical record, not as a disabled form.

- Preserve the existing review-shell structure and tone of the app
- Make locked states feel intentional and trustworthy
- Prefer clear sectioning over large walls of text
- Distinguish auto-generated summary from submitted reflection from seeded outputs
- Use typography, spacing, labels, and status treatments to make the timeline obvious
- Include a visible closed/final indicator for locked weekly/monthly periods
- Completed timestamp should be present but secondary, not dominant
- Avoid generic greyed-out disabled-form aesthetics
- Keep it responsive and legible on mobile
- Preserve accessibility:
  - semantic headings where appropriate
  - readable contrast
  - no state conveyed by color alone

## Implementation notes

- Update the local response typings in `client/src/shared/lib/api.ts` for:
  - `REVIEW_ALREADY_SUBMITTED` handling via `ApiClientError.code`
  - weekly `seededNextWeekPriorities`
  - monthly `seededNextMonthTheme`
  - monthly `seededNextMonthOutcomes`
- In `ReviewsPage.tsx`, derive locked state for weekly/monthly from `existingReview`
- Do not rely on `submissionWindow.isOpen` alone to decide whether weekly/monthly are editable
- Preserve current daily behavior and current review-window banner behavior
- Add a small helper for lock-error detection if that keeps the page logic cleaner
- Keep the code localized; avoid broad refactors

## Acceptance criteria

- Visiting a previously submitted weekly review shows a read-only snapshot, not editable inputs
- Visiting a previously submitted monthly review shows a read-only snapshot, not editable inputs
- Weekly snapshot includes seeded next-week priorities from the backend payload
- Monthly snapshot includes seeded next-month theme and outcomes from the backend payload
- The submit button is absent for locked weekly/monthly periods
- A `REVIEW_ALREADY_SUBMITTED` submit race transitions into the locked snapshot state after refetch
- Out-of-window behavior still works as before
- Daily review behavior is unchanged

## Validation

- `cd client && npm run typecheck`
- `cd client && npm run build`

## Deliverables

- Apply the frontend code changes directly
- At the end, list the files changed
- Summarize any remaining risks or follow-up work in 3 bullets or fewer
