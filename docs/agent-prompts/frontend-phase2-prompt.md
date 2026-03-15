# Frontend Phase 2 Prompt

Use this prompt with the frontend implementation agent.

```md
You are editing the frontend of the Life OS repository for phase 2 of the dashboard audit.

Objective:
- Expose existing backend depth in the UI without changing backend business logic: add notifications UI, goal and planning management, finance category and recurring management, meal template management, and a standalone settings page.

Repository context:
- Frontend stack: React + TypeScript + Vite in `client/`
- Shared contracts live in `packages/contracts/`
- Backend work for this phase is already implemented
- Preserve the current observatory-style shell and design system in `client/src/styles.css`

Visual direction:
- Keep the existing warm analog command-center feel
- Treat this phase as "operational control surfaces", not a redesign
- New management UI should feel denser and more tool-like than the current summary cards, but still visually aligned with the amber-on-deep palette, Fraunces display accents, and elevated panel treatment
- Prefer slide-over editors, inline management sections, and structured forms over browser prompts
- Avoid generic white-form-on-dark-card output; use the repo's existing shell, section-card language, and motion patterns

Editable paths:
- `client/src/app/router.tsx`
- `client/src/app/shell/AppShell.tsx`
- `client/src/features/goals/**`
- `client/src/features/finance/**`
- `client/src/features/health/**`
- `client/src/shared/lib/api.ts`
- `client/src/shared/ui/**`
- `client/src/styles.css`
- You may add:
  - `client/src/features/notifications/NotificationsPage.tsx`
  - `client/src/features/settings/SettingsPage.tsx`

Do not touch:
- `server/**`
- `packages/contracts/**`
- Prisma schema or migrations
- Backend-owned business rules
- Unrelated docs or other dirty files

Current behavior:
- `/` Home shows a summary plus small notification previews, but there is no notification inbox route
- Header Notifications button does nothing
- `/goals` is mostly read-only: it shows goals, weekly priorities, and monthly focus but does not let the user manage them
- `/finance` shows categories, recent expenses, and recurring items but only supports category creation and expense creation through the current quick action; there is no category edit/archive UI and no recurring edit/status UI
- `/health` shows meal templates only as passive logging helpers; there is no meal template management UI
- Preferences are trapped in onboarding; there is no standalone settings route
- `client/src/shared/lib/api.ts` still duplicates many local response types and does not expose query/mutation hooks for this phase-2 surface
- Date helpers such as `getTodayDate`, `getWeekStartDate`, and related query-key helpers still assume browser-local date math instead of user preference-aware date math

Target behavior:
- Add a dedicated `/notifications` page
- Add a dedicated `/settings` page
- Make the header Notifications button navigate to `/notifications`
- Add shell navigation for Settings in an unobtrusive way that fits the current sidebar/footer layout
- Keep goals/planning management on `/goals`
- Keep finance management on `/finance`
- Keep meal template management on `/health`
- Do not implement phase-3 log edit/delete flows or replace existing expense/weight prompts in this task

Required route and page work:

1. Notifications
- Add route: `/notifications`
- Build a real inbox page using the existing shell/page patterns
- Load notifications from `GET /api/notifications`
- Support:
  - mark as read via `POST /api/notifications/:notificationId/read`
  - dismiss via `POST /api/notifications/:notificationId/dismiss`
  - open linked entity via CTA
- Group or visually separate unread vs read state if useful, but keep the page compact
- Show severity clearly using the contract severity values: `info`, `warning`, `critical`
- Notification deep-link handling:
  - `entityType === "admin_item"` -> navigate to `/finance`
  - `entityType === "health_day"` -> navigate to `/health`
  - `entityType === "workout_day"` -> navigate to `/health`
  - `entityType === "habit"` -> navigate to `/habits`
  - `entityType === "routine_day"` -> navigate to `/habits`
  - `entityType === "daily_review"` -> navigate to `/reviews/daily?date=<resolved-date>`
  - `entityType === "weekly_review"` -> navigate to `/reviews/weekly?date=<resolved-date>`
  - `entityType === "monthly_review"` -> navigate to `/reviews/monthly?date=<resolved-date>`
- You will need to parse dates from notification `entityId` strings currently emitted by the backend, for example:
  - `daily-review:2026-03-14`
  - `weekly-review:2026-03-02`
  - `monthly-review:2026-02`
  - `water:2026-03-14`
  - `workout:2026-03-14`
  - `habit-id:2026-03-14`

2. Reviews route support for notifications
- Update the reviews route flow so `/reviews/:cadence?date=YYYY-MM-DD` is supported
- If a `date` search param is present:
  - for `daily`, use that exact date
  - for `weekly`, use the week containing that date, then request the correct `startDate`
  - for `monthly`, use the month containing that date, then request the correct `startDate`
- Preserve current behavior when `date` is absent

3. Settings
- Add route: `/settings`
- Build a simple standalone settings page with one save flow
- Load from `GET /api/settings/profile`
- Save with `PUT /api/settings/profile`
- Include these editable fields only:
  - display name
  - timezone
  - currency code
  - week start day
  - daily water target
  - daily review start time
  - daily review end time
- Show current email as read-only
- Do not add password-change UI in this phase

4. Goals and planning
- Keep `/goals` as the hub for:
  - goal creation
  - goal editing
  - goal status changes (`active`, `paused`, `completed`, `archived`)
  - weekly priorities editing
  - monthly theme editing
  - monthly top outcomes editing
- Use the existing planning endpoints:
  - `GET /api/goals`
  - `POST /api/goals`
  - `PATCH /api/goals/:goalId`
  - `GET /api/planning/weeks/:startDate`
  - `PUT /api/planning/weeks/:startDate/priorities`
  - `GET /api/planning/months/:startDate`
  - `PUT /api/planning/months/:startDate/focus`
- Prefer structured editors, not giant freeform forms
- Weekly priorities and monthly outcomes should allow optional goal linkage where the contract supports `goalId`
- Status and save feedback should be obvious and local to the edited panel

5. Finance management
- Keep `/finance` as the hub for:
  - expense category create/edit/archive
  - recurring expense create/edit/pause/archive
- Use these endpoints:
  - `GET /api/finance/categories`
  - `POST /api/finance/categories`
  - `PATCH /api/finance/categories/:categoryId`
  - `GET /api/finance/recurring-expenses`
  - `POST /api/finance/recurring-expenses`
  - `PATCH /api/finance/recurring-expenses/:recurringExpenseId`
- Do not change expense log editing in this phase
- Do not replace the current quick expense prompt flow in this phase
- Add management UI that is operational: the user should be able to maintain categories and recurring bills without leaving the page

6. Meal template management
- Keep `/health` as the place for meal template management
- Use these endpoints:
  - `GET /api/health/meal-templates`
  - `POST /api/health/meal-templates`
  - `PATCH /api/health/meal-templates/:mealTemplateId`
- Support create, edit, and archive for meal templates
- Keep the existing low-friction meal logging interactions intact
- Do not add meal log edit/delete in this phase

7. Shared API/client work
- Add typed query/mutation hooks in `client/src/shared/lib/api.ts` for:
  - notifications list
  - notification read
  - notification dismiss
  - settings get/update
  - goal create/update
  - weekly priority update
  - monthly focus update
  - category update
  - recurring expense update
  - meal template create/update
- Use the same mutation feedback conventions already used elsewhere in the file
- Keep cache invalidation aligned with affected screens

8. Preference-aware date behavior
- Replace browser-local assumptions in shared date helpers where they would break phase-2 UX after settings changes
- At minimum, the logic that drives goals/planning, reviews deep-linking, and settings-sensitive query keys should respect stored user preferences once loaded
- Do not guess backend timezones from the browser once settings data is available
- If you need a lightweight app-level preference cache to support this, implement it in frontend state only

Design and UX constraints:
- Stay within the current design system; extend it rather than replacing it
- Prefer compact operational layouts over decorative card sprawl
- Use clear empty, loading, error, and retry states
- Ensure all major new actions have visible pending/success/error feedback
- Keep desktop and mobile behavior working; management surfaces must collapse cleanly on narrow screens
- Maintain accessible labels, button text, and form semantics

Out of scope:
- Password-change UI
- Notification preference controls
- Expense log edit/delete
- Water/meal/weight log edit/delete
- Replacing prompt-based weight entry
- Replacing prompt-based expense entry
- Quick capture redesign
- New backend endpoints

Validation:
- `npm run typecheck -w client`
- `npm run build -w client`

Deliverables:
- Apply the code changes directly
- At the end, list the files changed
- Summarize remaining risks or blockers in 5 bullets or fewer
```
