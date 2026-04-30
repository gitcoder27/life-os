# Life OS Refactoring Review: Top 5 Files

Purpose: identify the five files where focused refactoring would most improve code quality, readability, and ease of future change without making the project more complicated.

This review used four parallel sub-agent passes plus a local cross-check:

- Frontend application review: `client/src`
- Backend API review: `server/src`
- Contracts and shared library review: `packages/contracts`, `client/src/shared`
- Planning, Today, and Goals product-area review: client and server together

## Review Principles

- Refactor only where the file currently owns too many real responsibilities.
- Preserve behavior and public API shapes unless a separate product decision says otherwise.
- Prefer extracting cohesive helpers, hooks, services, and mappers over broad rewrites.
- Keep route handlers thin: authentication, validation, calling a service, returning a response.
- Keep React page components as screen shells where possible: data loading, layout, and wiring.
- Add or update tests when server behavior changes; document manual verification for UI-only behavior.

## Executive Summary

The strongest refactoring pattern is not poor naming or low-level style. It is workflow concentration: a few files have become mini-applications that combine validation, data access, business rules, UI state, mutation orchestration, and rendering.

The top five refactor candidates are:

| Rank | File | Priority | Why It Matters |
|---:|---|---|---|
| 1 | `server/src/modules/finance/routes.ts` | Critical | Largest backend hotspot; mixes schemas, mappers, business workflows, persistence, and 40+ route handlers. |
| 2 | `client/src/features/finance/FinancePage.tsx` | Critical | Largest frontend hotspot; combines finance cockpit UI, many forms, many mutations, setup flows, and timeline mapping. |
| 3 | `client/src/features/health/MealPlannerPage.tsx` | High | Stateful meal-planning screen with drag/drop, draft hydration, autosave, groceries, prep, recipes, and navigation in one file. |
| 4 | `server/src/modules/health/routes.ts` | High | Meal-planner backend workflow and health CRUD live in one route file; save logic is hard to reason about safely. |
| 5 | `client/src/features/goals/GoalsPlanWorkspace.tsx` | High | Goals HQ orchestrates graph state, hierarchy state, planning lanes, inspector flows, mutations, and UI components together. |

## Critical: Do First

### 1. `server/src/modules/finance/routes.ts`

Current shape:

- About 3,955 lines.
- Defines schemas, enum conversions, serializers, ownership checks, dashboard builders, insight builders, Prisma writes, and Fastify route handlers.
- Registers 40+ finance routes starting around `registerFinanceRoutes`.
- The bill payment and reconciliation flow around `/bills/:billId/pay-and-log` is especially dense and repeats expense/transaction creation behavior.

Refactor goal:

Make finance routes easy to scan and make risky money workflows testable in isolation.

Recommended low-complexity refactor:

- Extract `finance-schemas.ts` for Zod request schemas.
- Extract `finance-mappers.ts` for Prisma-to-contract enum conversion and serializers.
- Extract `finance-dashboard-service.ts` for dashboard/month-plan/insight read models only if the split stays cohesive.
- Extract a focused `bill-reconciliation-service.ts` for pay, mark-paid, link-expense, reschedule, and dismiss logic.
- Leave route handlers as authentication, `parseOrThrow`, service call, and `reply.send`.

Immediate checklist:

- [ ] Start with bill payment/reconciliation helpers because that is the highest-risk workflow.
- [ ] Add focused tests around paying a bill with expense, marking paid without expense, linking an existing expense, and duplicate payment conflict handling.
- [ ] Move serializers only after tests protect route behavior.
- [ ] Run `npm run test -w server` and `npm run typecheck`.

Avoid:

- Do not create a generic finance repository layer for everything.
- Do not split by line count alone.
- Do not change response contracts as part of the refactor.

### 2. `client/src/features/finance/FinancePage.tsx`

Current shape:

- About 2,342 lines.
- Owns page tabs, setup flows, transaction/bill/expense forms, account/category/card/loan/income forms, many mutation hooks, derived money-event rows, and large render sections.
- Form state and submit handlers start early in the component and run through many finance workflows.

Refactor goal:

Turn the page into a readable cockpit shell while keeping finance behavior familiar.

Recommended low-complexity refactor:

- Extract `buildMoneyEvents` as a pure helper with tests if a frontend test harness is added later.
- Extract finance form state into small hooks, for example `useFinanceSetupForms`, `useFinanceBillForms`, and `useFinanceDebtForms`.
- Move repeated setup/list panels into sibling components.
- Keep data fetching and high-level tab selection in `FinancePage`.

Immediate checklist:

- [ ] Extract pure timeline/money-event mapping first; it has the best value-to-risk ratio.
- [ ] Extract setup forms after the pure helper lands.
- [ ] Keep mutation hook ownership close to the page until the component split makes the desired boundary obvious.
- [ ] Run `npm run typecheck`.
- [ ] Manually verify account setup, bill creation, paying/logging a bill, and timeline actions.

Avoid:

- Do not introduce a large global finance state store.
- Do not split every small panel into a file before extracting the logic that actually reduces cognitive load.

## High: Do Next

### 3. `client/src/features/health/MealPlannerPage.tsx`

Current shape:

- About 2,264 lines.
- Combines recipe library UI, recipe composer, drag/drop scheduling, draft hydration, autosave, week navigation, groceries, prep sessions, and notes.
- Autosave and draft state are the most sensitive parts because they coordinate local edits and server data.

Refactor goal:

Make meal-plan draft behavior explicit and easier to protect from regressions.

Recommended low-complexity refactor:

