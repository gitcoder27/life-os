# Goals Screen Review And Gap Analysis

## Purpose

This document reviews the current `/goals` screen in Life OS against the original vision for a true life-planning and execution system.

The goal of this review is to answer four questions clearly:

1. What already exists today?
2. What workflow is already connected across the app?
3. What is only partial or weak?
4. What should be implemented next, in order?

This review is based on:

- current frontend and backend code
- current product docs
- existing goal-focused backend tests

Goal-related backend tests currently pass:

- `server/test/modules/goal-insights.test.ts`
- `server/test/modules/goal-nudges.test.ts`

## Bottom Line

The current goals screen is a solid MVP planning surface, but it is not yet the full life-command system described in the original idea.

Right now it is strongest at:

- grouping goals by life area
- connecting goals to weekly and monthly planning
- pushing a goal into Today with a recommended next step
- linking habits and tasks to goals in the data model

Right now it is weakest at:

- long-range planning structure
- true progress measurement
- milestone authoring from the live screen
- financial goal integration
- goal review workflows
- making the goal page feel like the control center for life planning

The current product docs also confirm that this screen was intentionally scoped as a lightweight MVP surface, not a full project hierarchy yet. See:

- `docs/prd/screen-specs.md:322`
- `docs/prd/PRD.md:227`

## Current Product Intent

The current product spec describes the goals page as:

- “Hold direction without becoming a heavy project-management surface.”
- structurally simple
- focused on editing and planning, not deep analytics
- explicitly avoiding complex milestone trees in MVP

That means the current implementation is not random or unfinished in every area. Some of the gaps below are true missing features, and some are the result of the current MVP scope being much smaller than the original long-term vision.

## What Exists Today

### 1. Main goals page structure

The live goals page currently includes:

- a header labeled “Active Pursuits”
- domain filters
- active goals grouped by domain
- an inactive goals section
- inline create/edit goal form
- a collapsible weekly and monthly planning panel
- a right-side goal inspector panel when a goal is selected

Main frontend entry points:

- `client/src/features/goals/GoalsPage.tsx:344`
- `client/src/features/goals/GoalDomainSections.tsx`
- `client/src/features/goals/GoalInspectorPanel.tsx:242`

### 2. Goal data model

Each goal currently stores:

- title
- one domain
- status
- target date
- notes

Milestones are stored separately and support:

- title
- target date
- pending/completed state
- sort order

Current contract and schema:

- `packages/contracts/src/goals.ts:17`
- `packages/contracts/src/goals.ts:28`
- `server/prisma/schema.prisma:268`
- `server/prisma/schema.prisma:285`

### 3. Computed goal intelligence

The backend already computes useful goal signals:

- progress percent
- health state
- next best action
- milestone counts
- four-week momentum
- last activity date

This is one of the strongest parts of the current system.

Relevant code:

- `server/src/modules/planning/goal-insights.ts:43`
- `server/src/modules/planning/goal-overviews.ts:256`

### 4. Weekly and monthly planning

The goals page already supports:

- weekly priorities
- monthly theme
- monthly top outcomes
- drag-and-drop reordering for weekly and monthly planning
- optional goal linking for those items

Frontend:

- `client/src/features/goals/GoalsPage.tsx:697`
- `client/src/features/goals/SortablePlanningEditor.tsx`

Backend:

- `server/src/modules/planning/plan-routes.ts:152`
- `server/src/modules/planning/plan-routes.ts:473`
- `server/src/modules/planning/plan-routes.ts:515`

### 5. Today-page integration

This is the best integrated workflow in the current system.

The app already does all of this:

- derives a next-best action for a goal
- suggests a clean title for a Today priority
- offers “Add to Today” from the goals page
- shows carry-forward prompts from weekly or monthly planning
- generates goal nudges on the Today page for active goals not yet represented there

Relevant code:

- `client/src/features/goals/useGoalTodayAction.ts:23`
- `client/src/features/goals/GoalsPage.tsx:522`
- `client/src/features/goals/GoalsPage.tsx:556`
- `server/src/modules/planning/plan-routes.ts:80`

### 6. Task and habit linking

Tasks can link to a goal.

Habits can also link to a goal.

Habit UI already exposes goal selection:

- `client/src/features/habits/HabitsPage.tsx:122`

The backend includes linked tasks and linked habits inside goal details and uses them for goal insight calculations:

- `server/src/modules/planning/goal-routes.ts:109`
- `server/src/modules/planning/goal-overviews.ts:92`
- `server/src/modules/planning/goal-overviews.ts:141`

## Current Workflow, End To End

Here is the workflow that actually exists today:

1. Create a goal with a title, domain, target date, and notes.
2. Optionally link habits and tasks to that goal from other parts of the app.
3. Add the goal to weekly priorities or monthly outcomes.
4. Let the backend compute health, momentum, and the next recommended action.
5. Move the goal’s next step into Today through the goal page or Today-page nudges.
6. Complete tasks, milestones, priorities, and habits, which feed the goal’s activity and health signals.

This means the current system already bridges:

- goals -> week/month planning
- goals -> today priorities
- goals -> tasks
- goals -> habits

This is real value. The app is not just storing goals in isolation.

## Frontend Usability Review

### What feels good

- The page is simple enough to scan quickly.
- Grouping by domain helps reduce clutter.
- Weekly and monthly planning are easy to edit.
- The “Add to Today” bridge is very strong for execution.
- Goal cards give a quick sense of status without opening a detail screen.

### What feels weak or unfinished

- The page calls itself “Active Pursuits,” which weakens clarity for a screen that is really the goals HQ.
  - `client/src/features/goals/GoalsPage.tsx:589`
- The most important planning controls are tucked into a collapsible panel, which lowers their visibility.
  - `client/src/features/goals/GoalsPage.tsx:330`
- There is no search, no sort control, and no time-horizon filtering.
- There is no quick way to review all goals in sequence.
- The live inspector is much thinner than the backend data behind it.

### Important usability bugs or regressions

#### Dead edit button in the live inspector

The live goal inspector shows an edit icon, but it has no click behavior.

- `client/src/features/goals/GoalInspectorPanel.tsx:288`

This is a direct usability bug.

#### Milestone authoring is effectively missing from the live screen

The live inspector only lets you toggle existing milestones on and off.
If a goal has no milestones, the user only sees “No milestones defined yet.”

- `client/src/features/goals/GoalInspectorPanel.tsx:97`
- `client/src/features/goals/GoalInspectorPanel.tsx:122`

But there is already a richer milestone editor in an older, unused component that supports:

- add
- edit
- reorder
- delete
- toggle

- `client/src/features/goals/GoalDetailPanel.tsx:42`

The current goals page does not render that component:

- `client/src/features/goals/GoalsPage.tsx:860`

This means the backend supports milestone management, and the repo already has a UI for it, but the live screen does not expose it.

#### Linked tasks are fetched but not shown in the live inspector

The goal detail API includes linked tasks:

- `server/src/modules/planning/goal-routes.ts:136`
- `server/src/modules/planning/goal-routes.ts:190`

But the live inspector only shows:

- milestones
- linked habits
- linked priorities
- notes

It does not show linked tasks at all:

- `client/src/features/goals/GoalInspectorPanel.tsx:314`

That is a real gap because tasks are one of the main execution links in the system.

#### Active goal status management is not exposed properly

The API supports updating a goal’s status:

- `server/src/modules/planning/goal-routes.ts:200`

The page has a handler for status changes:

- `client/src/features/goals/GoalsPage.tsx:505`

But the live UI only exposes reactivation for inactive goals:

- `client/src/features/goals/GoalsPage.tsx:647`

There is no visible control to mark an active goal as paused, completed, or archived.

## Backend Usability Review

### What is strong

- The backend model is clean and practical for the current MVP.
- Goal routes are straightforward and validated.
- The insight engine already gives useful system behavior, not just raw storage.
- The Today page nudge system is a smart bridge between planning and execution.
- Tasks, habits, and priorities already share the same goal relation.

### What is limited

- The schema only supports flat goals plus milestones.
- There is no support for time horizons.
- There is no support for parent-child goal hierarchy.
- There is no support for metric types.
- There is no support for numeric targets or currency targets.
- There is no support for a dedicated “why” field.
- There is no support for financial goal sync.
- There is no support for manual review-based goal health states.

Current schema makes those absences clear:

- `server/prisma/schema.prisma:268`
- `server/prisma/schema.prisma:301`
- `packages/contracts/src/goals.ts:17`

## Comparison Against The Original Vision

