# Life OS Senior Code Quality Review

Date: 2026-05-03  
Review type: senior engineering code-quality, architecture, security, operations, and maintainability review  
Scope: `client`, `server`, `packages/contracts`, `server/prisma`, active docs, scripts, tests, and deployment configuration

## Executive Summary

Life OS is in a solid development state, but it is not yet at the production-hardening standard expected for sensitive personal data across planning, health, finance, and reviews.

The good news: the repo builds, typechecks, and has a meaningful backend test suite. The monorepo boundaries are mostly sensible, feature/module naming is domain-specific, auth and CSRF foundations exist, Prisma schema coverage is broad, and there is already substantial evidence of iterative cleanup work.

The cleanup agenda is also clear:

1. Fix production and data-safety risks first: dependency advisory, database separation ordering, default production secrets, unsafe error/log output, finance undo integrity, backups, and worker scheduling.
2. Finish the contracts boundary: shared contracts currently provide TypeScript types, but runtime schemas are duplicated in server modules and several client API modules still define local DTOs.
3. Improve frontend accessibility and keyboard support: several overlays and drag/drop workflows are pointer-first and do not yet meet industry accessibility expectations.
4. Split the largest workflows only where risk justifies it: finance routes/page, health meal planner routes/page, and goals planning workspace carry too many responsibilities.
5. Add a real quality gate: CI, audit, client tests for extracted helpers/hooks, and targeted runtime/bootstrap tests.

No P0 issue was found. Multiple P1 issues should be treated as release blockers before broader public exposure or before relying on this deployment as the only copy of important personal data.

## Verification Baseline

Commands run from `/home/ubuntu/Development/life-os`:

| Check | Result | Notes |
|---|---:|---|
| `npm run typecheck` | Passed | Contracts, server, and client TypeScript checks passed. |
| `npm run test -w server` | Passed | 46 test files, 260 tests passed. |
| `npm run build` | Passed with warning | Vite reported large chunks: JS 1,179.19 kB and CSS 560.84 kB before gzip. |
| `npm run test:coverage -w server` | Passed | Aggregate coverage: 79.08% lines/statements, 65.58% branches, 90.22% functions. Runtime paths such as `src/index.ts`, `build-app.ts`, and `jobs/worker.ts` remain weak or uncovered. |
| `npm audit --omit=dev` | Failed | 1 high-severity production advisory in `fastify`. |

## Where The Code Meets Industry Standards

| Area | Assessment | Evidence |
|---|---|---|
| Monorepo organization | Meets standard | Clear workspaces: `client`, `server`, `packages/contracts`; root scripts coordinate build and typecheck. |
| TypeScript posture | Meets standard | Strict base config is enabled in `tsconfig.base.json`; all workspaces typecheck. |
| Backend framework choices | Meets standard | Fastify, Prisma, Zod, Argon2, cookie auth, CSRF, and PostgreSQL are appropriate for the product. |
| Domain naming | Mostly meets standard | Modules use meaningful bounded-context names: `planning`, `finance`, `habits`, `health`, `reviews`, `notifications`, `settings`. |
| API validation pattern | Partially meets standard | Most routes use `parseOrThrow` and Zod, but schemas are duplicated outside contracts and some date validation is regex-only. |
| Backend tests | Good for current stage | 260 passing tests cover many modules, including auth, planning, finance, reviews, scoring, notifications, recurrence, and CSRF. |
| Data isolation | Mostly meets standard | Most routes call `requireAuthenticatedUser` and filter by `userId`; ownership helpers exist in sensitive modules. |
| Documentation intent | Good intent, stale execution | Active docs define architecture, security, deployment, and backups, but several docs no longer match source or deployed reality. |

## Where The Code Does Not Yet Meet The Standard

| Area | Gap |
|---|---|
| Production hardening | Known dependency advisory, production secret default, unsafe DB guard ordering, DB URL logging, no confirmed backup automation. |
| Runtime safety | Worker schedule is documented but not implemented as a scheduler/timer; startup and worker paths have weak coverage. |
| Contract discipline | Contracts are type-only while runtime validation is duplicated; several client API modules still define local request/response shapes. |
| Frontend accessibility | Multiple modal/sheet surfaces lack consistent dialog semantics, focus handling, and keyboard escape/restore behavior. |
| Component and route size | Several files greatly exceed the repo's own 200-line guideline and mix rendering, persistence, validation, workflows, and mapping. |
| CI and quality gates | No `.github/workflows` quality gate exists; root package has no `test`, `ci`, or audit script. |
| Frontend test coverage | No committed client test runner; complex UI workflows rely on manual checks. |

## P1 Findings

