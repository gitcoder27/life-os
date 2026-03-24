# Today Page — Redesign Analysis & Recommendations

**Date:** 2026-03-23  
**Scope:** `client/src/features/today/TodayPage.tsx` (1,292 lines), associated CSS (~540 lines across styles.css), shared UI components  
**Purpose:** Comprehensive UX/UI audit of the current Today page with detailed recommendations for a full redesign

---

## 1. Executive Summary

The Today page is the most critical surface in Life OS — it's where the user **executes the day**. The product vision explicitly states: *"Help the user win the current day with clarity, priorities, and next actions."* The current implementation undermines this promise through structural bloat, visual monotony, poor information hierarchy, and missing behavioral features.

**Core verdict:** The page tries to be a *dashboard* instead of an *execution workspace*. It shows too many equal-weight sections with no clear flow, no progress feedback, and no urgency signaling. A user opening this page has to scan 7 sections to figure out what to do first.

### Key problems at a glance

| Problem | Severity | Impact |
|---------|----------|--------|
| No daily score or progress feedback | Critical | User has no sense of "how am I doing today" |
| All sections equal visual weight | Critical | Nothing pulls attention to what matters most |
| 1,292-line monolith component | High | Unmaintainable, impossible to iterate on individual sections |
| Recovery lane dominates when present | High | Overdue tasks hijack the entire page |
| No routines/habits visibility | High | 25% of daily score invisible on execution page |
| No time-awareness or day phasing | High | Page looks identical at 7am and 9pm |
| Two-column grid wastes vertical space | Medium | Forces equal-height card pairs; mobile collapses poorly |
| Health section is a dumb list of strings | Medium | No visual affordance, no interaction |
| No keyboard shortcuts or quick actions | Medium | Every action requires menu navigation |
| Goal nudges take full column for minor feature | Low | Disproportionate real estate for suggestive content |

---

## 2. Detailed Analysis

### 2.1 Information Architecture — Flat & Directionless

The current page renders 7 `SectionCard` blocks in a rigid two-column grid:

```
┌─────────────────────────────────────────┐
│ Recovery Lane (full-width, conditional)  │
├────────────────────┬────────────────────┤
│ Priority Stack     │ Suggested from     │
│                    │ Goals              │
├────────────────────┼────────────────────┤
│ Task Lane          │ Day Notes          │
│                    │ (conditional)      │
├────────────────────┼────────────────────┤
│ Time Blocks        │ Meals & Training   │
└────────────────────┴────────────────────┘
```

**Problems:**

1. **No visual hierarchy.** Every `SectionCard` has identical styling — same border, same background, same title treatment. Priority Stack (the most important thing) looks the same as Meals & Training (passive context). The user's eyes have no anchor.

2. **No workflow direction.** There's no "start here → then here → finish here" flow. The page is a passive grid of equal-weight cards. The product vision says "action first" — the current layout is "list first."

3. **Two-column layout creates false equivalence.** When Priority Stack is paired next to Goal Nudges, the nudges (a secondary suggestion feature) receive the same visual weight as the primary execution tool. Same with Task Lane vs Day Notes. The right column is systematically overweighted.

4. **Recovery Lane full-width spanning is jarring.** When overdue tasks exist, the recovery lane takes full width at the top, pushing the actual day's priorities below the fold. The most common path (user with a few overdue items) gets hijacked by a wall of recovery cards.

5. **Missing sections for 50% of the daily score.** The scoring system allocates points to: Priorities (30), Routines/Habits (25), Health (25), Finance/Admin (10), Review/Reset (10). The Today page currently has **zero visibility** into Routines/Habits (25%), Finance/Admin (10%), and Review/Reset (10%). That's 45% of the daily score completely invisible on the primary execution surface.

### 2.2 Priority Stack — Functional But Undersold

**What works:**
- Drag-to-reorder with dnd-kit is technically sound
- P1/P2/P3 slot badges provide clear ranking
- Goal linking via dropdown is functional
- Dirty-state detection with save bar is good UX

**What doesn't work:**

1. **No status visualization.** When P1 is completed, it just gets a strikethrough + 65% opacity. There's no celebration, no progress ring, no sense of momentum. Completing your top priority for the day should feel significant.

2. **Save is manual and fragile.** Users must explicitly click "Save" after editing. If they navigate away, changes are lost. Auto-save on blur or debounced save would eliminate this friction entirely.

