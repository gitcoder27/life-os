# Screen Specs

This document gives wireframe-level frontend specs for the MVP screens. It is meant to be detailed enough for a frontend AI agent to implement without guessing page responsibility or component boundaries.

## Screen inventory

| Route or surface | Status | Notes |
| --- | --- | --- |
| `/login` | Required | Separate auth layout |
| `/onboarding` | Required | First-run wizard only |
| `/` | Required | Home dashboard |
| `/today` | Required | Focused execution view |
| `/habits` | Required | Habit and routine management |
| `/health` | Required | Health basics tracking |
| `/finance` | Required | Expense and spend visibility |
| `/goals` | Required | Goals, weekly priorities, monthly focus |
| `/reviews/:cadence` | Required | `daily`, `weekly`, `monthly` |
| `Quick Capture` | Required | Global modal or bottom sheet |

## 1. Login

### Purpose

Authenticate the single owner account quickly and clearly.

### Layout

- centered auth card
- email field
- password field
- submit button
- small help text for self-hosted owner access

### Primary states

- initial
- submitting
- invalid credentials
- server unavailable

### Frontend notes

- keep this page outside the main shell
- no sign-up UI
- no password-reset UI in MVP

## 2. Onboarding

### Purpose

Create the user's initial Life OS setup.

### Steps

1. life priorities
2. top goals
3. routines and habits
4. health defaults
5. expense categories
6. review preferences

### Layout

- stepper header
- one major form section per step
- sticky footer with back and next controls

### Output

- starter habits
- starter routines
- dashboard seed data
- review defaults
- quick-capture templates

### Frontend notes

- persist drafts locally
- show progress across steps
- keep each step lightweight

## 3. Home

### Purpose

Answer "what is going on today and what should I do next?"

### Major sections

- greeting, date, and context header
- Daily Score module
- attention panel
- top 3 priorities
- lightweight task list
- routine progress
- health snapshot
- finance snapshot
- review and carry-forward prompts

### Key components

- `ScoreCard`
- `AttentionList`
- `PriorityStack`
- `TaskMiniList`
- `RoutineCard`
- `HealthSnapshotCard`
- `FinanceSnapshotCard`
- `QuickCaptureTrigger`

### Data dependencies

- daily aggregate dashboard payload
- score summary and reasons
- tasks or reminders due today
- routine completion summary
- health basics summary
- finance summary
- review-state summary

### Empty states

- no priorities yet
- no health plan yet
- no finance categories yet

### Mobile notes

- score, attention, and priorities stay above the fold
- lower-priority sections stack vertically
- keep quick capture reachable at all times

## 4. Today

### Purpose

Support focused execution for the current day.

### Major sections

- priorities with reorder support
- today's task list
- optional time blocks or plan list
- meals and workout plan summary
- notes and reminders

### Key components

- `TodayPriorityEditor`
- `TodayTaskList`
- `TimeBlockList`
- `MealPlanCard`
- `WorkoutPlanCard`
- `TodayNotes`

### Data dependencies

- today's plan payload
- priority list
- task list for today
- workout status
- planned meals or meal placeholders

### Interaction rules

- reordering priorities should feel immediate
- completing a task should update Home and score context after sync
- carry-forward actions should route naturally into daily review

### Mobile notes

- use drag handles carefully; provide tap-based reorder fallback
- notes collapse behind an accordion

## 5. Habits

### Purpose

Manage habits and routines without clutter.

### Major sections

- morning routine
- evening routine
- habits due today
- all habits list
- streak and consistency summaries

### Key components

- `RoutineChecklist`
- `HabitRow`
- `HabitStatsCard`
- `HabitEditorModal`

### Data dependencies

- habits due today
- routine definitions
- streaks and consistency values
- category metadata

### Interaction rules

- one-tap completion for due items
- editing should not require leaving the page
- streaks should be visible but not dominate the screen

## 6. Health

### Purpose

Track core physical inputs with very low friction.

### Major sections

- water target and progress
- meals logged today
- workout or recovery status
- body weight trend

### Key components

- `WaterProgressCard`
- `MealLogList`
- `WorkoutStatusCard`
- `WeightTrendCard`
- `QuickHealthActionBar`

### Data dependencies

- today's water progress
- meal log entries
- workout plan or status
- recent body weight history

### Interaction rules

- water increments must be very fast
- workout status change should be one or two taps
- meal log creation should reuse quick templates

### Mobile notes

- quick health actions stay sticky near bottom
- charts should collapse to compact summaries first

## 7. Finance

### Purpose

Show spending clearly and make expense logging painless.

### Major sections

- current-period spend summary
- category spend tiles
- recent expenses
- recurring payments or upcoming bills

### Key components

- `SpendSummaryCard`
- `CategorySpendGrid`
- `ExpenseList`
- `RecurringPaymentsCard`
- `ExpenseEditorModal`

### Data dependencies

- current-period totals
- category breakdown
- recent expense records
- recurring expense summaries

### Interaction rules

- expense entry should open from both page and global quick capture
- edits should happen inline or in modal without route change
- category summary should be readable at a glance

## 8. Goals

### Purpose

Hold direction without becoming a heavy project-management surface.

### Major sections

- goals by life area
- weekly priorities
- monthly focus
- linked current priorities

### Key components

- `GoalListByArea`
- `WeeklyPriorityCard`
- `MonthlyFocusCard`
- `GoalEditorModal`

### Data dependencies

- goals grouped by area
- weekly priorities
- monthly focus
- lightweight link view to current priorities

### Interaction rules

- keep this page structurally simple
- emphasize editing focus over analytics
- do not introduce complex milestone trees in MVP

## 9. Reviews

### Purpose

Run the daily, weekly, and monthly review flows from a shared screen system.

### Route model

- `/reviews/daily`
- `/reviews/weekly`
- `/reviews/monthly`

### Shared layout

- cadence header
- prefilled summary section
- guided prompt sections
- output section
- sticky save or submit footer

### Shared components

- `ReviewSummaryPanel`
- `ReviewPromptGroup`
- `ReviewProgress`
- `ReviewOutputPanel`
- `ReviewDraftBanner`

### Daily review specifics

- summary shows Daily Score and incomplete items
- friction tag picker is required
- carry-forward selector is required
- tomorrow top 3 editor is required

### Weekly review specifics

- summary shows weekly averages and top friction tags
- next-week top 3 editor is required
- focus habit and spending watch are present

### Monthly review specifics

- summary shows trend over the month
- monthly theme and three outcomes are required
- life-area ratings are required

### Frontend notes

- each cadence should reuse the same shell and validation engine
- drafts must survive refresh or accidental navigation
- required sections should be visually obvious

## 10. Quick Capture

### Purpose

Provide one global low-friction entry point for common actions.

### Presentation

- desktop: modal
- mobile: bottom sheet

### Event types

- task
- expense
- water
- meal
- workout status
- weight
- note
- reminder

### Shared fields

- type
- date or time if needed
- optional note

### Type-specific rules

- water should support single-tap presets
- workout status should use a segmented control
- expense should default date to today and remember last category
- task and reminder should support fast due-today creation

### Frontend notes

- switching event types should not reset shared fields unnecessarily
- recent templates should appear first
- submissions should close fast and give clear confirmation

## Cross-screen UX rules

- Home and Today should update quickly after quick actions.
- All screens should support loading, empty, and error states.
- Scores and attention cards must remain readable on small screens.
- Dense data should collapse before horizontal scrolling is introduced.
- Modals and bottom sheets must manage focus correctly.