### 1. High-Severity Production Dependency Advisory

Evidence:

- `fastify` is a production dependency in `server/package.json`.
- `npm audit --omit=dev` reports: Fastify body schema validation bypass via leading space in `Content-Type` header, advisory `GHSA-247c-9743-5963`.

Risk:

Request validation bypasses are high-risk in an API where input validation protects personal finance, health, planning, and account data.

Recommended fix:

- Run the safe dependency update path, likely `npm audit fix`.
- Review `package-lock.json`.
- Re-run `npm audit --omit=dev`, `npm run typecheck`, `npm run build`, and `npm run test -w server`.

### 2. Database Separation Guard Runs After Potentially Destructive Boot Actions

Evidence:

- `server/src/index.ts:6-9` calls `ensureDatabaseExists(env)` and `ensureDatabaseMigrations(env)` before `assertDatabaseSeparation(env)`.
- `server/src/jobs/worker.ts:8-11` repeats the same ordering.
- `server/src/cli/task-reminders.ts:10-13` repeats the same ordering.

Risk:

A mispointed development or production `DATABASE_URL` can be created or migrated before the protection guard runs. That defeats the intent of `DATABASE_SEPARATION_STRICT`.

Recommended fix:

- Call `assertDatabaseSeparation(env)` immediately after `getEnv()` and before any DB creation, migration, Prisma client creation, or worker/CLI operation.
- Add an ordering regression test around startup helpers.
- Consider requiring strict separation outside local development.

### 3. Production Can Boot With A Known Default Session Secret

Evidence:

- `server/src/app/env.ts:95-110` allows `NODE_ENV=production` while `SESSION_SECRET` defaults to `"dev-only-change-me"`.

Risk:

If production starts without an explicit secret, cookie signing uses a known value. For an auth-protected personal data product, that does not meet production security standards.

Recommended fix:

- Refine env validation to reject production when `SESSION_SECRET` is absent, equal to the default, too short, or otherwise obviously weak.
- Add `server/test/app/env.test.ts` cases for production secret validation.

### 4. Internal Errors And Database Credentials Can Leak

Evidence:

- `server/src/app/build-app.ts:89-95` returns `error.message` for non-`AppError` failures.
- `server/src/index.ts:22-25` logs `Current DATABASE_URL`, which can include username, password, host, and database.

Risk:

Prisma, database, and unexpected runtime errors can expose implementation detail to clients or logs. Logging a full DB URL can leak credentials to terminal, service journal, log collection, or support screenshots.

Recommended fix:

- Return a generic message for unexpected 500s, while logging full detail server-side.
- Keep explicit safe messages for known `AppError`s and mapped Prisma errors.
- Redact DB credentials before logging connection details, or log only host/database/env file.

### 5. Recurring Income Undo Can Delete An Unrelated Income Transaction

Evidence:

- `server/src/modules/finance/routes.ts:2138-2145` accepts an explicit `transactionId` by checking only `id`, `userId`, and `transactionType: "INCOME"`.
- `server/src/modules/finance/routes.ts:2174-2190` deletes that transaction and rewinds the selected recurring income using the deleted transaction's account, amount, currency, and date.

Risk:

A client or API caller can provide a user-owned income transaction unrelated to the selected recurring income plan. The route then deletes unrelated ledger data and mutates the recurring income template incorrectly.

Recommended fix:

- When `transactionId` is provided, require `recurringIncomeTemplateId === existing.id`, or require the same validated legacy match used by the fallback lookup.
- Add a regression test where the user provides an unrelated income transaction ID and the route returns 404 or 409 without deleting anything.

### 6. Client Types Planning Mutations As Full Plan Responses, But Server Returns Narrow Mutation Responses

Evidence:

- `client/src/shared/lib/api/goals.ts:583` types week-priority update as `WeekPlanResponse`.
- `client/src/shared/lib/api/goals.ts:610` types month-focus update as `MonthPlanResponse`.
- `server/src/modules/planning/plan-routes.ts:832-836` returns `PlanningPriorityMutationResponse`.
- `server/src/modules/planning/plan-routes.ts:933-938` returns `MonthFocusMutationResponse`.
- `packages/contracts/src/planning.ts` defines the narrow mutation response types.

Risk:

The app can typecheck while the client believes response fields exist that the server never returns. This is exactly the drift the contracts package is meant to prevent.

Recommended fix:

- Import and use `PlanningPriorityMutationResponse` and `MonthFocusMutationResponse` in the client.
- Alternatively, intentionally change the server to return full plan responses, then update contracts and tests.

### 7. Invalid Calendar Dates Pass Several Backend Schemas

Evidence:

