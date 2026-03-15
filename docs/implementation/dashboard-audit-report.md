# Dashboard Audit Report

## Purpose

This document converts the current product audit into an implementation plan.

The goal is not just to list defects. The goal is to define:

- what the app already does well
- where the real gaps are
- what behavior should change
- which features should be added or deepened
- what order the work should happen in

This should be treated as the working backlog for improving the current Life OS dashboard into a reliable daily operating system.

## Executive Summary

Life OS already has strong breadth:

- real onboarding
- real authentication
- real planning cycles
- real habits, health, finance, reviews, scoring, and notifications on the backend
- a coherent dashboard shell on the frontend

The main issue is not lack of modules. The main issue is incomplete loops.

The backend is ahead of the frontend. Many important workflows are only partially surfaced in the UI, and some calculations are not yet trustworthy enough for daily reliance.

The product currently feels like:

- a good command-center shell
- a decent logging tool
- a partial planning system
- an incomplete execution and review loop

The highest-value work is:

1. fix trust issues
2. close the daily planning and review loops
3. make the strongest backend capabilities actually usable in the UI
4. improve speed, correction, and gamification

## Current Strengths

### Product strengths

- Clear information architecture: Home, Today, Habits, Health, Finance, Goals, Reviews, Quick Capture.
- Good product concept: a personal operating system rather than separate disconnected trackers.
- Strong onboarding depth relative to the rest of the app.
- Good cross-domain model: planning, execution, reflection, and scoring already exist.

### Backend strengths

- Most core domains are persisted in the database.
- Planning cycles, tasks, habits, routines, reviews, expenses, recurring bills, notifications, and scores are real.
- Daily review already seeds tomorrow priorities.
- Recurring expense templates materialize into admin items.
- Notifications and scoring already have backend logic.

### Frontend strengths

- The shell and visual structure are coherent.
- Home is a strong summary page.
- Habits and Health feel the most operational today.
- Quick Capture is globally accessible.

## Main Product Problem

The system is broad, but several critical loops are broken or only half-implemented:

- priorities exist but are not fully actionable
- reviews exist but do not fully drive planning outcomes in the UI
- notifications exist but are barely surfaced
- goals exist but are mostly read-only
- scoring exists but some rules are inaccurate or misleading
- corrections and edit flows are weak

Because of that, the app can show a lot, but it does not always help the user complete the full cycle:

1. decide what matters
2. execute during the day
3. close the day cleanly
4. seed the next day or week
5. trust the score and feedback

## Audit Principles

All future work should be judged against these product principles:

- Home must answer: what matters now, what is at risk, what should I do next?
- Today must be operational, not informational.
- Logging must be faster than the mental friction of remembering later.
- Reviews must create decisions, not just notes.
- Scoring must feel fair, transparent, and hard to game.
- Every important record must be editable or correctable.
- Time-sensitive behavior must respect the user's timezone, not server UTC.

## Feature Status By Area

| Area | Current State | Assessment |
| --- | --- | --- |
| Auth | Implemented and sufficient for single-owner private deployment | Good |
| Onboarding | Deep and useful; seeds real data | Good |
| Home | Strong summary surface, but some cards are passive | Good but partial |
| Today | Important page, but priorities are not operational | Partial |
| Habits | Good one-tap use, but weak management depth | Good but partial |
| Health | Useful logging, but editing/correction is weak | Good but partial |
| Finance | Good basic visibility, but entry and maintenance flows are shallow | Partial |
| Goals/Planning | Data model exists, UI is mostly read-only | Partial |
| Reviews | Good structure, weak operational closure | Partial |
| Notifications | Backend exists, frontend exposure is weak | Partial |
| Quick Capture | Useful, but some types are fake distinctions | Partial |
| Scoring | Strong concept, some calculation bugs and trust issues | Partial |
| Preferences/Settings | Mostly trapped inside onboarding | Missing as a standalone area |

## Detailed Gaps And Recommended Changes

## 1. Reliability And Trust

### Problems

