# Life OS Current-State Product and Application Brief

Snapshot date: April 11, 2026

## Purpose

This document is a current-state handoff brief for another AI agent or contributor who needs to understand what Life OS already is before proposing or implementing a product upgrade.

It is based primarily on the current codebase, not only on older planning docs. The goal is to explain Life OS from both:

- the user's point of view: screens, features, and workflows
- the application's point of view: architecture, modules, data model, APIs, and background behaviors

Primary source areas used for this brief:

- `client/src/app/router.tsx`
- `client/src/features/**`
- `server/src/modules/**`
- `server/src/jobs/**`
- `server/prisma/schema.prisma`
- `packages/contracts/src/**`
- `docs/user/life-os-user-guide.md`

## 1. Product Summary

Life OS is a single-user personal operating system for daily execution and self-management. It combines:

- daily planning and execution
- inbox capture and triage
- habits and routines
- health basics and meal planning
- personal finance tracking and bill workflow management
- goals, hierarchy, and planning alignment
- daily, weekly, and monthly reviews
- in-app notifications and reminders

The product is strongest as a focused "run my life" system, not as a collaborative workspace or automation-heavy platform.

Current product characteristics:

- single-user, account-based web app
- manual-entry first
- modular monolith backend
- session-cookie authentication
- PostgreSQL-backed source of truth
- in-app notifications only
- background jobs for recurrence, reminders, notifications, cycle seeding, and score finalization

Core operating loop:

```text
Capture -> Triage -> Plan -> Execute -> Track -> Review -> Reset
```

## 2. Current Surface Map

### Primary routes in the live router

| Surface | Route | What it does |
| --- | --- | --- |
| Login | `/login` | Authenticates the owner account |
| Onboarding | `/onboarding` | Optional starter setup for incomplete accounts |
| Home | `/` | Daily command center and decision dashboard |
| Inbox | `/inbox` | Triage for captured tasks, notes, and reminders |
| Today | `/today` | Daily execution workspace with execute and plan modes |
| Habits | `/habits` | Habit check-ins, routines, streaks, and management |
| Health | `/health` | Same-day health logging and health summary |
| Meal Planner | `/health/meals` | Weekly meal planning, grocery list, and prep sessions |
| Finance | `/finance` | Expenses, bills, monthly planning, finance insights |
| Goals | `/goals` | Goal overview, hierarchy, planning, and alignment |
| Reviews | `/reviews/:cadence` | Current daily, weekly, or monthly review |
| Review History | `/reviews/history` | Archive, filters, and trends across reviews |
| Settings | `/settings` | Preferences, review window, goal setup, notifications |

### Important non-route surfaces

| Surface | Location | What it does |
| --- | --- | --- |
| Quick Capture | Global shell overlay | Fast capture for tasks, notes, reminders, expenses, water, meals, workouts, weight |
| Notification Center | Header panel overlay | In-app notification inbox with open, read, snooze, dismiss actions |
| App Shell | Protected layout | Sidebar navigation, greeting header, quick capture, notifications, settings access |

### Important clarification

Some older docs mention a dedicated `/notifications` screen. In the current shipped router there is no standalone notifications page. Notifications are handled through the header panel overlay.

## 3. User Experience by Surface

### 3.1 Login

Purpose:

- sign in to the single-user workspace with email and password

Current behavior:

- no sign-up flow
- no password reset UI
- login posts to the backend and then protected routes become available

### 3.2 Onboarding

Purpose:

- optional first-run setup for incomplete accounts

Current steps:

1. Owner profile
2. Life priorities
3. Top goals
4. Routines and habits
5. Tracking defaults
6. First recurring bill
7. Review rhythm

What onboarding seeds:

- display name
- starter goals
- morning and evening routines
- starter habits
- expense categories
- meal template suggestions
- daily water target
- daily review time
- week start preference
- optional first recurring bill
- initial week and month planning anchors

Important nuance:

- onboarding is explicitly optional
- if the user leaves several sections blank, the backend fills sensible starter defaults
- onboarding is not the only place to configure the system; finance, habits, goals, and settings all remain editable later

### 3.3 Home

Purpose:

- answer "what is going on today?" and "where should I go next?"