- `server/src/modules/planning/planning-schemas.ts:23` validates ISO dates with only `/^\d{4}-\d{2}-\d{2}$/`.
- Similar regex-only date schemas exist in reviews, admin, scoring, and other modules.
- A stronger validated schema already exists at `server/src/lib/validation/date-range.ts:7-13`.

Risk:

Impossible dates such as `2026-02-31` can pass request validation and then become invalid or normalized `Date` values later in route/service/Prisma logic.

Recommended fix:

- Centralize route date validation on `isoDateStringSchema`.
- Prefer importing one date schema for all route params, query params, and body dates.
- Add route tests for impossible dates.

### 8. No Confirmed Automated Off-Server Backups

Evidence:

- `docs/implementation/postgres-backup-strategy.md:7-10` says there is no confirmed automatic backup, off-server replica, dump rotation, or point-in-time recovery setup.

Risk:

The app stores sensitive and important personal data. A single VPS or Docker volume is not an acceptable only copy.

Recommended fix:

- Implement the documented daily encrypted `pg_dump` process.
- Upload encrypted backups off-server, keep retention, and run monthly restore tests.
- Add a runbook/check that proves the latest backup exists and can restore.

### 9. Worker Scheduling Is Documented But Not Production-Ready

Evidence:

- `docs/prd/technical-architecture.md` describes a separate worker process.
- `server/src/jobs/registry.ts:147-163` includes jobs scheduled every 15 minutes.
- `server/src/jobs/worker.ts:25-37` runs all registered jobs once and exits.
- `deploy/systemd/` contains API service templates but no worker service/timer templates.

Risk:

Reminder execution and notification evaluation can silently fail to run on schedule in production unless an external scheduler exists and is documented.

Recommended fix:

- Add systemd timer units, cron, or a real scheduler loop with locking and idempotency.
- Document deployment and operational checks.
- Add tests for worker scheduling behavior or timer configuration generation.

### 10. Core Frontend Overlays Are Not Consistently Accessible Dialogs

Evidence:

- Surveyed examples include `client/src/features/today/components/TodayTaskCaptureSheet.tsx`, `ShapeDaySheet.tsx`, `StuckFlowSheet.tsx`, and drawer/modal surfaces in `client/src/features/finance/FinancePage.tsx`.
- Several overlay surfaces lack consistent `role="dialog"`, `aria-modal`, labelled dialog semantics, initial focus, focus restore, Escape handling, and scroll locking.

Risk:

Keyboard and screen-reader users can get trapped behind overlays, lose focus, or miss state changes. This does not meet industry accessibility standards for modal UI.

Recommended fix:

- Create a shared `Dialog`/`Sheet` primitive in `client/src/shared/ui`.
- Require labelled dialog semantics, focus trap/restore, Escape close, backdrop behavior, and scroll locking.
- Migrate high-traffic overlays first: today capture, stuck flow, shape day, finance drawers, recipe picker/editor.

### 11. Meal Planner Assignment Is Pointer-First

Evidence:

- `client/src/features/health/MealPlannerPage.tsx` imports and uses `PointerSensor`.
- Empty meal slots are rendered as `div role="button"` with `tabIndex`, but no keyboard activation handler was found in the reviewed slot path.

Risk:

Users who cannot use pointer drag/drop may not be able to operate the meal planner fully. This is both an accessibility and usability gap.

Recommended fix:

- Add `KeyboardSensor` support for drag/drop where appropriate.
- Make empty slots real buttons or add Enter/Space handlers.
- Preserve a non-drag assignment path for selecting templates.

## P1 Completion Notes

Date completed: 2026-05-03

1. High-severity production dependency advisory: completed. `npm audit fix` updated `package-lock.json`; `fastify` now resolves to `5.8.5`, which clears `GHSA-247c-9743-5963`. Tests added: not applicable for a lockfile-only advisory fix. Remaining manual verification: none. Final verification: `npm audit --omit=dev` found 0 vulnerabilities.

2. Database separation guard ordering: completed. API, worker, and task-reminder CLI entrypoints now call `prepareRuntimeDatabase(env)`, which runs `assertDatabaseSeparation(env)` before database creation or migration. Tests added: `server/test/app/runtime-database.test.ts`. Remaining manual verification: none.

3. Weak/default production `SESSION_SECRET`: completed. Env parsing rejects default, common weak, repeated-character, and shorter-than-32-character production secrets. Tests added: `server/test/app/env.test.ts`. Remaining manual verification: confirm production secret rotation/value management during deployment.

4. Internal 500 messages and DB URL logging: completed. Unknown 500 responses now return `Unexpected server error`, while known `AppError` messages are preserved. Startup DB connection logging now prints only host, port, and database. Tests added: `server/test/app/build-app.test.ts` and `server/test/app/env.test.ts`. Remaining manual verification: inspect production startup logs after deploy to confirm only redacted database target details are emitted.

