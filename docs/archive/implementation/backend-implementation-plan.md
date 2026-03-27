# Backend Implementation Plan

## Scope Summary

This plan covers backend implementation for Life OS MVP within the backend ownership boundary:

- `server/**`
- `packages/contracts/**`
- backend implementation docs in `docs/implementation/**`

The backend is responsible for authentication, onboarding seeding, planning-cycle lifecycle, recurring item logic, scoring, review finalization, notification generation, and read-optimized aggregation payloads. `docs/prd/api-contracts.md` is the canonical contract reference, and `packages/contracts` is the published schema surface for the frontend.

## Phase 0: Foundation

### Objective

Turn the current Fastify/Prisma/contracts scaffold into a PRD-aligned backend foundation that can support phased delivery without contract drift or schema rework.

### Schema and Module Scope

- Align `server/prisma/schema.prisma` to the PRD data model and canonical module boundaries.
- Establish shared app plugins for Prisma, auth/session context, validation, error handling, logging, and time/date utilities.
- Normalize server structure around a modular monolith:
  - `auth`
  - `setup`
  - `planning`
  - `habits`
  - `health`
  - `finance`
  - `reviews`
  - `scoring`
  - `notifications`
  - `home`
- Define common response envelopes, error codes, and date/time conventions.
- Add the worker-process skeleton and shared job execution conventions.

### Contract Freeze Outputs

- Shared success and error envelope conventions.
- Auth guard and validation failure behavior.
- Date-only field convention: `YYYY-MM-DD`.
- Timestamp convention: ISO-8601 UTC string.
- Stable lower-case wire enums in `packages/contracts`.
- Health-check and base API readiness contract.

### Risks

- The existing schema only partially matches `docs/prd/data-model.md`.
- Placeholder contracts already exist and need disciplined correction before frontend assumptions harden.
- If enum names leak directly from Prisma, frontend-facing wire contracts will drift from PRD language.
- Foundation work can become over-abstracted; keep the base minimal and implementation-oriented.

### Definition of Done

- Server boots cleanly with environment validation and Prisma wiring.
- Database migrations run against the PRD-aligned schema.
- Shared validation and error handling are in place.
- Request logging and core error logging are available.
- Auth/session middleware skeleton is ready for real database-backed sessions.
- `packages/contracts` exports stable base contracts used by the API.

## Phase 1: Auth, Onboarding, and Planning Core

### Objective

Deliver the first useful authenticated product loop: owner login, first-run setup, planning cycles, priorities, tasks, and goals.

### Schema and Module Scope

- Auth/account tables:
  - `users`
  - `sessions`
  - `audit_events`
  - `user_preferences`
- Planning tables:
  - `goals`
  - `planning_cycles`
  - `cycle_priorities`
  - `tasks`
- Implement DB-backed secure-cookie sessions with sliding expiry.
- Replace placeholder auth with Argon2id password verification and audit events.
- Add onboarding completion flow that seeds:
  - preferences
  - starter goals
  - starter habits
  - starter routines
  - expense categories
  - first planning cycles
- Implement planning services for day, week, and month views plus carry-forward behavior.

