# Goals HQ Redesign Backend Agent Brief

## Backend Agent Prompt

```text
You are the backend implementation agent for the Goals HQ redesign in Life OS. Your mission is to provide the data model, migration path, contracts, validation, and route behavior that turn the current flat goals system into a configurable planning system. You are building the foundation that lets Goals become the flagship planning workspace while preserving existing user data and keeping weekly, monthly, and Today planning linked to real goals.
```

## Big Picture

The frontend redesign depends on the backend being decision-complete.

Your job is to make the following product behavior real:

- domains are no longer hard-coded enums
- planning layers are user-managed
- goals can be connected through parent-child hierarchy
- legacy goals survive migration cleanly
- weekly and monthly planning keep goal links end to end
- Goals can load from a workspace-oriented backend payload instead of stitching unrelated endpoints

This enhancement is not about analytics or finance integration.

It is about planning structure, planning ownership, and data integrity.

## Product Decisions Already Locked

Do not reopen these.

- Goals owns planning structure
- the Goals route has `Overview` and `Plan` modes
- domains are user-managed but Goals-only
- planning layers are user-managed and per-user
- hierarchy is flexible, not strict
- guided manual breakdown is the product behavior
- weekly and monthly planning remain planning-cycle data
- reviews stay separate routes but must edit the same planning data
- Today remains execution
- progress stays milestone-based in this enhancement

## Current Backend Context

Current main backend areas:

- `server/prisma/schema.prisma`
- `server/src/modules/planning/goal-routes.ts`
- `server/src/modules/planning/plan-routes.ts`
- `server/src/modules/planning/planning-schemas.ts`
- `server/src/modules/planning/planning-mappers.ts`
- `server/src/modules/planning/goal-overviews.ts`
- `server/src/modules/planning/planning-repository.ts`
- `server/src/modules/reviews/routes.ts`
- `server/src/modules/reviews/review-service/weekly-reviews.ts`
- `server/src/modules/reviews/review-service/monthly-reviews.ts`
- `packages/contracts/src/goals.ts`
- `packages/contracts/src/planning.ts`
- `packages/contracts/src/reviews.ts`
- `packages/contracts/src/settings.ts`

Current constraints:

- goals use a hard-coded enum domain
- goals are flat records with milestones
- weekly review already accepts `goalId` for priorities
- frontend currently drops those links
- monthly review still seeds next month outcomes with `goalId: null`
- settings has no planning configuration model

## Required Backend Design

### 1. Replace enum domains with per-user domain records

Implement normalized per-user goal domains.

Recommended model:

#### `GoalDomainConfig`

- `id`
- `userId`
- `systemKey` nullable
- `name`
- `sortOrder`
- `isArchived`
- `createdAt`
- `updatedAt`

Behavior rules:

- seed one record per current built-in domain for each user with `systemKey`
- allow custom domains with `systemKey = null`
- `name` is user-facing and editable
- `sortOrder` controls display order
- `isArchived` hides the domain from normal pickers but does not break existing goals

Migration rules:

- create user-specific domain records for every user who has goals
- map every existing goal enum domain to the corresponding seeded domain record
- remove enum-based domain usage from contracts and route logic once backfill is complete

### 2. Add per-user planning-layer records

Implement normalized per-user planning horizons.

Recommended model:

#### `GoalHorizonConfig`

- `id`
- `userId`
- `systemKey` nullable
- `name`
- `sortOrder`
- `spanMonths` nullable
- `isArchived`
- `createdAt`
- `updatedAt`

Behavior rules:

- seed default records for:
  - Life Vision (`spanMonths = null`)
  - 5-Year (`spanMonths = 60`)
  - 1-Year (`spanMonths = 12`)
  - Quarter (`spanMonths = 3`)
  - Month (`spanMonths = 1`)
- users can rename, reorder, add, or archive layers
- at least one active horizon record must remain
- horizons shape the hierarchy UI, but weekly and monthly planning cycles continue to exist independently

### 3. Extend goals into a hierarchy-capable node model

Update `Goal` so it can support hierarchy and richer planning context.

Recommended `Goal` additions:

- `domainId String`
- `horizonId String?`
- `parentGoalId String?`
- `why String?`
- `sortOrder Int`

Recommended relations:

- `domain -> GoalDomainConfig`
- `horizon -> GoalHorizonConfig`
- self relation for `parent` and `children`

Behavior rules:

- a goal may be root or child
- a goal may have no horizon
- a goal may have no parent
- a child goal must belong to the same user as the parent
- circular parentage must be rejected
- reparenting must reject descendant loops

Use `sortOrder` for sibling ordering and root ordering in Plan mode.

### 4. Keep progress logic unchanged for now

Do not add a new measurement model in this enhancement.

Progress should stay milestone-based.

Existing goal intelligence should continue to work after hierarchy changes.

If some intelligence needs light adaptation because of new fields, keep the logic focused on existing signals:

- milestones
- linked tasks
- linked habits
- linked priorities
- activity

## API And Contract Requirements

### 1. Goals config endpoints

Add explicit configuration endpoints for the planning system.

Recommended endpoints:

- `GET /api/goals/config`
- `PUT /api/goals/config/domains`
- `PUT /api/goals/config/horizons`

Recommended behavior:

- `GET` returns active and archived domain/horizon records needed by Settings and Goals
- `PUT` endpoints replace the current ordered set for that config type
- items omitted from the incoming payload:
  - may be hard-deleted if unused
  - otherwise should be archived rather than deleted

Keep validation strict and deterministic.

### 2. Goals workspace endpoint

