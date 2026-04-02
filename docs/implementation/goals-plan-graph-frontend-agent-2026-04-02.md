# Goals Plan Graph Frontend Agent Brief

## Purpose

This document is a focused handoff for a frontend design-and-implementation agent.

The goal is to redesign the `Plan` experience inside `/goals` so it becomes a visual planning surface instead of a mostly read-only inspector with forms.

This is not a backend-heavy project. Treat this primarily as a frontend interaction, layout, and experience redesign that reuses the current goals, month, week, and today APIs.

Use this document together with:

- `docs/implementation/goals-hq-redesign-master-plan-2026-04-02.md`
- `docs/implementation/goals-hq-redesign-frontend-agent-2026-04-02.md`

This brief is the more specific instruction set for the new graph-style planning view.

---

## Frontend Agent Prompt

```text
You are the frontend design-and-implementation agent for the new graph-style Goals Plan experience in Life OS.

Your job is to turn the current Plan mode inside `/goals` into a visual planning graph that feels calm, modern, structured, and highly legible. The current Plan mode is too form-driven, too read-only, and too confusing for first use. Users should be able to understand hierarchy, break goals down visually, and connect goals to month, week, and today planning without bouncing through disconnected forms.

You own the final interaction design, component design, layout, motion, copy refinement, empty states, visual hierarchy, and frontend implementation quality.

Do not build a chaotic whiteboard. Build a structured planning canvas.

The target shape is:
- a graph view inside Goals Plan
- fixed planning lanes for horizons
- visible parent/child relationships
- visible Month / Week / Today planning lanes
- quick visual breakdown into supporting goals
- a detail rail for richer editing
- clear fallback to the existing outline-style Plan view

The product should feel like a strategic map, not project-management software and not a generic node editor demo.
```

---

## Product Problem

The current `Plan` mode is technically functional in parts, but it is not mentally clear.

What the user is feeling right now:

- the screen says “goal hierarchy,” but old goals often appear flat
- the user can inspect a goal, but cannot easily understand how to structure goals
- the user can create child goals, but the flow feels like filling forms one by one
- the weekly and monthly sections feel mostly read-only
- the page does not visually explain how goals, month, week, and today connect
- the current experience feels more like “open a record and inspect it” than “plan visually”

This is a real design problem, not user error.

The new graph view should solve that.

---

## Locked Product Decisions

These are already decided. Do not reopen them.

- `/goals` remains the flagship planning route.
- `Overview` and `Plan` remain the top-level route modes.
- The new visual graph ships as a new subview inside `Plan`, not a replacement for the existing outline view.
- The `Plan` subviews should be:
  - `Outline`
  - `Graph`
- The graph is structured, not fully freeform.
- Goals remain the main objects in the graph.
- `Month`, `Week`, and `Today` appear as interactive planning lanes, not just text summaries.
- The main job of the graph is goal breakdown.
- The graph should be selected-goal-centered by default, not a full overwhelming all-goals map.
- The right-side detail rail remains the main place for rich editing.
- Mobile should gracefully fall back to `Outline` instead of forcing a cramped graph-first interaction.

---

## Design Direction

### Core visual idea

Build a **structured planning canvas**.

It should feel like:

- part strategic map
- part editorial planning board
- part guided decomposition tool

It should not feel like:

- Miro
- FigJam
- a BPMN editor
- Jira
- a generic React Flow sample app

### Look and feel

The design direction should be:

- warm
- calm
- intentional
- spacious
- slightly premium
- visibly different from the current forms-heavy view

### Visual language

- Use fixed vertical or horizontal planning lanes for horizons.
- Use distinct but restrained treatment for:
  - goal lanes
  - planning lanes (`Month`, `Week`, `Today`)
  - selected node
  - draft / add-new ghost node
- Keep card density moderate. The graph must stay readable first.
- Use edges and connectors as guidance, not decoration.
- Use motion subtly:
  - lane reveal
  - node selection
  - ghost-node expansion
  - smooth rail updates

### Tone

The page should feel like:

- “this is my planning map”
- “I can see what supports what”
- “I can break this down naturally”

It should not feel like:

- “I need to understand a diagramming tool before I can use this”

---

## Experience Target

After this redesign, a user should be able to:

1. Open `Goals -> Plan -> Graph`.
2. Select a goal and immediately see:
   - the bigger goal above it
   - the supporting goals below it
   - which month items support it
   - which week items support it
   - whether today already represents it
3. Add a supporting goal visually from the graph itself.
4. Move or reorganize goals visually without hunting for forms.
5. Understand planning layers as real structure.
6. Understand that Month, Week, and Today are linked planning surfaces, not disconnected widgets.

---

## Required UX Model

### 1. Plan mode structure

Inside `Plan`, add a second-level view switch:

- `Outline`
- `Graph`

Behavior:

- `Outline` is the current safer fallback view.
- `Graph` is the new visual planning workspace.
- The view switch should feel native to the app, not bolted on.

### 2. Graph layout model

The graph should be **selected-goal-centered**.

Default behavior:

- the selected goal is the focus node
- ancestors appear in higher planning lanes
- children appear in lower planning lanes
- month/week/today planning lanes appear alongside the goal graph
- unrelated items can be shown in muted form where useful, but the graph should prioritize clarity over completeness

Do not default to a giant zoomed-out map of every goal in the system.

### 3. Lanes

Use fixed structured lanes.

Required lane types:

- each active horizon layer from goal configuration
- `Month`
- `Week`
- `Today`

Interpretation:

- horizon lanes contain goals
- month/week/today lanes contain linked planning cards or slots

### 4. Freedom inside structure

The canvas should allow some freedom, but only inside the structure.

Required behavior:

- nodes snap within lanes
- the user can reposition and drag goals meaningfully within their lane context
- the user cannot turn the page into a chaotic freeform whiteboard

### 5. Detail model

Keep the graph readable by using a right-side rail for rich details.

When selecting a goal:

- open goal detail rail
- show title, domain, horizon, status
- show why
- show notes
- show milestones
- show current hierarchy context
- show planning links
- expose edit actions there

When selecting a month/week/today planning card:

- open planning-item detail rail
- allow editing title and unlinking/removing

---

## Functional Requirements

### A. Graph-specific goal creation

The graph must support visual goal breakdown.

Required flow:

- selecting a goal should reveal a clear visual “add supporting goal” affordance
- this should appear as a ghost card / inline draft node in the next sensible lower horizon lane
- clicking it should open an inline composer or lightweight embedded draft card
- the draft should prefill:
  - `parentGoalId`
  - same domain as parent
  - suggested next lower horizon if one exists
- saving should immediately create the goal and redraw the graph

Do not force the user into a disconnected full form modal for the primary graph breakdown flow.

### B. Goal reorganization

The graph must support hierarchy cleanup and restructuring.

Required behavior:

- dragging a goal into another horizon lane can update its `horizonId`
- dragging a goal onto another goal’s “supported by” target can update `parentGoalId`
- re-parenting should be explicit and visually safe
- the UI should prevent or clearly reject invalid loops

### C. Month / Week / Today linking

The graph must visually connect goals to planning execution layers.

Required behavior:

- `Month`, `Week`, and `Today` should be visible as droppable planning lanes or structured slots
- dropping a goal into those lanes should create or update the appropriate linked planning record
- the visual should make slot limits understandable
- full states should be explicit

Defaults:

- Month card title defaults to goal title
- Week card title defaults to next-best-action title when available, otherwise goal title
- Today card title defaults to the current today suggestion logic already used in the app

### D. Existing outline support

The current list/tree Plan view should remain available as `Outline`.

This is required for:

- safety during rollout
- mobile fallback
- users who prefer a simpler structure

### E. Legacy flat goals

The graph must handle legacy users cleanly.

Required behavior:

- if goals are flat, show them clearly as flat
- do not invent fake hierarchy
- provide visible first-step guidance for creating structure
- make the first breakdown action obvious

### F. Empty and educational states

The graph must teach the user how to use it.

Required states:

- no goals at all
- flat goals only
- no selected goal
- no month links
- no week links
- no today link

These states should educate the user, not just report absence.

---

## Technical Approach

### Dependency choice

Use `@xyflow/react`.

Reason:

- pan and zoom
- custom node rendering
- edges
- drag/drop behaviors
- selection model
- stable React-friendly API

Do not build a graph engine from scratch.

### Implementation bias

This should be frontend-first.

Prefer reusing current APIs:

- goals workspace query
- goal detail query
- create goal mutation
- update goal mutation
- update goal milestones mutation
- update week priorities mutation
- update month focus mutation
- today priority update mutation

Avoid introducing new backend endpoints unless the current data model truly blocks the graph.

### Data model constraints

The graph should use the current domain model:

- goals remain goals
- horizons remain horizons
- week and month remain real planning-cycle records
- today remains real daily priorities

Do not invent a new saved “canvas document” model in this implementation.

### Layout persistence

For the first version:

- use deterministic lane-based layout
- do not persist freeform node positions

This should stay a planning system, not a manual canvas authoring tool.

---

## Current Repo Context

Key files likely involved:

- `client/src/features/goals/GoalsPage.tsx`
- `client/src/features/goals/GoalsPlanWorkspace.tsx`
- `client/src/features/goals/GoalFormDialog.tsx`
- `client/src/features/goals/GoalInspectorMilestones.tsx`
- `client/src/features/goals/useGoalTodayAction.ts`
- `client/src/shared/lib/api/goals.ts`
- `client/src/shared/lib/api/planning.ts`
- `client/src/styles/60-goals-planning.css`

Important existing facts:

- the current graph/canvas experience does not exist yet
- there is no graph library currently installed in `client/package.json`
- the current Plan experience is inspector-driven and form-heavy
- the current product already has real goal/month/week/today linking logic in place
- the current user confusion is mainly a frontend interaction and clarity problem

---

## What Must Change In The Existing Plan Experience

The current Plan mode problems that this work must address:

- “Break down into sub-goal” currently feels hidden or form-bound
- hierarchy is not visually obvious
- horizons are visible as labels, not as an understandable planning ladder
- month/week/today are visible as status blocks, not as manipulable planning surfaces
- the user has no satisfying visual way to restructure goals
- the user does not get a strong planning-map mental model

The redesign should directly fix those issues.

---

## Interaction Guidance

### Recommended graph interactions

- click node to select
- double click or explicit affordance to quick-edit
- drag goal across lanes to change horizon
- drag goal to support target to re-parent
- drag goal to month/week/today slots to link planning
- hover or select to reveal lightweight graph actions
- pan / zoom only where helpful, not as the primary interaction

### Avoid

- tiny diagram-editor controls
- cluttered toolbars
- endless floating handles
- a graph covered in badges and labels
- requiring the user to understand graph-editing mechanics before basic use

---

## Mobile And Responsive Expectations

This should be desktop-first.

Responsive requirements:

- on large screens, the graph is the primary experience
- on small screens, default back to `Outline`
- do not force a dense graph on mobile if it damages usability
- if a mobile graph view exists at all, it should be intentionally simplified

---

## Acceptance Criteria

The implementation is only complete if all of these are true:

- a `Graph` subview exists inside `Goals -> Plan`
- the graph is visually and behaviorally distinct from the current outline/tree view
- a selected goal clearly shows parent, children, and planning links
- creating a supporting goal is visual and fast from the graph itself
- month/week/today are visible as real planning targets in the graph
- the user can understand the planning ladder on first use
- the design feels calm and premium, not generic or enterprise-heavy
- flat legacy goals are handled gracefully
- the right-side rail remains the place for richer edits
- the existing outline mode still works as a fallback

---

## Testing Expectations

The frontend agent should verify at least:

- graph view renders with seeded horizons and real goals
- flat legacy goals render sensibly
- selected-goal-centered layout updates when selection changes
- child goal creation from graph updates the graph immediately
- drag/drop updates horizon or parent where expected
- linking into month/week/today works and persists after reload
- full slot behavior is clear when planning lanes are full
- rail state matches current selected node
- outline and graph stay in sync after edits
- desktop and mobile fallback behavior both make sense

---

## Final Instruction To The Frontend Agent

Do not treat this as a small UI polish.

This is a real interaction redesign.

Your responsibility is to make Plan mode finally feel like:

- a visual planning HQ
- a decomposition tool
- a structure builder
- a bridge from long-range goals to monthly, weekly, and daily execution

If a design choice makes the system harder to understand on first use, it is the wrong choice.

If a design choice makes the page look like generic graph software, it is the wrong choice.

If a design choice makes hierarchy, planning layers, and execution links feel obvious and calm, it is probably right.
