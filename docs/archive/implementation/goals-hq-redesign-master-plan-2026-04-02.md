# Goals HQ Redesign Master Plan

## Session Prompt

```text
You are continuing the Goals HQ redesign for Life OS. Your job is to turn the current lightweight goals page into the flagship planning workspace of the product. Keep the system calm, minimal, and modern, but materially more powerful. The target outcome is a connected planning system where long-range direction can break down into lower layers, weekly and monthly planning stay linked to real goals, and Today remains the execution surface.
```

## Why This Document Exists

This document is the main handoff for a new implementation session.

It captures:

- what exists now
- what is confusing in the current goals experience
- the product decisions that are now locked
- the exact enhancement we are building
- the boundaries between frontend and backend work

This redesign is not a cosmetic polish pass.

It is a structural upgrade that makes the goals area a real planning headquarters instead of a page with separate goal cards, weekly priorities, and monthly focus widgets.

## Current State Summary

Today, the goals page already provides real value, but it is still an MVP surface.

Current strengths:

- goals can be created, edited, filtered, and grouped
- goals can have milestones
- goals can link to tasks, habits, weekly priorities, monthly outcomes, and Today priorities
- the backend computes goal health, progress, momentum, and next-best-action
- weekly and monthly planning already exist as real planning-cycle data

Current product gaps:

- there is no long-range planning ladder
- there is no parent-child goal hierarchy
- domains are hard-coded and not user-manageable
- the page presents planning as separate pieces instead of a connected system
- review flows do not fully preserve or expose goal links
- the page still feels like "Active Pursuits" instead of clear goals headquarters

## Core Product Decisions

These decisions are now locked for this enhancement.

### 1. Goals becomes the flagship planning workspace

The `/goals` route is the ownership surface for planning.

It should become the place where the user:

- defines planning structure
- sees long-range direction
- breaks down larger goals into lower layers
- aligns current monthly and weekly planning with those goals

Reviews remain separate routes, but they must edit the same planning system that Goals owns.

### 2. The page uses two modes

The route should support two modes, similar in spirit to the Today page's execute/plan split:

- `Overview`
- `Plan`

`Overview` is for scanning and light management.

`Plan` is for hierarchy, breakdown, alignment, and planning control.

### 3. The planning model is a flexible hierarchy

The system must support a flexible chain such as:

- life vision
- long-range goal
- yearly goal
- quarterly goal
- monthly goal

But the chain is optional.

The user must be able to skip layers.

Examples that must be supported:

- Life Vision -> 5-Year -> 1-Year -> Quarter -> Month
- Life Vision -> 1-Year -> Month
- 1-Year -> Month
- standalone monthly goal

### 4. Domains become user-manageable

The current built-in domains remain the seeded defaults, but the user must be able to:

- add a domain
- rename a domain
- reorder domains
- archive or remove domains safely

This domain customization applies to Goals only.

It does not become the shared taxonomy for reviews, scoring, or the rest of the app in this enhancement.

### 5. Horizon templates become user-manageable

The default planning layers should start as:

- Life Vision
- 5-Year
- 1-Year
- Quarter
- Month

But the user can:

- rename layers
- reorder layers
- disable layers
- add layers
- change duration-based layers such as 5-Year into 3-Year or 2-Year

Planning cycles for week and month continue to exist regardless of how the user edits the hierarchy template.

### 6. Breakdown is guided manual, not autopilot

The system should help the user break bigger goals into lower layers, but it should not auto-generate final plans and save them without review.

The product behavior for this enhancement is:

- show the next sensible layer
- prefill drafts using parent context
- let the user confirm or edit everything before save

There is no AI planning engine in this scope.

### 7. Today remains the execution surface

The final planning chain is:

- Goals defines direction and structure
- Reviews refine the next cycle
- Today runs the actual day

Goals should link into Today more clearly, but Goals does not replace Today.

## What The User Should Feel After This Redesign

After the redesign, a user should be able to say:

- "I know where my domains came from, and I can manage them."
- "I can see my bigger direction, not just isolated goals."
- "I can break a big goal into smaller connected goals."
- "My monthly and weekly plans are clearly linked to the goals they support."
- "When I am deciding what to do this week, the app gives me context instead of making me think from scratch every time."

## Target User Experience

### 1. Overview mode

Overview mode is the lighter operational layer.

It should allow the user to:

- scan active goals quickly
- filter by domain, status, and horizon
- see health, progress, and next-best-action
- open goal details
- create and edit goals
- manage active and inactive goals

Overview mode can still use grouping, but it should be easy to understand.

It should not make domains feel like a hidden system-defined mystery.

### 2. Plan mode

Plan mode is the actual goals HQ.

It should make the planning system legible.

Plan mode should include:

- a horizon roadmap or layered planning view
- the selected goal's parent-child context
- a clear selected-goal inspector
- milestone management
- breakdown actions into lower layers
- monthly alignment
- weekly alignment
- Today alignment signals

Plan mode should answer:

- what is the bigger goal?
- what lower-layer goals support it?
- what is the current monthly push?
- what is the current weekly commitment?
- what is already represented in Today?

### 3. Weekly and monthly planning behavior

Weekly priorities and monthly focus remain planning-cycle records.

They should no longer feel like detached widgets.

They must:

- visibly link to goals
- show the parent planning context
- be editable from Goals Plan mode
- be editable from Reviews
- stay in sync between those surfaces

### 4. Reviews relationship

The review pages stay in the app.

They should not be deleted or merged into Goals.

But they must no longer behave like disconnected prompt forms.

Required relationship:

- weekly review edits the same next-week priorities seen in Goals
- monthly review edits the same next-month theme and outcomes seen in Goals
- both review surfaces must preserve goal links
- both review surfaces should include a clean path back into Goals Plan mode

### 5. Settings relationship

Settings becomes the management surface for:

- goal domains
- horizon templates

Goals may also provide lightweight entry points such as:

- "Manage domains"
- "Manage planning layers"

But the persistent configuration home is Settings.

## Scope Of This Enhancement

In scope:

- Goals route redesign into Overview and Plan modes
- user-manageable goal domains
- user-manageable planning horizons
- parent-child goal hierarchy
- optional life-to-month planning ladder
- linked monthly and weekly planning inside Goals
- review flow updates so goal links are preserved
- clearer settings ownership for domains and horizons
- better deep-linking and clearer goals language

Out of scope:

- finance-goal sync
- numeric or currency-based goal measurement models
- cross-app domain taxonomy beyond Goals
- AI-generated planning
- trophy room or celebration system
- separate dedicated Planning route

## Information Architecture

### Route ownership

- `/goals` owns the planning workspace
- `/reviews/weekly` and `/reviews/monthly` remain review routes
- `/today` remains the day execution route
- `/settings` owns persistent configuration of domains and planning layers

### Goals route modes

- `Overview`: scan, filter, manage, inspect
- `Plan`: structure, break down, align, connect

### Planning entities

The planning model for this enhancement is:

- user-defined goal domains
- user-defined goal horizons
- goal nodes that can optionally have a parent
- milestones attached to any goal node
- weekly priorities that can link to any goal node
- monthly outcomes that can link to any goal node

## Data And Behavior Rules

### Domains

- every goal belongs to one goal domain
- domains are per-user records, not hard-coded enums
- current built-in domains are seeded as defaults for each user
- a domain can be archived so it stops appearing in new-goal pickers
- a domain in use cannot simply disappear and orphan goals

### Horizons

- horizons are per-user records
- a horizon can represent open-ended vision or a time span
- horizon usage is optional on a goal
- goals can exist without a horizon if the user wants a simpler structure
- child goals should usually sit on a lower horizon than the parent, but the system should not hard-block edge cases if data remains valid

### Hierarchy

- a goal can have zero or one parent goal
- a goal can have many child goals
- root goals remain valid
- legacy flat goals remain valid after migration
- hierarchy depth is not fixed, but default UX should guide users through the configured horizon order

### Progress

For this enhancement, progress remains milestone-based.

We are not changing goal measurement models yet.

That keeps the redesign focused on planning structure and linked planning behavior.

### Weekly and monthly links

- weekly priorities keep optional `goalId`
- monthly outcomes must also keep optional `goalId`
- review flows must stop discarding those links

## Backend And Frontend Division Of Work

Frontend owns:

- final page composition
- mode UX
- hierarchy browsing interactions
- breakdown flows
- review editor UX
- settings surfaces for domains and horizons
- detailed visual design and motion

Backend owns:

- schema changes
- migration safety
- contracts
- validation
- hierarchy persistence
- config persistence
- workspace payloads
- review flow data integrity

## Acceptance Criteria

The redesign is complete when all of the following are true:

- the Goals route clearly presents `Overview` and `Plan` modes
- users can manage goal domains in Settings
- users can manage planning layers in Settings
- goals can be assigned to configurable domains instead of hard-coded enum values
- goals can optionally belong to a hierarchy through parent-child links
- the default hierarchy template starts with Life Vision, 5-Year, 1-Year, Quarter, Month
- users can rename or reconfigure those layers
- monthly focus and weekly priorities are clearly linked to goals in Goals Plan mode
- weekly review preserves linked goals when setting next-week priorities
- monthly review preserves linked goals when setting next-month outcomes
- existing users keep their goals safely after migration
- legacy flat goals remain visible and editable
- the page no longer feels like separate disconnected planning widgets

## Recommended Delivery Order

1. Backend foundation:
   domains, horizons, goal hierarchy schema, migrations, contracts, workspace payloads
2. Frontend settings and data wiring:
   domain management, horizon management, updated API clients
3. Goals route redesign:
   mode toggle, Overview mode cleanup, Plan mode structure
4. Goal detail and breakdown behaviors:
   hierarchy navigation, child creation, milestone and link visibility
5. Review integration:
   weekly and monthly review editors that preserve goal links
6. Final QA and copy cleanup:
   language, empty states, compatibility, migration verification

## Risks To Watch

- migration complexity from enum domains to per-user domain records
- preserving existing goal links during contract changes
- letting horizon customization stay flexible without making the UX confusing
- keeping Goals powerful without turning it into a heavy project-management tool

## Explicit Defaults

Use these defaults unless implementation reveals a hard blocker:

- Goals owns planning structure
- Reviews remain separate
- Today remains execution
- domain customization is Goals-only
- horizon customization is per-user and editable
- progress remains milestone-based for this enhancement
- planning guidance is deterministic and user-confirmed, not AI-generated

