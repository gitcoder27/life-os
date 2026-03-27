# Today Page Redesign Review

Date: 2026-03-23

## Scope

This document reviews the current `Today` page as a product surface and proposes a redesign direction for a full overhaul.

The review covers:

- UI and visual hierarchy
- UX and usability
- interaction density and task flow
- fit against the product docs
- recommended structure for the next version of the page

Reviewed sources included:

- `client/src/features/today/TodayPage.tsx`
- `client/src/features/home/HomePage.tsx`
- `client/src/shared/ui/PageHeader.tsx`
- `client/src/shared/ui/SectionCard.tsx`
- `client/src/styles.css`
- `docs/prd/screen-specs.md`
- `docs/prd/screen-breakdown.md`
- `docs/prd/PRD.md`

Live local data used during this review:

- `GET /api/planning/days/2026-03-23`
- `GET /api/tasks?from=2026-02-21&to=2026-03-22&status=pending`
- `GET /api/health/summary?from=2026-03-23&to=2026-03-23`

## Current Local Snapshot

The current local user state on 2026-03-23 is a useful stress case for this page:

| Signal | Current value | Product implication |
| --- | --- | --- |
| Priorities | 0 | The page needs to help the user form focus quickly. |
| Scheduled items today | 2 | The core execution workload is small. |
| Overdue items | 8 | Recovery can easily dominate the page if not controlled. |
| Goal nudges | 3 | Goal suggestions are relevant, but should not overpower execution. |
| Timed blocks | 0 | A full card for time structure becomes mostly empty. |
| Health context | 0 water, 0 meals, no workout | Health should stay visible, but compact. |

With this state, the current page would render:

- a full-width recovery lane
- an empty priorities card
- a goal suggestions card
- a task lane card
- a day notes card
- an empty time blocks card
- a meals and training card with all-zero status

That is a lot of large UI for a day that only needs a few clear decisions.

## Executive Summary

The current Today page has good functional coverage, but weak operating shape.

It already supports many of the right actions:

- priority editing and reordering
- task completion
- carry-forward and reschedule
- overdue recovery
- goal linkage
- lightweight day context

The problem is not missing capability. The problem is that the page is designed like a dashboard grid of equal-weight sections instead of a focused execution workspace.

The result is:

- too many large components
- weak visual hierarchy
- too much empty or low-signal UI
- hidden primary actions
- too much separation between planning and doing
- poor mobile ergonomics for such a high-frequency page

My recommendation is to redesign Today around:

1. one dominant execution column
2. one compact secondary rail
3. a collapsed-by-default recovery workflow
4. visible task actions
5. a stronger "start here" header
6. fewer, smaller, more meaningful surfaces

## What Today Should Be

The product docs describe Today as a focused execution view for the current day, not a general dashboard.

Relevant intent from `docs/prd/screen-specs.md:133-173`:

- purpose: support focused execution for the current day
- major sections: priorities, today's task list, optional time blocks, meals/workout summary, notes/reminders
- interaction rules: reorder priorities immediately, update task state cleanly
- mobile note: drag handles need a tap-based reorder fallback

The app-level principle in `docs/implementation/dashboard-audit-report.md` is also correct:

- "Today must be operational, not informational."

That should be the design bar for the overhaul.

## What Already Works

Before criticizing the current design, it is important to keep what is already strong.

### 1. The page has real operational actions

This is not a fake shell. The page can already change the day:

- priorities can be created, edited, reordered, completed, and dropped
- tasks can be completed, reopened, moved to tomorrow, or rescheduled
- overdue items can be recovered directly

This is a good foundation. The overhaul should preserve this depth and improve how it is presented.

### 2. Recovery is treated as a real problem

The page correctly understands that overdue work needs an explicit decision. The existence of a recovery lane is directionally right.

The issue is not that recovery exists. The issue is how much space and emphasis it takes in the default layout.

### 3. Goal linkage is valuable

Linking priorities to goals and suggesting next-best actions is strong product behavior. It helps Today stay connected to larger direction.

The issue is not the existence of goal nudges. The issue is that they currently live as another large peer card instead of being folded into the core planning interaction.

## Main Findings

## 1. The page is assembled as a dashboard grid, not a workspace

Evidence:

- the page uses a generic `PageHeader` and then drops everything into a generic `two-column-grid` in `client/src/features/today/TodayPage.tsx:920-932`
- `two-column-grid` is a simple two-column equal grid in `client/src/styles.css:504-507`
- almost every area is a `SectionCard`, and every `SectionCard` shares the same visual weight in `client/src/styles.css:699-738`

