# Code Review Report

## 1. Executive Summary

Overall rating: **Risky**

Life OS has a strong foundation for a recently created large project: the monorepo boundaries are clear, the tech choices are coherent, strict TypeScript is enabled, shared contracts exist, and the backend already has a substantial test suite. The codebase is not poor; it is a fast-moving product that has accumulated several structural and operational risks earlier than is healthy.

Biggest strengths:

- Clear workspace separation: `client/`, `server/`, and `packages/contracts/`.
- Domain-oriented backend modules under `server/src/modules`.
- Shared contract package with Zod and TypeScript API types.
- Strict TypeScript configuration in `tsconfig.base.json`.
- Good baseline tests: `npm run typecheck`, `npm run test -w server`, and `npm run test -w client` all passed during review.
- Strong product and implementation documentation under `docs/prd` and `docs/implementation`.

Biggest risks:

- Agent/runtime state and likely sensitive Codex files are tracked in git, including `.codex/auth.json`, sqlite state, shell snapshots, and session logs.
- Some production configuration behavior is unsafe: env files overwrite inherited environment variables, startup can run DB creation/migrations, and bootstrap user credentials are not strongly guarded in production.
- Several backend correctness rules rely on pre-checks instead of database invariants, creating race risks for recurring tasks, active focus sessions, notifications, planner overlaps, and finance payments.
- Backend route files and frontend page files are too large and mix too many responsibilities, making future changes risky.
- Frontend has important UX bugs and accessibility gaps, including `/reviews` links without a matching route and hidden Quick Capture controls that remain focusable.
- Testing is broad but uneven: backend tests are mostly mock-Prisma based, contracts have no direct runtime tests, and frontend lacks DOM/component workflow coverage.

Ready for continued development:

- **Yes, for small feature work only after fixing the must-fix security/config and route correctness issues.**
- **No, for major feature expansion before a focused stabilization pass.**

Refactoring recommendation:

- Do not attempt a broad rewrite.
- Fix the critical/high correctness and security items first.
- Then split the largest files incrementally along existing domain boundaries, backed by targeted tests.

Verification performed:

- `npm run typecheck` passed.
- `npm run test -w server` passed: 58 test files, 313 tests.
- `npm run test -w client` passed: 18 test files, 63 tests.
- `npm run build`, coverage, audit, and runtime browser checks were not run for this review.

## 2. Project Overview

Tech stack detected:

- Monorepo managed by npm workspaces.
- Client: Vite, React 18, React Router, TanStack Query, FullCalendar, dnd-kit, React Flow.
- Server: Fastify 5, Prisma 6, PostgreSQL, Zod, cookie auth, CSRF protection, Argon2.
- Contracts: `@life-os/contracts` package with shared TypeScript types and Zod schemas.
- Tests: Vitest for server and client helper/model tests.
- Deployment: systemd service/timer files, nginx config, shell deployment scripts.

Main folders:

- `client/src/app`: router, providers, shell, release refresh.
- `client/src/features`: route and domain UI for auth, capture, finance, goals, habits, health, home, inbox, notifications, onboarding, reviews, settings, tasks, today.
- `client/src/shared/lib`: API hooks, date/time, formatting, recurrence, parsing, navigation helpers.
- `client/src/shared/ui`: reusable UI primitives.
- `client/src/styles`: global CSS entrypoint and large feature-oriented CSS files.
- `server/src/app`: app bootstrap, env loading, DB bootstrap, plugins.
- `server/src/modules`: backend modules for auth, planning, finance, focus, habits, health, home, notifications, reviews, scoring, settings, onboarding, admin, behavior.
- `server/src/lib`: shared backend infrastructure for auth, errors, recurrence, HTTP responses, logging, security, time, validation.
- `server/src/jobs`: worker registry and worker entrypoint.
- `server/src/cli`: admin and maintenance commands.
- `server/prisma`: schema and migrations.
- `packages/contracts/src`: API and domain contract definitions.
- `docs/prd`, `docs/implementation`, `docs/user`, `docs/archive`: product, operating, user, and historical documentation.

Important entry points:

- Client app: `client/src/main.tsx`, `client/src/app/App.tsx`, `client/src/app/router.tsx`.
- Client providers: `client/src/app/providers.tsx`.
- Server app: `server/src/index.ts`, `server/src/app/build-app.ts`.
- Backend module registration: `server/src/modules/index.ts`.
- Worker: `server/src/jobs/worker.ts`, `server/src/jobs/registry.ts`.
- Contracts barrel: `packages/contracts/src/index.ts`.
- Database schema: `server/prisma/schema.prisma`.

Main application flow:

- Browser routes are defined in `client/src/app/router.tsx`.
- Protected routes call shared API hooks for session/onboarding/settings state.
- UI features use TanStack Query hooks from `client/src/shared/lib/api/*`.
- API requests go through `client/src/shared/lib/api/core.ts`, which adds credentials, JSON headers, client timezone, and CSRF headers for unsafe methods.
- Server routes are registered under `/api` from `server/src/app/build-app.ts` via `registerModules`.
- Fastify request context resolves cookie sessions in `server/src/app/plugins/request-context.ts`.
- Route handlers parse inputs with Zod, call module services or Prisma directly, then return contract-shaped responses.
- Prisma models live in one `server/prisma/schema.prisma` file with 36 migrations.

Architectural patterns found:

- Domain-oriented modules with route/service/repository splits in some areas.
- Shared API contracts, but runtime request validation is split between `packages/contracts` and server-local schemas.
- Manual route-level authorization through repeated `requireAuthenticatedUser(request)`.
- Query invalidation centralized partly in `client/src/shared/lib/api/core.ts`.
- Global CSS cascade with feature-specific styles imported through `client/src/styles.css`.

## 3. High-Level Architecture Review

The high-level workspace structure is sensible and should scale if the current boundaries are reinforced. `client`, `server`, and `packages/contracts` are the right top-level separation for this product. The backend module list also mirrors the product domains well.

The main architecture issue is not the folder map. It is that several files inside the folders have grown past their intended responsibility:

- `server/src/modules/finance/routes.ts` handles route registration, validation orchestration, Prisma queries, mapping, workflow decisions, finance calculations, and transaction behavior.
- `server/src/modules/health/routes.ts` combines health logging, meal templates, meal planning, grocery generation, prep task creation, summary queries, and serialization.
- `server/src/modules/home/routes.ts` acts as a cross-domain aggregator and imports planning, finance, scoring, behavior, focus, and reviews internals.
- `client/src/features/finance/FinancePage.tsx`, `client/src/features/health/MealPlannerPage.tsx`, and `client/src/features/today/TodayPage.tsx` combine query loading, forms, mutation orchestration, route mode handling, layout, and rendering.

Dependency direction is mixed:

- Good: frontend uses shared API hooks and contracts instead of calling backend implementation.
- Good: backend shared infrastructure is mostly under `server/src/lib`.
- Risky: backend modules import other modules' internals, especially planning mappers/includes/repositories.
- Risky: frontend feature modules import components from other feature modules, for example Home importing Today workflow sheets.

Scalability assessment:

- The monorepo can scale.
- The current file sizes and cross-module imports will slow development sharply as more features are added.
- Future AI-agent development will be harder than necessary because agents must inspect huge files and infer hidden dependencies from cross-domain imports.

Recommendations:

- Preserve the current workspace and module map.
- Do focused extraction inside the largest modules rather than moving everything.
- Create narrow service APIs for cross-module summaries.
- Move public runtime schemas into `packages/contracts` gradually.
- Add database invariants before refactoring behavior that relies on pre-checks.

