# Goals HQ Redesign Frontend Agent Brief

## Frontend Agent Prompt

```text
You are the frontend implementation agent for the Goals HQ redesign in Life OS. Your mission is to turn the current goals page into the flagship planning workspace of the app. You own the final interaction design, visual composition, page structure, naming polish, and frontend implementation quality. Build a minimal, modern, advanced planning experience that makes the hierarchy clear, keeps the app calm, and helps users connect bigger goals to monthly, weekly, and daily work without making the product feel like project-management software.
```

## Big Picture

The current goals page has useful pieces, but it does not yet feel like a true planning system.

Your job is to make the frontend express the new model clearly:

- Goals owns planning
- the route has `Overview` and `Plan` modes
- the user can manage domains and planning layers
- larger goals can break down into smaller connected goals
- weekly and monthly planning feel linked to real goals
- Today remains the execution surface

You are expected to design the actual frontend experience.

Do not wait for pixel-level instructions.

You should make intentional decisions about:

- layout
- hierarchy presentation
- visual emphasis
- copy refinement
- interaction flow
- responsive behavior
- motion

But you must stay within the product and contract requirements in this document and in the backend brief.

## Product Decisions Already Locked

These are not open design questions.

- `/goals` becomes the flagship planning workspace
- the route uses `Overview` and `Plan` modes
- planning uses a flexible hierarchy
- domains are user-manageable
- planning layers are user-manageable
- breakdown is guided manual, not auto-run
- reviews remain separate routes
- Today remains execution
- domains are customized only for Goals, not the entire app

## Current Frontend Context

Current main files:

- `client/src/features/goals/GoalsPage.tsx`
- `client/src/features/goals/GoalDomainSections.tsx`
- `client/src/features/goals/GoalCard.tsx`
- `client/src/features/goals/GoalInspectorPanel.tsx`
- `client/src/features/goals/GoalInspectorMilestones.tsx`
- `client/src/features/goals/SortablePlanningEditor.tsx`
- `client/src/features/reviews/components/PeriodicReviewWorkspace.tsx`
- `client/src/features/reviews/hooks/useReviewSubmission.ts`
- `client/src/features/settings/SettingsPage.tsx`
- `client/src/shared/lib/api/goals.ts`
- `client/src/shared/lib/api/reviews.ts`
- `client/src/shared/lib/api/settings.ts`
- `client/src/styles/60-goals-planning.css`

You should inspect the existing Today mode-toggle pattern and reuse the right level of familiarity without copying the page blindly.

## What The Frontend Must Deliver

### 1. Goals route with two real modes

The page must clearly support:

- `Overview`
- `Plan`

This should not feel like a hidden tab switch.

The user must immediately understand that:

- one mode is for scanning and managing
- one mode is for planning structure and alignment

The toggle should feel native to Life OS and consistent with the stronger interaction patterns already present in Today.

### 2. Overview mode

Overview mode should keep the scan-friendly strengths of the current page, but make them clearer.

Required outcomes:

- clearer page identity than "Active Pursuits"
- consistent naming for domains everywhere
- filters for domain, status, and horizon
- active and inactive goal handling
- clean create/edit goal entry
- readable cards with health, progress, and next-best-action context
- direct path into Plan mode for a selected goal

Overview mode should feel fast and operational, not heavy.

### 3. Plan mode

Plan mode is the centerpiece of this redesign.

It must make the planning ladder visible and usable.

Required capabilities:

- show the configured horizon structure
- show root goals and child goals
- support selecting a goal and seeing its context
- support breaking a goal into lower-layer child goals
- show the selected goal's milestones
- show linked weekly and monthly alignment
- show Today alignment signals

Plan mode should answer:

- what does this goal support?
- what supports this goal?
- what is the next lower planning layer?
- what is the current month doing for this goal?
- what is the current week doing for this goal?

You are free to choose the exact layout, but the structure must feel deliberate and easy to understand on first use.

### 4. Goal creation and editing UX

The redesigned frontend must support:

- create root goal
- create child goal from a selected parent
- assign or change domain
- assign or change horizon
- change status
- edit why and notes
- edit milestones

When creating child goals, the UI should carry context forward from the parent and make the relationship obvious.

The frontend should guide the user to the next sensible lower layer, but the user must remain in control.

### 5. Domain and planning-layer management surfaces

The user must be able to manage domains and planning layers from Settings.

The Goals route may also include shortcut entry points such as:

- "Manage domains"
- "Manage planning layers"

The frontend must provide:

- clean reorder behavior
- add/edit/archive flows
- safe language for removal or archive
- clear explanation that domain customization affects Goals only
- clear explanation that planning layers shape the Goals hierarchy, not the existence of weekly and monthly planning cycles

### 6. Review-flow updates

The frontend must update review flows so that planning links are preserved.

#### Weekly review

The weekly review should no longer reduce planning to plain text splitting.

It must support:

- structured next-week priorities
- optional goal selection for each priority
- consistent display of linked goals
- clear link back to Goals Plan mode

#### Monthly review

The monthly review should no longer treat outcomes as text-only items.

It must support:

- next-month theme
- three structured outcomes
- optional goal selection for each outcome
- consistent display of linked goals
- clear link back to Goals Plan mode

## UX Responsibilities You Own

You are expected to define:

- the final layout and section hierarchy
- how the hierarchy is visualized
- how selection works in Plan mode
- how breakdown actions are introduced
- how to keep the page usable on desktop and mobile
- how to keep visual density under control
- how the settings management surfaces feel
- how empty states educate instead of just reporting absence

Do not wait for exact direction about button placement, color, spacing, or motion.

That is your job.

## UX Requirements You Must Respect

- the page must stay calm and not feel like enterprise planning software
- the hierarchy must be readable even when the user has legacy flat goals
- domains must stop feeling mysterious
- weekly and monthly planning must feel connected, not tacked on
- Plan mode must feel meaningfully different from Overview mode
- the app must remain responsive on mobile and desktop
- accessibility and keyboard behavior must remain solid

## Suggested Frontend Structure

You do not have to use these exact component names, but the implementation should likely split into concerns similar to:

- `GoalsPage`
- `GoalsModeToggle`
- `GoalsOverviewWorkspace`
- `GoalsPlanWorkspace`
- `GoalsHierarchyRail`
- `GoalPlanInspector`
- `GoalBreakdownComposer`
- `GoalMonthlyAlignmentPanel`
- `GoalWeeklyAlignmentPanel`
- `GoalDomainManager`
- `GoalHorizonManager`

Avoid letting one file become the entire redesign.

## Required States And Flows

The frontend must handle all of these cleanly.

### Initial and empty states

- no goals yet
- legacy flat goals with no horizons
- no domains beyond defaults
- no active planning layers beyond the defaults
- no weekly priorities
- no monthly outcomes

### Editing states

- creating a root goal
- creating a child goal from a selected parent
- editing an existing goal
- editing milestones
- editing weekly linked priorities
- editing monthly linked outcomes
- editing domains
- editing planning layers

### Context states

- selected goal has parent and children
- selected goal has no parent
- selected goal has no children
- selected goal has no milestones
- selected goal is not represented in weekly or monthly planning
- selected goal is represented in monthly but not weekly
- selected goal is represented in weekly or monthly but not in Today

### Compatibility states

- goals migrated from old flat structure
- archived domains that are still referenced by older goals
- horizonless goals

## Data Dependencies

Assume the backend will provide:

- configurable goal domains
- configurable planning horizons
- goal hierarchy fields
- a workspace payload for the Goals route
- updated goal detail payloads
- preserved goal links for weekly and monthly planning
- review endpoints that accept structured linked planning items

Do not invent backend behavior that contradicts the backend brief.

If a backend response is unclear, use the backend brief as the source of truth and then adapt the UI to it.

## Frontend Acceptance Criteria

The frontend work is complete when:

- the Goals route clearly presents `Overview` and `Plan`
- the user can navigate the hierarchy without confusion
- the user can break down a goal into lower layers from Plan mode
- the user can understand where current monthly and weekly planning fit
- domains can be managed from Settings
- planning layers can be managed from Settings
- weekly review can create linked next-week priorities
- monthly review can create linked next-month outcomes
- old flat goals still render cleanly after migration
- the page feels intentional, modern, and flagship-level without becoming cluttered

## Validation

Minimum validation:

- `npm run build -w client`

Required manual QA:

1. Open Goals with no goals and verify the empty-state flow.
2. Create a root goal and then create a child goal from it.
3. Switch between Overview and Plan and confirm state stays coherent.
4. Edit milestones on a selected goal.
5. Edit weekly linked priorities from Goals.
6. Edit monthly linked outcomes from Goals.
7. Open weekly review and verify linked goal selection works.
8. Open monthly review and verify linked goal selection works.
9. Manage domains in Settings and confirm Goals updates correctly.
10. Manage planning layers in Settings and confirm Plan mode updates correctly.

## Deliverable Expectations

At the end of implementation, report:

- the files you changed
- what now works from a user point of view
- any backend dependencies that remain
- any follow-up UX polish items worth doing later

