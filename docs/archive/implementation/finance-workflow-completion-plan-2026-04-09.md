# Finance Workflow Completion Plan

Date: 2026-04-09

Source: `docs/implementation/application-gap-analysis-2026-04-07.md`

Priority: P0

Scope: complete the missing bills-and-payments workflow in `Finance` so users can create, manage, pay, and reconcile obligations without leaving the core flow.

---

## Why This Plan Exists

The current finance experience has the right ingredients but the wrong completion loop.

Today the app can:

- manage recurring bill templates
- materialize pending bill items
- mark bills paid, reschedule them, or dismiss them
- log expenses separately

What it still cannot do well is let the user run bills and payments as one coherent workflow.

This plan exists to close that gap first because it is the highest-value product improvement called out in the application gap analysis.

## Problem Statement

Finance currently splits one user job across multiple concepts and screens:

- a bill can exist without a matching expense
- a payment can be implied without being modeled clearly
- one-off bills are weaker than recurring-generated bills
- the UI asks the user to remember reconciliation work the system should support directly

That creates friction in a productivity app that is supposed to reduce mental load.

## Target User Outcome

After this enhancement, a user should be able to say:

- "I can add a bill when I know it exists."
- "When I pay a bill, I can log the spend in the same flow."
- "I can see which paid bills are fully reconciled and which still need cleanup."
- "Finance feels like a money operations surface, not separate bill and expense tools."

## Product Decisions

These decisions should stay fixed unless implementation reveals a hard constraint:

### 1. Manual bill creation is a first-class action

Users must be able to create a one-off bill directly from `Finance` without going through recurring setup.

### 2. Pay-and-log is the primary completion path

When a bill is handled, the default happy path should record payment and expense details together.

### 3. Mark-paid-without-log remains available, but secondary

This is still useful for edge cases, but it should be clearly presented as an exception path.

### 4. Bill reconciliation status must be visible

Users should be able to tell whether a bill is:

- due
- paid and linked to an expense
- paid without a linked expense

### 5. Recurring bills stay in scope, but the workflow is centered on obligations

Recurring templates remain important, but the product should feel organized around actual obligations and payment follow-through.

## Implementation Scope

In scope:

- manual bill creation from the Finance page
- combined `Pay and log expense` flow
- explicit secondary `Mark paid only` flow
- linked status between bill records and expense records
- clear bill detail and list-state messaging
- recurring bill setup surfaced as part of the finance management model

Out of scope:

- bank sync
- multi-account ledger features
- reimbursement workflows
- subscription intelligence beyond bill handling
- tax or accounting exports

## Suggested Domain Shape

The implementation should make one thing explicit: a bill is an obligation, and payment completion may create or link to an expense.

Recommended model behavior:

- keep recurring template support
- keep pending bill instances or equivalent actionable bill records
- add first-class manual bill creation for one-off obligations
- support linking a bill to a logged expense record
- persist whether a bill was completed with or without linked spend logging

Important architectural rule:

- do not bury bill-expense reconciliation only in frontend state
- the backend should expose explicit linked status so Home, Today, notifications, and scoring can use the same truth

## API And Contract Changes

Expected contract additions or updates:

- create manual bill endpoint or mutation
- complete bill with payment details and optional expense payload
- complete bill without expense logging
- bill list/detail response fields for linked expense status
- optional bill reference on expense records where applicable

Recommended response fields:

- `status`
- `dueDate`
- `expectedAmount`
- `paidAt`
- `linkedExpenseId`
- `completionMode`

## Frontend Plan

### Finance Page

Add or strengthen these primary actions:

- `Add bill`
- `Pay and log`
- `Mark paid only`
- `Reschedule`

The bill list should make state legible without opening a separate screen for every item.

Suggested UX expectations:

- one-off bill creation is available from the main Finance action lane
- due and overdue items show the next relevant action inline
- paid items show whether they are reconciled
- recurring management is reachable through a clear `Manage recurring bills` entry point

### Quick Capture

Quick Capture should not be the primary place for full bill management, but it should eventually be able to launch targeted finance flows once the bill model is complete.

That follow-up can wait until the core finance flow is stable.

## Backend Plan

Backend work should center on making bill completion reliable and explicit.

Areas likely affected:

- finance service and routes
- contracts for bill and expense actions
- data model support for bill-to-expense linking
- scoring hooks that depend on same-day logging and due-item handling

Implementation principles:

- completion operations should be idempotent where possible
- validation should block duplicate or contradictory bill completion states
- expense linking rules should be explicit and testable

## Delivery Phases

### Phase 1: Domain and contract baseline

- define the bill completion model
- add manual bill creation
- add bill-to-expense link fields and API support

### Phase 2: Primary Finance UI flow

- add `Add bill`
- add `Pay and log expense`
- add visible reconciliation states in the bill list

### Phase 3: Secondary actions and cleanup

- support `Mark paid only` as secondary flow
- refine empty states and management entry points
- ensure recurring bills fit the same mental model

### Phase 4: Cross-surface integration

- expose linked bill state to Today, Home, notifications, and scoring flows as needed

## Acceptance Criteria

- A user can create a one-off bill directly from `Finance`.
- A user can complete a bill and log the matching expense in one flow.
- A user can mark a bill paid without logging an expense, but that path is visibly secondary.
- The UI shows whether each paid bill has a linked expense.
- Backend responses expose linked bill-payment-expense state without frontend inference.
- Existing recurring bill behavior continues to work after the new model lands.

## Risks And Watchouts

- If payment semantics are underspecified, the UI will drift back into implied state.
- If bill-expense linking is optional everywhere, reconciliation will stay weak.
- If recurring and manual bills use different list behavior, the experience will feel fragmented again.

## Success Metrics

- higher percentage of paid bills with a linked expense
- lower time-to-complete for due bill handling
- reduced number of paid-but-unreconciled bill records
- increased use of direct bill handling inside `Finance`