## 4. Critical Findings

### Finding: Tracked Codex/Agent Runtime State And Possible Secrets

- Severity: **Critical**
- Location: `.gitignore:1`, tracked files under `.codex/`, `.claude/`, `.agents/`
- Problem: The repository tracks local agent runtime files. `git ls-files` shows `.codex/auth.json`, `.codex/history.jsonl`, `.codex/logs_1.sqlite`, `.codex/state_5.sqlite`, `.codex/sessions/...jsonl`, `.codex/shell_snapshots/...sh`, `.codex/tmp/...`, system skills, and `.claude/settings.json`.
- Why it matters: This is a direct security and maintainability risk. Auth files and session logs may contain tokens, prompts, local paths, shell commands, or private context. It also pollutes search results and makes AI-agent navigation worse.
- Recommended fix: Immediately audit these files for secrets, rotate any exposed credentials, remove runtime state from git, add ignore rules for `.codex/`, `.claude/`, runtime sqlite/log/session files, and keep only intentional repo-level agent docs such as `AGENTS.md` or curated `.agents/skills` if they are intentionally versioned.
- Suggested priority: **Must fix before more development or sharing the repo.**

### Finding: Env Files Override Deployed Environment Variables

- Severity: **Critical**
- Location: `server/src/app/env.ts:74`
- Problem: `loadSelectedEnv` loads dotenv values and writes them into `process.env` unconditionally. A stale `server/.env`, `server/.env.production`, or explicit `ENV_FILE` can replace inherited deployment secrets/config including `DATABASE_URL`, `SESSION_SECRET`, `APP_ORIGIN`, `NODE_ENV`, and migration flags.
- Why it matters: Production services should normally prefer process manager or platform-provided environment variables. Overriding them from local files can point the app at the wrong database, weaken secrets, or enable unsafe runtime behavior.
- Recommended fix: Make real process env win by default. Dotenv files should fill missing values only, unless an explicit `ENV_FILE_OVERRIDE=true` style flag is set for local/admin workflows. Add env precedence tests.
- Suggested priority: **Must fix before production deploy or any environment migration.**

### Finding: Runtime Startup Can Create Databases Or Run Migrations

- Severity: **Critical**
- Location: `server/src/index.ts:8`, `server/src/app/runtime-database.ts:11`, `server/src/app/db-bootstrap.ts:32`, `server/src/app/db-bootstrap.ts:56`
- Problem: The app and worker call `prepareRuntimeDatabase` during startup. If `AUTO_CREATE_DATABASE` or `AUTO_APPLY_MIGRATIONS` is enabled, runtime processes can create databases or run `prisma migrate deploy`.
- Why it matters: Runtime mutation of infrastructure increases production blast radius. A config mistake can mutate the wrong DB or run migrations from an app process instead of a controlled deploy step.
- Recommended fix: Disallow auto-create and auto-migrate in production runtime. Keep these behaviors in explicit admin/deploy commands. Require `DATABASE_SEPARATION_STRICT=true` in production.
- Suggested priority: **Must fix before production hardening.**

## 5. High Priority Findings

### Finding: Recurring Task Materialization Can Create Duplicate Occurrences

- Severity: **High**
- Location: `server/src/lib/recurrence/tasks.ts:107`, `server/prisma/schema.prisma:628`
- Problem: `materializeRecurringTasksInRange` checks existing tasks in memory and then creates missing occurrences. The `Task` model has indexes on recurrence fields but no uniqueness constraint for `(userId, recurrenceRuleId, scheduledForDate)`.
- Why it matters: Concurrent Today/Home/review/planner requests can both observe no occurrence and insert duplicates.
- Recommended fix: Add a database invariant such as `@@unique([userId, recurrenceRuleId, scheduledForDate])` where feasible, or a partial unique index if null semantics matter. Use `upsert`, `createMany({ skipDuplicates: true })`, or catch `P2002`.
- Suggested priority: **Fix now. Add a concurrency/regression test before refactoring recurrence.**

### Finding: Active Focus Session Uniqueness Is Not Database-Enforced

- Severity: **High**
- Location: `server/src/modules/focus/service.ts:321`, `server/src/modules/focus/service.ts:363`, `server/prisma/schema.prisma:674`
- Problem: `createFocusSession` checks for an active session before creating one and catches unique-constraint errors, but the schema does not define a unique or partial unique constraint for active sessions.
- Why it matters: Double clicks, retries, or overlapping requests can create multiple active focus sessions for the same user.
- Recommended fix: Add a Postgres partial unique index on `userId` where `status = 'ACTIVE'`, or serialize focus-session creation per user. Keep conflict handling and add a race/concurrency test.
- Suggested priority: **Fix now.**

### Finding: Notification And Reminder Idempotency Is Not Database-Backed

- Severity: **High**
- Location: `server/src/modules/notifications/service.ts:74`, `server/src/modules/notifications/service.ts:171`, `server/src/modules/planning/reminder-execution.ts:14`, `server/prisma/schema.prisma:1305`
- Problem: `ensureGeneratedNotification` uses read-before-write checks and `createMany({ skipDuplicates: true })`, but the `Notification` model has no unique index for `deliveryKey` or a natural key. Reminder execution updates tasks and generates notifications without a database-backed idempotency key.
- Why it matters: Overlapping worker/API runs can create duplicate generated notifications and reminders.
- Recommended fix: Add a unique index, likely `(userId, deliveryKey)` or a more precise natural key. Update reminder execution with guarded writes such as `where: { id, reminderTriggeredAt: null }` inside the transaction.
- Suggested priority: **Fix now if worker jobs are enabled.**

### Finding: Finance Debt Payment Endpoints Can Lose Balance Updates

- Severity: **High**
- Location: `server/src/modules/finance/routes.ts:2295`, `server/src/modules/finance/routes.ts:2324`, `server/src/modules/finance/routes.ts:2453`, `server/src/modules/finance/routes.ts:2482`
- Problem: Credit-card and loan payment endpoints read the debt record before the transaction, then create a ledger transaction and update balances using the stale pre-transaction value.
- Why it matters: Concurrent payments can record two finance transactions while the balance only reflects one decrement, corrupting financial state.
- Recommended fix: Re-read or lock the debt record inside the transaction, or use guarded atomic updates with `decrement` and predicates before creating the ledger entry. Add a concurrency test.
- Suggested priority: **Fix now.**

### Finding: `/reviews` Is Linked But Not Routed

- Severity: **High**
- Location: `client/src/app/router.tsx:187`, `client/src/features/home/WorkspaceLaunchStrip.tsx:169`, `client/src/features/home/WorkspaceLaunchStrip.tsx:208`, `client/src/features/today/TodayPage.tsx:742`
- Problem: The router defines `reviews/history` and `reviews/:cadence`, but UI navigates to `/reviews`. There is no index route for `/reviews`.
- Why it matters: Home and Today actions can navigate users into a no-match/blank shell state.
- Recommended fix: Add a `reviews` index route redirecting to `/reviews/daily`, or update all links/actions to `/reviews/daily`.
- Suggested priority: **Fix now. This is a small, high-confidence user-facing bug.**

### Finding: Settings Notification Contract Drift Drops The `behavior` Category

