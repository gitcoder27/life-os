# Life OS: Focus Sessions v2

## Backend Agent Implementation Plan

Date: April 18, 2026

## Purpose

This document is the backend implementation brief for **Enhancement 3: Focus Sessions v2 - Execution Learning and Adaptation**.

It is written for the backend agent that will complete the server-side work before the frontend agent starts the UI changes.

This document focuses on:

- the product problem to solve
- the simplest backend shape that adds real learning value
- the contracts and routes the frontend should be able to rely on
- how to keep the experience fast, calm, and useful for daily use

It intentionally avoids turning focus sessions into a heavy analytics subsystem.

The goal is not to make focus feel more intense.

The goal is to help Life OS learn something useful from repeated focus attempts so the user gets lower-friction guidance over time.

---

## Product objective

Focus sessions should still feel lightweight to start.

But after a few sessions, the backend should be able to answer practical questions like:

- is this task usually finishing focus sessions or breaking down early?
- are planned session lengths realistic for this task?
- is `unclear` showing up often enough that the task likely needs better prep?
- what is the simplest recommendation the UI can show before the next session starts?

The product value is not in collecting more data for its own sake.

The value is in turning repeated execution outcomes into one or two helpful adjustments that reduce resistance the next time the user tries to work.

---

## The current codebase reality

The current backend already has a solid focus-session v1:

- `FocusSession` already stores `depth`, `plannedMinutes`, `startedAt`, `endedAt`, `status`, `exitReason`, `distractionNotes`, and `completionNote`
- routes already exist for:
  - getting the active session
  - starting a session
  - capturing a distraction
  - completing a session
  - aborting a session
- task start behavior already updates `progressState`
- starting a focus session already requires a non-empty `nextAction`

Important current files:

- `packages/contracts/src/focus.ts`
- `server/src/modules/focus/routes.ts`
- `server/src/modules/focus/focus-schemas.ts`
- `server/src/modules/focus/service.ts`
- `server/prisma/schema.prisma`
- `server/test/modules/focus-routes.test.ts`

This means v2 should build on top of the existing focus model instead of creating a second parallel focus system.

---

## The problem the backend must solve

Right now the backend records focus activity, but it does not expose much reusable learning.

That means the system can tell the frontend:

- a session started
- a session ended
- why it ended

But it cannot yet easily tell the frontend:

- what the recent pattern looks like
- whether the planned duration is too ambitious
- whether task ambiguity is recurring
- what suggestion should appear before the next session starts

Without that layer, every focus session is mostly a standalone event.

That is the gap this enhancement should close.

---

## Backend design principles

These should be treated as fixed decisions for v1 of Focus Sessions v2.

### 1. Keep the learning loop lightweight

Do not add a heavy analytics engine, background job, or scoring framework.

### 2. Prefer derived insights over new persistence

For this enhancement, recent focus insights should be computed from existing `FocusSession` records.

### 3. Return one clear recommendation, not a dashboard

The frontend should receive a simple, teachable suggestion.

### 4. Do not auto-edit tasks

The backend can recommend that the user shorten a session or clarify the next action, but it should not silently change task fields.

### 5. Protect fast daily use

Starting, completing, and aborting a focus session should remain quick.

Learning should come from the data already being created by normal usage.

---

## Core backend decision

Implement a small **focus learning layer** that exposes:

1. richer derived fields on completed or aborted sessions
2. a task-level focus insight summary based on recent session history

This should be enough to support a better launcher and a better post-session recap without making the system complicated.

For v1, the backend should not try to solve every adaptation question.

It only needs to surface the highest-value execution signals:

- planned minutes vs. actual minutes
- completed vs. aborted pattern
- recurring exit reason
- a single suggested adjustment for the next attempt

---

## Locked product decisions for backend

### 1. Use recent task history, not global productivity scoring

The main learning unit should be the current task.

### 2. Base recommendations on deterministic rules

Do not introduce AI-generated coaching or fuzzy scoring logic.

### 3. Only expose recommendation types the frontend can act on simply

For v1, the recommended adjustment should stay small and practical.

### 4. Do not make focus sessions harder to start

The backend should inform the UI, not add new blockers beyond the existing `nextAction` requirement.

### 5. Keep Home-level or review-level analytics out of scope for now

This phase is about improving the execution loop around starting and ending a session.

---

## Recommended contract additions

The backend agent should extend the shared focus contract.

Suggested additions:

```ts
export type FocusSessionSuggestedAdjustment =
  | "keep_current_setup"
  | "shorten_session"
  | "clarify_next_action";

export interface FocusSessionHistoryItem {
  id: EntityId;
  depth: FocusSessionDepth;
  plannedMinutes: number;
  actualMinutes: number | null;
  status: FocusSessionStatus;
  exitReason: FocusSessionExitReason | null;
  endedAt: string | null;
}

export interface FocusTaskInsight {
  taskId: EntityId;
  totalSessions: number;
  completedSessions: number;
  abortedSessions: number;
  averagePlannedMinutes: number | null;
  averageActualMinutes: number | null;
  mostCommonExitReason: FocusSessionExitReason | null;
  recommendedPlannedMinutes: number | null;
  suggestedAdjustment: FocusSessionSuggestedAdjustment;
  summaryMessage: string;
  recentSessions: FocusSessionHistoryItem[];
}

export interface FocusTaskInsightResponse extends ApiMeta {
  insight: FocusTaskInsight;
}
```

Also add `actualMinutes` to `FocusSessionItem`.

Important v1 behavior:

- `actualMinutes` should be derived from `startedAt` and `endedAt`
- `recentSessions` should be small, such as the latest 5 ended sessions for the task
- `summaryMessage` should be calm and directly usable by the frontend

---

## Recommended backend behavior

## 1. Add derived session timing

Every serialized focus session should include `actualMinutes`.

Behavior:

- if the session is still active, `actualMinutes` can be the elapsed rounded minutes or `null`
- if the session has ended, compute it from `startedAt` and `endedAt`

For v1, `null` for active sessions is acceptable and simpler.

---

## 2. Add a task insight query

Introduce a dedicated route for task-level focus learning.

Suggested endpoint:

`GET /focus/tasks/:taskId/insights`

Suggested responsibilities:

1. load the task and confirm ownership
2. load the most recent ended sessions for that task
3. compute a small insight summary
4. return one simple recommendation and the recent-session context

This keeps the frontend integration clean and avoids pushing learning logic into the client.

---

## 3. Keep recommendation rules simple

The backend should use deterministic rules over the recent task sessions.

Suggested v1 rules:

### Rule A: clarify the next action

If at least 2 of the latest 5 ended sessions were aborted with `exitReason === "unclear"`, return:

- `suggestedAdjustment: "clarify_next_action"`

### Rule B: shorten the next session

If recent ended sessions show a consistent pattern where actual minutes are materially lower than planned minutes, return:

- `suggestedAdjustment: "shorten_session"`
- `recommendedPlannedMinutes` rounded to a practical value such as the nearest 5 minutes

A good deterministic threshold is:

- at least 2 ended sessions
- average actual minutes below roughly 70% of average planned minutes

### Rule C: keep current setup

If the recent pattern is stable enough, return:

- `suggestedAdjustment: "keep_current_setup"`

This is intentionally narrow.

The system does not need more than these three recommendation types in v1.

---

## 4. Keep recommendation copy supportive

`summaryMessage` should sound like a calm product suggestion, not a diagnosis.

Good direction:

- "Recent focus sessions on this task usually end earlier than planned. Try a shorter session."
- "This task has ended as unclear a few times. Tighten the next visible action before the next session."
- "Recent sessions on this task look stable. Keep the current setup."

Avoid copy like:

- "Task failed focus prediction"
- "User underperformed"
- "Execution quality is poor"

---

## 5. Do not require a schema migration for v1 unless truly needed

This enhancement can be implemented from existing `FocusSession` fields.

That is the recommended path.

Avoid adding:

- a new analytics table
- task-level cached insight columns
- session scoring columns

Only add persistence if the current model proves clearly insufficient during implementation.

---

## Scope of backend work

## In scope

- extend focus contracts with derived session and task-insight metadata
- compute `actualMinutes`
- add a task focus insight route
- implement deterministic recommendation rules
- return small recent-session history for the task
- add backend tests for the new insight behavior

## Out of scope

- ML or AI coaching
- global focus dashboards
- review-system integration
- automatic task rewrites
- push notifications
- gamification
- a broad event-tracking platform

---

## Recommended file ownership

The backend agent should primarily work in:

- `packages/contracts/src/focus.ts`
- `packages/contracts/src/index.ts` if exports need updating
- `server/src/modules/focus/routes.ts`
- `server/src/modules/focus/service.ts`
- `server/src/modules/focus/focus-schemas.ts` if a route schema helper is useful
- backend tests under `server/test/modules/`

If the learning logic needs a dedicated helper, prefer a bounded file such as:

- `server/src/modules/focus/focus-insights.ts`

Do not hide it in a generic helper file.

---

## Recommended implementation sequence

Keep the backend work simple and ordered.

### Step 1: extend the contracts

Add `actualMinutes`, task insight types, and the task insight response contract.

### Step 2: add a focused insight helper

Create a small module that computes:

- counts
- averages
- most common exit reason
- recommended planned minutes
- suggested adjustment
- summary message

### Step 3: update session serialization

Expose `actualMinutes` on focus session responses.

### Step 4: add the task insight route

Add `GET /focus/tasks/:taskId/insights`.

### Step 5: add tests

Cover the main rule paths and the response shape.

---

## Test expectations

At minimum, the backend agent should add or update tests for:

- `actualMinutes` on ended sessions
- insight response for a task with no history
- insight response for a stable task pattern
- insight response for repeated `unclear` aborts
- insight response for repeated shortfall against planned duration
- ownership and not-found behavior for the new route

Testing priority should stay on behavior, not implementation details.

---

## UX implications the backend must protect

Even though this is backend work, the backend decisions will directly shape the product feel.

The backend should therefore protect these UX qualities:

### 1. One useful recommendation only

Do not flood the frontend with too many flags.

### 2. No new friction to start focus

Insights should guide; they should not create a new approval step.

### 3. Calm and readable messages

The UI should be able to show the summary message without rewriting it heavily.

### 4. Real adaptation, not vanity metrics

Return data that leads to a better next attempt, not just numbers for display.

---

## Definition of done

The backend work is done when:

- focus session responses include `actualMinutes`
- the server exposes task-level focus insight data
- the insight response includes one simple recommended adjustment
- recent task focus history can be shown without client-side guesswork
- the backend uses deterministic, explainable rules
- tests cover the main learning paths

At that point, the frontend agent can build a smoother focus UX on top of a stable contract.

---

## Final guidance for the backend agent

Keep this enhancement small, useful, and behaviorally sharp.

The right backend outcome is not a sophisticated analytics platform.

The right backend outcome is:

- better session data
- one lightweight insight route
- one clear suggestion the UI can act on

That is enough to make focus sessions feel more adaptive without making the product heavier to use every day.
