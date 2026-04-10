# Health Meals Planner Frontend Agent Brief

## Frontend Agent Prompt

```text
You are the frontend implementation agent for the Health Meals Planner enhancement in Life OS. Your mission is to turn meal planning into a world-class weekly operating surface inside Health. You own the final interaction design, page composition, information hierarchy, naming polish, and frontend implementation quality. Build a focused, premium, highly usable experience that helps a solo user plan meals, prep work, groceries, and weekly execution without bloating the existing Health basics page.
```

## Big Picture

The current Health area already supports daily meal logging and simple meal templates.

Your job is to express the next product layer clearly:

- `/health` remains the daily health-basics tracker
- `/health/meals` becomes the weekly meal-planning workspace
- planning should connect to real execution
- the page should feel serious and useful, not like an admin CRUD screen or a generic recipe app

You are expected to design the actual frontend experience.

Do not wait for exact instructions about:

- layout
- spacing
- page rhythm
- visual hierarchy
- motion
- responsive adaptation
- copy polish

That is your job.

You should make strong design decisions while respecting the product and contract requirements in this document and in the backend brief.

## Product Decisions Already Locked

These are not open design questions.

- meal planning lives at `/health/meals`
- `/health` stays a focused daily basics page
- the planner is week-first
- the feature includes planning, prep scheduling, groceries, and weekly notes
- richer recipe detail is stored through expanded meal templates
- prep sessions must connect to Today as tasks
- planned meals must integrate into Health meal logging
- this is a solo-user workflow, not a household collaboration feature
- pantry, pricing, macros, and calorie analytics are out of scope

## Current Frontend Context

Current relevant files:

- `client/src/features/health/HealthPage.tsx`
- `client/src/shared/lib/api/health.ts`
- `client/src/app/router.tsx`
- `client/src/app/shell/AppShell.tsx`
- `client/src/app/shell/shell-navigation.tsx`
- `client/src/styles/35-health-page.css`
- `client/src/shared/ui/PageState.tsx`
- `client/src/shared/lib/api/planning.ts`

Current route behavior:

- `/health` already exists and is a real shipped screen
- shell navigation already highlights top-level Health
- React Query is the expected frontend data layer

You should preserve that architecture.

## What The Frontend Must Deliver

### 1. Health sub-navigation

The Health bounded context should become legible as two related surfaces:

- `Basics`
- `Meals`

Requirements:

- shell nav remains the top-level entry point
- add an internal Health subnav or equivalent route-level mode switch
- it must feel native to the app, not bolted on
- `/health` and `/health/meals` should clearly feel like siblings

### 2. New `/health/meals` page

This is the core deliverable.

The page must let a user run the whole week’s meal system from one place.

Required jobs:

- see the current planning week
- assign meals to each day and slot
- review reusable meal templates
- create or edit meal templates with recipe details
- schedule prep sessions
- review and manage the weekly grocery list
- capture weekly notes

The page should feel like an operating surface, not a stack of equal cards.

### 3. Weekly planning board

The main planning view must make the week legible.

Required capabilities:

- show all seven days
- show meal slots such as breakfast, lunch, dinner, and snack
- assign a template to a slot
- display servings and slot-specific notes
- clear or replace an assignment
- duplicate common patterns in a user-friendly way

You may choose the final layout, but it must satisfy these product needs:

- desktop should support fast scanning across the week
- mobile should stay usable without becoming tiny unreadable cards
- the board should still work for sparse weeks and dense weeks

Do not rely on drag-and-drop unless it is genuinely improving usability and remains solid on mobile.

### 4. Template and recipe experience

Meal templates are being upgraded into recipe-grade reusable meals.

The frontend must support:

- creating and editing templates
- viewing recipe details
- using templates as planning inputs
- using templates as meal logging shortcuts

A template may include:

- name
- default meal slot
- short description
- servings
- prep time
- cook time
- ingredient list
- instruction list
- tags
- notes

You own how the template management surface feels, but it should support both:

- quick reuse during planning
- deeper editing when the user wants recipe detail

### 5. Prep workflow UI

Prep work is part of the plan, not an afterthought.

The UI must support:

- creating prep sessions
- assigning a date for the prep session
- capturing a title and notes
- showing whether the linked execution task is still open, complete, or dropped

This prep area should help the user understand:

- what needs to be done ahead of time
- when it needs to be done
- whether it has been handled

The frontend does not own task-generation logic, but it must make the linkage obvious.

### 6. Grocery-list UI