- Workspace typecheck is failing even though tests pass.
- Some calculations are incorrect or overly simplified.
- Timezone data is stored but not properly used.
- Query behavior is brittle and UI error handling is thin.

### Why this matters

A personal operating system fails if the user doubts the numbers, timing, or saved state.

### Recommended changes

- Fix all typecheck failures and make `npm run typecheck` a hard requirement before shipping changes.
- Audit all score and summary calculations before adding more gamification.
- Make all day/week/month boundaries timezone-aware using the user's stored timezone.
- Add explicit error states, empty states, and retry actions for every primary page.
- Improve mutation feedback so saves feel confirmed and recoverable.

### Acceptance criteria

- Typecheck, build, and tests all pass.
- Home, Today, Habits, Health, Finance, Goals, and Reviews each show loading, empty, and error states.
- Day-based summaries reflect the user's timezone.
- Score changes can be explained by visible actions.

## 2. Home Dashboard

### Problems

- Home summarizes well but many cards do not lead into action.
- Notifications exist in data but are not surfaced meaningfully.
- Attention items are informative, not actionable.

### Recommended target behavior

Home should be the command center for the day:

- top priorities should be clickable and actionable
- attention items should take the user directly to the relevant fix
- notifications should open a real panel or page
- score changes should be understandable from Home

### Recommended changes

- Add an actionable notifications drawer or notifications page.
- Turn attention cards into direct actions:
  - open task
  - mark due habit complete
  - open review
  - open bill/admin item
- Show score delta hints:
  - what improves score right now
  - what is currently dragging score down
- Add quick actions inline on Home:
  - complete priority
  - mark task done
  - log water
  - open daily review

### Acceptance criteria

- A user can handle most urgent daily actions from Home without jumping through multiple pages.
- Notifications are readable, dismissible, and markable as read from the UI.
- Attention cards are interactive, not decorative.

## 3. Today Page

### Problems

- The most important area, priorities, is not operational.
- Priority buttons are disabled.
- Today is missing drag/reorder, carry-forward, and realistic execution support.

### Recommended target behavior

Today should be the main execution screen.

The user should be able to:

- reorder priorities
- mark priorities complete
- drop a priority
- move a priority to tomorrow
- manage tasks underneath the priorities
- quickly adjust the day when reality changes

### Recommended changes

- Add priority completion and drop actions.
- Add reorder support for top 3 priorities.
- Add carry-forward and reschedule actions for tasks directly from Today.
- Show clearer separation between priorities and tasks.
- Add lightweight notes for the day if needed.
- Add real time-block support if due times exist.

### Acceptance criteria

- A user can fully run their day from Today.
- The top 3 priorities are editable, reorderable, and completable.
- Incomplete tasks can be moved forward without using the review form.

## 4. Goals And Planning

### Problems

- Goals page is mostly a passive summary.
- Backend supports more than the UI exposes.
- Monthly and weekly planning exist but feel read-only.

### Recommended target behavior

Goals and Planning should remain lightweight, but must be operational enough to guide the week and month.

The user should be able to:

- create and edit goals
- pause or complete goals
- set weekly priorities
- set monthly theme and outcomes
- link priorities to goals where useful

### Recommended changes

- Add create/edit/complete/pause goal actions.
- Add weekly planning editor.
- Add monthly theme and outcome editor.
- Surface goal linkage on Today and Home where relevant.
- Add simple domain filters for goals.

### Acceptance criteria

- Goals are no longer just display objects.
- Weekly priorities and monthly focus can be updated entirely from the UI.
- At least some day priorities can be linked to goals.

## 5. Reviews

### Problems

- Review UI looks deeper than it is.
- Save draft does nothing.
- Progress UI does not reflect real progress.
- Daily review does not expose carry-forward, drop, or reschedule decisions in the UI.
- Monthly and weekly reviews are too text-area heavy relative to operational outcomes.

### Recommended target behavior

Reviews should produce decisions, not just journal text.

Daily review should:

- close the day
- classify unfinished tasks
- seed tomorrow priorities
- finalize score

Weekly review should:

- summarize patterns
- produce next-week priorities
- choose a focus habit
- choose a spending watch area

Monthly review should:

- define the next month theme
- define top outcomes
- simplify the system

### Recommended changes

- Implement real draft saving.
- Replace fake progress indicators with actual completion indicators.
- Add task decision UI to daily review:
  - carry forward
  - reschedule
  - drop
- Add explicit next-week and next-month planning outputs.
- Reduce freeform fields where selection or structured inputs are better.
- Show the actual result of review submission:
  - tomorrow priorities created
  - score finalized
  - next week seeded
  - month focus updated

### Acceptance criteria

- Reviews visibly change future planning state.
- Users can finish a daily review without manually retyping task decisions.
- Reviews feel short, decisive, and worth doing.

## 6. Habits And Routines

### Problems

- Logging is good, management is shallow.
- Habit due logic and scoring do not consistently respect schedules.
- Weak “at risk” signaling.

### Recommended target behavior

Habits should support both execution and management.

The user should be able to:

- create and edit habits
- pause/archive habits
- adjust schedules
- see which habits are at risk
- understand streaks clearly

### Recommended changes

- Respect `daysOfWeek` and other schedule rules everywhere:
  - daily summaries
  - scoring
  - reviews
  - streak logic
- Add habit editor UI.
- Add routine editor UI.
- Show “due today”, “completed today”, and “not due” separately.
- Add habit risk indicators:
  - streak about to break
  - low completion trend
  - skipped recently

### Acceptance criteria

- Habit due logic is correct everywhere.
- The habits page supports both logging and management.
- Streaks are fair and understandable.

## 7. Health

### Problems

- Logging is decent, but correction is weak.
- Meal system is too thin in the UI compared to backend capability.
- Weight entry uses prompt-based interaction.

### Recommended target behavior

Health should stay lightweight, but it needs better maintenance and correction:

- fast logging
- easy editing
- clearer templates
- a trustworthy daily picture

### Recommended changes

- Replace prompt-based weight entry with inline or modal entry.
- Add edit/delete for water, meal, and weight logs.
- Improve meal templates:
  - manage templates
  - choose template vs freeform meal
- Show simple trends:
  - 7-day water consistency
  - workout completion rate
  - recent weight trend

### Acceptance criteria

- A user can correct any mistaken health log without developer help.
- Meal templates are usable from the UI.
- Health remains fast, not complicated.

## 8. Finance

### Problems

- Expense visibility is decent, but entry is primitive.
- Categories and recurring expenses are not deeply manageable.
- Finance/admin relationship is not fully surfaced in UX.

### Recommended target behavior

Finance should remain intentionally lightweight, but the following must work cleanly:

- quick expense logging
- category assignment
- recurring bill setup
- upcoming bills handling
- correction of mistakes

### Recommended changes

- Replace prompt-based expense entry with a proper inline or modal form.
- Add category picker to expense creation.
- Add create/edit/archive for expense categories.
- Add create/edit/pause/archive for recurring expenses.
- Surface upcoming bills in a more actionable way:
  - mark done
  - reschedule
  - convert to expense
- Add budget guardrails later only after core accuracy is trusted.

### Acceptance criteria

- Expense logging is fast and structured.
- Recurring expense templates are manageable from the frontend.
- Bills and finance/admin tasks have a clear UI flow.

## 9. Quick Capture

### Problems

- Some capture types are not truly distinct.
- `Note` and `Reminder` collapse into generic task creation.
- Capture does not take full advantage of templates and defaults.

### Recommended target behavior

Quick Capture should be the fastest interaction in the app.

It should support:

- task
- expense
- water
- meal
- workout
- weight
- note
- reminder

But each type should either be meaningfully distinct or removed.

### Recommended changes

- Decide whether `Note` and `Reminder` are true entities or just task variants.
- If they stay:
  - define how they differ
  - define where they show up
  - define what reminder timing means
- Add recent templates and smart defaults.
- Add keyboard-first capture flow on desktop.
- Add context-aware suggestions:
  - common expense categories
  - favorite meals
  - common workouts

