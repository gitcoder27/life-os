# Life OS: Clarification Before Commitment

## Frontend Agent Implementation Plan

Date: April 18, 2026

## Purpose

This document is the frontend implementation brief for **Enhancement 1: Clarification Before Commitment in Inbox**.

It assumes the backend work in the companion backend brief has already been completed.

This document is written for a frontend design-focused agent and emphasizes:

- a smooth daily workflow
- low resistance
- clean product hierarchy
- practical productivity UX instead of decorative complexity

The goal is not to turn Inbox into a form-heavy setup screen.

The goal is to make clarification feel like a natural part of triage.

---

## Product objective

Inbox should continue to feel:

- fast
- calm
- easy to scan
- easy to act on

But it should no longer make it effortless to schedule unclear work.

The frontend should help the user move through a simple mental sequence:

1. capture
2. inspect
3. clarify the first visible step
4. commit into Today

The user should feel guided, not managed.

---

## Current frontend reality

The current Inbox experience already provides:

- queue scanning
- quick actions from the list
- an inspector with title, notes, schedule, and goal linking
- bulk actions

Important current files:

- `client/src/features/inbox/InboxPage.tsx`
- `client/src/features/inbox/InboxInspector.tsx`
- `client/src/features/inbox/InboxQueueItem.tsx`
- `client/src/features/today/components/StartProtocolSheet.tsx`
- `client/src/shared/lib/api/planning.ts`

The current product problem is that Inbox supports scheduling more strongly than it supports clarification.

That means the user can still promote a task into Today before the task feels startable.

---

## Frontend design principles

These should be treated as locked decisions for v1.

### 1. Keep Inbox fast

Do not turn every inbox action into a multi-step wizard.

The user should still be able to move quickly.

### 2. Use progressive disclosure

Show only what matters most at first.

The most important missing thing is the `nextAction`.

Other helpful protocol fields should appear as supportive guidance, not as visual clutter.

### 3. Clarification should feel lighter than planning

This is not a full planning workflow.

It is a short pre-commitment check.

### 4. Preserve the current calm tone

The UI should feel like:

- “make this easier to start”

not:

- “complete this required compliance form”

### 5. Reuse existing visual language

This enhancement should fit the current app rather than introducing a whole new design system just for Inbox.

Reuse established controls, sheets, buttons, and spacing patterns where possible.

---

## Core UX decision

The frontend should introduce a lightweight **clarify-before-schedule flow** inside Inbox.

The user experience should work like this:

### For a ready task

If the task already has a valid `nextAction`, the user can:

- do today
- schedule

without extra interruption.

### For a task that needs clarification

If the task is not ready, the UI should:

- explain what is missing
- guide the user into a compact clarification step
- let them save and immediately commit the task

This should feel like a natural continuation of triage, not a failure state.

---

## Recommended frontend behavior

## 1. Show readiness clearly in Inbox

Inbox items should surface whether they are ready to commit.

This does not need to be loud or visually heavy.

It just needs to be easy to understand.

Recommended approach:

- show a small readiness cue in the inspector
- optionally add a subtle row-level signal in the queue for tasks that need clarification

The main signal should live in the inspector, because that is where the user already edits the item.

---

## 2. Change the primary inspector workflow

The inspector should stop behaving like:

- title
- notes
- schedule
- goal

and start behaving more like:

- what is this item
- is it ready to commit
- if not, what is the missing first step
- then schedule it

That means the readiness message should sit above scheduling controls, not below them.

The user should understand the state before they try to schedule.

---

## 3. Add a compact clarification section

When a task needs clarification, the inspector should reveal a compact protocol editor.

This should be visibly lighter than the Today start-protocol sheet.

Recommended field order:

1. `Next visible action` as the required field
2. `5-minute version` as optional support
3. `Estimated minutes` as optional support
4. `Likely obstacle` as optional support
5. `Focus length` as optional support

The key requirement is that the first field is easy to reach and easy to save.

---

## 4. Keep “Do today” and “Schedule” smooth

The user should not feel punished for moving quickly.

Recommended behavior:

- if the task is ready, “Do today” and “Schedule” should work immediately
- if the task is not ready, those actions should route the user into clarification instead of silently failing

The product should feel helpful in that moment:

- “Add the first visible step, then I’ll schedule it.”

That is a much better experience than:

- click
- error toast
- no clear next action

---

## 5. Reuse the Start Protocol mental model without copying it blindly

The existing `StartProtocolSheet` is useful because it already expresses the right task-prep fields.

But Inbox should not simply clone that entire flow.

Inbox needs a lighter version.

Recommended reuse:

- reuse field names
- reuse validation expectations
- reuse tone
- reuse as much form logic as is practical

Avoid:

- a heavy fullscreen planning feeling
- too much copy
- forcing every optional field into the first interaction

---

## Locked product decisions for frontend

### 1. One required field only in v1

`nextAction` should be the only required clarification field.

### 2. Keep the inspector as the main clarification surface

Do not introduce a large new top-level page or route for this feature.

### 3. Optional protocol fields should be visible but secondary

They should improve task quality without creating visual resistance.

### 4. Keep list scanning clean

Do not overload the inbox row with chips, badges, and protocol details.

The queue should remain readable at speed.

