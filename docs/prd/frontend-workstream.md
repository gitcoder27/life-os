# Frontend Workstream

This document defines how a frontend AI agent should execute the Life OS MVP in parallel with a backend AI agent.

Use [`api-contracts.md`](./api-contracts.md) as the canonical API reference and [`screen-specs.md`](./screen-specs.md) as the canonical screen contract.

## Frontend objective

Deliver a responsive, production-ready web client for the MVP screens while depending on backend APIs only at clearly defined integration points.

## Frontend ownership

- app shell and navigation
- route structure and auth guards
- screen layout and responsive behavior
- form UX and client validation
- loading, empty, and error states
- optimistic quick-action UX
- local draft persistence
- component system and shared UI primitives

## Backend dependency boundaries

Frontend should wait for backend only on:

- session and onboarding save flows
- aggregated dashboard and today payloads
- entity reads and writes
- review submission and finalization
- authoritative score and momentum payloads

Frontend should not wait for backend on:

- shell and navigation
- component primitives
- screen layout
- mocked screen states
- draft persistence
- validation shells

## Delivery strategy

Build against mocked DTOs first, then replace the mock service layer with real API hooks as backend endpoints become available.

## Milestone plan

### Milestone 0: Foundations

#### Scope

- project scaffold
- router and providers
- authenticated shell
- route guards
- query client
- base UI primitives
- global quick-capture shell
- mock data layer
- onboarding route shell

#### Done when

- all MVP routes render with placeholder content
- login route and shell route separation works
- shared layout works on mobile and desktop

### Milestone 1: Home and Today

#### Scope

- Home screen
- Today screen
- score card and attention panel shell
- top priorities and task list interactions
- quick action hooks for safe mocked updates

#### Backend contract needed

- dashboard aggregate DTO
- today plan DTO
- quick action mutation shapes for task completion, habit completion, water increments
- onboarding state and completion payloads

#### Done when

- Home answers the daily command-center question clearly
- Today supports a full mocked daily loop

### Milestone 2: Habits, Health, and Finance

#### Scope

- habits screen
- health screen
- finance screen
- editor modals and quick forms
- optimistic flows for safe actions

#### Backend contract needed

- habit list and completion mutations
- health summary and mutation endpoints
- expense list and create or update endpoints

#### Done when

- all three domain screens support read, create, and update flows
- mobile quick actions remain fast and understandable

### Milestone 3: Goals and Reviews

#### Scope

- goals screen
- daily, weekly, and monthly review screens
- draft persistence
- required field gating
- output sections for next-day, next-week, and next-month planning

#### Backend contract needed

- goals and priorities DTOs
- review prefill DTOs by cadence
- review submit mutation
- score refresh after review submission

#### Done when

- all review cadences are usable end to end
- review submission feels guided and low-friction

### Milestone 4: Real integration and polish

#### Scope

- swap mock data layer for real API hooks
- complete loading and error states
- cross-screen refresh behavior
- accessibility pass
- responsive polish
- basic frontend tests

#### Done when

- shell, routes, and forms run against real backend APIs
- regressions are covered by tests for critical flows

## Mocking strategy

Until backend endpoints are ready, keep a thin service abstraction with:

- typed DTO fixtures
- fake network latency
- success, empty, and failure variants
- cadence-specific review fixtures

This allows the frontend agent to complete most of the app without blocking.

## Shared DTO priorities

The frontend agent should request backend contract stability in this order:

1. session and onboarding
2. home dashboard payload
3. today plan payload
4. quick actions
5. habit, health, and finance records
6. review prefills and submissions
7. goals and priorities

## Testing priorities

### Highest priority

- login guard behavior
- Home render states
- quick capture submission
- review completion gating
- carry-forward UX
- score and attention rendering

### Secondary priority

- edit modals
- filter and tab behavior
- empty and error-state rendering

## Definition of done for frontend handoff

- all MVP routes implemented
- mobile and desktop layouts supported
- quick capture works globally
- review flows save drafts and enforce required fields
- score UI is explainable and stable
- mock service layer can be replaced endpoint by endpoint

## Coordination notes for the frontend agent

- Do not implement backend scoring logic in the client.
- Treat all computed metrics as backend-owned.
- Prefer additive integration: wire real endpoints one feature at a time instead of flipping the whole app at once.
- Keep component APIs stable so parallel design and backend integration work can proceed without major rewrites.
