You are editing the frontend of the Life OS repository through GitHub Copilot CLI.

Objective:
- Finish Phase 4 ("Better Motivation And Guidance") on the frontend so Home, Habits, and Weekly Review actively guide behavior instead of only reporting state.

Repository context:
- Frontend stack: React + TypeScript + Vite in `client/`
- Shared contracts live in `packages/contracts/`
- Backend work for this phase has already been implemented
- Preserve the existing product shell and information architecture; this should feel like a sharper operational layer, not a redesign

Editable paths:
- `client/src/features/home/HomePage.tsx`
- `client/src/features/habits/HabitsPage.tsx`
- `client/src/features/reviews/ReviewsPage.tsx`
- `client/src/shared/lib/api.ts`
- `client/src/styles.css`
- Any very small shared UI helper file only if clearly necessary for this scope

Do not touch:
- `server/`
- `packages/contracts/`
- database or Prisma files
- unrelated frontend routes/features
- unrelated dirty worktree changes

Current behavior:
- Home already shows score, attention items, priorities, tasks, and score reason buckets, but there is no dedicated recovery framing, no weekly focus challenge, and no explicit next-step recommendation stack
- Habits shows due habits, routines, and a consistency chart, but it does not surface risk/drift state beyond basic streak badges
- Weekly Review already submits text fields and next-week priorities, but it does not expose the existing backend `focusHabitId` capability
- `client/src/shared/lib/api.ts` does not yet model the new Phase 4 guidance payloads coming from Home/Habits

Backend/API support now available:
- `GET /api/home/overview` now includes `guidance`
- `guidance` shape:

```ts
guidance: {
  recovery: {
    tone: "steady" | "recovery";
    title: string;
    detail: string;
  } | null;
  weeklyChallenge: {
    habitId: string;
    title: string;
    streakCount: number;
    completedToday: boolean;
    weekCompletions: number;
    weekTarget: number;
    status: "on_track" | "due_today" | "behind";
    message: string;
  } | null;
  recommendations: Array<{
    id: string;
    kind: "habit" | "priority" | "task" | "review" | "health";
    title: string;
    detail: string;
    impactLabel: string;
    action:
      | { type: "complete_task"; entityId: string }
      | { type: "complete_habit"; entityId: string }
      | { type: "open_review"; route: string }
      | { type: "open_route"; route: string };
  }>;
}
```

- `GET /api/habits` now includes:

```ts
weeklyChallenge: {
  habitId: string;
  title: string;
  streakCount: number;
  completedToday: boolean;
  weekCompletions: number;
  weekTarget: number;
  status: "on_track" | "due_today" | "behind";
  message: string;
} | null;

habits: Array<{
  id: string;
  title: string;
  category: string | null;
  scheduleRule: { daysOfWeek?: number[] };
  targetPerDay: number;
  status: "active" | "paused" | "archived";
  dueToday: boolean;
  completedToday: boolean;
  streakCount: number;
  risk: {
    level: "none" | "at_risk" | "drifting";
    reason: "streak_at_risk" | "missed_recently" | "low_completion_rate" | null;
    message: string | null;
    dueCount7d: number;
    completedCount7d: number;
    completionRate7d: number;
  };
}>
```

- Weekly review backend already supports a focus habit:
  - `GET /api/reviews/weekly/:startDate` returns `existingReview.focusHabitId`
  - `POST /api/reviews/weekly/:startDate` already accepts `focusHabitId?: string | null`
- Existing recommendation actions intentionally reuse current Home action types; do not invent a second action system

Target behavior:
- Home should surface guidance as a lightweight decision layer above or near existing operational content
- Habits should show which habits are at risk or drifting, and make the weekly focus habit feel like a real commitment
- Weekly Review should let the user explicitly choose the focus habit that seeds the weekly challenge
- The result should reinforce this chain:
  - weekly review -> focus habit -> weekly challenge -> today guidance -> one clear next action

