# Review submission window frontend prompt

You are editing the frontend of the Life OS repository through GitHub Copilot CLI.

Objective:
- Make review timing explicit and trustworthy in the review UX by consuming the new backend submission-window contract, guiding the user to the currently eligible review period, and presenting out-of-window states with strong visual clarity.

Repository context:
- Frontend stack: React + TypeScript + Vite in `client/`
- Shared contracts live in `packages/contracts/`
- Backend work for review-window enforcement is already implemented
- Review flows live under `client/src/features/reviews/`
- The current review screen already renders inline mutation errors and cadence-specific forms
- The product already has an established command-center / observatory feel; preserve that visual language rather than introducing a disconnected redesign

Editable paths:
- `client/src/features/reviews/**`
- `client/src/shared/lib/api.ts`
- `client/src/features/home/**` only if needed for CTA handling on the frontend side
- `client/src/features/notifications/**` only if needed for review deep-link handling
- `packages/contracts/src/reviews.ts` only if the frontend compile requires the latest shared shape

Do not touch:
- `server/`
- database schema
- unrelated files with existing dirty changes

Current behavior:
- `ReviewsPage` defaults to the current date when no `?date=` is present
- The page allows the user to fill the form and only learns about timing problems from backend mutation errors
- Daily, weekly, and monthly review pages do not present an authoritative “this review is open / not open” state
- The UI does not clearly distinguish “wrong period”, “too early”, “too late”, and “no open review window”
- Existing submit controls do not use backend-provided timing metadata because that contract did not exist before

Backend contract now available:
- `GET /api/reviews/daily/:date`
- `GET /api/reviews/weekly/:startDate`
- `GET /api/reviews/monthly/:startDate`
- Each review response now includes `submissionWindow` with:
  - `isOpen: boolean`
  - `status: "open" | "too_early" | "too_late" | "wrong_period" | "no_open_window"`
  - `requestedDate: string`
  - `allowedDate: string | null`
  - `opensAt: string | null`
  - `closesAt: string | null`
  - `timezone: string`
- Submit endpoints now reject invalid timing with `409` and code `REVIEW_OUT_OF_WINDOW`

Target behavior:
- Treat backend timing as authoritative. Do not recreate review-window business logic in the client.
- On initial load:
  - If the route has no explicit `?date=` and `submissionWindow.allowedDate` exists and differs from the currently loaded date, redirect to the allowed period immediately
  - Preserve the cadence route (`/reviews/daily`, `/reviews/weekly`, `/reviews/monthly`) and normalize the query date as needed
- On every review page:
  - Show a prominent review-window status banner near the top of the page
  - Banner copy must clearly explain:
    - what period is currently open
    - whether the loaded period is too early, too late, or currently closed
    - when the next relevant window opens/closes
    - which timezone governs the rule
- Submission behavior:
  - Disable submit when `submissionWindow.isOpen` is `false`
  - Keep server error handling in place as a fallback, and give `REVIEW_OUT_OF_WINDOW` errors a polished, specific presentation instead of raw generic failure styling
- Period switching:
  - If the user manually navigates to a historical or future review period, the page should remain readable, but visually mark it as read-only / not submittable for timing reasons
  - Preserve existing completed-review read states
- Daily specifics:
  - Make it obvious when the app is in “evening open window”, “next-morning grace”, or “closed until tonight”
  - If there is no open daily window, the UI should not feel broken; it should feel intentionally closed
- Weekly and monthly specifics:
  - Clarify that only the immediately previous week/month is submittable during the current week/month
  - Historical periods remain readable but not submittable

Design direction:
- Stay within the existing Life OS visual system, but make the review timing layer feel more precise and intentional
- Use a concrete design concept: `time-governed control room`
- Desired qualities:
  - high-signal, low-noise
  - authoritative without feeling punitive
  - temporal clarity over decorative flair
  - visually distinct states for `open`, `too_early`, `too_late`, and `no_open_window`
- Prefer a strong status treatment instead of a generic alert box:
  - consider structured chips, timestamp rows, countdown-like framing, or a timeline rail
  - make the active allowed period visually dominant
  - use typography and spacing to create hierarchy before adding color
- Preserve responsiveness and accessibility:
  - works on mobile and desktop
  - keyboard reachable
  - status contrast is clear
  - disabled submit state remains legible and explainable

Implementation constraints:
- Preserve existing review forms and cadence layout unless a change is required to support the new timing UX
- Do not invent new backend fields
- Reuse the existing inline-state / section-card patterns where sensible, but it is fine to refine the presentation substantially if the result still fits the product
- Keep redirect logic robust and avoid redirect loops
- If the backend returns `allowedDate = null`, do not auto-redirect
- When displaying `opensAt` / `closesAt`, format them in a user-friendly local style using the browser, while still showing the governing timezone label from the API

Specific implementation expectations:
- Update review-query handling so the page understands `submissionWindow`
- Add a derived presentational model for review-window state in the review feature
- Disable submit buttons based on `submissionWindow.isOpen`
- Surface a targeted message for backend `REVIEW_OUT_OF_WINDOW`
- Add explicit read-only messaging for out-of-window historical views
- Ensure success and error states still work for daily, weekly, and monthly flows

Validation:
- `cd client && npm run build`

Deliverables:
- Apply the code changes directly
- At the end, list the files changed
- Summarize remaining risks or follow-up work in 3 bullets or fewer
