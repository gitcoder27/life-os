You are editing the frontend of the Life OS repository.

Objective:
- Finish the remaining frontend work for Phase 3 ("Goals and Planning") so Goals, Today, and Home make goal-linked planning feel operational instead of passive.

Repository context:
- Frontend stack: React + TypeScript + Vite in `client/`
- Shared contracts live in `packages/contracts/`
- Backend work for this phase has already been implemented
- Preserve the existing shell, layout rhythm, and component language; this should feel like a stronger version of the current product, not a visual reboot

Backend/API support now available:
- `GET /api/goals` now accepts optional query params:
  - `domain`: `health | money | work_growth | home_admin | discipline | other`
  - `status`: `active | paused | completed | archived`
- Planning responses now include linked goal metadata when present:
  - `GET /api/planning/days/:date`
  - `GET /api/planning/weeks/:startDate`
  - `GET /api/planning/months/:startDate`
  - `GET /api/tasks`
- Home overview now includes linked goal metadata on both `topPriorities` and `tasks`
- New linked goal shape on planning/home items:

```ts
goalId: string | null;
goal: {
  id: string;
  title: string;
  domain: "health" | "money" | "work_growth" | "home_admin" | "discipline" | "other";
  status: "active" | "paused" | "completed" | "archived";
} | null;
```

Editable paths:
- `client/src/features/goals/GoalsPage.tsx`
- `client/src/features/today/TodayPage.tsx`
- `client/src/features/home/HomePage.tsx`
- `client/src/shared/lib/api.ts`
- `client/src/styles.css`
- Any small shared UI helper file only if clearly necessary for this scope

Do not touch:
- `server/`
- `packages/contracts/`
- database or Prisma files
- unrelated frontend routes/features
- unrelated dirty worktree changes

Current behavior:
- Goals page already supports create/edit/status changes and weekly/monthly editing, but it still feels mostly like a summary page
- Goals page has no simple domain/status filtering
- Weekly priorities and monthly outcomes can be linked to goals in edit mode, but display mode barely shows that linkage
- Today already supports priority reorder, complete/drop, and task carry-forward/reschedule, but priorities are not linkable to goals from the UI
- Today and Home do not surface linked-goal context strongly enough
- Home already supports quick completion actions, but top priorities and tasks do not show which larger goal they support

Target behavior:
- Goals page should feel like a lightweight planning control surface
- Users should be able to filter goals by domain/status quickly
- Weekly priorities and monthly outcomes should visibly show their linked goals when linked
- Today priorities should be linkable to active goals during editing
- Today and Home should show linked-goal context on priorities/tasks without making the screen noisy
- The result should reinforce the chain:
  - monthly focus -> weekly priorities -> today's work -> linked goal

Design direction:
- Keep the current product language, but make this area feel more like an operational planning board than a static dashboard
- Use compact linked-goal chips/badges, stronger hierarchy, and cleaner grouping instead of adding large new panels
- Preserve responsiveness and accessibility
- Favor precise, intentional polish over broad redesign
- Domain cues should be subtle and useful, not a rainbow taxonomy

Implementation requirements:

1. Goals page
- Add a small filter bar near the goals section for:
  - domain: `all` plus each real domain
  - status: `all`, `active`, `paused`, `completed`, `archived`
- Use the backend query params for the filtered goals list instead of relying only on client-side filtering
- Keep weekly priorities and monthly focus visible regardless of goal filters
- In monthly focus display mode, show linked goal chips/labels for each linked outcome
- In weekly priorities display mode, show linked goal chips/labels for each linked priority
- Improve the active-goal list so linked planning context is easier to scan
  - at minimum, domain and status should be easy to recognize
  - do not overcomplicate the card layout
- Preserve the existing create/edit/complete/pause/archive flows

2. Today page
- Load active goals so priority rows can be linked to a goal during editing
- Add a goal selector to each priority draft row
- When priorities are shown, surface linked goal context directly in the row if `goal` exists
- In the task lane, show linked goal context when a task has `task.goal`
- Keep the page operational first; goal linkage should support action, not crowd out task controls
- Do not remove the existing reorder / complete / drop / carry-forward behavior

3. Home page
- In "Top priorities", show linked goal chips/labels for priorities that have `goal`
- In "Task lane", show linked goal chips/labels for tasks that have `goal`
- Keep the quick action buttons intact
- Make linked goals readable at a glance without increasing card height too much
- If a goal chip should navigate somewhere, send it to `/goals`; do not invent a goal detail page

4. Shared API/types
- Update `client/src/shared/lib/api.ts` to reflect:
  - `goalId` and `goal` on Home overview priorities/tasks
  - `goal` on planning priorities/tasks
  - filtered goals query support
- Extend or adjust goal query hooks so the Goals page can request filtered lists cleanly
- Avoid broad refactors in the API layer

UX constraints:
- Keep loading, empty, and error states working
- Keep desktop and mobile layouts clean
- Use existing button/tag/card patterns where possible
- Any new chips/badges should have clear contrast and consistent spacing
- Avoid introducing modal-heavy flows for this phase

Validation:
- `npm run typecheck`
- `npm run build -w client`

Deliverables:
- Apply the code changes directly
- At the end, list the files changed
- Summarize remaining risks or follow-up work in 3 bullets or fewer