3. **Inline editing is hidden.** The text input has `border: transparent` by default. New users won't realize the title is editable until they accidentally click on it. There's no visual cue that this is an interactive input.

4. **The "More" menu per card is overkill.** Each priority has a three-dot menu that reveals Drop/Reopen/Remove options. These are rare actions buried behind a click. The check button already toggles complete/pending, so the menu is mostly for "Drop" and "Remove" — two destructive actions hiding behind an ambiguous icon.

5. **No connection to score.** The priority stack doesn't communicate that P1 = 10 points, P2 = 8, P3 = 6. Users don't know the scoring weight of their top priorities.

### 2.3 Task Lane — Flat List With Hidden Interactions

**What works:**
- Checkbox with done/dropped states
- Recurrence badges showing repeat info
- Goal chip linking
- Reschedule flow with date picker

**What doesn't work:**

1. **No grouping or categorization.** All tasks are in a single flat list regardless of type, urgency, or source. A mix of recurring habit-tasks, one-off todos, and scheduled reminders all look identical. The user has to read every title to find what matters.

2. **Action density is too high per card.** Each task can be: completed, dropped, reopened, carried forward, rescheduled (date picker), or sent to tomorrow. All actions are behind a three-dot menu (which requires click → read → click). For the primary execution page, this is too many clicks for common actions.

3. **No completion progress visible.** If you have 8 tasks and completed 3, there's no "3/8 done" indicator. You have to visually scan the list and count struck-through items.

4. **Reschedule UX is inline but awkward.** The date picker appears inside the task card, pushing content down and breaking visual flow. This is an infrequent action that gets prominent inline placement.

5. **No distinction between "scheduled today" and "carried forward."** Tasks that were deliberately planned for today and tasks that just rolled over from yesterday look identical. The user can't tell which items are fresh vs stale.

### 2.4 Recovery Lane — Correct Idea, Heavy Execution

**What works:**
- Identifies overdue tasks (30-day lookback)
- Provides clear resolution actions: complete, drop, move to today, tomorrow, pick date
- Focused selection with expanded detail

**What doesn't work:**

1. **Full-width top placement is too aggressive.** When you have 5+ overdue tasks, the recovery lane fills the entire viewport above the fold. The user's actual day disappears. This is supposed to be a *recovery* lane, not the main event.

2. **Every recovery card has 5 buttons.** "Move to today", "Tomorrow", "Pick date", "Complete", "Drop" — all rendered as ghost buttons in a flex row. This is button overload. The common actions (complete or move to today) should be primary; the rest should be secondary.

3. **No batching.** If you have 10 overdue tasks, you have to handle them one by one with individual button clicks. There's no "move all to today" or "drop all completed ones" bulk action.

4. **The "Return to today" button implies you left.** The recovery view uses a URL search param (`view=overdue`), but the page doesn't actually navigate. The button text creates false mental model of page navigation when it's just a filter toggle.

### 2.5 Goal Nudges — Nice Feature, Wrong Placement

**What works:**
- Surfaces active goals with health badges and progress bars
- "Next best action" suggestion is genuinely useful
- "Add to priorities" button is well-designed

**What doesn't work:**

1. **Takes an entire column for a suggestion.** Goal nudges get equal screen real estate to Priority Stack. For most users on most days, this section is either empty ("Goal work is already represented") or shows 1-2 small cards. The space is wasted.

2. **Disconnected from execution.** Goal nudges exist to influence Priority Stack editing. Once priorities are saved, the nudges serve no further purpose, but they remain visible consuming space.

3. **Empty states are verbose.** When there's nothing to nudge, you still see a full `SectionCard` with an `EmptyState` component saying "Goal work is already represented." This is dead weight.

### 2.6 Time Blocks — Skeleton Feature

**What works:**
- Concept of showing timed tasks is correct for daily structure

**What doesn't work:**

1. **Passive display only.** Time blocks are just `time | label` pairs with no interaction. Can't add, edit, or remove time blocks. Can't drag tasks into time slots.

2. **Only shows tasks with `dueAt`.** If no tasks have a due time, the section shows an empty state. For most task workflows, few tasks have explicit times, making this section almost always empty.

3. **No visual timeline.** Time blocks should show as a mini-timeline or schedule view, not a flat list. The current rendering looks like a plain text log.

### 2.7 Health / Meals & Training — Data Without Affordance

**What works:**
- Shows water, meal count, workout status

**What doesn't work:**

