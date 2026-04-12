# Life OS: Next 2 Milestones Implementation Plan

Date: April 13, 2026

## Purpose

This document is the implementation handoff for the **next 2 highest-leverage milestones** that are still worth building after the recent execution, recovery, settings-reset, and onboarding work.

It is grounded in:

- `docs/implementation/Life-OS-Behavior-Change-Product-Strategy.md`
- `docs/implementation/Life-OS-Implementation-Roadmap.md`
- the current repository state as of April 13, 2026

This plan intentionally does **not** attempt to carry forward every idea in the strategy docs. It selects the next two milestones that still appear meaningfully missing in the codebase and that should materially improve real-world follow-through for the current user profile.

---

## Why these 2 milestones

Life OS already now has meaningful coverage for:

- daily launch
- must-win
- start protocol fields
- stuck flow
- rescue/recovery mode
- habit minimum/standard/stretch and repair-rule structure
- goal WIP limits
- lighter onboarding

That means the next phase should **not** revisit planning breadth or more domain surface area.

The two most valuable remaining gaps are:

1. **Guided execution once a task is chosen**
2. **Task clarification before vague work becomes today’s burden**

In other words:

- the app now does a much better job of deciding what matters
- it still needs to do a better job of helping the user **stay with the work**
- and it still needs to do a better job of stopping vague “guilt object” tasks from flowing into execution unchanged

---

## Executive outcome

When both milestones are complete, Life OS should be able to do the following reliably:

- let the user start a focused work session from a must-win or active task
- keep one active execution session visible and recoverable during the day
- record whether a focus attempt completed, was interrupted, or was abandoned
- capture lightweight distraction and exit reasons without turning execution into journaling theater
- detect vague or avoidance-friendly task titles in Inbox
- make task clarification easy and structured during triage
- strongly discourage ambiguous tasks from being pushed into Today without a visible next action

This phase should move Life OS from:

> “I picked the right task”

closer to:

> “I started, stayed with it, and didn’t let vague work poison the day.”

---

## Locked decisions

These decisions should be treated as fixed for this phase.

### 1. The milestones

This document covers exactly these two milestones:

1. **Milestone A: Guided Execution Mode**
2. **Milestone B: Clarification Before Commitment**

### 2. What is explicitly not included

The following are intentionally left for the phase after this one:

- weekly capacity planner
- review-to-system-change workflow
- formal behavior experiments
- generalized app-wide behavior-state engine
- social/accountability features
- elaborate deep-work orchestration or break-logging systems

### 3. Product philosophy

Both milestones must stay aligned with the product’s current direction:

- low friction over theatrical productivity
- deterministic logic before “smart” coaching
- one clear action over more dashboards
- helpful structure over heavy-handed enforcement

### 4. Domain constraint

These milestones should primarily improve:

- `Today`
- `Home`
- `Inbox`

They should not create a large new top-level feature area for the user to manage separately.

---

## Current codebase grounding

### Existing strengths this plan should build on

- `DailyLaunch` and must-win behavior already exist
- task protocol fields already exist:
  - `nextAction`
  - `fiveMinuteVersion`
  - `estimatedDurationMinutes`
  - `likelyObstacle`
  - `focusLengthMinutes`
  - `progressState`
  - `startedAt`
- stuck logging and rescue/recovery suggestions already exist

### Primary frontend surfaces

- `client/src/features/home/HomePage.tsx`
- `client/src/features/home/CommandBlock.tsx`
- `client/src/features/today/TodayPage.tsx`
- `client/src/features/today/components/MustWinCard.tsx`
- `client/src/features/today/components/ExecutionStream.tsx`
- `client/src/features/today/components/TaskCard.tsx`
- `client/src/features/today/components/StuckFlowSheet.tsx`
- `client/src/features/inbox/InboxPage.tsx`
- `client/src/features/inbox/InboxInspector.tsx`
- `client/src/features/inbox/InboxQueueItem.tsx`

### Primary backend surfaces

- `server/prisma/schema.prisma`
- `server/src/modules/planning/task-routes.ts`
- `server/src/modules/planning/plan-routes.ts`
- `server/src/modules/home/routes.ts`
- `server/src/modules/home/guidance.ts`
- `server/src/modules/index.ts`

### Shared contracts

- `packages/contracts/src/planning.ts`
- `packages/contracts/src/home.ts`
- `client/src/shared/lib/api/planning.ts`
- `client/src/shared/lib/api/home.ts`

---

## Milestone A: Guided Execution Mode

### Objective

Turn “I chose the must-win” into “I actually worked on it in a protected window.”

### User job

Once a task is chosen, the product should help the user:

- start quickly
- stay oriented to one task
- avoid silent drift
- close or abort the work session intentionally

