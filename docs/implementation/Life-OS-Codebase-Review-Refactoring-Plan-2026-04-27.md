# Codebase Review and Refactoring Plan

Date: 2026-04-27

Purpose: this document is an implementation source of truth for future AI agents and human reviewers. It consolidates the senior codebase review findings, explains why each issue matters, and provides a practical checklist for making the fixes without broad, cosmetic refactoring.

## How Agents Should Use This Document

- Do not perform broad rewrites. Work through the checklist in priority order.
- Prefer regression tests before behavior changes for every correctness finding.
- Keep refactors tied to clear risk: contract drift, data loss, wrong totals, failing tests, unique constraint collisions, or difficult-to-test workflows.
- Do not split simple logic only to reduce line count.
- Do not introduce new abstraction layers unless they remove real duplication or isolate a high-risk workflow.
- Do not run `npm run dev`, `npm run dev:client`, `npm run dev:server`, `npm run start -w server`, or worker processes from an agent.
- Use `npm run typecheck`, `npm run build`, and focused server tests for verification.
- If touching UI behavior, document manual verification because the client currently has no committed test runner.

## Executive Summary

Life OS is acceptable for continued development, but several areas need senior-level stabilization before more feature work piles on. The codebase has good high-level workspace boundaries, clear module names, a useful contracts package, and substantial backend test coverage. The main maintainability risks are contract drift, oversized route/page files that mix too many responsibilities, broad client cache invalidation, and several correctness issues already visible in tests and code paths.

The highest-risk areas are:

- Client API DTOs duplicate `packages/contracts` instead of importing them. Planning API DTOs are now migrated; finance, health, and other API modules still need follow-up.
- Planning schemas and contracts disagreed on day priority slots. This has been fixed for the three-priority product rule.
- Meal planner draft hydration could overwrite unsaved autosave changes. The high-risk stale hydration and week-navigation paths have been fixed.
- Finance bill payment could double-count spend in dashboard totals. The linked-bill dashboard path has been fixed.
- Goal domain/horizon reordering could collide with unique `sortOrder` constraints. This has been fixed with two-phase reorder updates.
- Finance and health files contain overloaded workflows that are difficult to test safely.
- The server test suite was red during review; it is now green after Phase 1 fixes.

## Current Verification Baseline

Run date: 2026-04-27

Last updated after the second stabilization batch: 2026-04-27.

`npm run typecheck`: passed.

`npm run test -w server`: passed.

`npm run build`: passed.

Previously observed server failures in task commitment and bulk task smoke coverage have been fixed. The server suite now has 224 passing tests.

## Overall Assessment

| Area | Rating | Notes |
|---|---|---|
| Maintainability | Needs Improvement | Several feature files have become hard to change safely. |
| Readability | Acceptable | Naming is generally clear, but files are too large in key workflows. |
| Architecture | Needs Improvement | Workspace shape is good, but contract and dependency boundaries are leaky. |
| File organization | Acceptable | Modules are named well, but some module internals need splitting. |
| Component/function size | Needs Improvement | Finance, health meal planning, and large React workspaces are overloaded. |
| Duplication | Needs Improvement | Client DTO duplication is the most important duplication. |
| Risk of bugs | Needs Improvement | Several correctness risks are concrete, not theoretical. |
| Ease of future development | Needs Improvement | More feature work will slow down unless Phase 1 and Phase 2 are addressed. |

## Phase 1 Checklist: Must Fix

These items should be completed before adding significant new finance, planning, or meal-planner features.

### 1. Make the Server Test Suite Green

Files:

- `server/test/modules/planning/task-commitment-routes.test.ts`
- `server/test/modules/routes-smoke.test.ts`
- `server/src/modules/planning/task-commitment.ts`
- `server/src/modules/planning/task-routes.ts`

Problem:

The review originally found a mismatch between `nextAction` guidance and tests, plus bulk task route smoke failures for scheduling/carry-forward/inbox-zero paths. Product behavior has since been clarified: missing `nextAction` should be optional guidance, not a blocker for quickly moving inbox tasks into Today.

