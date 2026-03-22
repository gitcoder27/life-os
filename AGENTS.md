# Repository Guidelines

## Project Structure & Module Organization
`life-os` is a TypeScript monorepo with three workspaces:
- `client/`: Vite + React frontend. Main app code lives in `client/src`, organized by `features/`, `app/`, `routes/`, and `shared/`.
- `server/`: Fastify API, Prisma schema, and CLI/worker code. Runtime code is under `server/src`; tests live in `server/test`; Prisma schema is in `server/prisma/schema.prisma`.
- `packages/contracts/`: shared API contracts and types built to `dist/`.

Product and architecture docs live in `docs/prd/`. Implementation plans and checklists are in `docs/implementation/`.

## Build, Test, and Development Commands
- `npm install`: install all workspace dependencies and generate Prisma client.
- `npm run dev`: start server and client together (`3004` API, `5174` Vite).
- `npm run dev:server`: run the Fastify API with `tsx watch`.
- `npm run dev:client`: run the Vite frontend only.
- `npm run build`: build contracts, server, and client in dependency order.
- `npm run typecheck`: run strict TypeScript checks across all workspaces.
- `npm run test -w server`: run backend tests with Vitest.
- `npm run test:coverage -w server`: run backend tests with coverage thresholds.
- `npm run prisma:migrate -w server`: apply local Prisma migrations.

## Coding Style & Naming Conventions
Use TypeScript with `strict` mode enabled. Follow the existing style: double quotes, semicolons, and small focused modules. Prefer PascalCase for React components (`App.tsx`) and kebab-case for backend files (`build-app.ts`, `require-auth.ts`). Keep feature code inside its domain folder instead of creating generic `utils` buckets.

## Testing Guidelines
Server tests use Vitest with `test/**/*.test.ts` naming. Coverage thresholds are enforced at 60% lines/functions/statements and 50% branches. Add tests next to the relevant backend domain in `server/test` (for example `server/test/modules/auth/service.test.ts`). There is no established client test suite yet, so do not add ad hoc tooling without agreement.

## Commit & Pull Request Guidelines
History mostly follows short imperative subjects, often Conventional Commit style such as `feat(auth): ...` or `refactor: ...`. Use that format when possible and keep scopes meaningful. PRs should include: a concise summary, affected workspaces, test results, linked issue/doc, and screenshots for UI changes. Call out schema, env, or migration changes explicitly.

## Configuration Tips
Use the example env files in `server/.env*.example`; do not commit secrets. Read `docs/prd/README.md` before making structural changes.

## AI Agent Behavior Instructions
When communicating your results back to me, explain what you did and what happened in plain, clear English. Avoid jargon, technical implementation details, and code-speak in your final responses. Write as if you’re explaining to a smart person who isn’t looking at the code. Your actual work (how you think, plan, write code, debug, and solve problems) should stay fully technical and rigorous. This only applies to how you talk to me about it.

Define finishing criteria for yourself before you start: what does "done" look like for this task? Use that as your checklist before you come back to me. If something fails or looks off, fix it and re-test. Don’t just flag it and hand it back. The goal is to keep me out of the loop on iteration. I want to receive finished, working results, not a first draft that needs me to spot-check it. Only come back to me when you’ve confirmed all required codes are done, or when you’ve genuinely hit a wall that requires my input.