Add a workspace-oriented endpoint so the frontend can load Goals HQ from a single coherent payload.

Recommended endpoint:

- `GET /api/goals/workspace?date=YYYY-MM-DD`

Recommended response contents:

- `contextDate`
- `domains`
- `horizons`
- `goals` as a flat array with hierarchy fields
- `weekPlan`
- `monthPlan`
- `todayAlignment`
- `sectionErrors` only if you intentionally preserve partial-load behavior

Return enough data for both Overview and Plan modes without requiring the page to stitch unrelated queries.

The frontend can build the tree from `parentGoalId`.

### 3. Goal CRUD contract updates

Update goal contracts and route validation so goal create and update flows support:

- `domainId`
- `horizonId`
- `parentGoalId`
- `why`
- `notes`
- `sortOrder` where needed for explicit reordering

Keep `targetDate`, `status`, milestones, and current linked summaries.

Goal detail responses should also expose:

- parent summary if present
- child summaries
- breadcrumb ancestry or ancestor list
- current linked weekly and monthly items
- current linked tasks
- current linked habits

### 4. Planning-cycle contract updates

Weekly and monthly planning should keep working through planning-cycle priorities.

Requirements:

- weekly priorities preserve `goalId`
- monthly outcomes preserve `goalId`
- workspace and detail payloads include linked goal summaries consistently

### 5. Review contract updates

#### Weekly review

The backend already accepts structured priorities with optional `goalId`.

Required work:

- keep this support intact
- ensure seeded next-week priorities return linked goals consistently where needed by the frontend
- do not let review logic strip or null out valid links

#### Monthly review

Monthly review must stop using text-only outcome submission.

Change the request and response contracts to use structured planning items for next-month outcomes.

Recommended contract update:

- replace `threeOutcomes: string[]` with `nextMonthOutcomes: PlanningPriorityInput[]`

Recommended submission behavior:

- store review reflection data as before
- update the next month cycle theme
- replace the next month cycle priorities using the structured linked outcomes
- preserve `goalId` for each outcome

If historical review payloads need a read-only record of these outcomes, store them as structured JSON objects rather than bare strings.

## Settings And Contract Placement

Do not overload the existing profile settings response with large editable planning collections.

Use dedicated goals-config endpoints for domains and horizons.

The Settings page can call those endpoints, but the planning configuration should remain owned by the planning/goals backend module.

## Repository And Service Changes

Expect work in these areas:

- Prisma schema and migration files
- planning schemas and mappers
- planning repository functions
- goal list and detail queries
- new config repository helpers
- new workspace query builder
- review schemas and review service logic
- contract package updates
- server tests across goals, planning, reviews, and settings-adjacent configuration behavior

## Migration Plan

Migration safety is critical.

Required migration sequence:

1. Create `GoalDomainConfig` and `GoalHorizonConfig`.
2. Seed domain and horizon records per user.
3. Add new nullable foreign keys to `Goal` during transition.
4. Backfill `Goal.domainId` from the old enum domain.
5. Set `Goal.sortOrder` deterministically for existing goals.
6. Leave `Goal.horizonId` and `Goal.parentGoalId` null for legacy goals.
7. Once backfill is safe, make `domainId` required.
8. Remove old enum-domain dependencies from code and contracts.

Compatibility rule:

- legacy goals must remain valid and visible immediately after migration

## Validation Rules

Implement validation for at least the following:

- domain names cannot be blank
- horizon names cannot be blank
- horizon count cannot exceed a reasonable cap such as 10
- domain count cannot exceed a reasonable cap such as 20
- `spanMonths` must be positive when present
- a goal cannot parent itself
- a goal cannot be reparented beneath its own descendant
- `domainId`, `horizonId`, and `parentGoalId` must all belong to the same user
- a domain or horizon referenced by goals cannot be hard-deleted silently
- planning priorities submitted from reviews must reference owned goals only

## Deterministic Guidance Rule

Do not build an AI recommendation service in this enhancement.

If a suggestion layer is needed, keep it deterministic and optional.

The backend does not need a dedicated breakdown-generator endpoint in v1 unless implementation proves it is truly required.

The frontend may create local drafts from parent context and configured horizons.

## Testing Requirements

Add or update tests for:

- migration-safe backfill of domain config and goal `domainId`
- goals config endpoints for domains and horizons
- hierarchy create and update rules
- invalid parent loops
- workspace endpoint shape
- goal detail responses with parent and children context
- weekly review preserving `goalId`
- monthly review preserving `goalId`
- planning-cycle replacements with linked goals
- authorization on config and goal references

Run at minimum:

- `npm run typecheck`
- `npm run test -w server`

If targeted test runs are needed while iterating, include goals, planning, reviews, and migration-sensitive coverage.

## Backend Acceptance Criteria

The backend work is complete when:

- domains are no longer hard-coded enums in active contracts
- per-user domain config exists and old goals are safely backfilled
- per-user horizon config exists
- goals can optionally reference parent and horizon
- the new goals workspace endpoint supports the redesigned page
- weekly planning preserves linked goals
- monthly planning preserves linked goals
- monthly review no longer forces goal links to null
- legacy goals remain valid after migration
- all relevant backend tests pass

## Explicit Defaults

Use these defaults unless a hard blocker is discovered:

- normalized tables for domains and horizons
- per-user seeded defaults
- hierarchy fields on `Goal`
- workspace endpoint under `/api/goals/workspace`
- dedicated goals-config endpoints rather than bloating `/api/settings/profile`
- milestone-based progress unchanged
- no AI planning endpoint in this enhancement

