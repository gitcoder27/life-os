# Health Meals Planner Backend Agent Brief

## Backend Agent Prompt

```text
You are the backend implementation agent for the Health Meals Planner enhancement in Life OS. Your mission is to provide the data model, contracts, migrations, validation, and route behavior that turn the current meal logging feature into a real weekly meal-planning system. You are building the foundation that lets Health gain a dedicated meal-planning surface, generate grocery outputs, and connect prep work to Today execution while preserving existing meal-template and meal-log data.
```

## Big Picture

The frontend redesign depends on the backend being decision-complete.

Your job is to make the following product behavior real:

- the app can persist a weekly meal plan
- existing meal templates can grow into recipe-style reusable meals
- the app can persist prep sessions and connect them to Today tasks
- the app can surface a grocery list derived from the meal plan
- the existing Health basics page can log against today’s planned meals

This enhancement is not about nutrition science, calorie analytics, or pantry management.

It is about planning structure, execution linkage, and durable weekly meal operations.

## Product Decisions Already Locked

Do not reopen these.

- `/health` remains the daily health-basics page
- `/health/meals` is the dedicated meal-planning route
- the planner is week-first
- richer recipe detail is stored by extending `MealTemplate`
- prep sessions must generate or link to Today tasks
- planned meals must be loggable from `/health`
- grocery output comes from the weekly plan
- v1 excludes pantry, pricing, macros, calorie analytics, and multi-user workflows

## Current Backend Context

Current main backend areas:

- `server/prisma/schema.prisma`
- `server/src/modules/health/routes.ts`
- `server/src/modules/health/summary-builder.ts`
- `server/src/modules/planning/task-routes.ts`
- `server/src/modules/planning/planning-mappers.ts`
- `packages/contracts/src/health.ts`
- `packages/contracts/src/planning.ts`

Current meal constraints:

- `MealTemplate` already exists
- `MealTemplate.templatePayloadJson` currently only effectively carries a description
- `MealLog` exists and may reference `MealTemplate`
- there is no weekly meal plan model
- there is no ingredient model
- there is no prep-session model
- there is no grocery-list model
- task origin types do not yet distinguish meal-plan-generated work

## Required Backend Design

### 1. Extend `MealTemplate` instead of creating a separate recipe model

Do not introduce a parallel `Recipe` entity in this enhancement.

Keep `MealTemplate` as the reusable meal definition and extend `templatePayloadJson` so it can carry structured recipe data.

Recommended stored fields:

- `description?: string | null`
- `servings?: number | null`
- `prepMinutes?: number | null`
- `cookMinutes?: number | null`
- `ingredients?: MealTemplateIngredient[]`
- `instructions?: string[]`
- `tags?: string[]`
- `notes?: string | null`

Recommended ingredient shape:

- `name: string`
- `quantity: number | null`
- `unit: string | null`
- `section: string | null`
- `note: string | null`

Behavior rules:

- legacy templates with only `description` remain valid
- all new structured fields are optional
- route validation must normalize empty strings to `null` where appropriate

### 2. Add meal-planning week models

Implement normalized week planning records in the Health domain.

Recommended models:

#### `MealPlanWeek`

- `id`
- `userId`
- `startDate`
- `notes`
- `createdAt`
- `updatedAt`

Constraint:

- unique on `[userId, startDate]`

#### `MealPlanEntry`

- `id`
- `mealPlanWeekId`
- `date`
- `mealSlot`
- `mealTemplateId`
- `servings`
- `note`
- `sortOrder`
- `createdAt`
- `updatedAt`

Behavior:

- each entry belongs to one week and one date within that week
- multiple entries per day are allowed as long as the UI chooses to use them
- `sortOrder` allows stable display if multiple entries share a slot

#### `MealPrepSession`

- `id`
- `mealPlanWeekId`
- `scheduledForDate`
- `title`
- `notes`
- `taskId`
- `sortOrder`
- `createdAt`
- `updatedAt`

Behavior:

- prep sessions are week-owned planning records
- linked task is the execution artifact in Today

#### `MealPlanGroceryItem`

- `id`
- `mealPlanWeekId`
- `name`
- `quantity`
- `unit`
- `section`
- `note`
- `sourceType`
- `isChecked`
- `sortOrder`
- `createdAt`
- `updatedAt`

Recommended `sourceType` values:

- `planned`
- `manual`

Behavior:

- `planned` rows are derived from meal entries and their template ingredients
- `manual` rows are user-added extras and must survive regeneration

### 3. Link meal logs back to planned entries

Add an optional `mealPlanEntryId` on `MealLog`.

Behavior rules:

- `mealPlanEntryId` is nullable
- log creation from a planned meal should set it
- legacy logs remain valid with `null`
- ownership validation must ensure the entry belongs to the same user

### 4. Extend task origin types for prep execution

Add a new planning task origin type:

- `meal_plan`

This requires coordinated updates in:

- Prisma enum
- shared planning contract
- planning mappers
- task creation behavior where prep sessions create tasks

Prep tasks should remain ordinary tasks in Today, but with a clear origin type for filtering and rendering.

## API And Contract Requirements

### 1. Extend health contracts

Update `packages/contracts/src/health.ts` to support:

- richer `MealTemplateItem`
- richer `CreateMealTemplateRequest`
- richer `UpdateMealTemplateRequest`
- `mealPlanEntryId` on meal log types where needed
- new week-planning types and responses

Recommended new types:

- `MealTemplateIngredient`
- `MealPlanEntryItem`
- `MealPrepSessionItem`
- `MealPlanGroceryItem`
- `MealPlanWeekSummary`
- `MealPlanWeekResponse`
- `SaveMealPlanWeekRequest`

