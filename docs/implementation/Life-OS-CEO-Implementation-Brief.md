# Life OS: CEO Implementation Brief

Date: April 11, 2026

## What this document is

This is the short, executive version of the longer strategy and roadmap documents:

- `docs/implementation/Life-OS-Behavior-Change-Product-Strategy.md`
- `docs/implementation/Life-OS-Implementation-Roadmap.md`

It is also grounded in the current codebase so future implementation work can start from what already exists instead of redesigning from scratch.

---

## Executive summary

Life OS already has strong product breadth. It covers the major domains of life management and has a real system behind it:

- Home
- Inbox
- Today
- Habits
- Health
- Finance
- Goals
- Reviews

The problem is not missing surface area.

The problem is that the product is still better at helping a user **organize and track** than helping them **start, continue, and recover**.

That matters because the target user does not mainly fail from lack of awareness. They fail at the moment of action:

- they hesitate to start
- the task feels vague or heavy
- the day gets overloaded
- motivation drops
- one miss turns into two or three

The next phase of Life OS should therefore not be "more features."

It should be a focused upgrade from a **personal management app** into a **behavioral operating system**:

- tell me what matters now
- make it easier to start
- help me keep going
- help me recover fast when I slip
- improve the system from repeated friction

---

## The business decision

For the next major cycle, prioritize behavior execution over product breadth.

In plain terms:

- Do not expand into more life domains first.
- Do not prioritize prettier dashboards first.
- Do not lead with heavy AI coaching first.
- Do not build punishment mechanics or guilt systems.

Instead, build the smallest set of features that improve daily follow-through.

The highest-value outcomes are:

1. Each day has one believable must-win.
2. Important work has a clear first step.
3. The product can detect when the user is stuck or overloaded.
4. A bad day can still be saved.
5. Reviews change tomorrow's system instead of only recording failure.

If those five things work, Life OS becomes materially more valuable even without adding new domains.

---

## What should be built first

### Phase 1: Make daily execution real

Build first:

1. Daily Launch Ritual
2. Must-Win Day
3. Start Protocol
4. "I'm Stuck" flow

Why:

- this directly attacks procrastination
- this improves daily action immediately
- this is higher leverage than more planning complexity

### Phase 2: Protect continuity

Build next:

1. Rescue Mode / Minimum Viable Day
2. Habit minimums and repair rules
3. Goal work-in-progress limits

Why:

- consistency is mostly lost on bad days
- one miss should shrink the day, not destroy momentum
- too many active goals create fake ambition and real avoidance

### Phase 3: Make review loops adaptive

Build after the above:

1. better friction capture
2. review-to-system-change workflow
3. weekly capacity planning

Why:

- reflection only matters if it changes future behavior
- many failures are created by unrealistic planning before the week even begins

### Phase 4: Add state-aware support

Build later:

1. behavior state engine
2. state-aware nudges
3. optional accountability support

Why:

- this can be powerful
- but it should sit on top of simpler workflows that already work

---

## What to avoid for now

Delay on purpose:

- new broad life domains
- elaborate analytics dashboards
- complex AI coaching layers
- hard-lock discipline mechanics
- shame-based accountability
- app-engagement reward loops

Reason:

These add complexity and drama faster than they add follow-through.

---

## What already exists in the codebase

This is important: the current app already contains much of the structure needed for this direction.

### Frontend surfaces that already exist

The application already has route-level pages for:

- Home in `client/src/features/home/HomePage.tsx`
- Inbox in `client/src/features/inbox/InboxPage.tsx`
- Today in `client/src/features/today/TodayPage.tsx`
- Habits in `client/src/features/habits/HabitsPage.tsx`
- Health in `client/src/features/health/HealthPage.tsx`
- Finance in `client/src/features/finance/FinancePage.tsx`
- Goals in `client/src/features/goals/GoalsPage.tsx`
- Reviews in `client/src/features/reviews/ReviewsPage.tsx`
- Settings in `client/src/features/settings/SettingsPage.tsx`

