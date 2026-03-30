# Inbox Screen Redesign: The Focused Triage

## Context

The Inbox screen is the daily triage interface for Life OS — where users decide what to do with quick captures. The current design suffers from "dashboard syndrome": two equal-weight columns, card-in-card nesting, a prominent summary section, metadata grids, and uniform visual treatment across all elements. Everything has the same weight, nothing guides the eye, and it feels like an admin panel rather than a productivity tool used daily.

**Goal:** Redesign the Inbox into a clean, focused, content-first triage experience. Minimize chrome, maximize triage speed. Inspired by Linear, Things 3, and Superhuman.

**Scope:** Frontend only — the Inbox page component, its sub-components, and associated CSS. No backend/API changes required. All existing functionality is preserved, just reorganized.

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout | Single column + slide-out inspector | Reduces split attention; list is the primary focus |
| Header | Title + count badge, no summary card | Removes visual noise; count is sufficient |
| Item display | Title + kind dot + age + hover actions | Clean rows optimized for scanning |
| Inspector | Right slide-out panel (380px) | Detail on demand, doesn't compete with list |
| Bulk actions | Floating bottom bar | Visible but non-intrusive; follows Gmail/Linear pattern |
| Templates | Separate modal | Templates are config, not daily triage |
| Empty state | Subtle celebratory message | Rewards inbox zero without being obnoxious |

---

## 1. Page Header & Filters

### Structure
```
Inbox  (3)                                    [Templates]
All 3    Tasks 2    Notes 0    Reminders 1
```

### Specifications
- **Title:** "Inbox" using `--font-display`, `--fs-h1`. Count shown as inline pill badge with `--accent-soft` background, `--accent` text, `--fs-small`, `--r-pill` border-radius.
- **Header actions (right-aligned):** "Templates" ghost button opens the templates modal.
- **Filter row:** Directly below title, `0.5rem` gap from title. Horizontal pill buttons using existing `.inbox-filter` pattern but simplified.
  - Active filter: filled `--accent-soft` background with `--accent` text, `--r-xs` border-radius.
  - Inactive filters: `--text-secondary` text, no background.
  - Zero-count filters: `--text-tertiary` text, slightly dimmed.
  - Count shown inline after label: "Tasks 2" not "Tasks (2)".
- **Removed:** PageHeader eyebrow, description paragraph, summary card, count circle, stats breakdown, pending/stale info bar, "Capture" button (already in shell header).

### CSS Classes
- `.inbox-header` — flex row, align items baseline, justify space-between
- `.inbox-header__title` — display font with badge
- `.inbox-header__count` — inline pill badge
- `.inbox-header__actions` — right-aligned button group
- `.inbox-filters` — flex row, gap `0.5rem`, margin-top `0.5rem`
- `.inbox-filters__item` — filter pill, with `--active` modifier

---

## 2. Queue List

### Structure
```
☐  ● Quick task                               10h ago
     ↳ 🎯 Career Growth
                                    [Today] [📅] [···]  ← hover only

─────────────────────────────────────────────────────────

☐  ◆ Research competitor tools                  2d ago

─────────────────────────────────────────────────────────

☐  ▲ Call dentist                          ⚠   3d ago
```

### Item Anatomy
Each queue item is a single row (or two rows if goal-linked):

1. **Checkbox** — 16px, `--border` color, amber fill when checked. Left margin `0`.
2. **Kind dot** — 6px circle, color-coded:
   - Task: `--accent` (amber)
   - Note: `#6b9fc4` (blue-tinted)
   - Reminder: `--negative` (warm red)
3. **Title** — `--font-body`, `--fs-body`, `--text` color, single line with `text-overflow: ellipsis`.
4. **Age** — right-aligned, `--text-tertiary`, `--fs-small`. Hidden on hover (replaced by actions).
5. **Goal link (optional)** — second line, indented under title. Small text with goal domain color dot + goal title, `--text-secondary`, `--fs-small`.
6. **Stale indicator** — items 3+ days old: subtle 2px left border in `rgba(217, 153, 58, 0.25)` + small `⚠` icon (amber, `--fs-micro`) next to the age text.

### Hover Quick Actions
On item hover, the age text is replaced by action buttons that fade in (opacity transition, `--dur-fast`):