1. **Rendered as plain text strings.** The health section generates 3 string values (e.g., `"Water progress: 1.5L / 3.0L"`) and renders them as `<li>` elements. There's no visual progress indicator, no color coding, no interactive elements.

2. **Tag logic is fragile.** The done/open/queued tags are determined by string matching (`item.includes("complete")`) rather than data state. This is brittle and produces wrong labels.

3. **No quick-logging capability.** A user seeing "Water progress: 1.0L / 3.0L" should be able to log water right there. Instead, they must navigate to the Health page. The product principle says "low-friction input" — this violates it.

4. **No workout detail.** Just shows workout status string. No information about what the workout is, what to do, or how to log it.

### 2.8 Day Notes — Afterthought UX

**What works:**
- Shows quick-capture items tagged as notes/reminders

**What doesn't work:**

1. **Only appears when quick-capture tasks exist.** This is a conditional section that most users never see, making it invisible and undiscoverable.

2. **No ability to add notes.** The section is read-only. You can't capture a new note from the Today page itself.

3. **Displayed as a plain `<ul>` list.** No styling beyond the generic `.list` class. No timestamp, no categorization, no actions.

### 2.9 Visual Design — Dark Theme Monotony

**What works:**
- Dark theme with amber accent is a solid foundation
- Design tokens provide consistency

**What doesn't work:**

1. **Every section looks identical.** Same `section-card` border, same background gradient, same title typography. There is no visual differentiation between primary, secondary, and contextual content.

2. **No color-coding for status.** The page uses green (completed) and red (dropped) only inside checkbox circles. There's no broader use of color to communicate task urgency, overdue status, health progress, or score state.

3. **No visual progress indicators.** No progress rings, bars, or meters for daily completion. The entire page is text and checkboxes.

4. **Stagger animation is the only motion.** The `.stagger` class provides entrance animation, but there's no micro-interaction on completion, no celebration on progress milestones, no visual feedback beyond state toggles.

5. **Typography is uniform.** Every section title uses the same size and weight. There's no typographic hierarchy to guide the eye from most important to least important content.

### 2.10 Component Architecture — Monolith Problem

The entire Today page is **one 1,292-line file** containing:
- 3 inline SVG icon components
- 1 custom hook (`useClickOutside`)
- 6 helper functions
- 5 sub-components (`GoalChip`, `GoalNudgeCard`, `SortablePriorityCard`, `TaskCard`, `RecoveryTaskCard`)
- 1 massive page component with 200+ lines of JSX

**Problems:**
- Impossible to test individual sections
- Any change risks breaking unrelated functionality
- State management is tangled — 6+ `useState` hooks, 4 queries, 4 mutations all in one function scope
- Sub-components are tightly coupled to parent state via inline callbacks
- CSS classes are scattered across 540+ lines of global styles.css with no co-location

---

## 3. Redesign Recommendations

### 3.1 New Information Architecture — Command Center Layout

Replace the flat two-column grid with a **purpose-driven layout** with clear zones:

```
┌─────────────────────────────────────────────────────┐
│  PROGRESS BAR (Score ▸ bucket breakdown ▸ streak)   │
├───────────────────────────┬─────────────────────────┤
│                           │                         │
│  FOCUS ZONE               │  CONTEXT PANEL          │
│  ┌────────────────────┐   │  ┌───────────────────┐  │
│  │ Priority Stack     │   │  │ Day Schedule       │  │
│  │ (hero placement)   │   │  │ (timeline view)   │  │
│  └────────────────────┘   │  ├───────────────────┤  │
│  ┌────────────────────┐   │  │ Health Pulse       │  │
│  │ Task Queue         │   │  │ (visual meters)   │  │
│  │ (grouped, compact) │   │  ├───────────────────┤  │
│  └────────────────────┘   │  │ Day Notes          │  │
│                           │  │ (inline capture)   │  │
│                           │  └───────────────────┘  │
├───────────────────────────┴─────────────────────────┤
│  RECOVERY TRAY (collapsible, bottom, batched)       │
└─────────────────────────────────────────────────────┘
```

**Key principles:**
- **Focus Zone (left, ~60% width):** Priority Stack + Task Queue. This is where the user works. Largest column, highest visual weight.
- **Context Panel (right, ~40% width):** Day schedule, health meters, notes. Supportive glanceable info. Smaller, quieter styling.
- **Progress Bar (top, full-width):** Daily score ring + bucket breakdown. Always visible. Shows "where am I today" at a glance.
- **Recovery Tray (bottom, collapsible):** Overdue tasks in a collapsed drawer, not a dominating banner. Opens on demand, supports batch actions.

