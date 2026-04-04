# Repository Guidelines

## Project Structure & Module Organization
`client/` contains the Vite React frontend. Keep app bootstrap and providers in `client/src/app`, route-facing UI in `client/src/routes` as that area grows, and shared styling in `client/src/styles`. `server/` contains the Fastify API, worker entrypoints, Prisma schema/migrations, and CLI tools. Put backend bootstrap in `server/src/app`, domain logic in `server/src/modules/<domain>`, and reusable helpers in `server/src/lib`. Shared contracts live in `packages/contracts/`. Long-lived product and operating docs belong in `docs/prd`, `docs/implementation`, and `docs/user`; archive-only material goes in `docs/archive`.

## Build, Test, and Development Commands
`npm install` installs all workspaces and generates the Prisma client.

`npm run build` compiles contracts, server, and client for production.

`npm run typecheck` runs TypeScript checks across every workspace.

`npm run test -w server` runs backend tests. Use `npm run test:coverage -w server` before merging backend changes. Use `npm run prisma:migrate -w server` when updating the local schema.

Do not run `npm run dev`, `npm run dev:client`, `npm run dev:server`, `npm run start -w server`, or worker processes from the agent. Assume the app is already running in another terminal; use build, typecheck, and test commands only, and leave runtime verification to the user.

## Coding Style & Naming Conventions
Use TypeScript with the existing style: 2-space indentation, semicolons, and double quotes. Prefer PascalCase for React components, camelCase for functions and variables, and descriptive kebab-case filenames for backend modules and tests such as `task-reminders.ts` or `routes-smoke.test.ts`. Keep domain-specific code close to its module instead of adding generic `utils` files. There is no repo-wide ESLint or Prettier config, so match surrounding code and rely on `npm run typecheck` as the minimum quality gate.

Apply industry-standard quality defaults on every change: keep functions focused and side effects explicit, validate inputs and handle errors with clear user-safe messages, avoid duplication by extracting small domain helpers, preserve module boundaries so UI, business logic, and data access stay separated, and add or update tests whenever behavior changes.

## Testing Guidelines
Server tests use Vitest and live under `server/test/**/*.test.ts`. Mirror the source area in test paths where practical, and keep shared test helpers in `server/test/utils`. Coverage thresholds are enforced in `server/vitest.config.ts`: 60% lines/functions/statements and 50% branches. The client currently has no committed test runner, so document manual verification steps in the PR when changing UI behavior.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commit-style subjects such as `feat(finance): ...` and `fix(config): ...`; use that format when possible and keep subjects imperative. PRs should state the user-visible change, note affected workspaces (`client`, `server`, `packages/contracts`), mention schema or env changes, and include screenshots for UI changes. Link the relevant issue or doc when the change is tied to product work.

## Security & Configuration Tips
Do not commit `server/.env*` files or production secrets. Keep development and production databases separate, and add a Prisma migration whenever `server/prisma/schema.prisma` changes.