- **"Today"** — small primary button (`--accent` bg, dark text), schedules for today immediately.
- **Calendar icon button** — small ghost button, opens `SmartDatePicker` as a popover anchored to the button.
- **"···" (more)** — small ghost button, opens dropdown with: "Link goal", "Convert to note/reminder", "Archive".

Action buttons are `--fs-small`, `min-height: 1.8rem`, `--r-xs` border-radius.

### Click Behavior
- **Click item row (not checkbox):** Opens slide-out inspector for this item. Item gets active state: `--accent-soft` background + `--border-active` left border.
- **Click checkbox:** Toggles selection. Does NOT open inspector. Entering selection mode shows floating bulk bar.

### List Container
- **No wrapping card.** Items render directly on page background.
- **Dividers:** 1px `--border` between items. No divider after last item.
- **Item padding:** `0.75rem` vertical, `0rem` horizontal (aligns with page content margin).
- **Max-width:** `48rem` centered (matches existing page header max-width pattern).
- **Stagger animation:** Items animate in with `slideUp` + stagger (0.04s delay per item) on initial load.

### CSS Classes
- `.inbox-queue` — flex column, max-width 48rem, margin auto
- `.inbox-queue__item` — flex column, padding `0.75rem 0`, border-bottom `1px --border`
- `.inbox-queue__item--active` — active/selected state
- `.inbox-queue__item--stale` — stale visual treatment
- `.inbox-queue__row` — flex row, align-items center, gap `0.6rem`
- `.inbox-queue__checkbox` — styled checkbox
- `.inbox-queue__kind-dot` — 6px circle indicator
- `.inbox-queue__title` — flex 1, truncated
- `.inbox-queue__age` — right-aligned age text
- `.inbox-queue__goal` — second row with goal link
- `.inbox-queue__hover-actions` — action buttons container, opacity 0 → 1 on parent hover

---

## 3. Slide-Out Inspector Panel

### Structure
```
                                    ┌──────────────────────┐
                                    │                   ✕  │
                                    │  ● Task · 10h ago    │
                                    │                      │
                                    │  Quick task.         │
                                    │  Some notes here...  │
                                    │                      │
                                    │  ────────────────    │
                                    │                      │
                                    │  Schedule            │
                                    │  [Do today] [Date ▾] │
                                    │                      │
                                    │  Goal                │
                                    │  [Select goal ▾]     │
                                    │                      │
                                    │  ────────────────    │
                                    │                      │
                                    │  Convert to note     │
                                    │  Archive             │
                                    │                      │
                                    └──────────────────────┘
```

### Panel Specifications
- **Width:** 380px on desktop. Full-screen overlay on mobile (<768px).
- **Position:** Right side of the page. On desktop, the queue list narrows (flex layout) to accommodate. On mobile, fixed overlay with backdrop.
- **Background:** `--panel` with subtle gradient (same as existing inspector panels).
- **Border:** 1px `--border` on the left edge.
- **Shadow:** `--shadow-lg` on desktop.
- **Animation:** `slideInRight` keyframe (existing), `--dur` duration.
- **Close button:** Top-right corner, ghost button with `✕`.

### Content Layout (top to bottom)

**A. Meta line**
- Kind dot + "Task" label + " · " + relative age
- `--text-secondary`, `--fs-small`

**B. Title**
- `--font-display`, `--fs-h2`, `--text` color
- Editable: clicking enters inline edit mode (input replaces text)

**C. Notes**
- `--font-body`, `--fs-body`, `--text-secondary`
- Editable: clicking enters inline edit mode (textarea replaces text)
- If empty, show placeholder "Add notes..." in `--text-tertiary`

**D. Divider** — 1px `--border`, full width, `1rem` vertical margin

**E. Schedule section**
- Label: "Schedule" in `--fs-small`, `--text-tertiary`, uppercase, letter-spacing `0.1em`
- Row: "Do today" primary small button + `SmartDatePicker` component (reused)
- If already scheduled: show the scheduled date with a "Clear" option

**F. Goal section**
- Label: "Goal" in same label style
- `GoalCombobox` component (reused from existing)
- If already linked: show goal name with domain color dot

**G. Divider**

**H. Secondary actions**
- "Convert to note" / "Convert to reminder" — text button, `--text-secondary`
- "Archive" — text button, `--negative` color
- Vertical stack with `0.5rem` gap

