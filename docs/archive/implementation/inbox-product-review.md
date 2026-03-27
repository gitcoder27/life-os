# Inbox Product Review

Date: 2026-03-23

## Scope

This review covers the current inbox experience from the product point of view:

- UI and visual design
- UX and usability
- functional behavior
- backend and data-model support
- fit with the rest of the app

Reviewed sources included:

- `client/src/features/inbox/InboxPage.tsx`
- `client/src/features/inbox/WorkflowTemplatesSection.tsx`
- `client/src/features/capture/QuickCaptureSheet.tsx`
- `client/src/features/home/HomePage.tsx`
- `client/src/features/today/TodayPage.tsx`
- `client/src/shared/lib/api.ts`
- `client/src/shared/lib/quickCapture.ts`
- `server/src/modules/planning/routes.ts`
- `server/src/modules/home/routes.ts`
- `server/prisma/schema.prisma`
- product docs in `docs/prd`

Validation run during this review:

- `npm run typecheck`
- `npm run test -w server -- routes-smoke.test.ts`

Both passed at review time.

## Executive Summary

The inbox is a good foundation, but it is not yet a fully defined product surface.

What exists today is a useful triage screen for unscheduled items. It already has several strong ingredients:

- fast capture from anywhere
- a dedicated queue
- single-item and batch triage
- goal linking
- lightweight workflow templates
- a Home-level stale-inbox signal

The main issue is not that the inbox is broken. The main issue is that the inbox is conceptually blurry.

Right now it behaves like all of these at once:

- a capture queue
- a task inbox
- a note/reminder inbox
- a template application area
- a partial planning surface

But the product docs still define only quick capture, not a dedicated inbox screen. That mismatch is now large enough to matter.

My strongest recommendation is:

1. explicitly define the inbox as a first-class product surface
2. decide whether it is only a capture queue or a broader action inbox
3. make note and reminder behavior first-class in the backend instead of hiding it inside `task.notes`

Without those decisions, the UI can improve, but the screen will keep inheriting product ambiguity.

## What The Inbox Already Does Well

### 1. It creates a real low-friction capture-to-triage loop

Quick Capture sends tasks, notes, and reminders into the queue without forcing immediate structure, which is the right product instinct for this app.

Why this is good:

- it protects speed during the day
- it reduces the cost of remembering things
- it prevents Today from turning into a messy dumping ground

Evidence:

- quick capture supports task, note, and reminder entry with minimal required fields in `client/src/features/capture/QuickCaptureSheet.tsx:139-193`
- the inbox copy clearly positions the screen as triage in `client/src/features/inbox/InboxPage.tsx:381-385`

### 2. The screen supports both single-item and batch cleanup

The two-panel structure is a sound starting model for inbox work. The list supports scanning, while the inspector supports decision-making. Batch mode is especially useful once the queue grows.

Why this is good:

- it supports both careful triage and quick cleanup
- it avoids forcing a modal for every action
- it matches how people often process queues in bursts

Evidence:

- queue and inspector layout in `client/src/features/inbox/InboxPage.tsx:406-512`
- bulk mode and grouped actions in `client/src/features/inbox/InboxPage.tsx:514-625`

### 3. The app already treats stale inbox as a real recovery problem

Home tracks stale inbox items and routes the user back to the inbox. That is a strong product signal: the team already understands that “captured but never processed” is a real failure mode.

Why this is good:

- it closes part of the loop between capture and execution
- it prevents the inbox from becoming silent clutter
- it gives the screen strategic importance inside the product

Evidence:

- inbox is a primary nav destination in `client/src/app/shell/AppShell.tsx:16-25`
- stale inbox is surfaced on Home in `client/src/features/home/HomePage.tsx:440-499`
- stale inbox items are generated on the server in `server/src/modules/home/routes.ts:419-443`

## Main Product Findings

## 1. The Inbox Is Important In The Product, But It Is Not Defined In The Product Docs

