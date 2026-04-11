# Life OS: Phase 1 Behavioral Execution Implementation Plan

Date: April 11, 2026

## Purpose

This document is the implementation handoff for **Phase 1: Make daily execution real**.

It converts the product direction from the following documents into a codebase-grounded build plan:

- `docs/implementation/Life-OS-CEO-Implementation-Brief.md`
- `docs/implementation/Life-OS-Behavior-Change-Product-Strategy.md`
- `docs/implementation/Life-OS-Implementation-Roadmap.md`

It is written for the current repository structure and is intended to be detailed enough that another AI coding agent or engineer can implement the work without making major product decisions.

---

## Executive outcome

Phase 1 upgrades Life OS from a planning-and-tracking app into a more behaviorally useful execution system for the current day.

When this phase is complete, the product should reliably do the following:

- guide the user through a short daily launch on `Home` and `Today`
- force the day to have one believable **must-win**
- require the must-win to have a visible first step before the launch is considered complete
- reduce the top layer of the day to **1 must-win + up to 2 support priorities**
- let the user start a task in a structured way instead of staring at a vague task title
- give the user a one-tap recovery flow when they feel stuck
- surface deterministic guidance when the day has not been launched, the must-win has not started, or the user has already signaled resistance

This phase intentionally does **not** implement Rescue Mode, habit minimums, focus sessions, notifications, or advanced adaptation workflows. Those belong to later phases.

---

## Locked product decisions

These decisions are already made and should not be revisited during implementation.

### 1. Scope

This implementation covers the full **Phase 1** scope only:

1. Daily Launch Ritual
2. Must-Win Day
3. Start Protocol
4. "I'm Stuck" flow

### 2. Must-win model

The must-win is **task-backed**.

That means:

- the must-win is always a real `Task`
- it must be scheduled for the active day
- it carries its own execution metadata
- task completion and progress remain connected to the rest of the planning system

The must-win is **not** a standalone ritual field and **not** just a renamed priority.

### 3. Launch surface

The Daily Launch Ritual lives as an **inline card on both Home and Today**.

That means:

- no blocking modal for the default implementation
- no new top-level route
- the launch card remains visible until completed
- after completion, Home and Today pivot to a must-win-first execution view

### 4. Must-win progress

The must-win can be:

- not started
- started
- meaningfully advanced
- completed

The product must support "advanced but not completed" as a first-class state for the must-win.

### 5. Priority model

Daily priorities stay on the existing `CyclePriority` infrastructure, but day behavior changes to:

- `1` must-win task
- up to `2` support priorities

Weekly and monthly priorities do not change in this phase.

### 6. Architecture direction

This work extends existing modules and contracts. It does **not** introduce a separate behavioral subsystem or new top-level feature area.

---

## Current codebase grounding

The implementation should build directly on the current surfaces below.

### Primary frontend surfaces

- `client/src/features/home/HomePage.tsx`
- `client/src/features/home/CommandBlock.tsx`
- `client/src/features/home/TodayControl.tsx`
- `client/src/features/home/GuidanceRail.tsx`
- `client/src/features/today/TodayPage.tsx`
- `client/src/features/today/hooks/useTodayData.ts`
- `client/src/features/today/components/CommandBar.tsx`
- `client/src/features/today/components/FocusStack.tsx`
- `client/src/features/today/components/ExecutionStream.tsx`
- `client/src/features/today/components/TaskCard.tsx`
- `client/src/features/today/components/TodayTaskCaptureSheet.tsx`
- `client/src/features/inbox/InboxPage.tsx`
- `client/src/features/reviews/components/DailyReviewWorkspace.tsx`

### Primary backend surfaces

- `server/src/modules/home/routes.ts`
- `server/src/modules/home/guidance.ts`
- `server/src/modules/planning/plan-routes.ts`
- `server/src/modules/planning/task-routes.ts`
- `server/src/modules/planning/planning-schemas.ts`
- `server/src/modules/scoring/service.ts`
- `server/src/modules/reviews/review-service/daily-reviews.ts`
- `server/prisma/schema.prisma`