Why it matters:

The test suite is the safety net for refactoring. Continuing refactors while the suite is red makes it harder to distinguish existing regressions from new ones.

Checklist:

- [x] Reproduce failures with focused server tests.
- [x] Decide whether missing `nextAction` is truly blocking or optional.
- [x] Align `buildTaskCommitmentGuidance`, `buildTaskCommitmentFieldErrors`, route behavior, and tests.
- [x] Investigate 500 responses in bulk scheduling, bulk carry-forward, and inbox-zero smoke tests.
- [x] Add or adjust focused tests if smoke failures expose missing behavior coverage.
- [x] Verify with `npm run test -w server`.
- [x] Verify with `npm run typecheck`.

Completion note:

Missing `nextAction` is optional again and commits are allowed without it. Bulk scheduling, carry-forward, and Inbox Zero smoke failures were fixed by aligning test mocks with the route's sort-order lookup behavior.

Recommended approach:

Prefer matching product intent first, then update tests or code accordingly. Do not simply loosen tests to make them pass.

Risk level: Critical

Estimated difficulty: Small to Medium

Timing: Now

### 2. Remove Client/Server Contract Drift

Files:

- `client/package.json`
- `client/src/shared/lib/api/*.ts`
- `packages/contracts/src/index.ts`
- `packages/contracts/src/planning.ts`
- `packages/contracts/src/finance.ts`
- `packages/contracts/src/health.ts`

Problem:

The server imports `@life-os/contracts`, but the client redefines many API DTOs locally. This has already drifted: server/contracts support task origin `meal_plan`, while the client task type union omits it.

Why it matters:

Client and server can both typecheck while disagreeing on real API shapes. This is one of the highest leverage fixes because it strengthens every future feature.

Recommended refactor:

Add `@life-os/contracts` as a client workspace dependency and migrate client API modules to import response, request, and item types from contracts. Keep React Query hooks in the client API files, but do not duplicate DTO definitions there.

Checklist:

- [x] Add `@life-os/contracts` dependency to `client/package.json`.
- [x] Replace local DTO definitions in `client/src/shared/lib/api/planning.ts` with contract imports.
- [x] Replace local DTO definitions in `client/src/shared/lib/api/finance.ts` with contract imports.
- [x] Replace local DTO definitions in `client/src/shared/lib/api/health.ts` with contract imports.
- [ ] Continue through other API modules where duplicated DTOs exist.
- [ ] Remove or minimize duplicate recurrence contract definitions in `client/src/shared/lib/recurrence.ts`.
- [x] Run `npm run typecheck`.
- [x] Run focused tests affected by DTO changes.

Completion note:

Planning, finance, and health API DTOs now import shared contract types. Planning includes the `meal_plan` task origin, and the recurrence editor returns the contract recurrence input shape at API boundaries. Other API modules still have duplicated DTOs and should be migrated in later work.

Risk level: High

Estimated difficulty: Medium

Timing: Now

### 3. Align Day Priority Contract and Server Schema

Files:

- `server/src/modules/planning/planning-schemas.ts`
- `server/src/modules/planning/plan-routes.ts`
- `packages/contracts/src/planning.ts`
- Client planning UI that submits day priorities

Problem:

Shared contract/client allow day priority slots `1 | 2 | 3`, while the server validator only accepts slots `1 | 2` and limits the array to two items before casting as `UpdateDayPrioritiesRequest`.

Why it matters:

Valid TypeScript payloads can fail at runtime with a 400 response. This is exactly the kind of bug a contracts package is meant to prevent.

Checklist:

- [x] Decide product rule: two day priorities or three day priorities.
- [x] Align `packages/contracts/src/planning.ts`.
- [x] Align `server/src/modules/planning/planning-schemas.ts`.
- [x] Align client UI assumptions and labels.
- [x] Add a route test for the accepted maximum number of priorities.
- [x] Add a route test for rejecting too many priorities.
- [x] Run focused planning tests.
- [x] Run `npm run typecheck`.