### Current state

The live app treats inbox as a core screen:

- it is a top-level nav item
- Home sends users there for stale inbox recovery
- quick capture feeds it

But the PRD and screen inventory still define only quick capture as a global surface, not inbox as a dedicated screen.

Evidence:

- primary nav includes `/inbox` in `client/src/app/shell/AppShell.tsx:16-25`
- stale-inbox recovery points to `/inbox` in `server/src/modules/home/routes.ts:423-428`
- screen inventory has no inbox route in `docs/prd/screen-specs.md:5-18`
- PRD quick-capture requirements stop at capture itself in `docs/prd/PRD.md:251-260`

### Why this is an issue

This creates product drift:

- the UI is optimizing for a real inbox workflow
- the docs still describe only a capture surface
- backend choices are being made without a stable inbox contract

That makes it harder to answer basic product questions:

- Is inbox only for captured items, or for all unscheduled tasks?
- Is it a temporary queue, or a meaningful organizational layer?
- Is it separate from notifications, or eventually part of one broader action inbox?

### Recommendation

Add inbox as an explicit screen in the product docs and define:

- its exact purpose
- what belongs in it
- what does not belong in it
- how it differs from Today
- how it differs from Notifications
- what “inbox zero” means in this product

### User benefit

A clearly defined inbox leads to clearer copy, more predictable behavior, and less confusion about where captured information should live.

## 2. The Current Inbox Data Model Is Too Implicit

### Current state

The inbox is backed by generic tasks. The query is simply “pending + unscheduled”, and note/reminder identity is inferred by parsing JSON stored inside `notes`.

Evidence:

- inbox query is only `status: "pending"` plus `scheduledState: "unscheduled"` in `client/src/shared/lib/api.ts:1743-1747`
- tasks have no first-class kind field in `client/src/shared/lib/api.ts:293-308`
- task schema has no note/reminder type or reminder date field in `server/prisma/schema.prisma:332-356`
- note/reminder metadata lives inside JSON in `client/src/shared/lib/quickCapture.ts:1-101`

### Why this is an issue

This is workable for MVP, but it is already limiting the product:

- reminder behavior is not a real backend concept
- note/reminder filtering depends on parsing a serialized blob
- reporting and analytics are weaker
- server-side workflows cannot reason cleanly about reminder dates
- future features like snoozing, overdue reminder alerts, or reminder history become awkward

The current model is effectively saying:

"A reminder is just a task whose note string contains JSON that says it is a reminder."

That is too fragile for a screen that is becoming central.

### Recommendation

Choose one of these two directions:

1. Keep a unified `Task` model, but add first-class fields:
   - `kind` or `taskType`
   - `capturedAt`
   - `triagedAt`
   - `remindOnDate`
   - optional `triageState`

2. Split note/reminder into dedicated entities if they are meant to behave differently long term.

I recommend option 1 first. It keeps the app lightweight while removing the biggest ambiguity.

### User benefit

Users get a more trustworthy inbox, cleaner reminder behavior, better filtering, and less surprising behavior as the app grows.

## 3. “Reminder” Does Not Yet Deliver On What The Label Promises

### Current state

A reminder can be captured with a reminder date, but that date is mostly just stored and displayed. When scheduled, the app syncs the reminder date into the same JSON metadata. There is no dedicated reminder workflow, no reminder-specific alerting, and no clear distinction from a note beyond label and stored date.

Evidence:

- reminder capture writes JSON metadata in `client/src/features/capture/QuickCaptureSheet.tsx:174-193`
- reminder date input and recurrence UI exist in `client/src/features/capture/QuickCaptureSheet.tsx:360-380`
- scheduling only rewrites the stored reminder date in `client/src/features/inbox/InboxPage.tsx:231-234` and `server/src/modules/planning/routes.ts:644-652`
- existing tests confirm metadata syncing, not reminder delivery, in `server/test/modules/routes-smoke.test.ts:2796-2877`