Current sections and behaviors:

- status strip:
  - daily score
  - score label
  - score buckets
  - weekly momentum
  - strong-day streak
  - current phase of day
  - whether the day is review-closed
- command block:
  - top open priority
  - open task count
  - next timed task
  - phase-aware direction
- guidance rail:
  - recovery guidance
  - weekly challenge
  - recommendations
- at-risk lane:
  - accountability radar items
  - overdue task count
  - stale inbox count
  - attention items that deep-link into other parts of the app
- today control:
  - top priorities
  - open task count
  - overdue count
- essentials band:
  - routines summary
  - habits summary
  - health summary
  - finance summary
- secondary context:
  - inbox preview
  - quote card

Home is not the main editing surface. It is a routing and awareness surface that directs the user into Inbox, Today, Habits, Health, Finance, Goals, or Reviews.

### 3.4 Inbox

Purpose:

- triage captured tasks, notes, and reminders before they become active work

Current capabilities:

- filter by all, task, note, reminder
- paginated inbox loading with "load more"
- stable inspector panel for a selected item
- inline title and notes editing
- move item to today
- schedule item for a chosen date
- archive item by setting it dropped
- convert between note and reminder
- link or unlink an item from a goal
- bulk select inbox items
- bulk schedule to today or another date
- bulk archive
- stale-item treatment in UI
- workflow templates modal and template application support

Important product rule:

- quick-captured tasks, notes, and reminders intentionally land in Inbox first
- Inbox is the undecided layer; Today is the committed execution layer

### 3.5 Today

Purpose:

- run the current day or shape a future day

Today has two modes:

- Execute mode
- Plan mode

#### Execute mode

Current behaviors:

- command bar with counts and mode switch
- focus stack for top priorities
- top priorities are capped at three slots
- execution stream for actionable tasks
- recovery tray for overdue work
- day notes panel fed by quick-capture reference items
- daily essentials side panel using current health context
- add-task sheet for same-day task capture

Today data model highlights:

- day priorities
- day tasks
- goal nudges
- planner blocks
- overdue tasks pulled from a lookback window
- quick-capture reference tasks separated from execution tasks
- recurring and carried-forward tasks distinguished from scheduled tasks

#### Plan mode

Current behaviors:

- query-param driven mode: `?mode=plan`
- date-specific planning via `?planDate=YYYY-MM-DD`
- view today, future days, and past days
- past dates are treated as history
- future and current dates are editable
- create, update, delete, reorder planner blocks
- assign unplanned tasks into blocks
- replace or remove tasks from planner blocks
- block execution model with slipped blocks and drift awareness

Important nuance:

- Today is both a task screen and a lightweight day planner
- it is the most execution-focused surface in the app

### 3.6 Habits

Purpose:

- keep the consistency system alive without mixing it into the task system

Current sections:

- score strip:
  - habits score
  - completion percent
  - weekly momentum
  - strong-day streak
  - due/complete counts
  - routine completion counts
- daily focus:
  - due habits
  - active routines
  - check-ins
  - routine item completion
  - rest-day handling
- signals:
  - weekly challenge
  - consistency and momentum signals
- manage habits:
  - create, edit, archive, restore
  - pause with pause windows
  - goal linking
- manage routines:
  - create, edit, reorder, archive, restore

Behavioral distinctions:

- habits are repeat behaviors with target-per-day semantics
- routines are structured sequences made of routine items
- pause windows support rest days and vacations instead of silent abandonment

### 3.7 Health

Purpose:

- same-day health tracking with low friction

Current capabilities:

- health score and score label
- phase-aware guidance and focus prompt
- one-tap water logging
- meal logging from:
  - today's plan
  - a saved meal template
  - freeform input
- workout update flow:
  - completed
  - recovery respected
  - fallback or missed depending on actual state
- weight logging
- same-day edit and delete for water, meal, and weight logs
- today's health timeline
- recent range insights for hydration, meals, workouts, and weight
- meal template management inside the page

Current health data concepts:

- current-day summary
- 7-day range context
- signals for water, meals, and workout
- planned meals surfaced from the meal planner
- guidance recommendations with action intents

### 3.8 Health -> Meals

