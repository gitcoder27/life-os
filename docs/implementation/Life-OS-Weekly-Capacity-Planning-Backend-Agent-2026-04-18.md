# Life OS: Weekly Capacity Planning

## Backend Agent Implementation Plan

Date: April 18, 2026

## Purpose

This document is the backend implementation brief for **Enhancement 2: Weekly Capacity Planning**.

It is written for the backend agent that will complete the server-side work before the frontend agent starts UI integration.

This document focuses on:

- the product problem to solve
- the smallest backend shape that makes weekly capacity real
- the contracts and rules the frontend should be able to depend on
- a simple implementation order that avoids unnecessary complexity

The goal is not to turn Life OS into a calendar optimizer or a time-tracking app.

The goal is to help the system make a clearer judgment about whether a planned week is believable before overload spreads into every day.

---

## Product objective

Life OS should help the user answer a few practical weekly questions:

- is this week light, normal, or heavy?
- how much deep work is realistic?
- does the current weekly plan fit that bandwidth?
- is the week already trending toward rescue mode before it even starts?

The backend should provide a simple source of truth for that judgment.

The frontend should not have to invent weekly realism rules on its own.

---

## Current codebase reality

The current backend already has useful foundations:

- weekly planning cycles already exist
- weekly priorities already exist
- weekly review already computes meaningful behavioral summary data
- daily rescue and recovery logic already exists
- task protocol fields already store effort clues such as `estimatedDurationMinutes`

Important current files:

- `server/prisma/schema.prisma`
- `server/src/modules/planning/plan-routes.ts`
- `server/src/modules/planning/planning-schemas.ts`
- `server/src/modules/planning/planning-repository.ts`
- `server/src/modules/reviews/review-service/weekly-reviews.ts`
- `packages/contracts/src/planning.ts`

Important current limitation:

- `GET /planning/weeks/:startDate` currently returns only weekly priorities
- the system does not yet store a week-level capacity profile
- the system does not yet return a weekly overload assessment

That means the product can capture priorities, but it still cannot clearly say whether the week is realistically shaped.

---

## The problem the backend must solve

Right now the app can support:

- weekly priorities
- monthly focus
- daily rescue
- review-based learning

But it still does not make a strong week-level judgment.

That creates a predictable pattern:

1. the user picks ambitious weekly priorities
2. extra supporting work quietly accumulates
3. the week becomes overloaded
4. rescue logic activates later
5. the app learns after the damage instead of before it

The backend should make week-level realism visible early enough to matter.

---

## Backend design principles

These should be treated as fixed for v1.

### 1. Keep the data model small

Do not introduce a large new planning subsystem.

For v1, a weekly capacity profile should be just a few fields on the weekly planning cycle plus a derived assessment.

### 2. Prefer explainable heuristics

Do not add AI scoring or opaque formulas.

The frontend and user should be able to understand why the system thinks a week is healthy, tight, or overloaded.

### 3. Support guidance before enforcement

For v1, the backend should warn more than it blocks.

The system should surface overload risk clearly without making weekly planning feel bureaucratic.

### 4. Reuse existing product signals first

Use existing weekly priorities, scheduled tasks, task estimates, and linked goals before introducing new concepts.

### 5. Optimize for low-resistance weekly setup

The backend should support a weekly planning flow that can be completed in a couple of minutes.

That means:

- few required inputs
- predictable defaults
- clear derived output

---

## Core backend decision

Implement **weekly capacity planning** as:

1. a small persisted weekly capacity profile
2. a derived weekly capacity assessment
3. lightweight guidance returned with the normal week plan response

For v1, the profile should be intentionally simple.

Recommended profile:

- `capacityMode`: `light | standard | heavy`
- `deepWorkBlockTarget`: integer or `null`

This is enough to support a real weekly judgment without creating a planning ceremony.

---

## Locked product decisions for backend

### 1. `capacityMode` is required in v1

Default it to `standard` when missing so older weeks still load cleanly.