### Why this is an issue

From a user point of view, “reminder” implies:

- this will come back to me at the right time
- the app will help me not forget it
- there is a meaningful difference from a note

Today the product does not fully keep that promise. It is closer to “a note with a date attached”.

That weakens trust because the wording is stronger than the actual behavior.

### Recommendation

Short term:

- clarify the UI language if needed
- surface due-today reminders explicitly in Inbox and Home
- allow snooze and “not today” actions

Next:

- add first-class reminder dates to the backend
- connect reminder items to the notifications engine
- support overdue reminder states and escalation rules

### User benefit

Users can rely on reminders instead of treating them as decorative metadata.

## 4. The Inbox Detects Staleness On Home, But The Inbox Screen Itself Does Not Help Resolve Staleness Well

### Current state

Home highlights stale inbox items. But once the user opens Inbox, the queue still defaults to newest-first and offers no stale grouping, no age buckets, no “oldest first”, and no special recovery mode.

Evidence:

- Home surfaces stale inbox counts and actions in `client/src/features/home/HomePage.tsx:440-499`
- the queue sorts newest first in `client/src/features/inbox/InboxPage.tsx:152-157`
- the queue only exposes type filters in `client/src/features/inbox/InboxPage.tsx:34-39` and `client/src/features/inbox/InboxPage.tsx:412-423`

### Why this is an issue

This breaks the recovery loop.

The product tells the user:

"You have stale inbox items."

But the inbox screen does not then help the user focus on those stale items first. If the queue keeps receiving new captures, older items stay buried.

### Recommendation

Add recovery-oriented controls:

- sort by oldest first
- filter by age buckets such as `today`, `2-3 days`, `4+ days`
- a “stale only” view
- an “oldest unresolved first” mode
- a banner when stale count is above a threshold

### User benefit

The user can actually recover the queue instead of just being informed that recovery is needed.

## 5. The Triage Actions Are Useful, But The Decision Set Is Still Too Narrow

### Current state

The inbox can:

- do today
- schedule
- link goal
- archive
- convert task to note

Batch mode can:

- schedule
- link goal
- archive

Evidence:

- single-item actions in `client/src/features/inbox/InboxPage.tsx:662-745`
- batch actions in `client/src/features/inbox/InboxPage.tsx:550-623`

### Why this is an issue

Real capture triage usually needs more than placement. It also needs cleanup.

Common triage decisions that are still missing:

- edit the text before promoting it
- convert note to task
- convert note to reminder
- convert reminder to task
- add or edit due time
- complete something directly
- duplicate a captured item
- merge duplicates
- split one capture into multiple tasks
- undo an archive

The lack of edit-and-reshape actions makes the inbox better at moving items than at clarifying them.

### Recommendation

Add an explicit “Refine” block in the inspector:

- edit title/body
- convert type in any direction
- set due time
- duplicate
- split into multiple tasks
- restore from archive or show recent archive history

### User benefit

Users can clean up messy real-world captures instead of forcing themselves to get the wording right at capture time.

## 6. The Current Queue Is Good For Small Volumes, But Weak For Medium-Volume Triage

### Current state

The queue supports only:

- type filtering
- selection
- opening one item at a time

It does not support:

- search
- goal filtering
- source filtering
- recurrence filtering
- manual vs quick-capture vs template distinction
- saved views

Evidence:

- filters are only `all`, `task`, `note`, `reminder` in `client/src/features/inbox/InboxPage.tsx:32-39`
- the inbox data includes origin type and goal linkage, but the page does not let the user filter by them in `client/src/shared/lib/api.ts:293-308`

### Why this is an issue

The current design is calm for small queues, but it will degrade once the screen becomes a daily habit. Medium-volume triage needs scanning aids.

Without better slicing, the queue becomes:

- visually uniform
- hard to search mentally
- slow to clean in bursts

### Recommendation

Add lightweight power tools:

- search by text
- sort by newest, oldest, reminder date, goal-linked, unlinked
- filter by source: quick capture, template, recurring, manual
- filter by linked goal
- filter by actionable state: stale, due soon, unlinked

### User benefit

The screen stays usable as the user becomes more engaged and captures more often.

## 7. Workflow Templates Are Valuable, But They Feel Misplaced And Too Shallow

### Current state

Templates live directly above the inbox and support simple lists of task titles. Applying a template drops unscheduled tasks into the inbox.

Evidence:

- workflow templates appear on the inbox screen in `client/src/features/inbox/InboxPage.tsx:389`
- template authoring and apply UI live in `client/src/features/inbox/WorkflowTemplatesSection.tsx:49-300`
- templates store only task titles and descriptions in `client/src/shared/lib/api.ts:310-323`
- applying a template creates title-only unscheduled tasks in `server/src/modules/planning/routes.ts:2003-2045`

### Why this is an issue

There are two separate problems here.

First, page fit:

- inbox is a reactive cleanup surface
- template authoring is proactive system setup

Those are related, but not identical jobs to be done.

Second, template depth:

- templates cannot store goal defaults
- templates cannot store notes
- templates cannot store due-time defaults
- templates cannot store reminder semantics
- templates cannot store ordering beyond line order

So the current template system is useful, but still blunt.

### Recommendation

Keep a lightweight apply shortcut near Inbox, but consider moving template management to:

- Quick Capture
- Settings
- Goals/Planning

Also expand template payloads to support:

- optional goal link
- optional note
- optional relative scheduling rule
- default type
- optional recurrence or reminder defaults

### User benefit

Templates become a true leverage feature instead of just a faster way to dump raw titles into the queue.

## 8. The Mobile Experience Is Likely Functional, But Not Yet Optimized For Triage

### Current state

On smaller screens, the two-column layout collapses into a single stacked flow. The queue remains above, and the inspector remains below.

Evidence:

- inbox layout is built as queue plus detail panes in `client/src/features/inbox/InboxPage.tsx:406-755`
- responsive styles collapse the queue rows and stack flex sections in `client/src/styles.css:2294-2323`

### Why this is an issue

On mobile, triage becomes a longer scroll loop:

- scan the list
- tap an item
- move down to the inspector
- act
- likely scroll back into the list

That is workable, but not ideal for repeated triage. The desktop mental model does not fully translate to mobile efficiency.

### Recommendation

For mobile, use one of these patterns:

- bottom-sheet inspector
- full-screen item detail after tap
- sticky action tray for selected item

Batch mode in particular would benefit from a persistent bottom action bar.

### User benefit

Users can clean the inbox quickly from a phone instead of fighting vertical navigation.

## 9. The Visual Design Is Polished, But It Prioritizes Atmosphere Over Operational Hierarchy

### Current state

The page has attractive gradients, strong card styling, and a premium dark aesthetic. It looks cohesive with the rest of the app.

Evidence:

- summary and panel styling in `client/src/styles.css:1896-1975`
- list item and detail styling in `client/src/styles.css:2078-2243`

### Why this is an issue

The page looks good, but visually it does not strongly distinguish:

- stale vs fresh
- high-value vs low-value captures
- reminder urgency vs plain note
- items needing action vs items mostly for reference

Most rows use the same visual weight. The design helps the page feel premium, but it does less to help the user decide faster.

### Recommendation

Shift some visual emphasis from decoration to hierarchy:

- stronger stale-state cues
- clearer urgency badges
- age-based tinting or markers
- clearer difference between executable tasks and reference items
- a more obvious recovery state when the queue is aging

### User benefit

The user can spot what matters faster instead of reading every row equally.

## 10. Accessibility Semantics Need More Attention

### Current state

The filter bar uses `role="tablist"`, but the buttons do not appear to implement full tab semantics. The list row also splits “select” and “open” into separate controls with a fairly dense interaction pattern.