### 3.2 Daily Score Progress — The Missing Heartbeat

**Add a score progress strip at the top of the page.** This is critical — 100% of the scoring system is invisible on the execution page.

**Recommended design:**
- Compact horizontal bar with a score ring (0–100) on the left
- Five mini bucket indicators: Priorities ● Routines ● Health ● Finance ● Review
- Each bucket shows filled/unfilled state with color: green (completed), amber (partial), dim (not started)
- Score label text: "Solid Day (72)" or "Recovering Day (58)"
- Animates upward when user completes actions — immediate dopamine feedback

**Why this matters:** The user needs to know "how am I doing" without navigating to Home. This is the #1 missing motivational element. Every completion should visibly move the needle.

### 3.3 Priority Stack — Hero Treatment

**Elevate the priority stack to command position:**

- **Larger cards** with distinct background gradient (not the generic section-card style)
- **Score weight visible:** Show "10pt", "8pt", "6pt" subtly next to each priority slot
- **Auto-save on blur** instead of manual save button — eliminate the save bar entirely
- **Inline goal badge** instead of dropdown: show the linked goal as a chip inside the card; tap to change
- **Completion celebration:** When a priority is completed, brief burst animation + score strip updates
- **Visible input affordance:** Border or underline on the title field at all times so users know it's editable
- **Remove the three-dot menu:** Replace with swipe-to-drop on mobile and right-click context on desktop. Or show inline icon buttons (check and X) that appear on hover
- **Goal nudge integration:** Instead of a separate section, show goal suggestions *inline* as ghost priority cards at the bottom of the stack: "Suggested: [goal title] — Add?" This eliminates the entire Goal Nudge section.

### 3.4 Task Queue — Grouped & Compact

**Replace the flat task list with categorized groups:**

```
TODAY'S TASKS                          4/7 done
──────────────────────────────────────────────
▼ Carried Forward (2)
  ☐ Review Q1 budget draft        →  Finance
  ☐ Reply to landlord email       →  Home

▼ Scheduled Today (3)
  ☑ Morning standup notes              ✓ Done
  ☐ Write deployment runbook      →  Work
  ☐ Groceries pickup             →  Home

▼ Recurring (2)
  ☑ Daily journal entry                ✓ Done
  ☐ 15-min reading block          ↻  Daily
```

**Improvements:**
- **Group by source:** Carried forward, scheduled today, recurring. Users see provenance instantly.
- **Completion counter** in the section header: "4/7 done" with a progress bar
- **Single-tap complete.** Checkbox completes immediately. No menu needed for the primary action.
- **Swipe / secondary actions on demand.** "Tomorrow", "Drop", "Reschedule" move to a slide-out tray or long-press menu — not a three-dot menu on every card.
- **Compact row height.** Current task cards have excessive padding (0.6rem + content + meta = ~60px per task). Compact rows at ~40px would show more tasks above the fold.
- **Visual distinction for status:** Pending = full opacity, completed = green left border + muted, dropped = red left border + struck through.
- **Limit to first 5 scoring tasks with indicator.** Since only first 5 count for score, visually mark the scoring boundary: "— Tasks below this line don't affect today's score —"

### 3.5 Recovery Tray — Collapsible Bottom Drawer

**Move overdue tasks from a dominating top banner to a collapsible bottom tray:**

- **Collapsed state:** Sticky bottom bar showing "⚠ 5 overdue tasks need decisions" with expand button
- **Expanded state:** Slides up as a panel with the list of overdue tasks
- **Batch actions at the top:** "Move all to today", "Move all to tomorrow", "Select items…"
- **Individual actions simplified:** Each row gets two primary buttons (✓ Done, → Today) and a "More…" option for reschedule/drop/pick date
- **Auto-dismiss when empty:** Tray disappears completely when all overdue items are resolved

**Why bottom, not top:** The user's primary workflow is today's priorities and tasks. Overdue items are debt from previous days — important but not the main event. They should be accessible without hijacking the viewport.

### 3.6 Context Panel — Glanceable Sidekick

**Right column becomes a compact context panel:**

**A. Day Schedule (mini-timeline)**
- Vertical timeline showing timed tasks as blocks
- Current time indicator ("now" marker)
- Gaps visible for unstructured time
- Tap to add time block (if feature is built out)

