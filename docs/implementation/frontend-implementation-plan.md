# Frontend Implementation Plan

## Scope Summary

Build a responsive, production-ready Life OS web client with a distinctive "Observatory" design aesthetic. The app is a personal command center supporting daily score tracking, habits, health basics, finance visibility, goals, and structured daily/weekly/monthly reviews. All screens run against typed mock data first, with real API integration deferred to Phase 4.

---

## Phase 0: Foundation and Shell

### Objective
Establish the app scaffold, design system, routing, providers, and responsive shell.

### Owned Files
- `client/index.html`
- `client/src/styles.css` (design system)
- `client/src/app/**` (router, providers, shell)
- `client/src/shared/ui/**` (primitives)
- `client/src/shared/lib/demo-data.ts`

### Dependencies on Backend
- None. Fully mocked.

### Major Risks
- Font loading FOIT on slow connections (mitigated by `display=swap`)
- CSS-only animation performance on low-end mobile

### Definition of Done
- All MVP routes render in shared shell
- Sidebar + mobile bottom nav work
- Quick capture sheet opens/closes
- Design tokens, typography, and color system applied globally
- Stagger animations work on page entrance

---

## Phase 1: Home and Today

### Objective
Deliver the two core daily surfaces: the Home command center and Today execution view.

### Owned Files
- `client/src/features/home/**`
- `client/src/features/today/**`
- `client/src/shared/ui/ScoreRing.tsx`

### Dependencies on Backend
- `GET /api/home/overview` DTO shape (mocked)
- `GET /api/planning/days/:date` DTO shape (mocked)

### Major Risks
- Score ring SVG rendering differences across browsers

### Definition of Done
- Home shows animated score ring, attention items, priorities, tasks, routines, health snapshot, finance snapshot
- Today shows priority stack, task lane, time blocks, meal/workout plan
- Both pages are mobile-responsive

---

## Phase 2: Habits, Health, and Finance

### Objective
Build the three domain tracking screens with interactive elements and quick-action flows.

### Owned Files
- `client/src/features/habits/**`
- `client/src/features/health/**`
- `client/src/features/finance/**`

### Dependencies on Backend
- Habit list and completion mutations
- Health summary and water/meal/workout endpoints
- Expense list and create endpoints

### Major Risks
- Optimistic UI rollback complexity

### Definition of Done
- Habits page shows due today with one-tap completion, routines, streaks
- Health page shows water tracker with progress bar, meal logs, workout status, weight trend
- Finance page shows spend summary, category grid, recent expenses, recurring bills

---

## Phase 3: Goals and Reviews

### Objective
Complete the planning and reflection surfaces with form-driven review flows.

### Owned Files
- `client/src/features/goals/**`
- `client/src/features/reviews/**`

### Dependencies on Backend
- Goals and priorities DTOs
- Review prefill DTOs by cadence
- Review submit mutation

### Major Risks
- Draft persistence reliability across refresh
- Review form completion gating logic

### Definition of Done
- Goals page shows life-area goals, weekly priorities, monthly focus
- Review pages work for daily, weekly, monthly cadences
- Progress indicator shows completion state
- Required field gating is visually clear

---

## Phase 4: Real API Integration and Polish

### Objective
Replace mock data with real API hooks, harden error/loading states, polish responsive layout.

### Owned Files
- All `client/src/**`

### Dependencies on Backend
- All endpoints documented in `api-contracts.md`

### Major Risks
- Contract drift between frontend mocks and actual backend responses

### Definition of Done
- Shell, routes, and forms run against real backend APIs
- Loading, empty, and error states work on every screen
- Accessibility baseline met (keyboard nav, focus management, labels)
- Mobile and desktop layouts polished
