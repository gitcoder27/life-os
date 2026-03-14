# Backend Checklist

Status: Active  
Current phase: Phase 5

Use this checklist to track backend execution progress. Keep it updated as work completes, and call out contract freezes that are safe for frontend integration.

## Phase 0: Foundation

### Planning and Alignment

- [x] Create `docs/implementation/backend-implementation-plan.md`
- [x] Create `docs/implementation/backend-checklist.md`
- [x] Review current backend scaffold against `docs/prd/api-contracts.md`
- [x] Review current Prisma schema against `docs/prd/data-model.md`
- [x] Document Phase 0 contract corrections required before frontend freeze

### Schema and Migrations

- [x] Align `server/prisma/schema.prisma` to the PRD baseline
- [x] Add missing enums and tables required for Phases 0-1 foundation
- [x] Remove or rename placeholder schema elements that conflict with PRD language
- [x] Create initial Prisma migration for the aligned baseline
- [x] Verify Prisma client generation and migration flow locally

### Contracts

- [x] Define shared success envelope conventions in `packages/contracts`
- [x] Define shared error envelope with stable error code field
- [x] Define shared date/time scalar conventions and helper types
- [x] Normalize public wire enums to PRD-aligned lower-case values
- [x] Freeze base API/error conventions for frontend integration

### Services and App Infrastructure

- [x] Add Prisma app plugin / shared database access layer
- [x] Add auth/session request context plumbing
- [x] Add shared validation helpers
- [x] Add centralized error mapping
- [x] Add time/date utility layer for date-window behavior
- [x] Add structured logger conventions
- [x] Add worker-process skeleton for scheduled jobs

### Routes

- [x] Stabilize `/healthz`
- [x] Replace placeholder `/api/health` implementation with a foundation-ready health response
- [x] Ensure route registration structure supports modular phase delivery

### Jobs

- [x] Define worker entrypoint and job registration pattern
- [ ] Define idempotent job execution conventions
- [x] Define baseline job logging behavior

### Tests

- [ ] Add app boot smoke test
- [ ] Add environment validation test coverage
- [ ] Add error-envelope test coverage
- [ ] Add health endpoint smoke test

### Observability

- [x] Add request logging baseline
- [x] Add 5xx error logging baseline
- [x] Add job-run logging baseline
- [x] Add auth-event logging placeholders for Phase 1 wiring

### Frontend Handoff

- [x] Share final base error envelope
- [x] Share date/time field conventions
- [x] Share stable health-check and readiness contract

## Phase 1: Auth, Onboarding, and Planning Core

### Schema and Migrations

- [x] Add/align `users`
- [x] Add/align `sessions`
- [x] Add/align `audit_events`
- [x] Add/align `user_preferences`
- [x] Add/align `goals`
- [x] Add/align `planning_cycles`
- [x] Add/align `cycle_priorities`
- [x] Add/align `tasks`
- [x] Create migration for Phase 1 schema changes

### Contracts

- [x] Freeze auth/session contracts
- [x] Expand onboarding contract to full first-run setup payload
- [x] Freeze planning day/week/month contracts
- [x] Freeze goals and task contracts
- [x] Freeze auth/onboarding/planning error shapes

### Services

- [x] Implement owner bootstrap from environment variables
- [x] Implement Argon2id password verification flow
- [x] Implement DB-backed session creation and revocation
- [x] Implement session lookup and sliding expiry refresh
- [x] Implement audit event logging
- [x] Implement onboarding seed transaction
- [x] Implement planning-cycle creation and lookup
- [x] Implement priority save/update logic
- [x] Implement task create/update/complete logic
- [x] Implement carry-forward transaction logic
- [x] Implement goal CRUD service layer
- [x] Implement CSRF protection for state-changing routes
- [x] Implement basic login rate limiting / brute-force guard

### Routes

- [x] Implement `POST /api/auth/login`
- [x] Implement `POST /api/auth/logout`
- [x] Implement `GET /api/auth/session`
- [x] Implement `GET /api/onboarding/state`
- [x] Implement `POST /api/onboarding/complete`
- [x] Implement `GET /api/goals`
- [x] Implement `POST /api/goals`
- [x] Implement `PATCH /api/goals/:goalId`
- [x] Implement `GET /api/planning/days/:date`
- [x] Implement `PUT /api/planning/days/:date/priorities`
- [x] Implement `GET /api/planning/weeks/:startDate`
- [x] Implement `PUT /api/planning/weeks/:startDate/priorities`
- [x] Implement `GET /api/planning/months/:startDate`
- [x] Implement `PUT /api/planning/months/:startDate/focus`
- [x] Implement `POST /api/tasks`
- [x] Implement `PATCH /api/tasks/:taskId`
- [x] Implement `POST /api/tasks/:taskId/carry-forward`

### Jobs

- [ ] Add session cleanup job
- [ ] Add planning-cycle seed job for upcoming day/week/month windows