Why this is a problem:

- equal card treatment makes everything feel equally important
- execution, recovery, notes, time blocks, and health all compete for the same attention
- the page reads like a board of modules, not a working surface

Impact on the user:

- harder to tell where to start
- more scrolling before action
- more cognitive load before any useful work begins

## 2. Recovery lane visually hijacks the page

Evidence:

- recovery is rendered before the main priorities and task lane in `client/src/features/today/TodayPage.tsx:933-1065`
- the recovery card spans the full grid width in `client/src/styles.css:4558-4560`
- the current local user state has 8 overdue items, which would make recovery the most visually dominant area on load

Why this is a problem:

- overdue work is important, but it is not always the main thing the user came to do
- full-width top placement means yesterday's debt can bury today's plan
- on messy days, the screen becomes a recovery screen first and an execution screen second

Recommendation:

- keep recovery highly visible, but compress it into a summary strip or drawer trigger by default
- expand into a dedicated triage drawer, modal, or side panel when the user chooses to work it
- only open full recovery mode when the user comes in from a deep link or explicitly chooses "Review overdue"

## 3. Priority planning is split across multiple large surfaces

Evidence:

- priorities live in `Priority stack` in `client/src/features/today/TodayPage.tsx:1067-1148`
- goal suggestions live in a separate full card in `client/src/features/today/TodayPage.tsx:1150-1180`
- empty-priority creation also uses a separate add button and separate save bar in `client/src/features/today/TodayPage.tsx:1116-1147`

Why this is a problem:

- planning is split across editor, add action, save state, and separate suggestion card
- the user has to mentally stitch together "choose focus", "write focus", and "link to goals"
- when there are no priorities, the page feels especially hollow because the core focus area becomes an empty state next to another big card

Recommendation:

- merge goal nudges into the priority composer itself
- show suggestions inline under empty slots or inside a small picker
- treat priority creation as the main first action on the page, not as one card among many

## 4. Primary task actions are hidden behind hover-only affordances

Evidence:

- priority actions are hidden until hover or focus in `client/src/styles.css:4424-4439`
- task actions are hidden until hover or focus in `client/src/styles.css:4769-4780`
- reschedule is nested behind the task overflow menu in `client/src/features/today/TodayPage.tsx:476-519`

Why this is a problem:

- this page is high-frequency operational UI, so primary actions should be obvious
- hover-reveal favors neatness over throughput
- hidden actions are especially weak on laptop trackpads, touch devices, and quick-scan use

Impact on the user:

- slower task handling
- lower discoverability
- more friction on the exact page that should reduce friction

Recommendation:

- make the most common task actions always visible
- show at least `Complete`, `Tomorrow`, and `More` without hover
- on mobile, use visible action chips or swipe actions, not hidden menus only

## 5. The task list is not organized by decision value

Evidence:

- all non-note items are rendered as one flat `Task lane` in `client/src/features/today/TodayPage.tsx:1182-1228`
- timed tasks are pulled into a different card instead of helping structure the task lane in `client/src/features/today/TodayPage.tsx:695-697` and `1250-1268`
- notes are pulled into a separate `Day notes` card in `client/src/features/today/TodayPage.tsx:1230-1248`

Why this is a problem:

- the user is asked to process different kinds of work across separate containers
- time-sensitive work is visually disconnected from the main execution list
- notes and reminders feel detached from the flow of the day

Recommendation:

- keep one main execution stream
- group by decision relevance, for example:
  - `Now`
  - `Later today`
  - `Notes and reminders`
- alternatively, keep timed tasks pinned at the top of the task list rather than in a separate card

## 6. Supporting context is oversized relative to its value

Evidence:

- `Time blocks` and `Meals and training` are full `SectionCard`s in `client/src/features/today/TodayPage.tsx:1250-1304`
- current health display is a simple three-row list derived from text strings in `client/src/features/today/TodayPage.tsx:803-807` and `1281-1299`
- the current local health state is all zeros, so this card would be large but low-value

Why this is a problem:

- not every piece of context deserves a primary card
- these sections are secondary support information, not the main workspace
- when empty or sparse, they become visual ballast

Recommendation:

- merge time and health into a compact right rail section called something like `Day context`
- show them as dense status rows, not big standalone panels
- only expand detail when there is real detail to show

## 7. Empty states are too large and too numerous

Evidence:

- empty priorities, empty timed blocks, and low-signal health can all appear at once
- empty states use the same boxed treatment as meaningful content in `client/src/styles.css:427-440`

Why this is a problem:

- the page gets visually large even when the day is light
- empty states consume attention instead of helping the user move forward
- a light day should feel calm and intentional, not padded

Recommendation:

- replace some empty cards with smaller inline prompts
- collapse secondary modules entirely when empty
- use empty states only where they unlock a meaningful next step

## 8. Mobile interaction requirements are not fully met

Evidence:

- the PRD explicitly asks for a tap-based reorder fallback in `docs/prd/screen-specs.md:170-173`
- the current page relies on drag-and-drop via `@dnd-kit` in `client/src/features/today/TodayPage.tsx:675-678` and `1073-1081`
- the current mobile CSS mostly just wraps existing rows in `client/src/styles.css:4837-4864`

Why this is a problem:

- drag is not enough for a critical daily surface
- mobile users need visible, reliable, low-precision actions
- simply stacking desktop cards into one column does not create good mobile UX

Recommendation:

- provide explicit move up/down controls on mobile priorities
- reduce the number of top-level sections on mobile
- move notes into an accordion or secondary sheet
- keep the first screen centered on focus and the next actionable item

## 9. The page does not create a strong "start here" moment

Evidence:

- the page header is generic and descriptive in `client/src/features/today/TodayPage.tsx:922-925`
- there is no summary of current focus, next task, overdue status, or day progress above the grid

Why this is a problem:

- users should know what to do first within seconds
- the current header explains the page, but does not orient the user inside the page

Recommendation:

- replace the passive header with a focus strip that answers:
  - what is the top focus
  - what needs attention
  - what is next
  - what can be captured quickly

## 10. Home currently hands off into execution better than Today itself

Evidence:

- Home has a strong `Today focus` handoff card in `client/src/features/home/HomePage.tsx:361-425`
- Today itself has no comparable focus summary

Why this matters:

- the screen that introduces execution currently explains it more clearly than the screen that should actually run it
- Today should be the clearest execution surface in the app

Recommendation:

- reuse the strengths of the Home handoff:
  - single headline
  - small summary metrics
  - one clear next action
- but make it operational instead of summary-only

## Root Causes

The design problems appear to come from a few underlying choices:

- component-first assembly instead of page-first hierarchy
- overuse of generic card containers
- equal visual weight for primary and secondary content
- emphasis on clean minimal rows instead of visible action throughput
- support information added as peer sections instead of as compact context

## Redesign Thesis

### Visual thesis

Today should feel like a calm operator surface, not a modular dashboard.

One dominant execution column should carry the page. Secondary context should stay compressed. The interface should rely more on spacing, typography, alignment, and density, and less on repeated large containers.

### Interaction thesis

The page should reward momentum:

- visible primary actions
- fewer menus
- fewer dead states
- fewer full-width interruptions
- one obvious first move

### Product thesis

Today is where the user works the day. That means:

- plan quickly
- execute quickly
- adapt quickly
- close open loops quickly

Anything that does not help those jobs should be reduced, merged, or removed.

## Recommended New Information Architecture

## 1. Focus strip at the top

Replace the generic page intro with a compact operational header.

Suggested contents:

- page title and date
- top focus or "no focus set yet"
- overdue count with action
- next timed item, if any
- quick add action
- completion progress for priorities and tasks

This area should be above the fold and easy to scan in one pass.

## 2. One main execution column

This should be the dominant area on desktop and the first area on mobile.

Suggested order:

1. `Top 3 priorities`
2. `Open tasks`
3. `Notes and reminders`

Key rule:

- the page should feel like one working stream, not three separate departments

## 3. Compact right rail

Move secondary context into a narrow, dense rail.

Suggested contents:

- recovery summary
- day context
  - next timed item
  - water
  - meals
  - workout
- goal suggestion block
- optional day note summary

This rail should support decisions, not compete with them.

## 4. Recovery drawer or review mode

Recovery should be high-signal but not permanently dominant.

Suggested behavior:

- show a summary strip such as `8 overdue items need decisions`
- primary CTA: `Review overdue`
- opening that CTA launches a drawer, sheet, or dedicated sub-mode
- support both single-item and batch actions inside recovery mode

This keeps the risk visible without letting it hijack the default page.

## 5. Review-readiness footer

When the day is mostly clear, show a compact footer prompt:

- `Prepare tomorrow`
- `Open daily review`

