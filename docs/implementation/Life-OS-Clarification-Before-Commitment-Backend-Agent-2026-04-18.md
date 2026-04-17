# Life OS: Clarification Before Commitment

## Backend Agent Implementation Plan

Date: April 18, 2026

## Purpose

This document is the backend implementation brief for **Enhancement 1: Clarification Before Commitment in Inbox**.

It is written for the backend agent that will complete the server-side work before the frontend agent starts UI integration.

This document focuses on:

- the product problem to solve
- the backend behavior that should exist when the work is complete
- the simplest implementation shape that supports the product goal
- the contracts and rules the frontend should be able to depend on

It intentionally avoids unnecessary complexity.

The goal is not to make Inbox smarter in a flashy way.

The goal is to make it harder for vague work to become scheduled work while keeping the overall product calm, quick, and usable every day.

---

## Product objective

Life OS should help the user distinguish between:

- something that has been captured
- something that has been clarified
- something that is ready to be committed into Today

Inbox should remain fast and low-friction.

But it should no longer behave as though scheduling a task is the same thing as preparing a task.

Backend support is needed so the application can consistently answer:

- is this inbox task ready to schedule?
- if not, why not?
- what is the minimum clarification still missing?

---

## The current codebase reality

The current backend already has strong building blocks:

- `Task` already stores `nextAction`, `fiveMinuteVersion`, `estimatedDurationMinutes`, `likelyObstacle`, and `focusLengthMinutes`
- task create and update routes already support those fields
- focus sessions already require `nextAction` to exist before a session can start
- task stuck and recovery flows already exist

Important current files:

- `server/prisma/schema.prisma`
- `server/src/modules/planning/task-routes.ts`
- `server/src/modules/planning/planning-schemas.ts`
- `packages/contracts/src/planning.ts`

This means the backend should **reuse existing task protocol fields first** instead of introducing a new subsystem.

---

## The problem the backend must solve

Right now a task can be scheduled from Inbox even if it has not been clarified into something executable.

That means the backend currently allows this sequence:

1. capture vague item
2. schedule vague item
3. discover ambiguity later on Today

That is the exact failure pattern this enhancement is meant to reduce.

The backend should become the source of truth for task commitment readiness so the frontend does not have to invent or duplicate that logic ad hoc.

---

## Backend design principles

These decisions should be treated as fixed for v1.

### 1. Reuse task protocol fields

Do not create a new protocol table or a heavy new workflow model for v1.

The existing `Task` fields already cover the most important execution-prep data.

### 2. Use deterministic rules

Do not add AI scoring or fuzzy backend behavior.

The backend should expose simple, explainable readiness rules.

### 3. Keep scheduling rules scoped to Inbox commitment

Do not redesign all task updates across the app.

This enhancement is specifically about the flow from Inbox into committed scheduled work.

### 4. Support low-friction UX

The backend should enable a smooth product flow:

- quick to understand
- quick to recover from
- no hidden validation surprises

### 5. Prefer derived state over persisted state

For v1, readiness should be computed from existing task fields where possible.

Only add persistence if it becomes clearly necessary.

---

## Recommended backend shape

## Core decision

Implement **derived commitment readiness** for inbox tasks and expose it through shared contracts and inbox-related task flows.

The system should be able to tell the frontend whether a task is:

- ready to commit
- missing required clarification
- optionally improvable but still usable

For v1, the minimum required condition should be simple:

- a task must have a non-empty `nextAction` before it can be committed from Inbox into scheduled work

Other fields should remain supportive rather than blocking:

- `fiveMinuteVersion`
- `estimatedDurationMinutes`
- `likelyObstacle`
- `focusLengthMinutes`

This keeps the product helpful without becoming bureaucratic.

---

## Locked product decisions for backend

### 1. `nextAction` is the only hard requirement in v1

That is the cleanest and most behaviorally meaningful gate.

It aligns with the rest of the app because focus sessions already rely on `nextAction`.

### 2. Other protocol fields should generate guidance, not blocks

The backend can tell the frontend these fields are recommended, but should not force them for v1.

### 3. Notes and reminders should not be treated like executable tasks

The commitment-readiness logic should focus on `kind === "task"`.

### 4. Existing generic task update behavior should remain usable

Do not break normal task editing elsewhere in the product.

Introduce inbox-specific commitment behavior without destabilizing current flows.

---

## Proposed contract additions

The backend agent should extend the shared planning contract so tasks can expose commitment-readiness metadata.

Suggested shape:

```ts
type TaskCommitmentReadiness = "ready" | "needs_clarification";

type TaskCommitmentReason =
  | "missing_next_action"
  | "missing_five_minute_version"
  | "missing_estimate"
  | "missing_obstacle"
  | "missing_focus_length";

type TaskCommitmentGuidance = {
  readiness: TaskCommitmentReadiness;
  blockingReasons: TaskCommitmentReason[];
  suggestedReasons: TaskCommitmentReason[];
  primaryMessage: string;
};
```

Then expose this on `PlanningTaskItem` / `TaskItem`.

Important v1 behavior:

- `blockingReasons` should only include `missing_next_action`
- the other missing fields should appear in `suggestedReasons`

This gives the frontend enough structure to build a calm UX without having to recreate backend logic.

---

## Recommended route behavior

The backend should introduce a dedicated **Inbox commitment mutation** instead of overloading generic update behavior with too many inbox-specific rules.

Suggested endpoint shape:

`POST /tasks/:taskId/commit`

Suggested request responsibilities:

- assign `scheduledForDate`
- optionally accept protocol fields if the user fills them during the same flow
- enforce readiness rules for task commitment

Suggested request shape:

```ts
{
  scheduledForDate: IsoDateString;
  nextAction?: string | null;
  fiveMinuteVersion?: string | null;
  estimatedDurationMinutes?: number | null;
  likelyObstacle?: string | null;
  focusLengthMinutes?: number | null;
}
```

Suggested behavior:

1. load the task
2. merge any newly provided protocol data
3. evaluate readiness
4. if readiness fails, return a structured validation error
5. if readiness passes, persist the protocol data and schedule the task
6. remove planner assignment if needed using existing logic

This keeps the product rule clear:

- generic patch is still generic editing
- commit route is the explicit bridge from Inbox into scheduled work

---

## Error behavior

When a task is not ready to commit, the backend should return a validation error that is structured enough for the frontend to react cleanly.

The frontend should not have to parse plain English to determine what happened.

Suggested error payload behavior:

- code should remain consistent with existing validation patterns
- metadata should include readiness details or at minimum the blocking reason list

This will let the frontend do useful things like:

- open a clarification panel automatically
- highlight the missing field
- show a calm inline explanation instead of a generic failure toast

---

## Scope of backend work

## In scope

- add commitment-readiness metadata to shared task contracts
- add deterministic readiness evaluation on the server
- add an inbox-commit mutation or equivalent dedicated route
- make the route reuse existing protocol fields
- make the route enforce `nextAction` as the hard readiness rule
- return structured readiness feedback on failure
- cover the new behavior with backend tests

## Out of scope

- AI-generated task clarification
- title rewriting or natural-language decomposition
- a new task-protocol database model
- hard-blocking all optional protocol fields
- redesigning all task mutations everywhere in the product
- review-system integration

---

## Recommended file ownership

The backend agent should primarily work in:

- `packages/contracts/src/planning.ts`
- `server/src/modules/planning/planning-schemas.ts`
- `server/src/modules/planning/task-routes.ts`
- any small new backend helper dedicated to commitment readiness
- backend tests under `server/test/modules/planning/`

If the logic needs a helper, prefer a bounded, domain-specific file such as:

- `server/src/modules/planning/task-commitment.ts`

Do not hide the logic in a generic helper or utility file.

---

## Recommended implementation sequence

Keep the backend work simple and ordered.

### Step 1: define the contract

Add commitment-readiness metadata to the task contract so every caller has a clear source of truth.

### Step 2: implement readiness evaluation

Create a small server-side evaluator that derives readiness from current task data.

### Step 3: expose readiness in serialized tasks

Inbox and related task queries should return the derived readiness metadata.

### Step 4: add the commitment mutation

Create the explicit route for committing an inbox task into scheduled work.

### Step 5: test the new behavior

Add route and unit coverage for:

- ready task commits successfully
- task without `nextAction` cannot commit
- optional fields show up as suggestions, not blockers
- notes and reminders are not treated like regular execution-task commitment

---

## Test expectations

At minimum, the backend agent should add or update tests for:

- task readiness derivation
- commit route success path
- commit route failure path for missing `nextAction`
- persistence of protocol fields during commit
- schedule mutation result after successful commit

Testing priority should go to behavior, not to implementation details.

---

## UX implications the backend must protect

Even though this is backend work, the backend decisions will directly shape UX.

The backend should therefore protect the following product qualities:

### 1. No surprising blockers

Only one field should hard-block commitment in v1.

That makes the rule teachable.

### 2. Fast recovery from a failed commit

If the user tries to schedule too early, the app should be able to guide them immediately, not strand them in an error state.

### 3. Support progressive disclosure

The frontend should be able to show one required thing and several optional but helpful things.

### 4. Calm language

Messages should feel operational and supportive, not judgmental.

Good tone:

- “Add the first visible step before scheduling this task.”

Avoid tone like:

- “Task is invalid”
- “You must complete all protocol fields”

---

## Definition of done

The backend work is done when:

- inbox-task responses include commitment-readiness metadata
- the server has a single deterministic readiness rule for v1
- there is a dedicated backend-supported commitment flow for Inbox scheduling
- committing a vague task fails with structured guidance
- committing a clarified task schedules successfully
- backend tests cover the new rules

At that point, the frontend agent can build against a stable and understandable contract.

---

## Final guidance for the backend agent

Keep this enhancement narrow and product-aligned.

The correct backend outcome is not “a more complex task system.”

The correct backend outcome is:

- one clear readiness rule
- one clean commitment flow
- one stable contract the frontend can trust

That is enough to materially improve task quality entering Today without slowing the product down.
