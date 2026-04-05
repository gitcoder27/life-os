# Goals Page Usability Review

Date: 2026-04-05

## Scope

This document captures the current product and usability review of the Goals page based on the live codebase.

It is intentionally scoped to the desktop web experience.

Out of scope for this pass:

- mobile and touch-specific usability
- responsive behavior and small-screen affordances

## Why This Review Exists

The Goals page is carrying an important job in Life OS:

- help a user capture meaningful life goals
- help them structure those goals into a hierarchy
- help them connect those goals to Month, Week, and Today
- help them review progress with as little friction as possible

The current screen already contains strong building blocks, but the interaction model is still harder to understand and heavier to use than it should be for a world-class productivity product.

## Bottom Line

The Goals page is feature-rich, but the core workflow is still too fragmented.

Today, a user has to move between:

- overview cards
- a separate overview inspector
- a separate plan inspector
- a graph canvas
- an outline rail
- weekly and monthly planning editors
- modal or embedded goal forms

That means the product already has capability, but the experience still creates too much resistance.

The main product direction should be:

- make capture lighter
- make planning actions more obvious
- reduce the number of places where the same task can happen
- make editing and restructuring available everywhere a user expects it
- make one primary planning workflow feel obvious and reliable

## What Is Already Strong

- Goals already connect to weekly, monthly, and today planning.
- The graph and hierarchy model create a good foundation for long-range planning.
- The app already computes useful goal intelligence such as progress, health, and next best action.
- The supporting-goal breakdown concept is strong.
- The planning dock is directionally right because it keeps goal structure and cycle planning close together.

## Top Findings

### 1. Core goal editing is not a reliable part of the workflow

This is the highest-priority product gap.

The screen presents editing affordances, but editing is not consistently reachable from the places where a user naturally expects it. The overview inspector currently renders an edit icon without a working action, while the actual edit flow exists separately inside page state.

Relevant code:

- `client/src/features/goals/GoalInspectorPanel.tsx:188`
- `client/src/features/goals/GoalsPage.tsx:110`
- `client/src/features/goals/GoalsPage.tsx:257`

Why this matters:

- Goals are not static. Users refine title, horizon, target date, and notes constantly.
- If editing is not immediate, the page stops feeling like a planning workspace and starts feeling like a partially read-only dashboard.
- Any hesitation around editing creates friction in the middle of planning.

Recommendation:

- Add a single, shared edit-goal flow and expose it consistently from cards, overview inspector, and plan inspector.
- Treat edit as a primary action, not a secondary or hidden one.
- Reuse the same editing surface everywhere so the user does not have to relearn the flow.

### 2. The product splits the same planning job across too many surfaces

The page currently asks the user to understand multiple parallel systems:

- Overview mode for review and batch planning
- Plan mode for hierarchy and graph planning
- one inspector in overview
- another inspector in plan
- batch week and month editing in overview
- inline goal-linked planning inside the plan graph

Relevant code:

- `client/src/features/goals/GoalsOverviewWorkspace.tsx:343`
- `client/src/features/goals/GoalsOverviewWorkspace.tsx:440`
- `client/src/features/goals/GoalsOverviewWorkspace.tsx:583`
- `client/src/features/goals/GoalsPlanWorkspace.tsx:1335`
- `client/src/features/goals/GoalsPlanWorkspace.tsx:1452`

Why this matters:

- The user has to keep switching mental models.
- The same intent, such as planning this week or understanding a goal, appears in more than one place.
- Extra flexibility here is hurting clarity.

Recommendation:

- Make Overview a review and scan surface only.
- Make Plan the clear system of record for goal structure plus Month, Week, and Today alignment.
- Reuse a single inspector model across both modes where possible.
- Reduce duplicate planning entry points so there is one obvious place to do planning work.

### 3. Goal capture is heavier than it should be

The create-goal form asks the user for too much structure at the start:

- title
- domain
- horizon
- why
- target date
- notes

Relevant code:

- `client/src/features/goals/GoalFormDialog.tsx:85`
- `client/src/features/goals/GoalFormDialog.tsx:96`
- `client/src/features/goals/GoalFormDialog.tsx:124`
- `client/src/features/goals/GoalFormDialog.tsx:153`

Why this matters:

- Good capture flows minimize commitment.
- Users often know the goal before they know the right horizon, target date, or detailed framing.
- Mandatory structure too early creates resistance and encourages postponing capture.

Recommendation:

- Make goal capture title-first.
- Pre-fill or suggest domain when possible instead of requiring deliberate setup up front.
- Move horizon, target date, why, and notes into optional secondary details.
- Keep the current richer form available for editing and refinement after creation.
- Use the lighter child-goal capture pattern as the default direction for all quick-add flows.

### 4. Findability and throughput will break down as the number of goals grows

The page does not yet help the user move quickly through a large set of goals.

Today the user mainly has:

- domain filters
- horizon and status filters
- card selection
- a secondary link into plan mode

Relevant code:

- `client/src/features/goals/GoalsOverviewWorkspace.tsx:331`
- `client/src/features/goals/GoalsOverviewWorkspace.tsx:419`
- `client/src/features/goals/GoalCard.tsx:145`

Why this matters:

- A life-goals system should get easier to use as goals accumulate, not harder.
- Users need fast ways to find what is stale, urgent, drifting, or ready to plan.
- Without search, sort, and stronger quick actions, the screen turns into a scanning exercise.

Recommendation:

- Add search.
- Add sort options such as most urgent, most at risk, recently active, and nearest target date.
- Add quick actions directly from cards and inspectors:
  - Plan this month
  - Plan this week
  - Add to Today
  - Break down
  - Edit
- Let users step through goals in sequence without repeatedly returning to the main grid.

### 5. The current screen shows strong intelligence, but not enough guided action

The data model already provides high-value planning context:

- progress
- health
- next best action
- current week alignment
- current month alignment
- habits and milestones

Relevant code:

- `client/src/features/goals/GoalCard.tsx:45`
- `client/src/features/goals/GoalsPlanWorkspace.tsx:332`
- `client/src/features/goals/GoalsPlanWorkspace.tsx:405`
- `client/src/features/goals/GoalsPlanWorkspace.tsx:445`

Why this matters:

- Information alone does not reduce friction.
- The user should not have to interpret the page and then figure out the next click.
- A strong productivity product turns insight into immediate action.

Recommendation:

- Convert more insight states into explicit next actions.
- When a goal is unrepresented in Month, Week, or Today, present one-click actions right there.
- When a goal has no milestones or no supporting goals, prompt the user with the next useful structuring step.
- Use the goal detail surface to guide the user into the next best planning move, not only to display context.

## Recommended Product Direction

If this screen is meant to become a world-class life-planning surface, the clearest product move is:

1. Keep Overview lightweight and review-oriented.
2. Make Plan the main workspace for structuring goals and linking them to Month, Week, and Today.
3. Unify editing and detail views so the user sees the same action model everywhere.
4. Reduce capture friction so creating a goal or supporting goal feels almost instant.
5. Increase quick actions so the page feels operational, not informational.

## Suggested Order Of Fixes

1. Fix the goal editing workflow everywhere.
2. Simplify the information architecture so planning happens in one clear place.
3. Redesign goal capture to be title-first and low-friction.
4. Add search, sort, and fast actions for scale.
5. Upgrade detail surfaces to guide action, not just show data.

## Checklist

- [x] Wire a single working edit-goal flow from cards, overview inspector, and plan inspector.
- [ ] Decide and document the final responsibility split between Overview and Plan.
- [ ] Remove duplicate planning entry points so one primary planning workflow is obvious.
- [ ] Redesign goal capture to support title-first quick add with optional advanced details.
- [ ] Add search to the Goals page.
- [ ] Add sort modes for urgency, drift risk, recent activity, and target date.
- [ ] Add one-click quick actions for Month, Week, Today, Break down, and Edit.
- [ ] Improve the detail surface so missing structure becomes an explicit next action.
- [ ] Add a sequential review flow so a user can move through multiple goals without returning to the grid each time.