Purpose:

- weekly meal-planning workspace

Current capabilities:

- week-based navigation
- day-by-day meal slots for breakfast, lunch, dinner, snack
- drag and drop meal templates into meal slots
- edit servings and notes
- distinguish planned meals that are already logged
- manage meal prep sessions
- maintain grocery items
- keep week notes
- manage meal templates with ingredients, instructions, tags, notes
- autosave after edits

Important cross-link:

- the meal planner feeds planned meals into the main Health screen for same-day logging
- prep sessions can carry task linkage into the planning system

### 3.9 Finance

Purpose:

- keep spending, bills, and monthly pacing visible without becoming full accounting software

Current capabilities:

- month navigation
- expense creation, editing, deletion
- filters for activity feed:
  - all
  - uncategorized
  - recurring
  - today
- categories management
- recurring expense template management
- bill workflow management:
  - create bill
  - pay and log expense together
  - mark paid without expense
  - reschedule
  - dismiss
  - link bill to an existing expense
- bills organized into due-now and upcoming workflow context
- unreconciled paid bills surfaced
- month plan panel:
  - planned spend
  - fixed obligations
  - flexible target
  - planned income
  - expected large expenses
  - category watch limits
  - bill timeline
  - pace status and pace summary
- finance insights panel:
  - money-related goals
  - current focus category
  - review-derived insights

Important system concept:

- recurring expense templates materialize pending admin items or bill-like work for Finance
- finance supports both "real expense logged" and "bill handled operationally" workflows

### 3.10 Goals

Purpose:

- connect longer-horizon direction to monthly, weekly, and daily execution

Goals has two modes:

- Overview
- Plan

#### Overview mode

Current capabilities:

- create and edit goals
- group by domain
- filter by domain, horizon, status
- search goals
- sort by domain, urgency, at-risk state, recent activity, target date
- inspect goal details
- manage milestones
- see linked priorities, tasks, and habits
- edit weekly priorities
- edit monthly theme and top outcomes

#### Plan mode

Current capabilities:

- hierarchy rail for parent/child goal navigation
- graph view for goal structure
- planning dock for connecting goals to:
  - today
  - this week
  - this month
- plan inspector with ancestry, health state, milestones, linked work
- create child goals with suggested horizon
- inspect today alignment to see which goals are represented in current work
- add a goal's next best action into planning lanes

Goal system concepts:

- goals belong to configurable domains and horizons
- goals can be nested
- goals carry health states such as on-track, drifting, stalled, achieved
- goals can have milestones
- goals can link to tasks, habits, cycle priorities, and finance goals

### 3.11 Reviews

Purpose:

- close loops and seed the next planning cycle

Current cadences:

- daily
- weekly
- monthly

#### Daily review

Current behaviors:

- generated summary of the day
- score breakdown
- unresolved task decisioning:
  - carry forward
  - drop
  - reschedule
- reflection inputs:
  - biggest win
  - friction tag
  - friction note
  - energy rating
  - optional note
- define tomorrow's three priorities
- submit within a controlled submission window
- edit a submitted daily review while the allowed window remains open

#### Weekly review

Current behaviors:

- generated weekly summary
- required reflection prompts
- next-week priorities
- focus-habit selection
- optional health target and spending watch notes
- submission window enforcement
- seeds next week's priorities

#### Monthly review

Current behaviors:

- generated monthly summary
- verdict and reflection prompts
- ratings
- next-month theme
- next-month outcomes
- habit changes
- simplify note
- submission window enforcement
- seeds next month's theme and outcomes

Review window behavior:

- windows can be open, too early, too late, wrong period, or unavailable
- the UI can redirect the user to the allowed review period

### 3.12 Review History

Purpose:

- browse and analyze past reviews

Current capabilities:

- filter by cadence
- filter by range: 30d, 90d, 365d, all
- full-text style search over reflections
- paginated archive timeline
- counts by cadence
- top friction tags
- weekly trend visualization data
- monthly trend visualization data
- period-over-period comparisons
- deep-link back into the original review route

### 3.13 Settings

Purpose:

- manage user preferences and system rules

Current sections:

- account:
  - read-only email
  - editable display name