Completion note:

The product rule is now three day priorities. The server validator accepts slots `1 | 2 | 3` and up to three priorities, matching the shared planning contract and existing client assumptions. Focused route tests now cover accepting three priorities and rejecting more than three.

Risk level: High

Estimated difficulty: Small

Timing: Now

### 4. Protect Meal Planner Drafts From Autosave Data Loss

Files:

- `client/src/features/health/MealPlannerPage.tsx`
- `client/src/shared/lib/api/health.ts`
- Potential new file: `client/src/features/health/useMealPlanDraft.ts`
- Potential new file: `client/src/features/health/mealPlanDraftModel.ts`

Problem:

`MealPlannerPage` hydrates local state from `weekQuery.data` unconditionally. Recipe creation can trigger `templatesQuery.refetch()` and `weekQuery.refetch()` before the 800ms autosave lands. A stale refetch can overwrite unsaved local edits. Week navigation can also cancel a pending autosave timeout.

Why it matters:

This is a user-visible data-loss risk, not just a maintainability issue.

Recommended refactor:

Extract draft hydration and autosave into a focused hook or model helper. Track dirty state and skip hydration when local edits are newer than server data. Consider flushing pending saves before week navigation.

Checklist:

- [ ] Add a pure helper for building and comparing meal-plan save payloads.
- [ ] Extract draft state and autosave into a hook.
- [x] Track whether local draft is dirty.
- [x] Prevent server refetch hydration from overwriting dirty local state.
- [x] Flush pending autosave before changing weeks, or block navigation until save completes.
- [x] Avoid refetching the week after recipe creation until local assignment has been saved or reconciled.
- [ ] Add tests if a client test harness is introduced; otherwise document manual verification.
- [ ] Manual verification: create recipe, immediately assign to slot, confirm assignment survives refetch/autosave.
- [ ] Manual verification: edit a week and navigate away quickly, confirm save behavior is explicit and safe.
- [x] Run `npm run typecheck`.

Completion note:

`MealPlannerPage` now skips stale server hydration when local draft state is dirty, retries autosave after failed attempts, saves before week navigation, and avoids refetching the week immediately after recipe creation. The larger hook/model extraction remains a Phase 2 maintainability improvement.

Risk level: High

Estimated difficulty: Medium

Timing: Now

### 5. Fix Finance Bill Payment Double Counting

Files:

- `server/src/modules/finance/routes.ts`
- `server/src/modules/finance/service.ts`
- `server/test/modules/finance/routes.test.ts`
- `packages/contracts/src/finance.ts`
- `client/src/features/finance/FinancePage.tsx`

Problem:

`/bills/:billId/pay-and-log` creates an `Expense` and may also create a `FinanceTransaction`. The dashboard computes `ledgerSpentMinor + legacySpentMinor`, where ledger spend comes from transactions and legacy spend comes from expenses. This likely double-counts paid bills.

Why it matters:

Finance totals are core user trust surfaces. Wrong totals are high-impact correctness bugs.

Recommended refactor:

Add a regression test first. Then define one canonical source for spend totals. If ledger transactions are the future source of truth, treat legacy expenses separately and avoid summing linked bill expenses twice.

Checklist:

- [x] Add regression test for bill pay-and-log with both expense and transaction.
- [x] Confirm whether dashboard total currently double-counts.
- [x] Define canonical spend model: ledger-first, legacy-first, or explicit reconciliation.
- [x] Update dashboard aggregation.
- [x] Inspect finance summary aggregation for the same issue.
- [x] Verify bill reconciliation statuses remain correct.
- [x] Run focused finance tests.
- [x] Run `npm run typecheck`.

Completion note:

Dashboard spend is now ledger-first for linked bill transactions and only includes legacy expenses when they are not already represented by a ledger bill transaction. A regression test covers one linked bill expense plus one ledger transaction so totals and recent transaction counts do not double-count.

Risk level: High

Estimated difficulty: Medium

Timing: Now

### 6. Fix Goal Domain/Horizon Reorder Unique Constraint Collisions