### Required outcome

Life OS should support **one active focus session per user at a time**.

The focus session should be lightweight and execution-oriented, not a second planner.

### Feature scope

#### 1. Focus session start

Start a session from:

- must-win card
- execution stream task row
- task cards where start protocol data already exists

Each start flow should use:

- task title
- next action
- planned focus length
- optional depth tag: `deep` or `shallow`

If the task already has `focusLengthMinutes`, use it as the default.

#### 2. Active session surface

While a session is active:

- show an active-session panel at the top of `Today`
- show a lighter status strip or banner on `Home`
- keep the task title and next action visible
- show elapsed time and planned duration
- allow three actions:
  - capture distraction
  - complete session
  - end early

#### 3. Completion flow

When the session completes:

- let the user mark the task as:
  - still started
  - meaningfully advanced
  - fully completed
- allow a short completion note
- persist final duration and completion status

#### 4. Early-exit flow

If the user ends early:

- require one exit reason from a small deterministic list
- allow an optional note
- keep the task in progress unless the user explicitly changes it

Recommended exit reasons:

- interrupted
- low_energy
- unclear
- switched_context
- done_enough

#### 5. Distraction capture

Provide a very lightweight distraction capture input during the active session.

For v1:

- a single running text list or notes field is enough
- no separate distraction entity is required

### Locked product decisions

#### 1. No cinematic timer mode

Do not build:

- pomodoro theater
- fullscreen lock modes
- notification-heavy timer gimmicks
- separate break logs

This milestone is about guided execution, not ritualized productivity aesthetics.

#### 2. One active session only

There must be at most one active focus session per user.

Starting a new one while another is active should:

- either be blocked with a clear message
- or require explicit termination of the current one first

Do not silently replace active sessions.

#### 3. Session is task-backed

Every focus session must point to a real task.

No freeform standalone focus blocks in this milestone.

#### 4. Home is secondary, Today is primary

The detailed session controls belong on `Today`.

`Home` should only surface:

- active-session state
- current task
- quick resume CTA

### Suggested schema additions

Add a `FocusSession` model.

Recommended fields:

- `id`
- `userId`
- `taskId`
- `depth` (`DEEP` | `SHALLOW`)
- `plannedMinutes`
- `startedAt`
- `endedAt`
- `status` (`ACTIVE` | `COMPLETED` | `ABORTED`)
- `exitReason` nullable
- `distractionNotes` nullable
- `completionNote` nullable
- `createdAt`
- `updatedAt`

Recommended indexes:

- `[userId, status, startedAt]`
- `[taskId, startedAt]`

### Suggested contracts and API

Create a small shared `focus` contract surface rather than overloading planning responses.

Recommended endpoints:

- `GET /api/focus/active`
- `POST /api/focus/sessions`
- `POST /api/focus/sessions/:sessionId/complete`
- `POST /api/focus/sessions/:sessionId/abort`

Do not add a general history API yet unless it becomes necessary for the UI.

### Frontend implementation shape

Recommended additions:

- `client/src/features/today/components/FocusSessionPanel.tsx`
- `client/src/features/today/components/FocusSessionLauncher.tsx`
- `client/src/features/home/FocusSessionBanner.tsx`

Recommended integration points:

- `MustWinCard` gets a `Start focus` CTA
- `ExecutionStream` gets a session CTA for started/ready tasks
- `TodayPage` owns active-session query + panel placement
- `HomePage` shows read-only current session state

### Backend implementation shape

Recommended new module:

- `server/src/modules/focus/`

That module should own:

- routes
- service logic
- session lifecycle validation

Do not bury focus-session lifecycle inside task routes.

### Testing requirements

Server:

- can create a focus session for a valid task
- rejects starting a second active session
- completes a session and persists final status
- aborts a session with exit reason
- rejects completion/abort for sessions owned by another user

Frontend:

- active session appears without refresh after start
- completing a session updates the task surface immediately
- ending early returns the user to the task surface cleanly
- Home reflects active session state while Today is open elsewhere

### Success signals

- focus sessions started per week
- session completion rate
- percentage of must-win tasks that get at least one focus session
- reduction in “selected but never advanced” must-win days

---

## Milestone B: Clarification Before Commitment

### Objective

Stop vague tasks from flowing out of Inbox and into Today without becoming executable.

### User job

When a task is unclear, the product should help the user:

- notice that it is vague
- clarify the first visible step quickly
- decide whether it deserves today, later, or deletion

### Required outcome

Inbox should stop behaving like passive storage for ambiguous work.

At minimum, the product should make ambiguous tasks visibly different and easier to clarify than to blindly promote.

### Feature scope

#### 1. Ambiguity detection