### 2. `deepWorkBlockTarget` is optional but strongly recommended

This helps the week feel concrete without requiring the user to estimate every hour.

### 3. Weekly priorities remain limited to three

Do not expand weekly priority count in this enhancement.

Capacity planning should improve realism, not create more slots.

### 4. Capacity assessment is advisory, not blocking

For v1, the backend should not reject a week plan just because it looks overloaded.

It should return warnings and status clearly so the frontend can guide the user.

### 5. Use week-scoped data only

Assess the current week using:

- the selected weekly profile
- the week priorities
- pending tasks scheduled inside that week
- linked goals inside that week

Do not build cross-month forecasting in v1.

---

## Recommended contract additions

The backend agent should extend the shared planning contract with a simple capacity model.

Suggested shape:

```ts
type WeeklyCapacityMode = "light" | "standard" | "heavy";

type WeeklyCapacitySignal =
  | "too_many_priorities"
  | "too_many_estimated_minutes"
  | "too_many_unsized_tasks"
  | "too_many_focus_goals"
  | "deep_work_target_too_high";

type WeeklyCapacityProfile = {
  capacityMode: WeeklyCapacityMode;
  deepWorkBlockTarget: number | null;
};

type WeeklyCapacityAssessmentStatus = "healthy" | "tight" | "overloaded";

type WeeklyCapacityAssessment = {
  status: WeeklyCapacityAssessmentStatus;
  plannedPriorityCount: number;
  scheduledTaskCount: number;
  estimatedMinutesTotal: number;
  unsizedTaskCount: number;
  focusGoalCount: number;
  primaryMessage: string;
  signals: WeeklyCapacitySignal[];
};
```

Then add these to `WeekPlanResponse`.

Suggested result shape:

```ts
type WeekPlanResponse = {
  startDate: IsoDateString;
  endDate: IsoDateString;
  priorities: PlanningPriorityItem[];
  capacityProfile: WeeklyCapacityProfile;
  capacityAssessment: WeeklyCapacityAssessment;
};
```

Suggested mutation contract:

```ts
type UpdateWeekCapacityRequest = {
  capacityMode: WeeklyCapacityMode;
  deepWorkBlockTarget?: number | null;
};

type WeekCapacityMutationResponse = {
  capacityProfile: WeeklyCapacityProfile;
  capacityAssessment: WeeklyCapacityAssessment;
};
```

---

## Recommended persistence shape

The simplest v1 option is to add nullable weekly-capacity fields onto `PlanningCycle`.

Recommended additions to `server/prisma/schema.prisma`:

- enum `WeeklyCapacityMode`
- `weeklyCapacityMode WeeklyCapacityMode?`
- `weeklyDeepWorkBlockTarget Int?`

Why this is the right tradeoff for v1:

- no new table
- one migration
- fields live on the same weekly cycle already used for priorities and reviews
- the model stays easy to query and serialize

When loading a weekly cycle:

- if `weeklyCapacityMode` is `null`, treat it as `standard`
- allow `weeklyDeepWorkBlockTarget` to remain `null`

---

## How the assessment should work

The assessment should be derived, deterministic, and easy to explain.

Recommended week inputs:

- weekly priorities count
- pending tasks scheduled between week start and week end
- sum of `estimatedDurationMinutes` for those tasks where present
- count of scheduled tasks missing `estimatedDurationMinutes`
- number of unique linked goals across weekly priorities and scheduled tasks
- the chosen `capacityMode`
- the chosen `deepWorkBlockTarget`

Recommended v1 behavior:

### `healthy`

Use when the week looks believable for the selected mode.

### `tight`

Use when the plan might still work, but warning signs are already visible.

### `overloaded`

Use when the current load obviously conflicts with the selected mode.

The exact thresholds can stay simple and explicit.

Example heuristic shape:

- `light`
  - more than 2 priorities is a warning
  - high estimated minutes is a warning
  - too many unsized tasks is a warning
- `standard`
  - 3 priorities is acceptable
  - moderate weekly task load is acceptable