- Severity: **High**
- Location: `packages/contracts/src/notifications.ts:6`, `packages/contracts/src/settings.ts:24`, `client/src/features/settings/SettingsPage.tsx:47`
- Problem: `notificationCategorySchema` and the settings UI include `behavior`, but `notificationPreferencesUpdateSchema` omits `behavior`.
- Why it matters: The UI can present editable Behavior notification settings that the update schema rejects or drops. TypeScript does not catch this because the schema and type are not derived from the same category list.
- Recommended fix: Derive the update schema from `notificationCategorySchema` or `notificationCategoryPreferencesSchema`. Add contract tests for category parity.
- Suggested priority: **Fix now.**

### Finding: Production Bootstrap User Password Guard Is Too Weak

- Severity: **High**
- Location: `server/src/app/env.ts:128`, `server/src/modules/auth/service.ts:45`, `server/.env.example:20`
- Problem: `BOOTSTRAP_USER_PASSWORD` and `OWNER_PASSWORD` only require 8 characters. `ensureBootstrapUserAccount` can create the first user automatically, and `.env.example` uses `change-me-please`.
- Why it matters: Automatic production owner creation with weak/example passwords is dangerous if a production env is copied from examples or misconfigured.
- Recommended fix: In production, reject known/example bootstrap passwords, require high-entropy credentials, and require an explicit `ALLOW_PRODUCTION_BOOTSTRAP=true` flag or remove production auto-bootstrap entirely.
- Suggested priority: **Fix before public deployment.**

### Finding: Login Rate Limiting Is Process-Local And Proxy-Unaware

- Severity: **High**
- Location: `server/src/modules/auth/rate-limit.ts:9`, `server/src/modules/auth/routes.ts:43`, `server/src/app/build-app.ts:56`, `deploy/nginx/personal.daycommand.online.conf:12`
- Problem: Login rate limiting is an in-memory `Map` keyed by `ip:email`. It resets on restart, is per-process only, can grow with random emails, and Fastify is not configured with `trustProxy` while nginx sends `X-Forwarded-For`.
- Why it matters: It is weak against brute force and audit/rate-limit IPs may be wrong behind the reverse proxy.
- Recommended fix: Use a store-backed limiter with TTL cleanup, separate per-IP and per-account buckets, total per-IP limits, and trusted proxy configuration for the nginx hop only.
- Suggested priority: **Fix before public deployment.**

### Finding: Backend Route Files Violate Thin-Route Boundaries

- Severity: **High**
- Location: `server/src/modules/finance/routes.ts:1`, `server/src/modules/health/routes.ts:1`, `server/src/modules/planning/task-routes.ts:254`, `server/src/modules/planning/plan-routes.ts:125`
- Problem: Several route files combine controller, validation orchestration, service logic, mapping, Prisma persistence, calculations, and transaction behavior.
- Why it matters: These files are hard to review, hard to test independently, and create high merge-conflict risk. They also conflict with the repo guidance to keep controllers/routes thin.
- Recommended fix: Split by resource/use case and move persistence/workflow logic into focused services/repositories. Start with finance accounts/transactions/bills/debts/month-plan and health logs/meal-templates/meal-plan/summary.
- Suggested priority: **Begin after must-fix correctness/security items.**

### Finding: Frontend Route Components Are Large State Machines

- Severity: **High**
- Location: `client/src/features/finance/FinancePage.tsx:156`, `client/src/features/health/MealPlannerPage.tsx:1619`, `client/src/features/today/TodayPage.tsx:83`, `client/src/features/goals/GoalsPlanWorkspace.tsx:447`
- Problem: Large page components combine route mode, queries, mutations, local forms, layout measurement, sheets/dialogs, and rendering.
- Why it matters: Changes require broad context, UI bugs become harder to isolate, and targeted component tests are difficult to add.
- Recommended fix: Extract controller hooks, form components, and presentational panels. Keep route pages mostly composition plus routing-level concerns.
- Suggested priority: **Plan as Phase 2 maintainability work, not before correctness fixes.**

## 6. Medium Priority Findings

### Finding: Weekly And Monthly Review Submission Writes Are Not Atomic

- Severity: **Medium**
- Location: `server/src/modules/reviews/review-service/weekly-reviews.ts:350`, `server/src/modules/reviews/review-service/monthly-reviews.ts:300`
- Problem: Review creation and related priority/next-cycle updates are not wrapped in a single transaction.
- Why it matters: A review can be created while follow-up writes fail. Retrying may hit "already submitted" and leave partial state.
- Recommended fix: Wrap review creation, cycle updates, and priority replacement in one Prisma transaction.
- Suggested priority: **Fix before expanding review workflows.**

### Finding: Expected Prisma Failures Become Generic 500s

- Severity: **Medium**
- Location: `server/src/app/build-app.ts:33`, `server/src/app/build-app.ts:106`
- Problem: The global error handler only recognizes `AppError`. Expected Prisma errors such as `P2002`, `P2025`, and `P2003` are returned as generic internal errors.
- Why it matters: User-correctable conflicts and missing records pollute logs and force clients to handle them as server failures.
- Recommended fix: Normalize known Prisma request errors to public `AppError` responses: `P2002` -> 409, `P2025` -> 404/409, `P2003` -> 400. Map Fastify parser errors safely.
- Suggested priority: **Fix soon.**

### Finding: Planner Overlap Checks Are Race-Prone

- Severity: **Medium**
- Location: `server/src/modules/planning/planning-repository.ts:343`, `server/src/modules/planning/plan-routes.ts:388`
- Problem: Planner block overlap validation happens before insert/update without a DB exclusion constraint.
- Why it matters: Concurrent requests can create overlapping blocks.
- Recommended fix: Add a Postgres exclusion constraint over `planningCycleId` and the time range, or serialize writes per planning cycle.
- Suggested priority: **Later unless concurrent planner editing becomes common.**

### Finding: Planning Has Become A Shared Kernel By Accident

- Severity: **Medium**
- Location: `server/src/modules/home/routes.ts:63`, `server/src/modules/focus/service.ts:10`, `server/src/modules/health/routes.ts:62`, `server/src/modules/reviews/review-service/daily-reviews.ts:19`
- Problem: Multiple modules import planning mappers, record shapes, repository functions, and day-mode logic directly.
- Why it matters: Internal planning changes can break unrelated modules. This weakens bounded-context boundaries.
- Recommended fix: Expose narrow public services for tasks, goals, planner summaries, and home-summary data. Avoid importing Prisma include shapes across modules.
- Suggested priority: **Address incrementally as touched.**

### Finding: Home Overview Is A Cross-Domain Aggregator With Direct Persistence Knowledge

- Severity: **Medium**
- Location: `server/src/modules/home/routes.ts:220`, `server/src/modules/home/routes.ts:249`
- Problem: `buildHomeOverview` imports behavior, focus, planning, finance, reviews, and scoring internals and runs a broad `Promise.all` fan-out of Prisma queries and service calls.
- Why it matters: Home becomes tightly coupled to every domain's data model and is likely to regress when any module changes.
- Recommended fix: Move aggregation into `home-overview-service` with narrow adapter functions per domain, or have each domain expose a small home-summary provider.
- Suggested priority: **Phase 2.**

### Finding: Contracts And Runtime Validation Are Split Across Workspaces

- Severity: **Medium**
- Location: `packages/contracts/src/planning.ts:471`, `server/src/modules/planning/planning-schemas.ts:242`, `server/src/modules/finance/finance-schemas.ts:14`
- Problem: Public request/response TypeScript types live in `packages/contracts`, while many runtime request schemas live only in server modules.
- Why it matters: Frontend, backend, and docs can drift while TypeScript still passes.
- Recommended fix: Move public request schemas into `packages/contracts` and infer request types from schemas. Keep only server-private refinements in server modules.
- Suggested priority: **Start with settings/notifications and planning/finance mutations.**

