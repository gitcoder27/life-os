# Summary-To-Action Continuity Plan

Date: 2026-04-09

Source: `docs/implementation/application-gap-analysis-2026-04-07.md`

Priority: P1

Scope: reduce friction between summary surfaces and completion flows so users can act directly from Home, Today, notifications, and domain summaries.

---

## Why This Plan Exists

Life OS is already good at surfacing what matters.

The gap is that many of those surfaces stop at awareness:

- the user sees the issue
- the app points to a generic page
- the user has to find the exact item again before acting

That breaks the action-first promise of the product.

This plan exists to make summary surfaces operational instead of merely informative.

## Problem Statement

Across the app, summary surfaces often rely on shallow handoffs:

- generic links to a domain landing page
- no direct completion action for known next steps
- extra scanning after navigation

The result is avoidable context switching, especially in daily workflows where speed matters most.

## Target User Outcome

After this enhancement, a user should be able to say:

- "When the app shows me something important, I can usually handle it right there."
- "If I need more context, I land on the exact item, not the top of a page."
- "Today, Home, and notifications feel connected to execution rather than reporting."

## Product Decisions

These decisions should anchor the work:

### 1. Known next actions should be executable from summary surfaces

If the app already knows the task, bill, or review action, it should offer direct completion where practical.

### 2. Full-page navigation should be entity-specific

When a larger workspace is needed, navigation should deep-link to the relevant item or filtered view.

### 3. Generic landing-page hops are the fallback, not the default

Users should not repeatedly re-find the same item after clicking from a summary.

### 4. Finance is the first proving ground

The finance summary flows have the clearest measurable value and should be improved first.

## Implementation Scope

In scope:

- Today finance summary actions
- Home summary deep links for known entities
- notification actions that land on exact items or execute lightweight actions directly
- consistent handoff rules for summary cards and domain panels

Out of scope:

- a full redesign of Home or Today
- broad notification platform changes
- offline action handling

## Continuity Rules

Every summary surface should choose one of these handoff levels intentionally:

### Level 1: Direct completion

Use this when the action is simple, safe, and already well understood.

Examples:

- mark bill handled
- open a targeted pay-and-log flow
- complete a lightweight admin item

### Level 2: Deep-link into full context

Use this when the user needs more context or a richer workspace.

Examples:

- open Finance with the exact bill selected
- open Goals with the exact goal or review context active
- open Today with the exact task highlighted

### Level 3: Generic navigation

Use this only when the destination cannot be determined precisely.

## Finance First

Finance should be the first domain to adopt the continuity rules.

Immediate target improvements:

- replace generic `/finance` summary links with bill-specific action paths
- let Today finance panels offer a meaningful next action, not just awareness
- connect notifications to the exact bill or finance item they refer to

## Frontend Plan

Frontend work should define reusable summary-action patterns instead of solving each card ad hoc.

Expected work:

- add entity-aware deep links
- support inline action affordances where safe
- standardize how summary cards represent `view`, `fix`, and `complete` states
- reduce duplicate scanning after navigation

Design principle:

- summary cards should feel lighter than full workspaces, but they should not feel dead-ended

## Backend And Contract Plan

Backend and contracts may need to expose stronger entity references so summary surfaces can act precisely.

Likely support needs:

- stable IDs and targetable routes for actionable entities
- lightweight mutation endpoints for safe direct completion flows
- richer notification payloads that identify the exact target item

The frontend should not infer deep-link semantics from brittle string matching or list position.

## Delivery Phases

### Phase 1: Handoff audit and rule definition

- catalog summary surfaces that currently route generically
- define which actions qualify for direct completion versus deep-linking

### Phase 2: Finance continuity pass

- improve Today finance actions
- add exact bill deep links from Home and notifications
- connect finance summaries to the new Finance completion flow

### Phase 3: Cross-domain rollout

- apply the same continuity rules to other actionable summaries where the next step is already known

### Phase 4: Cleanup and consistency

- remove outdated generic links where precise handoffs now exist
- unify copy and affordance patterns across the app

## Acceptance Criteria

- Today finance summaries offer at least one meaningful completion action.
- Home and notification finance links land on the exact relevant entity or flow.
- Generic domain landing-page hops are reduced where the next action is already known.
- Summary cards follow a consistent rule for direct action versus deep-linking.
- Users can move from awareness to action with fewer page transitions in key daily flows.

## Risks And Watchouts

- Too many inline actions can make summary surfaces feel overloaded.
- Deep links without stable backend identifiers will be brittle.
- If each feature invents its own handoff logic, continuity will improve locally but remain inconsistent system-wide.

## Success Metrics

- fewer clicks from summary view to task completion
- higher completion rate from Today and notification entry points
- lower bounce rate from summary cards into generic landing pages
- faster resolution time for finance admin items
