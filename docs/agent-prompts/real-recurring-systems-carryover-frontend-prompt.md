You are editing the frontend of the Life OS repository through GitHub Copilot CLI.

Objective:
- Implement the frontend for shared recurrence and carryover intelligence across Today/tasks, daily review task decisions, habits, finance recurring expenses, and quick-capture note/reminder flows using the backend contracts already added in this repository.

Repository context:
- Frontend stack: React + TypeScript + Vite in `client/`
- Shared contracts live in `packages/contracts/`
- Backend work is already handled. Do not invent APIs. Read the contracts and existing query/mutation helpers in `client/src/shared/lib/api.ts` and adapt the client to the new additive recurrence fields.
- This feature is intentionally a vertical slice, not a full product redesign. Preserve the application’s current information architecture while improving the key recurring flows.
- Use strong visual judgment. This feature should feel like the system became more trustworthy and lower-friction, not like a form explosion.

Editable paths:
- `client/src/features/today/**`
- `client/src/features/reviews/**`
- `client/src/features/habits/**`
- `client/src/features/finance/**`
- `client/src/features/capture/**`
- `client/src/shared/lib/api.ts`
- `client/src/shared/lib/quickCapture.ts`
- `client/src/styles.css`
- any small shared UI helpers/components you need under `client/src/shared/**`

Do not touch:
- `server/`
- `server/prisma/`
- backend jobs or services
- unrelated frontend routes/pages
- unrelated dirty files

Backend/API behavior you can rely on:
- Shared recurrence contracts now exist in `packages/contracts/src/recurrence.ts`.
- Task payloads now support additive recurrence:
  - `CreateTaskRequest.recurrence?: { rule, exceptions? }`
  - `CreateTaskRequest.carryPolicy?: "complete_and_clone" | "move_due_date" | "cancel"`
  - `UpdateTaskRequest` supports the same additive fields
  - `PlanningTaskItem.recurrence` is now returned on day-plan/task responses
- Habit payloads now support additive recurrence:
  - `CreateHabitRequest.recurrence?: { rule, exceptions? }`
  - `UpdateHabitRequest.recurrence?: { rule, exceptions? }`
  - `HabitItem.recurrence` is now returned on habits responses
  - `HabitItem.scheduleRule` still exists as a compatibility/derived field and should not be treated as source of truth when recurrence is present
- Recurring expense payloads now support additive recurrence:
  - `CreateRecurringExpenseRequest.recurrence?: { rule, exceptions? }`
  - `UpdateRecurringExpenseRequest.recurrence?: { rule, exceptions? }`
  - `RecurringExpenseItem.recurrence` is now returned in addition to legacy `recurrenceRule`
- Daily review submit payload shape is unchanged, but recurring tasks are handled differently on the backend:
  - carry-forward and reschedule decisions now update the recurring series under the hood
  - dropped recurring tasks create skip semantics under the hood
- Quick capture reminder/note items remain task-backed metadata, not a new journal entity.

Recurrence model details for the UI:
- A recurrence input is:
  - `rule.frequency`: `daily | weekly | monthly_nth_weekday | interval`
  - `rule.startsOn`: ISO date string
  - `rule.interval?`: positive integer
  - `rule.daysOfWeek?`: `0..6`
  - `rule.nthWeekday?`: `{ ordinal: 1 | 2 | 3 | 4 | -1, dayOfWeek: 0..6 }`
  - `rule.end?`: `{ type: "never" | "on_date" | "after_occurrences", until?, occurrenceCount? }`
- A recurrence exception is:
  - `{ occurrenceDate, action: "skip" | "do_once" | "reschedule", targetDate? }`
- Task recurrences may also expose `carryPolicy` inside `task.recurrence`.

Current behavior to replace or extend:
- Today task actions support one-off carry-forward but do not expose recurrence intent clearly.
- Daily review task resolution feels one-off; recurring tasks are not visibly differentiated.
- Habits currently feel weekday-only and too limited.
- Finance recurring expenses use raw rule strings and a relatively plain form.
- Quick capture reminders/notes do not offer recurring setup.