**B. Health Pulse (visual meters)**
- Replace text strings with actual visual indicators:
  - Water: circular progress ring showing 1.5L / 3.0L
  - Meals: dots or icons for each meal slot (filled = logged)
  - Workout: status badge with icon (planned / completed / missed / rest day)
- Each meter should be tappable to open quick-log modal
- Color-coded: green (on track), amber (behind), red (missed)

**C. Day Notes (inline capture)**
- Persistent text input at top: "Quick note…"
- Notes list below with timestamps
- Visible by default, not only when quick-capture tasks exist

**D. Goal Pulse (compact, not a separate section)**
- If active goals exist, show a small "Goals in play today" section listing just goal titles + health badges
- Remove the full GoalNudgeCard + actions. Move the "Add to priorities" affordance into the Priority Stack itself (see 3.3).

### 3.7 Time-Aware Day Phasing

**The page should look different at different times of day:**

- **Morning (before noon):** Emphasize planning. Priority stack in edit mode. Show "Plan your day" prompt if no priorities set. Goal nudges more visible.
- **Afternoon (noon–6pm):** Emphasize execution. Tasks and health meters prominent. Show completion progress.
- **Evening (after 6pm):** Emphasize closing. Show "Review your day" prompt. Remaining incomplete items highlighted. Transition to daily review nudge.

**Implementation:** Simple time-based CSS class on the page container (`phase-morning`, `phase-afternoon`, `phase-evening`) that adjusts emphasis, ordering, or collapses certain sections.

### 3.8 Micro-Interactions & Motion

**Add targeted interactions for key moments:**

1. **Task completion:** Checkbox fills with green, card slides left slightly and fades to muted state. Score strip animates.
2. **Priority save:** Cards briefly pulse amber border on successful save.
3. **Overdue task resolution:** Card collapses out of list with a subtle slide-up. Counter decrements.
4. **Score milestone:** When score crosses 70 or 85 threshold, brief banner: "Solid Day" with subtle confetti or glow.
5. **Drag-reorder:** Priority cards lift with shadow and scale slightly (already partially implemented).

### 3.9 Keyboard Shortcuts & Quick Actions

**Add keyboard shortcuts for power users:**

| Shortcut | Action |
|----------|--------|
| `1`, `2`, `3` | Focus priority P1, P2, P3 input |
| `n` | Focus new task/note quick capture |
| `c` | Toggle completed tasks visibility |
| `r` | Toggle recovery tray |
| `Enter` on task | Complete task |
| `Backspace` on task | Drop task |
| `→` on task | Carry to tomorrow |

### 3.10 Mobile-Specific Adaptations

The current mobile layout simply stacks all sections vertically (960px breakpoint collapses the grid). This creates an extremely long scroll.

**Recommendations:**
- **Tab-based mobile layout:** "Focus" (priorities + tasks) | "Context" (health + schedule + notes) | "Recovery" (overdue)
- **Sticky bottom action bar** for current-task quick actions
- **Tap-and-hold** for secondary task actions (reschedule, drop) instead of three-dot menus
- **Collapsible sections** with expand/collapse instead of always-visible

---

## 4. Component Architecture Recommendations

### 4.1 Break Up the Monolith

Split `TodayPage.tsx` (1,292 lines) into focused modules:

```
features/today/
├── TodayPage.tsx               (~120 lines — layout orchestrator only)
├── components/
│   ├── ScoreProgressStrip.tsx   (~80 lines)
│   ├── PriorityStack.tsx        (~200 lines)
│   ├── PriorityCard.tsx         (~120 lines)
│   ├── TaskQueue.tsx            (~150 lines)
│   ├── TaskCard.tsx             (~100 lines)
│   ├── RecoveryTray.tsx         (~150 lines)
│   ├── RecoveryTaskCard.tsx     (~100 lines)
│   ├── ContextPanel.tsx         (~80 lines — sub-layout)
│   ├── DaySchedule.tsx          (~80 lines)
│   ├── HealthPulse.tsx          (~100 lines)
│   ├── DayNotes.tsx             (~80 lines)
│   └── GoalPulse.tsx            (~60 lines)
├── hooks/
│   ├── useTodayData.ts          (consolidate all queries)
│   ├── usePriorityDraft.ts      (priority editing state)
│   ├── useTaskActions.ts        (mutations + reschedule state)
│   └── useRecoveryTray.ts       (overdue query + UI state)
└── helpers/
    ├── date-helpers.ts
    └── score-helpers.ts
```

