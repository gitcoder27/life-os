# Backend Workstream

This document is the execution plan for the backend AI agent. It is organized to let backend and frontend work in parallel with early contract freezes and minimal blocking.

## Backend ownership

The backend agent owns:

- database schema and migrations
- auth and sessions
- API contracts
- background jobs
- score calculation
- review finalization
- notification generation
- Home aggregation payloads

The frontend agent should not compute business rules that belong to the backend, especially for scoring, streaks, recurring items, or review summaries.

## Frontend handoff strategy

The frontend team can work in parallel if the backend freezes response shapes in phases.

### Freeze order

1. auth and session payloads
2. onboarding payloads
3. Home overview payload
4. planning, tasks, and goals payloads
5. habits and health payloads
6. finance and notification payloads
7. review and score payloads

Use [`api-contracts.md`](./api-contracts.md) as the canonical route and payload reference during each freeze.

Each freeze should include:

- endpoint path
- request body schema
- response schema
- stable enum values
- error shape

## Delivery milestones

## Milestone 0: Foundation

Goal: establish the project skeleton and backend conventions.

Scope:

- environment config
- database connection
- migration system
- request validation pattern
- error shape
- auth/session middleware skeleton

Definition of done:

- API boots
- database migrations run cleanly
- health endpoint exists
- shared response envelope and error format are defined

Frontend unblock:

- auth error shape
- base API URL and health check contract

## Milestone 1: Auth, preferences, and planning core

Goal: unlock login and the first useful planning surfaces.

Scope:

- `users`, `sessions`, `audit_events`, `user_preferences`
- `goals`, `planning_cycles`, `cycle_priorities`, `tasks`
- auth endpoints
- onboarding state and completion endpoints
- goals CRUD
- daily and weekly planning endpoints

Definition of done:

- login and logout work
- current user lookup works
- onboarding completion writes the initial setup state
- daily priorities can be created and read
- lightweight tasks can be created, completed, and carried forward

Frontend unblock:

- login screen
- onboarding flow
- initial Home shell
- Today and goals screens using real data

## Milestone 2: Habits, routines, and health logging

Goal: provide the fastest recurring-write flows.

Scope:

- `habits`, `habit_checkins`
- `routines`, `routine_items`, `routine_item_checkins`
- `water_logs`, `meal_templates`, `meal_logs`, `workout_days`, `weight_logs`
- habits and health endpoints
- due-today evaluation queries

Definition of done:

- one-tap habit completion works
- routine item completion works
- water, meal, workout, and weight logging work
- daily health summary reads work

Frontend unblock:

- habits screen
- health screen
- quick-capture support for health and habit events

## Milestone 3: Finance, admin, and notifications

Goal: support life-maintenance visibility and attention surfaces.

Scope:

- `expense_categories`, `expenses`, `recurring_expense_templates`, `admin_items`, `notifications`
- finance endpoints
- recurring-expense materializer
- initial notification rules

Definition of done:

- expense categories and expenses work
- recurring expense templates generate due admin items
- notification records are generated and readable

Frontend unblock:

- finance screen
- notification drawer or center
- Home attention panel can render real finance and admin items

## Milestone 4: Reviews and scoring

Goal: close the daily, weekly, and monthly operating loop.

Scope:

- `daily_reviews`, `weekly_reviews`, `monthly_reviews`, `daily_scores`
- review summary queries
- score calculator
- Weekly Momentum calculator
- review completion workflows

Definition of done:

- daily review finalizes Daily Score
- weekly review updates Weekly Momentum bonus
- monthly review stores theme, outcomes, and ratings
- score breakdown endpoint works

Frontend unblock:

- review screen
- score breakdown cards
- Home score and trend surfaces

## Milestone 5: Home aggregation and hardening

Goal: make the backend production-usable for real daily usage.

Scope:

- `GET /api/home/overview`
- query optimization and indexes
- contract cleanup
- auth hardening
- job cleanup tasks
- logging and observability basics

Definition of done:

- Home can render from one read-optimized endpoint
- important writes are transactional
- job failures are visible
- expired sessions are cleaned

Frontend unblock:

- final Home integration
- removal of temporary frontend mock assembly logic

## Test plan by milestone

### Milestones 0-1

- auth integration tests
- migration tests
- planning CRUD tests

### Milestones 2-3

- habit and health write tests
- recurring item generation tests
- finance summary tests
- notification dedupe tests

### Milestones 4-5

- score calculator unit tests
- daily review finalization transaction tests
- Weekly Momentum tests
- Home overview contract tests

## Contract-first working rule

Before implementing each milestone, the backend agent should publish:

- final enum values
- request and response schemas
- nullable versus required field decisions
- date and time field conventions

This prevents frontend churn.

## Recommended implementation order inside each milestone

1. schema and migrations
2. validation schemas
3. repository or data-access layer
4. service logic
5. API handlers
6. tests
7. fixture payloads for frontend

## Risks to avoid

- letting the frontend compute score logic
- over-normalizing data before the MVP workflows are stable
- building too many generic abstractions before the domains are proven
- returning raw tables instead of read-optimized payloads
- mixing background job logic into request handlers

## Final milestone exit condition

Backend MVP is ready when:

- all core write paths exist
- Home overview is stable
- reviews and scoring are finalized server-side
- recurring items and notifications run automatically
- the frontend can integrate without guessing business rules