### Shared contracts

- `packages/contracts/src/planning.ts`
- `packages/contracts/src/home.ts`
- `packages/contracts/src/reviews.ts`

### Baseline verification completed before this handoff

The following checks were run successfully before writing this document:

- `npm run typecheck`
- `npm run test -w server -- test/modules/planning/day-planner-routes.test.ts test/modules/home-guidance.test.ts test/modules/scoring/service.test.ts test/modules/reviews/service.test.ts`

---

## Phase 1 feature specification

## 1. Daily Launch Ritual

### User job

Each day should begin with a short setup flow that forces the day into a believable execution shape before the user drifts into planning theater or reactive task switching.

### Required inputs

The launch captures:

- must-win task
- up to 2 support priorities
- energy rating from `1` to `5`
- first visible step for the must-win
- optional likely derailment reason
- optional derailment note

### Completion rule

The launch is considered complete only when:

- a same-day must-win task is selected
- that task has a non-empty `nextAction`
- the launch record has an `energyRating`

Support priorities may be empty, but the UI should encourage adding them.

### UX behavior

On `Home`:

- before launch completion, show a prominent launch card above the normal command surface
- the CTA should route into the inline launch experience on Home itself or deep-link to Today if needed
- once completed, the command surface should pivot to must-win-first messaging

On `Today`:

- before launch completion, show the launch card at the top of execute mode
- after completion, replace that space with the must-win card and support-priority context

### Selection rules

The must-win may be chosen from:

- tasks already scheduled for the day
- a new task created during launch

Out of scope for Phase 1:

- selecting directly from Inbox items without converting/scheduling first
- choosing a future task that is not yet scheduled for today

---

## 2. Must-Win Day

### User job

The day should clearly communicate one thing that matters most and reduce the feeling that everything is equally urgent.

### Behavioral rules

- there can only be one must-win per day
- the must-win is always a task
- it is visually dominant on both Home and Today
- support priorities remain visible, but subordinate
- completion is not the only success state; meaningful advance counts

### UI requirements

The must-win card should display:

- title
- goal link if present
- progress state
- next visible action
- optional 5-minute version
- estimated duration
- likely obstacle
- focus length

Primary actions on the must-win card:

- `Start`
- `Mark Progress`
- `Complete`
- `I'm Stuck`
- `Edit Start Protocol`

### Home behavior

Home should stop leading with generic "top priority" copy once a must-win exists. The headline and dominant CTA should orient around the must-win.

### Today behavior

Today execute mode should visually separate:

- must-win
- support priorities
- task stream
- recovery tray

The current "Top Priorities" treatment should be reframed as support priorities.

---

## 3. Start Protocol

### User job

A vague task should become behaviorally actionable before the user is expected to start.

### Task-level fields

Each task may store:

- `nextAction`
- `fiveMinuteVersion`
- `estimatedDurationMinutes`
- `likelyObstacle`
- `focusLengthMinutes`
- `progressState`
- `startedAt`

### Required vs optional

Required for launch completion:

- `nextAction` on the must-win

Optional but strongly encouraged:

- `fiveMinuteVersion`
- `estimatedDurationMinutes`
- `likelyObstacle`
- `focusLengthMinutes`

### Default behavior

- `focusLengthMinutes` defaults to `25` in the client
- `progressState` defaults to `not_started`
- pressing `Start` sets `progressState=started` and `startedAt` if not already set
- pressing `Mark Progress` sets `progressState=advanced` while task `status` remains `pending`
- pressing `Complete` sets task `status=completed` and preserves the progress state history

### Surface requirements

The start-protocol editor should be available from:

- the launch ritual when defining the must-win
- the must-win card after launch
- general task actions in Today
- an Inbox "Clarify" action for ambiguous tasks

The editor should reuse the existing sheet/dialog pattern already used elsewhere in the client.

---

## 4. "I'm Stuck" intervention

