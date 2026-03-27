# Backend Architecture

This document defines the backend architecture for Life OS MVP. It is written for a backend AI agent that should be able to execute independently while keeping contracts stable for a parallel frontend agent.

## Architecture choice

Use a `modular monolith`.

Why:

- MVP is single-user and self-hosted
- the domain is broad but not large enough for microservices
- backend and frontend need stable contracts fast
- scoring, reviews, notifications, and Home aggregation all benefit from one transaction boundary

## Recommended backend shape

- One API application process
- One worker process for scheduled and asynchronous jobs
- One PostgreSQL database
- One shared codebase with clear domain modules

This keeps deployment simple on a private VPS while preserving a clean separation of concerns inside the code.

## Recommended technical baseline

- Language: `TypeScript`
- API style: `REST JSON`
- Validation: schema-first request and response validation
- Database: `PostgreSQL`
- Sessions: server-managed sessions backed by the database
- Background jobs: database-backed worker or cron-driven job runner in the same codebase

Library choice can vary, but the structure above should remain stable.

## Backend modules

### 1. Auth

Responsibilities:

- login
- logout
- current-user session lookup
- password reset via admin flow
- audit event creation
- session revocation

### 2. Setup

Responsibilities:

- onboarding state lookup
- onboarding completion flow
- first-run seed writes across goals, habits, routines, categories, and preferences

### 3. Planning

Responsibilities:

- goals CRUD
- planning cycle creation and lifecycle
- daily, weekly, and monthly priorities
- lightweight tasks
- carry-forward logic

### 4. Habits and routines

Responsibilities:

- habit CRUD
- routine CRUD
- daily completion writes
- streak calculations
- due-today evaluation

### 5. Health

Responsibilities:

- water logging
- meal templates and logs
- workout plan and actual status
- body weight logs
- daily and weekly summaries

### 6. Finance and admin

Responsibilities:

- expense categories
- expenses
- recurring expense templates
- due admin and bill items
- spend summaries

### 7. Reviews

Responsibilities:

- daily review submission
- weekly review submission
- monthly review submission
- prefilled review summary reads
- next-cycle seeding from review output

### 8. Scoring

Responsibilities:

- Daily Score calculation
- Daily Score finalization
- Weekly Momentum calculation
- bucket breakdown generation
- score explanation payloads

### 9. Notifications

Responsibilities:

- in-app notification generation
- attention-card visibility
- mark read
- dismiss
- expiry cleanup

### 10. Home read model

Responsibilities:

- aggregate all current-day data for Home
- return one read-optimized payload instead of many frontend joins
- keep Home latency low by avoiding unnecessary chatty APIs

## Suggested folder structure

```text
server/
  src/
    app/
    modules/
      auth/
      planning/
      habits/
      health/
      finance/
      reviews/
      scoring/
      notifications/
      home/
    db/
      migrations/
      schema/
    jobs/
    lib/
      validation/
      time/
      auth/
      logger/
```

## API design principles

- Keep endpoints resource-oriented.
- Return read-optimized payloads for Home and review summaries.
- Keep write endpoints small and transactional.
- Validate every request and response shape.
- Prefer idempotent writes where repeated taps are likely.

## Core API surface

### Auth

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `POST /api/auth/logout-all`

### Setup

- `GET /api/onboarding/state`
- `POST /api/onboarding/complete`

### Home

- `GET /api/home/overview?date=YYYY-MM-DD`

Purpose:

- return daily score
- priorities
- tasks due today
- routines and habit progress
- health snapshot
- expense snapshot
- notifications and attention items

### Planning