| Vision area | Current status | Notes |
| --- | --- | --- |
| Time horizons | Missing | No lifetime, 10-year, 5-year, yearly, quarterly, or monthly horizon field exists in the goal model. |
| Life domains / pillars | Partial | Domains exist, but they are a fixed single-select list. This is useful, but still light. |
| North Star view | Missing | No top-of-page long-range view, pinned life direction, or vision board exists. |
| Milestone mapping | Partial | Backend supports milestones, but the live goals screen does not let the user build or manage them properly. |
| To-do linkage | Partial | Tasks can link to goals and influence insights, but linked tasks are not even shown in the live inspector. |
| Habit linkage | Partial | Habits can link to goals and affect insights, but there is no explicit success metric or progress formula tied to them. |
| Financial linkage | Missing | Finance has no goal relation or financial-goal target model at all. |
| Progress bars | Partial | Progress bars exist, but they only reflect milestone completion. |
| Quantitative vs qualitative metrics | Missing | There is no goal metric type such as number target, currency target, or manual completion state. |
| Status indicators | Partial | Health is auto-derived (`on_track`, `drifting`, `stalled`, `achieved`), but not manually reviewed or set by the user. |
| Dedicated “why” field | Partial | Notes exist, but the motivation is optional and not first-class. |
| Review mode | Partial | Reviews exist elsewhere in the app, but not as a goal-focused review mode on this screen. |
| Drag-and-drop prioritization | Partial | Weekly and monthly items support reordering. Goals themselves do not. |
| Frictionless goal entry | Missing | Quick capture has no goal type. |
| Celebrate wins | Missing | Completed goals just move into the inactive list. There is no trophy room or completion moment. |

## The Biggest Gaps

### Gap 1: The page is good at short-range execution, weak at long-range life planning

Your original idea needs a screen that connects:

- life vision
- time horizons
- milestones
- weekly and daily execution

The current screen only covers the lower half of that stack well:

- weekly planning
- monthly planning
- today execution
- habit/task links

It does not yet cover the upper half:

- north star direction
- horizon planning
- life architecture
- long-range sequencing

### Gap 2: Progress is not truly integrated

This is the most important systems gap.

Today, progress percent is calculated only from milestone completion:

- `server/src/modules/planning/goal-insights.ts:216`

Tasks, habits, and priorities do feed:

- activity
- momentum
- health
- next-best-action

But they do not move the progress bar directly.

That means the app already feels integrated, but the main goal progress signal is still much shallower than it looks.

This is directly below your original intent, where:

- task completion should advance goal progress
- habit consistency should feed goal success
- financial data should feed financial goals

### Gap 3: Milestones exist in the backend, but not in the real user experience

Milestones should be one of the most important parts of this screen.

Right now:

- they exist in the database
- they affect progress
- they affect health
- they affect next-best-action

But on the live screen the user cannot properly create or manage them.

This makes the goal system weaker than the backend actually allows it to be.

### Gap 4: Review workflows do not really feed goal planning deeply enough

The app has a reviews system, which is good.

But the current review flows are still weakly tied to goals:

- weekly review UI turns text into priorities without goal links
  - `client/src/features/reviews/ReviewsPage.tsx:589`
  - `client/src/shared/lib/api.ts:1737`
- the API already allows `goalId` for reviewed priorities
  - `server/src/modules/reviews/routes.ts:26`
- monthly review always seeds next month outcomes with `goalId: null`
  - `server/src/modules/reviews/review-service/monthly-reviews.ts:295`

So the system has some plumbing, but the goal loop is not fully closed.

### Gap 5: Finance is completely outside the goal system

This is a clear miss against your original design.

The finance page handles:

- spending
- categories
- recurring expenses

But there is no concept of:

- savings target goal
- amount-progress goal
- house fund
- debt payoff target
- investment goal sync

Relevant code:

- `client/src/features/finance/FinancePage.tsx:66`
- `server/prisma/schema.prisma:629`

### Gap 6: The current screen still feels like an MVP surface, not a flagship screen

For a screen that should help users plan their life, several details are too light:

- weak top-of-page identity
- no north star section
- no review mode
- no goal sequence view
- no deep edit flow inside the live inspector
- no completion celebration
- no goal quick-capture

## What Is Already Better Than A Basic Goal Tracker

To be fair to the current system, it already has a few strong ideas that should be kept and expanded:

1. Auto-derived goal health is useful.
2. Next-best-action is useful.
3. Today-page goal nudges are useful.
4. Weekly/monthly planning linked to goals is useful.
5. Habit and task relationships already create the foundation for a real execution system.

These are the pieces worth building on, not replacing.

## Recommended Implementation Order

## Phase 1: Fix the live goals experience first

These are the highest-value changes with the least system risk.

### 1. Restore full milestone management on the live goals screen

Why first:

- milestones already drive progress and health
- the backend already supports them
- the repo already contains a stronger milestone editor

What to do:

- replace or upgrade `GoalInspectorPanel`
- allow add/edit/reorder/delete milestones from the live screen
- keep quick toggle for completion

Expected impact:

- immediate improvement to usability
- immediate improvement to progress accuracy

### 2. Make the inspector a real control panel

