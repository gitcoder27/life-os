# Inbox Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Inbox screen from a two-column dashboard into a clean, focused single-column triage interface with a slide-out inspector, hover quick actions, and a floating bulk action bar.

**Architecture:** Replace the current `InboxPage.tsx` monolith (816 lines) with a main page + 5 extracted sub-components. The layout shifts from a two-column grid to a single-column list with an on-demand slide-out inspector panel (following the existing `GoalInspectorPanel` pattern). CSS is replaced in-place within `10-app-shell.css`.

**Tech Stack:** React 18, CSS custom properties (existing design tokens), existing `SmartDatePicker` and `GoalCombobox` components, existing TanStack Query hooks.

**Spec:** `docs/superpowers/specs/2026-03-30-inbox-redesign-design.md`

---

## File Structure

```
client/src/features/inbox/
├── InboxPage.tsx                    # Main page — rewritten (orchestrator, state, data fetching)
├── InboxQueueItem.tsx               # NEW — single queue item row with hover actions
├── InboxInspector.tsx               # NEW — slide-out inspector panel
├── InboxBulkBar.tsx                 # NEW — floating bottom bulk action bar
├── InboxTemplatesModal.tsx          # NEW — modal wrapper for templates
├── InboxEmptyState.tsx              # NEW — inbox zero celebration
└── WorkflowTemplatesSection.tsx     # EXISTING — minimal changes (remove SectionCard wrapper, keep internals)

client/src/styles/
└── 10-app-shell.css                 # MODIFY — replace inbox CSS block (lines ~2121-2514)
```

---

### Task 1: Write the new CSS

Replace the entire inbox CSS block in `10-app-shell.css` with the new design system styles. This comes first so all subsequent component work can reference the correct class names.

**Files:**
- Modify: `client/src/styles/10-app-shell.css:2121-2514`

- [ ] **Step 1: Replace the inbox CSS block**

Delete lines 2121-2514 (the `/* ── Inbox ── */` section) and replace with the new styles. The new CSS covers: inbox header, filters, queue list, queue items, hover actions, slide-out inspector, bulk bar, templates modal, and empty state.