### 4.2 Co-locate Styles

Move Today page CSS from the global `styles.css` monolith to a co-located CSS module or scoped stylesheet:

```
features/today/
├── today.css                    (all Today-specific styles)
```

Or use CSS modules for component-level scoping.

### 4.3 State Management Cleanup

Current page has too many `useState` + `useMemo` + `useEffect` hooks in one scope. Extract:

- **`usePriorityDraft` hook:** Encapsulates draft state, dirty detection, save function, goal nudge integration
- **`useTodayData` hook:** Combines `useDayPlanQuery`, `useHealthDataQuery`, `useGoalsListQuery` with derived computations
- **`useTaskActions` hook:** Encapsulates task/carry mutations with reschedule date state
- **`useRecoveryTray` hook:** Encapsulates overdue query, search params, selection state

---

## 5. Missing Features To Add

These features are specified in the PRD/scoring system but completely absent from the current Today page:

| Feature | PRD Source | Score Impact | Priority |
|---------|-----------|--------------|----------|
| Daily score display | scoring-system.md | Shows 0–100 score | P0 |
| Score bucket breakdown | scoring-system.md | Shows 5 bucket progress | P0 |
| Routines/habits section | features-by-module.md | 25% of daily score | P0 |
| Finance/admin snapshot | features-by-module.md | 10% of daily score | P1 |
| "Tomorrow prepared" indicator | scoring-system.md | 4 points in Review bucket | P1 |
| Quick capture from Today | features-by-module.md | Entry point on page | P1 |
| Attention panel | features-by-module.md | What needs attention now | P1 |
| Daily review trigger | scoring-system.md | 6 points in Review bucket | P2 |
| Streak indicators | scoring-system.md | Habit/routine/strong-day | P2 |

---

## 6. Prioritized Implementation Plan

### Phase 1 — Structural Overhaul (Highest Impact)
1. Decompose monolith into separate components and hooks
2. Replace flat two-column grid with Focus Zone + Context Panel layout
3. Add Daily Score Progress Strip at the top
4. Elevate Priority Stack to hero treatment with auto-save
5. Refactor Task Lane into grouped Task Queue with completion counter

### Phase 2 — Missing Score Visibility
6. Add Routines/Habits section to Context Panel or Focus Zone
7. Add Health Pulse with visual meters (replace text strings)
8. Add Finance/Admin compact indicator
9. Connect completion actions to score animation

### Phase 3 — Recovery & Interaction
10. Move Recovery Lane to collapsible bottom tray with batch actions
11. Add micro-interactions for task/priority completion
12. Implement keyboard shortcuts
13. Add time-aware day phasing

### Phase 4 — Mobile & Polish
14. Mobile tab-based layout
15. Touch-optimized interactions (swipe, long-press)
16. Goal nudge integration into Priority Stack (remove separate section)
17. Inline day notes with capture input

---

## 7. Success Criteria

The redesigned Today page should be validated against:

1. **Time to first action:** User can start completing tasks within 3 seconds of page load (reduced from current ~8 seconds of scanning)
2. **Score visibility:** User can see current daily score and breakdown without scrolling
3. **Completion rate visibility:** User can see task/priority progress (X/Y done) at a glance
4. **Mobile scroll depth:** Full page content accessible within 2 screen-heights on mobile (down from 4+)
5. **Component size:** No single file exceeds 200 lines
6. **Score coverage:** All 5 scoring buckets have some representation on the Today page
7. **Interaction count:** Common actions (complete task, complete priority) require 1 tap, not 2+

---

## Appendix: Current Code References

| File | Lines | Purpose |
|------|-------|---------|
| `client/src/features/today/TodayPage.tsx` | 1,292 | Monolith page component |
| `client/src/styles.css` ~L4232–4765 | ~540 | Priority, task, recovery, nudge CSS |
| `client/src/shared/ui/SectionCard.tsx` | 23 | Generic section wrapper |
| `client/src/shared/ui/PageHeader.tsx` | 17 | Page title/description |
| `client/src/shared/ui/PageState.tsx` | 87 | Loading/error/empty states |
| `client/src/shared/ui/RecurrenceBadge.tsx` | 65 | Recurrence indicator |
| `client/src/features/goals/GoalDetailPanel.tsx` | ~600 | Exports HealthBadge, GoalProgressBar |
| `client/src/shared/lib/api.ts` ~L1756–2171 | | Query/mutation hooks |