### Finding: Query Invalidation Misses Cross-Feature Caches

- Severity: **Medium**
- Location: `client/src/shared/lib/api/core.ts:413`, `client/src/shared/lib/api/goals.ts:84`, `client/src/shared/lib/api/goals.ts:254`, `client/src/features/today/hooks/useTodayData.ts:26`
- Problem: Some mutations invalidate general goals data but miss week-plan or goal-workspace query keys.
- Why it matters: Today and Goals can show stale planning state after related mutations.
- Recommended fix: Define explicit query keys for goal workspace/list/filtered data and centralize invalidation. Invalidate `queryKeys.weekPlan(weekStartDate)` from week-priority mutations.
- Suggested priority: **Fix when touching planning/goals API hooks.**

### Finding: Quick Capture And Some Dialogs Have Accessibility Traps

- Severity: **Medium**
- Location: `client/src/app/shell/AppShell.tsx:499`, `client/src/features/capture/QuickCaptureSheet.tsx:261`, `client/src/styles/12-auth-and-capture.css:101`, `client/src/features/goals/GoalsPage.tsx:270`
- Problem: Quick Capture remains mounted while closed with `aria-hidden={!open}`, but focusable controls remain in the DOM. Some goal overlays do not use shared dialog/focus handling.
- Why it matters: Keyboard and screen-reader users can tab into hidden controls or lose focus context.
- Recommended fix: Conditionally render closed sheets or apply `inert` plus focus management. Prefer `DialogSurface` or a shared dialog accessibility helper for overlays.
- Suggested priority: **Fix before adding more modal/sheet workflows.**

### Finding: Secondary Loading And Error States Are Swallowed On Today

- Severity: **Medium**
- Location: `client/src/features/today/hooks/useTodayData.ts:25`, `client/src/features/today/hooks/useTodayData.ts:136`, `client/src/features/today/TodayPage.tsx:621`, `client/src/features/today/components/WeekDeepWorkStrip.tsx:13`
- Problem: Day-plan failure gets a page error, but week plan, health, goals, score, and some task query failures can render as empty/null UI.
- Why it matters: Users may see missing sections without understanding whether data is empty or failed.
- Recommended fix: Have `useTodayData` expose section-level loading/error objects and render `InlineErrorState` near affected panels.
- Suggested priority: **Fix when touching Today.**

### Finding: Frontend Has No DOM/Component Workflow Tests

- Severity: **Medium**
- Location: `client/vite.config.ts:63`, `client/package.json:21`, `client/src/app/router.tsx:118`, `client/src/features/inbox/InboxPage.tsx:60`, `client/src/features/today/TodayPage.tsx:83`
- Problem: Client tests run in `node`, and the client has helper/model tests but no jsdom/happy-dom or Testing Library coverage for routed UI workflows.
- Why it matters: Navigation, accessibility, loading/error states, form submission, and keyboard behavior can regress without tests.
- Recommended fix: Add a small DOM test layer for protected routing, settings save/reset, inbox triage, Today planner mode switching, and key dialog behavior.
- Suggested priority: **Phase 2, after current bugs are fixed.**

### Finding: Backend Tests Mostly Mock Prisma Instead Of Exercising DB Constraints

- Severity: **Medium**
- Location: `server/test/utils/mock-prisma.ts:22`, `server/test/modules/routes-smoke.test.ts:163`, `server/src/modules/settings/workspace-reset.ts:17`, `server/src/modules/onboarding/routes.ts:261`
- Problem: Most route tests decorate Fastify with a proxy mock instead of real Prisma/PostgreSQL.
- Why it matters: Foreign keys, cascades, unique constraints, transaction behavior, and migration-real schema behavior are not covered.
- Recommended fix: Add a small database-backed integration suite for workspace reset, onboarding complete, finance payment/bill flows, recurring task materialization, and notification idempotency.
- Suggested priority: **Phase 1 for high-risk invariants; broader coverage later.**

### Finding: Coverage Gates Are Weak Or Missing

- Severity: **Medium**
- Location: `package.json:15`, `.github/workflows/quality-gate.yml:34`, `server/vitest.config.ts:12`, `client/vite.config.ts:66`
- Problem: CI runs typecheck/build/server tests, but not client tests in `.github/workflows/quality-gate.yml`. Root `ci` runs tests, not coverage. Server thresholds are global only; client coverage has no thresholds.
- Why it matters: Important untested files can be hidden by coverage elsewhere.
- Recommended fix: Run both server and client tests in CI. Add coverage only after stabilizing test runtime, and prefer per-area thresholds for critical modules.
- Suggested priority: **Medium.**

### Finding: Worker Jobs Fail As A Batch

- Severity: **Medium**
- Location: `server/src/jobs/worker.ts:80`, `server/src/jobs/registry.ts:34`
- Problem: `startWorker` runs selected jobs sequentially. If one job throws, later jobs are skipped. There is no per-job retry, timeout, or aggregate failure summary.
- Why it matters: One transient issue can block unrelated maintenance tasks.
- Recommended fix: Wrap each job independently, continue unrelated jobs, add bounded retries for transient DB failures, add per-job timeouts, and exit nonzero with a summary if any job failed.
- Suggested priority: **Medium, before relying heavily on background jobs.**

### Finding: Scoring Rules Are Hard-Coded And Intermixed With Data Loading

- Severity: **Medium**
- Location: `server/src/modules/scoring/service.ts:386`, `server/src/modules/scoring/service.ts:745`, `server/src/modules/scoring/service.ts:770`
- Problem: Daily scoring has hard-coded weights and cross-domain data loading in one service.
- Why it matters: Scoring will become hard to tune, explain, or test as behavioral rules evolve.
- Recommended fix: Extract a typed `SCORING_RULES` table and per-bucket calculators. Keep data loading separate from scoring math.
- Suggested priority: **Phase 2.**

### Finding: Planner Repository Uses Repeated `any` Types

- Severity: **Medium**
- Location: `server/src/modules/planning/planning-repository.ts:194`, `server/src/modules/planning/planning-repository.ts:218`, `server/src/modules/planning/planning-repository.ts:343`, `server/src/modules/planning/planning-repository.ts:464`, `server/src/modules/planning/planning-repository.ts:604`
- Problem: Planner persistence repeatedly types Prisma clients/transactions as `any`.
- Why it matters: Schema or include-shape drift can bypass TypeScript.
- Recommended fix: Define `type PlanningTx = PrismaClient | Prisma.TransactionClient` or narrower repository interfaces. Remove sentinel magic IDs by branching query construction.
- Suggested priority: **Fix incrementally when touching planner repository code.**

### Finding: Global CSS Cascade Is Large And Feature-Coupled

- Severity: **Medium**
- Location: `client/src/styles.css:1`, `client/src/styles/60-goals-planning.css:1`, `client/src/styles/95-finance.css:1`, `client/src/styles/36-meal-planner.css:1`, `client/src/features/today/styles/today-desk.css:1`
- Problem: Feature CSS is imported through one global cascade. Several CSS files are over 1,000 lines, and some Today styles preserve legacy selectors.
- Why it matters: Small style changes can affect distant screens and are difficult to reason about.
- Recommended fix: Keep foundations/shell/primitives global. Move feature-specific styles closer to feature folders or split active component styles into smaller files.
- Suggested priority: **Phase 2/3, after stale components are verified.**

## 7. Low Priority / Cleanup Findings

### Finding: Symbol-Only Buttons Lack Accessible Names