### Acceptance criteria

- Every capture type has a meaningful downstream behavior.
- Common capture actions take seconds, not friction-heavy prompts.

## 10. Notifications

### Problems

- Backend supports notifications, frontend barely uses them.
- No meaningful notification inbox or workflow.

### Recommended target behavior

Notifications should support behavior, not noise.

They should tell the user:

- what needs action
- why it matters
- where to resolve it

### Recommended changes

- Add a real notifications panel or page.
- Support read, dismiss, and open-linked-entity flows.
- Show notification severity clearly.
- Avoid duplicate noise.
- Later, allow notification preference controls.

### Acceptance criteria

- Notifications are visible and actionable.
- They help attention, not clutter it.

## 11. Scoring And Gamification

### Problems

- The scoring concept is strong, but trust issues remain.
- Some rules are inaccurate.
- The frontend does not fully convert score into motivation.

### Recommended target behavior

Scoring should feel like a transparent discipline system:

- fair
- understandable
- motivating
- difficult to game

### Recommended changes

- Fix rule correctness first:
  - scheduled habit logic
  - water target calculations
  - routine completion math
  - timezone boundaries
- Add richer visible score explanations:
  - points earned
  - points missed
  - next best action
- Add lightweight gamification improvements:
  - strong day streak
  - review completion streak
  - weekly quest or focus challenge
  - recovery messaging after a bad day
  - “protect the streak” prompts
- Avoid shallow gamification:
  - badges without behavioral meaning
  - too many micro-rewards
  - arbitrary XP inflation

### Acceptance criteria

- The user can explain score movement on most days.
- Score encourages useful behavior, not checkbox gaming.

## 12. Settings And Preferences

### Problems

- Preferences are mostly trapped in onboarding.
- There is no obvious place to adjust defaults later.

### Recommended changes

- Add a simple Settings area for:
  - timezone
  - currency
  - week start day
  - water target
  - review window
  - display name
- Later add notification preferences and habit defaults.

### Acceptance criteria

- A user can adjust system defaults after onboarding without manual database or code changes.

## 13. Security And Data Integrity

### Problems

- Some linked entity ownership checks are inconsistent.
- Contract drift risk exists because some server modules redefine shapes locally.

### Recommended changes

- Audit all create/update endpoints for ownership validation:
  - goal IDs
  - category IDs
  - habit IDs
  - meal template IDs
  - review-linked entities
- Move more request/response typing back to `@life-os/contracts`.
- Add tests for ownership validation and invalid cross-user references.

### Acceptance criteria

- No write path accepts foreign entity references without validation.
- Contracts are the source of truth, not per-module local shape drift.

## Ideal User Workflows

## Morning workflow

- Open Home.
- See score, attention items, and top priorities.
- Open Today if reprioritization is needed.
- Complete morning routine and first key habit.
- Log first water quickly.

## During-day workflow

- Use Today as the active execution lane.
- Use Quick Capture instead of holding tasks in memory.
- Log health and finance events with low friction.
- Use Home only for periodic status checks.

## Evening workflow

- Finish health and expense logging.
- Open daily review.
- Decide for each unfinished task:
  - done
  - carry forward
  - reschedule
  - drop
- Confirm tomorrow's top 3.
- Finalize the day and score.

## Weekly workflow

- Review score trend and friction themes.
- Select one focus habit for the next week.
- Reset weekly priorities.
- Choose spending watch area if needed.

## Monthly workflow

- Review momentum and leakage patterns.
- Set month theme.
- Define three outcomes.
- remove low-value commitments

## Prioritized Delivery Plan

## Phase 0: Trust And Foundations

### Goal

Make the current app trustworthy enough for serious daily use.

Status: implemented.

### Tasks

- [x] Fix all typecheck failures.
- [x] Fix timezone handling for day-based logic.
- [x] Correct scoring and summary inaccuracies.
- [x] Add explicit loading, empty, and error states to all primary pages.
- [x] Add better mutation success and failure feedback.

### Exit criteria