### User job

When resistance appears, the user should be able to turn it into a guided recovery action instead of silently avoiding the task.

### Supported reasons

Use a shared enum for the reason selector:

- `unclear`
- `too_big`
- `avoidance`
- `low_energy`
- `interrupted`
- `overloaded`

### Supported actions

The flow should guide the user toward one of these actions:

- `clarify`
- `shrink`
- `downgrade`
- `reschedule`
- `recover`

### Meaning of each action

- `clarify`: edit the next visible action or task title so the work becomes concrete
- `shrink`: define or replace the 5-minute version
- `downgrade`: mark the task as advanced enough for today or lower the ambition of the immediate step without dropping the task
- `reschedule`: move the task to another day using the existing scheduling/carry-forward mechanics
- `recover`: move the user into a small recovery action such as completing the 5-minute version or closing unrelated overload first

### Phase 1 implementation rule

The stuck flow is deterministic and rule-based.

It should:

- log the stuck event
- recommend an action immediately
- hand off to existing task mutation flows where needed

It should **not** attempt AI generation, free-form coaching, or state inference beyond explicit user input.

### Phase 1 scope boundary

This is a task-level recovery flow, not full Rescue Mode. It helps the user recover a stuck task, not shrink the entire day.

---

## Data model plan

## 1. New enums

Add Prisma enums for:

- `TaskProgressState`
  - `NOT_STARTED`
  - `STARTED`
  - `ADVANCED`
- `DailyDerailmentReason`
  - `UNCLEAR`
  - `TOO_BIG`
  - `AVOIDANCE`
  - `LOW_ENERGY`
  - `INTERRUPTED`
  - `OVERLOADED`
- `TaskStuckAction`
  - `CLARIFY`
  - `SHRINK`
  - `DOWNGRADE`
  - `RESCHEDULE`
  - `RECOVER`

Do not add a separate must-win enum. The must-win relationship belongs on the day launch record.

## 2. New model: `DailyLaunch`

Add a new day-scoped model linked `1:1` to a day `PlanningCycle`.

Suggested fields:

- `id`
- `userId`
- `planningCycleId` unique
- `mustWinTaskId`
- `energyRating`
- `likelyDerailmentReason` nullable
- `likelyDerailmentNote` nullable
- `completedAt` nullable
- `createdAt`
- `updatedAt`

Relations:

- `user -> User`
- `planningCycle -> PlanningCycle`
- `mustWinTask -> Task`

Why this model exists:

- it keeps launch state anchored to the day cycle
- it avoids overloading `PlanningCycle` with too many nullable behavior fields
- it gives a clear place for later shutdown or Rescue Mode extensions

## 3. Extend model: `Task`

Add the following nullable fields:

- `nextAction String?`
- `fiveMinuteVersion String?`
- `estimatedDurationMinutes Int?`
- `likelyObstacle String?`
- `focusLengthMinutes Int?`
- `progressState TaskProgressState @default(NOT_STARTED)`
- `startedAt DateTime?`
- `lastStuckAt DateTime?`

Why keep these on `Task`:

- they travel with the actual work object
- they are reusable outside the must-win
- they support future focus sessions and analytics

Do **not** add a `mustWin` boolean to `Task`. The same task may matter on one day and not on another, so day ownership belongs in `DailyLaunch`.

## 4. New model: `TaskStuckEvent`

Add an append-only event table for stuck interventions.

Suggested fields:

- `id`
- `userId`
- `taskId`
- `reason`
- `actionTaken`
- `note` nullable
- `targetDate` nullable
- `createdAt`

Why this model exists:

- it preserves intervention history
- it supports later reporting and adaptive review logic
- it avoids stuffing multiple stuck outcomes into the `Task` row itself

## 5. Existing models that change behavior but not structure

### `CyclePriority`

No schema change needed.

Behavior change:

- day-level update validation becomes `max 2` support priorities
- week and month keep current limits

### `PlanningCycle`

