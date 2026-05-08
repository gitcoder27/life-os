# Life OS Planner Upcoming Calendar Implementation Plan

Date: May 8, 2026

## Purpose

This document defines the next Planner upgrade: turning the current Upcoming scheduled-work list into a small calendar workspace with three views:

- **Agenda** for the existing grouped list.
- **Week** for the primary planning scan.
- **Month** for long-range orientation.

The goal is to make future scheduled tasks easy to understand when a user has planned more than a few days ahead. The experience should stay minimal, sleek, and consistent with the existing Planner design.

## Executive Outcome

After this implementation, the Planner route should work like this:

```text
Planner
-> sticky Today / Upcoming switch
-> Upcoming
-> Agenda | Week | Month
-> click a date to open that date in the existing Day Planner
-> click a task to edit it or inspect it
```

The user should be able to answer:

- What is scheduled after today?
- Which days are heavy?
- What is coming this week?
- Where did I place a task?
- Can I jump directly into the day plan for that date?

This should not become a full external calendar system yet. It should remain a Life OS task-planning surface.

## Current State

The application already has the right backend foundation:

- Tasks have `scheduledForDate`.
- `GET /api/tasks` supports `from`, `to`, `scheduledForDate`, `status`, `kind`, `scheduledState`, and sorting.
- The server materializes recurring tasks when a scheduled date range is requested.
- `/planner?planDate=YYYY-MM-DD` can already open the existing Day Planner for a future date.
- The Planner top rail now has the sticky `Today / Upcoming` switch.
- The first Upcoming implementation already shows future scheduled work as a grouped list.

Important current files:

- `client/src/features/today/TodayPage.tsx`
- `client/src/features/today/components/PlannerUpcoming.tsx`
- `client/src/features/today/components/CommandBar.tsx`
- `client/src/features/today/styles/planner/upcoming.css`
- `client/src/shared/lib/api/planning.ts`
- `packages/contracts/src/planning.ts`
- `server/src/modules/planning/task-routes.ts`

## Product Decision

Build the three-view Upcoming workspace inside the existing Planner route.

Recommended default:

- **Planner tab:** `Upcoming`
- **Upcoming sub-view:** `Week`
- **Range behavior:** show future scheduled tasks, with Today handled by the separate Planner Today view
- **Navigation behavior:** opening a day routes to the existing Day Planner rather than creating a separate day-detail calendar surface

This keeps the mental model simple:

- Today is for execution and detailed day shaping.
- Upcoming is for scanning and navigating future scheduled work.
- The Day Planner remains the editing surface for a specific date.

## Library Recommendation

Use **FullCalendar** for the calendar grid layer.

Recommended packages:

```bash
npm install -w client @fullcalendar/core @fullcalendar/react @fullcalendar/daygrid @fullcalendar/interaction
```

Do not add FullCalendar Premium packages for this phase.

### Why FullCalendar

- It has an official React adapter.
- It is plugin-based, so we can add only the pieces we need.
- `@fullcalendar/daygrid` supports month and week-style day grids, which match date-only scheduled tasks better than an hourly time grid.
- `@fullcalendar/interaction` supports date click interactions.
- The React adapter supports custom event rendering with JSX, which lets us keep Life OS task styling instead of accepting default calendar event visuals.
- FullCalendar custom views can use custom durations if we want a rolling "next 7 days" view later.

### Why Not External Calendar Services Yet

Do not integrate Google Calendar, Outlook, iCal, or CalDAV in this phase.

External sync is a separate product problem:

- It requires account linking and token storage.
- Imported events are not the same as Life OS tasks.
- Two-way sync can create ownership conflicts.
- It raises privacy and data-deletion questions.
- It adds more UI states than this immediate scheduling visibility problem needs.

The right sequence is:

```text
Life OS scheduled tasks calendar
-> optional export or read-only external overlay
-> optional two-way sync after clear rules exist
```

### Library Notes From Source Review

