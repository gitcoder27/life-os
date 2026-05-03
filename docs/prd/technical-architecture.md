# Technical Architecture

This document defines the current Life OS architecture and separates the system into clear frontend and backend responsibilities.

## Architecture goals

- Keep the MVP simple enough for a small build team
- Preserve a clean frontend/backend boundary
- Support private self-hosted deployment on a VPS
- Avoid infrastructure that is unnecessary for the first release
- Leave room for stronger security and future integrations later

## Current Stack

### Frontend

- React
- TypeScript
- Vite
- React Router
- TanStack Query
- plain React form state for current screens
- shared API hooks in `client/src/shared/lib/api`
- global CSS in `client/src/styles`

### Backend

- Node.js
- TypeScript
- Fastify
- Prisma
- PostgreSQL
- Zod runtime validation
- Argon2id for password hashing

### Deployment

- Nginx as reverse proxy
- frontend built as static assets
- backend API running as a systemd service
- backend worker running as a separate systemd service
- PostgreSQL on the same VPS for MVP

## Why this stack

- It is fast to build with.
- It keeps frontend and backend truly separate.
- It is simple enough for a small team to build and maintain.
- PostgreSQL is a better long-term fit than SQLite for scoring, reviews, recurring items, and reporting.
- Fastify gives a lean API surface without the ceremony of a heavier framework.

## Application shape

- modular monolith backend
- one API process
- one worker process for scheduled jobs
- one PostgreSQL database
- one shared contracts package consumed by client and server

This keeps deployment simple while preserving clean boundaries inside the codebase.

### Runtime components

1. Web client
2. HTTP API server
3. Background worker
4. PostgreSQL database

### MVP request flow

1. User logs in through the web client.
2. Frontend sends credentials to the backend.
3. Backend creates a server-side session and returns a secure cookie.
4. Frontend loads Home data from the Home overview endpoint.
5. User actions create or update records through domain endpoints.
6. Backend recalculates summaries, score state, and notification state as needed.

## Separation of responsibilities

### Frontend owns

- routing
- app shell
- screens
- components
- form state
- optimistic UX where safe
- query caching and invalidation
- mobile-responsive layouts

### Backend owns

- authentication
- authorization checks
- database schema
- domain logic
- scoring calculations
- review finalization
- recurring item materialization
- notifications and reminders

### Shared Contract Boundary

Use the shared contracts package for request/response types and shared runtime schemas.

Current path:

- `packages/contracts/`

`packages/contracts` owns shared ISO date, recurrence, notification/settings preference, and common API response schemas. Backend route validation imports these shared schemas where the shape crosses the frontend/backend boundary, while domain modules can add stricter server-only refinements such as supported timezone or currency checks. The frontend imports contract types for API hooks and uses local form state only at the UI boundary.

## Recommended repository layout

```text
/client
  /src
    /app
    /features
    /routes
    /shared

/server
  /src
    /app
    /cli
    /jobs
    /modules
    /lib
  /prisma
  /test

/packages
  /contracts

/docs
  /prd
  /implementation
  /user
  /archive
```

## Backend module map

- `admin`
- `auth`
- `finance`
- `habits`
- `health`
- `home`
- `notifications`
- `onboarding`
- `planning`
- `reviews`
- `scoring`
- `settings`

## Frontend feature map

- `auth`
- `capture`
- `finance`
- `goals`
- `habits`
- `health`
- `home`
- `inbox`
- `notifications`
- `onboarding`
- `reviews`
- `settings`
- `today`

## Route map

- `/login`
- `/onboarding`
- `/`
- `/inbox`
- `/today`
- `/habits`
- `/health`
- `/finance`
- `/goals`
- `/reviews/history`
- `/reviews/:cadence`
- `/notifications`
- `/settings`

## State strategy

### Frontend state

Use three state layers:

1. Server state via TanStack Query
2. Form state via React state and feature-specific hooks
3. Small local UI state via React state

Avoid a heavy global store in MVP unless a real shared client-only problem appears.

### Backend state

- PostgreSQL is the source of truth
- session state stored server-side
- derived summaries recalculated in service logic

## Scheduling and background work

The MVP should avoid a queue system like Redis unless necessary.

Use lightweight worker entrypoints selected by `--schedule every-15-minutes|daily|weekly`, run by systemd timer units in production, for:

- daily rollover
- creation of recurring tasks and reminders
- review reminder generation
- weekly review window opening
- monthly review window opening
- cleanup of expired sessions

If load or complexity grows later, move from cron-style worker jobs to a queue-backed worker system.

## Scoring architecture

- Scoring rules live only in the backend
- Frontend displays score, breakdown, and explanations
- Score recomputation triggers on relevant writes and on daily review finalization
- Closed-day scores should not change silently

## Notification architecture

### MVP

- in-app notifications only
- backend generates notification records
- frontend reads and dismisses them

### Later

- Telegram delivery adapter

## Build docs

Use these docs as the active reference set:

- [`PRD.md`](./PRD.md)
- [`api-contracts.md`](./api-contracts.md)
- [`data-model.md`](./data-model.md)
- [`authentication-and-security.md`](./authentication-and-security.md)
- [`screen-specs.md`](./screen-specs.md)

## Security baseline

- single owner account
- no public sign-up
- secure cookie sessions
- password hashing with Argon2id
- CSRF protection
- rate limiting on login
- HTTPS required before public exposure

See [`authentication-and-security.md`](./authentication-and-security.md) for the full security baseline.

## Observability

At minimum, instrument:

- request logs
- failed writes
- auth events
- background job runs
- score calculation failures

MVP does not need a full observability stack, but it does need actionable logs.

## Testing split

### Frontend

- component tests for important interaction flows
- integration tests for screen-level behavior

### Backend

- unit tests for domain services
- integration tests for route handlers
- scoring and review workflow tests

### Shared

- contract validation tests
- smoke tests for core daily loop

## MVP technical non-goals

- microservices
- event bus
- Redis
- WebSockets
- real-time collaboration
- public marketplace integrations

Those all add complexity without improving the first release enough.