- Extract `useMealPlanDraft` for entries, prep sessions, groceries, notes, dirty state, hydration, and autosave.
- Move `RecipeLibraryBar`, `RecipeComposer`, `PrepPanel`, `GroceryPanel`, and `WeekNotesPanel` into feature-local component files.
- Keep drag/drop wiring in the page until draft state is safely extracted.

Immediate checklist:

- [ ] Extract pure helpers for payload building/comparison before moving React state.
- [ ] Extract `useMealPlanDraft` with no visual changes.
- [ ] Manually verify creating a recipe, assigning it immediately, waiting for autosave, and navigating between weeks.
- [ ] Run `npm run typecheck`.

Avoid:

- Do not rewrite drag/drop behavior while extracting draft state.
- Do not change autosave timing or persistence semantics unless explicitly testing that behavior.

### 4. `server/src/modules/health/routes.ts`

Current shape:

- About 1,999 lines.
- Owns meal template JSON parsing, meal-plan diffing, prep-task syncing, grocery regeneration, summary aggregation, and CRUD routes for water, meals, workouts, and weight.
- `saveMealPlanWeek` is the key complexity center.

Refactor goal:

Separate health route registration from the meal-planning workflow and health summary read model.

Recommended low-complexity refactor:

- Extract `meal-template-payload.ts` for parsing and normalizing meal template payloads.
- Extract `meal-plan-service.ts` for `buildMealPlanWeekResponse`, `saveMealPlanWeek`, grocery regeneration, and prep-session task syncing.
- Extract `health-summary-service.ts` if summary route logic continues to grow.
- Keep response shapes and database writes unchanged.

Immediate checklist:

- [ ] Move meal template payload parsing first because it is mostly pure and easy to verify.
- [ ] Move `saveMealPlanWeek` as a service only after adding or confirming route tests around save behavior.
- [ ] Run `npm run test -w server` and `npm run typecheck`.

Avoid:

- Do not combine all health persistence into a generic repository.
- Do not move meal-plan and water/weight/workout logic together; they are different workflows.

### 5. `client/src/features/goals/GoalsPlanWorkspace.tsx`

Current shape:

- About 1,721 lines.
- Coordinates hierarchy rendering, graph expansion/focus state, planning dock state, inspector state, child-goal creation, drag/drop outcomes, archive/detach/duplicate flows, and planning-lane mutations.
- Many effects and callbacks are related but spread across one component.

Refactor goal:

Make Goals HQ easier to modify by separating orchestration domains: planning dock, hierarchy actions, and local UI pieces.

Recommended low-complexity refactor:

- Extract `useGoalsPlanningDockState` for planning selection, draft, replacement, save, and remove flows.
- Extract `useGoalHierarchyActions` for child creation, detach, duplicate, archive, and graph drop handling.
- Move `HierarchyRail` and `PlanInspector` into sibling components.
- Keep the graph component API stable while extracting workspace state.

Immediate checklist:

- [ ] Extract local pure helpers and local child components first.
- [ ] Extract planning dock state second, with manual verification around adding/replacing/removing month and week focus items.
- [ ] Extract hierarchy actions third.
- [ ] Run `npm run typecheck`.

Avoid:

- Do not refactor `GoalsPlanGraphView.tsx` at the same time unless the change is only moving node/layout helpers.
- Do not create a global goals workflow store unless repeated state ownership remains after the smaller extractions.

## Next Tier Findings

These did not make the top five, but they are worth scheduling after the immediate group.

| File | Priority | Recommended Action |
|---|---|---|
| `server/src/modules/planning/task-routes.ts` | High | Extract task query and mutation services; keep routes thin. |
| `server/src/modules/planning/planning-repository.ts` | High | Split planner blocks, milestones, priorities, goal config, and task templates by bounded area; replace broad `any` Prisma types. |
| `client/src/features/goals/GoalsPlanGraphView.tsx` | Medium | Move node components and pure graph layout/filter helpers into local files. |
| `server/src/modules/scoring/service.ts` | Medium | Split context loading from bucket calculation; extract bucket calculators. |
| `client/src/shared/lib/recurrence.ts` | High | Stop mirroring contract recurrence types; import shared contract types and keep only formatting/calculation helpers here. |
| `client/src/shared/lib/api/core.ts` | High | Narrow this file toward transport/error helpers; move domain query keys beside domain API modules over time. |
| `client/src/shared/lib/api/auth.ts` | High | Import auth request/response types from contracts instead of redeclaring them locally. |
| `client/src/shared/lib/api.ts` | Medium | Keep as compatibility barrel, but migrate new imports to narrower domain entrypoints. |

## Suggested Refactoring Order

1. Finance backend bill reconciliation service.
2. Finance frontend money-event and form-state extraction.
3. Meal planner draft hook.
4. Health backend meal-plan service.
5. Goals workspace planning/hierarchy extraction.
6. Planning task routes and planning repository split.
7. Shared contracts/API cleanup.

## Verification Guidance

For backend refactors:

- Run `npm run typecheck`.
- Run `npm run test -w server`.
- Prefer focused tests for finance, health, and planning route behavior before the full suite.

For frontend refactors:

- Run `npm run typecheck`.
- Do not run app dev servers from an agent.
- Manual verification should cover the workflow being extracted, not only page load.

Manual verification examples:

- Finance: create account, add bill, pay and log bill, mark bill paid, link expense, verify totals and timeline.
- Meal planner: create recipe, drag recipe to a slot, edit servings/note, add grocery, navigate weeks before and after autosave.
- Goals HQ: select goal, add child, drag goal under another goal, add to month/week focus, replace/remove planning item.

## Final Recommendation

Refactor in thin, behavior-preserving slices. The best first move is not a large cleanup branch; it is a small finance backend extraction with tests, followed by a matching finance frontend simplification. That creates momentum while proving the repo can absorb these changes safely.
