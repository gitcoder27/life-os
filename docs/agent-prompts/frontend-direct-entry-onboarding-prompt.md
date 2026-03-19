# Frontend Copilot Prompt

You are editing the frontend of the Life OS repository through GitHub Copilot CLI.

Objective:
- Remove forced first-run onboarding, send authenticated users directly into the app, keep onboarding as an optional Settings-only fallback, and add in-app habits/routines setup so a fresh account is fully usable.

Repository context:
- Frontend stack: React + TypeScript + Vite in `client/`
- Shared contracts live in `packages/contracts/`
- Backend work for this change has already been completed outside this prompt
- Backend contract update: `GET /api/onboarding/state` now returns `isRequired: false` in addition to the existing onboarding fields
- Do not assume onboarding completion is needed to access the main app

Editable paths:
- `client/src/app/router.tsx`
- `client/src/features/auth/LoginPage.tsx`
- `client/src/features/onboarding/OnboardingPage.tsx`
- `client/src/features/settings/SettingsPage.tsx`
- `client/src/features/habits/HabitsPage.tsx`
- `client/src/shared/lib/api.ts`
- `client/src/styles.css`

Do not touch:
- `server/`
- `packages/contracts/`
- database schema
- unrelated files with existing dirty changes

Current behavior:
- After login, the router checks onboarding state and redirects incomplete users to `/onboarding`
- `/onboarding` is treated as mandatory first-run setup
- Login shows a `First-time setup` action that links to onboarding
- Settings manages core preferences, but onboarding still owns first-time setup positioning
- Habits page supports check-ins for habits and routines already in the system, but it does not provide real create/edit/archive management for habits or routines

Target behavior:
- Any authenticated user lands on `/` after sign-in, regardless of onboarding completion
- Main application routes are available even when onboarding is incomplete
- `/onboarding` remains available only as an optional authenticated route for users who have not completed it
- Completed users who visit `/onboarding` should still be redirected away from it
- Login no longer advertises first-time setup
- Settings becomes the only visible place that surfaces optional onboarding for incomplete users
- Onboarding copy should be reframed as optional starter setup, not a required first-run blocker
- Habits page must support managing a blank account:
  - create habit
  - edit habit
  - archive habit
  - create routine
  - edit routine
  - archive routine
- Existing check-in flows for habits and routine items must continue to work

Behavior requirements:
- Router:
  - Remove onboarding gating from normal protected routes
  - Keep session protection intact
  - Authenticated visits to `/login` should redirect to `/`
  - `/onboarding` should remain accessible only for authenticated users with incomplete onboarding
- Login:
  - Remove the `First-time setup` CTA
  - Keep the current sign-in flow otherwise unchanged
- Settings:
  - If onboarding state indicates `isComplete === false`, show a clear but low-emphasis CTA to open optional onboarding
  - Position it as optional starter setup/import, not required completion
  - Do not show that CTA once onboarding is complete
- Onboarding page:
  - Update titles, subtitles, and helper copy so the page reads as optional setup
  - Preserve the existing multi-step data submission flow and backend payload shape
- Habits page:
  - Add a habit management section with forms/actions using the existing habits APIs
  - Add a routines management section with forms/actions using the existing routines APIs
  - Support empty-account states cleanly so a new user can configure the first habit and first routine from this page
  - Preserve current check-in sections and consistency view

Backend/API details you can rely on:
- `GET /api/onboarding/state` response includes:
  - `isRequired: false`
  - `isComplete: boolean`
  - `completedAt: string | null`
  - `nextStep: string | null`
  - `defaults: ...`
- Existing onboarding completion endpoint is unchanged:
  - `POST /api/onboarding/complete`
- Existing Settings endpoints are unchanged:
  - `GET /api/settings/profile`
  - `PUT /api/settings/profile`
- Existing Habits/Routines endpoints are already available and should be used from the frontend:
  - `GET /api/habits/habits`
  - `POST /api/habits/habits`
  - `PATCH /api/habits/habits/:habitId`
  - `POST /api/habits/routines`
  - `PATCH /api/habits/routines/:routineId`
  - Existing check-in endpoints remain unchanged

Design and UX constraints:
- Preserve the existing visual system unless a local UI addition needs refinement
- Keep the new Settings CTA understated; this is optional setup, not a warning state
- Make blank-state habits/routines management feel intentional and usable, not like admin scaffolding
- Prefer inline management patterns that fit the current app rather than modal-heavy flows unless the existing page already uses modals/forms in a compatible way
- Keep behavior accessible and responsive
- Do not revert unrelated local changes
- If a required backend API is missing, stop and report the blocker instead of inventing it

Validation:
- `cd client && npm run build`

Deliverables:
- Apply the code changes directly
- At the end, list the files changed
- Summarize any follow-up work or risks in 3 bullets or fewer
