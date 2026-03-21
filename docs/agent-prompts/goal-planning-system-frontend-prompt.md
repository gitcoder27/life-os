# Frontend Prompt: Goals Planning System V1

You are implementing the frontend for the new Goals Planning System V1 in Life OS.

Your scope is frontend only. Do not change backend behavior, route contracts, Prisma schema, or server code. The backend work for this feature is already implemented.

You are the frontend expert, so you should make strong design decisions. Use the existing product aesthetic and shell patterns, but upgrade the `/goals` experience into a genuinely operational planning surface instead of a thin CRUD page.

## Product Intent

The existing goals page was too lightweight. This feature upgrades it into a real planning system while staying lighter than a project-management app.

The user should be able to:

- see which goals are healthy vs drifting
- understand measurable progress at a glance
- open any goal into a deeper planning surface
- manage milestones
- see linked priorities, tasks, and habits tied to a goal
- understand per-goal momentum over time
- get a clear system-derived next best action

This is still a v1. Do not introduce projects, quarterly themes, roadmap views, or a new project hierarchy.

## Backend Contract You Must Use

### Goals overview

- `GET /api/goals`
- Query params:
  - `domain?`
  - `status?`
  - `date?=YYYY-MM-DD`

Response shape:

- `contextDate: string`
- `goals: GoalOverviewItem[]`

Each `GoalOverviewItem` includes the old goal fields plus:

- `progressPercent: number`
- `health: "on_track" | "drifting" | "stalled" | "achieved" | null`
- `nextBestAction: string | null`
- `milestoneCounts: { total, completed, pending, overdue }`
- `momentum: { trend: "up" | "down" | "steady", buckets: [{ startDate, endDate, completedCount }] }`
- `linkedSummary: { currentDayPriorities, currentWeekPriorities, currentMonthPriorities, pendingTasks, activeHabits, dueHabitsToday }`
- `lastActivityAt: string | null`

### Goal detail

- `GET /api/goals/:goalId`
- Query params:
  - `date?=YYYY-MM-DD`

Response shape:

- `contextDate: string`
- `goal: GoalDetailItem`

`GoalDetailItem` contains all overview fields plus:

- `milestones: GoalMilestoneItem[]`
- `linkedPriorities: GoalLinkedPriorityItem[]`
- `linkedTasks: GoalLinkedTaskItem[]`
- `linkedHabits: GoalLinkedHabitItem[]`

Milestone item:

- `id`
- `goalId`
- `title`
- `targetDate`
- `status: "pending" | "completed"`
- `completedAt`
- `sortOrder`
- `createdAt`
- `updatedAt`

Linked priority item:

- `id`
- `slot`
- `title`
- `status`
- `completedAt`
- `cycleType: "day" | "week" | "month"`
- `cycleStartDate`
- `cycleEndDate`

Linked task item:

- `id`
- `title`
- `notes`
- `status`
- `scheduledForDate`
- `dueAt`
- `originType`
- `completedAt`
- `createdAt`
- `updatedAt`

Linked habit item:

- `id`
- `title`
- `category`
- `status`
- `targetPerDay`
- `dueToday`
- `completedToday`
- `streakCount`
- `completionRate7d`
- `riskLevel: "none" | "at_risk" | "drifting"`
- `riskMessage`

### Goal milestone editing

- `PUT /api/goals/:goalId/milestones`

Request body:

```json
{
  "milestones": [
    {
      "id": "optional-existing-id",
      "title": "string",
      "targetDate": "YYYY-MM-DD or null",
      "status": "pending or completed"
    }
  ]
}
```

Rules:

- array order defines milestone order
- max 12 milestones
- milestone IDs are optional for new rows
- send the full replacement list when saving

Response:

- `milestones: GoalMilestoneItem[]`

### Habit goal linkage

Habits now support goal linking.

- `GET /api/habits` returns each habit with:
  - `goalId`
  - `goal`
- `POST /api/habits` accepts `goalId?: string | null`
- `PATCH /api/habits/:habitId` accepts `goalId?: string | null`

## Frontend Implementation Requirements

### 1. Rebuild `/goals` into a planning workspace

Keep `/goals` as the main route.

Required page structure:

- top planning context area for monthly focus and weekly priorities
- active goals section as the main workspace
- inactive goals section for paused/completed/archived items
- filters still supported

Do not keep the current “simple stack of lightweight cards with edit buttons” approach. The page should feel like planning software, not settings CRUD.

### 2. Active goal overview cards/rows

Each active goal should show:

- title
- domain
- target date
- progress representation
- health state
- milestone completion summary
- linked work summary
- compact momentum visualization from the 4 backend buckets
- system-provided next best action

The user should be able to open goal detail directly from this surface.

### 3. Goal detail surface

Do not create a new route for v1 unless you have a very strong reason. The intended pattern is:

- desktop: right-side detail panel or inspector
- mobile: full-height sheet or strong drill-in surface

The detail surface must include:

- sticky summary/header area
- milestones section
- linked priorities section
- linked tasks section
- linked habits section

Milestones must support:

- add
- edit title
- edit target date
- toggle pending/completed
- remove
- reorder with simple reliable controls
- save back through the replace endpoint

Do not invent extra milestone APIs. Use the replacement endpoint.

### 4. Habit form goal selector

Update the Habits page create/edit flow to allow optional goal linking.

Requirements:

- load available goals for selection
- support clearing the linked goal
- reflect existing linked goal on edit
- preserve current habit editing behavior otherwise

### 5. API client updates

Update frontend API helpers/types to support:

- enriched `GET /api/goals`
- new `GET /api/goals/:goalId`
- new `PUT /api/goals/:goalId/milestones`
- habit `goalId` and `goal` fields in reads/writes

Do not keep stale local types that assume the old lightweight goal response.

## UX Expectations

You should decide the exact visual treatment, but the experience must clearly communicate:

- direction
- progress
- risk
- momentum
- next action

Good behaviors:

- a user can scan the goals page and immediately see which goals need intervention
- opening a goal feels like entering a focused planning context
- milestone editing is lightweight and fast
- the page works on mobile without becoming cramped or unreadable

Avoid:

- generic dashboard-card mosaics
- burying the next best action
- turning milestones into a heavy tree UI
- adding frontend-only fake analytics not backed by the API

## States You Must Handle

- loading list
- list error
- empty active goals
- empty milestones
- no linked tasks
- no linked habits
- milestone save pending
- milestone save error
- goal detail loading
- goal detail error

## Acceptance Criteria

The implementation is complete when:

- `/goals` consumes the enriched backend response correctly
- goal overview surfaces progress, health, momentum, and next best action
- a goal detail panel/sheet works on desktop and mobile
- milestone editing works end-to-end with the replacement endpoint
- linked priorities, tasks, and habits are visible in goal detail
- Habits create/edit supports goal linking
- the UI remains consistent with the existing Life OS shell and quality bar

## Suggested Files To Review

- `client/src/features/goals/GoalsPage.tsx`
- `client/src/features/habits/HabitsPage.tsx`
- `client/src/shared/lib/api.ts`
- `client/src/shared/ui/*`
- `client/src/styles.css`

## Final Instruction

Do the frontend implementation end-to-end. Prefer clean typed API integration, strong responsive behavior, and high-quality interaction design over minimal visual change.