Evidence:

- filter bar structure in `client/src/features/inbox/InboxPage.tsx:412-423`
- row interaction pattern in `client/src/features/inbox/InboxPage.tsx:463-489`

### Why this is an issue

For keyboard and assistive-technology users, the interaction model may be less predictable than it looks visually.

This matters because triage is repetitive work. Any friction compounds quickly.

### Recommendation

Improve:

- tab semantics and `aria-selected`
- keyboard navigation through the queue
- focus management between list and inspector
- bulk-selection accessibility labels

### User benefit

The page becomes more reliable for keyboard-first and accessibility-sensitive users, and more efficient for power users generally.

## 11. Inbox And Notifications Still Feel Like Parallel Systems

### Current state

The app has a separate notifications page with snooze/read/dismiss behavior, but that system does not route to inbox task entities. Notifications resolve to finance, health, habits, or reviews, not inbox items.

Evidence:

- notifications page routes entity types in `client/src/features/notifications/NotificationsPage.tsx:47-84`
- reminder and inbox items are not part of that route map in the current implementation

### Why this is an issue

The product currently has two different “things I need to look at” surfaces:

- Inbox
- Notifications

That can work, but only if the distinction is very clear.

Right now the separation is not yet strong enough:

- reminders do not behave like true reminders
- inbox captures can become stale
- notifications handle attention elsewhere

### Recommendation

Make an explicit product decision:

- Inbox = captured inputs waiting for structure
- Notifications = rule-generated attention items

If that is the intended split, make it much more explicit in copy and behavior. If not, start planning a broader unified action center.

### User benefit

Users stop wondering which queue they are supposed to trust for what.

## Backend Enhancements Worth Doing Next

These are the backend changes that would unlock the biggest product improvements for this screen.

### P0

- Add first-class task kind support instead of encoding note/reminder inside `notes`.
- Add first-class reminder fields such as `remindOnDate` and later `remindAt`.
- Add `triagedAt` and optionally `capturedAt` so stale logic and reporting become explicit.
- Add query support for inbox filters: `kind`, `goalId`, `originType`, `search`, `ageBucket`, `sort`.

### P1

- Add reminder-to-notification integration so reminder dates can drive actual prompts.
- Add recent archive or undo support for dropped inbox items.
- Add richer template payload support beyond title-only task lists.
- Add server-side inbox metrics such as stale count by age bucket and time-to-triage.

### P2

- Add suggestion support for likely goal links or likely action type.
- Add split/merge support for messy captures.
- Add saved inbox views or presets once usage grows.

## Suggested Frontend Enhancements Next

### Highest-value UI/UX work

- Add `stale`, `oldest`, and `search` controls.
- Add mobile-specific inspector behavior.
- Add edit/convert/refine actions in the inspector.
- Make urgency and age easier to scan visually.
- Keep template apply available, but reduce template authoring prominence on the triage screen.

## Priority Roadmap

## Phase 1: Clarify And Stabilize

- define inbox in the PRD and screen specs
- decide inbox vs notifications boundary
- make task kind and reminder date first-class backend fields
- add stale-first views and sorting

## Phase 2: Make Triage More Complete

- add edit and type-conversion actions
- add search and richer filters
- add undo/archive recovery
- improve mobile triage flow

## Phase 3: Make The Inbox Smarter

- connect reminders to notifications
- add template depth
- add goal suggestions
- add metrics and habit-forming feedback around inbox zero

## Final Assessment

The inbox is already one of the more promising surfaces in the product because it sits at the point where real life enters the system.

That matters. If capture and triage feel trustworthy, the rest of the product becomes easier to use. If inbox feels vague or underpowered, the whole system eventually accumulates friction and forgotten intent.

The good news is that the foundation is solid. The next step is not a rewrite. The next step is product clarification plus a few structural backend improvements so the screen can evolve from “a useful unscheduled-task view” into “a reliable capture and triage system”.