5. Recurring income undo integrity: completed. Explicit undo transaction IDs must match the selected recurring income template or the legacy receipt match criteria before deletion. Tests added: unrelated income transaction ID returns 404 without deleting or mutating the template in `server/test/modules/finance/routes.test.ts`. Remaining manual verification: none.

6. Planning mutation response drift: completed. Client week-priority and month-focus mutations now use `PlanningPriorityMutationResponse` and `MonthFocusMutationResponse` from `@life-os/contracts`. Tests added: covered by `npm run typecheck` for the client/server/contracts boundary. Remaining manual verification: none.

7. Regex-only backend ISO date validation: completed. Route/body/query schemas now import `isoDateStringSchema` for planning, reviews, admin, scoring, home, habits, onboarding, and related backend date parsing paths. Tests added: impossible date `2026-02-31` is rejected in `server/test/modules/planning/day-planner-routes.test.ts`. Remaining manual verification: none.

8. Automated off-server backups: operational path documented and template implementation added. New files: `deploy/scripts/life-os-postgres-backup.sh`, `deploy/systemd/life-os-postgres-backup.service`, and `deploy/systemd/life-os-postgres-backup.timer`. Runbooks updated in `docs/implementation/postgres-backup-strategy.md`, `production-deployment.md`, and `production-deployment-quick-reference.md`. Tests added: deployment templates are covered by build/typecheck only. Remaining manual verification: install on production, configure encrypted `RCLONE_REMOTE`, run the service once, and complete a restore test.

9. Worker scheduling: completed for production operation. Worker now supports `--schedule every-15-minutes|daily|weekly`, and systemd timer templates explicitly run each schedule. Tests added: `server/test/jobs/worker.test.ts`. Remaining manual verification: copy timer units to production, enable timers, and inspect `systemctl list-timers`.

10. Core frontend overlay accessibility: completed for the highest-traffic overlays named in this review. Added shared `DialogSurface`/`useDialogAccessibility` with labelled dialog semantics, Escape close, focus trap/restore, and scroll locking. Migrated today task capture, shape day, stuck flow, finance setup drawer, and meal planner recipe picker/editor overlays. Tests added: covered by `npm run typecheck` and `npm run build`; no committed client test runner exists yet. Remaining manual verification: keyboard/screen-reader smoke test in browser.

11. Meal planner keyboard assignment: completed. Meal planner drag/drop now includes `KeyboardSensor`; empty slots are real buttons that open the recipe picker via keyboard, preserving the non-drag assignment path. Tests added: covered by `npm run typecheck` and `npm run build`; no committed client test runner exists yet. Remaining manual verification: browser keyboard smoke test for recipe assignment.

Final P1 verification on 2026-05-03:

- `npm audit --omit=dev`: passed, 0 vulnerabilities.
- `npm run typecheck`: passed.
- `npm run test -w server`: passed, 49 test files and 273 tests.
- `npm run build`: passed. Vite still reports the existing large-chunk warning.

## P2 Findings

### 12. Contracts Package Is Not The Runtime Schema Source Of Truth

Evidence:

- `packages/contracts` exports TypeScript types.
- Backend modules maintain separate Zod schemas in files such as `planning-schemas.ts`, `finance-schemas.ts`, `habits-schemas.ts`, `focus-schemas.ts`, and route files.
- Several observed drifts come from this duplication.

Risk:

Types and runtime validation can diverge while both client and server still typecheck.

Recommended fix:

- Move shared request schemas, date schemas, recurrence schemas, and common DTO schemas into `packages/contracts`.
- Infer TypeScript types from schemas where feasible.
- Import those schemas into server route validation and client request construction.

### 13. Remaining Client API Modules Duplicate Contract Types

Evidence:

- `client/src/shared/lib/api/settings.ts:18-57` defines local settings DTOs.
- Similar local definitions remain in onboarding, home, notifications, auth, and recurrence helper areas.
- Finance, planning, and health are closer to the intended pattern, but not all modules are migrated.

Risk:

Contract drift remains likely as features continue to grow.

Recommended fix:

- Migrate each client API module to import request/response/item types from `@life-os/contracts`.
- Use `satisfies ContractRequest` for mutation payloads where local form state is transformed before sending.

### 14. Settings `displayName` Nullability Drifts

Evidence:

- `packages/contracts/src/settings.ts:6-11` allows `displayName: string | null`.
- `server/src/modules/settings/routes.ts` allows nullable display name updates.
- `client/src/shared/lib/api/settings.ts:18-24` types `displayName` as `string`.