- `heavy`
  - allow more load, but still warn if too much work is unsized or spread across too many goals

Do not over-optimize the thresholds in v1.

The important thing is that the messages feel honest and stable.

---

## Recommended route behavior

Keep the current weekly priorities route and add a dedicated weekly capacity mutation.

Suggested route:

`PUT /planning/weeks/:startDate/capacity`

Suggested backend behavior:

1. ensure the weekly planning cycle exists
2. validate payload
3. save `weeklyCapacityMode` and `weeklyDeepWorkBlockTarget`
4. recompute the weekly capacity assessment
5. return the updated profile and assessment

Also update:

- `GET /planning/weeks/:startDate`

So the week plan response always includes:

- priorities
- capacity profile
- capacity assessment

This keeps the frontend flow simple:

- load one week model
- update capacity when needed
- re-render based on authoritative backend guidance

---

## Message behavior

The assessment should return a `primaryMessage` that the frontend can display directly.

The tone should be:

- calm
- practical
- non-shaming

Good examples:

- `This week looks realistic for a standard load.`
- `This week is getting tight. One fewer priority or a smaller deep-work target would make it easier to trust.`
- `This week looks overloaded for a light week. Reduce commitments before rescue mode becomes likely.`

Avoid:

- guilt-heavy wording
- vague generic warnings
- motivational fluff without clear meaning

---

## Recommended backend work order

### 1. Extend Prisma and contracts

Update:

- `server/prisma/schema.prisma`
- `packages/contracts/src/planning.ts`

Then add the migration.

### 2. Add validation schemas

Update:

- `server/src/modules/planning/planning-schemas.ts`

Add:

- `weeklyCapacityModeSchema`
- `updateWeekCapacitySchema`

### 3. Add serializer and assessment logic

Preferred location:

- `server/src/modules/planning/planning-repository.ts`

or a small adjacent planning-domain file if that keeps the code cleaner.

This logic should:

- read the weekly cycle
- compute counts and totals
- build `capacityProfile`
- build `capacityAssessment`

### 4. Extend weekly routes

Update:

- `server/src/modules/planning/plan-routes.ts`

Add:

- updated `GET /planning/weeks/:startDate`
- new `PUT /planning/weeks/:startDate/capacity`

### 5. Add tests

At minimum cover:

- default capacity profile when old data has no saved fields
- healthy week result
- tight week result
- overloaded week result
- mutation persistence
- contract serialization

---

## What the frontend should be able to rely on

When backend work is complete, the frontend agent should be able to rely on the following:

- every week plan response includes `capacityProfile`
- every week plan response includes `capacityAssessment`
- the assessment already contains user-safe messaging
- the assessment logic is backend-owned and consistent
- updating the weekly profile does not require the frontend to recompute overload logic

That separation matters because it keeps product judgment in one place.

---

## Tutorial-style implementation sequence

If you are the backend agent, follow this order:

1. Extend the weekly planning contract and Prisma schema.
2. Add the smallest possible persistence fields to `PlanningCycle`.
3. Implement a pure assessment function that converts week data into `healthy`, `tight`, or `overloaded`.
4. Wire that function into the week plan read path.
5. Add the dedicated week capacity update route.
6. Add tests before handing off to the frontend agent.

If anything starts feeling bigger than this, pause and simplify.

This enhancement should make the week more believable, not make the architecture more impressive.

---

## Out of scope for v1

Do not add these in the first pass:

- automatic weekly rescheduling
- per-hour calendar planning
- AI-generated weekly plans
- personalized predictive scoring
- cross-week forecasting
- a separate weekly capacity history screen
- blocking save rules for every overload warning

These may become useful later, but they would add friction too early.

---

## Success criteria

The backend portion is successful when:

- the week plan has a real capacity profile
- the week plan returns a clear overload assessment
- the assessment is simple enough for the frontend to explain in one glance
- the rules are deterministic and easy to trust
- the implementation stays small enough that the frontend agent can build on it immediately