Routes are wired centrally in `client/src/app/router.tsx`.

### Backend modules that already exist

The Fastify backend already has modular route groups for:

- home
- planning
- habits
- health
- finance
- reviews
- notifications
- scoring
- settings
- onboarding

Module registration lives in `server/src/modules/index.ts`.

### Shared contracts already exist

The app already uses shared TypeScript contracts in `packages/contracts/src`, including:

- `planning.ts`
- `home.ts`
- `habits.ts`
- `goals.ts`
- `reviews.ts`
- `health.ts`
- `notifications.ts`

This is a strong foundation for coordinated frontend and backend changes.

### Existing data model is already close

The Prisma schema already includes core building blocks such as:

- `PlanningCycle`
- `CyclePriority`
- `DayPlannerBlock`
- `Task`
- `Habit`
- `Routine`
- `DailyReview`
- `WeeklyReview`
- `MonthlyReview`
- `Notification`

These live in `server/prisma/schema.prisma`.

This means the next phase should be an extension of the current architecture, not a rebuild.

---

## What the current product already does well

Based on the codebase, Life OS is not a blank slate.

It already supports:

- structured pages for the core life domains
- day, week, and month planning cycles
- daily priorities and planner blocks
- task scheduling, carry-forward, recurrence, reminders, and inbox triage
- habits, routines, streaks, and pause windows
- daily, weekly, and monthly reviews
- scoring and home guidance
- notifications and background jobs

This confirms the main product thesis:

Life OS does not need more breadth first.
It needs a better behavior layer on top of the breadth it already has.

---

## Codebase-grounded implementation guidance

This section is for future AI agents and developers.

### 1. Start from existing surfaces, not new pages

The current structure already maps well to the proposed product direction.

Recommended approach:

- keep the existing pages
- add guided flows, overlays, and new states inside them
- avoid creating a giant new top-level "behavior" product area

Practical fit:

- Home becomes the state-aware command surface
- Today becomes the execution and recovery workspace
- Inbox becomes the clarification gate
- Habits becomes the continuity engine
- Reviews becomes the adaptation engine

### 2. The best current frontend starting points

Use these files first:

- `client/src/features/home/HomePage.tsx`
- `client/src/features/home/CommandBlock.tsx`
- `client/src/features/home/GuidanceRail.tsx`
- `client/src/features/home/TodayControl.tsx`
- `client/src/features/home/AtRiskLane.tsx`
- `client/src/features/today/TodayPage.tsx`
- `client/src/features/today/hooks/useTodayData.ts`
- `client/src/features/today/components/CommandBar.tsx`
- `client/src/features/today/components/ExecutionStream.tsx`
- `client/src/features/today/components/FocusStack.tsx`
- `client/src/features/today/components/RecoveryTray.tsx`
- `client/src/features/today/components/DayPlanner.tsx`
- `client/src/features/inbox/InboxPage.tsx`
- `client/src/features/habits/HabitsPage.tsx`
- `client/src/features/reviews/ReviewsPage.tsx`

Why these matter:

- Home already aggregates daily context and guidance
- Today already has execute/plan concepts
- Inbox already supports triage and bulk movement
- Habits already has check-ins, routines, and risk signals
- Reviews already has structured cadence workflows

### 3. The best current backend starting points

Use these files first:

- `server/src/modules/home/routes.ts`
- `server/src/modules/home/guidance.ts`
- `server/src/modules/planning/plan-routes.ts`
- `server/src/modules/planning/task-routes.ts`
- `server/src/modules/planning/goal-routes.ts`
- `server/src/modules/habits/habit-service.ts`
- `server/src/modules/habits/routine-service.ts`
- `server/src/modules/reviews/routes.ts`
- `server/src/modules/reviews/service.ts`
- `server/src/modules/scoring/service.ts`
- `server/src/modules/notifications/service.ts`
- `server/src/jobs/registry.ts`

Why these matter:

- planning already owns day plans, priorities, blocks, and tasks
- home already builds aggregated daily guidance
- reviews already produce structured reflection flows
- scoring and notifications already support derived behavioral logic