### Contract Freeze Outputs

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET /api/onboarding/state`
- `POST /api/onboarding/complete`
- `GET /api/goals`
- `POST /api/goals`
- `PATCH /api/goals/:goalId`
- `GET /api/planning/days/:date`
- `PUT /api/planning/days/:date/priorities`
- `GET /api/planning/weeks/:startDate`
- `PUT /api/planning/weeks/:startDate/priorities`
- `GET /api/planning/months/:startDate`
- `PUT /api/planning/months/:startDate/focus`
- `POST /api/tasks`
- `PATCH /api/tasks/:taskId`
- `POST /api/tasks/:taskId/carry-forward`

### Risks

- Onboarding payload shape is currently too thin for the PRD and needs expansion without later churn.
- Cycle seeding must be deterministic to avoid duplicate day/week/month records.
- Auth hardening must stay simple enough for MVP while still meeting the baseline in `authentication-and-security.md`.
- Carry-forward logic can easily become inconsistent unless it is transactional and server-owned.

### Definition of Done

- Owner account bootstrap works from environment variables on first boot.
- Login, logout, and session lookup work against the database.
- Onboarding completion writes initial setup data in one transaction.
- Goal CRUD works for MVP needs.
- Daily/weekly/monthly planning reads and writes work.
- Tasks can be created, updated, completed, and carried forward.
- Phase 1 contracts are stable for frontend integration.

## Phase 2: Habits, Routines, and Health

### Objective

Implement the fastest recurring-write flows so the product becomes useful for day-to-day execution.

### Schema and Module Scope

- Habits/routines tables:
  - `habits`
  - `habit_checkins`
  - `routines`
  - `routine_items`
  - `routine_item_checkins`
- Health tables:
  - `water_logs`
  - `meal_templates`
  - `meal_logs`
  - `workout_days`
  - `weight_logs`
- Add due-today evaluation for habits and routines.
- Add streak and consistency summary logic server-side.
- Implement health summary reads for day and range windows.

### Contract Freeze Outputs

- `GET /api/habits`
- `POST /api/habits`
- `PATCH /api/habits/:habitId`
- `POST /api/habits/:habitId/checkins`
- `GET /api/routines`
- `POST /api/routines`
- `PATCH /api/routines/:routineId`
- `POST /api/routine-items/:itemId/checkins`
- `GET /api/health/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `POST /api/health/water-logs`
- `POST /api/health/meal-logs`
- `PUT /api/health/workout-days/:date`
- `POST /api/health/weight-logs`

### Risks

- Habit due-state and streak logic must not leak into the frontend.
- Workout scoring semantics require the richer PRD states, not the current placeholder values.
- Quick actions must remain idempotent where repeat taps are likely.
- Health summaries need to stay lightweight enough for Home and review prefills.

### Definition of Done

- One-tap habit completion works for due habits.
- Routine item completion works for daily execution.
- Water, meal, workout, and weight logging are persisted reliably.
- Due-state summaries and streak data are returned from the backend.
- Health summary reads support both screen and review use cases.
- Phase 2 contracts are stable for frontend integration.

## Phase 3: Finance, Admin, and Notifications

### Objective

Add lightweight finance visibility, recurring due-item support, and notification generation for Home attention surfaces.

### Schema and Module Scope

- Finance/admin tables:
  - `expense_categories`
  - `expenses`
  - `recurring_expense_templates`
  - `admin_items`
- Notification table:
  - `notifications`
- Add finance summary queries by month.
- Add recurring expense materialization into due admin/bill items.
- Add notification rules for due reviews, due bills/admin items, and at-risk actions.

### Contract Freeze Outputs

- `GET /api/finance/summary?month=YYYY-MM`
- `POST /api/finance/expenses`
- `PATCH /api/finance/expenses/:expenseId`
- `GET /api/finance/recurring-expenses`
- `POST /api/finance/recurring-expenses`
- `GET /api/notifications`
- `POST /api/notifications/:notificationId/read`
- `POST /api/notifications/:notificationId/dismiss`

### Risks

- Recurring generation must be idempotent and safe to rerun.
- Finance/admin relevance affects scoring applicability later, so the domain rules must remain consistent.
- Notifications can get noisy quickly unless dedupe and dismissal semantics are clear.

### Definition of Done

- Expense categories and expenses work for MVP use cases.
- Recurring templates generate due items automatically.
- Monthly finance summaries are available.
- Notification records are generated, readable, and dismissible.
- Phase 3 contracts are stable for frontend integration.

## Phase 4: Reviews and Scoring

### Objective

Implement the full reflection and scoring loop so the backend becomes the source of truth for momentum and review behavior.