The week response should be comprehensive enough for the frontend to render the planner from one primary query.

### 2. Add week planner endpoints

Recommended endpoints:

- `GET /api/health/meal-plans/weeks/:startDate`
- `PUT /api/health/meal-plans/weeks/:startDate`

`GET` should return:

- week date range
- entries
- prep sessions
- grocery items
- notes
- summary counts

`PUT` should behave like an authoritative save of the week planning record and return the canonical saved week response.

### 3. Keep existing endpoints stable

Do not break:

- `GET /api/health/meal-templates`
- `POST /api/health/meal-templates`
- `PATCH /api/health/meal-templates/:mealTemplateId`
- `POST /api/health/meal-logs`
- `PATCH /api/health/meal-logs/:mealLogId`

Extend them compatibly.

### 4. Health summary integration

The current Health basics route should become planning-aware without becoming a planner endpoint.

Add enough support so the frontend can render today’s planned meals while staying on `/health`.

Recommended approach:

- extend `HealthSummaryResponse` with a compact `plannedMealsToday` collection
- include enough data for meal logging shortcuts:
  - `mealPlanEntryId`
  - template or title
  - meal slot
  - servings
  - note

Do not dump the full weekly planner payload into the summary response.

## Save Semantics And Business Rules

### 1. Week ownership

All meal-planning records are per-user.

Validation must reject:

- another user’s template references
- another user’s week records
- another user’s meal-plan entries
- another user’s prep-linked tasks

### 2. Week persistence

The canonical unit of planning is the week keyed by `startDate`.

Recommended save behavior:

- create the week record if missing
- replace or reconcile planned entries for that week deterministically
- replace or reconcile prep sessions deterministically
- regenerate planned grocery rows deterministically
- preserve manual grocery rows unless explicitly removed by payload

Use transactions for week save.

### 3. Grocery generation

For v1, use simple deterministic aggregation:

- gather ingredients from all planned entries with templates
- aggregate rows only when normalized `name` and normalized `unit` match exactly
- keep different units as separate rows
- propagate `section` when consistent; otherwise allow null or a fallback

Do not introduce unit conversion or pantry subtraction in this enhancement.

### 4. Prep-task linkage

Prep sessions should create or update linked tasks.

Recommended behavior:

- on prep-session create, create a task with `originType = meal_plan`
- title should come from the prep session title
- notes may come from the prep-session notes
- `scheduledForDate` should match `scheduledForDate`
- store the linked `taskId` on the prep session

On prep-session update:

- update the linked task when title, notes, or date changes

On prep-session removal:

- do not hard-delete unrelated tasks
- either archive or drop the linked task only if it is still clearly owned by this prep session
- keep this logic deterministic and safe

### 5. Planned meal completion semantics

Do not add a new completion boolean on `MealPlanEntry` if it can be derived.

Recommended v1 behavior:

- a planned meal is considered executed if at least one `MealLog` links to its `mealPlanEntryId`

This keeps execution truth in the log system.

## Migration Requirements

The migration must preserve current user data.

Required outcomes:

- all existing `MealTemplate` records continue to load
- existing `MealLog` records remain valid
- new meal-planning tables start empty without requiring backfill
- new nullable fields default safely

If a Prisma enum is extended for task origin type, make sure every mapper and validator is updated in the same change set.

## Validation Requirements

Use strict validation for:

- ISO week start date
- meal-slot values
- UUID ownership references
- numeric fields such as servings and minutes
- ingredient arrays and instruction arrays
- grocery rows and source types

Reject empty required titles such as:

- meal template name
- prep session title

Normalize optional text cleanly.

Use user-safe error messages.

## Recommended Backend File Touchpoints

Likely areas:

- `server/prisma/schema.prisma`
- `server/src/modules/health/routes.ts`
- `server/src/modules/health/summary-builder.ts`
- `server/src/modules/planning/planning-mappers.ts`
- `server/src/modules/planning/task-routes.ts`
- `packages/contracts/src/health.ts`
- `packages/contracts/src/planning.ts`

If health routing becomes too large, split meal-planning-specific serialization and validation into focused module files under `server/src/modules/health`.

## Testing Requirements

Add or update backend tests to cover:

- richer meal-template create and update behavior
- week save and reload behavior
- ownership validation on template, entry, and task references
- grocery regeneration with manual row preservation
- prep-task creation and update behavior
- planned meal logging with `mealPlanEntryId`
- health summary inclusion of compact today-planned-meal data

Also verify migration-level safety where practical.

### Core scenarios

- save a week with multiple meal entries and reload it
- save a week with prep sessions and confirm linked tasks exist
- edit the prep session and confirm the linked task updates
- log a meal against a planned entry and verify linkage persists
- aggregate duplicate grocery ingredients by normalized name plus unit
- preserve manual grocery rows after plan resave

## Acceptance Criteria

The backend work is successful when:

- the app can persist and retrieve a weekly meal plan
- meal templates can store recipe-grade detail without breaking existing data
- prep sessions create or update Today tasks predictably
- grocery rows are generated deterministically from planned ingredients
- meal logs can link back to planned entries
- `/health` can expose today’s planned meals compactly
- contract and validation behavior are stable enough for the frontend to build against directly

## Non-Goals

Do not expand scope into:

- macro calculation engines
- calorie goals
- pantry stock and depletion
- grocery pricing
- vendor integrations
- household permissions
- recommendation engines

## Coordination With Frontend

Assume frontend owns:

- layout
- hierarchy of sections
- responsive behavior
- detailed interaction design

Backend must provide:

- clean canonical payloads
- deterministic save behavior
- clear validation failures
- enough summary state for the frontend to stay thin

Do not force the frontend to invent hidden planner rules client-side.