### 4. Extend existing contracts instead of inventing parallel ones

The first contracts likely to change are:

- `packages/contracts/src/planning.ts`
- `packages/contracts/src/home.ts`
- `packages/contracts/src/habits.ts`
- `packages/contracts/src/reviews.ts`
- `packages/contracts/src/health.ts`
- `packages/contracts/src/notifications.ts`

Future implementation should prefer extending these contracts over creating disconnected feature-specific payloads.

### 5. Extend existing data structures instead of creating a giant new domain

Recommended direction:

- extend `Task` for start behavior
- extend `Habit` for minimums and repair rules
- extend daily planning cycles for day mode and launch/shutdown state
- extend reviews for friction-to-change outputs
- add a small execution/behavior layer only where needed

Likely additions from the strategy docs:

- task next action
- 5-minute version
- start metadata
- must-win state
- day mode
- sleep and energy inputs
- habit minimum/standard/stretch fields
- repair rules
- focus sessions
- recovery plans
- behavior states

### 6. Build around deterministic rules first

Do not start with machine learning.

The current backend is already well positioned for rule-based behavior logic such as:

- must-win not started by threshold time
- overloaded day due to too many priorities or overdue items
- recovery mode after missed review plus rollover
- low-energy day from sleep and energy signals

This is both faster and more trustworthy for an early implementation.

---

## Recommended implementation sequence in the current repo

### Milestone 1: Believable day

Implement:

- Daily Launch Ritual
- Must-Win Day
- top-layer limit of one primary plus two supports

Primary code areas:

- `client/src/features/home/*`
- `client/src/features/today/*`
- `server/src/modules/home/*`
- `server/src/modules/planning/*`
- `packages/contracts/src/home.ts`
- `packages/contracts/src/planning.ts`

### Milestone 2: Better start behavior

Implement:

- Start Protocol
- task-level first visible action
- 5-minute version
- "I'm Stuck" flow
- explicit task start tracking

Primary code areas:

- `client/src/features/today/*`
- `client/src/features/inbox/*`
- `server/src/modules/planning/*`
- `packages/contracts/src/planning.ts`
- `server/prisma/schema.prisma`

### Milestone 3: Save bad days

Implement:

- Rescue Mode
- minimum viable day
- habit minimums
- repair rules

Primary code areas:

- `client/src/features/today/*`
- `client/src/features/habits/*`
- `client/src/features/home/*`
- `server/src/modules/habits/*`
- `server/src/modules/home/*`
- `packages/contracts/src/habits.ts`
- `packages/contracts/src/home.ts`
- `server/prisma/schema.prisma`

### Milestone 4: Make reviews adaptive

Implement:

- richer friction capture
- system-change output
- weekly capacity planning

Primary code areas:

- `client/src/features/reviews/*`
- `server/src/modules/reviews/*`
- `packages/contracts/src/reviews.ts`
- `server/prisma/schema.prisma`

### Milestone 5: Add state-aware behavior support

Implement:

- behavior state engine
- state-aware nudges
- recovery prompts

Primary code areas:

- `server/src/modules/home/*`
- `server/src/modules/notifications/*`
- `server/src/jobs/*`
- `packages/contracts/src/home.ts`
- `packages/contracts/src/notifications.ts`

---

## Product rule for every future feature

Before building any new feature, ask:

1. Does this make it easier to start?
2. Does this reduce ambiguity?
3. Does this help on low-energy days?
4. Does this improve recovery after misses?
5. Does this reduce browsing and increase doing?
6. Does this turn review into system change?

If the answer is mostly no, it probably belongs later.

---

## Final recommendation

Life OS should not spend the next cycle becoming broader.

It should spend the next cycle becoming more behaviorally effective.

The winning product direction is:

- fewer choices
- clearer starts
- tighter daily focus
- better continuity on bad days
- faster recovery after misses
- reviews that improve the system

The good news is that the current codebase already has the right architecture to support this direction.

The next step is not reinvention.
The next step is disciplined extension.
