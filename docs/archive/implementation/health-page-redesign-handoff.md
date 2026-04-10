# Health Page Redesign Handoff

## Status

Backend support for the redesigned Health page has been added.

The Health summary API now returns:

- a primary coaching focus
- 2-3 recommendations when there is something to recover
- current-day signals for water, meals, and workout
- a unified `timeline` for today's health activity
- weekly `insights` for consistency and trend display

The frontend redesign has been implemented and now consumes these fields.

---

## Copy-Paste Prompt For Frontend Agent

```md
Redesign and implement the `/health` page so it stops feeling like a generic dashboard made of equal cards.

This page should feel like a focused personal health operating surface: calm, clear, fast to use, and coaching-oriented.

Do not build a card mosaic. Do not keep the current "four equal cards plus one more card" structure. Do not make this look like admin CRUD UI.

You must preserve the existing app visual language where appropriate, but create much stronger hierarchy and a more intentional workflow.

Use the backend fields now available on `GET /api/health/summary?from=<today>&to=<today>`:

- `currentDay.phase`
- `currentDay.signals.water`
- `currentDay.signals.meals`
- `currentDay.signals.workout`
- `currentDay.score`
- `currentDay.timeline`
- `range.insights`
- `guidance.focus`
- `guidance.recommendations`
- `currentDay.latestWeight`
- `currentDay.workoutDay`

Also keep using the existing mutation endpoints for:

- water logs
- meal logs
- workout updates
- weight logs
- meal templates

Design and implement this page with these decisions already made:

1. The page must open with one dominant "Health Pulse" section, not a strip of equal cards.
2. The loudest content should be:
   - today's overall health state
   - the main coaching focus
   - the fastest next action
3. Quick actions must stay easy to reach at all times, especially on mobile.
4. Today's activity must be shown as one unified timeline/feed, not as separate list widgets for each metric.
5. Weekly patterns must be visually grouped into a quieter secondary area.
6. Meal templates must support meal logging, not compete with the page as a primary section.
7. The page should feel like it helps the user improve behavior, not just record logs.

Required layout:

- Top: dominant Health Pulse hero/workspace
- Near top and sticky on mobile: quick action rail
- Middle: unified daily timeline
- Lower: weekly patterns / consistency strip
- Lower or inline: detailed editing and correction states
- Meal templates: integrated into meal logging flow or tucked into a secondary management area

Required experience:

- Water progress should feel immediate and highly tappable.
- Workout state should feel like a meaningful daily decision, not just a segmented control dropped into a box.
- Meal logging should feel guided by templates first, with freeform as a fallback.
- Weight should be treated as trend context, not a dominant page block.

Use restrained motion, strong spacing, and clear hierarchy.
Avoid decorative clutter.
Avoid repeated border-box sections.
Avoid long explanatory copy.

Mobile requirements:

- quick action bar must remain reachable near the bottom
- the hero must still feel like the primary surface
- the timeline should collapse cleanly without becoming tiny cards
- weekly insights should stack below daily activity

Implementation notes:

- update `client/src/shared/lib/api/health.ts` response typing so the frontend can use the new summary fields
- prefer reusing existing mutations instead of inventing new API calls
- if you create new presentational components, keep them focused and avoid monolithic JSX
- preserve edit/delete correction flows for logs, but move them behind better affordances

Acceptance criteria:

- the first impression is no longer "dashboard cards"
- the page clearly tells the user what matters now
- the user can log water, meals, workout, and weight with minimal friction
- the page visually distinguishes primary daily guidance from secondary history
- the new backend guidance and insight fields are visibly used
```

---

## Product Decisions Already Made

These are not open design questions anymore. The frontend implementation should treat them as fixed direction.

### 1. The page is a daily check-in surface

This page is not a reporting dashboard and not a settings page.

Primary job:

- tell the user how their health basics are going today
- tell them what to do next
- let them log it fast

### 2. The page must be coaching-oriented

The page should visibly use the backend coaching output.

That means the UI should surface:

- one primary focus from `guidance.focus`
- follow-up recommendations from `guidance.recommendations`
- at-risk states from `currentDay.signals.*`
- pattern context from `range.insights`

### 3. The page must be card-light

Avoid multiple equal cards.

Allowed:

- one dominant primary surface
- subtle subdividers
- compact inset rows
- segmented regions inside a larger composition

Not allowed:

- four same-weight cards for water, meals, workout, and weight
- a separate full card just to manage meal templates
- dashboard tile grids as the main impression

### 4. The interaction order is fixed

The intended order is:

1. See today's state
2. Understand what matters now
3. Log the next action quickly
4. Review today's activity
5. Check weekly pattern context
6. Make corrections only when needed

---

## Backend Fields To Use

## Summary endpoint

Route:

```txt
GET /api/health/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
```

The redesigned page should call this with today's date for both `from` and `to`.

## New summary shape additions

### `currentDay.phase`

Use for time-aware tone and copy.

Values:

- `morning`
- `midday`
- `evening`

### `currentDay.signals`

Use these in the top Health Pulse area.

`currentDay.signals.water`

- `status`: `on_track | behind | complete`
- `progressPct`
- `remainingMl`
- `paceTargetMl`

`currentDay.signals.meals`

