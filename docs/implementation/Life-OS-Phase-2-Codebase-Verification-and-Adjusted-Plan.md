# Life OS: Phase 2 Codebase Verification and Adjusted Plan

Date: April 11, 2026

## Purpose

This document verifies the current repository against the intended Phase 2 roadmap and adjusts the next implementation recommendation based on what is already in the codebase.

It exists because the strategic documents correctly describe the intended build order, but the repo has already moved beyond some of those earlier recommendations.

---

## Executive conclusion

The earlier recommendation to build `Rescue Mode` next is no longer correct for this repository.

After checking the codebase, the following are already implemented at a meaningful product level:

- Rescue Mode foundations and UI
- habit minimums and broader Habit Engine v2 data model
- goal engagement states and WIP-cap enforcement
- review friction taxonomy

The correct next move is:

1. finish the missing recovery loop that connects reviews and missed-day patterns into tomorrow's downgraded plan
2. harden and test the already-shipped continuity features
3. then move into guided execution with Focus Sessions

In short:

**Phase 2 is mostly shipped structurally, but not fully closed behaviorally.**

---

## Verified status by feature

| Area | Status | Evidence | What this means |
| --- | --- | --- | --- |
| Rescue Mode / Minimum Viable Day | Implemented baseline | `DailyLaunch.dayMode` and rescue fields exist in schema; see `server/prisma/schema.prisma`, `server/prisma/migrations/20260411110000_phase2_continuity_and_recovery/migration.sql`, `server/src/modules/planning/day-mode.ts`, `client/src/features/today/components/RescueModeCard.tsx`, `client/src/features/today/TodayPage.tsx` | This is not just a doc idea. The app can suggest Rescue Mode, activate it, reduce the day visually, and defer tasks. |
| Recovery Mode | Partial | `RECOVERY` exists in schema and suggestion builder, but missed-day detection is not wired through current callers in day/home routes | The product has the concept, but not the full automatic recovery-state behavior yet. |
| Habit Engine v2 core model | Implemented baseline | Habit schema includes `anchorText`, `minimumVersion`, `standardVersion`, `stretchVersion`, `obstaclePlan`, `repairRule`, `identityMeaning`; see `server/prisma/schema.prisma` and `packages/contracts/src/habits.ts` | The core data model is present. This is already beyond a simple habit tracker. |
| Habit minimum behavior in rescue mode | Implemented baseline | Habits page detects rescue mode and logs `minimum` check-ins in rescue mode; see `client/src/features/habits/useHabitsPageController.ts` and `client/src/features/habits/components/DailyFocusSection.tsx` | Minimum viable habit continuity is already wired into daily usage. |
| Goal WIP limits | Implemented | Goal engagement state fields exist and backend enforces max `1` primary and `2` secondary active goals; see `server/prisma/schema.prisma`, `packages/contracts/src/goals.ts`, `server/src/modules/planning/goal-routes.ts`, `client/src/features/goals/GoalFormDialog.tsx` | The structural anti-overload rule from Phase 2 is already in the product. |
| Review friction taxonomy | Implemented baseline | Review contracts and routes support typed `frictionTag`; see `packages/contracts/src/reviews.ts`, `server/src/modules/reviews/routes.ts`, `client/src/features/reviews/hooks/useReviewSubmission.ts` | Reviews already collect structured friction rather than only freeform regret. |
| Review-to-system-change workflow | Pending | No review contract or submission flow currently captures a concrete system change, tomorrow downgrade, cue, or recovery plan | Reflection exists, but adaptation is still weak. |
| Missed-day recovery detection | Pending | `buildRescueSuggestion` supports `hasMissedDayPattern`, but current route callers do not appear to pass that signal | Recovery is modeled, but not fully activated from real user patterns. |
| Weekly capacity planner | Pending | No matching planner workflow or data model was found in current planning/review surfaces | Weekly overload prevention is still missing. |
| Focus Sessions | Pending | No `FocusSession` model, contract, route, or session timer workflow was found. Current `FocusStack` is a support-priorities UI, not a focus session engine | Guided execution is still the clearest next product gap after recovery closeout. |