### Tests

- [ ] Add auth integration tests
- [ ] Add owner bootstrap tests
- [ ] Add onboarding transaction tests
- [ ] Add session expiry / logout tests
- [ ] Add goal CRUD tests
- [ ] Add planning day/week/month tests
- [ ] Add task carry-forward tests
- [ ] Add CSRF/auth-guard tests

### Observability

- [x] Log successful login events
- [x] Log failed login events
- [x] Log logout events
- [x] Log onboarding completion outcome
- [ ] Log planning write failures

### Frontend Handoff

- [x] Share auth/session payloads as safe-to-integrate
- [x] Share onboarding payload and defaults as safe-to-integrate
- [x] Share planning, goals, and tasks payloads as safe-to-integrate

## Phase 2: Habits, Routines, and Health

### Schema and Migrations

- [x] Add/align `habits`
- [x] Add/align `habit_checkins`
- [x] Add/align `routines`
- [x] Add/align `routine_items`
- [x] Add/align `routine_item_checkins`
- [x] Add/align `water_logs`
- [x] Add/align `meal_templates`
- [x] Add/align `meal_logs`
- [x] Add/align `workout_days`
- [x] Add/align `weight_logs`
- [ ] Create migration for Phase 2 schema changes

### Contracts

- [x] Freeze habits contracts
- [x] Freeze routines contracts
- [x] Freeze health logging contracts
- [x] Freeze health summary contract
- [x] Freeze streak/due-state response fields needed by frontend

### Services

- [x] Implement habit CRUD service layer
- [x] Implement due-today habit evaluation
- [x] Implement habit checkin idempotency behavior
- [x] Implement routine CRUD service layer
- [x] Implement routine item checkin idempotency behavior
- [x] Implement streak and consistency calculations
- [x] Implement water logging service
- [x] Implement meal logging and meal template service
- [x] Implement workout-day service with PRD-aligned statuses
- [x] Implement weight logging service
- [x] Implement health summary aggregation service

### Routes

- [x] Implement `GET /api/habits`
- [x] Implement `POST /api/habits`
- [x] Implement `PATCH /api/habits/:habitId`
- [x] Implement `POST /api/habits/:habitId/checkins`
- [x] Implement `GET /api/routines`
- [x] Implement `POST /api/routines`
- [x] Implement `PATCH /api/routines/:routineId`
- [x] Implement `POST /api/routine-items/:itemId/checkins`
- [x] Implement `GET /api/health/summary`
- [x] Implement `POST /api/health/water-logs`
- [x] Implement `POST /api/health/meal-logs`
- [x] Implement `PUT /api/health/workout-days/:date`
- [x] Implement `POST /api/health/weight-logs`

### Jobs

- [ ] Add any due-state refresh job if needed after implementation validation

### Tests

- [ ] Add habit due-state tests
- [ ] Add habit checkin idempotency tests
- [ ] Add routine item checkin tests
- [ ] Add water/meal/workout/weight write tests
- [ ] Add health summary aggregation tests
- [ ] Add streak calculation tests

### Observability

- [ ] Log failed habit/routine quick actions
- [ ] Log health write failures
- [ ] Log summary aggregation failures

### Frontend Handoff

- [x] Share habits and routines payloads as safe-to-integrate
- [x] Share health logging payloads as safe-to-integrate
- [x] Share streak/due-state fields as safe-to-integrate

## Phase 3: Finance, Admin, and Notifications

### Schema and Migrations

- [x] Add/align `expense_categories`
- [x] Add/align `expenses`
- [x] Add/align `recurring_expense_templates`
- [x] Add/align `admin_items`
- [x] Add/align `notifications`
- [ ] Create migration for Phase 3 schema changes

### Contracts

- [x] Freeze finance summary contract
- [x] Freeze expense create/edit contracts
- [x] Freeze recurring-expense contracts
- [x] Freeze notification contracts
- [x] Freeze attention-item contract inputs needed by Home

### Services

- [ ] Implement expense category service layer
- [x] Implement expense create/edit service layer
- [x] Implement recurring-expense template service layer
- [ ] Implement due admin-item materialization
- [x] Implement monthly finance summary aggregation
- [ ] Implement notification generation and dedupe rules
- [x] Implement notification read/dismiss behavior

### Routes

- [x] Implement `GET /api/finance/summary`
- [x] Implement `POST /api/finance/expenses`
- [x] Implement `PATCH /api/finance/expenses/:expenseId`
- [x] Implement `GET /api/finance/recurring-expenses`
- [x] Implement `POST /api/finance/recurring-expenses`
- [x] Implement `GET /api/notifications`
- [x] Implement `POST /api/notifications/:notificationId/read`
- [x] Implement `POST /api/notifications/:notificationId/dismiss`

### Jobs

