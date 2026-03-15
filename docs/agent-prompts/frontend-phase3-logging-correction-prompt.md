# Frontend Phase 3 Prompt

Use this prompt with the frontend implementation agent.

```md
You are editing the frontend of the Life OS repository for phase 3 of the dashboard audit: "Improve Logging And Correction".

Objective:
- Replace friction-heavy prompt flows with proper frontend forms, add correction flows for health and finance logs, and make Quick Capture faster and more keyboard-friendly without changing backend-owned business logic.

Repository context:
- Frontend stack: React + TypeScript + Vite in `client/`
- Shared contracts live in `packages/contracts/`
- Backend work for this phase is already implemented
- Preserve the current observatory-style shell and design system in `client/src/styles.css`

Visual direction:
- Keep the existing warm, operational command-center look
- Treat this phase as precision and speed work, not a redesign
- New forms should feel compact, deliberate, and tool-like
- Prefer inline editors, small modal/sheet sections, and segmented controls over browser prompts
- Preserve the current shell, typography, spacing rhythm, and section-card language

Editable paths:
- `client/src/features/health/HealthPage.tsx`
- `client/src/features/finance/FinancePage.tsx`
- `client/src/features/capture/QuickCaptureSheet.tsx`
- `client/src/app/shell/AppShell.tsx`
- `client/src/shared/lib/api.ts`
- `client/src/shared/ui/**` only if a small reusable helper clearly improves this scope
- `client/src/styles.css`

Do not touch:
- `server/**`
- `packages/contracts/**`
- Prisma schema or migrations
- review flows, goals/planning flows, notifications, or unrelated screens
- unrelated dirty files

Backend/API support now available:
- Existing:
  - `GET /api/health/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - `GET /api/health/water-logs?date=YYYY-MM-DD`
  - `POST /api/health/water-logs`
  - `GET /api/health/meal-templates`
  - `POST /api/health/meal-templates`
  - `PATCH /api/health/meal-templates/:mealTemplateId`
  - `GET /api/health/meal-logs?date=YYYY-MM-DD`
  - `POST /api/health/meal-logs`
  - `PUT /api/health/workout-days/:date`
  - `POST /api/health/weight-logs`
  - `GET /api/finance/summary?month=YYYY-MM`
  - `GET /api/finance/expenses?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - `POST /api/finance/expenses`
  - `GET /api/finance/categories`
  - `GET /api/finance/recurring-expenses`
- New for this phase:
  - `PATCH /api/health/water-logs/:waterLogId`
  - `DELETE /api/health/water-logs/:waterLogId`
  - `PATCH /api/health/meal-logs/:mealLogId`
  - `DELETE /api/health/meal-logs/:mealLogId`
  - `PATCH /api/health/weight-logs/:weightLogId`
  - `DELETE /api/health/weight-logs/:weightLogId`
  - `PATCH /api/finance/expenses/:expenseId`
  - `DELETE /api/finance/expenses/:expenseId`
- `client/src/shared/lib/api.ts` already has mutation hooks added for:
  - water log update/delete
  - meal log update/delete
  - weight log update/delete
  - expense update/delete
- There is no dedicated backend endpoint for Quick Capture suggestions/default bundles in this phase. Build smarter defaults from existing category/template data and client-side memory of recent choices instead of inventing new backend APIs.

Current behavior:
- `/health` still uses a browser prompt for body-weight entry
- `/health` allows fast logging, but water, meal, and weight logs cannot be corrected or deleted from the UI
- `/health` meal templates exist, but meal logging still does not strongly support template-vs-freeform choice in the main flow
- `/finance` still uses browser prompts for quick expense entry
- `/finance` recent expenses are visible, but logged expenses cannot be edited or deleted from the UI
- Quick Capture works, but it is still fairly generic
- Quick Capture does not use existing templates/defaults well enough
- Quick Capture has no desktop keyboard-first flow
- `Note` and `Reminder` currently collapse into generic task creation and there is no backend distinction for them in this phase

Target behavior:
- Prompt-based weight and expense entry should be replaced with proper structured frontend forms
- A user should be able to correct mistaken water, meal, weight, and expense logs from the UI
- Health and finance should remain lightweight and fast, not turn into management-heavy enterprise screens
- Quick Capture should feel like the fastest path for common actions, especially on desktop
- Existing backend entities and current route structure should be preserved

Implementation requirements:

1. Health page
- Replace prompt-based weight entry with a proper inline or sheet/modal form
- Add edit/delete affordances for:
  - water logs
  - meal logs
  - weight logs
- Keep logging fast:
  - water presets should remain one-tap
  - meal logging should still support low-friction entry
  - workout logging should stay simple
- Improve meal logging UX so the user can clearly choose:
  - a saved meal template
  - or a freeform meal entry
- Surface log history in a way that makes correction practical without making the page noisy
- Add lightweight trend context if it can be done cleanly within the current page:
  - 7-day water consistency
  - workout completion rate
  - recent weight trend
- If trend work threatens the correction flows, prioritize correction flows first

2. Finance page
- Replace prompt-based expense entry with a proper inline or sheet/modal form
- Expense form should support:
  - amount
  - description
  - category
  - spent date
- Add edit/delete affordances for recent expenses
- Keep recurring bill/category management that already exists intact
- Do not redesign finance into a budgeting suite; keep it intentionally lightweight and operational
- If useful, make upcoming bills more obviously related to expense logging, but do not introduce new backend workflows in this phase

3. Quick Capture
- Keep supported capture types:
  - task
  - expense
  - water
  - meal
  - workout
  - weight
  - note
  - reminder
- Do not invent new backend entities for note/reminder in this phase
- For now, keep note/reminder as task variants, but make the UX clearer so the distinction is honest and not misleading
- Improve defaults/templates:
  - expense should remember the last-used or most recent category client-side
  - meal should show recent templates first when available
  - water should keep one-tap presets
  - workout should use a clearer status-oriented control instead of a vague text field if this can be done cleanly
  - weight should use a numeric form with unit handling instead of a freeform text box
- Add desktop keyboard-first behavior:
  - a global shortcut to open Quick Capture from the shell
  - reasonable submit/cancel keyboard handling while the sheet is open
  - focus should move into the sheet when it opens and return cleanly when it closes
- Switching capture type should preserve shared state where sensible and should not feel destructive
- Keep mobile behavior clean; desktop keyboard improvements must not break the bottom-sheet/modal experience

4. Shared API/client work
- Use the existing hooks in `client/src/shared/lib/api.ts` where they fit
- You may refine or extend client-only hook usage if needed, but do not edit backend code
- Keep mutation feedback consistent with the rest of the app
- Invalidate or refresh affected queries so Home, Today, Health, Finance, and Quick Capture do not drift stale after edits

5. UX constraints
- Every correction flow should have a visible save/delete affordance and clear pending state
- Prefer compact row actions, inline editors, or a small shared sheet over large new panels
- Keep loading, empty, and error states working
- Maintain responsive behavior on mobile
- Avoid generic CRUD-table output
- Accessibility matters:
  - proper labels
  - focus management
  - keyboard reachability
  - clear button text

Out of scope:
- Backend changes
- New server endpoints
- New standalone note or reminder entities
- Deep nutrition tracking
- Budget systems or advanced finance analytics
- A broad shell redesign
- Changes to reviews, scoring, habits, goals, or notifications beyond cache refresh side effects

Validation:
- `npm run typecheck -w client`
- `npm run build -w client`

Deliverables:
- Apply the code changes directly
- At the end, list the files changed
- Summarize remaining risks or follow-up work in 5 bullets or fewer
```