---

## Codebase notes behind the status call

### 1. Rescue Mode is real

This is already implemented as a product feature, not just schema groundwork.

Important evidence:

- the Phase 2 continuity migration adds `DayMode`, `RescueReason`, and habit continuity fields in `server/prisma/migrations/20260411110000_phase2_continuity_and_recovery/migration.sql`
- `DailyLaunch` now stores `dayMode`, rescue reason, and rescue timestamps in `server/prisma/schema.prisma`
- rescue suggestions are computed server-side in `server/src/modules/planning/day-mode.ts`
- the Today page renders `RescueModeCard` and hides the normal execution stream during rescue mode in `client/src/features/today/TodayPage.tsx`
- Home also surfaces the rescue card in `client/src/features/home/HomePage.tsx`

This means the original recommendation to build Rescue Mode next was outdated relative to the repo.

### 2. Recovery Mode is only partially finished

The repo contains a meaningful distinction between `rescue` and `recovery`, but the missed-day path is not fully wired.

Important evidence:

- `buildRescueSuggestion` supports `hasMissedDayPattern` in `server/src/modules/planning/day-mode.ts`
- current day-plan route calls only pass launch, must-win, pending count, and overdue count in `server/src/modules/planning/plan-routes.ts`

That means:

- overload and low-energy rescue suggestions exist
- interruption/stuck rescue suggestions exist
- automatic missed-day recovery suggestions do not look fully connected yet

### 3. Habit Engine v2 is already mostly present

The habits system is further along than the roadmap alone would suggest.

Important evidence:

- schema and contracts already support anchor, minimum, standard, stretch, obstacle plan, repair rule, and identity meaning
- the habit form exposes those fields
- habit check-ins support achieved level tracking
- rescue mode causes the daily habits flow to record a `minimum` completion path

What still seems weaker is not the data model. It is the adaptation loop around those fields:

- no strong review-driven habit downgrade/update flow
- no explicit recovery analytics like recovery-rate surfaces
- no system-generated repair suggestions after misses

### 4. Goal WIP limits are already enforced

This is one of the clearest cases where the roadmap item is already shipped.

Important evidence:

- goal schema contains `engagementState`, `weeklyProofText`, `knownObstacle`, and `parkingRule`
- the goal form exposes those fields
- backend goal mutation rules enforce:
  - only one primary active goal
  - only two secondary active goals

This means the app already contains the main anti-overload goal constraint from Phase 2.

### 5. Reviews already have friction taxonomy, but not adaptation

Daily reviews already collect structured friction.

Important evidence:

- `ReviewFrictionTag` is part of contracts
- daily review routes validate `frictionTag`
- the review submission hook posts `frictionTag`, `frictionNote`, energy, and task carry/drop/reschedule decisions

What is still missing:

- no explicit "what should the system do differently tomorrow?" field
- no persisted system-change output
- no direct review action to enter rescue/recovery tomorrow
- no direct habit minimum change or cue change generated from review output

So the repo has diagnostics, but not yet a strong adaptation engine.

### 6. Focus Sessions are still missing

The intended Phase 3 feature set does not appear to exist yet in a meaningful way.

What I checked:

- no `FocusSession` model in Prisma schema
- no focus-session contract in shared types
- no focus-session route in server modules
- no dedicated focus timer, distraction log, early exit reason, or completion reflection flow found in Today

The existing `FocusStack` component is a support-priorities editor, not a session runner.

---

## Adjusted prioritization

## Recommendation

The best next implementation target is **not** rebuilding Rescue Mode.

The best next target is:

**Finish the recovery feedback loop on top of the Phase 2 features that already exist.**

That means:

1. wire missed-day detection into real `Recovery Mode` suggestions
2. make daily review produce one concrete system change for tomorrow
3. let reviews downgrade tomorrow into rescue/recovery behavior when appropriate
4. add tests around rescue mode, habit minimums, and goal capacity rules

After that, move into **Focus Sessions** as the next major execution feature.

---

## Recommended next scope

## Phase 2 closeout: Recovery loop and adaptive downgrade