- locale:
  - timezone
  - currency
  - week start day
- health targets:
  - daily water target
- daily review window:
  - start time
  - end time
- domain setup:
  - pointers to finance-owned setup
  - goal domain manager
  - goal horizon manager
- notification behavior:
  - per-category enablement
  - minimum severity
  - repeat cadence where supported
- session:
  - logout

Important nuance:

- finance categories and recurring-bill structure live primarily on Finance, even though Settings points users there

### 3.14 Quick Capture

Purpose:

- let the user capture without context switching

Global behavior:

- available from the shell
- keyboard shortcut: `Ctrl+K` or `Cmd+K`
- close with `Esc`
- submit with `Ctrl+Enter` or `Cmd+Enter`

Current capture types:

- Task
- Expense
- Water
- Meal
- Workout
- Weight
- Note
- Reminder

Current routing behavior:

- Task -> creates an unscheduled task in Inbox
- Note -> creates an Inbox note
- Reminder -> creates an Inbox reminder, preserving reminder date and recurrence when used
- Expense -> logs immediately into Finance
- Water, Meal, Workout, Weight -> log immediately into Health

### 3.15 Notification Center

Purpose:

- bring the user back to the right place when action is needed

Current capabilities:

- all / needs action / read filters
- grouped by severity
- mark as read
- dismiss
- dismiss all
- snooze:
  - 1 hour
  - tonight
  - tomorrow
- open destination directly into the right surface

Current notification categories:

- task
- inbox
- review
- finance
- health
- habit
- routine

## 4. Core Product Workflows

### 4.1 Capture to triage to execution

1. User captures a task, note, or reminder via Quick Capture.
2. Item is stored in the planning/task system with `originType=quick_capture`.
3. Item lands in Inbox unscheduled.
4. User triages it in Inbox.
5. Item is scheduled into Today, future-dated, linked to a goal, converted, or archived.
6. Once scheduled for today, it appears in Today and can affect score and review context.

### 4.2 Daily execution and planning

1. Home shows top priority, risk items, and guidance.
2. User moves into Today.
3. In Execute mode, the user works priorities, scheduled tasks, carried-forward tasks, and recurring tasks.
4. In Plan mode, the user shapes the day with planner blocks and assigns tasks into time blocks.
5. Overdue items surface in the recovery tray.

### 4.3 Goal alignment loop

1. User creates goals in Goals HQ.
2. Goals are organized by domain, horizon, and hierarchy.
3. Weekly priorities and monthly outcomes represent planning-cycle commitments.
4. Today receives goal nudges and direct goal-linked priorities/tasks.
5. Review flows and finance insights can also connect back to goals.

### 4.4 Habit and health support loop

1. Habits tracks repeat behaviors and routine completion.
2. Health tracks water, meals, workouts, and weight.
3. Meal Planner seeds planned meals into same-day Health.
4. Home and score calculations use this supporting-system data to influence guidance and visibility.

### 4.5 Finance bill workflow

1. Recurring expense template exists or a bill is created manually.
2. A pending finance admin item or bill appears in Finance.
3. User handles it by:
   - pay and log
   - mark paid
   - reschedule
   - dismiss
   - link to existing expense
4. Finance summary, month plan pacing, and insights update from resulting records.

### 4.6 Review seeding loop

1. Daily review resolves unfinished work and seeds tomorrow priorities.
2. Weekly review captures lessons and seeds next-week priorities.
3. Monthly review sets theme and seeds next-month outcomes.
4. These seeded items feed back into planning cycles and alignment surfaces.

### 4.7 Reminder and notification loop

1. Reminder tasks exist in the planning system.
2. Background reminder executor runs every 15 minutes.
3. Due reminders are promoted into Today and notification records are created.
4. Notification center opens the user back into the relevant screen.

## 5. Application View

### 5.1 Architecture shape

Current architecture:

- React + Vite frontend
- React Router for navigation
- TanStack Query for server state
- Fastify API server
- Prisma ORM
- PostgreSQL database
- separate worker process for scheduled jobs
- shared contracts package for client/server types

High-level runtime components:

1. Browser client
2. Fastify API server
3. Background worker
4. PostgreSQL database