### Schema and Module Scope

- Review/scoring tables:
  - `daily_reviews`
  - `weekly_reviews`
  - `monthly_reviews`
  - `daily_scores`
- Add daily review finalization workflow:
  - validate required fields
  - process carry-forward decisions
  - seed tomorrow priorities
  - finalize Daily Score
- Add weekly review workflow:
  - summarize last 7 days
  - persist outputs
  - apply Weekly Momentum bonus
- Add monthly review workflow:
  - persist theme, outcomes, ratings, and habit changes
- Implement Daily Score engine and Weekly Momentum calculator according to the PRD.

### Contract Freeze Outputs

- `GET /api/reviews/daily/:date`
- `POST /api/reviews/daily/:date`
- `GET /api/reviews/weekly/:startDate`
- `POST /api/reviews/weekly/:startDate`
- `GET /api/reviews/monthly/:startDate`
- `POST /api/reviews/monthly/:startDate`
- `GET /api/scores/daily/:date`
- `GET /api/scores/weekly-momentum?endingOn=YYYY-MM-DD`

### Risks

- Closed-day score immutability must be preserved after the review window.
- Review completion and next-cycle seeding must be transactional.
- Score explanation payloads need to stay readable for the frontend while remaining exact to the scoring rules.
- Anti-gaming constraints must be enforced by the backend, not inferred by the UI.

### Definition of Done

- Daily review prefills and finalization work.
- Weekly review summary and bonus behavior work.
- Monthly review storage and output seeding work.
- Daily Score breakdown endpoint matches the PRD model.
- Weekly Momentum endpoint is derived correctly from finalized scores and the weekly review bonus.
- Phase 4 contracts are stable for frontend integration.

## Phase 5: Home Aggregation and Hardening

### Objective

Ship a production-usable backend read layer and operational baseline for real daily use.

### Schema and Module Scope

- Implement read-optimized Home aggregation over:
  - daily score
  - weekly momentum
  - top priorities
  - tasks
  - routine summary
  - habit summary
  - health summary
  - finance summary
  - attention items
  - notifications
- Add Home history read support for past dates.
- Add indexes and query tuning for high-read paths.
- Finalize worker jobs for:
  - cycle seeding
  - recurring item generation
  - review reminder generation
  - notification cleanup
  - session cleanup
- Complete observability baseline for requests, failed writes, auth events, jobs, and score failures.

### Contract Freeze Outputs

- `GET /api/home/overview?date=YYYY-MM-DD`
- `GET /api/home/overview/history/:date`
- Final attention-item semantics used by Home.
- Final notification shape used by Home and notification surfaces.

### Risks

- Home aggregation can become a high-latency N+1 endpoint if built from raw per-module queries.
- Jobs must be observable and idempotent or operational issues will be hard to diagnose.
- Contract cleanup at the end of the build can cause frontend churn if freeze discipline slips earlier.

### Definition of Done

- Home renders from a single read-optimized backend payload.
- Important write flows use transactions where required.
- Job failures are visible in logs.
- Expired sessions are cleaned up automatically.
- Backend contracts are cleaned and stable for full frontend integration.

## Implementation Rules

- Follow `docs/prd/api-contracts.md` as the canonical route reference.
- Follow `docs/prd/data-model.md` for schema design unless a documented implementation adjustment is required.
- Keep scoring, review logic, carry-forward behavior, and recurring item logic server-side.
- Prefer read-optimized summary endpoints over returning raw tables for Home and reviews.
- Freeze contracts phase by phase in `packages/contracts`.
- Do not edit `client/**`.

## Current Execution State

- Current phase: Phase 0
- Current completed work:
  - backend prompt and PRD review completed
  - backend implementation plan created
  - backend checklist tracker created
- Next target:
  - align Prisma schema and shared contracts to the PRD baseline
  - replace placeholder backend foundations with real Phase 0 infrastructure
