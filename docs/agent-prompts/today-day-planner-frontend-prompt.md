# Frontend Copilot Prompt

You are editing the frontend of the Life OS repository through GitHub Copilot CLI.

Objective:
- Add a real day planner to the existing `Today` page so a user can plan the current day on a timeline, place today’s tasks into time blocks, and switch cleanly between planning and execution.

Repository context:
- Frontend stack: React + TypeScript + Vite in `client/`
- Backend stack already completed for this feature
- Shared contracts live in `packages/contracts/`
- The current Today page already exists and already has priorities, task groups, support context, and a small read-only schedule card
- This feature should stay inside the existing Today experience for v1, not become a separate planner page

Do not touch:
- `server/`
- Prisma schema
- backend routes
- unrelated dirty files

Primary product decision:
- Keep the planner inside `Today`
- Add a planner mode or planner workspace inside Today instead of another small card
- Use flexible time blocks on a vertical day timeline
- Allow both:
  - task-backed blocks
  - free-form blocks like `Lunch`, `Deep work`, `Gym`, `Commute`

Files you will likely need:
- `client/src/features/today/TodayPage.tsx`
- `client/src/features/today/hooks/useTodayData.ts`
- `client/src/features/today/components/ContextPanel.tsx`
- `client/src/features/today/components/TimeBlocks.tsx`
- new Today planner components/hooks under `client/src/features/today/`
- `client/src/features/today/today.css`
- `client/src/shared/lib/api.ts`

Current frontend behavior:
- Today already loads `GET /api/planning/days/:date`
- The response already contains priorities, tasks, and goal nudges
- The right rail currently shows a small `Schedule` card from timed tasks
- Tasks can already be completed, carried forward, and rescheduled elsewhere in Today

Target frontend behavior:
- Add a clear `Plan your day` entry point in Today
- Provide a planner surface inside Today that becomes a main interaction mode, not a side card
- Let the user:
  - create a time block
  - edit a block’s title and time
  - delete an empty block
  - reorder blocks in the day
  - assign today’s tasks to a block
  - remove a task from a block
  - reorder tasks inside a block
- Show unplanned today tasks separately from planned ones
- Replace the current small read-only schedule card with a planner-aware summary or remove it if the planner surface makes it redundant
- Keep Today usable on mobile with visible tap-first controls; do not rely on drag only

Required UX behavior:
- Do not add a separate `/planner` route for v1
- Do not make this another equal-weight support card in the right rail
- Keep `Execution` and `Planner` feeling like two states of the same page
- In execution mode, make it obvious which tasks are planned and which are still unplanned
- Free-form blocks with no tasks must be supported
- Quick-capture notes/reminders should stay outside the planner
- Planner interactions should feel fast and operational, not modal-heavy and sluggish

Backend/API details you can rely on:

## 1. Day plan payload now includes planner blocks

`GET /api/planning/days/:date`

Response shape now includes:

```ts
type DayPlanResponse = {
  date: string;
  priorities: PlanningPriorityItem[];
  tasks: PlanningTaskItem[];
  goalNudges: GoalNudgeItem[];
  plannerBlocks: DayPlannerBlockItem[];
  generatedAt: string;
};

type DayPlannerBlockItem = {
  id: string;
  title: string | null;
  startsAt: string;
  endsAt: string;
  sortOrder: number;
  tasks: Array<{
    taskId: string;
    sortOrder: number;
    task: PlanningTaskItem;
  }>;
  createdAt: string;
  updatedAt: string;
};
```

Use `plannerBlocks` plus the top-level `tasks` list to derive:
- planned tasks
- unplanned tasks
- empty blocks
- execution summaries

## 2. Create a planner block

`POST /api/planning/days/:date/planner-blocks`

Request:

```ts
{
  title?: string | null;
  startsAt: string; // ISO datetime with offset
  endsAt: string;   // ISO datetime with offset
  taskIds?: string[];
}
```

Response:

```ts
{
  plannerBlock: DayPlannerBlockItem;
  generatedAt: string;
}
```

Rules:
- block times must stay inside the requested day
- block end must be after start
- blocks cannot overlap
- task ids must be today’s scheduled `task` items only