The FullCalendar docs currently show v6 as the stable docs path and note a v7 release candidate. Pin stable packages during implementation unless v7 is fully released and tested in this repo.

Schedule-X is a strong modern alternative, but its custom-view docs currently point to Preact for custom views. That is extra friction for this React app if we need deeply custom rendering.

## UX Model

### Planner-Level Navigation

The sticky command bar keeps:

```text
Today | Upcoming
```

No duplicate large tab switch should appear lower in the page.

### Upcoming-Level Navigation

Inside Upcoming, add a compact segmented control:

```text
Agenda | Week | Month
```

Placement:

- In the Upcoming header row.
- Below the sticky command bar.
- Visually smaller than the `Today / Upcoming` Planner switch.
- No verbose explanatory text.

The sub-view should be encoded in the URL so refresh and sharing keep context.

Suggested params:

```text
/planner?view=upcoming&upcomingView=week
/planner?view=upcoming&upcomingView=agenda
/planner?view=upcoming&upcomingView=month
```

Optional later param:

```text
/planner?view=upcoming&upcomingView=month&calendarDate=2026-06-01
```

Invalid params should be cleaned the same way the current Planner view state is cleaned.

## View Specifications

### 1. Agenda View

Purpose:

- Preserve the current grouped upcoming list.
- Best for a narrow screen or a user who wants a readable task list.

Content:

- Date groups in ascending order.
- Relative date label: Tomorrow, weekday, or short date.
- Full date.
- Task rows with kind, title, goal, estimate, focus length, and recurring state.
- `Open day` action.
- `Edit` task action.

Changes from the current first version:

- Move the grouped-list rendering into an `UpcomingAgendaView` component.
- Keep the empty, loading, and error states.
- Keep the same restrained visual language.
- Use the same task grouping model as Week and Month.

### 2. Week View

Purpose:

- Make the next planned week scannable at a glance.
- Help the user notice overloaded or empty days.
- Default view for Upcoming.

Recommended behavior:

- Use a day-grid week view, not an hourly time grid.
- Display date-only tasks as compact all-day task chips.
- Do not show hourly rows because scheduled tasks currently have a day, not a time.
- Show each day with a count and estimated minutes total.
- Limit visible task chips per day to avoid visual crowding.
- Use a subtle `+N more` overflow affordance when a day has many tasks.
- Clicking a date header or empty day opens that date in the existing Day Planner.
- Clicking a task opens the edit sheet or a small task inspector.

Initial range decision:

- Start with FullCalendar `dayGridWeek` for a familiar calendar week.
- Exclude or visually mute dates before tomorrow.
- If the current-week view feels weak late in the week, upgrade to a custom `dayGrid` view with a 7-day duration anchored from tomorrow.

Visual treatment:

- Thin lines, not heavy boxes.
- No large colored event blocks.
- Task chips should be compact, text-first, and clipped gracefully.
- Use one accent only for selected day or task hover.
- Show overload through tiny metadata, not warning banners.

### 3. Month View

Purpose:

- Give long-range orientation without creating a dense task wall.
- Help the user see which future days have scheduled work.

Recommended behavior:

- Use `dayGridMonth`.
- Keep day cells quiet.
- Show at most two task chips or dots per day.
- Use a small count when a day has more work.
- Selecting a day reveals a lightweight day detail rail or inline detail strip.
- `Open day` routes to the existing Day Planner for that date.

The Month view should not try to show every task title. Its job is map and density, not execution.

## Data Model And Fetching

### Current API

The first implementation can use the existing task list endpoint:

```text
GET /api/tasks?from=YYYY-MM-DD&to=YYYY-MM-DD&status=pending
```

This is enough for:

- Agenda groups.
- Week calendar events.
- Month calendar events.
- Recurring task materialization across the visible range.

### Client Query Shape

Use a small range model in `PlannerUpcoming`:

```ts
type UpcomingView = "agenda" | "week" | "month";

type UpcomingVisibleRange = {
  from: string;
  to: string;
};
```