This would make Today connect more naturally to the review loop.

## Recommended Interaction Changes

## Priorities

- Keep exactly three visible slots.
- Make empty slots actionable and helpful, not hollow.
- Inline goal suggestions directly into empty or low-confidence slots.
- Prefer autosave or immediate-save interactions over a separate save bar.
- On mobile, add explicit move up/down controls in addition to drag.

## Tasks

- Show primary actions without hover.
- Keep complete as the easiest action.
- Make defer/reschedule one step faster than today.
- Support grouping by `Now`, `Later`, and `Notes/reminders`, or a similar high-signal structure.
- Allow quick conversion of a note/reminder into a task if needed.

## Recovery

- Support fast triage choices:
  - do today
  - tomorrow
  - pick date
  - complete
  - drop
- Add batch decisions once the list exceeds a small threshold.
- Preserve deep linking into a specific overdue task, but inside the recovery mode instead of the main canvas.

## Day context

- Combine time and health into one compact module.
- Use concise numeric or status rows.
- Avoid full empty-state cards for zero-content scenarios.

## Notes and reminders

- Treat them as part of the day, not as a disconnected leftover card.
- On mobile, collapse them behind an accordion if needed.
- On desktop, keep them visible but compact.

## Visual System Guidance

The overhaul should follow a restrained product-UI direction:

- fewer cards
- stronger typography
- calmer spacing
- one dominant action color
- less decorative chrome
- denser but still readable operational rows

Specific guidance:

- keep one strong top band and one primary column
- stop giving every area the same padded card treatment
- use dividers, grouping, and row density before adding more boxes
- use color sparingly for state, not as general decoration
- make overdue and blocked states obvious, but not visually exhausting

## Mobile Guidance

The mobile page should not just be the desktop grid stacked into one column.

Recommended mobile behavior:

- sticky focus strip at the top
- priorities immediately below it
- task list next
- recovery behind a summary strip or drawer
- notes behind an accordion
- visible task actions, no hover dependency
- tap-based reorder fallback for priorities

First-screen rule:

- the first mobile viewport should show focus and the top part of the execution list, not multiple large secondary cards

## Accessibility and Usability Guidance

- Do not hide critical actions behind hover only.
- Ensure overflow menus are optional, not required for core work.
- Keep hit areas generous for task actions.
- Make priority reorder possible without drag.
- Preserve keyboard access for complete, defer, open details, and reorder.
- Avoid using color alone to communicate done, dropped, or overdue states.

## Suggested Component Direction

The next version of the page should move away from a pile of generic cards and toward page-specific building blocks.

Suggested component structure:

- `TodayFocusStrip`
- `TodayPriorityBoard`
- `TodayExecutionList`
- `TodayNotesSection`
- `TodayContextRail`
- `TodayRecoveryDrawer`

That would give the page a stronger identity and stop it from feeling like a reuse of generic dashboard patterns.

## Suggested Implementation Phases

## Phase 1: Layout and hierarchy

- replace the generic grid-led page composition
- add the focus strip
- move recovery into summary-plus-drawer form
- create a real main column and support rail

## Phase 2: Priority and task interaction overhaul

- merge goal nudges into priority creation
- remove or reduce explicit save friction
- make task primary actions always visible
- add mobile reorder fallback

## Phase 3: Support-context compression

- combine time blocks and health into one compact context area
- reduce empty-state weight
- integrate notes/reminders more cleanly into the day flow

## Phase 4: Polish and validation

- improve spacing, density, and type hierarchy
- test heavy-overdue, empty-day, and fully-planned-day scenarios
- test mobile, keyboard, and quick-action flows

## Acceptance Criteria For The Overhaul

The redesign should be considered successful when:

- the user can understand the page in under 5 seconds
- the first screen clearly shows what matters now
- overdue items are visible without overwhelming current-day work
- priorities, tasks, and notes feel like one workflow
- core task actions do not require hover
- mobile supports reorder without drag-only dependence
- secondary context is visible but compact
- a light day feels calm instead of padded
- a heavy day feels manageable instead of chaotic

## Final Recommendation

Do not iterate on the current layout by adding more cards or more panels.

The current Today page needs a structural redesign, not cosmetic cleanup.

The right move is to keep the existing capability model, but rebuild the page around a much clearer operating shape:

- one focus strip
- one dominant execution stream
- one compact support rail
- one intentional recovery workflow

That would make Today feel like the most important page in the app, which it should be.