The grocery list is a direct output of the weekly plan.

Required capabilities:

- show generated grocery rows
- show manual extra rows
- support item checkoff
- keep the list easy to scan and shop from
- make grouped structure understandable if the backend sends sections or grouping hints

The grocery list should feel practical.

Do not make it visually heavier than the planning board.

### 7. `/health` meal-logging integration

The existing Health basics page must become planning-aware.

When the user opens meal logging on `/health`:

- today’s planned meals should appear before generic templates
- the user should be able to log from the planned entry naturally
- the logging experience must still support freeform fallback

This is an important bridge between planning and execution.

### 8. Empty states and first-use states

The frontend must make first use understandable.

Design for at least these states:

- no meal plan yet for the selected week
- no meal templates yet
- no prep sessions yet
- no grocery items yet
- a partly planned week
- a fully planned week

Empty states should teach the workflow:

- plan meals
- add prep
- review groceries
- execute through Today and Health

## UX Responsibilities You Own

You are expected to define:

- final page structure
- how the week planner is visualized
- how template picking works
- how deep editing is revealed without clutter
- how prep and grocery areas relate to the planner
- how to keep the screen intentional and premium
- how responsive behavior changes between desktop and mobile
- how motion helps orientation without becoming noise

You are not expected to wait for exact design instructions from the backend brief.

## UX Requirements You Must Respect

- the page must feel like part of Life OS, not a separate recipe site
- `/health/meals` must feel meaningfully different from `/health`
- the planner must support fast weekly scanning
- the design must not collapse into a grid of generic cards
- the page must remain understandable even if the user starts with almost no data
- the page must remain usable on narrow mobile screens
- accessibility, keyboard behavior, and form clarity must remain strong

## Suggested Frontend Structure

Use this as a direction, not a rigid wireframe.

### Top area

- page identity
- week range
- summary of plan completeness or execution state
- quick actions such as repeat, copy, or add prep

### Main area

- weekly planning board as the dominant surface

### Secondary areas

- recipe or template management
- prep queue
- grocery list
- weekly notes

The weekly planning board should be the loudest area.

Prep and groceries should feel closely connected, but secondary.

## Data And Contract Expectations

The frontend should expect the backend week payload to include:

- selected week metadata
- planned meal entries
- prep sessions
- grocery items
- week notes
- completion or count summary

The frontend should not invent fallback business rules for:

- grocery aggregation
- prep completion semantics
- planned-meal completion logic

If the payload exposes those states, render them clearly rather than recomputing them differently.

## Implementation Guidance

### Routing

- add a new route for `/health/meals`
- keep Health selected in shell navigation
- add route-level Health subnav

### State

- use React Query for server state
- keep local UI state small and page-specific
- avoid building large client-only derived stores for the planner

### Componentization

Prefer a focused set of subcomponents instead of one monolithic page file.

Likely areas:

- Health subnav
- week header
- meal planning board
- meal-slot editor or picker
- template detail editor
- prep queue
- grocery list
- week notes panel

### Styling

Preserve the app’s overall visual language, but make the new page feel more deliberate than CRUD.

The design should communicate:

- weekly structure
- operational clarity
- meal execution confidence

Do not let the screen become visually flat or repetitive.

## Testing Expectations

You should validate:

- `/health` still works normally
- `/health/meals` loads correctly on first render
- plan data persists through save and reload
- template creation and editing are usable
- prep sessions surface task linkage clearly
- grocery list interactions remain understandable
- mobile layouts remain functional
- major loading, error, and empty states look intentional

If the client still lacks formal frontend test coverage for this area, document manual verification clearly.

## Acceptance Criteria

The frontend work is successful when:

- the user can plan a week of meals from one dedicated page
- the page feels like a serious Life OS workflow, not a generic recipe manager
- the week is easy to scan and edit
- recipes, prep, groceries, and notes are present without competing for attention equally
- the existing Health basics page stays fast and focused
- planned meals show up naturally in Health meal logging
- the design quality is strong enough that the screen feels flagship, not provisional

## Non-Goals

Do not expand scope into:

- nutrition dashboards
- pantry inventory
- grocery delivery
- price comparison
- AI meal recommendations
- multi-user household coordination

## Coordination With Backend

Assume backend owns:

- schema shape
- route contracts
- validation
- grocery generation rules
- task linkage rules

If backend exposes stable statuses or summary fields, use them.

Do not reimplement backend business logic in the browser unless there is a narrow presentational need.
