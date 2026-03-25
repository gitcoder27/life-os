# Today Day Planner Production Plan

Date: 2026-03-26

## Purpose

This document records the current state of the Today day planner, the gaps that still prevent it from feeling complete, and the recommended next implementation steps to make it a production-ready daily planning feature.

The goal is not just to "finish missing tickets." The goal is to make the planner fast, clear, low-friction, and trustworthy enough to become a core daily workflow.

## Reviewed Sources

- `docs/agent-prompts/today-day-planner-frontend-prompt.md`
- `client/src/features/today/TodayPage.tsx`
- `client/src/features/today/hooks/useTodayData.ts`
- `client/src/features/today/hooks/usePlannerActions.ts`
- `client/src/features/today/components/DayPlanner.tsx`
- `client/src/features/today/components/PlannerBlock.tsx`
- `client/src/features/today/components/PlannerBlockForm.tsx`
- `client/src/features/today/components/UnplannedTasks.tsx`
- `client/src/features/today/components/TaskQueue.tsx`
- `client/src/features/today/components/PlannerSummary.tsx`
- `client/src/shared/lib/api.ts`

## Current State Summary

The feature is partially implemented.

The planner already exists inside the Today page and the page correctly supports two working states:

- `Execute`
- `Plan`

The current implementation is strong enough to demo and test the basic planning flow, but it is not yet strong enough to feel complete for daily repeated use.

At the moment, the planner behaves like a block list plus an unplanned-task lane. It does not yet behave like a fully operational day-planning system.

## What Works Today

The following parts are already implemented and working:

- The Today page loads `plannerBlocks` from the day plan response.
- The Today page can switch between `Execute` and `Plan`.
- A user can create a free-form time block with start and end time.
- A user can edit a block title and block time.
- A user can delete an empty block.
- A user can assign an unplanned task into a block.
- A user can remove a task from a block and return it to unplanned.
- A user can reorder tasks inside a block.
- The Execute view shows planned-time badges for tasks that are in a block.
- The right rail shows a lightweight planner summary when blocks exist.

This confirms that the backend contract is connected and the feature foundation is already real.

## Main Gaps

## 1. The planner is not yet a true timeline

The planning surface is currently a vertically ordered list of block cards. It is sorted by block start time, but it does not yet function as a real timeline.

What is missing:

- no hour grid or visible day scale
- no empty-space visualization between blocks
- no clear sense of the full day from morning to night
- no direct manipulation of block position on a time axis
- no fast way to understand where the day is overloaded or still open

Why this matters:

This feature is supposed to help the user shape the day. A planner without strong time visibility makes planning slower and less trustworthy.

## 2. The first-run planning flow is too weak

The current empty state says "No blocks yet" and asks the user to create one. That is technically correct, but not enough guidance for a high-frequency feature.

What is missing:

- no onboarding explanation of the flow
- no suggested first-step sequence
- no starter block set for a typical day
- no helpful prompt based on the user's existing tasks

Why this matters:

A user can land on `Plan`, see an empty planner and a list of tasks, and still not know what to do next. That confusion is already visible in testing.

## 3. Task planning is possible, but not fast enough

Tasks can be assigned from the unplanned lane into a block. That part works. But the flow is still too slow for daily use.

What is missing:

- no bulk assignment flow
- no "assign next few tasks to this block" flow
- no block-level add-task action from inside the block
- no fast keyboard-friendly planning path
- no quick way to plan five to ten tasks in one pass without repeated clicking

Why this matters:

This is a daily-use planning feature. Repeated small frictions compound quickly.

## 4. Whole-block reordering is not exposed in the UI

The frontend API layer and planner actions include block reorder support, but the current screen does not expose controls for it.

Current consequence:

- if a user creates blocks in the wrong order, they cannot rearrange them directly from the planner UI
- the only practical workaround is editing block times one by one

Why this matters:

Block order is a core planner interaction, not an edge case.

## 5. Moving a task from one block to another is not a first-class action

The backend behavior supports moving a task into another block through the replace-tasks endpoint, but the current UI does not provide a clear "move to another block" control from the block itself.

Current consequence:

- the user has to remove the task from the current block
- then find it again in `Unplanned`
- then assign it into the new block

Why this matters:

Replanning is normal. A planner should make replanning easy, not awkward.

## 6. Block editing is under-validated and too dependent on backend errors

Block creation validates start and end ordering in the form. Block editing does not provide the same level of client-side feedback before save.

What is missing:

- no clear inline validation for overlap before submit
- no clear inline validation when edited end time is before start time
- no visual warning when moving a block would collide with another block

Why this matters:

This should feel like a smooth planning tool, not a form that fails after submit.

## 7. The planner does not yet support a strong execution loop

The Execute state shows planned-time badges and the context panel shows a summary. That helps, but it is still a light connection between planning and doing.

What is missing:

- no strong "current block" focus in the main execution lane
- no clear "up next" handoff inside the main work area
- no indication that a block is off track, overdue, or partially complete
- no simple way to adjust the day when the plan starts slipping

Why this matters:

A day planner is not only for making a plan. It also needs to help the user stay aligned with that plan while the day is happening.

## 8. The planning surface still lacks speed features expected from a core daily tool

What is missing:

- no quick duplicate block
- no quick split block
- no quick extend or shorten block
- no quick carry unfinished work into the next block
- no fast "plan around lunch / meetings / workout" workflow

Why this matters:

Daily planning is repetitive. Speed features are what make the tool feel usable every day instead of occasionally useful.

## 9. The mobile story is acceptable, but not yet strong

The feature does not depend on drag-and-drop, which is correct for v1. But mobile ergonomics still need work.

