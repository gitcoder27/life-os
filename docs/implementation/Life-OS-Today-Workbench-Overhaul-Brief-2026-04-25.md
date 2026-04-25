# Life OS: Today Workbench Overhaul Brief

Date: April 25, 2026

## Purpose

This brief defines the next redesign direction for the Today page.

The current Today page has useful ingredients, but the layout makes the daily workflow feel chaotic. The redesign should make Today an all-day execution workspace where the user's actual work is visible, calm, and easy to act on.

## Core Problem

Today currently has a priority inversion:

- the largest visual area is a focus hero
- the right rail shows support priorities, goal nudges, and daily essentials all at once
- recovery and advisory blocks compete for attention
- the actual task list appears below the first viewport

For a productivity application, this is backwards. The user opens Today to decide what to do now, what comes next, and what can wait.

## First Principle

Today should answer one question:

> What do I do now, what is next, and what can wait?

Every other feature should support that question without competing with it.

## Product Direction

Redesign Today as a **Today Workbench**, not a dashboard.

The task queue becomes the main surface. Focus, goal nudges, daily essentials, planning, and recovery become contextual layers around the queue.

## Proposed Layout

```text
Top command strip
Today · progress · overdue · add task · execute/plan

Main content
Left: Today queue
- Now
- Next
- Later
- Unplanned
- Overdue

Right: Task inspector
- selected task
- next action
- start focus
- complete
- stuck
- protocol
- goal context

Collapsed/contextual support
- Add from goals
- Daily essentials
- Week capacity
- Reduce today
```

## Execute Mode

Execute mode should be quiet and task-first.

Required behavior:

- show the task queue in the first viewport
- treat the must-win task as the first `Now` item, not a separate hero
- keep task actions close to each task
- use the right side as an inspector for the selected or active task
- collapse non-task guidance unless it is urgent
- keep rescue/reduction visible only when the day is overloaded or in rescue/recovery mode

Avoid:

- giant hero sections
- permanent coaching panels
- showing all support systems at once
- pushing the work queue below the fold

## Plan Mode

Plan mode should own planning complexity.

Move or emphasize these in Plan mode instead of Execute mode:

- support priorities
- day blocks
- sequencing
- goal suggestions
- unplanned task sorting

Execute mode should show the result of planning, not the full planning apparatus.

## Feature Placement

| Feature | New Placement |
| --- | --- |
| Must-win focus | First `Now` task in the queue |
| Support priorities | Plan mode, or compact collapsible section |
| Goal nudges | `Add from goals` action or compact suggestions when the day has room |
| Daily essentials | Small status chips; expand on click |
| Week deep work | Compact status row, not a large panel |
| Reduce today | Conditional rescue/overload command |
| Overdue work | Dedicated queue section, visible but not visually dominant |
| Focus session controls | Right inspector and selected task row |

## Daily Workflow

Morning:

```text
Open Today -> confirm Now -> add from goals if useful -> start
```

During the day:

```text
Return to Today -> see Now -> complete or focus -> next task moves up
```

When stuck:

```text
Open selected task -> use stuck flow -> shrink, clarify, reschedule, or recover
```

End of day:

```text
Review unfinished work -> complete, move tomorrow, shrink, drop, or send to Inbox
```

## UX Principles

- The work queue is the primary object.
- The first viewport must contain the main tasks.
- One selected task gets depth; the rest stay scannable.
- Guidance should be available, not loud.
- Empty space should create calm, not hide important work.
- Buttons should map to obvious actions: add, focus, complete, plan, recover.
- Text should be short, concrete, and action-oriented.

## Suggested Implementation Phases

1. Reframe Execute mode around a first-viewport task queue.
2. Convert the must-win card into a highlighted `Now` task treatment.
3. Replace the permanent right rail with a selected-task inspector.
4. Move support priorities and heavier goal suggestions into Plan mode or compact entry points.
5. Compress daily essentials, week capacity, and reduce-today into contextual rows.
6. Add an end-of-day carry-forward flow after the main layout is stable.

## Success Criteria

- A user can identify the current task in under 3 seconds.
- The task list is visible without scrolling on desktop.
- Starting, completing, and recovering a task are available from the task row or inspector.
- Goal suggestions help create work without making Today feel like homework.
- Daily essentials are visible as status, not as competing content.
- The page feels usable for repeated all-day visits, not just impressive on first load.

## Out of Scope for This Pass

- New life domains
- AI-generated planning
- New analytics pages
- Major backend schema changes
- Rebuilding the Planner page