No required schema change for Phase 1 if `DailyLaunch` is added.

---

## API and contract plan

## 1. Planning contracts

Update `packages/contracts/src/planning.ts`.

### Add new shared types

- `TaskProgressState`
- `TaskStuckReason`
- `TaskStuckAction`
- `DailyLaunchItem`
- `DayLaunchResponse`
- `UpsertDayLaunchRequest`
- `TaskStuckEventItem` if response bodies need it
- `LogTaskStuckRequest`

### Extend `PlanningTaskItem`

Add:

- `nextAction`
- `fiveMinuteVersion`
- `estimatedDurationMinutes`
- `likelyObstacle`
- `focusLengthMinutes`
- `progressState`
- `startedAt`
- `lastStuckAt`

### Extend task mutation requests

Add the same optional fields to:

- `CreateTaskRequest`
- `UpdateTaskRequest`

### Extend `DayPlanResponse`

Add:

- `launch: DailyLaunchItem | null`
- `mustWinTask: PlanningTaskItem | null`

Keep:

- `priorities` as support priorities
- `tasks` as the day task list
- `goalNudges`
- `plannerBlocks`

## 2. Home contracts

Update `packages/contracts/src/home.ts` and `client/src/shared/lib/api/home.ts`.

Add to `HomeOverviewResponse`:

- `launch: DailyLaunchItem | null`
- `mustWinTask: TaskItem | null`

Update Home guidance destination handling only if needed for a better must-win deep link. Prefer reusing `today_execute`.

## 3. Review contracts

Update `packages/contracts/src/reviews.ts` only where daily review behavior depends on tomorrow priorities.

Change the meaning of tomorrow planning in the daily review flow to:

- tomorrow support priorities only
- max `2`

Do not add tomorrow must-win selection to reviews in this phase.

## 4. New backend endpoints

Add the following endpoints under the planning module.

### `GET /api/planning/days/:date/launch`

Returns:

- launch record for the day
- resolved must-win task if present
- whether the launch is complete

This may be optional if `DayPlanResponse` always includes launch data. If redundant, prefer extending `GET /planning/days/:date` and skip the standalone GET.

### `PUT /api/planning/days/:date/launch`

Upserts the launch record.

Request should support:

- `mustWinTaskId`
- `energyRating`
- `likelyDerailmentReason`
- `likelyDerailmentNote`

Server responsibilities:

- ensure the cycle exists
- ensure the must-win task belongs to the user
- ensure the must-win task is scheduled for the target day
- set `completedAt` only when completion criteria are satisfied

### `POST /api/tasks/:taskId/stuck`

Logs a stuck event.

Request:

- `reason`
- `actionTaken`
- optional `note`
- optional `targetDate`

Response:

- created event metadata or a lightweight success body

Implementation note:

This endpoint logs the intervention only. If the action requires real task mutation, the client should call existing task mutation endpoints after the stuck event is recorded.

## 5. Existing endpoint changes

### `GET /api/planning/days/:date`

Extend response to include:

- `launch`
- `mustWinTask`

### `PUT /api/planning/days/:date/priorities`

Change validation so day priorities are capped at `2`.

Week and month routes keep current limits.

### `PATCH /api/tasks/:taskId`

Support updates to:

- `nextAction`
- `fiveMinuteVersion`
- `estimatedDurationMinutes`
- `likelyObstacle`
- `focusLengthMinutes`
- `progressState`
- `startedAt`

### `POST /api/tasks`

Support creation with initial start-protocol fields so a must-win task can be created during launch.

---

## Validation rules

## Daily launch validation

- `energyRating` must be an integer from `1` to `5`
- `mustWinTaskId` must belong to the current user
- must-win task must have `scheduledForDate === targetDate`
- if `completedAt` is derived, it must only be set when the selected must-win task has a non-empty `nextAction`

## Task protocol validation

- `nextAction` max length: `300`
- `fiveMinuteVersion` max length: `300`
- `likelyObstacle` max length: `300`
- `estimatedDurationMinutes` min `1`, max `480`
- `focusLengthMinutes` min `5`, max `180`