Design direction:
- Keep the current visual language, but make the new guidance feel like a calm mission-control overlay rather than another generic card list
- Use one coherent motif: compact guidance rails with status cues, quiet amber/warm warning emphasis for recovery/risk, and measured green for "on track"
- Avoid loud gamification, emoji-heavy language, cartoon badges, or childish reward framing
- Favor disciplined hierarchy, compact progress markers, and subtle motion over large new panels
- Keep the UI responsive and accessible; these additions should stay readable on mobile without turning the top of the page into a wall of cards

Implementation requirements:

1. Shared API/types
- Update `client/src/shared/lib/api.ts` to model:
  - `guidance` on Home overview
  - `risk` and `weeklyChallenge` on habits data
  - `focusHabitId` on weekly review existing-review data and submit payloads if not already represented in the local types
- Do not broadly refactor the API layer; make the minimum changes needed to integrate the new contracts cleanly

2. Home page
- Add a compact guidance section near the top portion of Home, above the lower summary cards and close to score/attention/priorities
- Render `guidance.recovery` when present as a high-signal framing card/strip
  - recovery tone should look distinct from normal steady-state copy
  - if `recovery` is null, do not render placeholder chrome
- Render `guidance.weeklyChallenge` when present as a compact challenge card
  - show title, status, and progress (`weekCompletions / weekTarget`)
  - show whether it is due today / on track / behind without requiring the user to decode raw numbers
  - if clicking the challenge title/chip makes sense, send it to `/habits`
- Render `guidance.recommendations` as a short stack of action-first items
  - show title, detail, and impact label
  - wire each recommendation to its provided action using the same action behavior patterns Home already uses for attention items
  - do not duplicate attention-item visuals exactly; this should read as “next best moves,” not another inbox
- Preserve current attention items, top priorities, tasks, and score sections
- Keep the Home page from getting too tall on mobile

3. Habits page
- Add a weekly focus challenge surface near the top of the page when `weeklyChallenge` exists
  - emphasize this as the week’s chosen commitment, not as a generic streak widget
  - show progress and current status clearly
  - if the habit is due today and incomplete, make that visually obvious without using alarmist styling
- Add habit risk/drift indicators to habit rows
  - `at_risk`: stronger, immediate signal
  - `drifting`: softer caution signal
  - `none`: no extra warning treatment
- Show the backend-provided `risk.message` when present, but keep it compact
- Use recent completion stats (`completedCount7d / dueCount7d` or `completionRate7d`) where useful, but do not turn the page into an analytics dashboard
- Preserve one-tap completion, routine sections, and the consistency view

4. Weekly review
- On the weekly review path in `ReviewsPage`, load available habits so the user can choose a focus habit for the upcoming week
- Add a lightweight selector/input for `focusHabitId`
  - use active habits only
  - prefill it from `existingReview.focusHabitId` when present
  - submit it through the existing weekly review mutation
- Keep this explicit and habit-only for Phase 4
- Do not introduce health-target or spending-watch UI in this phase
- Preserve the existing weekly review structure and success messaging

5. Interaction behavior
- Recommendation actions on Home must:
  - complete habits/tasks inline when the action says so
  - navigate to the provided route for `open_route` / `open_review`
- After inline completion, rely on existing query invalidation patterns so Home/Habits state refreshes correctly
- Avoid modal-heavy flows for this phase

Constraints:
- Preserve existing patterns unless this prompt explicitly calls for a stronger guidance treatment
- Keep behavior accessible and responsive
- Keep all loading, empty, and error states working
- Do not revert unrelated local changes
- If a required backend API is missing, stop and report the blocker instead of inventing it
- Reuse existing tag/button/card patterns where possible, but do not force the new guidance area to look interchangeable with old sections

Validation:
- `npm run typecheck`
- `npm run build -w client`

Deliverables:
- Apply the code changes directly
- At the end, list the files changed
- Summarize any follow-up work or risks in 3 bullets or fewer