What is missing:

- larger tap targets for high-frequency actions
- cleaner task-to-block assignment flow on smaller screens
- a compact block-edit pattern that avoids visual clutter
- a simpler way to move tasks and blocks without precision tapping

Why this matters:

Today is one of the highest-frequency surfaces in the product. Mobile friction will be felt immediately.

## 10. The planner still feels isolated from the rest of the Today flow

The feature sits inside Today, which is the correct product direction. But the user experience still feels like "switch to another mode and manage blocks" rather than one continuous workday flow.

What is missing:

- stronger prompts in Execute when tasks are still unplanned
- stronger nudges to plan before execution when appropriate
- easier plan adjustments while staying in execution mode
- clearer status of what is planned versus not planned at a glance

Why this matters:

The planner should feel like the operating system for the day, not a side workflow.

## Production-Ready Target Experience

The production-ready version of this feature should support the following end-to-end user flow:

### 1. Start the day

The user opens Today and immediately understands:

- what is already planned
- what is still unplanned
- what block is current or next
- whether the day is realistic or overloaded

### 2. Build the day quickly

The user can:

- create the main blocks of the day fast
- use suggested presets or starter structure
- place tasks into blocks with very few clicks
- reorder and adjust blocks without friction

### 3. Replan during the day

The user can:

- move a task from one block to another quickly
- expand or compress a block when reality changes
- see what work is now unplanned or delayed
- recover without losing trust in the planner

### 4. Execute against the plan

The user can:

- see the current block clearly
- work from the planned task list
- understand progress within the current block
- know what is coming next

### 5. Close the day cleanly

The user can:

- see which planned tasks were completed
- see which planned tasks slipped
- reassign or carry forward unfinished work cleanly
- leave the day with a clear record of what actually happened

## Recommended Next Implementation Plan

## Phase 1: Close the core functional gaps

These are the highest-priority missing pieces and should be the next implementation batch.

- add visible UI controls for block reordering
- add visible UI controls to move a task from one block to another
- add block-level "add task" or "assign tasks" entry points
- add better inline validation for block edits
- strengthen empty-state guidance in the planner

Definition of done for Phase 1:

- a user can fully plan the day without needing workarounds
- a user can fix block order and task placement directly from the planner
- a user gets clear validation before invalid edits fail

## Phase 2: Make the planner feel like a real time planner

This phase should improve the planning surface itself.

- upgrade the block list into a more explicit timeline with visible time structure
- make free time and gaps visible
- improve visual hierarchy between current, upcoming, and past blocks
- add faster block editing controls
- improve mobile layout for planning actions

Definition of done for Phase 2:

- a user can scan the day and understand its shape in seconds
- the planner feels like time-based planning, not just grouped tasks

## Phase 3: Strengthen the execution loop

This phase should connect planning and doing more tightly.

- highlight the current block in Execute mode
- show stronger "up next" and "off track" signals
- surface unplanned tasks more clearly in execution mode
- support quick plan adjustments without requiring a full context switch

Definition of done for Phase 3:

- the user can both plan and run the day from the same feature without friction

## Phase 4: Add speed and quality-of-life improvements

This phase should make the feature pleasant enough for everyday repeated use.

- starter templates or suggested starter blocks
- bulk assignment actions
- quick duplicate and split block actions
- faster block duration adjustment controls
- keyboard-friendly interactions where practical

Definition of done for Phase 4:

- planning ten tasks into a full day feels fast instead of tedious

## Proposed Product Decisions To Confirm

The following decisions should be made explicitly before polishing the feature:

- Should the planner show a full-day hour scale from early morning to late evening?
- Should users be able to create blocks directly from tasks in Execute mode?
- Should the app suggest starter blocks based on existing timed tasks or common routines?
- Should a block track progress only by task completion, or also by time passage?
- Should the planner support quick block templates in v1.1, or stay fully manual for now?

## Recommended Acceptance Criteria For "Production-Ready"

The feature should not be considered complete until the following are true:

- A user can create, edit, delete, and reorder blocks directly from the planner UI.
- A user can assign tasks into a block from both the unplanned lane and the block itself.
- A user can move a task from one block to another in one clear flow.
- A user can immediately understand how to start planning when no blocks exist.
- A user can scan the full day and understand time distribution, gaps, and overload.
- A user can see what is planned, what is unplanned, what is current, and what is next.
- A user can adjust the plan during the day without losing context or momentum.
- The feature works cleanly on desktop and mobile without relying on drag-and-drop.

## Likely Implementation Areas

Most of the next work is frontend work inside the existing Today feature:

- `client/src/features/today/TodayPage.tsx`
- `client/src/features/today/components/DayPlanner.tsx`
- `client/src/features/today/components/PlannerBlock.tsx`
- `client/src/features/today/components/PlannerBlockForm.tsx`
- `client/src/features/today/components/UnplannedTasks.tsx`
- `client/src/features/today/components/PlannerSummary.tsx`
- `client/src/features/today/components/TaskQueue.tsx`
- `client/src/features/today/today.css`

The backend already exposes the key planner endpoints needed for the next frontend batch:

- create block
- update block
- delete block
- reorder blocks
- replace block tasks
- remove one task from a block

That means the immediate next milestone is mostly about better product behavior and better frontend interaction design, not backend catch-up.

## Recommended Next Step

The next implementation item should focus on completing the core missing planner operations before adding polish.

Recommended next batch:

1. block reordering UI
2. move-task-between-blocks UI
3. planner empty-state guidance
4. stronger block edit validation
5. better execution-mode visibility for planned versus unplanned work

Once those are done, the planner will stop feeling partial and start feeling dependable.
