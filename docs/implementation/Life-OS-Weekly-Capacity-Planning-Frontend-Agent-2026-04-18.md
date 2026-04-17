# Life OS: Weekly Capacity Planning

## Frontend Agent Implementation Plan

Date: April 18, 2026

## Purpose

This document is the frontend implementation brief for **Enhancement 2: Weekly Capacity Planning**.

It assumes the backend work in the companion backend brief has already been completed.

This document is written for a frontend design-focused agent and emphasizes:

- a smooth weekly planning workflow
- low friction and low resistance
- high trust and clear judgment
- practical productivity UX over decorative dashboards

The goal is not to make weekly planning more elaborate.

The goal is to make it easier for the user to create a week they will actually keep using and trusting every day.

---

## Product objective

The weekly planning experience should help the user do four things quickly:

1. name the kind of week they are actually having
2. decide how much deep work is realistic
3. see whether the week already looks too full
4. adjust before overload leaks into Today

This should feel like a short weekly reset, not a management ritual.

The user should leave the flow thinking:

- `This week looks doable.`

Not:

- `I just filled out another productivity form.`

---

## Current frontend reality

The current frontend already has useful planning surfaces:

- the Goals page and Plan mode
- the weekly planning lane
- the weekly review workspace
- existing weekly priorities editing

Important current files:

- `client/src/features/goals/GoalsPage.tsx`
- `client/src/features/goals/GoalsPlanWorkspace.tsx`
- `client/src/features/goals/GoalsPlanPlanningDock.tsx`
- `client/src/features/goals/GoalsPlanTypes.ts`
- `client/src/shared/lib/api/goals.ts`
- `client/src/shared/lib/api/planning.ts`
- `client/src/features/reviews/components/PeriodicReviewWorkspace.tsx`

Important current limitation:

- the weekly planning UI mainly manages priorities
- it does not yet express weekly carrying capacity
- it does not yet give the user a clear realism judgment before the week starts

That means the user can build a neat-looking week that still collapses in practice.

---

## Frontend design principles

These should be treated as locked decisions for v1.

### 1. Keep the weekly planning flow short

The whole capacity interaction should feel finishable in about two minutes.

### 2. Put judgment near planning, not in a separate dashboard

The user should see weekly capacity where they already shape the week.

The best primary surface is the existing weekly planning area.

### 3. Prefer guidance over guilt

When the week looks overloaded, the UI should help the user reduce resistance.

It should not scold them.

### 4. Use plain language

The user should understand the result immediately.

Avoid analytics-heavy wording or abstract productivity jargon.

### 5. Keep visual hierarchy calm

This is a planning aid, not the hero feature of the page.

It should feel important, but not loud.

---

## Core UX decision

The frontend should add a compact **Weekly Capacity Card** inside the weekly planning workflow.

This card should sit above or alongside the weekly priorities area inside the existing planning dock.

The card should do three jobs:

1. let the user choose week intensity
2. let the user set a deep-work target
3. show the backend assessment in one glance

This keeps the workflow cohesive:

- define the week
- assess the week
- shape the priorities

That is the right order for a productivity app that wants consistent daily use.

---

## Recommended user flow

The weekly planning interaction should feel like this:

### Step 1. Pick the week shape

Offer three simple options:

- `Light`
- `Standard`
- `Heavy`

The labels should feel human and self-explanatory.

Optional helper copy:

- `Light` for constrained or recovery weeks
- `Standard` for a normal week
- `Heavy` for intentionally push-focused weeks

### Step 2. Set deep-work target

Offer a very lightweight input:

- stepper
- segmented options
- small +/- control

Do not make the user type freeform text unless necessary.

### Step 3. Show the weekly assessment

Show the backend status:

- healthy
- tight
- overloaded

Also show the backend `primaryMessage`.

### Step 4. Make the next move obvious

If the week is tight or overloaded, the UI should point the user toward the most useful next action:

- reduce one weekly priority
- shrink one task
- lower the deep-work target

The product should reduce friction at the point of adjustment.

---

## Locked product decisions for frontend

### 1. Do not create a separate weekly capacity page

This belongs inside the current planning workflow.

### 2. Do not require charts for v1

Simple status, counts, and one message are enough.

### 3. Do not make every overload warning blocking

The user should be informed and supported, not trapped in a wizard.

### 4. Keep the card compact

It should add clarity without pushing the planning dock into a long scroll.

### 5. Reuse existing app language and controls

This feature should feel native to Life OS, not like a pasted-in productivity widget.

---

## Recommended frontend shape

## Primary surface

Add a dedicated `WeeklyCapacityCard` or similarly named component inside the planning dock flow.