Add a deterministic ambiguity detector for task titles with no `nextAction`.

Initial heuristic should flag titles that begin with or strongly resemble phrases like:

- work on
- continue
- improve
- manage
- figure out
- deal with
- plan
- organize
- fix
- handle

The detector should be conservative and deterministic.

No AI rewriting in this milestone.

#### 2. Clarity state

Add a derived clarity state on task responses:

- `clear`
- `needs_clarification`

Recommended rule:

- if `nextAction` exists and is non-empty -> `clear`
- otherwise, if the title matches ambiguity heuristics -> `needs_clarification`
- otherwise -> `clear`

#### 3. Inbox UI treatment

In Inbox:

- show a visible badge or warning treatment for `needs_clarification`
- add a “Clarify” CTA in the inspector
- surface protocol fields directly in the inspector:
  - next action
  - optional 5-minute version
  - optional likely obstacle

The point is to clarify in place during triage, not force the user into another page.

#### 4. Today-promotion gate

When a user tries to:

- send an ambiguous task to Today
- bulk-schedule ambiguous Inbox items to Today

the UI should intervene first with a clarification step.

For v1:

- this gate can be frontend-driven
- the backend does not need to hard-reject all ambiguous schedules globally

That keeps the rollout safer and avoids breaking unrelated task flows.

#### 5. Must-win readiness alignment

Keep the must-win rule aligned with the existing launch behavior:

- must-win requires a visible next action

This milestone should make that same principle visible earlier in triage, not only during launch.

### Locked product decisions

#### 1. This is not a mandatory rewrite engine

The app should not auto-rewrite titles.

It should:

- detect
- prompt
- guide

The user still owns the final wording.

#### 2. Clarification belongs in Inbox first

Primary surface is Inbox triage.

Secondary follow-on improvements can later extend to:

- Today task capture
- generic task edit forms

But those are not required for this milestone.

#### 3. Use existing task protocol fields

Do not create separate “clarification-only” fields.

Use the task’s existing execution protocol fields:

- `nextAction`
- `fiveMinuteVersion`
- `likelyObstacle`

### Suggested contracts and API

Extend `TaskItem` and related task serializers with:

- `clarityState: "clear" | "needs_clarification"`

If useful for copy, optionally include:

- `clarityReason: "missing_next_action" | "vague_title" | null`

Do not add a large new task-readiness model in this milestone.

### Suggested backend implementation shape

Add a small shared helper such as:

- `server/src/lib/tasks/clarity.ts`

It should expose deterministic utilities used by:

- planning task serializers
- Inbox responses
- Home guidance if needed later

Keep heuristics centralized so they do not drift between client and server.

### Suggested frontend implementation shape

Recommended changes:

- `InboxQueueItem` gains ambiguity badge treatment
- `InboxInspector` gains clarification inputs using existing task protocol fields
- bulk bar prevents blind “Do today” when selected items need clarification
- feedback copy should explain the issue in behavioral language:
  - “This task needs a visible first step before it belongs in Today.”

### Testing requirements

Server:

- ambiguous title without next action serializes as `needs_clarification`
- clear title with next action serializes as `clear`
- task responses stay backward-compatible otherwise

Frontend:

- Inbox shows the clarification badge for flagged tasks
- clarifying a task updates the badge state without refresh
- trying to send an ambiguous task to Today opens the clarification path first
- bulk Do Today handles mixed clear + unclear selections correctly

### Success signals

- percentage of Inbox tasks with `nextAction`
- percentage of must-win tasks arriving from already-clear inputs
- reduction in stuck events caused by `unclear`
- reduction in vague tasks moved from Inbox directly to Today

---

## Delivery sequence

Implement in this order:

### Step 1

Milestone B foundation:

- shared clarity heuristics
- task response contract extension
- Inbox badges

This gives immediate value and improves the quality of tasks entering execution.

### Step 2

Milestone B interaction layer:

- clarification inputs in Inbox inspector
- Today-promotion gate for ambiguous tasks

### Step 3

Milestone A backend:

- `FocusSession` model
- focus routes and lifecycle rules

### Step 4

Milestone A frontend:

- focus launcher
- active-session panel on Today
- active-session banner on Home

This order preserves a clean pipeline:

> clearer tasks first, guided execution second

Even though Guided Execution is the larger milestone, Clarification Before Commitment should begin first because it improves the quality of the work being fed into the focus workflow.

---

## Explicit out-of-scope follow-up

After these two milestones are complete, the next implementation document should likely cover:

- review-to-system-change workflow
- weekly capacity planner
- behavior experiments
- generalized state engine and state-aware nudges

Those are still good ideas from the strategy docs, but they should sit on top of:

- clearer task inputs
- stronger guided execution

not the other way around.