Range rules:

- Agenda: tomorrow through 30 days ahead.
- Week: visible calendar week or rolling 7-day range.
- Month: FullCalendar visible month range.

Use the visible range to call:

```ts
useTasksQuery({
  from: visibleRange.from,
  to: visibleRange.to,
  status: "pending",
});
```

### Event Mapping

Map tasks to calendar events in one pure function:

```ts
type UpcomingCalendarEvent = {
  id: string;
  title: string;
  start: string;
  allDay: true;
  extendedProps: {
    task: TaskItem;
    kind: TaskItem["kind"];
    goalTitle: string | null;
    estimatedMinutes: number | null;
    isRecurring: boolean;
  };
};
```

Rules:

- Skip tasks without `scheduledForDate`.
- Skip completed tasks.
- Use `getQuickCaptureDisplayText` for task title display.
- Preserve ordering by `scheduledForDate`, then `todaySortOrder`, then `createdAt`.

### Backend Changes

No backend schema or route changes are required for the first calendar version.

Potential later backend improvement:

```text
GET /api/tasks/calendar-summary?from=YYYY-MM-DD&to=YYYY-MM-DD
```

Only add this if Month view becomes slow with many tasks. It could return day-level counts and total estimated minutes without every task body.

## Component Plan

Keep `TodayPage.tsx` responsible for route-level Planner state only. Move Upcoming-specific complexity out of it.

Suggested structure:

```text
client/src/features/today/components/PlannerUpcoming.tsx
client/src/features/today/components/planner-upcoming/UpcomingAgendaView.tsx
client/src/features/today/components/planner-upcoming/UpcomingCalendarView.tsx
client/src/features/today/components/planner-upcoming/UpcomingViewSwitch.tsx
client/src/features/today/components/planner-upcoming/UpcomingDayDetail.tsx
client/src/features/today/helpers/upcoming-calendar.ts
client/src/features/today/styles/planner/upcoming.css
```

Responsibilities:

- `PlannerUpcoming.tsx`
  - Owns `upcomingView`, visible range, selected date, query state, and shared handlers.
  - Renders the header, sub-view switch, loading/error/empty states, and selected view.

- `UpcomingViewSwitch.tsx`
  - Renders `Agenda | Week | Month`.
  - Calls `onViewChange`.
  - Uses `aria-pressed` or tab semantics consistently.

- `UpcomingAgendaView.tsx`
  - Renders the current grouped list.
  - Receives grouped tasks and callbacks.

- `UpcomingCalendarView.tsx`
  - Wraps FullCalendar.
  - Receives `mode="week" | "month"`.
  - Emits `onVisibleRangeChange`, `onDateOpen`, `onTaskOpen`, and `onDaySelect`.
  - Hides FullCalendar's default toolbar and uses Life OS controls.

- `UpcomingDayDetail.tsx`
  - Shows selected date, count, estimated minutes, compact task list, and `Open day`.
  - Desktop: right rail or inline side panel with a left border.
  - Mobile: inline section below the calendar.

- `upcoming-calendar.ts`
  - Contains pure helpers:
    - task grouping
    - event mapping
    - date labels
    - totals by day
    - range calculations

## URL And State Plan

Extend `TodayPage.tsx` with:

```ts
type PlannerView = "today" | "upcoming";
type UpcomingView = "agenda" | "week" | "month";
```

Recommended default:

```ts
const plannerView = rawPlannerView === "upcoming" ? "upcoming" : "today";
const upcomingView = rawUpcomingView === "agenda" || rawUpcomingView === "month"
  ? rawUpcomingView
  : "week";
```

Behavior:

- Switching Planner to Today removes `view=upcoming`.
- Switching Planner to Upcoming sets `view=upcoming`.
- Upcoming defaults to `upcomingView=week`.
- Switching Agenda, Week, Month updates `upcomingView`.
- Opening a date removes `view=upcoming` and sets `planDate=YYYY-MM-DD`.