### Responsive Behavior
- **Desktop (>768px):** Side panel, list narrows. Follow existing `GoalInspectorPanel` pattern from active-pursuits.
- **Mobile (<768px):** Full-screen fixed overlay with `.detail-backdrop` (blur + dim). Slide-up animation. Close button becomes more prominent.

### CSS Classes
- `.inbox-inspector` — panel container (follows `.ap-inspector` pattern)
- `.inbox-inspector__header` — close button row
- `.inbox-inspector__meta` — kind + age line
- `.inbox-inspector__title` — editable title
- `.inbox-inspector__notes` — editable notes
- `.inbox-inspector__section` — action sections (schedule, goal)
- `.inbox-inspector__section-label` — uppercase label
- `.inbox-inspector__actions` — secondary action buttons
- `.inbox-inspector__backdrop` — mobile backdrop overlay

---

## 4. Bulk Selection Mode

### Trigger
When 1+ checkboxes are checked, the floating action bar appears. If the slide-out inspector is open, it closes.

### Structure
```
┌────────────────────────────────────────────────────────┐
│  3 selected   Select all   [Do today] [Schedule] [Archive]   ✕  │
└────────────────────────────────────────────────────────┘
```

### Specifications
- **Position:** Fixed to bottom center of viewport, `1.5rem` from bottom edge.
- **Background:** `--panel-elevated` with `--shadow-lg`.
- **Border:** 1px `--border-active`.
- **Border-radius:** `--r-lg` (22px).
- **Padding:** `0.65rem 1.25rem`.
- **Layout:** Flex row, align center, gap `1rem`.

**Contents:**
1. **Selection count** — "3 selected" in `--text`, `--fs-small`, font-weight 600.
2. **"Select all"** — text link in `--accent`, selects all visible items.
3. **Action buttons:**
   - "Do today" — small primary button
   - "Schedule" — small ghost button, opens date picker popover
   - "Archive" — small ghost button with `--negative` text on hover
4. **Dismiss (✕)** — clears all selections, hides bar.

### Animation
- Slides up from bottom: `translateY(1rem)` → `translateY(0)` with `fadeIn` opacity. Duration `--dur`.
- Exits with reverse animation.

### CSS Classes
- `.inbox-bulk-bar` — fixed positioned floating container
- `.inbox-bulk-bar__count` — selection count text
- `.inbox-bulk-bar__select-all` — text link
- `.inbox-bulk-bar__actions` — button group
- `.inbox-bulk-bar__dismiss` — close button

---

## 5. Templates Modal

### Trigger
"Templates" button in the page header.

### Specifications
- **Centered modal overlay** — max-width `560px`, max-height `80vh`.
- **Backdrop:** `rgba(0, 0, 0, 0.55)` with `backdrop-filter: blur(4px)` (existing pattern).
- **Content:** Relocated from `WorkflowTemplatesSection.tsx`. Same functionality:
  - Template list (cards grid)
  - Create/edit form
  - Apply template to inbox
  - Archive templates
- **Close:** ✕ button in modal header + Escape key + backdrop click.
- **The `WorkflowTemplatesSection` component is refactored into a modal wrapper**, but its internal UI remains largely the same.

### CSS Classes
- `.inbox-templates-modal` — modal container
- `.inbox-templates-modal__backdrop` — overlay backdrop
- `.inbox-templates-modal__panel` — content panel
- Internal template classes remain from existing `WorkflowTemplatesSection`

---

## 6. Empty State (Inbox Zero)

### Structure
```
              ✦

         All clear.

    Nothing to triage. Captures
    will appear here when you
    add them.
```

### Specifications
- **Centered** in the queue area, vertically and horizontally.
- **Icon:** Sparkle/star SVG in `--accent` color, 32px, `opacity: 0.7`.
- **Headline:** "All clear." — `--font-display`, `--fs-h2`, `--text`.
- **Subtext:** "Nothing to triage. Captures will appear here when you add them." — `--font-body`, `--fs-small`, `--text-tertiary`, max-width `20rem`, centered.
- **Spacing:** `1rem` between icon and headline, `0.5rem` between headline and subtext.
- **Animation:** `fadeIn` + slight `scaleIn` on mount.

### CSS Classes
- `.inbox-zero` — centered flex column container
- `.inbox-zero__icon` — sparkle SVG
- `.inbox-zero__title` — headline text
- `.inbox-zero__subtitle` — description text

