# Today Execute Screen Review

Date: 2026-03-30

Scope: `Today` screen, `Execute` mode only. The `Plan` mode is intentionally excluded from this review.

Primary question: does this screen help a user run the day with more clarity, less friction, and stronger discipline, or does it create extra scanning, extra choices, and extra mental load?

---

## Executive Summary

The current `Execute` page is much better than the old dashboard-style version, but it still has one core problem:

It is trying to be a score surface, a planning monitor, a task workspace, a habits panel, a health panel, a finance panel, a notes panel, a goal suggestion panel, and a recovery surface at the same time.

That means the page is more organized than before, but it is not yet simple.

From a first-principles productivity perspective, the screen should answer five questions very quickly:

1. What matters most today?
2. What should I do right now?
3. What can wait until later?
4. What has fallen off track and needs a decision?
5. Am I winning the day?

Right now the page answers all five, but not with enough hierarchy. The user still has to scan too many surfaces to build a mental model of the day.

The biggest redesign move should be this:

- stop treating `Execute` like a multi-panel workspace
- make it a single execution flow with one dominant focus area
- compress score and support domains into quieter summary layers
- reveal recovery, notes, goal ideas, and lower-priority context only when needed

The next version of this page should feel less like "here is everything related to today" and more like "here is how to win today, starting now."

---

## Final Verdict

### What is already strong

- The page now has a clear main column and a secondary rail instead of the older flat dashboard grid.
- Priorities are editable, rankable, and connected to goals.
- The page includes real execution behavior, not just passive status.
- The planner-aware execution model is thoughtful and can help prevent drift.
- Recovery work is no longer placed at the very top of the page.
- Score visibility is present, which matters for discipline and consistency.

### What is still not strong enough

- The page still shows too many separate surfaces for a screen that should be used many times per day.
- The user still has to reconcile multiple parallel models of the day: priorities, current block, next block, grouped tasks, routines, health, finance, notes, goal nudges, and recovery.
- The screen still makes the user scan before acting.
- Some of the most common actions are still hidden or visually secondary.
- The page still gets heavier as the day progresses instead of getting simpler.

### Bottom-line judgment

The current page is a good second version, but not yet the right long-term operating shape for a daily execution screen.

It has strong ingredients.

It does not yet have enough restraint.

---

## First-Principles Bar For A Great Execute Screen

If this is a daily-use productivity screen, it should meet these standards.

### Core job

Help the user decide, start, continue, recover, and close the day without feeling overwhelmed.

### Non-negotiable qualities

- Fast orientation: the user should know what to do next within 3 to 5 seconds.
- Low mental load: the page should reduce decisions, not multiply them.
- Visible focus: the current most important work should be unmistakable.
- Lightweight recovery: overdue work should be visible but should not hijack the whole day.
- Frictionless capture: when something new appears, the user should be able to park it instantly without leaving flow.
- Progressive disclosure: more detail should appear only when the user asks for it or when the system detects risk.
- Discipline support: score and progress should reinforce behavior, but they should not dominate the page.
- End-of-day usefulness: the screen should evolve through the day and help the user finish well, not just start well.

### Litmus test

If a user opens this page at 8:00 AM, 1:30 PM, and 9:00 PM, the screen should still feel helpful, but not identical.

Right now it is helpful, but too static.

---

## Review Sessions

This review was done in four passes.

### Session 1: Product intent review

Reviewed the active product docs to define the correct bar for this screen.

Key product intent found in the docs:

- Life OS should create a tight daily operating loop.
- The product should improve clarity, consistency, and discipline.
- `Today` is meant to be a focused execution view.
- Home and Today should help the user decide what matters today.

Reviewed docs:

- `docs/prd/PRD.md`
- `docs/prd/product-vision.md`
- `docs/prd/scoring-system.md`
- `docs/prd/screen-specs.md`
- `docs/prd/success-metrics.md`

### Session 2: Live screen structure review

Reviewed the current `Today` page composition and how `Execute` mode is assembled.

Primary screen files reviewed:

- `client/src/features/today/TodayPage.tsx`
- `client/src/features/today/today.css`

Core `Execute` components reviewed:

- `components/TodayHero.tsx`
- `components/PriorityStack.tsx`
- `components/PriorityCard.tsx`
- `components/ExecutePlannerFocus.tsx`
- `components/TaskQueue.tsx`
- `components/TaskCard.tsx`
- `components/ContextPanel.tsx`
- `components/PlannerSummary.tsx`
- `components/RoutinesHabits.tsx`
- `components/HealthPulse.tsx`
- `components/FinanceAdmin.tsx`
- `components/DayNotes.tsx`
- `components/GoalNudges.tsx`
- `components/RecoveryLane.tsx`
- `components/RecoveryTaskCard.tsx`

Supporting hooks and helpers reviewed:

- `hooks/useTodayData.ts`
- `helpers/planner-execution.ts`

### Session 3: User-flow review

Assessed the page from the perspective of a real daily user asking:

- What do I do first?
- Where do I look next?
- What part of the page actually helps me execute?
- What part of the page is just context noise?
- What happens when the day drifts?

### Session 4: Redesign synthesis

Translated the findings into a concrete next-state design:

- new hierarchy
- what to merge
- what to remove
- what to collapse
- what to elevate
- what to defer

---

## Current Execute Page: What The User Sees

At a high level, the page currently looks like this:

1. Top score-focused hero with mode toggle
2. Main left column
3. Right support rail
4. Recovery lane below

### Current structure

#### Top

- Daily score ring
- bucket progress bars
- one score nudge
- Execute / Plan toggle

#### Main focus column

- Top Priorities
- Run the day
- Daily Stream

#### Right rail

- Routines and Habits
- Health Pulse
- Finance and Admin
- Planner Summary or Schedule
- Day Notes
- Goal Suggestions

#### Lower section

- Recovery lane

This is materially better than the older screen, but it is still a lot of page for a user whose real need is usually:

"Tell me the next meaningful action and keep the rest under control."

---

## What Is Working Well

These parts should be preserved in the redesign.

### 1. The page has real operational depth

This is not a decorative dashboard. The user can actually do meaningful work here:

- rank priorities
- complete work
- recover overdue items
- move tasks around
- respond to block drift

That is the right foundation.

### 2. Priorities are still clearly represented

The user can see the top three outcomes and edit them quickly. That is critical to daily focus.

### 3. The screen understands planned vs unplanned work

This is a strong product idea. A productivity app should distinguish between work that belongs to the day and work that is just floating around.

### 4. Recovery has been demoted from the top

That is an important improvement. Yesterday's debt should not automatically bury today's execution.

### 5. Score and discipline feedback are visible

The product promise includes discipline through transparent feedback. Keeping score visible on Today is directionally correct.

### 6. The app is trying to support the full daily loop

The presence of routines, health, finance, and recovery means the page is trying to help the user stay consistent across life domains, not just finish tasks.

That is strategically correct.

The issue is mainly how it is presented.

---

## Main Findings

## 1. The page still does not answer "what should I do right now?" fast enough

Severity: Critical

The top of the screen is score-first, not action-first.

The first large surface the user sees is the score hero. The next large surfaces are priorities, planner execution, and task queue. The user still has to interpret all three before they know what to do next.

Why this matters:

- Execution screens should reduce ambiguity immediately.
- A user should not need to reconcile score, priorities, and planner state before starting.
- The top of the page should orient action, not just status.

What should happen instead:

- The first dominant surface should combine the current priority and the next concrete action.
- Score should remain visible, but in a compressed support role.

## 2. The page duplicates execution across multiple surfaces

Severity: Critical

The `Run the day` surface shows current block tasks, slipped block tasks, and unplanned tasks. Then `Daily Stream` shows the task list again in grouped form below.

This creates two problems:

- the user sees work twice
- the user has two different places to act on the same work

Why this matters:

- Duplicate task surfaces increase cognitive load.
- The user can become unsure which area is the "real" operating surface.
- A daily screen should have one main task stream, not two overlapping ones.

What should happen instead:

- Merge planner-aware execution and task execution into one unified stream.
- Let planner context shape the order and labels of tasks, not create a second task surface.

## 3. The page still has too many cards

Severity: Critical

Even after the redesign, the `Execute` page still renders a large number of separate panels:

- hero
- priorities
- run the day
- task queue
- routines
- health
- finance
- planner summary or schedule
- notes
- goal suggestions
- recovery

That is too many distinct surfaces for a page meant to be checked and used repeatedly throughout the day.