What to add:

- working edit action
- active status controls: pause, complete, archive
- linked tasks section
- visible health and progress summary
- visible next-best-action

### 3. Make the “why” first-class

What to change:

- rename `notes` conceptually into two fields:
  - `why`
  - optional execution notes
- make `why` strongly encouraged or required for active goals
- show it prominently in the detail panel

### 4. Improve deep-linking and navigation

What to change:

- clicking a goal chip should open that specific goal, not just `/goals`
- move key planning sections out of a collapsed-by-default mental model, or make the default open state smarter

## Phase 2: Make progress honest and truly integrated

This is the most important product-level upgrade.

### 5. Add a goal measurement model

Each goal should declare how progress is measured.

Suggested goal measurement types:

- milestone-based
- numeric target
- currency target
- habit consistency
- task/project completion
- manual status only

At that point, the progress bar becomes truthful instead of milestone-only.

### 6. Let tasks and habits actually move goal progress

Important distinction:

- tasks and habits already influence signals
- they do not yet update progress percent directly

Add explicit progress rules, for example:

- “This goal completes when 8 milestones are done.”
- “This goal completes when 20 linked workouts are done.”
- “This goal completes when savings reach $10,000.”

### 7. Add financial goal integration

This should include:

- monetary target amount
- current amount
- source of truth from finance data
- optional manual override

Without this, money goals stay disconnected from one of the core Life OS modules.

## Phase 3: Add the upper layer of life planning

### 8. Add time horizons

Suggested horizons:

- lifetime
- 10-year
- 5-year
- 1-year
- quarterly
- monthly

This will finally connect the page to long-range direction.

### 9. Add a north star section

This does not need to be a full vision board first.

A good first version would be:

- pinned long-term goals
- top life themes
- a short “what matters most” block

### 10. Add goal hierarchy or sequencing

You do not necessarily need a huge project tree.

A simpler first step would be:

- parent goal
- child goal
- prerequisite milestone or sequence

That would cover most of the benefit without turning the app into heavy project software.

## Phase 4: Close the review loop

### 11. Add a true goal review mode

What this should do:

- force review of every active goal
- require health update or confirmation
- require next step confirmation
- prompt archive / pause / keep decisions
- surface stale goals

This could live either:

- inside `/goals`
- or as a goal-review mode launched from weekly/monthly review

### 12. Let weekly and monthly reviews link back to goals properly

Short-term fix:

- add goal selection in the weekly review priority builder

Medium fix:

- add goal-linked monthly outcomes instead of text-only outcomes

The backend already supports part of this, but the current review UI throws that value away.

## Phase 5: Add the final polish expected from a flagship screen

### 13. Add goal quick-capture

Current quick capture does not support goals:

- `client/src/features/capture/QuickCaptureSheet.tsx:23`

Add:

- a Goal capture type
- title-first entry
- assign details later

### 14. Add celebration and completion handling

When a goal completes:

- show a real completion moment
- move it to a trophy room or wins archive
- preserve the “why,” milestones, and outcome summary

### 15. Add better filtering and sorting

At minimum:

- filter by status
- filter by horizon
- filter by health
- sort by priority, target date, or last activity

## Recommended Priority List

If I were implementing this one by one, I would do it in this order:

1. Restore full milestone editing in the live goals screen.
2. Fix the dead inspector edit button and add active goal status controls.
3. Show linked tasks in the live inspector.
4. Add a first-class `why` field.
5. Add goal linking in weekly review flows.
6. Replace milestone-only progress with a real measurement model.
7. Add financial goal support.
8. Add time horizons and north star structure.
9. Add goal review mode.
10. Add goal quick-capture and completion celebration.

## Fast Wins Vs Full-Stack Changes

### Fast wins, mostly frontend

- restore milestone editor in live screen
- fix dead edit button
- show linked tasks
- expose pause / complete / archive controls
- improve deep-linking
- add clearer labels and page identity

### Medium changes, frontend plus backend

- add `why` field
- let review flows attach goals
- add richer filters and status workflows

### Bigger system changes

- time horizons
- north star section
- real measurement model
- financial goal sync
- goal hierarchy
- trophy room / completion archive

## Final Assessment

The current goals screen is already useful, but mainly as a short-range planning and execution bridge.

It is not yet the full life-planning headquarters from the original vision.

If you want this screen to become one of the most important screens in Life OS, the next big step is not visual polish. It is making the goals system more truthful and more complete in three areas:

- better milestone control
- real progress measurement
- long-range structure

Once those are in place, the rest of the experience can become much more powerful without turning the product into bloated project-management software.