```css
/* ── Inbox ── */

/* Header */
.inbox-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  max-width: 48rem;
}

.inbox-header__title {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  font-family: var(--font-display);
  font-size: var(--fs-h1);
  font-weight: 600;
  letter-spacing: -0.01em;
}

.inbox-header__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.6rem;
  padding: 0.1rem 0.5rem;
  border-radius: var(--r-pill);
  background: var(--accent-soft);
  color: var(--accent);
  font-family: var(--font-body);
  font-size: var(--fs-small);
  font-weight: 700;
}

/* Filters */
.inbox-filters {
  display: flex;
  gap: 0.35rem;
  margin-top: 0.5rem;
  max-width: 48rem;
}

.inbox-filters__item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.75rem;
  border-radius: var(--r-xs);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--fs-small);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--dur-fast) var(--ease);
}

.inbox-filters__item:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.04);
}

.inbox-filters__item--active {
  background: var(--accent-soft);
  color: var(--accent);
}

.inbox-filters__item--zero {
  color: var(--text-tertiary);
}

.inbox-filters__count {
  font-weight: 700;
}

/* Workspace layout (list + inspector side by side) */
.inbox-workspace {
  display: flex;
  gap: 0;
  min-height: 0;
  max-width: 100%;
}

.inbox-workspace__list {
  flex: 1;
  min-width: 0;
  max-width: 48rem;
}

/* Queue */
.inbox-queue {
  display: flex;
  flex-direction: column;
  margin-top: 1.25rem;
}

.inbox-queue__load-more {
  margin-top: 0.75rem;
}

/* Queue items */
.inbox-queue__item {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.7rem 0.5rem;
  border-bottom: 1px solid var(--border);
  border-radius: var(--r-xs);
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease);
  position: relative;
}

.inbox-queue__item:last-child {
  border-bottom: none;
}

.inbox-queue__item:hover {
  background: rgba(255, 255, 255, 0.025);
}

.inbox-queue__item--active {
  background: var(--accent-soft);
  border-left: 2px solid var(--accent);
  padding-left: calc(0.5rem - 2px);
}

.inbox-queue__item--stale {
  border-left: 2px solid rgba(217, 153, 58, 0.25);
  padding-left: calc(0.5rem - 2px);
}

.inbox-queue__item--active.inbox-queue__item--stale {
  border-left-color: var(--accent);
}

/* Item row */
.inbox-queue__row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 1.6rem;
}

.inbox-queue__checkbox {
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
  accent-color: var(--accent);
  cursor: pointer;
  margin: 0;
}

.inbox-queue__kind-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.inbox-queue__kind-dot--task {
  background: var(--accent);
}

.inbox-queue__kind-dot--note {
  background: #6b9fc4;
}

.inbox-queue__kind-dot--reminder {
  background: var(--negative);
}

.inbox-queue__title {
  flex: 1;
  min-width: 0;
  font-size: var(--fs-body);
  font-weight: 500;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text);
}

.inbox-queue__right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.inbox-queue__age {
  color: var(--text-tertiary);
  font-size: var(--fs-small);
  white-space: nowrap;
}

.inbox-queue__stale-icon {
  color: var(--accent);
  font-size: var(--fs-micro);
}

/* Hover actions */
.inbox-queue__hover-actions {
  display: none;
  align-items: center;
  gap: 0.25rem;
}

.inbox-queue__item:hover .inbox-queue__hover-actions {
  display: flex;
}

.inbox-queue__item:hover .inbox-queue__age,
.inbox-queue__item:hover .inbox-queue__stale-icon {
  display: none;
}

.inbox-queue__hover-btn {
  padding: 0.25rem 0.55rem;
  border-radius: var(--r-xs);
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text-secondary);
  font-size: var(--fs-small);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--dur-fast) var(--ease);
}

.inbox-queue__hover-btn:hover {
  border-color: var(--border-active);
  color: var(--text);
  background: var(--panel-elevated);
}

.inbox-queue__hover-btn--primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #1a1408;
}

.inbox-queue__hover-btn--primary:hover {
  background: var(--accent-bright);
  border-color: var(--accent-bright);
  color: #1a1408;
}

/* Goal sub-row */
.inbox-queue__goal {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding-left: 1.85rem; /* align with title: checkbox(1rem) + gap(0.5rem) + dot(6px) + gap(0.35rem) ≈ 1.85rem */
  color: var(--text-secondary);
  font-size: var(--fs-small);
}

.inbox-queue__goal-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ── Inspector panel ── */
.inbox-inspector-backdrop {
  display: none;
}

.inbox-workspace__inspector {
  width: 380px;
  flex-shrink: 0;
  margin-left: 1.25rem;
  position: sticky;
  top: 5rem;
  max-height: calc(100vh - 6rem);
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--r);
  background:
    radial-gradient(circle at top right, rgba(93, 184, 106, 0.04), transparent 40%),
    linear-gradient(180deg, var(--panel-elevated), var(--panel));
  box-shadow: var(--shadow-lg);
  animation: slideInRight 0.3s var(--ease) both;
}

.inbox-workspace__inspector::-webkit-scrollbar {
  width: 4px;
}

.inbox-workspace__inspector::-webkit-scrollbar-track {
  background: transparent;
}

.inbox-workspace__inspector::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
}

.inbox-inspector {
  display: flex;
  flex-direction: column;
}

.inbox-inspector__header {
  display: flex;
  justify-content: flex-end;
  padding: 0.65rem 0.75rem 0;
}

.inbox-inspector__close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-xs);
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 1rem;
  cursor: pointer;
  transition: all var(--dur-fast) var(--ease);
}

.inbox-inspector__close:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.06);
}

.inbox-inspector__body {
  padding: 0.25rem 1.15rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.inbox-inspector__meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--text-secondary);
  font-size: var(--fs-small);
}

.inbox-inspector__title {
  font-family: var(--font-display);
  font-size: var(--fs-h2);
  font-weight: 500;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--text);
}

.inbox-inspector__title-input {
  font-family: var(--font-display);
  font-size: var(--fs-h2);
  font-weight: 500;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--text);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-focus);
  border-radius: var(--r-xs);
  padding: 0.3rem 0.5rem;
  width: 100%;
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.inbox-inspector__notes {
  color: var(--text-secondary);
  font-size: var(--fs-body);
  line-height: 1.6;
  white-space: pre-wrap;
}

.inbox-inspector__notes--empty {
  color: var(--text-tertiary);
  font-style: italic;
}

.inbox-inspector__notes-input {
  color: var(--text-secondary);
  font-size: var(--fs-body);
  font-family: var(--font-body);
  line-height: 1.6;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-focus);
  border-radius: var(--r-xs);
  padding: 0.3rem 0.5rem;
  width: 100%;
  min-height: 4rem;
  resize: vertical;
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.inbox-inspector__divider {
  height: 1px;
  background: var(--border);
  margin: 0.25rem 0;
}

.inbox-inspector__section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.inbox-inspector__section-label {
  font-size: var(--fs-micro);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-tertiary);
}

.inbox-inspector__section-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.inbox-inspector__secondary-actions {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.inbox-inspector__text-btn {
  display: inline-flex;
  align-items: center;
  padding: 0.4rem 0;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--fs-small);
  font-weight: 500;
  cursor: pointer;
  transition: color var(--dur-fast) var(--ease);
}

.inbox-inspector__text-btn:hover {
  color: var(--text);
}

.inbox-inspector__text-btn--danger {
  color: var(--negative);
}

.inbox-inspector__text-btn--danger:hover {
  color: #e06b62;
}

/* ── Bulk bar ── */
.inbox-bulk-bar {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.6rem 1.1rem;
  border-radius: var(--r-lg);
  border: 1px solid var(--border-active);
  background: var(--panel-elevated);
  box-shadow: var(--shadow-lg);
  z-index: 30;
  animation: bulkBarIn 0.25s var(--ease) both;
}

@keyframes bulkBarIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(1rem);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.inbox-bulk-bar__count {
  font-size: var(--fs-small);
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
}

.inbox-bulk-bar__select-all {
  border: none;
  background: transparent;
  color: var(--accent);
  font-size: var(--fs-small);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: color var(--dur-fast) var(--ease);
}

.inbox-bulk-bar__select-all:hover {
  color: var(--accent-bright);
}

.inbox-bulk-bar__divider {
  width: 1px;
  height: 1.2rem;
  background: var(--border);
}

.inbox-bulk-bar__actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.inbox-bulk-bar__dismiss {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-xs);
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all var(--dur-fast) var(--ease);
  margin-left: 0.25rem;
}

.inbox-bulk-bar__dismiss:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.06);
}

/* ── Templates modal ── */
.inbox-templates-modal {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s var(--ease) both;
}

.inbox-templates-modal__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
}

.inbox-templates-modal__panel {
  position: relative;
  width: min(560px, calc(100% - 2rem));
  max-height: 80vh;
  overflow-y: auto;
  border-radius: var(--r);
  border: 1px solid var(--border);
  background: var(--panel-elevated);
  box-shadow: var(--shadow-lg);
  animation: scaleIn 0.25s var(--ease) both;
}

.inbox-templates-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.15rem;
  border-bottom: 1px solid var(--border);
}

.inbox-templates-modal__title {
  font-family: var(--font-display);
  font-size: var(--fs-h2);
  font-weight: 600;
}

.inbox-templates-modal__close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-xs);
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 1rem;
  cursor: pointer;
  transition: all var(--dur-fast) var(--ease);
}

.inbox-templates-modal__close:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.06);
}

.inbox-templates-modal__body {
  padding: 1rem 1.15rem 1.25rem;
}

/* ── Empty state ── */
.inbox-zero {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 1rem;
  text-align: center;
  animation: fadeIn 0.4s var(--ease) both;
}

.inbox-zero__icon {
  font-size: 2rem;
  color: var(--accent);
  opacity: 0.7;
  margin-bottom: 1rem;
}

.inbox-zero__title {
  font-family: var(--font-display);
  font-size: var(--fs-h2);
  font-weight: 600;
  color: var(--text);
  margin-bottom: 0.5rem;
}

.inbox-zero__subtitle {
  color: var(--text-tertiary);
  font-size: var(--fs-small);
  max-width: 20rem;
  line-height: 1.5;
}

/* ── Inbox responsive ── */
@media (max-width: 768px) {
  .inbox-inspector-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(4px);
    z-index: 39;
    animation: fadeIn 0.25s var(--ease) both;
  }

  .inbox-workspace__inspector {
    width: 100%;
    margin-left: 0;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    max-height: 100vh;
    border-radius: 0;
    z-index: 40;
    animation: slideUp 0.35s var(--ease) both;
  }
}

/* Hover actions: hide on touch devices */
@media (hover: none) {
  .inbox-queue__hover-actions {
    display: flex;
  }

  .inbox-queue__age,
  .inbox-queue__stale-icon {
    display: none;
  }
}
```