- Severity: **Low**
- Location: `client/src/app/shell/AppShell.tsx:490`, `client/src/features/finance/FinancePage.tsx:623`
- Problem: Some symbol-only buttons render `+` or arrows without explicit `aria-label`.
- Why it matters: Screen readers may announce unclear symbols instead of actions.
- Recommended fix: Add descriptive `aria-label` values such as "Open quick capture", "Previous month", and "Next month".
- Suggested priority: **Fix opportunistically.**

### Finding: Forms Have Silent No-Op Paths And Label Gaps

- Severity: **Low**
- Location: `client/src/features/finance/FinancePage.tsx:384`, `client/src/features/finance/FinancePage.tsx:733`, `client/src/features/health/MealPlannerPage.tsx:1478`
- Problem: Some invalid form submissions return early without field feedback, and some labels appear visual-only.
- Why it matters: Users get unclear feedback and assistive tech can miss field associations.
- Recommended fix: Use real `<form onSubmit>` flows, derived `canSubmit`, inline field errors, `aria-invalid`, and associated `htmlFor`/`id` labels.
- Suggested priority: **Fix as forms are touched.**

### Finding: External Quote Fetch Has No Timeout

- Severity: **Low**
- Location: `server/src/modules/home/quote-service.ts:72`
- Problem: `fetchBatchQuotes` calls ZenQuotes without an `AbortSignal` timeout.
- Why it matters: Slow upstream responses can hold `/api/home/quote` open.
- Recommended fix: Add `AbortController` timeout, serve stale cached quotes when possible, and add cooldown after repeated failures.
- Suggested priority: **Low.**

### Finding: Non-AppError 4xx Messages Can Be Exposed

- Severity: **Low**
- Location: `server/src/app/build-app.ts:39`
- Problem: The error handler redacts 500s but sends `error.message` for non-`AppError` statuses below 500.
- Why it matters: Dependency-thrown 4xx errors could leak implementation details.
- Recommended fix: Only expose messages from `AppError`; map known Fastify parser/validation errors to safe public messages.
- Suggested priority: **Low/medium, can combine with Prisma error mapping.**

### Finding: Prisma Plugin Setup Is Duplicated

- Severity: **Low**
- Location: `server/src/app/plugins/prisma.ts:10`, `server/src/app/build-app.ts:72`
- Problem: `registerPrismaPlugin` decorates Prisma, but `buildApp` manually creates/decorates Prisma instead.
- Why it matters: Duplicate infrastructure paths confuse future maintainers and tests.
- Recommended fix: Either register the plugin from `buildApp` or remove the unused plugin/test.
- Suggested priority: **Low.**

### Finding: Some Frontend Components Appear Stale

- Severity: **Low**
- Location: `client/src/features/today/components/ExecutePlannerFocus.tsx:18`, `client/src/features/today/components/DailyLaunchCard.tsx:30`, `client/src/features/today/components/TodayHero.tsx:19`, `client/src/features/today/components/TaskQueue.tsx:61`, `client/src/features/today/components/PriorityStack.tsx:21`, `client/src/shared/lib/demo-data.ts:1`, `client/src/shared/ui/MetricPill.tsx:6`
- Problem: Static search suggests these exports are not imported by active code.
- Why it matters: Stale code expands search space and increases AI-agent confusion.
- Recommended fix: Verify no planned reuse or dynamic import path, then remove stale components. Add unused-export detection if practical.
- Suggested priority: **Low; do not delete before verification.**

## 8. File-Level Findings

| File/Folder | Issue | Severity | Recommendation |
|---|---|---:|---|
| `.codex/`, `.claude/`, `.agents/` | Local agent runtime/auth/session files are tracked | Critical | Audit, rotate secrets if needed, remove runtime state from git, add ignore rules |
| `.gitignore` | Ignores `.env*` but explicitly tracks client env files and misses agent runtime dirs | Critical | Add explicit runtime ignores; keep only intentional examples/config |
| `server/src/app/env.ts` | Dotenv values overwrite inherited env vars | Critical | Make process env win by default; test precedence |
| `server/src/app/db-bootstrap.ts` | App runtime can run migrations/create DB | Critical | Move to explicit deploy/admin commands for production |
| `server/src/app/build-app.ts` | Manual Prisma setup duplicates plugin; Prisma errors not normalized; no `trustProxy` | Medium | Use plugin or delete it; add error mapping; configure trusted proxy |
| `server/src/modules/auth/rate-limit.ts` | Process-local limiter with unbounded key growth | High | Use shared TTL-backed limiter with IP/account buckets |
| `server/src/modules/auth/service.ts` | Auto-bootstrap production account lacks strong password guard | High | Require strong/generated passwords and explicit production bootstrap flag |
| `server/src/lib/recurrence/tasks.ts` | Recurring task materialization is race-prone | High | Add unique DB invariant and idempotent create path |
| `server/src/modules/focus/service.ts` | Active session pre-check is not backed by DB uniqueness | High | Add partial unique index or per-user serialization |
| `server/src/modules/notifications/service.ts` | `skipDuplicates` without unique index | High | Add `(userId, deliveryKey)` or natural-key uniqueness |
| `server/src/modules/planning/reminder-execution.ts` | Reminder processing is not fully idempotent | High | Guard update by `reminderTriggeredAt: null`; rely on notification unique key |
| `server/src/modules/finance/routes.ts` | Very large file, mixed responsibilities, concurrency bugs in payments | High | Split by resource and move workflows to services/repositories |
| `server/src/modules/health/routes.ts` | Very large file, mixed health/meal/grocery/prep workflows | High | Split logs/templates/meal-plan/summary routes and services |
| `server/src/modules/home/routes.ts` | Cross-domain imports and direct query fan-out | Medium | Introduce home overview service/adapters |
| `server/src/modules/planning/planning-repository.ts` | Large repository with repeated `any` transaction types | Medium | Add typed transaction/client aliases and split planner block vs goal config concerns |
| `server/src/modules/scoring/service.ts` | Hard-coded scoring weights and data loading mixed | Medium | Extract rules table and bucket calculators |
| `server/src/jobs/worker.ts` | One failing job skips later jobs | Medium | Per-job try/catch, retries, timeout, aggregate failure result |
| `packages/contracts/src/settings.ts` | Notification update schema omits `behavior` | High | Derive from canonical notification category schema |
| `client/src/app/router.tsx` | No `/reviews` index route despite links | High | Add redirect to `/reviews/daily` or update links |
| `client/src/app/shell/AppShell.tsx` | Symbol-only mobile capture button lacks label; Quick Capture always mounted | Medium | Add `aria-label`; render/focus-manage sheet safely |
| `client/src/features/capture/QuickCaptureSheet.tsx` | Closed sheet uses `aria-hidden` while focusable descendants remain | Medium | Conditional render or `inert`; use dialog accessibility pattern |
| `client/src/features/finance/FinancePage.tsx` | 2,269-line page with many forms/mutations | High | Extract controller hooks, forms, setup panels, and finance sections |
| `client/src/features/health/MealPlannerPage.tsx` | 2,265-line page with meal planning and recipe workflows | High | Split template editor, week planner, groceries, prep sessions |
| `client/src/features/today/TodayPage.tsx` | Large route component owns Today and Planner modes | High | Split route wrappers and workspaces; keep hooks for state orchestration |
| `client/src/shared/lib/api/core.ts` | Central invalidation misses some query keys | Medium | Expand typed query-key model and invalidate cross-feature caches explicitly |
| `client/src/styles.css` | Feature styles imported into global cascade | Medium | Keep foundations global; move feature style ownership closer to features |
| `.github/workflows/quality-gate.yml` | CI runs server tests, not client tests | Medium | Add `npm run test -w client`; consider contract tests |

