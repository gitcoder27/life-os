# Life OS Scoring System Audit - 2026-05-04

## Scope

This audit reviewed the gamified scoring system across the shipped Life OS surfaces: Home, Today, Day Planner, Inbox, Habits, Health, Meals, Finance, Goals, Focus, Reviews, Settings, and onboarding-adjacent setup flows.

The review covered:

- the active scoring PRD in `docs/prd/scoring-system.md`
- the backend scoring service in `server/src/modules/scoring/service.ts`
- daily review finalization in `server/src/modules/reviews/review-service/daily-reviews.ts`
- habit, routine, health, finance, planning, and settings mutations that can affect score inputs
- frontend score display and cache invalidation paths

No application code was changed by this audit. This document is the deliverable.

## Executive Summary

The scoring system is not fully safe yet. The core scoring model is centralized and mostly understandable, which is good, but several high-impact gaps can make the score inaccurate, stale, or inconsistent with the product rules.

Highest-risk findings:

- Finalized daily scores can drift after closure because daily score reads recompute live data instead of returning the stored finalized score.
- Finance screen ledger transactions can miss the Finance/Admin score entirely because scoring reads legacy `Expense` rows, while the primary transaction form writes `FinanceTransaction`.
- Backfilled timed habits and routines can incorrectly earn punctuality credit because scoring compares local completion time but not completion date.
- Daily review and tomorrow-prep rules are inconsistent: rescue/recovery reviews can be valid with one tomorrow priority, while scoring requires at least two.
- Several frontend mutations invalidate today's score even when the changed record belongs to another date, so users can complete or log something and still see a stale score.

So the answer is not "everything is fine." The architecture is close, but score immutability, finance integration, backfill rules, and cache invalidation need attention before the gamified score can be considered accurate.

## How Scoring Currently Works

Daily score is calculated by `calculateDailyScore` in `server/src/modules/scoring/service.ts`. It builds a day context, calculates applicable buckets, and returns a 0-100 value.

Current bucket implementation:

- Plan and Priorities: launch completion, must-win task progress, two support priorities, and a small scheduled-task contribution.
- Routines and Habits: routine item completion, due habit completion, and timed punctuality.
- Health Basics: water target, meal logs, workout/recovery adherence.
- Finance and Admin: legacy expense count and due admin item completion.
- Review and Reset: daily review completion and tomorrow priority preparation.

Frontend score reads are centered around:

- `useDailyScoreQuery(date)` for the score ring and daily breakdown.
- `useWeeklyMomentumQuery(date)` for weekly momentum.
- `useScoreHistoryQuery(date, days)` for Home trend ribbons/history.
- `invalidateCoreData(queryClient, date, { domains: ["score", ...] })` for mutation-driven refreshes.

## Severity Legend

- P1: Can produce materially incorrect score or violate closed-day score expectations.
- P2: Can produce stale, inconsistent, or spec-divergent scoring in common workflows.
- P3: Lower-risk scoring hygiene, over-invalidation, or guardrail gap.

## Findings

