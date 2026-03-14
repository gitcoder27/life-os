# Parallel Workstreams

This document defines how a frontend AI agent and a backend AI agent can work on Life OS at the same time without blocking each other unnecessarily.

## Workstream split

### Frontend agent owns

- `client/**`
- visual layout and interaction implementation
- route structure
- screen-level loading, empty, and error states
- form UX
- query integration against approved contracts

### Backend agent owns

- `server/**`
- `packages/contracts/**` schema source
- database schema and migrations
- auth and sessions
- domain services
- scoring logic
- review finalization logic
- scheduled jobs and notifications

### Shared documents

These docs are the contract between both agents:

- [`technical-architecture.md`](./technical-architecture.md)
- [`api-contracts.md`](./api-contracts.md)
- [`data-model.md`](./data-model.md)
- [`screen-specs.md`](./screen-specs.md)
- [`frontend-architecture.md`](./frontend-architecture.md)
- [`backend-architecture.md`](./backend-architecture.md)

## Coordination rules

- Frontend should only consume documented API fields.
- Backend should not rename or restructure response shapes casually once frontend work starts.
- Any contract change must update `packages/contracts` and the relevant PRD doc.
- Frontend can stub against the contract before backend is complete.
- Backend can test routes before frontend exists.

## Initial dependency order

### Backend should define first

- auth/session endpoints
- onboarding endpoints
- Home overview endpoint
- habits, health, finance, and review contracts
- core data model and migrations

### Frontend can begin immediately with mocks for

- app shell
- routing
- Home
- Today
- Habits
- Health
- Finance
- Review
- Quick Capture

## Recommended milestone split

### Milestone 1

Frontend:

- app shell
- auth screens
- Home skeleton
- Today skeleton
- shared form and card components

Backend:

- auth/session module
- database bootstrap
- user, sessions, goals, tasks, habits core schema
- health and finance core schema
- `GET /api/auth/session`
- `POST /api/auth/login`
- `GET /api/onboarding/state`
- `POST /api/onboarding/complete`
- `GET /api/home/overview?date=YYYY-MM-DD`

### Milestone 2

Frontend:

- habits flows
- health logging flows
- expense logging flows
- quick capture modal

Backend:

- habits endpoints
- routines endpoints
- water, meals, workout, and weight endpoints
- expense and recurring bill endpoints
- notification generation

### Milestone 3

Frontend:

- daily review
- weekly review
- monthly review
- score breakdown and momentum widgets

Backend:

- review endpoints
- scoring engine
- weekly momentum logic
- carry-forward logic
- recurring item jobs

### Milestone 4

Frontend:

- polish
- mobile pass
- loading and error refinement

Backend:

- test hardening
- logging and failure handling
- security baseline completion
- deployment scripts or config

## Merge and integration checkpoints

At the end of each milestone both agents should verify:

- contracts still match
- screen needs are met by backend responses
- no domain logic drift exists between frontend assumptions and backend rules
- score and review language in UI matches the backend model

## Blockers that require coordination

- auth model changes
- score formula changes
- review form changes
- endpoint shape changes
- date-window behavior changes for daily, weekly, or monthly review

## What not to do

- Do not let frontend invent hidden business rules.
- Do not let backend return UI-hostile raw tables when a screen summary is required.
- Do not make both agents edit the same contract files without coordination.
- Do not widen MVP scope during implementation without updating the PRD docs.
- Keep `api-contracts.md` as the canonical route reference if a backend implementation detail doc disagrees.