## Day priority validation

- day priorities max `2`
- slot values become `1 | 2`

Important compatibility note:

The day-level contract must stop accepting slot `3`, but week/month priority logic should remain unchanged. The safest implementation is to create a day-specific schema rather than reusing the current generic `priorityInputSchema` unchanged.

---

## Frontend implementation plan

## 1. Home

### Files

- `client/src/features/home/HomePage.tsx`
- `client/src/features/home/CommandBlock.tsx`
- `client/src/features/home/TodayControl.tsx`
- `client/src/features/home/GuidanceRail.tsx`
- `client/src/shared/lib/api/home.ts`

### Changes

- add launch-aware data handling
- if launch incomplete, show launch card above the command block
- if launch complete and must-win exists, command block headline should center on the must-win instead of generic top-priority copy
- `TodayControl` should show support priorities only and reflect the new max of `2`
- guidance rail should surface launch/must-win rules from the backend instead of generic planning prompts

### New component recommendation

Create a focused component under home, for example:

- `client/src/features/home/DailyLaunchCard.tsx`

Responsibilities:

- show launch fields
- select/create must-win
- set energy rating
- capture derailment reason
- save launch

Keep this separate from the generic command block so the launch flow remains maintainable.

## 2. Today

### Files

- `client/src/features/today/TodayPage.tsx`
- `client/src/features/today/hooks/useTodayData.ts`
- `client/src/features/today/components/CommandBar.tsx`
- `client/src/features/today/components/FocusStack.tsx`
- `client/src/features/today/components/ExecutionStream.tsx`
- `client/src/features/today/components/TaskCard.tsx`
- `client/src/features/today/components/TodayTaskCaptureSheet.tsx`

### Changes

- load launch and must-win from day-plan data
- display launch card on Today until completed
- after completion, render a dedicated must-win card above the execution stream
- convert the current priority stack into support priorities only
- enforce a max of `2` support priorities in both copy and mutation behavior
- expose start protocol editing and stuck actions from the must-win and regular task UI

### New component recommendations

- `MustWinCard.tsx`
- `StartProtocolSheet.tsx`
- `StuckFlowSheet.tsx`

These should stay within `client/src/features/today/components/`.

## 3. Inbox

### Files

- `client/src/features/inbox/InboxPage.tsx`

### Changes

- add ambiguity detection for vague task titles
- show a `Clarify` action for matching tasks
- route that action into the shared start-protocol editor

### Phrase matching

Start simple with case-insensitive checks for:

- `work on`
- `continue`
- `improve`
- `figure out`
- `manage`

This is deliberately heuristic and deterministic for Phase 1.

## 4. Shared client API layer

### Files

- `client/src/shared/lib/api/planning.ts`
- `client/src/shared/lib/api/home.ts`

### Changes

- add typed launch queries/mutations if needed
- extend day-plan and home response typing
- extend task create/update payloads
- add stuck-event mutation hook

## 5. Reviews

### Files

- `client/src/features/reviews/components/DailyReviewWorkspace.tsx`
- `client/src/features/reviews/hooks/useReviewSubmission.ts`
- `client/src/shared/lib/api/reviews.ts`

### Changes

- update copy from "tomorrow priorities" to "tomorrow support priorities" where necessary
- reduce tomorrow support-priority cap to `2`
- do not add tomorrow must-win behavior here

---

## Backend implementation plan

## 1. Prisma schema and migration

### File

- `server/prisma/schema.prisma`

### Work

- add new enums
- add `DailyLaunch`
- add task protocol fields
- add `TaskStuckEvent`
- add relations from `User`, `PlanningCycle`, and `Task`

### Migration

Create a named migration focused on Phase 1 behavior execution. Use a descriptive timestamped name consistent with current migration history.

## 2. Planning module

### Files