| ID | Severity | Area | Finding | Evidence | Impact | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- |
| S-01 | P1 | Finalized scores | Finalized daily scores can change after closure. `calculateDailyScore` always recomputes the live score and only copies `finalizedAt` from the stored score. | `server/src/modules/scoring/service.ts:620-820`, `server/src/modules/scoring/service.ts:823-881`, `server/src/modules/scoring/routes.ts`, `docs/prd/scoring-system.md:182-188` | A user can finalize a day, then later edits/backfills/settings changes can make the displayed score differ from the persisted finalized score. This violates the anti-gaming rule that closed-day scores should not change except through explicit correction flows. | Return stored `DailyScore` for finalized/closed days by default. Add an explicit live-preview mode only where product needs it. Store and read the finalized breakdown consistently. |
| S-02 | P1 | Finance | New Finance ledger transactions do not count toward Finance/Admin scoring. The primary transaction form writes `FinanceTransaction`, but scoring only reads legacy `Expense` rows. | `client/src/features/finance/FinancePage.tsx:384-397`, `server/src/modules/finance/routes.ts:1851-1890`, `server/src/modules/scoring/service.ts:438-445`, `server/src/modules/scoring/service.ts:766-780` | A user can add an expense through the newer "Save entry" workflow and receive no score credit. Legacy expense and pay-and-log bill paths can count, so behavior differs by UI path. | Make the score consume `FinanceTransaction` rows with `transactionType = EXPENSE`, or consistently dual-write/dedupe legacy `Expense` records. Be careful because bill payment currently can create both an `Expense` and a `FinanceTransaction`. |
| S-03 | P1 | Habits/Routines | Backfilled timed habit and routine check-ins can receive punctuality credit incorrectly. Check-ins accept a target date but store `completedAt = new Date()`, and timing evaluation checks local minutes without validating that the completion date matches the target date. | `server/src/modules/habits/habit-service.ts:407-451`, `server/src/modules/habits/routine-service.ts:264-287`, `server/src/lib/habits/timing.ts:37-49`, `server/src/modules/scoring/service.ts:702-729` | A user can log yesterday's timed habit today and get yesterday's on-time punctuality if the current local time is before the deadline. This directly overstates discipline points. | For punctuality, require `completedAt` local date to equal the score target date. For backfills, either store a real completion timestamp from the payload or award completion count without punctuality unless the timestamp is known and valid. |
| S-04 | P1 | Reviews | Tomorrow-prep scoring conflicts with valid daily review submission rules. Daily review allows one tomorrow priority for downgraded rescue/recovery days, but scoring requires at least two priorities for the 4-point tomorrow-prep credit. | `server/src/modules/reviews/review-service/daily-reviews.ts:459-470`, `server/src/modules/scoring/service.ts:783-790` | A user can complete a valid review exactly as required and still lose tomorrow-prep score. | Align scoring and validation. Either require two priorities everywhere, or award tomorrow-prep according to `getRequiredTomorrowPriorityCount`. |
| S-05 | P2 | Reviews | Daily review replaces tomorrow priorities twice, once inside the transaction and again after finalizing the daily score. | `server/src/modules/reviews/review-service/daily-reviews.ts:540-568`, `server/src/modules/reviews/review-service/daily-reviews.ts:720-721` | The finalized score can be computed against one tomorrow-priority state, then the response can return a second replacement. This also creates unnecessary ID churn and a partial-failure risk. | Replace priorities once, finalize score after the final priority state is durable, and keep the operation in one coherent transaction or staged workflow. |
| S-06 | P2 | Plan/Priorities | Implementation diverges from the active scoring PRD. PRD says top priorities 1/2/3 are worth 10/8/6 and daily tasks/reminders are worth 6. Implementation uses launch 4, must-win 10, only two support priorities 8/6, and scheduled tasks worth only 2. | `docs/prd/scoring-system.md:71-85`, `server/src/modules/scoring/service.ts:635-663` | Users and docs may expect a different score than the app calculates. This may be intentional after the Today redesign, but the spec and implementation no longer agree. | Make a product decision: either update the PRD to the launch/must-win model or change scoring to match top-priority/task weights. |
| S-07 | P2 | Weekly momentum/streaks | Strong-day streak threshold is inconsistent. PRD says `70+`; implementation uses `85+`. | `docs/prd/scoring-system.md:32-39`, `docs/prd/scoring-system.md:172-180`, `server/src/modules/scoring/service.ts:1041-1044` | Days scored 70-84 are labeled Solid Day but do not count toward the documented strong-day streak. | Change threshold to `>= 70`, or update product language and tests if "Strong Day" should mean 85+. |
| S-08 | P2 | API side effects | Score reads create planning cycles. `getDayContext` ensures day, tomorrow, week, current-month, and next-month cycles even for a score GET. | `server/src/modules/scoring/service.ts:273-324`, `server/src/modules/scoring/routes.ts` | Merely viewing a score for an arbitrary/future date can create durable planning records. This can pollute planning data and make score reads surprisingly write-heavy. | Split read-only score context from cycle creation, or only create cycles through planning/review workflows. |
| S-09 | P2 | Frontend cache | Score history is not invalidated by core score invalidation. `invalidateCoreData` refreshes daily score and weekly momentum, but not `scoreHistory`. | `client/src/shared/lib/api/core.ts:70-78`, `client/src/shared/lib/api/core.ts:338-341`, `client/src/features/home/StatusStrip.tsx` | Home's score ring can update while the trend/history ribbon remains stale. | Invalidate score history by predicate whenever score-affecting data changes. |
| S-10 | P2 | Today/Planner UI | The Today command bar always fetches today's score, even when the page is being used for another planner date. | `client/src/features/today/components/CommandBar.tsx:48-50`, `client/src/features/today/TodayPage.tsx` | On a future or past planner date, the score shown in the command bar can refer to the wrong day. | Pass the active planner date into `CommandBar` and query that date's score. |
| S-11 | P2 | Inbox/planning cache | Inbox scheduling supports arbitrary target dates, but the mutation hooks are initialized with today's date and invalidate only that date. | `client/src/features/inbox/InboxPage.tsx:64-67`, `client/src/features/inbox/InboxPage.tsx:229-240`, `client/src/features/inbox/InboxPage.tsx:340-345`, `client/src/shared/lib/api/planning.ts` | Scheduling a task for tomorrow or another day can affect that day's score inputs while leaving that score cache stale. | Make planning mutations invalidate the actual affected scheduled date from the payload, plus the previous scheduled date when moving tasks. |
| S-12 | P2 | Finance cache | Finance mutations pass today's date to invalidation while forms allow backdated or future dated entries. | `client/src/features/finance/FinancePage.tsx:193-208`, `client/src/features/finance/FinancePage.tsx:388-397`, `client/src/features/finance/FinancePage.tsx:458-465`, `client/src/features/finance/FinancePage.tsx:486-495`, `client/src/shared/lib/api/finance.ts:113-119` | A finance action can correctly save for another date while the affected date's score remains stale. | Invalidate based on `occurredOn`, `spentOn`, or `paidOn`, not only the page's `today`. |
| S-13 | P2 | Settings/cache | Daily water target changes affect the Health Basics score, but settings save invalidates only settings/session queries. | `client/src/features/settings/SettingsPage.tsx:157-168`, `client/src/features/settings/SettingsPage.tsx:309-320`, `client/src/shared/lib/api/settings.ts:39-42`, `server/src/modules/scoring/service.ts:739-741` | Changing the water target can immediately change today's score math, but the score may not refresh until a later unrelated invalidation. | When `dailyWaterTargetMl`, timezone, or week start changes, invalidate affected health, score, home, history, and weekly momentum queries. |
| S-14 | P2 | Health/Meals | Meal scoring ignores meal plan entries and uses only meal logs against a generic target count. PRD says planned meals should count when all planned meals are logged. | `docs/prd/scoring-system.md:100-112`, `server/src/modules/scoring/service.ts:421-428`, `server/src/modules/scoring/service.ts:743-747`, `server/src/lib/health/meals.ts` | Planned meal adherence is not directly scored. The score can say meal consistency is fine based on generic log count even if specific planned meals were missed. | Include planned meal entries in the score context and evaluate logged meals against the plan where one exists. |
| S-15 | P2 | Finance model | Expense scoring awards full 5 points for two legacy expense rows, regardless of whether "all known spend" was captured. | `docs/prd/scoring-system.md:125-135`, `server/src/modules/scoring/service.ts:766-767` | The Finance/Admin score can be gamed with two small entries and does not actually know whether all spending was logged. | Define a stronger source of truth for "known spend", or reword the score rule as "expense logging activity" and make the heuristic transparent. |
| S-16 | P2 | Task model | Scoring includes all scheduled task records, without an explicit scorable-kind filter. | `server/src/modules/scoring/service.ts:339-352`, `server/src/modules/scoring/service.ts:631-657` | If scheduled notes or non-action records exist, they can enter the task scoring denominator or credit path. This may be correct for reminders, but it should be explicit. | Filter to scorable kinds such as task/reminder, or add a `scoreEligible` concept. |
| S-17 | P2 | Habit pause cache | Habit pause windows can affect due habits across a date range, but frontend invalidation is today-centric. | `client/src/shared/lib/api/habits.ts`, `server/src/modules/scoring/service.ts:672` | Pausing future habits can change future score applicability while future score caches remain stale. | Invalidate score/home/planning for every affected date in the pause window, or invalidate score queries by predicate. |
| S-18 | P3 | Health cache | Weight log mutations invalidate score even though the PRD says body weight does not contribute to daily score. | `docs/prd/scoring-system.md:121-123`, `client/src/shared/lib/api/health.ts` | Mostly a performance/noise issue. It can trigger unnecessary refetches and make it harder to reason about which mutations truly affect score. | Remove score invalidation from weight-only changes unless another health input changed. |
| S-19 | P3 | Contracts/tests/data | Scoring response contracts are duplicated between backend service shapes and `packages/contracts`, and tests miss important edge cases. `DailyScore` also lacks database-level range/consistency constraints. | `packages/contracts/src/scoring.ts`, `server/src/modules/scoring/service.ts`, `server/prisma/schema.prisma`, `server/test/modules/scoring/service.test.ts` | Drift can slip through because the contract package, persistence model, and service math are not tightly guarded. | Import/shared type schemas where practical, add tests for finalized reads, finance ledger expenses, backfilled timed check-ins, rescue tomorrow-prep, 70-84 streaks, and score history invalidation. Consider DB check constraints for score ranges. |

