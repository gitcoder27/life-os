# Goals Page Review

Date: 2026-03-29

## Scope

This review covers the shipped goals experience in the app today, the workflow around goals, and the next set of improvements that would create the biggest product gain with the least confusion.

## Executive Summary

The goals page is already stronger than a simple goal list. It supports:

- monthly focus editing
- weekly priority editing
- active and inactive goal management
- milestone tracking
- goal health and momentum signals
- linked work visibility across priorities, tasks, and habits

The main weakness is not missing data. The main weakness is conversion. The app already knows when a goal is drifting and already computes a recommended next step, but until now the goals page mostly showed that advice instead of helping the user act on it immediately.

Because of that, the best next improvement was to make the goals page operational, not just informational.

## What The Goals Page Already Has

### 1. Planning context on the page

The page includes two planning surfaces above the goal list:

- Monthly focus
  - monthly theme
  - up to three top outcomes
  - drag-and-drop ordering
  - optional linking of each outcome to a goal
- Weekly priorities
  - up to three weekly priorities
  - drag-and-drop ordering
  - optional linking of each priority to a goal

This is good because it keeps longer-term direction and short-term planning on the same screen.

### 2. Goal management basics

Users can already:

- create a goal
- edit a goal
- set domain
- set target date
- add notes
- filter by domain
- filter by status
- reactivate inactive goals

That gives the page the basic shape of a usable planning surface.

### 3. Strong summary cards for active goals

Each active goal card already shows more than a title:

- life area / domain
- target date
- health state
- percent progress
- milestone completion count
- overdue milestone count
- linked item count
- due habit count
- momentum trend
- recommended next action

This is useful because it turns goals into something the user can scan rather than something they need to open one by one.

### 4. Goal detail view

The detail panel already gives real depth:

- milestone list
- inline milestone editing
- milestone quick-complete
- linked priorities
- linked tasks
- linked habits
- notes

This is enough to make the page meaningful, not just decorative.

### 5. Good backend intelligence

Behind the scenes, the app already calculates:

- progress from milestone completion
- health states: on track, drifting, stalled, achieved
- recent momentum over four weekly buckets
- next best action
- linked workload counts across today, week, month, tasks, and habits

This is important because the recommendation engine already exists. The page does not need more analytics before it becomes useful. It needs better action handling.

## Where The Current Experience Breaks Down

### 1. Advice is shown, but not operationalized

The page could tell the user:

- this goal is drifting
- this milestone is overdue
- this is the next best action

But it did not let the user turn that recommendation into today’s work from the same screen. The user still had to mentally carry that advice into another page.

That is the highest-friction gap in the current experience.

### 2. The workflow is still browse-first instead of exception-first

The page shows a lot of useful information, but it does not strongly answer:

- which goals need attention first
- which weekly or monthly commitments are not represented in Today
- which active goals are not currently flowing into execution

So the user can understand the system, but the system is still making the user decide where to look first.

### 3. Maintenance actions are slower than they should be

Several interactions still feel heavier than the rest of the app:

- goal linking in planning editors uses basic selects instead of the existing searchable goal picker pattern
- active goals do not expose fast lifecycle controls such as pause, complete, or archive from the detail view
- linked work is visible but still mostly read-only from the goal detail panel

That slows down routine upkeep.

## Top Three Recommended Upgrades

### 1. Make goal advice executable from the goals page

#### Why this is the top priority

This is the biggest user-value gap with the clearest path to improvement.

The app already computes a recommended next action for each active goal. If the user has to leave the page to act on it, the goals page becomes a dashboard instead of a control surface.

#### What should change

- Let a user push a goal’s recommended next step into Today directly from the goal detail view.
- Keep the action safe:
  - do not duplicate a goal that is already in Today
  - do not silently overwrite a full priority stack
  - give the user a direct path to open Today when the stack is full

#### What was implemented now

The goal detail panel now includes a "Move Into Today" action area.

It:

- checks today’s current priority stack
- prevents accidental overwrite if Today cannot be read
- prevents duplicate linking if the goal is already present
- adds the recommended next step into Today when there is space
- gives the user a direct "Open Today" path alongside the action

#### Why this should help

This closes the gap between planning and execution. It should make goals feel connected to daily work instead of existing beside it.

#### Next follow-up after this

- add a secondary action to create a linked task when Today’s priority stack is full
- allow this same action from the goal card itself, not only the detail panel

### 2. Change the goals workflow to be exception-first

#### Problem

Right now the page is informative, but the user still has to interpret the whole screen to figure out where attention is needed.

#### Recommended workflow change

The page should default to showing the highest-risk and least-represented goals first.

That means:

- stalled and drifting goals should rise above healthy goals
- goals with overdue milestones should rise above goals with clean plans
- goals that are not represented in this week or in Today should be called out explicitly

#### Concrete upgrades

- add a "Needs attention" view or default sort
- show representation badges such as:
  - not in weekly priorities
  - not in monthly focus
  - not in Today
- after editing weekly or monthly plans, prompt the user to carry one item forward into Today

#### Why this matters

This changes the page from "review all goals" to "resolve the few goals that need intervention." That is a much better planning workflow.

### 3. Reduce upkeep friction in the goals workflow

#### Problem

The page has strong data, but routine maintenance is still slower than it should be.

#### Recommended upgrades

- replace basic goal dropdowns in planning editors with the app’s searchable goal picker pattern
- add quick lifecycle actions in the goal detail view:
  - pause
  - mark complete
  - archive
- make linked items more actionable:
  - jump to Today for linked priorities
  - jump to Inbox or task views for linked tasks
  - jump to Habits for linked habits

#### Why this matters

If goals are going to stay current, updating them has to feel lightweight. Otherwise the page becomes accurate only when the user has extra patience.

## Recommended Priority Order

1. Make recommended next steps executable from the goals page.
2. Shift the page to exception-first triage and representation gaps.
3. Speed up maintenance work with better linking and lifecycle actions.

## Final Assessment

The goals page is already a solid foundation. It is not missing structure. It is missing a stronger operational loop.

The highest-value change is to keep the user on the goals page while they turn a recommendation into actual work. That is now in place.

The next wave should focus on two things:

- surfacing the right goals first
- making ongoing goal maintenance faster and lighter