- `status`: `on_track | behind | complete`
- `progressPct`
- `targetCount`
- `nextSuggestedSlot`

`currentDay.signals.workout`

- `status`: `complete | pending | recovery | missed`
- `label`

### `currentDay.score`

This is a health-only score snapshot for today.

Fields:

- `value`
- `label`: `strong | steady | needs_attention`
- `earnedPoints`
- `possiblePoints`

Use this as a supporting cue in the hero, not as a giant separate score dashboard.

### `currentDay.timeline`

This is the main source for the daily activity feed.

Each item includes:

- `id`
- `kind`: `water | meal | workout | weight`
- `occurredAt`
- `title`
- `detail`

This is already normalized for display.
Render it as one unified chronological feed.

### `range.insights`

Use this in the weekly patterns area.

Fields:

- `waterDaysOnTarget`
- `mealLoggingDays`
- `meaningfulMealDays`
- `workoutsMissed`
- `workoutCompletionRate`
- `weightChange`
- `weightUnit`

### `guidance`

`guidance.focus`

- the main message at the top of the page

`guidance.recommendations`

- follow-up actions for recovery or consistency

Each guidance item includes:

- `title`
- `detail`
- `tone`
- `actionLabel`
- `intent`

Use `intent` to wire the CTA to the right part of the page:

- `log_water`
- `log_meal`
- `update_workout`
- `log_weight`
- `review_patterns`

---

## Existing Endpoints Still In Use

Keep using these for write actions:

- `POST /api/health/water-logs`
- `PATCH /api/health/water-logs/:waterLogId`
- `DELETE /api/health/water-logs/:waterLogId`
- `POST /api/health/meal-logs`
- `PATCH /api/health/meal-logs/:mealLogId`
- `DELETE /api/health/meal-logs/:mealLogId`
- `PUT /api/health/workout-days/:date`
- `POST /api/health/weight-logs`
- `PATCH /api/health/weight-logs/:weightLogId`
- `DELETE /api/health/weight-logs/:weightLogId`
- `GET /api/health/meal-templates`
- `POST /api/health/meal-templates`
- `PATCH /api/health/meal-templates/:mealTemplateId`

---

## Recommended UI Structure

### A. Health Pulse

This is the main surface.

It should include:

- title for the day state
- `guidance.focus.title`
- `guidance.focus.detail`
- a compact visual for water, meals, and workout
- one primary CTA from `guidance.focus.actionLabel`

This section should visually dominate the page.

### B. Quick Action Rail

Required actions:

- `+250ml`
- `+500ml`
- `Log meal`
- `Update workout`
- `Log weight`

Behavior:

- always visible near the top on desktop
- sticky near the bottom on mobile

### C. Daily Timeline

Use `currentDay.timeline`.

This should replace the current separate log lists as the main reading surface.

Keep correction affordances available, but quieter:

- tap a row to edit
- secondary action for delete

### D. Weekly Patterns

Use `range.insights`.

Recommended content:

- hydration consistency
- meal logging consistency
- workout completion
- weight direction

This area should be calmer and smaller than the top Health Pulse.

### E. Meal Logging Experience

Templates should be first-class inside the meal logging flow.

That means:

- show template shortcuts when opening meal logging
- keep freeform as a fallback
- do not leave meal templates as a full-width primary card at the bottom

If template management still needs a visible place, tuck it into:

- an expandable section
- a side panel
- a secondary management area

### F. Weight Area

Weight is supporting context, not the hero.

Use:

- latest value
- trend direction from `range.insights.weightChange`
- quick add/edit affordance

Do not give it equal weight with the main daily action surface.

---

## Visual Direction

Tone:

- calm
- precise
- athletic
- premium

Hierarchy:

- one dominant section
- one sticky action layer
- one timeline
- one secondary insights zone

Avoid:

- generic dashboard grid
- many equal borders
- stacked cards with repeated headings
- admin-panel feeling
- noisy decorative gradients

Motion:

- subtle entrance for the hero
- clear action feedback on quick logging
- restrained transitions for opening editors

Typography:

- strong display treatment only in the hero
- compact utility copy elsewhere
- status copy should be short and plain

---

## Implementation Notes For Frontend

### Update local API typing

The frontend currently uses inline response types in:

[client/src/shared/lib/api/health.ts](/home/ubuntu/Development/life-os-worktrees/agent-b/client/src/shared/lib/api/health.ts)

That file must be updated to include the new `summary` fields before the page can use them.

### Do not wait on backend

The backend already supports:

- coaching focus
- recommendations
- unified timeline
- weekly insights

The frontend should consume them directly.

### Preserve existing write behavior

Do not rewrite the mutation model unless necessary.

The main change is:

- layout
- hierarchy
- action placement
- log presentation
- meal template placement

---

## Acceptance Checklist

- The first visible impression is a Health Pulse, not a card grid.
- The page clearly answers "how am I doing today?" and "what should I do next?"
- Quick actions are always reachable.
- Today's activity is shown as one combined feed.
- Weekly patterns are visible without overpowering the daily flow.
- Meal templates help logging instead of acting like their own dashboard section.
- The redesign visibly uses `guidance.focus`, `guidance.recommendations`, `currentDay.timeline`, and `range.insights`.
- Mobile keeps the primary action rail easy to reach.
