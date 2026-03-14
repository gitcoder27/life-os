# Frontend Checklist

## Phase 0: Foundation and Shell

- [x] Project scaffold (Vite + React + TypeScript)
- [x] React Router with all MVP routes
- [x] TanStack Query provider
- [x] App shell with sidebar navigation
- [x] Mobile bottom navigation
- [x] Quick capture sheet (global)
- [x] Design tokens and CSS custom properties
- [x] Typography system (Fraunces + Plus Jakarta Sans)
- [x] Base component primitives (PageHeader, SectionCard, MetricPill)
- [x] ScoreRing SVG component
- [x] Stagger animation system
- [x] Mock data layer with typed fixtures
- [x] Responsive breakpoints (mobile / tablet / desktop)

## Phase 1: Home and Today

- [x] Home: animated score ring with daily score
- [x] Home: attention panel with rule-driven items
- [x] Home: top 3 priorities with done/open state
- [x] Home: task lane
- [x] Home: routine progress cards
- [x] Home: health snapshot
- [x] Home: finance snapshot
- [x] Home: metric pills (momentum, streak, review readiness)
- [x] Today: priority stack with reorder UI
- [x] Today: task list with completion
- [x] Today: time blocks
- [x] Today: meals and training status

## Phase 2: Habits, Health, Finance

- [x] Habits: due today with one-tap completion buttons
- [x] Habits: morning routine checklist
- [x] Habits: evening routine checklist
- [x] Habits: streak badges
- [x] Health: water tracker with progress bar
- [x] Health: meal log list
- [x] Health: workout status card
- [x] Health: weight trend entries
- [x] Health: quick action bar
- [x] Finance: spend summary header
- [x] Finance: category spend grid
- [x] Finance: recent expenses list
- [x] Finance: recurring payments section
- [x] Finance: add expense trigger

## Phase 3: Goals and Reviews

- [x] Goals: life-area goal cards
- [x] Goals: monthly focus card
- [x] Goals: weekly priorities
- [x] Reviews: cadence-aware routing (daily/weekly/monthly)
- [x] Reviews: prefilled summary panel
- [x] Reviews: guided prompt form fields
- [x] Reviews: progress indicator
- [x] Reviews: save draft / submit controls
- [ ] Reviews: draft persistence across refresh

## Phase 4: Integration and Polish

- [ ] Replace mock data with real API hooks
- [ ] Loading states for all screens
- [ ] Error states with retry
- [ ] Empty states with next-action prompts
- [ ] Accessibility pass (keyboard nav, focus management, labels)
- [ ] Responsive polish pass
- [ ] Frontend tests for critical flows

## Blocked by Backend

- Session and auth endpoints (login guard)
- Onboarding state and completion endpoints
- Home overview aggregate payload
- Today plan aggregate payload
- Habit completion mutations
- Health summary and mutation endpoints
- Expense endpoints
- Review prefill and submit endpoints
- Score and momentum endpoints