- [ ] **Step 2: Verify the CSS compiles in a build**

Run: `npm run build`
Expected: Build succeeds. No CSS syntax errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/styles/10-app-shell.css
git commit -m "refactor(inbox): replace inbox CSS with new focused triage design

Replaces the two-column dashboard styling with single-column layout,
slide-out inspector panel, hover quick actions, floating bulk bar,
templates modal, and inbox-zero empty state styles."
```

---

### Task 2: Create `InboxEmptyState` component

The simplest new component — build it first to validate the CSS is working.

**Files:**
- Create: `client/src/features/inbox/InboxEmptyState.tsx`

- [ ] **Step 1: Create the component**

```tsx
export function InboxEmptyState() {
  return (
    <div className="inbox-zero">
      <div className="inbox-zero__icon">✦</div>
      <h2 className="inbox-zero__title">All clear.</h2>
      <p className="inbox-zero__subtitle">
        Nothing to triage. Captures will appear here when you add them.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/features/inbox/InboxEmptyState.tsx
git commit -m "feat(inbox): add InboxEmptyState component for inbox zero"
```

---

### Task 3: Create `InboxQueueItem` component

Extract the individual queue item into its own component with the new design: kind dot, clean title, age text, hover quick actions.

**Files:**
- Create: `client/src/features/inbox/InboxQueueItem.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useRef, useState } from "react";

import { getReminderDate, type LinkedGoal, type TaskItem } from "../../shared/lib/api";
import { getQuickCaptureDisplayText } from "../../shared/lib/quickCapture";
import { SmartDatePicker } from "../../shared/ui/SmartDatePicker";

type InboxQueueItemProps = {
  item: TaskItem;
  isActive: boolean;
  isChecked: boolean;
  isStale: boolean;
  isMutating: boolean;
  today: string;
  onSelect: () => void;
  onToggleCheck: () => void;
  onDoToday: () => void;
  onSchedule: (date: string) => void;
  onArchive: () => void;
  onConvertToNote: () => void;
  onLinkGoal: () => void;
};

const STALE_DAYS = 3;

const domainColors: Record<string, string> = {
  health: "#5db86a",
  money: "#d9993a",
  work_growth: "#6b9fc4",
  home_admin: "#a08ed4",
  discipline: "#d97a73",
  other: "#8a8270",
};

function formatCreatedAt(isoDateTime: string) {
  const date = new Date(isoDateTime);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function InboxQueueItem({
  item,
  isActive,
  isChecked,
  isStale,
  isMutating,
  today,
  onSelect,
  onToggleCheck,
  onDoToday,
  onSchedule,
  onArchive,
}: InboxQueueItemProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const moreRef = useRef<HTMLDivElement>(null);
  const preview = getQuickCaptureDisplayText(item, item.title);

  const classNames = [
    "inbox-queue__item",
    isActive && "inbox-queue__item--active",
    isStale && "inbox-queue__item--stale",
  ]
    .filter(Boolean)
    .join(" ");

  function handleCheckboxClick(e: React.MouseEvent) {
    e.stopPropagation();
    onToggleCheck();
  }

  function handleDoToday(e: React.MouseEvent) {
    e.stopPropagation();
    onDoToday();
  }

  function handleCalendarClick(e: React.MouseEvent) {
    e.stopPropagation();
    setShowDatePicker(!showDatePicker);
  }

  function handleDateSelect(date: string) {
    setShowDatePicker(false);
    onSchedule(date);
  }

  function handleMoreClick(e: React.MouseEvent) {
    e.stopPropagation();
    setShowMore(!showMore);
  }

  function handleArchiveClick(e: React.MouseEvent) {
    e.stopPropagation();
    setShowMore(false);
    onArchive();
  }

  return (
    <div className={classNames} onClick={onSelect} role="button" tabIndex={0}>
      <div className="inbox-queue__row">
        <input
          type="checkbox"
          className="inbox-queue__checkbox"
          checked={isChecked}
          onChange={() => {}}
          onClick={handleCheckboxClick}
          disabled={isMutating}
          aria-label={`Select ${preview}`}
        />
        <span className={`inbox-queue__kind-dot inbox-queue__kind-dot--${item.kind}`} />
        <span className="inbox-queue__title">{preview}</span>
        <span className="inbox-queue__right">
          <span className="inbox-queue__age">{formatCreatedAt(item.createdAt)}</span>
          {isStale && <span className="inbox-queue__stale-icon" title="Stale — captured over 3 days ago">⚠</span>}
          <span className="inbox-queue__hover-actions">
            <button
              className="inbox-queue__hover-btn inbox-queue__hover-btn--primary"
              type="button"
              onClick={handleDoToday}
              disabled={isMutating}
            >
              Today
            </button>
            <span style={{ position: "relative" }}>
              <button
                className="inbox-queue__hover-btn"
                type="button"
                onClick={handleCalendarClick}
                disabled={isMutating}
                aria-label="Schedule for a date"
              >
                📅
              </button>
              {showDatePicker && (
                <div style={{ position: "absolute", right: 0, top: "100%", zIndex: 20 }} onClick={(e) => e.stopPropagation()}>
                  <SmartDatePicker
                    value={scheduleDate}
                    onChange={handleDateSelect}
                    minDate={today}
                  />
                </div>
              )}
            </span>
            <span style={{ position: "relative" }} ref={moreRef}>
              <button
                className="inbox-queue__hover-btn"
                type="button"
                onClick={handleMoreClick}
                disabled={isMutating}
                aria-label="More actions"
              >
                ···
              </button>
              {showMore && (
                <div
                  className="inbox-queue__more-menu"
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "100%",
                    zIndex: 20,
                    minWidth: "10rem",
                    padding: "0.35rem",
                    borderRadius: "var(--r-sm)",
                    border: "1px solid var(--border)",
                    background: "var(--panel-elevated)",
                    boxShadow: "var(--shadow-md)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="inbox-inspector__text-btn"
                    type="button"
                    style={{ width: "100%", padding: "0.45rem 0.6rem" }}
                    onClick={handleArchiveClick}
                    disabled={isMutating}
                  >
                    Archive
                  </button>
                </div>
              )}
            </span>
          </span>
        </span>
      </div>
      {item.goal && (
        <div className="inbox-queue__goal">
          <span
            className="inbox-queue__goal-dot"
            style={{ background: domainColors[item.goal.domain] ?? domainColors.other }}
          />
          <span>{item.goal.title}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/features/inbox/InboxQueueItem.tsx
git commit -m "feat(inbox): add InboxQueueItem with kind dot, age, and hover quick actions"
```

---

### Task 4: Create `InboxInspector` component

The slide-out inspector panel with meta line, editable title/notes, schedule/goal sections, and secondary actions.

**Files:**
- Create: `client/src/features/inbox/InboxInspector.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useEffect, useState } from "react";

import {
  getReminderDate,
  getTodayDate,
  toIsoDate,
  type TaskItem,
} from "../../shared/lib/api";
import { getQuickCaptureDisplayText, getQuickCaptureText } from "../../shared/lib/quickCapture";
import { GoalCombobox } from "../../shared/ui/GoalCombobox";
import { SmartDatePicker } from "../../shared/ui/SmartDatePicker";

type InboxInspectorProps = {
  item: TaskItem;
  activeGoals: Array<{ id: string; title: string; domain: string; status: string }>;
  goalsLoading: boolean;
  isMutating: boolean;
  onClose: () => void;
  onDoToday: () => void;
  onSchedule: (date: string) => void;
  onLinkGoal: (goalId: string | null) => void;
  onConvertToNote: () => void;
  onArchive: () => void;
  onUpdateTitle: (title: string) => void;
  onUpdateNotes: (notes: string | null) => void;
};

function formatCreatedAt(isoDateTime: string) {
  const date = new Date(isoDateTime);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getKindLabel(kind: string) {
  switch (kind) {
    case "note":
      return "Note";
    case "reminder":
      return "Reminder";
    default:
      return "Task";
  }
}

function getTomorrowDate(isoDate: string) {
  const tomorrow = new Date(`${isoDate}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toIsoDate(tomorrow);
}

export function InboxInspector({
  item,
  activeGoals,
  goalsLoading,
  isMutating,
  onClose,
  onDoToday,
  onSchedule,
  onLinkGoal,
  onConvertToNote,
  onArchive,
  onUpdateTitle,
  onUpdateNotes,
}: InboxInspectorProps) {
  const today = getTodayDate();
  const tomorrow = getTomorrowDate(today);
  const [scheduleDate, setScheduleDate] = useState(
    getReminderDate(item.reminderAt) ?? item.scheduledForDate ?? tomorrow,
  );
  const [goalId, setGoalId] = useState(item.goalId ?? "");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");

  const displayTitle = getQuickCaptureDisplayText(item, item.title);
  const notesText = getQuickCaptureText(item, item.title);

  useEffect(() => {
    setScheduleDate(getReminderDate(item.reminderAt) ?? item.scheduledForDate ?? tomorrow);
    setGoalId(item.goalId ?? "");
    setEditingTitle(false);
    setEditingNotes(false);
  }, [item.id, item.reminderAt, item.scheduledForDate, item.goalId, tomorrow]);

  function handleSchedule() {
    if (scheduleDate) {
      onSchedule(scheduleDate);
    }
  }

  function handleGoalChange(newGoalId: string) {
    setGoalId(newGoalId);
    onLinkGoal(newGoalId || null);
  }

  function startEditTitle() {
    setTitleDraft(item.title);
    setEditingTitle(true);
  }

  function commitTitle() {
    setEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== item.title) {
      onUpdateTitle(trimmed);
    }
  }

  function startEditNotes() {
    setNotesDraft(item.notes ?? "");
    setEditingNotes(true);
  }

  function commitNotes() {
    setEditingNotes(false);
    const trimmed = notesDraft.trim();
    if (trimmed !== (item.notes ?? "")) {
      onUpdateNotes(trimmed || null);
    }
  }

  return (
    <div className="inbox-inspector">
      <div className="inbox-inspector__header">
        <button
          className="inbox-inspector__close"
          type="button"
          onClick={onClose}
          aria-label="Close inspector"
        >
          ✕
        </button>
      </div>
      <div className="inbox-inspector__body">
        <div className="inbox-inspector__meta">
          <span className={`inbox-queue__kind-dot inbox-queue__kind-dot--${item.kind}`} />
          <span>{getKindLabel(item.kind)}</span>
          <span style={{ color: "var(--text-tertiary)" }}>·</span>
          <span>{formatCreatedAt(item.createdAt)}</span>
        </div>

        {editingTitle ? (
          <input
            className="inbox-inspector__title-input"
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitle();
              if (e.key === "Escape") setEditingTitle(false);
            }}
            autoFocus
          />
        ) : (
          <h2
            className="inbox-inspector__title"
            onClick={startEditTitle}
            style={{ cursor: "pointer" }}
            title="Click to edit"
          >
            {displayTitle}
          </h2>
        )}

        {editingNotes ? (
          <textarea
            className="inbox-inspector__notes-input"
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={commitNotes}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditingNotes(false);
            }}
            autoFocus
          />
        ) : (
          <p
            className={`inbox-inspector__notes${!notesText ? " inbox-inspector__notes--empty" : ""}`}
            onClick={startEditNotes}
            style={{ cursor: "pointer" }}
            title="Click to edit"
          >
            {notesText || "Add notes..."}
          </p>
        )}

        <div className="inbox-inspector__divider" />

        <div className="inbox-inspector__section">
          <span className="inbox-inspector__section-label">Schedule</span>
          <div className="inbox-inspector__section-row">
            <button
              className="button button--primary button--small"
              type="button"
              onClick={onDoToday}
              disabled={isMutating}
            >
              Do today
            </button>
            <SmartDatePicker
              value={scheduleDate}
              onChange={setScheduleDate}
              minDate={today}
              disabled={isMutating}
            />
            <button
              className="button button--ghost button--small"
              type="button"
              onClick={handleSchedule}
              disabled={isMutating || !scheduleDate}
            >
              Schedule
            </button>
          </div>
        </div>

        <div className="inbox-inspector__section">
          <span className="inbox-inspector__section-label">Goal</span>
          <GoalCombobox
            goals={activeGoals}
            value={goalId}
            onChange={handleGoalChange}
            disabled={goalsLoading || isMutating}
          />
        </div>

        <div className="inbox-inspector__divider" />

        <div className="inbox-inspector__secondary-actions">
          {item.kind === "task" && (
            <button
              className="inbox-inspector__text-btn"
              type="button"
              onClick={onConvertToNote}
              disabled={isMutating}
            >
              Convert to note
            </button>
          )}
          <button
            className="inbox-inspector__text-btn inbox-inspector__text-btn--danger"
            type="button"
            onClick={onArchive}
            disabled={isMutating}
          >
            Archive
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/features/inbox/InboxInspector.tsx
git commit -m "feat(inbox): add InboxInspector slide-out panel with inline editing"
```

---

### Task 5: Create `InboxBulkBar` component

Floating action bar at the bottom of the screen for bulk operations.

**Files:**
- Create: `client/src/features/inbox/InboxBulkBar.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState } from "react";

import { SmartDatePicker } from "../../shared/ui/SmartDatePicker";

type InboxBulkBarProps = {
  selectedCount: number;
  totalCount: number;
  today: string;
  isMutating: boolean;
  onDoToday: () => void;
  onSchedule: (date: string) => void;
  onArchive: () => void;
  onSelectAll: () => void;
  onClear: () => void;
};

export function InboxBulkBar({
  selectedCount,
  totalCount,
  today,
  isMutating,
  onDoToday,
  onSchedule,
  onArchive,
  onSelectAll,
  onClear,
}: InboxBulkBarProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);

  function handleDateSelect(date: string) {
    setShowDatePicker(false);
    onSchedule(date);
  }

  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="inbox-bulk-bar">
      <span className="inbox-bulk-bar__count">
        {selectedCount} selected
      </span>
      <button
        className="inbox-bulk-bar__select-all"
        type="button"
        onClick={allSelected ? onClear : onSelectAll}
      >
        {allSelected ? "Deselect all" : "Select all"}
      </button>
      <span className="inbox-bulk-bar__divider" />
      <div className="inbox-bulk-bar__actions">
        <button
          className="button button--primary button--small"
          type="button"
          onClick={onDoToday}
          disabled={isMutating}
        >
          Do today
        </button>
        <span style={{ position: "relative" }}>
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={() => setShowDatePicker(!showDatePicker)}
            disabled={isMutating}
          >
            Schedule
          </button>
          {showDatePicker && (
            <div
              style={{ position: "absolute", bottom: "100%", right: 0, zIndex: 31, marginBottom: "0.5rem" }}
              onClick={(e) => e.stopPropagation()}
            >
              <SmartDatePicker
                value=""
                onChange={handleDateSelect}
                minDate={today}
              />
            </div>
          )}
        </span>
        <button
          className="button button--ghost button--small"
          type="button"
          onClick={onArchive}
          disabled={isMutating}
        >
          Archive
        </button>
      </div>
      <button
        className="inbox-bulk-bar__dismiss"
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
      >
        ✕
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/features/inbox/InboxBulkBar.tsx
git commit -m "feat(inbox): add InboxBulkBar floating action bar component"
```

---

### Task 6: Create `InboxTemplatesModal` component

Wrap the existing `WorkflowTemplatesSection` in a modal overlay.

**Files:**
- Create: `client/src/features/inbox/InboxTemplatesModal.tsx`
- Modify: `client/src/features/inbox/WorkflowTemplatesSection.tsx`

- [ ] **Step 1: Create the modal wrapper**

```tsx
import { useEffect } from "react";

import { WorkflowTemplatesSection } from "./WorkflowTemplatesSection";

type InboxTemplatesModalProps = {
  onClose: () => void;
};

export function InboxTemplatesModal({ onClose }: InboxTemplatesModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="inbox-templates-modal">
      <div className="inbox-templates-modal__backdrop" onClick={onClose} />
      <div className="inbox-templates-modal__panel">
        <div className="inbox-templates-modal__header">
          <h2 className="inbox-templates-modal__title">Templates</h2>
          <button
            className="inbox-templates-modal__close"
            type="button"
            onClick={onClose}
            aria-label="Close templates"
          >
            ✕
          </button>
        </div>
        <div className="inbox-templates-modal__body">
          <WorkflowTemplatesSection />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Simplify WorkflowTemplatesSection**

Remove the outer `SectionCard` wrapper and the collapse/expand logic since the modal now provides the container. Edit `WorkflowTemplatesSection.tsx`:

The component currently has two modes: collapsed (shows "Show" button) and expanded (shows full UI inside SectionCard). Since the modal always shows the full view, remove the `isExpanded` state and collapsed view. Remove the `SectionCard` import and wrapper — the modal provides the frame.

Replace the entire component with a version that always shows the expanded content without the SectionCard wrapper, the collapse toggle, and the "Hide templates" button. Keep all template CRUD functionality intact.

The function body should:
1. Remove `isExpanded` state and the collapsed `<section>` return
2. Remove `SectionCard` wrapper — return a `<div>` instead
3. Remove "Hide templates" toolbar button
4. Keep all other state and handlers exactly the same

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/features/inbox/InboxTemplatesModal.tsx client/src/features/inbox/WorkflowTemplatesSection.tsx
git commit -m "feat(inbox): add InboxTemplatesModal and simplify WorkflowTemplatesSection"
```

---

### Task 7: Rewrite `InboxPage.tsx` — the orchestrator

Rewrite the main page to use the new component structure: header with count badge, filter row, single-column queue list, slide-out inspector, bulk bar, and templates modal.

**Files:**
- Modify: `client/src/features/inbox/InboxPage.tsx`

- [ ] **Step 1: Rewrite InboxPage.tsx**

Replace the entire file content. The new version:
- Removes: `PageHeader`, `SectionCard`, summary section, two-column grid, tab bar, inline inspector
- Adds: New header with count badge, filter pills, workspace layout with queue + slide-out inspector
- Uses: `InboxQueueItem`, `InboxInspector`, `InboxBulkBar`, `InboxTemplatesModal`, `InboxEmptyState`
- Keeps: All existing state management, mutations, pagination, utility functions, data flow

```tsx
import { useEffect, useMemo, useRef, useState } from "react";

import { useAppFeedback } from "../../app/providers";
import {
  getReminderDate,
  getTodayDate,
  toIsoDate,
  useBulkUpdateTasksMutation,
  useGoalsListQuery,
  useInboxQuery,
  useUpdateTaskMutation,
  type BulkUpdateTasksInput,
  type TaskItem,
  type TaskListCounts,
} from "../../shared/lib/api";
import { getQuickCaptureText } from "../../shared/lib/quickCapture";
import {
  InlineErrorState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import { InboxBulkBar } from "./InboxBulkBar";
import { InboxEmptyState } from "./InboxEmptyState";
import { InboxInspector } from "./InboxInspector";
import { InboxQueueItem } from "./InboxQueueItem";
import { InboxTemplatesModal } from "./InboxTemplatesModal";

type InboxFilter = "all" | "task" | "note" | "reminder";

const filterOptions: Array<{ id: InboxFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "task", label: "Tasks" },
  { id: "note", label: "Notes" },
  { id: "reminder", label: "Reminders" },
];
const INBOX_PAGE_SIZE = 50;
const EMPTY_COUNTS: TaskListCounts = { all: 0, task: 0, note: 0, reminder: 0 };
const STALE_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000;

function getTomorrowDate(isoDate: string) {
  const tomorrow = new Date(`${isoDate}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toIsoDate(tomorrow);
}

function isItemStale(item: TaskItem) {
  return Date.now() - new Date(item.createdAt).getTime() > STALE_THRESHOLD_MS;
}

function getBulkSuccessMessage(
  action: BulkUpdateTasksInput["action"],
  taskCount: number,
  goalTitle?: string,
) {
  if (action.type === "schedule") {
    const label = action.scheduledForDate === getTodayDate() ? "Moved" : "Scheduled";
    return `${label} ${taskCount} inbox item${taskCount === 1 ? "" : "s"}.`;
  }
  if (action.type === "link_goal") {
    if (!action.goalId) {
      return `Removed the goal link from ${taskCount} inbox item${taskCount === 1 ? "" : "s"}.`;
    }
    return `Linked ${taskCount} inbox item${taskCount === 1 ? "" : "s"} to ${goalTitle ?? "the selected goal"}.`;
  }
  return `Archived ${taskCount} inbox item${taskCount === 1 ? "" : "s"}.`;
}

export function InboxPage() {
  const today = getTodayDate();
  const tomorrow = getTomorrowDate(today);
  const { pushFeedback } = useAppFeedback();
  const goalsListQuery = useGoalsListQuery();
  const updateTaskMutation = useUpdateTaskMutation(today);
  const bulkSuccessMessageRef = useRef("Inbox updated.");
  const bulkUpdateTasksMutation = useBulkUpdateTasksMutation(today, {
    onSuccess: () => {
      setCheckedIds(new Set());
      pushFeedback(bulkSuccessMessageRef.current, "success");
    },
  });

  const [activeFilter, setActiveFilter] = useState<InboxFilter>("all");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [loadedItems, setLoadedItems] = useState<TaskItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const activeKind = activeFilter === "all" ? undefined : activeFilter;
  const inboxQuery = useInboxQuery({
    kind: activeKind,
    limit: INBOX_PAGE_SIZE,
    includeSummary: true,
  });
  const loadMoreQuery = useInboxQuery(
    { kind: activeKind, cursor: nextCursor ?? undefined, limit: INBOX_PAGE_SIZE },
    { enabled: false },
  );

  const activeGoals = useMemo(
    () => (goalsListQuery.data?.goals ?? []).filter((goal) => goal.status === "active"),
    [goalsListQuery.data],
  );
  const goalTitleById = useMemo(
    () => new Map(activeGoals.map((goal) => [goal.id, goal.title])),
    [activeGoals],
  );

  const filteredItems = loadedItems;
  const selectedItem = filteredItems.find((item) => item.id === selectedItemId) ?? null;
  const hasBulkSelection = checkedIds.size > 0;
  const isMutating = updateTaskMutation.isPending || bulkUpdateTasksMutation.isPending;

  // Reset on filter change
  useEffect(() => {
    setLoadedItems([]);
    setNextCursor(null);
    setSelectedItemId(null);
    setCheckedIds(new Set());
    setIsLoadingMore(false);
  }, [activeKind]);

  // Sync loaded items from query
  useEffect(() => {
    if (!inboxQuery.data) return;
    setLoadedItems(inboxQuery.data.tasks);
    setNextCursor(inboxQuery.data.nextCursor);
    setIsLoadingMore(false);
  }, [inboxQuery.data]);

  // Clean up stale selected/checked IDs
  useEffect(() => {
    const visibleIds = new Set(filteredItems.map((item) => item.id));
    if (selectedItemId && !visibleIds.has(selectedItemId)) {
      setSelectedItemId(null);
    }
    setCheckedIds((current) => {
      const cleaned = new Set([...current].filter((id) => visibleIds.has(id)));
      return cleaned.size === current.size ? current : cleaned;
    });
  }, [filteredItems, selectedItemId]);

  // Close inspector when entering bulk mode
  useEffect(() => {
    if (hasBulkSelection) {
      setSelectedItemId(null);
    }
  }, [hasBulkSelection]);

  const counts = inboxQuery.data?.counts ?? EMPTY_COUNTS;
  const mutationError =
    updateTaskMutation.error instanceof Error
      ? updateTaskMutation.error.message
      : bulkUpdateTasksMutation.error instanceof Error
        ? bulkUpdateTasksMutation.error.message
        : null;

  const retryAll = () => {
    void inboxQuery.refetch();
    void goalsListQuery.refetch();
  };

  async function handleLoadMore() {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const result = await loadMoreQuery.refetch();
      if (!result.data) return;
      setLoadedItems((current) => [...current, ...result.data.tasks]);
      setNextCursor(result.data.nextCursor);
    } finally {
      setIsLoadingMore(false);
    }
  }

  function toggleCheck(taskId: string) {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }

  function selectAll() {
    setCheckedIds(new Set(filteredItems.map((item) => item.id)));
  }

  function clearSelection() {
    setCheckedIds(new Set());
  }

  // Single-item actions
  function handleDoToday(taskId: string) {
    const item = filteredItems.find((i) => i.id === taskId);
    updateTaskMutation.mutate({
      taskId,
      scheduledForDate: today,
      reminderAt: item?.kind === "reminder" ? today : undefined,
    });
  }

  function handleSchedule(taskId: string, date: string) {
    const item = filteredItems.find((i) => i.id === taskId);
    updateTaskMutation.mutate({
      taskId,
      scheduledForDate: date,
      reminderAt: item?.kind === "reminder" ? date : undefined,
    });
  }

  function handleArchive(taskId: string) {
    updateTaskMutation.mutate({ taskId, status: "dropped" });
  }

  function handleConvertToNote(taskId: string) {
    const item = filteredItems.find((i) => i.id === taskId);
    if (!item) return;
    const text = getQuickCaptureText(item, item.title);
    updateTaskMutation.mutate({
      taskId,
      kind: "note",
      notes: text || item.title,
      reminderAt: null,
    });
  }

  function handleLinkGoal(taskId: string, goalId: string | null) {
    updateTaskMutation.mutate({ taskId, goalId });
  }

  function handleUpdateTitle(taskId: string, title: string) {
    updateTaskMutation.mutate({ taskId, title });
  }

  function handleUpdateNotes(taskId: string, notes: string | null) {
    updateTaskMutation.mutate({ taskId, notes });
  }

  // Bulk actions
  function runBulkAction(action: BulkUpdateTasksInput["action"]) {
    const taskIds = [...checkedIds];
    if (taskIds.length === 0) return;
    bulkSuccessMessageRef.current = getBulkSuccessMessage(
      action,
      taskIds.length,
      action.type === "link_goal" ? goalTitleById.get(action.goalId ?? "") : undefined,
    );
    bulkUpdateTasksMutation.mutate({ taskIds, action } as BulkUpdateTasksInput);
  }

  function handleBulkDoToday() {
    runBulkAction({ type: "schedule", scheduledForDate: today });
  }

  function handleBulkSchedule(date: string) {
    runBulkAction({ type: "schedule", scheduledForDate: date });
  }

  function handleBulkArchive() {
    runBulkAction({ type: "archive" });
  }

  // Loading / error states
  if (inboxQuery.isLoading && !inboxQuery.data) {
    return (
      <PageLoadingState
        title="Loading inbox"
        description="Collecting captured tasks, notes, and reminders so you can triage them calmly."
      />
    );
  }

  if (inboxQuery.isError || !inboxQuery.data) {
    return (
      <PageErrorState
        title="Inbox unavailable"
        message={inboxQuery.error instanceof Error ? inboxQuery.error.message : undefined}
        onRetry={retryAll}
      />
    );
  }

  return (
    <div className="page">
      <div className="inbox-header">
        <h1 className="inbox-header__title">
          Inbox
          {counts.all > 0 && <span className="inbox-header__count">{counts.all}</span>}
        </h1>
        <button
          className="button button--ghost button--small"
          type="button"
          onClick={() => setIsTemplatesOpen(true)}
        >
          Templates
        </button>
      </div>

      <div className="inbox-filters" role="tablist" aria-label="Inbox filters">
        {filterOptions.map((option) => {
          const count = counts[option.id];
          const isActive = activeFilter === option.id;
          const isZero = count === 0 && option.id !== "all";
          return (
            <button
              key={option.id}
              className={[
                "inbox-filters__item",
                isActive && "inbox-filters__item--active",
                isZero && "inbox-filters__item--zero",
              ]
                .filter(Boolean)
                .join(" ")}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveFilter(option.id)}
            >
              {option.label} <span className="inbox-filters__count">{count}</span>
            </button>
          );
        })}
      </div>

      {mutationError && <InlineErrorState message={mutationError} onRetry={retryAll} />}

      <div className="inbox-workspace">
        <div className="inbox-workspace__list">
          {filteredItems.length > 0 ? (
            <div className="inbox-queue">
              {filteredItems.map((item) => (
                <InboxQueueItem
                  key={item.id}
                  item={item}
                  isActive={item.id === selectedItemId}
                  isChecked={checkedIds.has(item.id)}
                  isStale={isItemStale(item)}
                  isMutating={isMutating}
                  today={today}
                  onSelect={() => {
                    setSelectedItemId(item.id);
                    setCheckedIds(new Set());
                  }}
                  onToggleCheck={() => toggleCheck(item.id)}
                  onDoToday={() => handleDoToday(item.id)}
                  onSchedule={(date) => handleSchedule(item.id, date)}
                  onArchive={() => handleArchive(item.id)}
                  onConvertToNote={() => handleConvertToNote(item.id)}
                  onLinkGoal={() => {}}
                />
              ))}

              {loadMoreQuery.isError && (
                <InlineErrorState
                  message={
                    loadMoreQuery.error instanceof Error
                      ? loadMoreQuery.error.message
                      : "More inbox items could not load."
                  }
                  onRetry={() => void handleLoadMore()}
                />
              )}

              {nextCursor && (
                <div className="inbox-queue__load-more">
                  <button
                    className="button button--ghost button--small"
                    type="button"
                    onClick={() => void handleLoadMore()}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? "Loading more..." : "Load more"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <InboxEmptyState />
          )}
        </div>

        {selectedItem && !hasBulkSelection && (
          <>
            <div
              className="inbox-inspector-backdrop"
              onClick={() => setSelectedItemId(null)}
            />
            <div className="inbox-workspace__inspector">
              <InboxInspector
                item={selectedItem}
                activeGoals={activeGoals}
                goalsLoading={goalsListQuery.isLoading}
                isMutating={isMutating}
                onClose={() => setSelectedItemId(null)}
                onDoToday={() => handleDoToday(selectedItem.id)}
                onSchedule={(date) => handleSchedule(selectedItem.id, date)}
                onLinkGoal={(goalId) => handleLinkGoal(selectedItem.id, goalId)}
                onConvertToNote={() => handleConvertToNote(selectedItem.id)}
                onArchive={() => handleArchive(selectedItem.id)}
                onUpdateTitle={(title) => handleUpdateTitle(selectedItem.id, title)}
                onUpdateNotes={(notes) => handleUpdateNotes(selectedItem.id, notes)}
              />
            </div>
          </>
        )}
      </div>

      {hasBulkSelection && (
        <InboxBulkBar
          selectedCount={checkedIds.size}
          totalCount={filteredItems.length}
          today={today}
          isMutating={isMutating}
          onDoToday={handleBulkDoToday}
          onSchedule={handleBulkSchedule}
          onArchive={handleBulkArchive}
          onSelectAll={selectAll}
          onClear={clearSelection}
        />
      )}

      {isTemplatesOpen && (
        <InboxTemplatesModal onClose={() => setIsTemplatesOpen(false)} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: No type errors.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add client/src/features/inbox/InboxPage.tsx
git commit -m "feat(inbox): rewrite InboxPage with single-column layout and slide-out inspector

Replaces two-column dashboard with focused triage interface:
- Single-column queue with hover quick actions
- Slide-out inspector panel (380px, follows GoalInspectorPanel pattern)
- Floating bulk action bar at bottom
- Templates moved to modal
- Inbox zero empty state"
```

---

### Task 8: Final verification and cleanup

Verify everything builds and typechecks, clean up any unused imports.

**Files:**
- Possibly modify: any file with leftover import issues

- [ ] **Step 1: Run full typecheck**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 2: Run full build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Check for unused imports in InboxPage.tsx**

Verify `GoalCombobox`, `SectionCard`, `SmartDatePicker`, `PageHeader`, `WorkflowTemplatesSection` are no longer directly imported in InboxPage.tsx (they're used by sub-components instead). Verify `getQuickCaptureDisplayText` is no longer needed in InboxPage.tsx (it's in InboxQueueItem and InboxInspector).

- [ ] **Step 4: Run server tests to make sure nothing backend is broken**

Run: `npm test -w server`
Expected: All tests pass (no backend changes were made).

- [ ] **Step 5: Final commit if any cleanup was needed**

```bash
git add -A
git commit -m "chore(inbox): cleanup unused imports after redesign"
```
