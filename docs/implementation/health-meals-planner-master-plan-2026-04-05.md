# Health Meals Planner Master Plan

## Session Prompt

```text
You are continuing the Health Meals Planner enhancement for Life OS. Your job is to add a dedicated meal-planning surface under Health that lets a self-managing user plan the full week of meals, prep work, groceries, and recipe details without turning the current Health basics page into an overloaded dashboard. The result should feel like a real weekly operating system for meals that connects planning to execution across Health and Today.
```

## Why This Document Exists

This document is the main handoff for a new implementation session.

It captures:

- what exists now
- what gap we are solving
- what decisions are already locked
- what the new meal-planning feature must do
- how frontend and backend work should divide cleanly

This is not a small extension to meal logging.

It is a structural enhancement that adds a dedicated meal-planning surface inside Health while preserving the current `/health` page as the fast daily health-basics tracker.

## Current State Summary

Today the app already supports:

- a dedicated `/health` route
- daily health guidance and summary
- water logging
- meal logging
- meal templates
- workout status updates
- weight logging

Current meal-related strengths:

- meal logging already exists and fits the current Health page well
- meal templates reduce friction for repeated meals
- the backend and contracts already treat meals as a first-class part of Health

Current product gaps:

- there is no weekly meal-planning surface
- recipes are not modeled beyond a name plus short description
- ingredients are not tracked structurally
- there is no grocery-list workflow
- there is no prep-session planning
- meal planning does not connect to Today as actionable work
- `/health` is intentionally a daily basics page and should not become the full meal-planning workspace

## Core Product Decisions

These decisions are locked for this enhancement.

### 1. Meal planning gets its own Health subpage

The new surface should live under Health as a dedicated route:

- `/health` remains Health basics
- `/health/meals` becomes the meal-planning workspace

This can be supported by a small internal Health subnav such as:

- `Basics`
- `Meals`

The shell navigation does not need a separate top-level item for Meals.

### 2. The page is week-first, not recipe-library-first

The main job of the new page is planning the upcoming week.

The meal-planning experience should help the user answer:

- what am I eating this week?
- what do I need to prep?
- when should I prep it?
- what groceries do I need?
- what notes matter for execution?

Recipes and meal templates support that planning workflow.

They are not the primary top-level product identity.

### 3. The feature is operational, not just archival

V1 should include:

- weekly meal assignments
- reusable recipe-style meal templates
- prep sessions
- grocery-list generation
- weekly notes

V1 should not include:

- pantry inventory
- cost optimization
- advanced macro or calorie computation
- grocery delivery integrations
- multi-user household planning

### 4. The feature must integrate with the rest of Life OS

Meal planning is not a silo.

Locked integration behavior:

- prep sessions should create real tasks for Today execution
- today’s planned meals should be visible from Health meal logging
- logging a planned meal should connect the log to the planned slot

Goals, finance, and reviews do not need deep meal-specific integration in this enhancement.

### 5. The current Health page remains focused

`/health` stays a daily coaching-oriented basics tracker.

Do not overload it with:

- full weekly planning
- giant recipe management sections
- a large grocery workspace
- prep scheduling controls

It can link into the new Meals page and consume the planning data where useful, but it should not become that page.

## What The User Should Feel After This Enhancement

After this work, a user should be able to say:

- "I can plan my whole week of meals in one place."
- "I know what I am eating, what I need to buy, and what I need to prep."
- "My plan is not just stored; it turns into real execution work."
- "The Health basics page still stays fast and lightweight."
- "This feels like part of my full Life OS, not a disconnected meal tracker."

## Product Shape

### 1. Health basics route

`/health` keeps its current job:

- daily health pulse
- quick water logging
- meal logging
- workout update
- weight trend context
- weekly health patterns

Additional integration allowed on this page:

- link to `/health/meals`
- show today’s planned meals when opening the meal log flow
- prefer planned meals as logging shortcuts before generic templates

### 2. Meals route

`/health/meals` is the new planning workspace.

It should support one planning week at a time and center the following jobs:

- plan meals across all seven days
- assign meals to slots like breakfast, lunch, dinner, and snack
- attach serving counts and notes
- manage reusable meal templates with recipe details
- schedule prep sessions
- produce a weekly grocery list
- keep weekly notes

### 3. Recipes via richer meal templates

The existing `MealTemplate` model should be expanded rather than replaced with a separate recipe system in this enhancement.

Templates should gain recipe-grade detail such as:

- servings
- prep time
- cook time
- ingredients
- instructions
- tags
- notes

This keeps the model simple while still making templates useful enough for planning and groceries.

### 4. Prep as real execution work

Prep sessions are not just annotations.

If the user plans:

- Sunday evening batch cooking
- chopping vegetables Wednesday night
- marinating protein Friday morning