### Objective

Close the gap between:

- "the app can shrink today"
- and
- "the app learns from bad days and shrinks tomorrow intelligently"

### Why this should be next

- it finishes the part of Phase 2 that is still behaviorally incomplete
- it reuses the rescue-mode, habit, and review foundations that already exist
- it prevents us from jumping to Focus Sessions while the recovery loop is still only half-connected
- it creates a cleaner handoff into Phase 3 guided execution

### Scope

#### 1. Real missed-day recovery detection

Add deterministic server-side logic that marks when the user is in a genuine missed-day pattern and surfaces `Recovery Mode` as a real suggestion.

Suggested signals:

- no completed daily launch for prior day
- no must-win progress across one or more recent days
- overdue task count crossing a threshold
- recent daily review tagged with `overcommitment`, `low energy`, or `poor planning`

Primary surfaces:

- Home
- Today
- daily review follow-through

#### 2. Daily review -> system change

Extend daily review so it does not stop at friction logging.

Add a required or strongly-guided "system change for tomorrow" choice such as:

- reduce tomorrow to rescue mode
- keep only one support priority
- move must-win earlier
- switch a linked habit to minimum
- carry only one unfinished task
- create a recovery day instead of a normal day

This should be deterministic and rule-based first.

#### 3. Tomorrow downgrade workflow

When a daily review indicates overload, low energy, or missed-day recovery need, the app should be able to:

- prefill tomorrow's launch in a downgraded state
- suggest `rescue` or `recovery` as the next day's mode
- reduce support-priority expectations
- surface minimum-version habits first

#### 4. Tests and instrumentation for shipped continuity features

Add or strengthen tests around:

- rescue suggestion rules
- recovery suggestion rules
- day-mode transitions
- habit minimum check-ins in rescue mode
- goal WIP-cap enforcement
- review-triggered downgrade behavior

Track or confirm these events:

- `rescue_mode_suggested`
- `rescue_mode_entered`
- `recovery_mode_entered`
- `minimum_version_completed`
- `review_submitted`
- `system_change_created`

---

## Proposed implementation shape

### Backend

- extend review contracts with an explicit system-change payload
- add server logic to derive missed-day recovery state
- update day-plan and home aggregation routes to pass missed-day recovery signals into rescue/recovery suggestion building
- optionally store a lightweight next-day recovery recommendation rather than burying it only in review text

### Frontend

- extend `DailyReviewWorkspace` with a compact "change tomorrow" control
- surface post-review confirmation that tomorrow has been downgraded or adjusted
- show clearer distinction between `Rescue Mode` and `Recovery Mode`
- expose the recommended minimum viable tomorrow plan on Home and Today

### Data model

Likely enough to start with minimal additions. Avoid overbuilding.

Possible additions only if needed:

- review system-change enum
- optional review system-change note
- optional next-day recovery recommendation record

Do not add a large new subsystem unless the current `DailyLaunch` and review models prove insufficient.

---

## What should come after this

Once the recovery loop above is complete, the next major plan should be:

## Phase 3A: Focus Sessions

### Scope

- `FocusSession` entity
- start session from must-win or task card
- timer
- distraction capture
- abort reason
- completion reflection

### Why after recovery closeout

- the app already knows how to launch a day and shrink a bad day
- it still does not know how to hold attention inside a work block
- Focus Sessions are the clearest missing guided-execution feature in the current repo

---

## What not to prioritize next

Do not spend the next cycle on:

- rebuilding Rescue Mode from scratch
- redoing habit fields that already exist
- redoing goal WIP constraints that are already enforced
- adding new broad life domains
- elaborate AI coaching before the deterministic recovery loop is finished

---

## Final recommendation

Treat the current state as:

- **Phase 1 complete**
- **Phase 2 mostly implemented structurally**
- **Phase 2 still incomplete in its review-to-recovery loop**

So the next best work is:

1. close out Phase 2 by wiring review-driven recovery and missed-day detection
2. harden the continuity features with tests
3. then start Phase 3 with Focus Sessions

That is the path most consistent with both the roadmap and the actual codebase as it exists today.