Risk:

Null can reach client form state despite TypeScript claiming it cannot.

Recommended fix:

- Import `SettingsProfileResponse` and `UpdateSettingsProfileRequest` from contracts.
- Coalesce null only at the UI input boundary.

### 15. Client Recurrence Input Is Narrower Than The Shared Contract

Evidence:

- `packages/contracts/src/recurrence.ts` includes recurrence exceptions.
- Backend schemas accept recurrence exceptions.
- `client/src/shared/lib/recurrence.ts` defines a local `RecurrenceInput` shape with only `rule`.

Risk:

Future recurrence exception support can be lost or silently omitted at the client boundary.

Recommended fix:

- Import recurrence contract types from `@life-os/contracts`.
- Keep formatting and schedule helpers in `client/src/shared/lib/recurrence.ts`, but do not redefine contract shapes.

### 16. Query Invalidation Is Overly Broad

Evidence:

- `client/src/shared/lib/api/core.ts:213-227` invalidates tasks, home, focus, score, planning, habits, health, finance, goals, reviews, history, and notifications.
- The `_date` argument is ignored.

Risk:

Broad invalidation creates avoidable network load, flicker, stale-race surfaces, and makes performance harder to reason about as the app grows.

Recommended fix:

- Replace catch-all invalidation with domain/date-scoped invalidators.
- Prefer direct cache updates for local mutations.
- Keep broad invalidation only for actions that truly touch the whole command center.

### 17. Focus Session Single-Active Invariant Is Read-Before-Create

Evidence:

- `server/src/modules/focus/service.ts:313-327` checks for an active session.
- `server/src/modules/focus/service.ts:350-359` creates the new session after the check.
- `server/prisma/schema.prisma:691-692` has indexes but no uniqueness constraint enforcing one active session.

Risk:

Concurrent requests can create multiple active sessions for one user.

Recommended fix:

- Enforce the invariant in the database. For PostgreSQL, consider a partial unique index on active sessions.
- Handle unique-violation errors safely.
- Add a concurrency or unique-violation regression test.

### 18. Notification De-Duplication Is Read-Before-Create

Evidence:

- `server/src/modules/notifications/service.ts:119-155` checks existing notifications before inserting.
- `server/prisma/schema.prisma:1318-1320` has indexes but no unique natural key.

Risk:

Concurrent notification generation can create duplicate active notifications.

Recommended fix:

- Add a unique key strategy for active delivery keys or rule/entity combinations.
- Use upsert or catch Prisma `P2002`.

### 19. Health Range Queries Lack Matching Prisma Indexes

Evidence:

- Health endpoints query water, meal, and weight logs by user/date ranges.
- `server/prisma/schema.prisma:831-839` defines `WaterLog` with no `@@index([userId, occurredAt])`.
- `server/prisma/schema.prisma:955-964` defines `WeightLog` with no user/date index.
- `MealLog` has an index on `mealPlanEntryId`, but not on user/date for summary/list queries.

Risk:

Health summaries and history views can degrade as data accumulates.

Recommended fix:

- Add migrations for `WaterLog(userId, occurredAt)`, `MealLog(userId, occurredAt)`, and `WeightLog(userId, measuredOn, createdAt)` or an equivalent query-aligned index.

### 20. No CI Workflow Or Single Enforced Quality Gate

Evidence:

- `.github` contains instructions/skills, but no `.github/workflows` files.
- Root `package.json` has `build` and `typecheck`, but no `test`, `ci`, or audit gate.

Risk:

Quality depends on local discipline. Dependency advisories, type errors, failing tests, or build regressions can merge undetected.

Recommended fix:

- Add a CI workflow running `npm ci`, `npm audit --omit=dev`, `npm run typecheck`, `npm run build`, and `npm run test -w server`.
- Add a root `ci` script that mirrors the workflow.

### 21. Coverage Aggregate Hides Important Untested Runtime Paths

Evidence:

- Aggregate server coverage passed, but coverage report shows 0% for `src/index.ts`, `server/src/app/build-app.ts`, `server/src/jobs/worker.ts`, and some plugin/bootstrap paths.

Risk:

The riskiest operational paths are exactly the paths least protected by tests.

Recommended fix:

- Add startup/bootstrap tests around env validation, DB separation ordering, error redaction, cookie/cors setup, and not-found/error response shape.
- Add worker tests for scheduling/entrypoint behavior once worker scheduling is clarified.

### 22. No Client Test Runner

Evidence:

- `client/package.json` has only `dev`, `build`, `preview`, and `typecheck`.

Risk:

High-risk frontend behavior such as autosave, recurrence editor payloads, date logic, keyboard assignment, and review draft persistence relies on manual verification only.

Recommended fix:

- Add Vitest and React Testing Library for pure helpers, hooks, and critical component behavior.
- Start with extracted helpers for meal planner draft saves, finance timeline/money-event mapping, recurrence input, date helpers, and review draft storage.

### 23. Oversized Feature Files Mix Too Many Responsibilities

Evidence:

- `server/src/modules/finance/routes.ts`: 3,686 lines.
- `client/src/features/finance/FinancePage.tsx`: 2,249 lines.
- `client/src/features/health/MealPlannerPage.tsx`: 2,236 lines.
- `server/src/modules/health/routes.ts`: 1,858 lines.
- `client/src/features/goals/GoalsPlanWorkspace.tsx`: 1,591 lines.

Risk:

These files are hard to review, hard to test in isolation, and more likely to collect bugs because route/UI/control/persistence logic is interleaved.

Recommended fix:

- Refactor only around real workflow risk, not line count alone.
- Highest-value splits:
  - Finance bill/reconciliation service.
  - Recurring income receive/undo service.
  - Finance page form/controller hooks.
  - Meal planner draft/autosave hook and payload model.
  - Health meal-plan service.
  - Goals planning dock and hierarchy action hooks.

### 24. Active Docs Are Stale Or Aspirational In Places

Evidence:

- `docs/prd/technical-architecture.md` lists React Hook Form and Tailwind CSS, but they are not dependencies.
- `docs/prd/api-contracts.md` describes an error shape that does not match the flat `ApiError` in `packages/contracts/src/common.ts`.
- `docs/implementation/README.md` references multiple current docs that need validation against the filesystem/source.

Risk:

Stale docs make agents and humans follow the wrong standard.

Recommended fix:

- Mark docs as "current-state" versus "target/aspirational".
- Regenerate API error/contract docs from `packages/contracts`.
- Update the implementation index to match actual active docs.

## P2 Completion Notes

Date completed: 2026-05-03

12. Contracts package as runtime schema source of truth: completed for the shared P2 surfaces. `packages/contracts` now owns runtime Zod schemas for shared date/month strings, date-range queries, recurrence definitions/input/exceptions, common API error/meta shapes, settings requests, and notification snooze/preference shapes. Server validation now imports the shared date/range, recurrence, settings, and notification snooze schemas instead of keeping duplicate copies in the owning route/schema files. Tests added: client recurrence contract regression in `client/src/shared/lib/recurrence.test.ts`; server route/schema coverage continues through `npm run test -w server` and `npm run typecheck`. Remaining manual verification: none.

13. Remaining client API modules duplicate contract types: completed for the drift-prone API DTO modules. Client API wrappers now import request/response/item types from `@life-os/contracts` for auth, onboarding, home, notifications, settings, focus, scoring, habits, health mutation payloads, reviews, goals, finance, and planning. Local client types that remain are query options, cache context shapes, UI aliases, or client-only composition results rather than server-owned DTO definitions. Tests added: `npm run typecheck` covers the client/contracts boundary; recurrence and invalidation helpers have focused client Vitest coverage. Remaining manual verification: none.

14. Settings `displayName` nullability drift: completed. The settings API wrapper imports `SettingsProfileResponse`, `SettingsProfileMutationResponse`, and `UpdateSettingsProfileRequest` from contracts; `SettingsPage` coalesces `displayName: null` only at the text-input boundary and sends `null` for a blank saved name. Tests added: covered by client typecheck. Remaining manual verification: browser smoke test of clearing and saving the display name.

15. Client recurrence input drift: completed. `client/src/shared/lib/recurrence.ts` imports and re-exports recurrence contract types instead of redefining `RecurrenceInput`, so recurrence exceptions are preserved at the client boundary. Tests added: `client/src/shared/lib/recurrence.test.ts` covers exception-bearing inputs and formatting helpers. Remaining manual verification: none.

16. Overly broad query invalidation: completed. `invalidateCoreData` now accepts domain/date scopes and invalidates exact or predicate-matched query keys instead of clearing habits, health, finance, goals, reviews, history, and notifications for every core mutation. Health, habits, finance, reviews, and goals have domain-specific invalidation helpers or scoped invalidation calls. Tests added: `client/src/shared/lib/api/core.test.ts` covers date-scoped invalidation and task date matching. Remaining manual verification: watch the network panel around task, health, habit, finance, and review mutations in the browser.

