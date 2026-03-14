# Frontend Architecture

This document defines the frontend implementation approach for Life OS MVP. It is written so a frontend-focused AI agent can work in parallel with a backend-focused AI agent without waiting on every backend detail.

## Frontend mission

Build a responsive web app that feels like a calm personal command center:

- fast to open
- easy to scan
- extremely low friction to log into
- reliable on mobile and desktop
- clear about what to do next

## Ownership boundaries

### Frontend owns

- authenticated app shell
- routing and route guards
- screen layout and responsive behavior
- component system and interaction design
- client-side form handling and validation
- optimistic UI for safe quick actions
- loading, empty, success, and error states
- local draft persistence for in-progress forms and reviews

### Backend owns

- authentication and session authority
- persistent data storage
- scoring, momentum, and streak calculations
- review-window rules and finalization rules
- notification generation and delivery state
- all authoritative business logic

### Shared contract

- JSON API over HTTPS
- backend is the source of truth for saved entities and computed metrics
- frontend may derive presentational state, but it must not implement an authoritative duplicate of scoring or review rules
- [`api-contracts.md`](./api-contracts.md) is the canonical endpoint and payload reference

## Recommended stack

- `React` + `TypeScript`
- `Vite` for app tooling
- `React Router` for route structure
- `TanStack Query` for server state and caching
- `React Hook Form` + `Zod` for forms and client validation
- `Zustand` or equivalent lightweight store for UI-only state
- `Tailwind CSS` plus a small design-system layer of reusable primitives

This stack is practical for a fast-moving SPA and fits the product's need for many forms, frequent server reads, and quick action updates.

## App shell

### Authenticated shell

The main shell should have:

- primary navigation
- date and context header
- quick capture trigger available globally
- in-app notifications entry point
- session/account menu

### Desktop behavior

- left sidebar navigation
- sticky top header for page context and global actions
- wide content area with card-based sections

### Mobile behavior

- bottom navigation for primary routes
- sticky compact header
- quick capture as a floating action button or bottom-sheet trigger
- long forms and dense summaries collapsed into sections

## Route map

| Route | Purpose |
| --- | --- |
| `/login` | Owner login |
| `/onboarding` | Initial setup wizard after first login |
| `/` | Home dashboard |
| `/today` | Focused execution view |
| `/habits` | Habit and routine management |
| `/health` | Water, meals, workout, and weight |
| `/finance` | Expense tracking and spending visibility |
| `/goals` | Goals, weekly priorities, monthly focus |
| `/reviews/:cadence` | Daily, weekly, and monthly review flows |

Quick Capture should be a global modal or bottom sheet rather than a standalone full page in MVP.

## Feature boundaries

Use a feature-oriented structure instead of a page-only structure.

Recommended folders:

- `app/`: router, providers, shell, auth guard
- `features/home/`
- `features/today/`
- `features/habits/`
- `features/health/`
- `features/finance/`
- `features/goals/`
- `features/reviews/`
- `features/capture/`
- `features/notifications/`
- `shared/ui/`
- `shared/lib/`

Each feature should contain:

- API hooks
- screen components
- feature-specific subcomponents
- validation schemas
- transformation helpers for DTO-to-UI mapping

## State strategy

### Server state

Use `TanStack Query` for:

- dashboard payloads
- lists and summaries
- review prefills
- score and momentum data
- habit, health, finance, and goal records

### Client UI state

Use a lightweight store only for transient UI concerns:

- quick capture open or closed
- active filter or tab
- mobile drawer state
- pending carry-forward selection
- unsaved draft indicators

### Local form draft persistence

Persist draft state locally for:

- onboarding
- review forms
- quick capture if interrupted
- larger edit forms such as goals or routines

This is important because the product depends on frequent short interactions.

## Data-fetching rules

- Home and Today should request aggregated payloads, not many tiny endpoint calls.
- Feature screens can load summary data plus paginated detail.
- Queries should be keyed per feature and cadence, for example review cadence and date window.
- Quick actions should use optimistic UI only when rollback is straightforward.

### Safe optimistic actions

- habit completion toggle
- water increment
- workout status set
- quick reminder completion

### Non-optimistic or carefully optimistic actions

- expense creation
- review submission
- goal edits
- score-affecting mutations that need authoritative recalculation

## Form patterns

### General rules

- Prefer one-column forms on mobile
- Keep required fields minimal
- Use progressive disclosure for optional inputs
- Default to templates and prefilled values where possible

### Form types

| Form type | Pattern |
| --- | --- |
| Quick capture | Bottom sheet or modal with event-type switcher |
| Habit editor | Slide-over or modal |
| Expense form | Compact inline form or modal |
| Goal editor | Full-page or large modal form |
| Review form | Guided multi-section page with save-draft support |

### Validation rules

- Client validation should block clearly invalid input
- Backend validation remains authoritative
- Validation messages should be direct and field-specific

## Scoring UI requirements

- The frontend displays the Daily Score, Weekly Momentum, score label, and bucket breakdown.
- The backend returns authoritative score data; frontend does not recalculate final scores.
- Low-score states must explain why the score is low through missing buckets or actions.
- Home should show a compact score module.
- Review screens should show the detailed score breakdown.
- Strong day streaks and habit streaks should be visually distinct from the main score.

## Review UI requirements

- Daily, weekly, and monthly reviews should all use the same base shell: summary first, prompts second, outputs last.
- Review progress should be explicit so the user knows what remains required.
- Required versus optional fields must be visually distinct.
- Users should be able to save a draft and return.
- Cadence-specific routes should share most of the component structure.

## Mobile behavior rules

- Keep primary actions thumb-reachable.
- Collapse dense dashboards into stacked cards.
- Avoid multi-column metric layouts below tablet width.
- Keep the score module visible near the top.
- Use bottom sheets for quick capture and small edit flows.
- Preserve unsaved review drafts across route changes and refresh.

## Error and empty-state requirements

- Every screen needs loading, empty, and recoverable error states.
- Empty states should push the next useful action, not just say "no data."
- If a query fails, keep the shell usable and allow retry.
- For partial failures, show stale data with a refresh path when possible.

## Accessibility baseline

- Keyboard navigable shell and forms
- Proper form labels and error messaging
- Focus management for modals and bottom sheets
- Color should not be the only carrier of score meaning
- Tap targets should remain comfortable on mobile

## Frontend testing scope

- Route guards and shell rendering
- Core form validation
- Quick capture flows
- Review completion gating
- Loading and error states
- Score and attention-card rendering
- Mobile navigation and modal behavior

## Frontend-backend integration sequence

### Frontend can start immediately with mocks

- shell and routing
- component primitives
- screen layout
- mock DTOs and fixture data
- review-flow shell
- score display shell

### Frontend should integrate next as backend endpoints land

1. session and onboarding
2. home and today aggregate payloads
3. quick actions for habits and water
4. expense and health mutations
5. review submission and score refresh

## Definition of done for frontend MVP

- all authenticated routes render in the shared shell
- Home, Today, Habits, Health, Finance, Goals, and Reviews work on mobile and desktop
- quick capture is globally accessible
- review flows enforce required fields
- score states are clear and explainable
- optimistic interactions feel fast without creating data confusion