## Screen-by-Screen Coverage

| Screen/Surface | Score-Related Operations | Current Assessment |
| --- | --- | --- |
| Home | Shows daily score, score reasons, score history, and weekly momentum. | Main daily score query is wired, but score history can go stale because history queries are not invalidated with score changes. Finalized score drift also affects Home because reads recompute live data. |
| Today | Launch, must-win progress, support priorities, scheduled task completion, habit/routine completion, water/meal/workout shortcuts, and review prompts can all affect score inputs. | Most inputs reach the central scorer. Main issues are the Plan/Priorities PRD drift, finalized score drift, and command bar using today's score even when viewing another planner date. |
| Day Planner | Scheduling, moving, and completing tasks can affect the Plan bucket for the target date. | Backend scoring reads scheduled tasks by date, but frontend invalidation must track the actual date being changed. |
| Inbox | Committing or scheduling captured items can move them into the scorable day plan. | Score path exists, but arbitrary-date scheduling invalidates today's score instead of the target date. |
| Habits | Habit check-ins, due-habit schedules, timed habits, and pause windows affect Routines/Habits. | Due-habit ratio is capped by target and avoids extra taps, which is good. The timed backfill punctuality issue is a significant accuracy bug. Pause-window cache invalidation is incomplete for date ranges. |
| Routines | Routine item check-ins affect Routines/Habits. | Completion ratio is covered. Timed routine punctuality has the same completed-date risk when backfilled. |
| Health | Water logs, meal logs, workout/recovery status affect Health Basics. | Core score inputs exist. Meal planning is not actually part of meal score, water target settings can stale-cache score, and weight over-invalidates score despite not contributing. |
| Meals | Meal logs contribute to Health Basics. Meal plan/prep workflows can indirectly create tasks. | Meal logs score, but planned meal adherence is not scored as described by the PRD. Meal-prep task creation can affect Plan bucket only through scheduled tasks. |
| Finance | Legacy expenses, pay-and-log bill, and due admin/bill items affect Finance/Admin. | Primary ledger transaction expenses are not counted, and backdated finance actions invalidate the wrong date. This is one of the biggest cross-screen scoring gaps. |
| Goals | Goal work affects score only when represented as scheduled/completed tasks or priorities. | This appears reasonable. There is no direct goal-progress score rule in the PRD, so no direct goal-score gap was found. |
| Reviews | Daily review earns Review/Reset points; tomorrow priorities earn tomorrow-prep points; finalization persists daily score. Weekly review affects weekly momentum. | Review submission and scoring are wired, but tomorrow-prep validation conflicts with scoring, priorities are replaced twice, and finalization does not make future reads immutable. |
| Focus | Focus sessions are not directly scored. Completing/advancing tasks during focus can affect Plan/Priorities. | This matches the current scoring model. No direct focus-session score rule was found. |
| Settings | Water target, timezone, and week start can affect score math/windows. | Settings save does not invalidate score/home/history, so score can remain stale after changes. |
| Onboarding | Seeds preferences, habits, finance/admin setup data. | No direct onboarding score is expected. Watch for duplicate bill/admin seeds because due admin items can later affect Finance/Admin scoring. |
| Login/Auth | No score operations expected. | No scoring issue found. |