## Styling Plan

Use the existing Planner visual language.

Keep:

- Dark neutral surface.
- Compact pills.
- Thin dividers.
- Soft amber accent.
- Restrained metadata.
- No nested cards.

Avoid:

- FullCalendar default bright event pills.
- Large default toolbar.
- Multiple competing date navigators.
- Dense wall-of-text day cells.
- Overly colorful category coding.
- Heavy shadows or floating panels.

CSS strategy:

- Scope all FullCalendar overrides under a local class, for example `.planner-upcoming-calendar`.
- Hide the default FullCalendar toolbar.
- Map FullCalendar CSS variables to Life OS tokens where possible.
- Use `border-color: var(--border-subtle)` style tokens already present in Planner styles.
- Keep event chips one-line with ellipsis.
- Preserve keyboard focus outlines.

Example selector strategy:

```css
.planner-upcoming-calendar .fc {
  color: var(--text-primary);
}

.planner-upcoming-calendar .fc-theme-standard td,
.planner-upcoming-calendar .fc-theme-standard th {
  border-color: var(--border-subtle);
}

.planner-upcoming-calendar .fc-event {
  background: transparent;
  border: 0;
}
```

## Interaction Details

### Date Click

Date click should:

- Select the day in Week or Month.
- Show the day detail rail.
- Offer `Open day`.

Double-click behavior is not needed.

### Task Click

Task click should:

- Open `TaskEditSheet` for that task, or a small inspector if we decide edit is too heavy.
- Not navigate away unexpectedly.

Recommended first pass: open `TaskEditSheet`, matching the current `Edit` action.

### Open Day

Open day should call the existing date opener:

```ts
onOpenDate(date);
```

Expected route:

```text
/planner?planDate=YYYY-MM-DD
```

### Drag To Reschedule

Do not add drag-to-reschedule in the first calendar pass.

Add it later only after:

- Event drag is visually clear.
- The task patch mutation is wired to update `scheduledForDate`.
- Query invalidation updates Today, Planner, Inbox, and Upcoming.
- There is a simple undo or confirmation pattern for accidental moves.

## Empty, Loading, And Error States

Loading:

- Use skeleton rows for Agenda.
- Use skeleton calendar cells or a low-contrast calendar placeholder for Week and Month.
- Avoid spinners.

Empty:

- Agenda: "No upcoming work scheduled."
- Week: show the empty week grid and a quiet empty-state line.
- Month: show the month grid with no dots and a quiet empty-state line.

Error:

- Use `InlineErrorState`.
- Keep the retry action.
- Do not replace the whole Planner shell with a page-level error.

## Responsive Behavior

Desktop:

- Header row: title, range summary, Agenda/Week/Month switch.
- Week: full-width 7-day grid.
- Month: full-width month grid with optional right detail rail.
- Selected day detail can sit to the right if there is enough width.

Tablet:

- Calendar stays full width.
- Selected day detail moves below the grid.
- Sub-view switch remains horizontal.

Mobile:

- Sub-view switch becomes full-width.
- Week cells must not force horizontal page overflow.
- Month day cells show dots/counts first, task titles only when space allows.
- Selected day detail appears below the calendar.
- Agenda remains the most readable fallback.

## Accessibility

Requirements:

- The `Agenda | Week | Month` control must be keyboard reachable.
- Calendar task chips need accessible labels with date and title.
- Date cells need clear selected state.
- Focus ring must remain visible on custom-rendered event content.
- Color cannot be the only signal for selected, overdue, or overloaded state.
- Month density indicators should include text labels for assistive tech.

## Implementation Phases

### Phase 1: Prepare Data And State

- Add `UpcomingView` type.
- Add `upcomingView` URL param parsing and cleanup.
- Extract date grouping and event mapping helpers.
- Keep current Agenda UI working while refactoring.
- Verify `npm run typecheck -w client`.