---

## 7. Component Architecture

### File Structure
```
client/src/features/inbox/
├── InboxPage.tsx                    # Main page (rewritten)
├── InboxQueueItem.tsx               # Individual queue item row (new, extracted)
├── InboxInspector.tsx               # Slide-out inspector panel (new, extracted)
├── InboxBulkBar.tsx                 # Floating bulk action bar (new)
├── InboxTemplatesModal.tsx          # Templates in modal wrapper (refactored from WorkflowTemplatesSection)
├── InboxEmptyState.tsx              # Inbox zero state (new)
└── WorkflowTemplatesSection.tsx     # Internal template content (existing, minimal changes)
```

### Key Reused Components
- `SmartDatePicker` (`shared/ui/SmartDatePicker.tsx`) — date selection in inspector and bulk bar
- `GoalCombobox` (`shared/ui/GoalCombobox.tsx`) — goal linking in inspector
- `PageLoadingState` / `InlineErrorState` (`shared/ui/PageState.tsx`) — loading/error states

### Key Reused Patterns
- `GoalInspectorPanel` layout pattern (`features/goals/GoalInspectorPanel.tsx`) — slide-out behavior, responsive handling, backdrop
- `.detail-backdrop` CSS pattern (`styles/60-goals-planning.css`) — mobile overlay
- `slideInRight`, `fadeIn`, `slideUp` keyframe animations (`styles/00-foundations.css`)

### State Management
Same React state approach as current, with adjustments:
- `activeFilter` — current filter tab
- `selectedItemId` — item shown in inspector (null = closed)
- `checkedItemIds` — Set of checked items for bulk mode
- `isInspectorOpen` — derived from `selectedItemId !== null`
- `isBulkMode` — derived from `checkedItemIds.size > 0`
- `isTemplatesModalOpen` — boolean for modal visibility
- Mutual exclusion: entering bulk mode closes inspector; opening inspector clears bulk selection

### Data Flow (unchanged)
- `useInboxQuery()` — fetches inbox items with counts
- `useUpdateTaskMutation()` — single item actions
- `useBulkUpdateTasksMutation()` — bulk actions
- `useGoalsListQuery()` — goal list for combobox
- Template queries unchanged

---

## 8. CSS Organization

All new styles go into a new section in `client/src/styles/10-app-shell.css`, replacing the existing inbox CSS block (lines ~2121-2514).

### Naming Convention
BEM with `inbox-` prefix:
- `.inbox-header`, `.inbox-header__title`, `.inbox-header__count`
- `.inbox-filters`, `.inbox-filters__item`, `.inbox-filters__item--active`
- `.inbox-queue`, `.inbox-queue__item`, `.inbox-queue__item--stale`
- `.inbox-inspector`, `.inbox-inspector__meta`, `.inbox-inspector__title`
- `.inbox-bulk-bar`, `.inbox-bulk-bar__actions`
- `.inbox-zero`, `.inbox-zero__title`

### Responsive Breakpoints
- `>768px` — full desktop: list + side inspector
- `<768px` — mobile: full-width list, inspector as full-screen overlay

---

## 9. Verification Plan

### Visual Verification
1. Open Inbox with items — confirm single-column list renders without card wrappers
2. Hover items — confirm quick action buttons appear, age text hides
3. Click item — confirm inspector slides in from right, list narrows
4. Check checkboxes — confirm floating bulk bar appears at bottom
5. Click "Templates" — confirm modal opens centered
6. Clear all items — confirm inbox zero state shows
7. Resize to mobile width — confirm inspector becomes full-screen overlay

### Functional Verification
1. "Do today" hover action — confirm item is scheduled for today and removed from list
2. Date picker in hover — confirm schedule works for selected date
3. Archive from hover menu — confirm item is archived and removed
4. Inspector schedule/goal/convert/archive actions — confirm all work
5. Bulk select + "Do today" — confirm all selected items scheduled
6. Bulk select + "Archive" — confirm all selected items archived
7. Filter pills — confirm filtering by kind works, counts update
8. Templates modal — confirm create/edit/apply/archive all work
9. Pagination — confirm "Load more" still works (if items exceed page size)

### TypeScript Verification
```bash
npm run typecheck
```
No type changes expected — all data contracts remain the same.

### Build Verification
```bash
npm run build
```
