# Life OS – Next Top 5 Improvements (Post Existing Top 5)

This document intentionally excludes the prior findings in:
- docs/review/life-os-top5-findings-for-daily-use.md

Scope: make the app genuinely usable as a personal operating system with minimum friction and high daily compounding value.

## 1) Real Recurring Systems & Carryover Intelligence (Tasks, Habits, Journal Entries, Finances)

**What’s missing**
- Scheduling is mostly one-off for tasks (manual carry-forward in reviews) and recurring finance logic is fragmented.
- Repeated daily/weekly workflows still require manual recreation, and carry-forward semantics are not user-configurable.

**Why this is top priority**
- A personal dashboard without robust recurrence quickly becomes operational overhead. Users will stop using a system that requires repetitive setup every period.

**What to implement**
- Add a dedicated recurrence model across task/habit/finance modules with rule grammar (`daily`, `weekly`, `nth weekday`, `every N days`, `custom interval`, `end condition`).
- Add exception handling (`skip`, `do once`, `reschedule date`) and progress carry-forward policy per task (`move due date`, `complete + clone`, `cancel`).
- Backfill existing manual repeat/carry-forward flows to use the new engine without breaking current behavior.

**Expected impact**
- Major friction reduction for routine life maintenance.
- Better trust in planning continuity for users with families, health, work, finance, and study routines.

## 2) Cross-Module Global Search, Saved Queries, and Smart Suggestions

**What’s missing**
- Navigation is primarily page-to-page; there is no global query layer across tasks/habits/finance/goals/reviews.
- Finding context across modules is hard, especially under cognitive load.

**Why this is top priority**
- "Search is the default mode under stress." If users can’t locate an item in seconds, the app fails in real life.

**What to implement**
- Add unified search API with indexes across all major entities and fast filtering by status/time/owner/goal/priority/score.
- Build command-style quick actions: `open`, `complete`, `defer`, `link`, `tag`, `pin` directly from results.
- Add saved views (`My Sprint`, `Work`, `Health`, `Errands`, `Review`, `Overdue`) that users can switch in one tap.

**Expected impact**
- Higher retrieval speed and lower cognitive switching cost.
- Better continuity between planning and execution layers.

## 3) Guided Daily Ritual Automation (Auto-generated Day Template + Priority Projection)

**What’s missing**
- Home/Today surfaces are currently list-first, manually driven experiences.
- Little automation in deciding today’s top priorities based on due dates, score, energy, and streak risk.

**Why this is top priority**
- Personal dashboards deliver value when they **decide** what to work on next, not just display everything.

**What to implement**
- Build an adaptive “start-of-day plan” pipeline:
  - pull backlog + habit windows + upcoming deadlines + financial/time-sensitive items,
  - generate a 3–7 item “today focus” set,
  - explain rationale (`due today`, `streak at risk`, `review window opened`, etc.),
  - suggest a realistic sequencing order.
- Let users pin/override and provide one-tap recalc.
- Persist this template for habit tracking and retrospective review.

**Expected impact**
- Dramatically lower planning paralysis.
- More complete daily execution with less context switching.

## 4) Undo/Revision Layer + Safe State Operations for Destructive Actions

**What’s missing**
- Edits and deletions across goals/tasks/habits/finance appear immediate, with no local undo layer in the UX.
- Recovery currently depends on low-level audit tables, which users cannot self-serve in moments of mistake.

**Why this is top priority**
- No system feels safe without reversible interactions. Users abandon tools after a few irreversible mistakes.

**What to implement**
- Add an application-level action history (undo/rollback for recent destructive/mass operations).
- Add soft-delete with restore windows for high-risk entities.
- Add confirmation-by-impact heuristics for bulk ops (`remove 20 tasks`, `delete goal`, `close all`, etc.).
- For score/review mutations, capture revision snapshots so accidental taps or misunderstandings can be corrected.

**Expected impact**
- Increases trust, reduces abandonment, and encourages experimentation.
- Encourages users to keep the dashboard as their true source of personal truth.

## 5) Workflow-Level Power Features: Context Views, Templates, and Batch Actions

**What’s missing**
- Task/habit/finance handling is mostly single-item and page-local.
- Users still execute many operations in sequence manually (complete, defer, reschedule, re-categorize).

**Why this is top priority**
- Productivity systems scale by reducing repeated taps, not by adding more fields.

**What to implement**
- Add batch actions in list surfaces (`complete`, `defer`, `reschedule`, `archive`, `move`, `tag`, `link` for up to N selected items).
- Add reusable flow templates (`Weekly Planning`, `Morning Review`, `Debt Catch-up`, `Habits Reset`) that pre-configure filters, fields, and actions.
- Add contextual shortcuts (keyboard, mobile gesture, long-press) to switch between workflows quickly.

**Expected impact**
- Big reduction in operational friction during chaotic periods.
- Better habit formation through repeatable routines and fewer manual steps.

## Success Criteria (first milestone)

- 90%+ of recurring routines can be configured without going through manual review carry-forward.
- Median time to find any item drops measurably (target < 5 seconds for common queries).
- Users can complete a “start-of-day” action set in under 2 minutes.
- ≥ 90% confidence in safe recovery for destructive operations.
- Measurable reduction in one-off repetitive interactions (target: >30% in top surfaces).