Recommended file targets:

- `client/src/features/goals/GoalsPlanPlanningDock.tsx`
- a new focused component under `client/src/features/goals/`

Suggested responsibility split:

- `GoalsPlanPlanningDock.tsx`
  - layout placement
  - loading and error states
  - connection to week data
- `WeeklyCapacityCard.tsx`
  - week mode controls
  - deep-work target input
  - assessment rendering
  - save interaction

Keep the component focused.

Do not bury week-capacity logic deep inside a giant existing file if it makes maintenance harder.

---

## Visual behavior recommendations

### Week mode control

Use a segmented control, three-button group, or pill toggle.

It should be one-tap easy on desktop and mobile.

### Deep-work target

Use a small stepper or compact numeric control.

Suggested tone:

- `Deep work blocks this week`

Not:

- `Target deep work throughput`

### Assessment area

Show:

- a small status label
- the backend message
- 2 to 4 tiny factual cues if helpful

Examples of helpful cues:

- `3 priorities`
- `9 scheduled tasks`
- `420 estimated minutes`
- `5 tasks still unsized`

Do not turn this into a dense metric panel.

### Warning tone

Use clear but calm visual cues.

Recommended behavior:

- `healthy`: neutral-positive
- `tight`: caution without alarm
- `overloaded`: clear warning, still supportive

Avoid harsh red-heavy treatment unless the surrounding design language already uses it carefully.

---

## Interaction behavior recommendations

### Loading

The weekly capacity area should load with the same week plan query used by the surrounding planning experience whenever possible.

### Saving

Prefer lightweight save behavior:

- auto-save with a subtle saved state
- or an explicit compact save button if that better matches the repo pattern

Either can work.

What matters most:

- the save action feels safe
- it does not create unnecessary modal friction

### Errors

If the save fails:

- keep the draft visible
- show a concise inline error
- avoid kicking the user out of the planning flow

### Overloaded state

When the backend says `overloaded`, the UI should do more than show a warning.

It should suggest a small action.

Good examples:

- `Drop one weekly priority before Monday starts.`
- `Lower your deep-work target by one block to make the week survivable.`

---

## Suggested workflow order on the page

The weekly planning dock should read in this order:

1. weekly capacity card
2. weekly priorities
3. linked goal context

That sequence matters.

If the user sees priorities first, they will often over-plan before thinking about bandwidth.

If the user sees capacity first, the planning posture becomes more realistic.

---

## Recommended frontend work order

### 1. Extend API client types and hooks

Update the shared API layer to consume:

- `capacityProfile`
- `capacityAssessment`
- the weekly capacity update mutation

Likely files:

- `client/src/shared/lib/api/planning.ts`
- `client/src/shared/lib/api/goals.ts`

### 2. Add the new capacity card component

Create a focused component for the weekly capacity UI.

### 3. Place it inside the weekly planning dock

Update:

- `client/src/features/goals/GoalsPlanPlanningDock.tsx`

So the card appears before the weekly priority editing controls.

### 4. Render backend assessment states

Show the status and `primaryMessage` first.

Only show supporting counts if they make the judgment easier to act on.

### 5. Add mobile polish

Make sure:

- the controls remain easy to tap
- the card does not overflow
- the message still reads well in a narrow column

### 6. Optional small weekly review touchpoint

Only if the main flow is already solid, consider a small read-only summary inside the weekly review locked state or review completion area.

This is optional for v1.

The primary experience should live in planning, not review.

---

## What the frontend should not do

Do not add these in the first pass:

- a full-screen wizard
- heavy charts
- drag-heavy interactions for capacity
- too many editable fields
- mandatory explanations for overload
- calendar-style hour allocation
- separate “capacity analytics” navigation

These would add resistance faster than they add trust.

---

## Tutorial-style implementation sequence

If you are the frontend agent, follow this order:

1. Read the backend contract first and confirm the week plan now includes `capacityProfile` and `capacityAssessment`.
2. Extend the API hooks before touching layout.
3. Build the weekly capacity card as a small isolated component.
4. Insert it into the weekly planning dock above weekly priorities.
5. Make overloaded and tight states feel helpful, not punitive.
6. Test the experience on both desktop and mobile widths.

If the UI starts expanding into a bigger planning system, simplify.

This enhancement should reduce friction, not add ceremony.

---

## UX success criteria

The frontend portion is successful when:

- the user can set weekly capacity in a minute or two
- the week’s realism is obvious at a glance
- overloaded weeks feel correctable instead of shame-inducing
- the workflow fits naturally into the current planning experience
- the user is more likely to keep returning to the app daily because the plan feels believable