Why this matters:

- Every additional card creates more scanning.
- Equal-ish card treatment makes support information feel more important than it is.
- Frequent-use screens need fewer surfaces, stronger hierarchy, and calmer composition.

What should happen instead:

- one main execution flow
- one compact essentials area
- one hidden-or-collapsible support layer
- one recovery tray

## 4. The right rail contains too much secondary information

Severity: High

The right rail currently holds six different modules. Even though each one is fairly compact, together they create a constant sense of unfinished side work.

This hurts focus because the user is reminded of multiple life domains at the same time:

- habits
- health
- finance
- notes
- goals
- planning summary

Why this matters:

- A productivity screen should help the user hold one main thread at a time.
- Supportive domains should stay visible enough to prevent neglect, but not loud enough to compete with execution.

What should happen instead:

- Collapse these into one `Daily essentials` module with compact rows.
- Only show unresolved or at-risk items.
- Move notes and goal suggestions behind on-demand expansion.

## 5. The task grouping logic is better than before, but still not decision-first

Severity: High

Tasks are grouped by origin:

- carried forward
- scheduled today
- recurring

This is more useful than a flat list, but it still does not match the user's real decision process.

A user usually thinks in terms like:

- now
- next
- later today
- can defer
- needs rescue

Why this matters:

- Origin explains where a task came from.
- Execution needs to explain what to do with it now.

What should happen instead:

- Group the stream by decision value, not provenance.
- Good examples: `Now`, `Later today`, `Unplanned`, `Completed`.

Origin can still appear as a label, but it should not drive the page structure.

## 6. The page does not simplify itself as the day progresses

Severity: High

Completed items remain visible in place. Support modules remain visible. The structure stays broad even after the user has already decided what matters.

Why this matters:

- A great execution screen should get quieter over time.
- As work is completed, the remaining work should become easier to scan.
- Completed work should reinforce momentum without staying in the way.

What should happen instead:

- Collapse completed tasks into a compact `Completed today` drawer.
- Optionally collapse completed priorities into a light summary state.
- Reduce secondary modules after their items are complete.

## 7. Common actions are still too hidden for a high-frequency page

Severity: High

Task actions and priority actions still rely heavily on overflow menus and hover-reveal treatment.

Why this matters:

- This is daily operational UI, not a gallery.
- Common actions should be obvious and low-friction.
- Hidden actions are especially weak on touch devices.

What should happen instead:

- Keep the most common actions visible.
- On task rows, show at least `Done` and one defer action directly.
- Keep destructive or rare actions inside a menu.

## 8. The score is useful, but it is taking too much prime real estate

Severity: Medium

The score hero is well executed visually, but it occupies the most valuable space at the top of the screen without answering the most important user question.

Why this matters:

- The user comes to `Execute` to work, not to admire a metric.
- Score should guide behavior, not become the main event.
- Too much emphasis on score can subtly push the screen back toward dashboard behavior.

What should happen instead:

- Compress score into a thinner command bar.
- Pair it with the current focus summary and quick capture.
- Keep the "how am I doing?" signal visible without letting it lead the whole page.

## 9. Recovery is improved, but still too heavy when expanded

Severity: Medium

The recovery lane is now lower on the page and collapsible, which is good. But once opened, each recovery card still presents many parallel actions.

Why this matters:

- Overdue work should require decisions, but the recovery system should feel decisive, not laborious.
- When there are many overdue items, action overload returns quickly.

What should happen instead:

- Keep recovery closed by default.
- Use stronger batch handling.
- Offer a compact list with two primary choices first:
  - pull into today
  - schedule away

Everything else can be secondary.

## 10. The page is missing an in-page capture affordance

Severity: High

There is global quick capture in the app shell, but `Execute` itself does not visibly offer "capture this and keep going" inside the page flow.

Why this matters:

- New thoughts, interruptions, and reminders appear during execution.
- If capture is not visible, the user either breaks focus or trusts memory.
- A productivity screen should absorb interruptions cleanly.

What should happen instead:

- Add a visible quick capture entry point in the top command area.

## 11. Day phase awareness is still underdeveloped

Severity: Medium

The screen is planner-aware, but not meaningfully day-aware.

It can detect slipped blocks, but it does not clearly shift its tone or structure across:

- start of day
- active work period
- drift moment
- late day
- close day

Why this matters:

- Users need different help at different times.
- Morning needs focus formation.
- Midday needs drift correction.
- Evening needs closure and carry-forward.

What should happen instead:

- Introduce time-aware page states.
- The page should gently change its primary prompt based on day phase.


---

## Root Cause

The current screen is still carrying too many product goals in the default view.

The team correctly wants `Today` to represent:

- focus
- execution
- score
- habits
- health
- finance
- goal alignment
- notes
- overdue recovery
- planner awareness

All of those matter.

But not all of them should be equally visible at the same time.

The real design problem is not missing capability.

The real design problem is insufficient information compression.

---

## Evidence Notes From The Current Implementation

These findings are based on the current shipped structure, not guesswork.

### 1. The page really is composed of many default surfaces

`TodayPage.tsx` renders:

- `TodayHero`
- `PriorityStack`
- `ExecutePlannerFocus`
- `TaskQueue`
- `ContextPanel`
- `RecoveryLane`

`ContextPanel.tsx` then adds:

- `RoutinesHabits`
- `HealthPulse`
- `FinanceAdmin`
- `PlannerSummary` or `TimeBlocks`
- `DayNotes`
- `GoalNudges`

So the default `Execute` experience can easily present 9 to 11 distinct sections.

### 2. Execution is split across more than one working surface

`ExecutePlannerFocus.tsx` renders:

- current-block tasks
- slipped-block tasks
- unplanned tasks

`TaskQueue.tsx` then renders the task list again as grouped task sections.

This is the clearest structural reason the screen feels heavier than it should.

### 3. The current grouping logic is origin-based

`useTodayData.ts` groups tasks into:

- carried forward
- scheduled today
- recurring

That is useful metadata, but not the strongest execution hierarchy.

### 4. Important actions are still visually hidden

`PriorityCard.tsx` and `TaskCard.tsx` both keep overflow actions behind hover-reveal behavior and action menus.

That is one reason the page still feels slower than a true high-frequency operating surface.

### 5. Recovery still creates action overload

`RecoveryTaskCard.tsx` shows five separate task-level actions:

- move to today
- tomorrow
- pick date
- complete
- drop

That is functional, but too dense for bulk overdue recovery.


### 7. Quick capture exists globally, but not as part of this page's operating model

`AppShell.tsx` includes global quick capture support, including the keyboard shortcut.

That is good infrastructure, but it does not solve the `Execute` page problem by itself because the page does not visibly present capture as part of the daily workflow.

---

## Redesign Direction

## North Star

The next `Execute` page should feel like a calm command surface with one dominant thread:

"This is the work that matters now. Here is what to do next. Here is what needs attention later. Everything else is compressed."

### Design thesis

- Action first
- Status second
- Context third

### Structure thesis

- One dominant execution stream
- One compact essentials strip
- One optional support drawer
- One lightweight recovery tray

### Behavior thesis

- Make starting easier
- Make staying on track easier
- Make recovering faster
- Make completion reduce noise

---


---

## Proposed Component Strategy

## 1. Replace the hero with a command bar

Current problem:

The top area is score-heavy and action-light.

New version:

- Date and day phase
- Compact score chip
- "Win today" status
- quick capture button
- optional "review overdue" trigger

Example:

```text
Mon, Mar 30   Solid Day 74   3 things left to win today   + Capture
```

This keeps score visible without letting it dominate.

## 2. Merge priorities and execution state into one focus stack

Current problem:

`Top Priorities` and `Run the day` are related but separate, so the user has to bridge them mentally.

New version:

- show the top priority first
- directly below it, show the current execution state
- attach the next action to that state

Example:

```text
Top priority: Finish proposal draft
Now: Work block until 11:30 AM
Next action: Complete intro section
```

This gives the page a real "start here" center.

## 3. Collapse execution into one unified stream

Current problem:

Planner-aware tasks appear in one place and task groups appear again in another place.

New version:

- one task stream only
- planner context changes ordering, badges, and urgency
- current-block tasks rise to the top automatically

Recommended sections:

- `Now`
- `Later today`
- `Unplanned`
- `Completed`

Optional task metadata:

- planned block
- carried forward
- recurring

But these labels should support action, not define structure.

## 4. Turn the right rail into a compact `Daily essentials` module