### 5. Respect existing productivity tone

This is a productivity application.

The interface should optimize for:

- quick orientation
- low cognitive load
- fast recovery
- clear action

It should not feel ornamental or theatrical.

---

## Scope of frontend work

## In scope

- consume backend commitment-readiness metadata in Inbox
- adjust queue and inspector behavior around readiness
- add a compact clarification UI inside the inspector
- route “Do today” and “Schedule” through the backend commitment flow
- handle readiness failures gracefully
- keep the interaction calm and low-friction

## Out of scope

- redesigning the whole Inbox page
- adding AI-generated next actions
- adding drag-and-drop triage complexity
- rebuilding Today start protocol
- redesigning Home or Today surfaces as part of this task

---

## Recommended file ownership

The frontend agent should primarily work in:

- `client/src/features/inbox/InboxPage.tsx`
- `client/src/features/inbox/InboxInspector.tsx`
- `client/src/features/inbox/InboxQueueItem.tsx`
- `client/src/shared/lib/api/planning.ts`

If a dedicated inspector subcomponent is needed, prefer something focused and domain-specific such as:

- `client/src/features/inbox/InboxClarificationPanel.tsx`

If protocol form reuse becomes helpful, keep the reused logic intentionally narrow.

Avoid generic shared abstractions unless they clearly reduce duplication without hiding product behavior.

---

## Recommended UI structure

This is the intended hierarchy inside the inspector for a task that needs clarification:

### 1. Identity

- title
- kind
- created time

### 2. Readiness panel

- current readiness state
- one-sentence explanation
- primary missing requirement

### 3. Clarify section

- required `nextAction`
- optional supporting protocol fields

### 4. Commit section

- do today
- pick date
- schedule

### 5. Secondary actions

- link goal
- convert item type if still relevant
- archive

This order matters.

The user should understand readiness before scheduling.

---

## Recommended interaction copy

Copy should feel operational, calm, and supportive.

Good direction:

- “Add the first visible step before scheduling.”
- “This task is ready for Today.”
- “Optional details can make starting easier.”
- “Save and schedule.”

Avoid copy like:

- “Task invalid”
- “Incomplete protocol”
- “Required compliance fields missing”
- “You cannot continue”

The feature should reduce resistance, not create emotional friction.

---

## Recommended interaction model

### Queue row behavior

Queue rows should remain mostly unchanged structurally.

Possible light additions:

- subtle readiness marker for tasks needing clarification
- changed quick-action behavior when the user taps “Today”

Do not make the queue visually noisy.

### Inspector behavior

The inspector should become the main place where clarification happens.

When a task is not ready:

- show the readiness explanation immediately
- focus attention on `nextAction`
- make the save-and-commit path obvious

When a task is ready:

- keep the inspector lighter
- let the schedule actions remain primary

### Error handling

If a commitment attempt fails because readiness is missing:

- do not rely on a generic error banner alone
- guide the user into the clarification field immediately
- preserve any date choice they already made if possible

This is important for perceived smoothness.

---

## Recommended implementation sequence

Keep the frontend work straightforward.

### Step 1: wire in backend readiness data

Update task types and inbox data usage so the inspector can read readiness state.

### Step 2: add readiness presentation

Introduce the readiness message and hierarchy in the inspector.

### Step 3: add compact clarification editing

Let the user edit `nextAction` and optional protocol fields without leaving Inbox.

### Step 4: route scheduling through the commitment flow

Use the backend commitment mutation for inbox scheduling actions.

### Step 5: polish fast-path and failure-path UX

Make sure ready tasks stay quick and unclear tasks feel guided, not blocked.

---

## Testing and verification expectations

The frontend agent should verify at least these product behaviors:

- a ready task can be scheduled from Inbox quickly
- an unclear task shows a readiness explanation before scheduling
- trying to schedule an unclear task leads naturally into clarification
- saving `nextAction` and scheduling in one flow feels fast
- optional fields improve the flow without becoming mandatory-feeling
- the queue remains easy to scan on desktop and mobile widths

If visual changes are meaningful, document the expected before-and-after user experience in the handoff.

---

## UX guardrails

These are especially important.

### 1. Do not add too much chrome

This feature should not turn into multiple stacked cards and badges inside the inspector.

### 2. Do not make the user re-enter context

If they picked a date and then need clarification, preserve the context of that action.

### 3. Do not over-explain

One clear explanation is better than several paragraphs of guidance.

### 4. Do not force full planning during triage

The job here is to make the task startable, not to make it perfectly specified.

### 5. Do not bury the main action

After clarification, the user should be able to commit the task immediately.

---

## Definition of done

The frontend work is done when:

- Inbox clearly communicates whether a task is ready to commit
- a task without `nextAction` no longer feels falsely ready for scheduling
- clarification happens naturally inside the existing Inbox workflow
- ready tasks remain fast to schedule
- unclear tasks become easier to clarify without high friction
- the feature feels like a productivity improvement rather than extra admin

---

## Final guidance for the frontend agent

The right outcome is not “more UI.”

The right outcome is a smoother behavioral path:

- inspect
- clarify the first visible step
- commit

If the finished experience helps the user move quickly while quietly improving task quality, then the enhancement is successful.