- `GET /api/planning/days/:date`
- `PUT /api/planning/days/:date/priorities`
- `GET /api/planning/weeks/:startDate`
- `PUT /api/planning/weeks/:startDate/priorities`
- `GET /api/planning/months/:startDate`
- `PUT /api/planning/months/:startDate/focus`
- `GET /api/goals`
- `POST /api/goals`
- `PATCH /api/goals/:id`
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`

### Habits and routines

- `GET /api/habits`
- `POST /api/habits`
- `PATCH /api/habits/:id`
- `POST /api/habits/:id/checkins`
- `GET /api/routines`
- `POST /api/routines`
- `PATCH /api/routines/:id`
- `POST /api/routine-items/:id/checkins`

### Health

- `POST /api/health/water-logs`
- `GET /api/health/water-logs?date=`
- `GET /api/health/meal-templates`
- `POST /api/health/meal-logs`
- `GET /api/health/meal-logs?date=`
- `PUT /api/health/workout-days/:date`
- `POST /api/health/weight-logs`
- `GET /api/health/summary?from=&to=`

### Finance and admin

- `GET /api/finance/categories`
- `POST /api/finance/categories`
- `POST /api/finance/expenses`
- `GET /api/finance/expenses?from=&to=`
- `GET /api/finance/summary?month=`
- `GET /api/finance/recurring-expenses`
- `POST /api/finance/recurring-expenses`
- `GET /api/admin-items`
- `PATCH /api/admin-items/:id`

### Reviews and scoring

- `GET /api/reviews/daily/:date`
- `POST /api/reviews/daily/:date`
- `GET /api/reviews/weekly/:startDate`
- `POST /api/reviews/weekly/:startDate`
- `GET /api/reviews/monthly/:startDate`
- `POST /api/reviews/monthly/:startDate`
- `GET /api/scores/daily/:date`
- `GET /api/scores/weekly-momentum?endingOn=`

The canonical contract reference is [`api-contracts.md`](./api-contracts.md). If this document and the contract doc differ, the contract doc wins.

### Notifications

- `GET /api/notifications`
- `POST /api/notifications/:id/read`
- `POST /api/notifications/:id/dismiss`

## Transaction boundaries

The backend should use transactions for:

- review completion plus score finalization
- carry-forward decisions plus tomorrow-priority seeding
- recurring item generation
- auth logout-all or password-reset session revocation
- expense creation tied to recurring template resolution

## Background jobs

Use a worker process for non-request work.

| Job | Trigger | Responsibility |
| --- | --- | --- |
| cycle seeding job | daily, weekly, monthly boundaries | Create planning cycles ahead of time |
| recurring item materializer | hourly or daily | Generate due admin items and recurring expense reminders |
| notification evaluator | every 15 minutes | Create or expire attention items and in-app notifications |
| score finalizer | on daily review and after review window close | Finalize daily scores and ensure closed-day consistency |
| weekly momentum refresher | nightly and on weekly review submit | Refresh current momentum payload |
| session cleanup | daily | Remove expired sessions |
| audit and notification cleanup | weekly | Trim or archive old low-value records if needed |

## Notification rule engine

The notification logic should remain rule-based in MVP.

Initial rules:

- incomplete routine items late in the day
- habit streak at risk
- low water progress late in the day
- missed workout or unconfirmed recovery
- upcoming bill or admin item due soon
- review overdue

Implementation guidance:

- represent each rule with a stable `rule_key`
- store generated notifications so frontend does not recompute rules
- deduplicate notifications by `rule_key + entity + day`

## Score computation strategy

- Keep score calculation server-side.
- Recalculate on any scoring-relevant write for the open day.
- Persist final daily scores after daily review or review-window close.
- Return bucket breakdown in API payloads so the frontend only renders, not computes.

## Home overview read model

The Home endpoint should be a dedicated aggregator, not a frontend assembly task.

Required response domains:

- current cycle info
- daily score and band
- top priorities
- tasks for today
- due habits and routine completion
- health snapshot
- finance snapshot
- active notifications
- next recommended actions

## Testing scope

### Unit tests

- score calculator
- Weekly Momentum calculator
- recurrence and due-date logic
- review validation rules
- streak calculation rules
- carry-forward logic

### Integration tests

- login and session lifecycle
- transactional review completion
- Home overview aggregation
- recurring expense and admin generation
- notification generation and deduplication

### Contract tests

- request and response schemas for all frontend-facing endpoints
- Home overview payload
- daily review payload
- score payload and breakdown shape

### Migration tests

- up/down migration safety
- unique constraints and foreign-key behavior

## Observability and ops

- structured request logging
- job execution logging
- DB migration logging
- health endpoint for API and worker
- metrics or counters for failed jobs, failed saves, and auth failures

## Deployment topology

Recommended MVP topology on one private VPS:

- reverse proxy
- API process
- worker process
- PostgreSQL

This is enough for MVP and keeps local, staging, and production topology nearly identical.