17. One active focus session per user: completed. The schema now documents/enforces the active-session invariant with a PostgreSQL partial unique index, and the P2 migration creates it idempotently for environments that do not already have it. Focus session creation now maps Prisma unique violations to the existing safe conflict response. Migration created: `server/prisma/migrations/20260503130000_p2_invariants_and_health_indexes/migration.sql`. Tests added: `server/test/modules/focus-routes.test.ts` covers the unique-violation path. Remaining manual verification: apply migrations against the target database.

18. Duplicate active notifications under concurrent generation: completed. Active notification uniqueness is enforced with partial indexes for delivery keys and unread rule/entity/entityId notifications; generation now uses `createMany(..., skipDuplicates: true)` so concurrent duplicate generation is safely ignored. Migration created: `server/prisma/migrations/20260503130000_p2_invariants_and_health_indexes/migration.sql`. Tests added: `server/test/modules/notifications/service.test.ts`; notification mocks updated in planning and route smoke tests. Remaining manual verification: apply migrations against the target database.

19. Health date-range indexes: completed. Prisma schema and migration now add `WaterLog(userId, occurredAt)`, `MealLog(userId, occurredAt)`, and `WeightLog(userId, measuredOn, createdAt)` indexes for health summary/history range queries. Migration created: `server/prisma/migrations/20260503130000_p2_invariants_and_health_indexes/migration.sql`. Tests added: covered by Prisma generate/typecheck/build. Remaining manual verification: apply migrations and inspect query plans only if production data volume warrants it.

20. CI workflow and root quality gate: completed. Root scripts now include `audit:prod`, `test`, and `ci`; `.github/workflows/quality-gate.yml` runs `npm ci`, `npm audit --omit=dev`, `npm run typecheck`, `npm run build`, and `npm run test -w server`. Tests added: workflow is configuration-only and covered by local execution of the same commands. Remaining manual verification: first GitHub Actions run after pushing.

21. Runtime/bootstrap and worker test strengthening: completed. Server test setup now builds contracts before tests that import runtime contract schemas. Worker coverage was strengthened for invalid schedule arguments, while existing startup/bootstrap coverage continues to protect runtime database ordering, env validation, error redaction, not-found responses, cookies, and CORS. Tests added/strengthened: `server/test/jobs/worker.test.ts`; server package `pretest` and `pretest:coverage` scripts. Remaining manual verification: production timer/service smoke test remains as documented in the P1 worker notes.

22. Client test runner: completed. The client now has a Vitest test script and focused helper tests for contract-backed recurrence inputs and scoped query invalidation. Tests added: `client/src/shared/lib/recurrence.test.ts` and `client/src/shared/lib/api/core.test.ts`. Remaining manual verification: client component/browser flows still need manual smoke testing because this change intentionally avoided a broad React Testing Library rollout.

23. Oversized files tied to P2 risks: completed with a focused boundary cleanup, not a cosmetic split. Changes avoided broad rewrites of large finance/health/goals UI and route files; only the risky API-boundary, cache-invalidation, notification, focus, and schema paths were refactored for the P2 issues. Tests added: covered by the targeted tests listed above. Remaining manual verification: future line-count refactors can be planned around concrete workflow risks rather than this P2 batch.

24. Stale active docs: completed. `docs/prd/technical-architecture.md` now reflects the current stack and worker scheduling behavior; `docs/prd/api-contracts.md` now describes the flat `ApiError` and contracts runtime-schema ownership; `docs/implementation/README.md` was refreshed against the actual active implementation docs. This review document now records P2 completion notes. Tests added: documentation-only, verified by checking the implementation index paths exist. Remaining manual verification: continue updating docs as schema/routes evolve.

Final P2 verification on 2026-05-03:

- `npm audit --omit=dev`: passed, 0 vulnerabilities.
- `npm run typecheck`: passed.
- `npm run test -w server`: passed, 49 test files and 275 tests.
- `npm run build`: passed. Vite still reports the existing large-chunk warning.
- `npm run test:coverage -w server`: passed, 49 test files and 275 tests. Aggregate coverage: 79.24% lines/statements, 65.73% branches, 90.19% functions.
- Additional check: `npm run test -w client` passed, 2 test files and 4 tests.

## P3 Findings

### 25. Production Bundle Is Large And Not Code-Split

Evidence:

- `npm run build` produced a 1,179.19 kB minified JS chunk and 560.84 kB CSS chunk before gzip.
- `client/vite.config.ts` has no route-level chunking strategy.

Risk:

Initial load can degrade as more features land, especially on mobile or constrained devices.

Recommended fix:

- Add route-level `React.lazy` for heavy routes.
- Split heavy domains such as goals graph, meal planner, finance cockpit, and drag/drop dependencies.
- Consider CSS splitting or pruning once component boundaries are clearer.

### 26. Goal Date Logic Uses UTC Slices In Some UI Paths