Files:

- `server/src/modules/planning/planning-repository.ts`
- `server/prisma/schema.prisma`
- Potential focused test file: `server/test/modules/planning/goal-config.test.ts`

Problem:

`GoalDomainConfig` and `GoalHorizonConfig` have `@@unique([userId, sortOrder])`, but replacement logic updates rows directly. Reordering rows can temporarily assign a duplicate `sortOrder` and trigger Prisma unique constraint errors.

Why it matters:

Settings/config reorder should be reliable. The code already uses a safer two-phase offset strategy for priorities; this should use the same pattern.

Checklist:

- [x] Add focused tests for swapping two goal domains.
- [x] Add focused tests for swapping two goal horizons.
- [x] Implement a two-phase reorder strategy.
- [x] Temporarily move existing rows to offset sort values before final sort values.
- [x] Run focused planning/settings tests.
- [x] Run `npm run test -w server`.
- [x] Run `npm run typecheck`.

Completion note:

Goal domain and horizon replacement now first moves existing rows to temporary offset sort orders, then writes final sort orders. Focused repository tests cover swapping two domains and swapping two horizons.

Risk level: High

Estimated difficulty: Small

Timing: Now

## Phase 2 Checklist: Should Fix

These are important improvements after Phase 1 is stable.

### 7. Split Finance Routes by Real Workflow Boundaries

File:

- `server/src/modules/finance/routes.ts`

Problem:

The file is 3,679 lines and contains local contracts, zod schemas, enum mapping, serializers, ownership checks, account balances, dashboard aggregation, month planning, insights, bill reconciliation, debt flows, and route registration.

Why it matters:

Every finance change risks unrelated finance regressions. Reviewers cannot quickly tell whether a change affects read models, write workflows, or HTTP plumbing.

Suggested split:

- `server/src/modules/finance/finance-schemas.ts`
- `server/src/modules/finance/finance-mappers.ts`
- `server/src/modules/finance/accounts-routes.ts`
- `server/src/modules/finance/transactions-routes.ts`
- `server/src/modules/finance/bills-routes.ts`
- `server/src/modules/finance/bill-service.ts`
- `server/src/modules/finance/dashboard-service.ts`
- `server/src/modules/finance/month-plan-service.ts`
- `server/src/modules/finance/insights-service.ts`

Checklist:

- [ ] Do not split the whole file in one giant PR if avoidable.
- [ ] Move pure serializers and enum mappers first.
- [ ] Move dashboard read model into a service with tests.
- [ ] Move bill payment/reconciliation into a service with tests.
- [ ] Move month-plan logic into a service with tests.
- [ ] Keep route handlers thin: auth, parse, call service, send response.
- [ ] Run focused finance tests.
- [ ] Run `npm run typecheck`.

Risk level: High

Estimated difficulty: Large

Timing: Soon, before more finance features

### 8. Extract Meal Planner Backend Service

File:

- `server/src/modules/health/routes.ts`

Problem:

`saveMealPlanWeek` is roughly 300+ lines and mixes week validation, ownership checks, entry diffing, prep task creation/update/drop behavior, manual grocery sync, and generated grocery rebuilds.

Why it matters:

Meal planning has multiple stateful child collections. Regressions here can delete entries, drop prep tasks, or lose grocery checked state.

Suggested split:

- `server/src/modules/health/meal-plan-service.ts`
- `server/src/modules/health/meal-plan-mappers.ts`
- Keep simple water, meal-log, workout, and weight routes in `routes.ts` until there is a reason to split them.

Checklist:

- [ ] Add tests for creating a new week.
- [ ] Add tests for updating existing meal entries.
- [ ] Add tests for deleting removed entries.
- [ ] Add tests for prep session task creation.
- [ ] Add tests for prep session task update.
- [ ] Add tests for prep session deletion marking linked task dropped.
- [ ] Add tests for manual grocery preservation.
- [ ] Add tests for generated grocery checked-state preservation.
- [ ] Extract service after tests exist.
- [ ] Run focused health tests.
- [ ] Run `npm run typecheck`.