- Build, typecheck, and tests pass.
- Score and summaries are consistent and explainable.

## Phase 1: Close The Daily Loop

### Goal

Make planning, execution, and daily review work end-to-end.

### Tasks

- [ ] Add priority completion/drop/update support in backend and frontend.
- [ ] Make Today fully operational.
- [ ] Make Home attention items actionable.
- [ ] Implement real daily review task decisions.
- [x] Show real review submission outputs.

### Exit criteria

- A user can plan the day, run the day, and close the day entirely from the app.

## Phase 2: Expose Existing Backend Depth

### Goal

Bring frontend capability closer to backend capability.

### Tasks

- [ ] Add notifications UI.
- [ ] Add goal create/edit/status flows.
- [ ] Add weekly and monthly planning editors.
- [ ] Add category and recurring expense management.
- [ ] Add meal template management.
- [ ] Add settings/preferences UI.

### Exit criteria

- Most important persisted backend entities are manageable from the frontend.

## Phase 3: Improve Logging And Correction

### Goal

Reduce friction and improve recoverability.

### Tasks

- [ ] Replace prompt-based inputs with proper forms.
- [ ] Add edit/delete for health and finance logs.
- [ ] Improve quick capture defaults and templates.
- [ ] Add keyboard-friendly quick capture on desktop.

### Exit criteria

- Common logs are fast.
- Mistakes are easy to correct.

## Phase 4: Better Motivation And Guidance

### Goal

Make the system more engaging without making it noisy or childish.

### Tasks

- [x] Add score delta explanations on Home.
- [ ] Add streak rescue and recovery framing.
- [ ] Add weekly focus challenge or quest.
- [ ] Add habit-risk and drift indicators.
- [ ] Add “what to do next” recommendations based on existing rules.

### Exit criteria

- The app actively helps behavior, not just records it.

## Specific Implementation Backlog

## Backend backlog

- [ ] Add priority status mutation endpoints.
- [ ] Audit entity ownership validation on all write paths.
- [x] Make time calculations timezone-aware.
- [x] Correct scoring and review summary calculations.
- [ ] Add settings/preferences endpoints.
- [ ] Expand CRUD where persisted entities already exist but are not manageable.
- [ ] Consolidate request/response types around shared contracts.

## Frontend backlog

- [ ] Add notifications UI.
- [ ] Add operational priority UI on Today and Home.
- [ ] Add real review workflow UI.
- [ ] Add management UIs for goals, weekly plan, monthly focus.
- [ ] Add recurring expense and category management.
- [ ] Replace prompts with forms.
- [x] Improve loading, empty, and error states.
- [x] Improve mutation feedback and reduce stale UI risk.

## Product backlog

- [ ] Clarify whether notes and reminders are distinct product entities.
- [ ] Decide how much planning depth belongs in MVP vs later.
- [ ] Define the final score explanation model shown to the user.
- [ ] Define the minimum actionable notification set.
- [ ] Define the settings surface needed for dogfooding.

## Recommended Work Order

This is the recommended order of execution:

1. reliability and scoring correctness
2. priority lifecycle
3. daily review operational closure
4. notifications UI
5. goals and planning editors
6. finance and health correction flows
7. settings
8. gamification and guidance improvements

## Success Criteria For The Next Iteration

The next major version should be considered successful if:

- Home clearly answers what matters now.
- Today can run the day end-to-end.
- Daily review reliably seeds tomorrow.
- Score feels fair and explainable.
- Common actions are fast.
- Mistakes are easy to correct.
- Backend capabilities are not stranded behind missing UI.

## What Not To Do Yet

Avoid these until the core loop is trustworthy:

- deep analytics dashboards
- heavy customization systems
- calendar and bank integrations
- advanced AI recommendations
- complex budgeting features
- decorative gamification without behavioral value

## Final Recommendation

Do not expand scope first.

The right move is to tighten the current system until it becomes dependable and addictive in a good way:

- accurate
- fast
- operational
- motivating

Once the current daily loop is trustworthy, the existing backend foundation will support a much stronger frontend without needing a product reset.