Current problem:

Too many mini-cards are competing for attention.

New version:

One compact module with rows like:

- Routines: 3 of 5 complete
- Health: water low, meals on track
- Finance: no expense logged, 1 bill overdue

Rules:

- show only unresolved or at-risk states
- complete items collapse automatically
- a row opens detail inline only when tapped

This preserves cross-domain discipline without constant clutter.

## 5. Move notes and goal ideas behind intent-based reveal

Current problem:

Notes and goal suggestions are useful, but not important enough to sit on the page all day as separate surfaces.

New version:

- `Notes` lives behind a compact count or drawer
- `Goal ideas` appears only while editing priorities or when no clear priority exists

This makes them context-sensitive instead of permanently visible.

## 6. Keep recovery visible, but make it a tray

Current problem:

Recovery is still heavy once opened.

New version:

- collapsed tray with count and urgency
- open only on demand
- batch actions first
- task-level actions second

Example:

```text
Recovery: 6 overdue items. Review now.
```

Inside tray:

- pull into today
- move to later
- complete
- drop

## 7. Add a visible capture path inside Execute

Current problem:

The page expects the user to remember the global quick capture behavior.

New version:

- visible `Capture` button in the command bar
- mobile sticky entry if needed
- captured items go into `Unplanned` or `Notes`

This is essential for staying in flow.

## 8. Add day-phase states

The page should adapt.

### Morning state

- help set priorities
- show a stronger setup prompt

### Midday state

- emphasize drift correction
- highlight unfinished current-block work

### Late-day state

- emphasize closure
- collapse lower-value context
- promote carry-forward or daily review

### End-of-day state

- show "close the day" state
- surface unfinished items clearly
- route naturally into review/reset

---

## What To Keep, Change, Remove

## Keep

- Daily score visibility
- Top priorities
- Planner awareness
- Recovery workflow
- Cross-domain discipline support
- Immediate completion actions

## Change

- Score hero becomes command bar
- Priorities and execution state become one focus stack
- Task queue becomes one decision-first stream
- Right rail becomes one compact essentials module
- Recovery becomes a tray
- Completed work collapses
- Capture becomes visible

## Remove From Default View

- Separate goal suggestions card
- Separate notes card
- Separate planner summary card
- Separate time blocks card in `Execute`
- Duplicated task surfaces

---

## Recommended New Screen Sections

These are the exact sections I would ship for the next version.

## 1. Command Bar

Purpose:

- orient the user
- show score quietly
- expose quick capture

Contents:

- date
- day phase label
- compact score
- one-line win status
- capture button
- overdue count if relevant

## 2. Focus Stack

Purpose:

- answer "what matters now?"

Contents:

- top priority
- current focus state
- next action
- if off-track, one clear correction suggestion

## 3. Execution Stream

Purpose:

- give the user one place to work from

Contents:

- now
- later today
- unplanned
- completed collapsed

Rules:

- open work only by default
- completed items hidden behind a toggle
- current-block work pinned to the top

## 4. Daily Essentials

Purpose:

- maintain discipline without overwhelming the page

Contents:

- routines status
- health status
- finance/admin status

Rules:

- unresolved items only
- one-line rows
- tap to expand

## 5. Recovery Tray

Purpose:

- keep overdue work from disappearing
- keep it from taking over the page

Contents:

- count
- urgency
- batch actions
- optional per-task drill-in

---

## Functional Enhancements Needed

These improvements matter even if the visual design changes.

## 1. Collapse completed tasks by default

Why:

Open work should stay easy to scan.

## 2. Add visible quick actions on task rows

Recommended visible actions:

- Done
- Later / Tomorrow
- More

## 3. Add in-page quick capture

This is essential for protecting focus.

## 4. Make goal suggestions contextual

Show them only when:

- priorities are empty
- fewer than three priorities exist
- a priority is being edited

## 5. Add end-of-day close behavior

The screen should help the user finish, not just work.

## 6. Add day-aware prompts

Examples:

- "Set the top three before you start"
- "This block is drifting"
- "Wrap up and carry forward cleanly"

## 7. Add recovery batch actions

Especially useful when overdue count is high.


---

## Visual Design Guidance

The redesign should feel calmer and more intentional than the current card stack.

### Visual principles