Risk level: High

Estimated difficulty: Medium

Timing: Soon

### 9. Replace Broad Client Query Invalidation

File:

- `client/src/shared/lib/api/core.ts`

Problem:

`invalidateCoreData` invalidates tasks, home, focus, score, planning, habits, health, finance, goals, reviews, and notifications for many domain mutations.

Why it matters:

This makes data flow hard to reason about and can cause refetch storms. It also increases the chance that unrelated refetches overwrite local UI state.

Checklist:

- [ ] Inventory every mutation that calls `invalidateCoreData`.
- [ ] Define domain-specific invalidation helpers.
- [ ] Keep explicit shared dependencies where needed, such as tasks affecting home/score/planning.
- [ ] Avoid invalidating health/finance/goals/reviews for unrelated task-only mutations unless product behavior requires it.
- [ ] Confirm meal planner autosave is not vulnerable to unrelated refetches.
- [ ] Run `npm run typecheck`.
- [ ] Manually verify common workflows: task update, habit checkin, water log, bill mark paid, goal update.

Risk level: Medium

Estimated difficulty: Medium

Timing: After Phase 1

### 10. Add Shared Validation for Timezones and Date Ranges

Files:

- `server/src/modules/onboarding/routes.ts`
- `server/src/modules/settings/routes.ts`
- `server/src/modules/finance/routes.ts`
- `server/src/modules/health/routes.ts`
- `server/src/lib/time/user-time.ts`
- Potential new file: `server/src/lib/validation/date-range.ts`
- Potential new file: `server/src/lib/validation/timezone.ts`

Problems:

Onboarding can persist unvalidated timezones. Finance and health endpoints accept inverted or overly broad date ranges.

Why it matters:

Invalid timezones can break later time computations. Unbounded date ranges can cause large reads and confusing empty responses.

Checklist:

- [x] Create a shared timezone validation helper.
- [x] Use it in onboarding and settings payloads.
- [x] Add tests for invalid timezone rejection.
- [x] Create a shared date range schema/helper with `from <= to`.
- [x] Add reasonable max range constraints per use case.
- [x] Use it in finance transaction/expense ranges.
- [x] Use it in health summary ranges.
- [x] Add tests for inverted ranges.
- [x] Add tests for too-large ranges.
- [x] Run `npm run test -w server`.
- [x] Run `npm run typecheck`.

Completion note:

Timezone validation now uses a shared schema/helper in onboarding and settings. Finance transaction/expense ranges and health summary ranges now reject inverted ranges and enforce bounded maximum lengths. Tests cover invalid onboarding/settings timezones plus inverted and overly broad finance/health ranges.

Risk level: Medium

Estimated difficulty: Small to Medium

Timing: After Phase 1

### 11. Fix Month-Plan Duplicate Category Watch Handling

Files:

- `server/src/modules/finance/routes.ts`
- `server/prisma/schema.prisma`
- `server/test/modules/finance/routes.test.ts`

Problem:

Month-plan category watches do not reject duplicate category IDs before `createMany`, despite a DB unique constraint.

Why it matters:

Users can hit an internal constraint error instead of a clear validation message.

Checklist:

- [ ] Add test for duplicate watched category IDs.
- [ ] Validate uniqueness before writing.
- [ ] Return user-safe 400 with a clear message.
- [ ] Run focused finance tests.
- [ ] Run `npm run typecheck`.

Risk level: Medium

Estimated difficulty: Small

Timing: After Phase 1

### 12. Decouple Notification Generation From Notification Reads

Files:

- `server/src/modules/notifications/routes.ts`
- `server/src/modules/notifications/service.ts`
- `server/src/jobs/registry.ts`

Problem:

Notification reads trigger generation and DB writes before returning the list.

Why it matters:

Read latency becomes coupled to rule generation. Failures in generation can affect a simple read endpoint.

Checklist:

- [ ] Identify whether on-read generation is required for current UX.
- [ ] If not required, move generation to scheduled jobs or explicit sync endpoint.
- [ ] If required, isolate failures so reads still return existing notifications.
- [ ] Add tests for generation failure behavior.
- [ ] Run notification tests.
- [ ] Run `npm run typecheck`.

Risk level: Medium

Estimated difficulty: Medium

Timing: After Phase 1

## Phase 3 Checklist: Optional Cleanup

These are useful but should not distract from correctness and boundary fixes.

### 13. Reduce Smoke Test Size

File:

- `server/test/modules/routes-smoke.test.ts`

Problem:

The smoke test file is 4,770 lines with large inline Prisma mocks. It verifies many endpoints return 200, but failures are hard to localize.

Checklist:

- [ ] Keep a small smoke suite for module registration and basic endpoint availability.
- [ ] Move finance behavior tests into `server/test/modules/finance/routes.test.ts`.
- [ ] Move health behavior tests into focused health test files.
- [ ] Move planning bulk behavior tests into planning route test files.
- [ ] Extract reusable mock fixtures into `server/test/utils`.
- [ ] Avoid reducing coverage while shrinking the file.

Risk level: Medium

Estimated difficulty: Medium

Timing: Optional after Phase 1 and 2

### 14. Clean Dependency Direction in Recurrence

File:

- `server/src/lib/recurrence/tasks.ts`

Problem:

The recurrence library imports `goalSummaryInclude` from the planning module. That couples low-level recurrence logic to a planning response shape.

Checklist:

- [ ] Decide whether recurrence materialization should return plain task records or planning-shaped records.
- [ ] Move planning-specific include/mapping into planning callers.
- [ ] Keep `server/src/lib` domain-neutral where practical.
- [ ] Remove planning import from recurrence lib.
- [ ] Add focused recurrence tests if behavior changes.

Risk level: Medium

Estimated difficulty: Medium

Timing: Optional

### 15. Remove Production `any` and Optional Prisma Delegates

Files:

- `server/src/modules/planning/planning-repository.ts`
- Other production files using `as any` around Prisma

Problem:

Production code uses broad `any` and optional Prisma delegates around models that should exist in the generated client.

Why it matters:

This masks stale Prisma generation, missing migrations, and incomplete test mocks.

Checklist:

- [ ] Inventory production `any` usage around Prisma.
- [ ] Replace with `PrismaClient` or transaction client types where possible.
- [ ] Remove optional delegate calls for models that should exist.
- [ ] Fix test mocks instead of weakening production code.
- [ ] Run `npm run typecheck`.
- [ ] Run planning tests.

Risk level: Low to Medium

Estimated difficulty: Medium

Timing: Optional

### 16. Split Large Client Components by Workflow

Files:

- `client/src/features/finance/FinancePage.tsx`
- `client/src/features/goals/GoalsPlanWorkspace.tsx`
- `client/src/features/goals/GoalsPlanGraphView.tsx`
- `client/src/features/today/components/PlannerBlock.tsx`
- `client/src/features/today/components/DayPlanner.tsx`

Guidance:

Do not split these purely because they are large. Split only when a boundary reduces state/data-flow risk or makes future changes easier.

Good split candidates:

- Finance transaction form workflow
- Finance bill workflow
- Finance setup workflow
- Goal graph layout model
- Planner block drag/resize model

Checklist:

- [ ] Extract pure helpers before visual component splits.
- [ ] Avoid moving JSX into many tiny files without reducing state complexity.
- [ ] Keep page-level orchestration readable.
- [ ] Add client tests only if a test runner is introduced.
- [ ] Otherwise document manual verification.

Risk level: Low to Medium

Estimated difficulty: Medium to Large

Timing: Optional

## Large Files and Recommended Treatment