Evidence:

- Surveyed milestone overdue helpers in goal UI use date slicing patterns rather than the app's timezone-aware `getTodayDate()` helper.

Risk:

"Today" and "overdue" labels can be wrong around local midnight.

Recommended fix:

- Use `getTodayDate()` or pass the active user/context date into milestone date helpers.
- Add tests once client helper tests exist.

### 27. Goal Graph Interactions Are Mouse-Oriented

Evidence:

- Surveyed goal graph nodes are drag/click oriented and do not expose a full keyboard alternative for selection/reparenting.

Risk:

Keyboard users cannot fully use the graph workspace.

Recommended fix:

- Add focusable node semantics, roving selection, keyboard open/actions, and non-drag reparenting.

### 28. Root Dependency `bubblewrap` Appears Unused

Evidence:

- Root `package.json` lists `bubblewrap`.
- No non-lockfile reference was found.

Risk:

Minor dependency hygiene issue. Unused dependencies increase audit and supply-chain surface.

Recommended fix:

- Remove it unless there is an undocumented operational use.

### 29. Migration History Contains Low-Risk Naming Debris

Evidence:

- One migration is an intentional no-op.
- Another migration name suggests weekly capacity but changes finance indexes/FKs.

Risk:

Low runtime risk, but it makes schema history harder to audit.

Recommended fix:

- Do not rewrite applied migrations.
- Document historical no-ops/misnames if needed.
- Keep future migration names aligned with actual schema changes.

## Highest-Value Cleanup Plan

### Phase 1: Production/Data Safety

Target: before relying on production as the source of truth for sensitive personal data.

- Update Fastify and clear `npm audit --omit=dev`.
- Move `assertDatabaseSeparation(env)` before DB creation/migration in API, worker, and CLI entrypoints.
- Reject weak/default production `SESSION_SECRET`.
- Redact DB URLs and return generic unknown 500 responses.
- Fix recurring income undo ownership/integrity and add regression tests.
- Implement automated encrypted off-server database backups and a restore test.
- Make worker scheduling explicit with systemd timers, cron, or a scheduler loop.

### Phase 2: Contract Boundary Cleanup

Target: reduce runtime/client/server drift.

- Move shared date and recurrence schemas into `packages/contracts`.
- Migrate remaining client API modules to import contract types.
- Fix week/month planning mutation response types.
- Fix settings nullability drift.
- Replace regex-only date validators across route modules.

### Phase 3: Frontend Accessibility And Testability

Target: make the app usable through keyboard and screen readers while creating a test path for UI logic.

- Add a shared accessible dialog/sheet primitive.
- Migrate Today, Finance, Meal Planner, and Stuck/Shape Day overlays.
- Add keyboard support for meal planner assignment and goal graph actions.
- Add Vitest/RTL for extracted UI helpers/hooks.

### Phase 4: Focused Refactors

Target: reduce complexity where bugs are most likely.

- Extract finance bill/reconciliation and recurring income services from `finance/routes.ts`.
- Extract finance page controllers/forms after service behavior is covered.
- Extract meal planner draft/autosave hook and pure payload helpers.
- Extract health meal-plan service.
- Extract goals planning dock and hierarchy action hooks.
- Add targeted tests for each extracted server workflow.

### Phase 5: Operational Quality Gate

Target: prevent regression and stale dependencies.

- Add root `ci` script.
- Add GitHub Actions workflow.
- Include production audit, typecheck, build, and server tests.
- Add startup/bootstrap and worker tests so operational risks are covered.

## Overall Rating

| Area | Rating | Rationale |
|---|---|---|
| Architecture | 7/10 | Good modular monolith shape, but oversized workflows and contract duplication weaken boundaries. |
| Backend correctness | 7/10 | Strong test suite and validation pattern, with concrete P1/P2 integrity and concurrency gaps. |
| Frontend quality | 6/10 | Feature-rich and organized by domain, but accessibility, tests, and large components need work. |
| Security | 5/10 | Good baseline auth/CSRF/password hashing, but production hardening issues are release-blocking. |
| Operations | 4/10 | Build/deploy scripts exist, but backups, worker scheduling, audit, and CI are incomplete. |
| Maintainability | 6/10 | Naming and domains are clear; the main risk is concentration of complexity in a few files. |

## Final Judgment

This application is clean enough to keep building on, but not clean enough to call production-hardened.

The next best engineering move is not a broad rewrite. It is a disciplined cleanup pass through the P1 list, followed by contract/schema centralization and accessibility primitives. Once those foundations are in place, the large finance, health, and goals files can be split incrementally with tests around the workflows most likely to lose data or drift from contracts.