- fewer boxes
- stronger hierarchy
- less repeated border treatment
- more use of spacing and typography
- one dominant surface, not many peer surfaces

### Specific guidance

- Make the page feel flatter and more editorial, less widget-based.
- Use card treatment only where the card is the interaction.
- Let the execution stream feel like a continuous workspace.
- Reserve stronger accent treatment for the current focus and recovery states.
- Keep secondary utilities visually quieter than the main flow.

### Important note

This should not become a "clean but empty" screen.

The goal is not to remove useful information.

The goal is to compress support information so the main action path becomes obvious.

---


## Suggested Phased Upgrade Plan

## Phase 1: Information Architecture Cleanup

Goal:

Reduce clutter without adding major new capability.

Changes:

- compress hero into command bar
- merge `Run the day` and `Daily Stream`
- move goal suggestions into priority editing
- combine support cards into `Daily essentials`
- collapse completed tasks

Expected outcome:

Much cleaner page with clearer starting point.

## Phase 2: Execution Behavior Upgrades

Goal:

Make the page actively guide the day.

Changes:

- add visible capture button
- add day-phase states
- add close-day state
- add smarter recovery tray
- improve quick row actions

Expected outcome:

The page becomes more adaptive and more helpful during the day.

## Phase 3: Polish And Reinforcement

Goal:

Make the page feel more rewarding and durable.

Changes:

- stronger completion feedback
- better motion on state change
- better win-status summaries
- analytics around time-to-first-action and task completion behavior

Expected outcome:

The screen feels disciplined, lightweight, and satisfying to use every day.

---

## Success Criteria For The Redesign

The redesign is successful if it produces these user outcomes:

- The user can identify the next action within 5 seconds.
- The page feels simpler at 5 PM than it did at 9 AM.
- Supportive life domains stay visible without crowding the core workflow.
- Overdue work is handled without hijacking the day.
- The user can capture a new thought without losing focus.
- The page feels like it helps the user win the day, not merely inspect the day.

---

## Highest-Priority Recommendations

If only a few changes are made next, these should come first:

1. Merge `Run the day` and `Daily Stream` into one execution surface.
2. Replace the score hero with a compact command bar.
3. Collapse the right rail into one `Daily essentials` module.
4. Add visible quick capture inside the page.
5. Collapse completed work and keep open work dominant.

These six changes would produce the biggest improvement with the least ambiguity.

---

## Closing View

The current `Execute` page has good product thinking inside it, but the default view still asks the user to hold too much at once.

The next redesign should not be about adding more widgets or making the current cards prettier.

It should be about removing parallel decision paths.

A great `Execute` page should feel like a strong daily operator beside the user:

- it tells them what matters
- it shows the next action
- it keeps drift visible
- it catches interruptions
- it reinforces consistency
- and it does all of that without turning the page into a pile of modules

That is the right bar for the next version.

---

## Reviewed Sources

Product references:

- `docs/prd/PRD.md`
- `docs/prd/product-vision.md`
- `docs/prd/scoring-system.md`
- `docs/prd/screen-specs.md`
- `docs/prd/success-metrics.md`

Current implementation references:

- `client/src/features/today/TodayPage.tsx`
- `client/src/features/today/today.css`
- `client/src/features/today/components/TodayHero.tsx`
- `client/src/features/today/components/PriorityStack.tsx`
- `client/src/features/today/components/PriorityCard.tsx`
- `client/src/features/today/components/ExecutePlannerFocus.tsx`
- `client/src/features/today/components/TaskQueue.tsx`
- `client/src/features/today/components/TaskCard.tsx`
- `client/src/features/today/components/ContextPanel.tsx`
- `client/src/features/today/components/PlannerSummary.tsx`
- `client/src/features/today/components/RoutinesHabits.tsx`
- `client/src/features/today/components/HealthPulse.tsx`
- `client/src/features/today/components/FinanceAdmin.tsx`
- `client/src/features/today/components/DayNotes.tsx`
- `client/src/features/today/components/GoalNudges.tsx`
- `client/src/features/today/components/RecoveryLane.tsx`
- `client/src/features/today/components/RecoveryTaskCard.tsx`
- `client/src/features/today/hooks/useTodayData.ts`
- `client/src/features/today/helpers/planner-execution.ts`
- `client/src/app/shell/AppShell.tsx`
