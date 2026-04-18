# Life OS: Focus Sessions v2

## Frontend Agent Implementation Plan

Date: April 18, 2026

## Purpose

This document is the frontend implementation brief for **Enhancement 3: Focus Sessions v2 - Execution Learning and Adaptation**.

It assumes the backend work in the companion backend brief has already been completed.

This document is written for a frontend design-focused agent and emphasizes:

- fast daily use
- low resistance at the moment of starting work
- calm, useful learning after a session ends
- practical UX over decorative productivity theater

The goal is not to add more surfaces just because more data exists.

The goal is to make the focus workflow smoother and more trustworthy so users are more likely to use it consistently every day.

---

## Product objective

Focus mode should help the user in three moments:

1. before starting
2. while staying with the work
3. after the session ends

Today, the product mainly helps in the middle moment.

Focus Sessions v2 should make the surrounding moments smarter too:

- before starting, the app should reduce setup friction
- after ending, the app should offer one small lesson that improves the next attempt

The user should feel:

- "this helped me start faster"
- "this helped me understand why the session worked or broke"
- "the next attempt now feels easier"

Not:

- "the app made me fill out more forms"
- "the app turned my work into a statistics dashboard"

---

## Current frontend reality

The current Today experience already has a usable focus v1:

- `FocusSessionLauncher` opens a small sheet
- the user chooses depth and planned minutes
- `FocusSessionPanel` shows the active session
- the user can capture a distraction
- the user can complete or end early

Important current files:

- `client/src/features/today/components/FocusSessionLauncher.tsx`
- `client/src/features/today/components/FocusSessionPanel.tsx`
- `client/src/features/today/components/StartProtocolSheet.tsx`
- `client/src/features/today/components/ExecutionStream.tsx`
- `client/src/features/today/components/MustWinCard.tsx`
- `client/src/features/today/TodayPage.tsx`
- `client/src/features/today/styles/execute-v2.css`
- `client/src/shared/lib/api/focus.ts`

The current product gap is that the focus UI does not yet make much use of session history.

So the user still has to remember things like:

- "this task usually collapses after 15 minutes"
- "I keep ending this task because it is unclear"
- "I should probably shrink the session next time"

Focus Sessions v2 should let the product carry more of that learning burden.

---

## Frontend design principles

These should be treated as locked decisions for v1.

### 1. Protect the fast start path

If the user is ready to work, the UI should not slow them down.

### 2. Show one recommendation, not a wall of metrics

A single useful suggestion is better than several charts.

### 3. Put learning at natural moments

The best moments are:

- when opening the launcher
- right after a session ends

Not while the user is in the middle of focusing.

### 4. Reuse existing Today patterns

Build on the current sheet, panel, and start-protocol patterns instead of creating a whole new focus area.

### 5. Stay productivity-first

This is a productivity application.

The UI should optimize for:

- quick orientation
- low cognitive load
- supportive copy
- easy recovery from friction

Avoid ritual-heavy or aesthetic-only focus design.

---

## Core UX decision

The frontend should turn focus v2 into a **guided but lightweight loop**:

1. show a small recommendation before the session starts
2. keep the active session screen calm
3. show a short adaptation recap after the session ends

This is the simplest shape that adds learning without making the flow feel heavier.

---

## Locked product decisions for frontend

### 1. Do not redesign the active session into a complex cockpit

The current active panel is already good enough for v1.

### 2. The launcher should become smarter, not bigger

Use backend insight data to prefill and guide.

### 3. Post-session learning should be short

One summary message and one obvious next action are enough.

### 4. Clarification should reuse existing task-prep UI

If the insight says the task needs a better next action, reuse the existing `StartProtocolSheet` flow instead of inventing a new editor.

### 5. Keep Home-level expansions out of scope for now

Focus Sessions v2 should land first inside Today, where the work actually happens.

---

## Recommended frontend behavior

## 1. Make the launcher prefill smarter

When the user opens the focus launcher, the UI should fetch the task insight and use it to reduce setup effort.

Recommended behavior:

- prefill `plannedMinutes` from `recommendedPlannedMinutes` when available
- show the `summaryMessage` in a compact recommendation area
- keep the launch controls immediately usable

The best user feeling here is:

- "the app already suggested a realistic length"

---

## 2. Show a focused recommendation before start

The launcher should show one small guidance block above the controls.

Recommended content:

- short label such as `Recent pattern`
- one-sentence summary from the backend
- optional light cue when the suggestion is `clarify_next_action`

Examples:

- "Recent sessions on this task usually end earlier than planned. Try 15 minutes."
- "This task has ended as unclear a few times. Tighten the next visible action before the next session."

This should feel like a helpful nudge, not a warning box.

---

## 3. Reuse Start Protocol when clarity is the issue

If the backend returns `suggestedAdjustment === "clarify_next_action"`, the launcher should make that recovery path obvious.

Recommended UX:

- show a small secondary action such as `Tighten next action`
- open the existing `StartProtocolSheet`
- return the user to the focus launcher with context preserved when practical

This is important for low resistance.

The user should not have to leave Today and hunt for the right editor.

---

## 4. Keep the active session panel calm

Do not overload the live session UI with analytics.

The current panel already supports:

- timing
- next action visibility
- distraction capture
- wrap up

That should stay mostly intact.

Minor improvements are fine if they support clarity, but the main v2 learning value should happen before start and after finish.

---

## 5. Add a short post-session recap

After a session is completed or ended early, the UI should show a compact recap that answers:

- what happened
- what the system suggests for next time

Recommended shape:

- a small inline recap card in Today after the mutation succeeds
- or a short follow-up state in the completion / abort flow

The recap should be brief.

Good direction:

- "Session ended early. This task has been stopping short of the planned length. Try 15 minutes next time."
- "This task keeps breaking as unclear. Tighten the next visible action before the next session."
- "Recent sessions on this task look stable. Keep the current setup."

One message plus one CTA is enough.

---

## 6. Keep the CTA practical

The recap or launcher should only offer actions the user can take immediately.

Good CTA examples:

- `Use 15 minutes`
- `Tighten next action`
- `Keep this setup`

Avoid giving the user abstract advice with no next step.

---

## Scope of frontend work

## In scope

- consume backend focus insight data in the Today experience
- improve launcher defaults and recommendation copy
- reuse `StartProtocolSheet` when focus insight points to task ambiguity
- add a compact post-session learning recap
- keep mobile and desktop layouts easy to scan

## Out of scope

- redesigning the whole Today page
- building charts or analytics dashboards
- focus streaks, trophies, or gamification
- expanding Home as part of this change
- adding notification-heavy behavior

---

## Recommended file ownership

The frontend agent should primarily work in:

- `client/src/shared/lib/api/focus.ts`
- `client/src/features/today/components/FocusSessionLauncher.tsx`
- `client/src/features/today/components/FocusSessionPanel.tsx`
- `client/src/features/today/components/StartProtocolSheet.tsx` if a small reuse hook-up is needed
- `client/src/features/today/components/ExecutionStream.tsx`
- `client/src/features/today/components/MustWinCard.tsx`
- `client/src/features/today/TodayPage.tsx`
- `client/src/features/today/styles/execute-v2.css`

If a small dedicated UI block is helpful, prefer a focused component such as:

- `client/src/features/today/components/FocusSessionInsightCard.tsx`

Avoid creating a generic analytics component.

---

## Recommended UI structure

## Launcher hierarchy

For the launcher sheet, use this order:

1. task title
2. next action
3. recommendation block
4. depth control
5. planned minutes
6. primary start button
7. optional recovery CTA if clarification is recommended

This order matters.

The user should understand the recommendation before changing settings.

---

## Recap hierarchy

For the post-session recap, use this order:

1. what happened
2. one-line summary message
3. one practical CTA

Avoid stacking several cards, metrics, or badges.

---

## Recommended interaction copy

Copy should feel supportive, brief, and operational.

Good direction:

- "Try a shorter session for this task."
- "Tighten the next visible action before the next round."
- "Recent sessions look stable. Keep the same setup."
- "Use 15 minutes"
- "Open start protocol"

Avoid copy like:

- "Focus performance is low"
- "You failed to sustain attention"
- "Execution quality dropped"
- "Analytics indicate reduced output"

The product should lower resistance, not create shame.

---

## Recommended interaction model

### Fast path

If the task looks stable:

- open launcher
- show a short reassuring recommendation
- keep the suggested time prefilled
- let the user start immediately

### Friction path

If the task repeatedly breaks down as unclear:

- open launcher
- show the short explanation
- surface `Tighten next action`
- let the user open `StartProtocolSheet`
- return to focus flow without making them rebuild context

### Adjustment path

If the task keeps stopping early:

- prefill the shorter recommended duration
- explain why in one sentence
- keep the start button prominent

These three paths are enough for v1.

---

## Recommended implementation sequence

Keep the frontend work straightforward.

### Step 1: wire in the new focus insight query

Extend the focus API client to fetch task-level insight data.

### Step 2: improve the launcher

Use insight data to prefill planned minutes and show the recommendation block.

### Step 3: connect clarification recovery

When appropriate, route the user into the existing `StartProtocolSheet`.

### Step 4: add the post-session recap

Show the short learning message after complete or abort actions.

### Step 5: polish layout and copy

Make sure the flow still feels fast on both desktop and mobile.

---

## Testing and verification expectations

The frontend agent should verify at least these product behaviors:

- a stable task still starts focus quickly
- a task with a shorter recommended duration gets that value prefilled
- a task with repeated `unclear` exits shows a clarification path
- the user can move from insight to `StartProtocolSheet` without losing context
- the post-session recap is short and understandable
- the launcher and recap remain readable on smaller screens

If the visual changes are meaningful, document the before-and-after behavior in the handoff.

---

## UX guardrails

These are especially important.

### 1. Do not turn guidance into ceremony

The focus flow should still feel quick enough for daily repetition.

### 2. Do not add too many stats

The point is better future action, not reporting.

### 3. Do not interrupt active focus with extra cognitive load

The learning layer belongs before and after the session.

### 4. Do not hide the main action

Starting focus should remain obvious.

### 5. Do not make clarification feel like punishment

If a task needs a better next action, the recovery flow should feel helpful and immediate.

---

## Definition of done

The frontend work is done when:

- the launcher uses backend insight data to reduce startup friction
- the user sees one clear recommendation before starting
- repeated `unclear` sessions lead naturally into task clarification
- post-session recap gives one useful lesson for next time
- the flow still feels lightweight enough for daily use

At that point, focus sessions will feel more adaptive without losing their existing simplicity.

---

## Final guidance for the frontend agent

The right outcome is not "more focus UI."

The right outcome is a smoother loop:

- start with less friction
- work with less guesswork
- finish with one useful adjustment

If the final experience helps the user re-enter focus more easily tomorrow than they could today, then the enhancement is successful.
