# Life OS Agent Guide

Life OS is a TypeScript monorepo for a personal command center: daily planning, inbox capture, focus sessions, goals, habits, health, finance, reviews, notifications, and settings. Treat this file as the compact context an AI agent should read before working in the repo.

## Workspace Map

- `client/`: Vite + React frontend. App bootstrap, router, providers, and shell live in `client/src/app`. Feature UI lives in `client/src/features/<domain>`. Shared browser API hooks, formatting, date, parsing, recurrence, and navigation helpers live in `client/src/shared/lib`. Reusable UI primitives live in `client/src/shared/ui`. Global CSS is split across `client/src/styles/*.css`, with `client/src/styles.css` as the entrypoint.
- `server/`: Fastify API, Prisma data layer, workers, and CLI tools. Bootstrap and env loading live in `server/src/app`. Domain modules live in `server/src/modules/<domain>`. Cross-module backend helpers live in `server/src/lib/<concern>`. Worker entrypoints live in `server/src/jobs`. Admin and maintenance CLIs live in `server/src/cli`.
- `packages/contracts/`: shared API request/response types and schemas exported from `packages/contracts/src/index.ts`. Update this workspace when frontend and backend contracts change.
- `server/prisma/`: PostgreSQL Prisma schema and migrations.
- `docs/prd/`: active product, architecture, API, data model, security, scoring, and screen references. Start with `docs/prd/README.md`.
- `docs/implementation/`: active implementation, operations, deployment, backup, and handoff docs.
- `docs/user/`: end-user documentation.
- `docs/archive/`: historical plans, prompts, reviews, and superseded docs. Use only for background.

## Product And Module Context

Primary shipped surfaces are `/home`, `/inbox`, `/today`, `/planner`, `/habits`, `/health`, `/meals`, `/finance`, `/goals`, `/reviews/:cadence`, `/reviews/history`, and `/settings`, plus `/login` and `/onboarding`.

Backend modules currently cover `admin`, `auth`, `finance`, `focus`, `habits`, `health`, `home`, `notifications`, `onboarding`, `planning`, `reviews`, `scoring`, and `settings`. API routes are registered under `/api`, with `/healthz` as the service health check.

Use the contracts package and `client/src/shared/lib/api/*` as the frontend/backend boundary. Prefer updating typed contracts, server validation, client API hooks, and UI consumers together instead of letting request shapes drift.

## Commands

- `npm install`: install all workspaces and generate the Prisma client.
- `npm run build`: build contracts, server, and client.
- `npm run typecheck`: run TypeScript checks for all workspaces.
- `npm run test -w server`: run backend Vitest tests.
- `npm run test:coverage -w server`: run backend tests with coverage before merge-level backend changes.
- `npm run prisma:migrate -w server`: create/apply local Prisma migrations after schema changes.
- `npm run users:interactive`: open the interactive user admin CLI when a human explicitly asks for account management.

Agents must not run `npm run dev`, `npm run dev:client`, `npm run dev:server`, `npm run start -w server`, `npm run preview -w client`, or worker processes. Assume runtime servers are managed in another terminal; use build, typecheck, and tests for verification, and leave live runtime checks to the user.

## Coding Standards

Use TypeScript, 2-space indentation, semicolons, and double quotes. Match local style because there is no repo-wide ESLint or Prettier config. Prefer PascalCase for React components, camelCase for functions and variables, and descriptive kebab-case filenames for backend modules and tests.

Keep code close to its domain. Add frontend behavior under the relevant `client/src/features/<domain>` folder unless it is truly reusable. Add backend behavior under the relevant `server/src/modules/<domain>` folder; use `server/src/lib` only for cross-module concerns such as auth, errors, HTTP responses, recurrence, security, time, or validation.

Keep functions focused, side effects explicit, and error messages user-safe. Validate inputs at API boundaries. Avoid broad `utils` or `helpers` files; extract small, named domain helpers only when they reduce real duplication or clarify a workflow.

## Frontend Notes

The client uses React Router, TanStack Query, and shared API hooks from `client/src/shared/lib/api`. Prefer existing hooks, query keys, UI primitives, and CSS patterns before adding new abstractions. Keep app-level providers and shell concerns in `client/src/app`; keep route/feature workflows in `client/src/features`.

When changing UI behavior, preserve responsive layouts and update the relevant stylesheet in `client/src/styles`. There is no committed client test runner, so include manual verification notes in PRs for UI changes.

## Backend Notes

The server uses Fastify, Zod, Prisma, cookie auth, CSRF protection, and PostgreSQL. `server/src/app/env.ts` loads `ENV_FILE`, then `server/.env.<NODE_ENV>`, then `server/.env`. Never hardcode secrets or environment-specific database URLs.

Keep controllers/routes thin: parse input, call domain services, and return typed responses. Keep Prisma access inside repositories or focused services in the owning module. Add or update Prisma migrations whenever `server/prisma/schema.prisma` changes.

## Testing

Server tests use Vitest under `server/test/**/*.test.ts`; mirror source/module structure where practical and keep shared test helpers in `server/test/utils`. Coverage thresholds in `server/vitest.config.ts` are 60% for lines/functions/statements and 50% for branches. Add or update backend tests whenever behavior changes, especially for services, routes, recurrence, scoring, reminders, finance, planning, and auth/security flows.

## Security And Data Safety

Do not commit `server/.env*`, secrets, production credentials, generated coverage, `dist`, or `node_modules`. Keep development and production databases separate. Be careful with user/account CLI commands and production deployment scripts; run them only when explicitly requested.

## Git And PRs

The repo uses Conventional Commit-style subjects such as `feat(finance): ...` and `fix(config): ...`; keep subjects imperative. PRs should summarize the user-visible change, list affected workspaces (`client`, `server`, `packages/contracts`), mention schema or env changes, include screenshots for UI changes, and link the relevant issue or product/implementation doc when applicable.