those sessions should generate real Today tasks on the scheduled date.

The task system remains the execution engine.

### 5. Groceries as weekly output, not separate product area

The grocery list should be derived from the week’s meal plan plus optional manual extras.

It should feel like a direct output of planning, not like a separate shopping application.

## Suggested Information Model

### Reuse and extend

- `MealTemplate`
  - keep `name`, `mealSlot`, `description`
  - extend `templatePayloadJson` to store recipe-grade structured fields
- `MealLog`
  - add optional link to the planned meal entry that was executed

### Add new planning records

- `MealPlanWeek`
  - one record per user per week start date
  - stores week-level notes and metadata
- `MealPlanEntry`
  - one planned meal slot inside a week
  - references a meal template
  - stores date, slot, servings, and notes
- `MealPrepSession`
  - planned prep or batch-cook work
  - stores scheduled date, title, notes, and linked task
- `MealPlanGroceryItem`
  - user-visible weekly grocery rows
  - supports planned rows and manual extra rows

## Expected Route And API Direction

### Existing endpoints to keep using

- `GET /api/health/summary`
- `GET /api/health/meal-templates`
- `POST /api/health/meal-templates`
- `PATCH /api/health/meal-templates/:mealTemplateId`
- `POST /api/health/meal-logs`
- `PATCH /api/health/meal-logs/:mealLogId`

### New endpoints to add

- `GET /api/health/meal-plans/weeks/:startDate`
- `PUT /api/health/meal-plans/weeks/:startDate`

The week payload should contain enough information for the page to render from one query:

- week range
- planned meal entries
- reusable templates or summary references
- prep sessions
- grocery list rows
- weekly notes
- summary metadata for completion and counts

The frontend should not need to stitch the entire planner from many small calls.

## Frontend Responsibilities

The frontend agent should own:

- final interaction design
- page structure and visual hierarchy
- responsive behavior
- information density and usability
- copy refinement
- how the planning board, prep queue, and grocery list actually feel in use

The frontend should not wait for pixel-level instructions from backend guidance.

The frontend must still respect the product requirements in this document and the backend data constraints in the backend brief.

## Backend Responsibilities

The backend agent should own:

- Prisma model changes
- migration and backward compatibility
- shared contract updates
- route and validation behavior
- week save and load semantics
- grocery generation rules
- Today task linkage for prep sessions

The backend must keep the data model coherent enough that the frontend can implement cleanly without inventing hidden business rules client-side.

## Coordination Rules Between Agents

### Shared boundaries

- meal planning lives in the Health bounded context
- the frontend may shape the UI freely within product constraints
- the backend defines source-of-truth week structure and validation
- Today task generation for prep sessions is backend-owned behavior

### Frontend should not assume

- hidden grocery aggregation rules
- implicit migration behavior
- custom client-only fallback models
- undocumented enum or payload shapes

### Backend should not dictate

- exact button placement
- exact card layout
- exact visual treatments
- exact microcopy for every state

## Implementation Sequence

Recommended order:

1. Finalize contracts and Prisma model changes
2. Add backend load/save support for meal-planning weeks
3. Add prep-session to task linkage
4. Expose planned meals to the Health logging flow
5. Implement the new `/health/meals` page
6. Add Health subnav and cross-links
7. Verify task integration, meal logging linkage, and weekly persistence

This order keeps the frontend from building against unstable shapes.

## Test And Acceptance Requirements

The enhancement is not complete unless the following work end to end.

### Core planning

- create a weekly plan with multiple days and meal slots
- save and reload the plan without data loss
- edit or clear a planned meal slot
- add weekly notes

### Recipe-template support

- create a simple legacy-style template
- create a rich recipe-style template
- use both in planning and in meal logging

### Prep workflow

- create prep sessions for future dates
- verify linked Today tasks are created or updated correctly
- complete the generated task and verify prep state reflects it

### Grocery workflow

- generate groceries from planned meals
- preserve manual grocery extras
- verify check states and grouping persist correctly

### Health basics integration

- open meal logging on `/health`
- see today’s planned meals before generic templates
- log a planned meal and verify it links back to the plan entry

### General quality

- desktop and mobile layouts remain usable
- partial legacy meal-template data still loads
- validation errors are safe and clear

## Non-Goals

These are out of scope for this enhancement.

- macro counting
- calorie dashboards
- pantry depletion
- grocery pricing
- vendor integrations
- meal recommendations powered by AI
- multi-user collaboration
- subscription or household sharing models

## Deliverables

This enhancement should end with:

- a new active implementation route at `/health/meals`
- updated Health navigation between basics and meals
- updated backend contracts and migrations
- linked Today tasks for prep sessions
- planning-aware meal logging on `/health`
- test coverage for the new backend behavior
- documentation updates where needed