### Phase 2: Add FullCalendar Dependency

- Install stable FullCalendar packages in the client workspace.
- Confirm package versions in `client/package.json` and `package-lock.json`.
- Add a small `UpcomingCalendarView` wrapper.
- Render a minimal month grid with hardcoded empty events first.
- Verify the app builds before task data is attached.

### Phase 3: Implement Week View

- Add `mode="week"` rendering.
- Map scheduled tasks into all-day calendar events.
- Add custom event content.
- Add date click, task click, and selected day detail.
- Make Week the default Upcoming sub-view.
- Keep date-only presentation; no hourly grid.

### Phase 4: Implement Month View

- Add `mode="month"` rendering.
- Use compact task/density rendering.
- Add selected-day detail for dense days.
- Add month range fetching through the calendar visible range callback.
- Keep overflow graceful with `+N more` behavior.

### Phase 5: Polish Agenda And Shared Header

- Move the current grouped list into `UpcomingAgendaView`.
- Add the shared Upcoming header and sub-view switch.
- Ensure Agenda, Week, and Month share empty/error/loading conventions.
- Keep copy minimal.

### Phase 6: Responsive And Visual QA

- Test desktop, tablet, and mobile breakpoints.
- Check long task titles.
- Check days with 0, 1, 3, 8, and 20 tasks.
- Check many recurring tasks.
- Check keyboard focus and selected day state.
- Confirm there are no nested-card visual patterns.

### Phase 7: Verification

Required commands:

```bash
npm run typecheck -w client
npm run build -w client
```

Do not run local dev servers from the agent environment.

Manual checks for the user:

- Open `/planner`.
- Switch to Upcoming.
- Confirm default is Week.
- Switch Agenda, Week, Month.
- Click a future date and confirm it opens that date's Day Planner.
- Click a task and confirm edit behavior.
- Schedule a task from Inbox to a future date and confirm it appears in Upcoming.
- Reschedule a task back to Today and confirm it leaves Upcoming.

## Acceptance Criteria

- Planner has sticky `Today / Upcoming` navigation.
- Upcoming has `Agenda / Week / Month`.
- Week is the default Upcoming view.
- Agenda preserves the current grouped list behavior.
- Week shows scheduled future tasks without an hourly grid.
- Month shows future task density without becoming crowded.
- Clicking a date can open the existing Day Planner for that date.
- Clicking a task opens the edit flow or agreed task inspector.
- The UI fits the existing Life OS Planner design.
- There are no backend schema changes.
- Client typecheck and build pass.

## Future Extensions

Add later, after the base three-view calendar feels good:

- Drag task to another date.
- Keyboard shortcuts for previous/next week or month.
- Day capacity heat indicators.
- Weekly planned minutes summary.
- Recurring-task filter.
- Goal filter.
- Read-only external calendar overlay.
- External calendar sync.
- Calendar export feed.

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| FullCalendar default styling clashes with Life OS | Hide default toolbar, scope overrides, render custom event content |
| Month view gets crowded | Limit visible titles, use dots/counts, show selected-day detail |
| Week view implies time precision that tasks do not have | Use day-grid week, not time-grid week |
| Querying large ranges gets slow | Start with visible ranges, add summary endpoint only if needed |
| URL state becomes messy | Keep `view=upcoming` and `upcomingView=*`; clean invalid params |
| Drag-to-reschedule causes accidental changes | Defer drag until undo/confirmation and invalidation are designed |

## References

- FullCalendar React docs: https://fullcalendar.io/docs/react
- FullCalendar plugin index: https://fullcalendar.io/docs/plugin-index
- FullCalendar DayGrid docs: https://fullcalendar.io/docs/daygrid-view
- FullCalendar custom views docs: https://fullcalendar.io/docs/custom-views
- Schedule-X views docs: https://schedule-x.dev/docs/calendar/views
- Schedule-X custom views docs: https://schedule-x.dev/docs/calendar/advanced/custom-views