- `server/src/modules/planning/plan-routes.ts`
- `server/src/modules/planning/task-routes.ts`
- `server/src/modules/planning/planning-schemas.ts`
- `server/src/modules/planning/planning-mappers.ts`
- `server/src/modules/planning/planning-record-shapes.ts`
- `server/src/modules/planning/planning-repository.ts`

### Work

- update day-plan loading to include launch and must-win task
- add launch upsert route
- add stuck-event route
- extend task serialization
- extend task update/create parsing
- add same-day must-win validation
- add day-specific support-priority validation capped at `2`

## 3. Home module

### Files

- `server/src/modules/home/routes.ts`
- `server/src/modules/home/guidance.ts`

### Work

- include launch and must-win task in home overview payload
- update deterministic recommendation logic
- keep guidance recommendations limited and high-signal

### Deterministic guidance rules for Phase 1

Implement these rules first:

- if no completed launch by `11:00` local and there are pending tasks or priorities, recommend launch
- if launch complete, must-win pending, and `progressState=NOT_STARTED` after `14:00` local, recommend starting the must-win
- if the must-win has a same-day stuck event and remains pending, recommend recovery on Today

Do not add background notifications yet. This is route-level guidance only.

## 4. Scoring module

### File

- `server/src/modules/scoring/service.ts`

### Work

Rebalance the existing `plan_and_priorities` bucket instead of adding a new score bucket.

Recommended new plan bucket distribution:

- launch completion: `4`
- must-win start/advance/complete: up to `10`
- support priority 1 complete: `8`
- support priority 2 complete: `6`
- supporting task completion contribution: `2`

Implementation rule:

- started must-win earns partial points
- advanced must-win earns more than started
- completed must-win earns full must-win points

Update tomorrow preparation logic in `review_and_reset` so it considers the day ready when tomorrow has `2` support priorities, not `3`.

Do not change score bands or unrelated buckets in this phase.

## 5. Reviews module

### Files

- `server/src/modules/reviews/review-service/daily-reviews.ts`
- `server/src/modules/reviews/routes.ts`

### Work

- update daily review seeded tomorrow priority expectations to max `2`
- keep friction and energy review behavior unchanged in Phase 1

---

## Suggested implementation order

This order is designed to reduce rework and keep the app runnable after each step.

### Step 1. Schema and contract foundation

- update Prisma schema
- generate migration
- update shared contracts
- update client API types

### Step 2. Planning backend behavior

- add task protocol fields to create/update/serialize flows
- add `DailyLaunch` load/upsert behavior
- add stuck-event route
- extend day-plan payload

### Step 3. Home and Today data plumbing

- load launch + must-win on both surfaces
- add client hooks and mutations
- keep UI temporarily simple until the new payload is stable

### Step 4. Launch + must-win UI

- build launch card
- build must-win card
- convert priorities to support priorities
- enforce support-priority max in UI

### Step 5. Start protocol + stuck flow UI

- build shared start-protocol sheet
- wire task actions
- add Inbox clarify action
- add stuck flow sheet and action wiring

### Step 6. Guidance, scoring, and review follow-through

- update Home guidance rules
- rebalance score logic
- update daily review tomorrow-support behavior

### Step 7. Final hardening

- tests
- typecheck
- regression pass on Home, Today, Inbox, Reviews

---

## Testing plan

## 1. Backend tests to add or update

### Planning

Update or add tests around:

- launch creation for a day cycle
- launch update
- must-win must belong to user
- must-win must be scheduled for the target day
- day-plan response includes `launch` and `mustWinTask`
- day priorities reject more than `2`
- task protocol fields serialize and update correctly
- stuck-event route logs expected payload

Recommended files:

- `server/test/modules/planning/day-planner-routes.test.ts`
- add a new planning task-route test file if needed

### Home guidance

Update:

- `server/test/modules/home-guidance.test.ts`

Cases:

- missed launch prompt
- unstarted must-win prompt
- stuck must-win recovery prompt

### Scoring

Update:

- `server/test/modules/scoring/service.test.ts`

Cases:

- launch contributes points
- must-win started vs advanced vs completed score differences
- tomorrow prep uses `2` support priorities

### Reviews

Update:

- `server/test/modules/reviews/service.test.ts`

Cases:

- daily review accepts max `2` tomorrow support priorities
- seeded tomorrow priorities match the new daily limit

## 2. Validation and type checks

Run:

- `npm run typecheck`
- `npm run test -w server`

At minimum during active iteration, keep these nearby tests green:

- `test/modules/planning/day-planner-routes.test.ts`
- `test/modules/home-guidance.test.ts`
- `test/modules/scoring/service.test.ts`
- `test/modules/reviews/service.test.ts`

## 3. Manual verification checklist

### Home

- launch card appears before launch completion
- must-win card appears after launch completion
- must-win CTA deep-links correctly to Today

### Today

- launch completion requires must-win + next action + energy rating
- support priorities are capped at `2`
- must-win can be started
- must-win can be marked advanced
- must-win can be completed
- stuck flow logs and routes into a concrete action

### Inbox

- ambiguous task titles show a clarify affordance
- clarify opens the shared start-protocol editor

### Reviews

- tomorrow support priorities are capped at `2`
- no unexpected regression in daily review submission

---

## Acceptance criteria

Phase 1 is done when all of the following are true:

1. A user can complete a daily launch on Home or Today without leaving the current page context.
2. The launch stores one must-win task, energy rating, and optional derailment context.
3. A launch cannot be considered complete unless the must-win has a next visible action.
4. Home and Today visually elevate the must-win above all other work.
5. Daily support priorities are limited to `2`.
6. Tasks support structured start-protocol fields through create and update flows.
7. The user can explicitly mark a task as started or advanced before completion.
8. The user can log a stuck event with a typed reason and guided action.
9. Home guidance reflects launch and must-win state using deterministic rules.
10. Daily scoring reflects launch and must-win progress.
11. Daily review tomorrow planning behavior aligns with the new `2` support-priority model.
12. `npm run typecheck` and relevant server tests pass.

---

## Risks and implementation notes

## 1. Day priority compatibility

The current contracts and UI assume `3` daily priorities. This phase intentionally changes that to `2` support priorities for day planning only.

Be careful not to accidentally break week or month planning behavior while enforcing the day-level cap.

## 2. Progress state vs task status

Do not replace `Task.status`.

Use:

- `status` for pending/completed/dropped lifecycle
- `progressState` for execution progress before completion

This avoids breaking existing completion logic, carry-forward behavior, and reporting.

## 3. Launch duplication

Do not store launch data in multiple places. The source of truth should be:

- `DailyLaunch` for launch state
- `Task` for task behavior metadata

## 4. Avoid overbuilding the stuck flow

Phase 1 needs a useful intervention flow, not a therapy engine.

Keep it:

- deterministic
- fast
- low-choice
- directly connected to an action

## 5. No phase leakage

Do not quietly add:

- Rescue Mode
- day mode switching
- habit minimums
- focus sessions
- push notifications
- AI-generated coaching

Those belong to later implementation documents.

---

## Default copy direction

Use concise, behavior-first copy. Avoid motivational fluff.

Examples:

- `Launch your day`
- `Choose the one thing that must move today`
- `What's the first visible step?`
- `What is most likely to derail this?`
- `Start with this`
- `Too vague? Clarify it`
- `Stuck? Shrink the next move`

Avoid guilt-heavy copy such as:

- `You failed to start`
- `You're behind`
- `Catch up or lose the day`

The tone should feel supportive, structured, and calm.

---

## Final build summary

Phase 1 should be implemented as a focused extension of the existing planning stack:

- new day launch record
- task-backed must-win
- task-level start protocol
- explicit stuck-event logging
- Home and Today must-win-first UI
- day support-priority cap of `2`
- deterministic guidance and score updates

If implemented correctly, this phase will materially improve Life OS without expanding the product into more domains or adding unnecessary system complexity.
