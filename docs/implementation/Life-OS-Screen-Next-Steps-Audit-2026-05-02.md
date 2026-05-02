# Life OS Screen Next Steps Audit

Date: May 2, 2026

Purpose: concise, screen-by-screen recommendations from a subagent review of the current app. The filter used here is simple: each next step should help the user decide, start, recover, or learn, so Life OS becomes a life-guidance system rather than only a capture/tracking tool.

## Primary Screens

| Screen | Next two highest-leverage improvements |
| --- | --- |
| Home | 1. Fix must-win guidance targeting so Home points to the actual must-win/task state instead of a generic first task. Areas: `server/src/modules/home/guidance.ts`, `server/src/modules/home/routes.ts`.<br>2. Make inbox pressure accurate and actionable; Home currently fetches 4 inbox items and then cannot correctly know whether more exist. Areas: `client/src/features/home/HomePage.tsx`, `QuietRail.tsx`. |
| Inbox | 1. Honor stale-triage entry intent from Home by sorting/highlighting stale items when the user follows that prompt. Areas: `InboxPage.tsx`, `homeNavigation.ts`, `server/src/modules/planning/task-routes.ts`.<br>2. Make triage a continuous loop: after schedule/archive, auto-select the next item, and require/offer clarification for bulk or quick scheduling of vague tasks. Areas: `InboxPage.tsx`, `InboxInspector.tsx`. |
| Today | 1. Add a single-next-move coaching layer above the task queue, explaining what to start now and why. Areas: `ExecutionStream.tsx`, `TaskInspectorPanel.tsx`, start protocol data.<br>2. Add inline drift recovery in execution mode so slipped work can be moved, unplanned, or carried forward without switching to Day Planner. Areas: `TodayPage.tsx`, `CommandBar.tsx`, `DayPlanner.tsx`. |
| Day Planner | 1. Add “shape my day” auto-planning from anchors, estimates, daily rhythm, and goal importance. Areas: `DayPlanner.tsx`, `UnplannedTasks.tsx`, planning contracts/routes.<br>2. Add capacity guardrails per block and day: load indicators, unsized-task warnings, and overfill prompts before the user overcommits. Areas: `PlannerBlock.tsx`, `UnplannedTasks.tsx`, `DayPlanner.tsx`. |
| Habits | 1. Show the habit ladder directly in daily check-in: minimum, standard, and stretch versions should be visible at the moment of action. Areas: `DailyFocusSection.tsx`, `HabitForm.tsx`.<br>2. Make the weekly challenge actionable with “log minimum/standard” or “go to habit” CTAs when the focus habit is due or behind. Areas: `SignalsSection.tsx`, habit service. |
| Health | 1. Prioritize planned meals in health guidance instead of generic “Next: lunch/dinner” meal-count messaging. Areas: `summary-builder.ts`, `HealthPage.tsx`.<br>2. Add “Fallback done” to workout status; the backend supports fallback behavior, but the UI only offers completed, rest day, and missed. Area: `HealthPage.tsx`. |
| Meals | 1. Let the user log today’s planned meal directly from the meal calendar slot. Planning should flow into execution without switching to Health. Areas: `MealPlannerPage.tsx`, health API client.<br>2. Make prep sessions completable from Meals; linked task status exists, but completion is not one tap in the prep panel. Areas: `MealPlannerPage.tsx`, health routes. |
| Finance | 1. Fix safe-to-spend guidance so negative safe-to-spend is not labeled “On track,” and add clear next-action CTAs. Areas: `FinancePage.tsx`, finance safe-spend service/routes.<br>2. Promote finance focus into action: “watch this category today,” “fund this goal,” or “handle this bill” should appear in the rail/month journey. Areas: `FinanceInsightsPanel.tsx`, `FinancePage.tsx`, finance contracts/routes. |
| Goals | 1. Add a “swap into Today” flow when today’s priority slots are full, instead of disabling Add to Today. Areas: `useGoalTodayAction.ts`, `GoalsPlanWorkspace.tsx`.<br>2. Make the default view an action agenda connecting today, week, month, and goal outcomes. Areas: `GoalsOverviewWorkspace.tsx`, `GoalsPlanWorkspace.tsx`, goal overview backend. |
| Reviews | 1. Fix the weekly prompt/output mismatch: the key-habit prompt is currently saved as `improveText`, which can seed the wrong next-week work. Areas: `reviewCadenceConfig.ts`, `useReviewSubmission.ts`, `PeriodicReviewWorkspace.tsx`.<br>2. Carry goal links through review-seeded outputs so daily, weekly, and monthly reflection becomes aligned action, not free-text tasks. Areas: `DailyReviewWorkspace.tsx`, review submission hooks/services. |

## Supporting Screens And Surfaces

| Surface | Next two improvements |
| --- | --- |
| Onboarding | 1. End with a first-week activation preview: must-win candidate, starter habit focus, first review window, and setup gaps.<br>2. Add a post-onboarding “finish setup later” checklist so skipped finance, meals, habits, or goals become guided next steps instead of hidden omissions. |
| Settings | 1. Add an operating profile section for capacity defaults, day-mode preferences, focus length defaults, and recovery behavior.<br>2. Add notification quiet hours/digest controls so nudges support the user’s life rhythm instead of becoming background noise. |
| Quick Capture | 1. Add lightweight type-specific clarification after capture: task next action, reminder date, expense category, meal slot, or habit link.<br>2. Suggest templates from recent behavior so capture becomes faster while still routing items into the right workflow. |
| Notifications | 1. Turn notifications into action cards with one-tap “do now,” “snooze,” “move tomorrow,” or “open context.”<br>2. Add notification hygiene: repeated dismissed alerts should downgrade, bundle, or ask the user to change the underlying rule. |

## Recommended Build Order

1. Home/Inbox correctness fixes: must-win targeting, accurate inbox pressure, stale-triage intent.
2. Today/Planner behavior layer: single next move, inline drift recovery, and planner capacity guardrails.
3. Cross-domain action loops: planned meals to Health, habit ladder visibility, safe-to-spend truth, goal-to-Today swap.
4. Adaptation loops: review outputs linked to goals, recurring friction converted into system changes, notification hygiene.

The strongest product direction is to keep reducing negotiation for the user. Every screen should answer: what matters, what should I do now, what can be made smaller, and what should change next time?