### 5.2 Authentication and session model

Current auth model:

- server-side sessions
- secure cookies
- bootstrap owner account ensured by backend startup
- session check used to gate protected routes
- CSRF protection enforced for non-safe methods except login

Relevant backend routes:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/logout-all`
- `GET /api/auth/session`

### 5.3 Frontend application structure

Current frontend organization:

- `client/src/app`
  - router, providers, shell
- `client/src/features`
  - feature-specific pages and components
- `client/src/shared/lib/api`
  - query hooks and mutations per domain
- `client/src/shared/ui`
  - reusable UI pieces

Important frontend patterns:

- protected route wrapper based on session query
- onboarding gating for incomplete accounts
- app shell owns quick capture, notifications, and sidebar state
- most major screens are server-state driven and mutation-heavy

### 5.4 Backend module map

Current backend modules under `server/src/modules`:

| Module | Responsibility |
| --- | --- |
| `auth` | login, logout, session lifecycle |
| `onboarding` | starter defaults and initial data seeding |
| `home` | home overview, quote, attention and guidance aggregation |
| `planning` | tasks, day/week/month plans, priorities, planner blocks, goal routes, task templates |
| `habits` | habits, routines, check-ins, pause windows |
| `health` | water, meals, meal planning, workouts, weight, health summary |
| `finance` | expenses, bills, categories, recurring expenses, month plan, goal-linked finance insights |
| `reviews` | daily/weekly/monthly review read and submit flows, review history |
| `scoring` | daily score and weekly momentum |
| `notifications` | notification listing and mutations |
| `settings` | user preferences and notification preferences |
| `admin` | admin-item support surface used by finance/admin workflows |

### 5.5 Background jobs

Current worker jobs:

| Job | Schedule | Responsibility |
| --- | --- | --- |
| `session-cleanup` | daily | remove expired or revoked sessions |
| `cycle-seeding` | daily | ensure current and upcoming day, week, month planning cycles exist |
| `score-finalizer` | daily | finalize day scores after review window closes |
| `recurring-expense-materializer` | daily | turn recurring expense templates into pending finance admin items |
| `reminder-executor` | every 15 minutes | promote due reminders and create reminder notifications |
| `notification-evaluator` | every 15 minutes | create rule-based notifications for reviews, finance, habits, routines, health, inbox recovery |
| `notification-cleanup` | weekly | remove old dismissed, expired, or stale notifications |

### 5.6 Derived and cross-cutting system behaviors

Important backend-derived behaviors:

- Home is an aggregate response, not a simple CRUD view
- daily score and weekly momentum are calculated server-side
- closed-day scores are finalized so they do not drift silently
- review submission windows are backend-controlled
- finance month plan produces pacing and watch-limit insights
- goal health and next-best-action fields are derived
- health guidance is derived from same-day and range data
- notifications can carry direct navigation actions, not just generic text

## 6. Core Domain Model

The Prisma schema shows Life OS as a connected set of domain systems rather than a single task table.

### 6.1 Core entity groups

Identity and preferences:

- `User`
- `Session`
- `AuditEvent`
- `UserPreference`

Goals and planning:

- `Goal`
- `FinanceGoal`
- `GoalDomainConfig`
- `GoalHorizonConfig`
- `GoalMilestone`
- `PlanningCycle`
- `CyclePriority`
- `DayPlannerBlock`
- `DayPlannerBlockTask`
- `Task`
- `TaskTemplate`
- `RecurrenceRule`
- `RecurrenceException`

Habits and routines:

- `Habit`
- `HabitPauseWindow`
- `HabitCheckin`
- `Routine`
- `RoutineItem`
- `RoutineItemCheckin`

Health:

- `WaterLog`
- `MealTemplate`
- `MealPlanWeek`
- `MealPlanEntry`
- `MealPrepSession`
- `MealPlanGroceryItem`
- `MealLog`
- `WorkoutDay`
- `WeightLog`

Finance:

- `ExpenseCategory`
- `RecurringExpenseTemplate`
- `Expense`
- `FinanceMonthPlan`
- `FinanceMonthPlanCategoryWatch`
- `AdminItem`

Reviews, scoring, notifications:

- `DailyReview`
- `WeeklyReview`
- `MonthlyReview`
- `DailyScore`
- `Notification`

### 6.2 Important modeling ideas

- tasks have both `kind` and `originType`
- planning is cycle-based: day, week, month
- priorities are separate from tasks
- recurring behavior is modeled explicitly
- goals can be hierarchical and can link to tasks, habits, and finance goals
- finance distinguishes bills/admin workflow from actual expense records
- reviews store both reflection content and seeded planning outputs
- notifications are persisted records with severity, category, and optional navigation action

## 7. API Inventory by Product Area

Current major route groups under `/api`:

| Area | Key routes |
| --- | --- |
| Home | `/home/overview`, `/home/quote` |
| Auth | `/auth/login`, `/auth/logout`, `/auth/logout-all`, `/auth/session` |
| Onboarding | `/onboarding/state`, `/onboarding/complete` |
| Tasks | `/tasks`, `/tasks/bulk`, `/tasks/:taskId`, `/tasks/:taskId/carry-forward` |
| Day planning | `/planning/days/:date`, `/planning/days/:date/priorities`, `/planning/days/:date/planner-blocks...` |
| Week/month planning | `/planning/weeks/:startDate`, `/planning/weeks/:startDate/priorities`, `/planning/months/:startDate`, `/planning/months/:startDate/focus` |
| Goals | `/goals`, `/goals/workspace`, `/goals/:goalId`, `/goals/:goalId/milestones`, `/goals/config/*` |
| Task templates | `/task-templates`, `/task-templates/:id`, `/task-templates/:id/apply` |
| Habits | `/habits`, `/habits/:habitId`, `/habits/:habitId/checkins`, `/habits/:habitId/pause-windows...` |
| Routines | `/routines`, `/routines/:routineId`, `/routine-items/:itemId/checkins` |
| Health basics | `/health/summary`, `/health/water-logs`, `/health/meal-logs`, `/health/workout-days/:date`, `/health/weight-logs` |
| Meal planning | `/health/meal-templates`, `/health/meal-plans/weeks/:startDate` |
| Finance summary/planning | `/finance/summary`, `/finance/month-plan`, `/finance/insights` |
| Finance structure | `/finance/categories`, `/finance/recurring-expenses` |
| Finance activity/workflow | `/finance/expenses`, `/finance/bills`, `/finance/bills/:billId/*` |
| Reviews | `/reviews/daily/:date`, `/reviews/weekly/:startDate`, `/reviews/monthly/:startDate`, `/reviews/history` |
| Scoring | `/scores/daily/:date`, `/scores/weekly-momentum` |
| Notifications | `/notifications`, `/notifications/:notificationId/read`, `/notifications/:notificationId/dismiss`, `/notifications/:notificationId/snooze`, `/notifications/dismiss-all` |
| Settings | `/settings/profile` |

## 8. Current Strengths and Constraints

### Strengths

- clear modular separation by life domain
- strong current-state coverage for daily operating flows
- real connective tissue between goals, daily planning, reviews, finance, and health
- thoughtful background behaviors for reminders, recurring finance, and notifications
- richer than a simple todo app because of cycle planning, reviews, and cross-domain summaries

### Constraints and product boundaries

- single-user only
- no collaboration model
- no external integrations yet
- notifications are in-app only
- no standalone notifications route
- client-side automated test surface is still minimal
- some setup still lives on domain pages rather than being centralized
- the app is broad, so "current feature exists" does not always mean "fully mature UX"

## 9. Recommended Starting Points for the Next Agent

If another agent is about to propose a product upgrade, they should start by reading these in order:

1. this document
2. `docs/user/life-os-user-guide.md`
3. `client/src/app/router.tsx`
4. `server/prisma/schema.prisma`
5. `packages/contracts/src/*.ts`
6. the relevant feature area in `client/src/features/<area>` and `server/src/modules/<area>`

The most important mental model is this:

- Home decides attention
- Inbox decides meaning
- Today decides execution
- Habits and Health keep the support systems alive
- Finance keeps money visible and actionable
- Goals holds direction
- Reviews close loops and seed the next cycle
- Notifications and Quick Capture keep the whole system in motion