## 3. Update a planner block

`PATCH /api/planning/days/:date/planner-blocks/:blockId`

Request:

```ts
{
  title?: string | null;
  startsAt?: string;
  endsAt?: string;
}
```

Response:

```ts
{
  plannerBlock: DayPlannerBlockItem;
  generatedAt: string;
}
```

Rules:
- changing the block start time updates the planned time for tasks inside that block
- overlap validation still applies

## 4. Delete a planner block

`DELETE /api/planning/days/:date/planner-blocks/:blockId`

Rules:
- only empty blocks can be deleted
- backend returns `204`

Your UI should avoid presenting delete on non-empty blocks as a normal success path

## 5. Reorder blocks

`PUT /api/planning/days/:date/planner-blocks/order`

Request:

```ts
{
  blockIds: string[];
}
```

Response:

```ts
{
  plannerBlocks: DayPlannerBlockItem[];
  generatedAt: string;
}
```

Rules:
- payload must include every existing block exactly once

## 6. Replace the tasks inside a block

`PUT /api/planning/days/:date/planner-blocks/:blockId/tasks`

Request:

```ts
{
  taskIds: string[];
}
```

Response:

```ts
{
  plannerBlock: DayPlannerBlockItem;
  generatedAt: string;
}
```

Rules:
- this is the main task-assignment endpoint
- sending a task id here moves it into this block even if it was previously in another block
- order in `taskIds` is the intended order inside the block
- tasks removed from a block become unplanned

## 7. Remove one task from a block

`DELETE /api/planning/days/:date/planner-blocks/:blockId/tasks/:taskId`

Response:

```ts
{
  plannerBlock: DayPlannerBlockItem;
  generatedAt: string;
}
```

Important backend behavior to respect:
- assigning a task into a planner block sets that task’s `dueAt` to the block start time
- removing a task from a block clears its `dueAt`
- if a task is rescheduled out of the day by existing backend task endpoints, its planner assignment is cleared
- planner blocks are day-specific only for now
- there is no reusable template support yet

Design direction:
- Preserve the current Today page’s stronger layout direction
- Do not regress into a flat dashboard of equal cards
- The planner should feel intentional, operational, and calm under load
- Strong preference:
  - one dominant planning surface
  - one backlog/unplanned lane
  - obvious block times
  - obvious task placement state
- Avoid generic kanban styling
- Avoid tiny draggable chips as the only interaction

Suggested UX shape:
- Add a segmented control, tab, or strong toggle near the top of Today:
  - `Execute`
  - `Plan`
- In `Plan`:
  - show timeline blocks as the main canvas
  - show unplanned tasks in a nearby lane
  - support quick block creation
  - support assigning tasks by click/tap selection first
  - drag-and-drop is optional, not required for v1, unless you can do it cleanly
- In `Execute`:
  - show current Today task flow
  - add compact planned-time cues and possibly a lightweight planner summary

Interaction requirements:
- Must work without hover-only actions
- Must work on laptop and mobile
- If using drag-and-drop, also provide button/tap fallback
- Avoid opening a modal for every small planner action
- Inline edit is preferred where it stays readable

State/data requirements:
- Extend the frontend API layer in `client/src/shared/lib/api.ts` for all new planner endpoints
- Extend Today data loading so `plannerBlocks` is available to the page
- Keep invalidation/refetch behavior correct after planner mutations
- Make sure Home/Today timing displays stay coherent with task `dueAt`

Acceptance criteria:
- A user with 10 today tasks can open Today, switch into planning, and organize the day into time blocks
- A user can create a free-form block with no tasks
- A user can move a task from unplanned to planned
- A user can move a task from one block to another
- A user can remove a task from a block and see it return to unplanned
- A user can reorder blocks and task order inside a block
- A user cannot accidentally delete a non-empty block without first removing its tasks
- The final Today experience feels like one workflow, not a page plus a random scheduling widget

Validation:
- `cd client && npm run build`

Deliverables:
- Apply the frontend code changes directly
- At the end, list the files changed
- Summarize any follow-up work or risks in 5 bullets or fewer
