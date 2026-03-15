# Copilot Instructions — Life OS

## Architecture

Life OS is a self-hosted personal command-center (daily planning, habits, health, finances, reviews). It is a **npm workspaces monorepo** with three packages:

| Workspace | Path | Stack |
|---|---|---|
| **Client** | `client/` | React 18 · Vite · React Router v6 · TanStack Query v5 · plain CSS with design-token custom properties |
| **Server** | `server/` | Fastify 5 · Prisma 6 · PostgreSQL · Zod · Vitest |
| **Contracts** | `packages/contracts/` | TypeScript-only shared request/response types (zero runtime deps) |

The client proxies `/api` to the server during development. All API routes are mounted under `/api` on the server (see `server/src/modules/index.ts`).

### Module structure

Both client and server are organized by **feature domain** (auth, habits, health, finance, goals, planning, reviews, scoring, notifications, settings, onboarding, home).

**Server module pattern** — each module in `server/src/modules/<domain>/` contains:

- `routes.ts` — Fastify route handlers, exported as `registerXxxRoutes` (a `FastifyPluginAsync`)
- `service.ts` — business logic (when needed)
- Additional files for rate-limiting, helpers, etc.

Modules are registered in `server/src/modules/index.ts`.

**Client feature pattern** — each feature in `client/src/features/<domain>/` contains page components (`*Page.tsx`). Shared UI lives in `client/src/shared/ui/`. All API calls go through TanStack Query hooks in `client/src/shared/lib/api.ts`.

### Key conventions

- **Contracts are the API contract** — `packages/contracts/` defines all request/response types shared between client and server. `docs/prd/api-contracts.md` is the canonical API surface spec.
- **Server-side scoring** — all score calculations and review aggregation logic lives on the server, never the client.
- **Session-based auth** — cookie-based sessions with httpOnly cookies, CSRF token protection on mutating requests, and Argon2 password hashing. Auth context is injected via Fastify request hook (`request.auth`).
- **Error handling** — server uses `AppError` class (`server/src/lib/errors/app-error.ts`) with `statusCode`, `code` (from `ApiErrorCode`), and optional `fieldErrors`. All error responses conform to the `ApiError` shape from contracts.
- **Validation** — use Zod schemas + `parseOrThrow()` (`server/src/lib/validation/parse.ts`) for request body validation in route handlers.
- **Response helpers** — wrap responses with `withGeneratedAt()` for reads and `withWriteSuccess()` for mutations (`server/src/lib/http/response.ts`).

### Workspace ownership boundaries

- **Backend work** owns `server/` and `packages/contracts/`.
- **Frontend work** owns `client/` only — never edit `server/` or `packages/contracts/`.
- Contracts are frozen phase-by-phase; check `docs/prd/api-contracts.md` before adding new ones.

## Build, typecheck, and dev

```bash
npm install                       # install all workspaces
npm run build                     # build contracts → server → client (in order)
npm run typecheck                 # typecheck all three workspaces

npm run dev:client                # Vite dev server (port 5174, proxies /api to backend)
npm run dev:server                # tsx watch server (auto-restarts on changes)
```

Per-workspace builds:

```bash
npm run build -w packages/contracts
npm run build -w server
npm run build -w client
```

## Testing

Tests exist in the server workspace only (Vitest):

```bash
npm test -w server                # run all tests once
npm run test:watch -w server      # watch mode
npm run test:coverage -w server   # coverage report (thresholds: 60% lines/functions/statements, 50% branches)
```

Run a single test file:

```bash
npx vitest run test/modules/auth/routes.test.ts -w server
```

Server tests live in `server/test/`, mirroring the source structure. Tests use Vitest globals (`describe`, `it`, `expect`, `vi` are available without imports).

## Database

PostgreSQL via Prisma. Schema is at `server/prisma/schema.prisma`.

```bash
npm run prisma:migrate -w server   # create/apply migrations
npm run prisma:generate -w server  # regenerate Prisma client after schema changes
```

## Documentation

- `docs/prd/README.md` — reading order for all product/architecture specs
- `docs/prd/api-contracts.md` — canonical API surface
- `docs/prd/data-model.md` — PostgreSQL schema design
- `docs/prd/scoring-system.md` — scoring rules and anti-gaming logic
- `docs/implementation/` — phase-by-phase implementation plans and checklists