- [ ] Add recurring-expense materialization job
- [ ] Add notification generation job
- [ ] Add notification cleanup / expiry job if required

### Tests

- [ ] Add expense CRUD tests
- [ ] Add recurring-expense materialization tests
- [ ] Add finance summary tests
- [ ] Add notification generation tests
- [ ] Add notification dedupe and dismissal tests

### Observability

- [ ] Log finance write failures
- [ ] Log recurring generation runs and failures
- [ ] Log notification generation runs and failures

### Frontend Handoff

- [x] Share finance summary payload as safe-to-integrate
- [x] Share recurring-expense payloads as safe-to-integrate
- [x] Share notification payloads as safe-to-integrate

## Phase 4: Reviews and Scoring

### Schema and Migrations

- [x] Add/align `daily_reviews`
- [x] Add/align `weekly_reviews`
- [x] Add/align `monthly_reviews`
- [x] Add/align `daily_scores`
- [ ] Create migration for Phase 4 schema changes

### Contracts

- [x] Freeze daily review contracts
- [x] Freeze weekly review contracts
- [x] Freeze monthly review contracts
- [x] Freeze Daily Score breakdown contract
- [x] Freeze Weekly Momentum contract
- [x] Freeze score-band labels and explanation fields

### Services

- [x] Implement daily review prefill service
- [x] Implement daily review finalization transaction
- [x] Implement weekly review summary service
- [x] Implement weekly review completion transaction
- [x] Implement monthly review summary service
- [x] Implement monthly review completion transaction
- [x] Implement Daily Score calculator
- [x] Implement Weekly Momentum calculator
- [x] Enforce closed-day score immutability rules
- [x] Enforce anti-gaming score applicability rules

### Routes

- [x] Implement `GET /api/reviews/daily/:date`
- [x] Implement `POST /api/reviews/daily/:date`
- [x] Implement `GET /api/reviews/weekly/:startDate`
- [x] Implement `POST /api/reviews/weekly/:startDate`
- [x] Implement `GET /api/reviews/monthly/:startDate`
- [x] Implement `POST /api/reviews/monthly/:startDate`
- [x] Implement `GET /api/scores/daily/:date`
- [x] Implement `GET /api/scores/weekly-momentum`

### Jobs

- [ ] Add review reminder generation job
- [ ] Add any score backfill/admin correction hook only if explicitly needed

### Tests

- [ ] Add score-engine unit tests against PRD rules
- [ ] Add daily review finalization transaction tests
- [ ] Add weekly momentum tests
- [ ] Add monthly review persistence tests
- [ ] Add closed-day immutability tests
- [ ] Add review prefill aggregation tests

### Observability

- [ ] Log review submission failures
- [ ] Log score calculation failures
- [ ] Log review-reminder job runs and failures

### Frontend Handoff

- [x] Share review payloads as safe-to-integrate
- [x] Share score breakdown payloads as safe-to-integrate
- [x] Share Weekly Momentum payload as safe-to-integrate

## Phase 5: Home Aggregation and Hardening

### Schema and Migrations

- [ ] Add indexes needed for Home overview and history reads
- [ ] Add cleanup migrations if schema refinements are required

### Contracts

- [x] Freeze final `GET /api/home/overview` contract
- [x] Freeze `GET /api/home/overview/history/:date` contract
- [x] Freeze final attention-item semantics
- [x] Freeze final Home notification shape

### Services

- [x] Implement Home overview aggregation service
- [x] Implement Home history aggregation service
- [ ] Optimize read paths for score, planning, habits, health, finance, and notifications
- [ ] Finalize transactional boundaries on important writes
- [ ] Finalize session cleanup behavior

### Routes

- [x] Replace placeholder `GET /api/home/overview`
- [x] Implement `GET /api/home/overview/history/:date`

### Jobs

- [ ] Finalize cycle seeding job
- [ ] Finalize recurring generation job
- [ ] Finalize review reminder job
- [ ] Finalize session cleanup job

### Tests

- [ ] Add Home overview contract tests
- [ ] Add Home history tests
- [ ] Add aggregation performance smoke tests
- [ ] Add worker idempotency tests
- [ ] Add session cleanup tests

### Observability

- [ ] Log Home aggregation failures
- [ ] Log worker success/failure summaries
- [ ] Verify auth, failed-write, job, and score logs are actionable

### Frontend Handoff

- [x] Share final Home overview payload as safe-to-integrate
- [x] Share Home history payload as safe-to-integrate
- [ ] Confirm frontend can remove temporary mock assembly

## Contract Freeze Log

- [x] Phase 0 base envelopes and conventions frozen
- [x] Phase 1 auth/onboarding/planning contracts frozen
- [x] Phase 2 habits/routines/health contracts frozen
- [x] Phase 3 finance/notifications contracts frozen
- [x] Phase 4 reviews/scoring contracts frozen
- [x] Phase 5 Home aggregation contracts frozen
