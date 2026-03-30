# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important Operating Rules

- **DO NOT RUN `npm run dev`** — the server and client are already running in the environment.
- **NO BROWSER TESTING** — validate via TypeScript typecheck, server-side tests, production builds, and code review only.
- **Scoring is backend-only** — never calculate or derive scores on the client.

## Commands

```bash
# Development
npm run dev              # Start server + client together (server:3004, client:5174)
npm run dev:client       # Vite only (port 5174, proxies /api → backend)
npm run dev:server       # Fastify with tsx watch
npm run dev:worker       # Background job worker (separate process)

# Build
npm run build            # Build contracts → server → client (in order)
npm run typecheck        # TypeScript strict check across all workspaces

# Testing (server only)
npm test -w server                # Run Vitest suite once
npm run test:watch -w server      # Watch mode
npm run test:coverage -w server   # Coverage report (thresholds: 60% lines/functions/statements, 50% branches)

# Database
npm run prisma:migrate -w server  # Create + apply migrations
npm run prisma:generate -w server # Regenerate Prisma client after schema changes

# CLI utilities
npm run users -w server                      # User management CLI
npm run task-reminders:backfill -w server    # Backfill task reminders
```

## Monorepo Structure

Three npm workspaces:

| Workspace | Port | Purpose |
|-----------|------|---------|
| `client/` | 5174 | React 18 + Vite + React Router v6 + TanStack Query v5 |
| `server/` | 3004 | Fastify 5 + Prisma 6 + PostgreSQL |
| `packages/contracts/` | — | Shared TypeScript types (zero runtime deps) |

`packages/contracts/` is the **source of truth for all API shapes**. Both client and server import from it. Contract changes must be coordinated; server owns evolution.

## Backend Architecture

### Module Pattern

Each feature domain under `server/src/modules/<domain>/` follows:
```
routes.ts         → Fastify plugin entry point, registers sub-routes
*-routes.ts       → Specific route handlers
*-service.ts      → Business logic
*-repository.ts   → Query builders (optional)
*-mappers.ts      → Transform Prisma models → API DTOs
*-schemas.ts      → Zod validation schemas
```

Domains: `auth`, `habits`, `planning`, `reviews`, `scoring`, `health`, `finance`, `home`, `notifications`, `onboarding`, `settings`, `admin`.

### Request Handling Pattern

```typescript
app.post("/resource", async (request, reply) => {
  const user = requireAuthenticatedUser(request); // throws 401 if not authed
  const payload = parseOrThrow(createSchema, request.body); // Zod validation
  const result = await service.create(app.prisma, user.id, payload);
  return reply.send(withWriteSuccess({ resource: toResourceDto(result) }));
});
```

### Key Server Utilities

- `AppError` (`lib/errors/app-error.ts`) — standardized errors with `statusCode`, `code`, optional `fieldErrors`
- `parseOrThrow(schema, data)` — Zod validation with field error mapping
- `withGeneratedAt(data)` / `withWriteSuccess(data)` — standard response wrappers
- `requireAuthenticatedUser(request)` — throws 401 if unauthenticated
- Auth context available at `request.auth.user` (injected by request context plugin from session cookie)

### Authentication & Security

- Session-based auth with httpOnly cookie (token hash stored in `sessions` table, never plaintext)
- CSRF token generated at login, validated as header on all mutations (GET requests are exempt)
- Passwords hashed with Argon2

### Two Separate Processes

- **API Server** (`src/index.ts`) — handles HTTP requests
- **Worker** (`src/jobs/worker.ts`) — runs scheduled jobs then exits; designed for cron/systemd timer execution

Worker jobs: session cleanup, cycle seeding, daily score finalization, recurring expense materialization, notification rule evaluation, task reminder dispatch.

## Frontend Architecture

### Feature Pattern

`client/src/features/<domain>/` mirrors backend domains plus `today`, `inbox`, `capture`.

Each feature has page component(s) that use TanStack Query hooks from `client/src/shared/lib/api/<domain>.ts`.

### State Layers

1. **Server state** — TanStack Query (HTTP data, caching, invalidation)
2. **Form state** — React useState + controlled inputs
3. **UI state** — useState (dropdowns, modals)
4. **Global feedback** — `AppFeedback` context (toast system)

### API Communication

All HTTP calls go through `apiRequest()` in `shared/lib/api/core.ts`. Queries follow key patterns like `["habits"]`, `["health", "summary"]`. Mutations use meta for toast feedback.

## Key Architectural Details

**Planning Cycles:** The system maintains day/week/month cycles (OPEN → REVIEW_READY → CLOSED). Worker creates cycles in advance; reviews link to cycles, not individual dates.

**Recurrence Materialization:** Recurring tasks/habits/expenses are materialized daily by the worker, not generated on-demand. Carry-forward policy (COMPLETE_AND_CLONE, MOVE_DUE_DATE, CANCEL) is applied at materialization time.

**User Timezone:** All times stored UTC in PostgreSQL. `lib/time/user-time.ts` handles UTC ↔ local conversion using preferences from `user_preferences` table.

**Scoring:** Scores are recalculated after writes (task complete, habit checkin, review finalized) and persisted in `daily_scores`. The worker finalizes yesterday's score daily.

**No caching layer:** PostgreSQL is the single source of truth. No Redis, no process-level caching.

## Coding Conventions

- TypeScript strict mode throughout; `tsconfig.base.json` is shared
- Double quotes, semicolons
- PascalCase for React components; kebab-case for backend files
- No linter configured (no eslint/prettier)
- No CSS framework — plain CSS with design tokens via custom properties

## Documentation

Detailed specs live in `docs/prd/`:
- `technical-architecture.md` — system design and module responsibilities
- `api-contracts.md` — canonical API surface
- `data-model.md` — database design
- `scoring-system.md` — scoring rules
- `authentication-and-security.md` — auth/session details
- `screen-specs.md` — route-level UX reference