## Recommended Fix Order

1. Make finalized daily score reads immutable.
   - This protects user trust and closes the largest anti-gaming hole.
   - Add tests proving finalized score does not change after late/backfilled mutations unless an explicit correction path is used.

2. Integrate the Finance ledger with scoring.
   - Decide whether `FinanceTransaction` replaces legacy `Expense` for scoring or whether writes should dual-write safely.
   - Add dedupe rules for bill payment paths that currently can create both records.

3. Fix timed backfill punctuality.
   - Require completion local date to match score date.
   - Treat backfilled records without real completion timestamps as completion credit only, not punctuality credit.

4. Align daily review and Plan/Priorities rules with product intent.
   - Resolve rescue/recovery tomorrow-prep scoring.
   - Resolve PRD drift around launch/must-win/support priorities/task weights.
   - Resolve `70+` vs `85+` strong-day streak semantics.

5. Centralize score invalidation by affected dates.
   - Add an invalidation helper that accepts one or more affected ISO dates.
   - Invalidate daily score, score history, weekly momentum, Home, health/finance/planning domains as needed.
   - Use payload dates for planning, finance, health, and review mutations rather than defaulting to today.

6. Add scoring guardrails.
   - Backend tests for every P1 and P2 scoring rule above.
   - Contract alignment between `packages/contracts` and backend responses.
   - Optional Prisma/database constraints for score range and point consistency.

## Verification Notes

This was a static audit plus targeted codebase review. No runtime dev server was started, in line with the repo instructions.

A scoped backend reviewer ran:

```bash
npm run test -w server -- test/modules/scoring/service.test.ts test/modules/reviews/service.test.ts test/jobs/registry.test.ts
```

Result: the targeted tests passed, but they do not cover the main issues found above. The biggest next verification step is adding tests that reproduce each P1 finding.
