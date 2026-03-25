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

The feature now has a strong operational Phase 3.

The planner already exists inside the Today page and the page correctly supports two working states:

- `Execute`
- `Plan`

The current implementation is now strong enough to support both planning the day and running against that plan without obvious workarounds.

The planner still is not fully production-ready, but the biggest core interaction gaps are now closed. The remaining work is mostly about speed improvements, quality-of-life actions, and final mobile polish.

## What Works Today

The following parts are already implemented and working:

- The Today page loads `plannerBlocks` from the day plan response.
- The Today page can switch between `Execute` and `Plan`.
- A user can create a free-form time block with start and end time.
- A user can edit a block title and block time.
- A user can delete an empty block.
- A user can reorder blocks directly from the planner UI.
- A user can assign an unplanned task into a block.
- A user can add tasks from inside a block.
- A user can remove a task from a block and return it to unplanned.
- A user can move a task directly from one block to another.
- A user can reorder tasks inside a block.
- Block create and edit flows both show inline client-side validation before save.
- The planner empty state now explains how to start instead of only saying there are no blocks.
- The Execute view shows clearer planned versus unplanned status and nudges the user back into planning when work is still outside the plan.
- The right rail shows a stronger planner summary when blocks exist.
- Execute mode now has a dedicated current-block focus in the main work lane.
- Execute mode now shows stronger up-next handoff and drift signals when the plan is slipping.
- A user can move planned work forward, return it to unplanned, or assign unplanned work into live blocks without leaving Execute.

This confirms that the backend contract is connected and the feature foundation is already real.

## Main Gaps

## 1. The planner still lacks the speed layer expected from a daily tool

What is missing:

- no bulk assignment flow
- no “assign next few tasks to this block” flow
- no fast keyboard-friendly planning path
- no quick duplicate block
- no quick split block
- no quick carry unfinished work into the next block
- no quick way to plan five to ten tasks in one pass without repeated clicking

Why this matters:

This is a high-frequency workflow. Once the core interactions are dependable, repeated friction becomes the main reason a user stops using the feature every day.

## 2. The mobile story is acceptable, but not yet strong

The feature still avoids drag-and-drop, which is correct for v1, but mobile ergonomics need another pass.

What is missing:

- larger tap targets for the highest-frequency actions
- cleaner picker layouts on smaller screens
- a denser but still readable block-edit pattern
- simpler touch-first movement of tasks and blocks

Why this matters:

Today is one of the highest-frequency surfaces in the product. Mobile friction will be felt immediately.

## 3. The planner still needs cleaner end-of-day handling

The feature now bridges Plan and Execute much better, but it still needs a cleaner story once reality fully outruns the schedule.

What is missing:

- a clearer story for how unfinished work carries forward later in the day
- tighter feedback when the planned day stops matching reality

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

Status: implemented

This batch focused on core day-planning operations and the minimum execute-mode visibility needed to make the feature dependable.

- added visible UI controls for block reordering
- added visible UI controls to move a task from one block to another
- added block-level “add task” entry points
- added shared inline validation for block create and edit
- strengthened empty-state guidance in the planner
- improved execute-mode visibility for planned versus unplanned work

Definition of done for Phase 1:

- a user can fully plan the day without needing workarounds
- a user can fix block order and task placement directly from the planner
- a user gets clear validation before invalid edits fail
- a user can see from Execute when work is still outside the plan

## Phase 2: Make the planner feel like a real time planner

Status: implemented

This phase should improve the planning surface itself.

- render the planner in clock order by block start time so the main surface reads like a true day timeline
- add visible time structure inside the planner itself instead of a plain stacked block list
- make free time and gaps visible, including direct “add block here” entry points from open time
- add adjustable visible day bounds with a browser-saved default window
- improve visual hierarchy between current, upcoming, and past blocks
- add faster block editing controls for common duration changes
- improve mobile layout for planning actions and touch-first pickers

Definition of done for Phase 2:

- a user can scan the day and understand its shape in seconds
- the planner feels like time-based planning, not just grouped tasks
- visible hours can be tuned to the user’s preferred day window without hiding real blocks outside that range
- free time is visible and actionable, not implicit
- mobile planning interactions remain usable without drag-and-drop

## Phase 3: Strengthen the execution loop

Status: implemented

This phase should connect planning and doing more tightly.

- highlight the current block in Execute mode
- show stronger "up next" and "off track" signals
- surface unplanned tasks more clearly in execution mode
- support quick plan adjustments without requiring a full context switch

Definition of done for Phase 3:

- the user can both plan and run the day from the same feature without friction

## Phase 4: Add speed and quality-of-life improvements

This phase should make the feature pleasant enough for everyday repeated use.

- bulk assignment actions
- block-level “assign next few tasks” shortcuts
- quick duplicate and split block actions
- quick carry unfinished work into the next block
- keyboard-friendly planning interactions inside Plan mode
- tighter mobile layouts for the highest-frequency planner controls
- keep starter-template expansion deferred until the speed layer is proven

Definition of done for Phase 4:

- a user can plan five to ten tasks into blocks in one pass without repeated picker churn
- a user can duplicate, split, or carry open block work forward from the planner itself
- Plan mode remains keyboard-friendly and mobile-usable without adding drag-and-drop

## Proposed Product Decisions To Confirm

The following decisions should be made explicitly before polishing the feature:

- Phase 2 decision: use a default visible planner window of `06:00` to `22:00`, but let the user change that window locally in the browser and reuse it on later visits.
- Phase 2 decision: the timeline renders in clock order by `startsAt`; existing block reorder behavior remains a compatibility path, but time order is the primary visual rule.
- Phase 2 decision: mobile keeps the unplanned lane below the timeline instead of using a bottom sheet.
- Phase 3 decision: Execute mode supports task-level move and assign actions in place, but block creation and block time edits stay in Plan mode.
- Phase 3 decision: drift signals use both time passage and unfinished tasks instead of task completion alone.
- Phase 4 decision: bulk assignment stays inside the existing unplanned lane instead of introducing a separate planner inbox or modal.
- Phase 4 decision: duplicate block copies structure and timing only, not tasks.
- Phase 4 decision: carry-forward speed actions in the planner move pending work into the next block; carry-to-tomorrow remains the existing task-level path elsewhere in Today.

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

The next implementation item should now move into Phase 4.

Recommended next batch:

1. add faster planning actions like bulk assignment and multi-task placement
2. add quick duplicate, split, and carry-forward actions for blocks
3. improve keyboard-friendly planning where it materially reduces repeated clicks
4. keep tightening mobile layouts for the highest-frequency task and block actions
5. consider lightweight starter structures only after the speed layer is solid

With Phases 1 through 3 done, the next milestone is no longer about missing core capability. It is about making the planner fast enough to become a repeated daily habit.