| File | Approximate Size | Responsibility Problem | Treatment |
|---|---:|---|---|
| `server/src/modules/finance/routes.ts` | 3,679 lines | Too many finance workflows and layers in one file. | Refactor in Phase 1/2. |
| `server/src/modules/health/routes.ts` | 2,001 lines | Meal planner workflow mixed with simple health logs. | Extract meal planner service first. |
| `client/src/features/health/MealPlannerPage.tsx` | 2,223 lines | Draft, autosave, drag/drop, modals, rendering. | Fix autosave first, then split model/hook. |
| `client/src/features/goals/GoalsPlanWorkspace.tsx` | 1,725 lines | Many UI modes and graph/planning interactions. | Leave until goal work resumes; split by workflow later. |
| `client/src/features/finance/FinancePage.tsx` | 1,464 lines | Dashboard, bills, debt, setup, forms, mutations. | Split after finance data correctness fixes. |
| `server/test/modules/routes-smoke.test.ts` | 4,770 lines | Mega-test with too many inline mocks. | Shrink after focused tests exist. |
| `server/src/modules/scoring/service.ts` | 1,119 lines | Large but cohesive scoring workflow. | Leave alone unless changing scoring. |
| `server/src/modules/reviews/review-service/review-history.ts` | 816 lines | Large but cohesive read model. | Leave alone unless changing reviews. |

## Code That Should Not Be Refactored Right Now

Leave these areas alone unless there is a behavior change tied to the work:

- `server/src/modules/scoring/service.ts`
- `server/src/modules/reviews/review-service/review-history.ts`
- `server/src/modules/planning/planning-mappers.ts`
- `server/src/modules/reviews/review-service/daily-reviews.ts`
- `server/src/modules/health/summary-builder.ts`
- Simple repeated route boilerplate such as `requireAuthenticatedUser` plus `parseOrThrow`
- Existing serializers near module boundaries
- CSS and visual structure unless directly tied to a UI behavior fix

These areas may look imperfect, but refactoring them now would add risk without enough immediate payoff.

## AI-Generated Pattern Risks to Watch

Patterns observed during review:

- Large files that accreted multiple responsibilities instead of forming workflow boundaries.
- Repeated local DTO definitions despite an existing contracts package.
- Route files mixing HTTP handlers, validation, persistence, serialization, and business rules.
- Broad invalidation as a substitute for explicit data dependencies.
- Mega-tests that prove many endpoints return 200 but make behavior failures hard to isolate.
- `any` and optional generated-client access in production code to work around mocks or migration drift.

Use these as review smells, not automatic refactor triggers.

## Suggested Implementation Order

1. Make server tests green. Done.
2. Align contracts and client/server schemas. Partially done: planning, finance, and health API DTOs plus day priorities are aligned; other API modules still have local DTOs.
3. Fix meal planner draft overwrite risk. Done for the high-risk autosave/refetch paths; hook extraction remains.
4. Fix finance double-counting. Done for dashboard linked-bill double counting.
5. Fix goal config reorder collisions. Done.
6. Add shared date-range/timezone validation. Done for onboarding/settings timezone and finance/health range endpoints.
7. Extract finance services in small, tested steps.
8. Extract meal planner backend service.
9. Replace broad client invalidation.
10. Shrink smoke tests after focused coverage exists.

## Definition of Done for This Refactoring Program

- [x] `npm run typecheck` passes.
- [x] `npm run test -w server` passes.
- [ ] Client imports API DTOs from `@life-os/contracts` where contracts exist.
- [x] Day priority contract/server/client behavior is aligned.
- [x] Meal planner dirty drafts cannot be overwritten by stale refetches.
- [x] Finance dashboard does not double-count bill payments.
- [x] Goal domain/horizon reorder does not hit unique constraint collisions.
- [ ] Finance route file is split enough that new bill/dashboard/month-plan changes are localized.
- [ ] Meal planner save behavior has focused backend tests.
- [ ] Broad invalidation is replaced or substantially reduced.
- [ ] Remaining large files have clear ownership and are intentionally left alone.

## Final Recommendation

The safest next step is to complete Phase 1 before adding more features. The codebase is not broken beyond repair; it has a solid foundation, but the high-growth areas need guardrails now. Prioritize correctness, contracts, and testability over cosmetic cleanup.