Target behavior:
- Today/tasks:
  - Show which tasks are recurring.
  - Surface the carry policy in a compact way when a task is recurring.
  - Keep completion/carry-forward/reschedule actions fast.
  - When a task is recurring, the UI should communicate that the action affects the series occurrence, not just a one-off task.
- Daily review:
  - Pending task list should visually distinguish recurring tasks from one-off tasks.
  - Existing decision controls can remain familiar, but the copy/micro-UX should explain recurring behavior.
  - Do not turn the daily review into a complex rule editor.
- Habits:
  - Replace the weekday-only habit schedule editor with a recurrence editor.
  - Support at least these rule presets cleanly:
    - daily
    - weekly with weekday selection
    - every N days
    - nth weekday of month
  - Support end conditions in the editor.
  - Show recurrence summary text on habit cards.
- Finance recurring expenses:
  - Replace raw recurrence string entry with the same recurrence editor pattern, adapted for finance.
  - Keep `nextDueOn` visible and understandable.
  - Show recurrence summary text on recurring expense cards/list rows.
- Quick capture:
  - For reminder and note capture, allow optional recurring setup.
  - Keep this lightweight. The recurring controls should stay collapsed/secondary unless the user opts in.
- Exceptions:
  - This first frontend milestone only needs editing support if it fits naturally.
  - At minimum, recurring UIs should be structured so exception support can slot in cleanly later.
  - If full exception editing would create unstable UI scope, prefer read-compatible design hooks over half-baked CRUD.

Design direction:
- Use the `frontend-design` skill mindset: this should feel intentional and premium, not like admin software.
- The theme should communicate “system continuity” and “calm operational control”.
- Avoid giant raw forms. Prefer:
  - segmented recurrence presets
  - progressive disclosure
  - short human-readable summaries
  - compact rule chips / timeline language
- Good visual patterns for this feature:
  - series badges
  - recurrence summary pills
  - subtle connective motifs between “this occurrence” and “the series”
  - calm, low-noise scheduling controls
- Keep mobile behavior strong. Editors should work in narrow layouts without horizontal compression.

Concrete implementation requirements:
- Update the shared API typings and mutations in `client/src/shared/lib/api.ts` so the new recurrence fields are typed and passed through.
- Build a reusable recurrence editor component or small component set rather than duplicating logic across tasks, habits, and finance.
- Build a reusable recurrence summary formatter for cards/list rows/forms.
- Today page:
  - show recurring badge/iconography in the task lane
  - show carry policy if present
  - keep carry-forward/reschedule interactions intact
- Reviews page:
  - recurring tasks should be visibly marked in the pending decisions list
  - add concise explanatory copy where needed
- Habits page:
  - habit create/edit flows should use recurrence editor
  - habit cards should display readable recurrence summaries
- Finance page:
  - recurring expense create/edit flows should use recurrence editor
  - recurring expense cards/list should display readable recurrence summaries
- Quick capture sheet:
  - note/reminder flows should optionally attach recurrence
  - keep the default capture flow fast; recurring controls should not block quick entry
- Preserve existing data loading, toast, and mutation patterns unless a focused cleanup is necessary for this feature.

Suggested UX defaults:
- Default new recurring task carry policy to `complete_and_clone`.
- Default a new recurrence editor to a simple daily or weekly mode depending on context:
  - habits: daily
  - finance recurring expense: monthly-style rule if the existing item was monthly, otherwise weekly/day interval as appropriate
  - task/reminder: daily
- Hide advanced end-condition controls behind a simple “Ends” selector.
- Show a live summary sentence, for example:
  - `Daily starting Mar 21`
  - `Every Mon, Wed, Fri starting Mar 21`
  - `Every 3 days starting Mar 21`
  - `Second Tuesday of every month`

Constraints:
- Preserve existing navigation and route structure.
- Keep behavior accessible and responsive.
- Do not revert unrelated local changes.
- If a required backend API is missing, stop and report the blocker instead of inventing it.
- Do not perform backend edits from this prompt.
- Prefer additive, well-scoped components over broad refactors.

Validation:
- `cd client && npm run build`

Deliverables:
- Apply the frontend code changes directly.
- At the end, list the files changed.
- Summarize any follow-up work or remaining risks in 3 bullets or fewer.