## 9. Large / Complex Files

| File | Approx Concern | Why It Is Risky | Suggested Refactor |
|---|---|---|---|
| `server/src/modules/finance/routes.ts` | 3,687 lines | Many endpoints, serializers, calculations, and transactions in one file | Split into `accounts`, `transactions`, `bills`, `recurring-income`, `recurring-expenses`, `debts`, `month-plan` route/service files |
| `server/test/modules/routes-smoke.test.ts` | 4,984 lines | Multi-domain mock test is hard to maintain and easy to overfit | Keep one route registration smoke test; move behavior to module suites |
| `client/src/styles/60-goals-planning.css` | 3,695 lines | Large global cascade surface | Split active Goals HQ/canvas/planning-dock styles |
| `client/src/features/today/styles/today-desk.css` | 3,354 lines | Large Today-specific style file | Split by Today route/workbench/planner panels |
| `client/src/styles/95-finance.css` | 2,743 lines | Finance style changes can have broad cascade effects | Split by cockpit, forms, timeline, setup, debts |
| `client/src/features/finance/FinancePage.tsx` | 2,269 lines | Forms, dialogs, query orchestration, and layout combined | Extract `useFinancePageController`, forms, debt panels, transaction list, month plan |
| `client/src/features/health/MealPlannerPage.tsx` | 2,265 lines | Meal template, week plan, groceries, prep sessions all combined | Extract planner controller, recipe composer, groceries, prep sessions |
| `server/src/modules/health/routes.ts` | 1,858 lines | Health logs, meal plans, templates, summaries in one route file | Split route files and services by resource |
| `client/src/features/goals/GoalsPlanWorkspace.tsx` | 1,609 lines | Goal planning workspace state and UI are tightly coupled | Extract workspace controller, rail, detail, planning dock |
| `client/src/features/goals/GoalsPlanGraphView.tsx` | 1,522 lines | Graph layout/rendering and domain metadata combined | Extract graph model/layout helpers and domain metadata |
| `server/src/modules/scoring/service.ts` | 1,259 lines | Scoring math and data loading mixed | Extract rules and bucket calculators |
| `server/src/modules/planning/planning-repository.ts` | 1,228 lines | Goal config, priorities, planner blocks, recurrence sync mixed | Split planner blocks, priorities, goal config repositories |
| `client/src/shared/lib/api/planning.ts` | 1,103 lines | Many planning hooks/mutations in one API module | Split API modules by tasks, day plans, goals, templates |
| `client/src/shared/lib/api/finance.ts` | 1,071 lines | Finance API hooks and aggregate loader are large | Split by finance resource |
| `client/src/features/today/components/DayPlanner.tsx` | 1,067 lines | Planner view/component behavior is broad | Split timeline, block list, controls, drag helpers |
| `client/src/features/today/components/PlannerBlock.tsx` | 1,061 lines | Block rendering, controls, task assignment, interactions combined | Extract task rows, block form controls, menus |
| `client/src/features/today/TodayPage.tsx` | 1,046 lines | Route modes, data, actions, layout, sheets combined | Split `TodayExecutePage`, `PlannerPage`, shared controller hooks |

## 10. Duplicate or Repeated Logic

Repeated logic: client/server finance navigation builders

- Where: `client/src/features/finance/finance-navigation.ts`, `server/src/modules/finance/finance-navigation.ts`
- Should extract: Yes, if both must generate the same route/query params.
- Suggested shared utility: `packages/contracts/src/finance-navigation.ts` or a route contract module.
- Urgency: Optional, but useful before more finance navigation features.

Repeated logic: goal domain metadata and labels

- Where: `client/src/features/goals/GoalsPlanWorkspace.tsx:53`, `client/src/features/goals/GoalsPlanGraphView.tsx:27`, `client/src/features/goals/GoalDetailPanel.tsx:480`, `packages/contracts/src/goals.ts:12`, `server/src/modules/onboarding/routes.ts:24`
- Should extract: Yes.
- Suggested shared utility: canonical `goalDomainMetadata` exported from contracts or a shared client/server-safe module.
- Urgency: Medium. It will prevent UI/server drift.

Repeated logic: runtime schemas vs TypeScript contracts

- Where: contracts files such as `packages/contracts/src/planning.ts`, server schemas such as `server/src/modules/planning/planning-schemas.ts` and `server/src/modules/finance/finance-schemas.ts`
- Should extract: Yes, gradually.
- Suggested shared utility: public request Zod schemas in `packages/contracts`, server imports them.
- Urgency: Medium/high because drift already exists in settings notifications.

Repeated logic: route input parsing/auth boilerplate

- Where: most `server/src/modules/**/routes.ts`
- Should extract: Maybe.
- Suggested shared utility: do not create a heavy framework. A small authenticated route helper or Fastify preHandler could reduce repeated `requireAuthenticatedUser`.
- Urgency: Optional. Do after fixing route/service size and tests.

Repeated logic: query invalidation rules

- Where: `client/src/shared/lib/api/core.ts`, API modules under `client/src/shared/lib/api/*`
- Should extract: Partly.
- Suggested shared utility: typed query-key registry with invalidation helpers per domain.
- Urgency: Medium because stale UI bugs are likely.

Repeated logic: large mock Prisma behavior in route tests

- Where: `server/test/utils/mock-prisma.ts`, `server/test/modules/routes-smoke.test.ts`, module route tests
- Should extract: Better test factories/builders, plus a small real-DB suite.
- Urgency: Medium.

## 11. Naming and Readability Issues

Good naming:

- Domain modules are mostly named after product concepts: `planning`, `finance`, `focus`, `habits`, `health`, `reviews`, `scoring`.
- Many client components have descriptive names such as `GoalsPlanWorkspace`, `ReviewSummaryPanel`, `NotificationActionCard`.
- Backend helpers like `requireAuthenticatedUser`, `parseOrThrow`, and `withGeneratedAt` are clear.

Issues:

- `routes.ts` files have become dumping grounds in several modules. The name is technically correct but no longer communicates the amount of workflow logic inside.
- `server/src/modules/planning/planning-repository.ts` is too broad for one repository name; it covers planner blocks, priorities, goal config, recurrence sync, and more.
- `client/src/shared/lib/api/core.ts` is no longer just "core"; it also owns query-key definitions and invalidation policy.
- `server/src/app/plugins/prisma.ts` suggests Prisma setup is plugin-based, but `buildApp` performs manual setup instead.
- `client/src/shared/lib/demo-data.ts` appears stale and should be renamed or removed after verification.
- Magic/sentinel values appear in planner repository logic, for example the reported sentinel around `planning-repository.ts:561`; this reduces readability and type safety.

Recommendations:

- Rename by responsibility only when splitting files, not before.
- Prefer resource names such as `finance-bill-routes.ts`, `finance-bill-service.ts`, `planner-block-repository.ts`, `goal-config-repository.ts`.
- Keep "shared" code domain-specific. Avoid adding broad `utils` files.

## 12. Error Handling and Logging Review

What is good:

- `AppError` gives typed public error codes and field errors.
- Zod validation failures are converted to a consistent `VALIDATION_ERROR` shape.
- 500s are redacted to "Unexpected server error".
- Startup has specific DB connection/missing schema guidance.
- Development request logging is centralized.

Problems:

- Expected Prisma errors are not mapped to public 400/404/409 responses.
- Some code still throws generic `Error` in services/CLI paths. That is acceptable for CLI, but route-facing paths should map to `AppError`.
- Non-`AppError` 4xx messages can leak dependency details.
- Worker logging does not aggregate failures per job.
- Client mutation errors rely mostly on global toast feedback; some screen sections swallow secondary query failures.

Recommended fixes:

- Add Prisma/Fastify error normalization in the global error handler.
- Keep route handlers returning `AppError` for user-correctable problems.
- Add structured job result summaries in the worker.
- Add section-level client errors to Today, Finance, Home, and Planner where aggregate queries are used.

## 13. Security Review

Critical concerns:

- Tracked `.codex/auth.json`, sqlite state, logs, sessions, and shell snapshots are the most urgent security issue.
- Env file precedence can override production secrets.
- Runtime DB mutation can run from the app process.

High concerns:

- Login rate limiting is not production-grade and proxy IP handling is likely wrong without `trustProxy`.
- Bootstrap user creation can use weak/example passwords in production.
- CSRF implementation is generally sound for cookie-auth unsafe methods, but it depends on frontend/backend cookie names matching by environment.

Other notes:

- Session cookie is `httpOnly`, `sameSite: "strict"`, and `secure` in production.
- CSRF cookie is intentionally readable by JS, `sameSite: "strict"`, and `secure` in production.
- CORS is configured to one `APP_ORIGIN`, which is good if env handling is fixed.
- Route-level auth is consistently present in module routes based on static search.

Recommendations:

- Audit tracked agent files immediately.
- Fix env precedence and runtime DB mutation behavior.
- Harden production bootstrap.
- Replace in-memory login limiter or explicitly document local-only deployment assumptions.
- Add trusted proxy configuration for nginx deployment.

## 14. Performance Review

Meaningful backend performance risks:

- `buildHomeOverview` fans out many cross-domain queries and service calls. For a single-user product this may be acceptable, but it will become a performance and observability bottleneck as data grows.
- Review/history/scoring services load many domain records directly. This is manageable now but should be watched with larger datasets.
- Notification and recurrence materialization use read-before-write patterns that are more correctness risks than pure performance risks.

Meaningful frontend performance risks:

- Very large page components can create unnecessary re-renders, especially Today, Finance, Goals, and Meal Planner.
- Global CSS and very large style files increase cascade complexity, not necessarily runtime cost.
- Client code splitting exists via route-level lazy imports in `router.tsx`, which is good.

Database/indexing:

- The Prisma schema includes many useful indexes for user/date/status access patterns.
- Missing uniqueness/idempotency constraints are the bigger concern than missing basic indexes.
- Add constraints for recurring task occurrences, active focus sessions, notification delivery keys, and possibly planner block overlaps.

Avoid premature optimization:

- Do not introduce caching layers or queues yet unless backed by real symptoms.
- First add DB invariants and isolate the largest query fan-out areas for observability.

## 15. Testing Review

Current test impression:

- Server test count is strong for a young codebase: 58 files, 313 tests passed.
- Client helper/model tests exist and passed: 18 files, 63 tests.
- Typecheck passes across contracts, server, and client.

Gaps:

- No direct contracts test suite in `packages/contracts`.
- Contract/schema drift already exists in notification settings.
- Backend route tests rely heavily on mock Prisma and miss real database constraints.
- Frontend has no DOM/component tests for key shipped workflows.
- CI workflow currently runs server tests but not client tests.
- Coverage is not enforced in CI, and client coverage has no threshold.

Highest-priority tests to add:

1. Contract tests for notification/settings parity, ISO date/month validation, recurrence schemas, and reset confirmation parsing.
2. Real-DB integration tests for recurring task materialization idempotency, active focus session uniqueness, notification idempotency, workspace reset delete order, onboarding complete, and finance payments.
3. Frontend DOM tests for `/reviews` navigation, protected routing, Quick Capture accessibility basics, settings notification save, Today planner mode switching, and inbox triage.
4. Focused service tests before splitting finance and health route files.

## 16. Frontend Review

Component organization:

- Route-level lazy loading is good.
- Feature folders are clear.
- Some features already use helpers/hooks, especially Today and Reviews.
- Several route components are too large and should be decomposed once key bugs are fixed.

State management:

- TanStack Query is used consistently.
- Local UI state is heavy in large pages.
- Query invalidation is partially centralized but misses some cross-feature caches.

Styling:

- Global CSS organization is ordered and intentional, but feature CSS has grown too large.
- Today has both global and feature-local style folders.
- Style ownership should be clarified before more UI expansion.

Accessibility:

- Loading states use live regions in places.
- Quick Capture hidden/focusable behavior should be fixed.
- Symbol-only buttons need labels.
- Some forms need stronger field association and invalid feedback.

Loading/error/empty states:

- Page-level states exist.
- Section-level error handling is uneven, especially on Today and aggregate dashboards.

Recommended frontend sequence:

1. Fix `/reviews` route/link bug.
2. Fix Quick Capture/dialog accessibility.
3. Fix query invalidation misses.
4. Add frontend DOM tests for those fixes.
5. Incrementally split Finance, Meal Planner, Today, and Goals workspaces.

## 17. Backend Review

API structure:

- Module registration is centralized and easy to scan in `server/src/modules/index.ts`.
- There are many endpoints, and static search found 151 route registrations.
- Auth appears consistently applied to data routes through `requireAuthenticatedUser`.

Service structure:

- Some modules have good services/repositories.
- Finance and health route files need service extraction.
- Home overview and scoring need clearer service boundaries.

Data access:

- Prisma access is often direct in route handlers.
- Transaction usage exists for multi-write flows, but some critical flows still use stale reads or non-atomic write sequences.
- Some repository functions use `any`, weakening Prisma type safety.

Validation:

- Zod validation is present.
- Public schema ownership is split between contracts and server-local files.
- Route params are often cast and then used in Prisma queries; many are not validated as UUIDs. This is more consistency/readability than injection risk because Prisma parameterizes queries.

Config:

- Env loading is powerful but currently too risky for production.
- Production guardrails should be stricter.

Background jobs:

- Job registry is clear.
- Worker execution needs per-job isolation, retries/timeouts, and idempotency constraints in the underlying operations.

## 18. Database / Data Model Review

Good practices:

- User-owned records generally include `userId` and sensible indexes.
- Cascades and `SetNull`/`Restrict` relation actions are used intentionally in many places.
- Migrations are present and chronologically named after early numbered baselines.

Concerns:

- `server/prisma/schema.prisma` is 1,326 lines. Prisma supports this, but it is now hard to scan.
- Some key invariants are not encoded in the database:
  - Unique recurring task occurrence per user/rule/date.
  - One active focus session per user.
  - Unique notification delivery/natural key.
  - Planner block non-overlap per day/cycle.
- Finance payment balance changes use stale pre-transaction reads.
- Some idempotency relies on `createMany({ skipDuplicates: true })` without unique constraints.

Recommended fixes:

- Add the missing uniqueness/idempotency constraints first.
- Use raw SQL migrations where Prisma cannot model partial unique/exclusion constraints.
- Add real-DB tests around every new invariant.
- Defer splitting the Prisma schema unless developer ergonomics become a real bottleneck; Prisma's single schema file is acceptable for now.

## 19. DevOps / Config / Environment Review

Good:

- `.github/workflows/quality-gate.yml` exists and runs install, audit, typecheck, build, and server tests.
- Deployment files exist for nginx, systemd services/timers, and Postgres backups.
- Server README explains env file selection and DB separation.
- Production and quick-reference deployment docs exist.

Concerns:

- CI does not run client tests.
- Env files overriding process env is risky.
- Runtime can auto-create DBs and apply migrations.
- `.gitignore` misses local agent runtime state.
- `README.md` suggests `npm run dev`, `npm run dev:client`, and `npm run dev:server`, which conflicts with the agent instructions in `AGENTS.md` for agent operation. This is fine for humans, but agents need the stricter `AGENTS.md` guidance.
- Client `.env.development` and `.env.production` are intentionally tracked for CSRF cookie names. That is acceptable because they do not contain secrets, but it should be documented as non-secret build config.

Recommended fixes:

- Add client tests to GitHub Actions.
- Make env precedence safe.
- Move DB bootstrap/migrate to explicit operational commands.
- Add ignore rules and remove tracked runtime state.
- Add a short "Agent-safe verification" section to README or keep `AGENTS.md` as canonical.

## 20. AI-Agent Friendliness Review

Strengths:

- `AGENTS.md` is detailed and gives workspace map, commands, coding standards, testing guidance, and safety rules.
- Domain folders are mostly predictable.
- Docs are unusually helpful for a young codebase.
- Strict TypeScript and shared contracts help agents make safer changes.

Issues that make AI-agent work harder:

- Tracked `.codex` runtime state massively pollutes search and may leak private agent history.
- Very large files force agents to inspect thousands of lines for small changes.
- Cross-feature imports blur ownership. Examples: Home imports Today sheets; Onboarding imports a Habits editor.
- Runtime schemas live in both contracts and server modules, increasing drift risk.
- Stale/unused components increase false-positive search results.
- Global CSS cascade makes UI changes risky for agents.
- Existing dirty worktree during review means agents must be extra careful not to overwrite user changes.

Agent-friendly improvements:

- Remove runtime agent files from git.
- Add `CODEOWNERS`-style or docs-based module ownership notes if multiple agents will work in parallel.
- Split huge files along route/resource boundaries.
- Add small focused tests for high-risk behaviors.
- Centralize contract schemas and domain metadata.
- Add unused-export detection or periodic cleanup.

## 21. Recommended Refactoring Roadmap

### Phase 1: Must Fix Before More Features

- Remove tracked `.codex`/runtime state from git, audit for secrets, rotate any exposed credentials.
- Fix env precedence so process env wins by default.
- Disable runtime DB create/migrate in production app/worker startup.
- Add `/reviews` index redirect or update `/reviews` links.
- Fix settings notification schema drift for `behavior`.
- Add DB-backed uniqueness/idempotency for recurring tasks, active focus sessions, and notifications.
- Fix finance credit-card/loan payment balance updates to avoid stale reads.
- Harden production bootstrap user password behavior.
- Replace or harden login rate limiting and trusted proxy handling.
- Add targeted tests for the above.

### Phase 2: Improve Maintainability

- Split `server/src/modules/finance/routes.ts` by resource/use case.
- Split `server/src/modules/health/routes.ts` by resource/use case.
- Extract Home overview adapters or a `home-overview-service`.
- Extract scoring rules and bucket calculators.
- Split `client/src/features/finance/FinancePage.tsx`.
- Split `client/src/features/health/MealPlannerPage.tsx`.
- Split Today route wrappers from workspaces/controllers.
- Move public runtime schemas into `packages/contracts`.
- Add frontend DOM tests for core workflows.
- Add real-DB backend integration tests for dangerous multi-write flows.

### Phase 3: Cleanup and Polish

- Verify and remove stale Today/demo components.
- Split large CSS files and clarify feature style ownership.
- Add accessible labels to symbol-only buttons.
- Normalize form field errors and labels.
- Remove or use duplicate Prisma plugin.
- Add unused-export detection.
- Add client tests to CI and consider coverage gates once tests are less sparse.

## 22. Top 10 Action Items

1. Action: Remove tracked `.codex`/agent runtime state and rotate exposed secrets if needed.
   Why: This is the largest immediate security and AI-agent hygiene risk.
   Estimated risk: Medium, mostly git/history cleanup and credential rotation.
   Suggested priority: Critical.

2. Action: Fix env precedence and production runtime DB bootstrap behavior.
   Why: Prevents wrong secrets/DBs/migrations from being applied by app startup.
   Estimated risk: Medium; add tests first because env behavior is subtle.
   Suggested priority: Critical.

3. Action: Add DB invariants for recurring task occurrences, active focus sessions, and notification delivery keys.
   Why: Prevents duplicate state from concurrent requests/workers.
   Estimated risk: Medium/high due migrations and existing data cleanup.
   Suggested priority: High.

4. Action: Fix finance payment stale-read updates.
   Why: Prevents corrupted debt balances.
   Estimated risk: Medium.
   Suggested priority: High.

5. Action: Fix `/reviews` routing and settings `behavior` notification schema drift.
   Why: These are small, confirmed user-facing correctness bugs.
   Estimated risk: Low.
   Suggested priority: High.

6. Action: Harden login rate limiting, trusted proxy handling, and bootstrap password policy.
   Why: Current production abuse controls are too weak.
   Estimated risk: Medium.
   Suggested priority: High.

7. Action: Add focused contract and real-DB tests around fixed invariants.
   Why: These areas are risky to change without tests.
   Estimated risk: Medium.
   Suggested priority: High.

8. Action: Split finance backend routes into focused services/repositories.
   Why: It is the biggest backend maintainability hotspot.
   Estimated risk: Medium/high; do after tests.
   Suggested priority: Medium.

9. Action: Split FinancePage, MealPlannerPage, and TodayPage incrementally.
   Why: These are the biggest frontend maintainability hotspots.
   Estimated risk: Medium; preserve behavior and add DOM tests as seams are created.
   Suggested priority: Medium.

10. Action: Add client tests to CI and introduce a minimal DOM test stack.
    Why: Current frontend tests miss routed UI behavior and accessibility.
    Estimated risk: Low/medium.
    Suggested priority: Medium.

## 23. What Not To Refactor Yet

- Do not rewrite the monorepo structure. The `client`/`server`/`packages/contracts` split is sound.
- Do not broadly replace Fastify, Prisma, TanStack Query, or React Router. The stack is coherent.
- Do not split every file over 200 lines immediately. Start with files that actively block correctness or frequent development.
- Do not refactor scoring deeply before adding tests around current behavior.
- Do not delete apparent stale Today components until confirming they are not planned for near-term reuse or dynamically referenced.
- Do not move all CSS into a new styling system now. First remove stale styles and split the worst feature files.
- Do not introduce a heavy route framework to avoid repeated `requireAuthenticatedUser`; a small helper or preHandler is enough if needed.
- Do not add Redis or a queue unless deployment needs it. A DB-backed limiter/idempotency approach may be simpler for a personal command center.
- Do not run coverage thresholds as blockers until client DOM tests and contract tests exist; otherwise the numbers will create noise more than confidence.

## 24. Final Recommendation

The codebase is healthy enough to keep developing **only after a short stabilization pass**. It has good foundations, but the tracked runtime state, unsafe env precedence, missing database invariants, finance concurrency risk, and confirmed frontend route/schema bugs should be fixed before major new feature work continues.

Best next step:

1. Fix security/config hygiene and remove tracked agent runtime files.
2. Add targeted tests for the confirmed high-risk bugs.
3. Add database invariants and repair finance payment concurrency.
4. Then start incremental maintainability refactors, beginning with finance backend and the largest frontend pages.

This should be treated as stabilization, not a rewrite. The current system is worth preserving; it needs sharper boundaries and stronger invariants before it grows further.
