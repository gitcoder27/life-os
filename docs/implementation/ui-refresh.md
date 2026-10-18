# UI refresh — calm editorial pass (branch `style/ui-refresh`)

Scope: `/home`, `/today`, `/planner`, `/inbox`, `/habits`, plus the shared foundation
(tokens, shell, primitives). Visual-only: CSS, plus className/markup-wrapper tweaks. Dark-only.

## 1. Audit (baseline: `main` @ 6890b41)

### Global token drift

Measured across all 37 stylesheets (36.8k lines):

| Drift | Count | Notes |
| --- | --- | --- |
| Hard-coded colors | 1,889 (1,719 `rgb[a]()`, 170 hex) | Mostly white overlays (`rgba(255,255,255,0.006…0.1)`, 14 distinct alphas), amber (`217,153,58` at 30+ distinct alphas), plus near-duplicates of the same amber (`216,166,95`, `216,166,83`, `240,192,96`) and green (`93,184,106`, `103,191,115`, `111,177,119`). `#0f0d08` (text on accent) hard-coded 16× |
| Gradients | 219 | Card surfaces (`linear-gradient(180deg, elevated, panel)`), decorative radial light spots, gradient text on the score hero, gradient primary buttons |
| `backdrop-filter` | 35 | Several on in-flow panels, not only overlays |
| `box-shadow` | 283 | Colored amber "glow" shadows on buttons, dots, fills; large drop shadows on in-flow cards |
| `:focus-visible` rules | 39 | Most interactive elements rely on the browser default or nothing; 7 rules in priority files set `outline: none` and replace it with a color-only change |
| `prefers-reduced-motion` | 2 blocks | Page entrance `slideUp`, `.stagger`, infinite pulses (`glowPulse`, `nowDotPulse`, `nowLinePulse`) run regardless |
| Body background | 2 radial gradients on `:root` + 1 on `.shell-main` | Amber/green light spots behind every page |
| Radius | 4 tokens (6/10/16/22px) + ~80 one-off values (`0.52rem`, `0.72rem`, `1.25rem`, `14px`…) | |
| Type | 9 `--fs-*` tokens, but Home and Today desk use **0** of them (73 + 106 literal sizes, 29 + 26 distinct values). 89 uses of `--font-display` (Fraunces) on labels, card titles, inbox preview text, avatars | |
| Spacing | No tokens. Gaps/paddings use ~40 distinct rem values (`0.12`, `0.26`, `0.38`, `0.42`, `0.58`…) | |
| Unreferenced CSS | ~20–70% of classes per file have no matching `className` in TSX (heuristic) | Not removed in this pass — dynamic class names make deletion risky |

Contrast (WCAG, against `--panel #191714`): `--text` 14.2, `--text-secondary` 7.1, `--text-tertiary`
5.1, `--accent` 7.3, `--positive` 7.3 — all fine. Problems: `--negative` as text 4.2 (fails AA for
small text); Home's private `--home-ink-faint` (`rgba(160,149,126,0.58)`) is **2.9** and is used
for every eyebrow/label on Home, at 8.7–10.2px (`0.58rem`–`0.68rem` with a 15px root).

### Per screen

**Home** (`90-home-dashboard.css`, 2.3k lines; `features/home/*`)
1. Five competing "hero" surfaces: status instrument, focus stage, focus-session banner, launch strip, essentials. Each has its own layered radial + linear gradient, inset highlight and a 24–60px drop shadow, so nothing reads as primary.
2. Private palette (`--home-hairline`, `--home-card-bg`, `--home-ink-faint`) duplicates and diverges from foundation tokens; tier colors are hard-coded hex gradients (`--hud-fill`).
3. Micro-labels at 0.58–0.68rem uppercase with 0.11–0.14em tracking and 2.9:1 contrast — the hardest-to-read text in the app is the scaffolding of the first screen.
4. Glow drop-shadows on score ring, bars and goal dots; 11 hover rules lift elements with `translateY`.
5. Fraunces used on inbox preview text, essentials values and avatar initials, diluting the display face.

**Today** (`today-desk.css` 3.4k, `execute-v2.css` 1.8k, `shared.css` 1.8k, `adaptive-v2.css`)
1. Command bar, active mode button, must-win card, selected/focus stream tasks and the primary launch button all use amber gradients + glow shadows — "current state" and "primary action" are indistinguishable from decoration.
2. 106 literal font sizes (24 below 0.7rem) in `today-desk.css`; Fraunces on inspector titles, must-win title and empty states.
3. Three layers of styling for the same elements (`shared.css` → `execute-v2.css` → `today-desk.css` scoped overrides), each with its own colors.
4. Focus rings on inputs are `box-shadow` halos in accent at 3px, inconsistent with buttons, which mostly have none.

**Planner** (`features/today/styles/planner/*`, 5.2k lines)
1. Current block and drop target use gradient fills + glow; the now-line and gutter dot pulse infinitely (`nowLinePulse`, `nowDotPulse`) with no reduced-motion guard.
2. Overflow menus and the block form use `backdrop-filter` blur over the timeline.
3. Every block animates in (`plannerBlockIn` 0.4s) on each render of the planner.
4. Upcoming calendar skeletons use a shimmer gradient; empty mark is a gradient blob.

**Inbox** (`15-inbox.css`, 0.9k lines) — already the calmest screen
1. Header, inspector title, templates modal title and inbox-zero title all in Fraunces.
2. Inspector title/notes inputs set `outline: none` with no replacement focus indicator.
3. Inspector panel uses a gradient surface + large shadow while docked in-flow.

**Habits** (`30-home-and-recurrence.css` §Habits, plus a second "visual polish" override layer at the end of the same file)
1. Habit and routine groups, score strip, challenge cards and collapsibles each have gradient backgrounds and colored inset/drop shadows; the override layer repeats most of them with slightly different values.
2. `--habit-amber/blue/green` and a dozen literal colors duplicate the semantic tokens.
3. Check boxes animate with `--ease-bounce` (1.56 overshoot).

### Plan

Foundation first (tokens, shell, primitives, shared UI), then one commit per screen. Hard-coded
colors in the files that serve the five screens are mapped to tokens. Other screens (health,
meals, finance, goals, reviews, notifications, settings) inherit the new foundation tokens but
keep their own one-off values; they are listed under "left undone".

## 2. What changed (before → after)

Commits on `style/ui-refresh`, each passing `npm run typecheck`, `npm run build`,
`npm test -w client` (86/86) and `npm test -w server` (340 passed, 8 skipped):

| Commit | Scope |
| --- | --- |
| `af3f68b` style(ui) | Foundation tokens, shell, primitives, shared UI |
| `c3b26ce` style(home) | Home command desk |
| `5f7901b` style(today) | Today execution desk |
| `e0ef2f2` style(planner) | Planner timeline, rail, upcoming calendar |
| `b0db1f5` style(inbox) | Inbox queue, inspector, empty state |
| `1382fbf` style(habits) | Habits page, challenge cards, Recurrence editor |
| `d5a7f49` style(ui) | `transition: all` → explicit properties; essentials-row focus ring |

Counts are taken on the stylesheets that serve each screen, comments excluded, from `main` (6890b41) to now.
"Shadows" covers every non-`none` `box-shadow`. What remains is focus rings, 2–3px state bars and
floating layers (menus, popovers, the fixed inspector, drag ghosts), with no glows and no drop shadows
on in-flow panels.

| Group | colors | gradients | backdrop | shadows | Fraunces | infinite | literal font-size | `transition: all` | hover lifts |
|---|---|---|---|---|---|---|---|---|---|
| Foundation (00,10,11,13,16,20) | 189 → 46 | 34 → 0 | 5 → 4 | 31 → 17 | 14 → 4 | 7 → 2 | 19 → 10 | 16 → 0 | 2 → 0 |
| Home (90) | 152 → 2 | 20 → 0 | 0 → 0 | 21 → 6 | 7 → 1 | 0 → 0 | 73 → 2 | 0 → 0 | 11 → 2* |
| Today (today-desk, execute-v2, shared, adaptive-v2, 40) | 352 → 0 | 35 → 0 | 0 → 0 | 56 → 52 | 10 → 2 | 0 → 0 | 130 → 2 | 28 → 0 | 5 → 0 |
| Planner (planner/*) | 372 → 0 | 18 → 1 | 4 → 0 | 38 → 32 | 4 → 0 | 4 → 1 | 46 → 3 | 10 → 0 | 6 → 0 |
| Inbox (15) | 24 → 0 | 2 → 0 | 3 → 0 | 7 → 7 | 5 → 1 | 0 → 0 | 5 → 0 | 6 → 0 | 0 → 0 |
| Habits (30) | 210 → 1 | 13 → 0 | 0 → 0 | 21 → 23 | 1 → 0 | 0 → 0 | 21 → 1 | 13 → 0 | 1 → 0 |

Notes on the leftovers:
- The foundation's 46 colors are the token definitions themselves.
- The 4 foundation backdrops are the sticky shell header and the mobile bottom nav, standard and `-webkit-` each.
- The remaining Fraunces uses are page titles, the shell brand mark and the score numerals: the Home ring value, the Today command-bar score and the Inbox page title.
- The remaining infinite animations are the loading spinner/sweep and the Planner skeleton pulse. The reduced-motion block stops all of them.
- Planner's one gradient is the dotted drag-handle pattern (`currentColor` dots).
- The color left on Home and Habits is the categorical health teal (`#5db8b0`). Home also keeps the growth violet (`#b07cd8`).
- Habits shadows went up by 2 because two inputs gained focus rings.
- \* The 2 remaining Home matches are the history tooltip sliding into place when its day is hovered, not lifts on the hovered element.

### Foundation
- **Before:** two amber/green radial light spots behind every page. 16–22px radii, colored glow shadows on buttons and dots, and a pulsing glow keyframe. Most controls had no `:focus-visible` style, and only 2 reduced-motion guards existed.
- **After:** a flat `--bg` and flat `--panel` surfaces with a 1px `--border`.
  - Radii are 4/6/10/12px.
  - One zero-specificity focus ring (`--focus-ring`, 2px, offset 2px) covers every control.
  - Disabled controls get `cursor: not-allowed`.
  - Scores, money and times use tabular numerals by default.
  - `.stagger` is 0.28s with at most 0.12s of delay, only under `prefers-reduced-motion: no-preference`. A global reduce block settles every animation and transition.
  - Primary buttons are solid accent with an `--accent-hover` hover and 0.98 press. Ghost buttons shift border and wash.
  - The loading state is a small two-ring spinner from `PageState.tsx`.
  - The score ring uses a solid accent stroke; the SVG gradient `<defs>` are gone.

### Home
- **Before:**
  - Five hero surfaces competed: status instrument, focus stage, focus-session banner, launch strip and essentials. Each had a layered gradient, an inset sheen and a 24–60px shadow.
  - Labels were 0.58–0.68rem at 2.9:1 contrast.
  - 11 hover rules lifted elements.
  - Fraunces was used on the headline, essentials values, inbox preview (italic) and avatar.
- **After:**
  - Hierarchy: the focus stage is the single bordered hero. The must-win headline is body font, weight 600, at `--fs-display`. The only accent fill on the page is the CTA. Eyebrows use `--accent` only where they name the current focus.
  - Readability: labels are `--fs-micro` (11.25px) at 5.1:1 (`--text-tertiary`).
  - Score and history:
    - Fraunces stays on the score ring numeral.
    - Tier colors are tokens.
    - The history ribbon uses `color-mix` tones of `--negative-text`/`--accent`.
    - Today's mark has a 1px `--text-tertiary` ring.
  - Hover and focus: hovers shift neutral borders or underline text, with no translate. The history toggle and task-picker choices keep the global focus ring.
  - Mobile: at ≤860px the focus stage has real padding (`--space-5`, `--space-4` at ≤560px), so the headline no longer touches the card edge.

### Today
- **Before:**
  - Command bar, active mode button, must-win card, selected and focused stream rows and the launch button all used amber gradients and glows, so the current state looked like decoration.
  - `today-desk.css` had 106 literal font sizes, and Fraunces was on the inspector, must-win and empty-state titles.
  - Three style layers (shared → execute-v2 → today-desk) each had their own colors.
- **After:**
  - Accent marks only:
    - the must-win CTA;
    - the selected stream row (2px `--accent` bar on `--wash-2`);
    - the focus task (3px bar);
    - the live focus session;
    - the command-bar mode badge.
  - Secondary hovers (27 rules) are neutral, and must-win actions have tokenized disabled states.
  - The must-win title is body font at `--fs-display`; the inspector title is `--fs-h1`.
  - Focus:
    - Stream rows use `--focus-ring`.
    - The workbench resize handle draws its focus state on its divider line.
    - Essentials rows get an inset ring.
  - All three layers resolve to the same tokens.

### Planner
- **Before:**
  - The now-line dot and cleanup indicator pulsed forever.
  - Every block animated in for 0.4s with a translate and scale.
  - Skeletons swept a gradient.
  - Menus and the block form used backdrop blur.
  - The current block and drop target had gradient fills with glows and a 1.01 scale.
  - A local `.stagger` overrode the foundation with delays up to 0.4s.
- **After:**
  - The now-line and dot are static; the dot has a 2px `--bg` halo so it reads on the line.
  - Blocks fade in over `--dur`, only without reduced motion.
  - Skeletons breathe with an opacity pulse, also gated on reduced motion.
  - Menus and popovers are opaque `--panel-elevated` with one floating shadow. The block form is a flat in-flow panel with a 2px accent edge.
  - The current block uses `--accent-wash` with an accent left bar, and the drop target no longer scales.
  - The local `.stagger` is removed.
  - The FullCalendar neutral fill is `--wash-2` and its today fill is `--accent-wash`.

### Inbox
- **Before:** the inspector, templates modal and inbox-zero titles were in Fraunces. The inspector title/notes inputs set `outline: none` and showed a permanent ring. The empty state was a one-off with a decorative glyph.
- **After:**
  - Only the page title stays in Fraunces.
  - The inspector inputs rest on a neutral border, show the focus border and ring on `:focus`, and have disabled styles.
  - The fixed inspector keeps one `--shadow-md`.
  - Inbox zero renders the shared `EmptyState` with the same copy.
  - The note kind dot uses `--info`.

### Habits
`30-home-and-recurrence.css` serves Habits and the shared Recurrence editor, not Home.
- **Before:**
  - The "visual polish" layer at the end of the file forked the palette (`--habit-surface/amber/blue/green` plus a dozen literals).
  - The Recurrence editor used space-separated `rgba()` values.
  - Check boxes used `transition: all` with the 1.56-overshoot bounce.
- **After:**
  - `--habit-*` aliases the foundation tokens, and every color in the file is a token except the categorical health teal.
  - Check boxes transition explicit properties on `--ease`.
  - The habit select and routine item inputs get the focus border and ring.
  - The streak badge is neutral, and the score label is body font.

## 3. Tokens

**Added:**
- Washes: `--wash-1…5`, `--sunken`, `--scrim`
- Borders and focus: `--border-subtle`, `--focus-ring`
- Accent: `--accent-hover`, `--accent-wash`, `--accent-line`, `--on-accent`
- Semantic: `--positive-line`, `--negative-text`, `--negative-line`, `--info`, `--info-soft`, `--info-line`
- Spacing: `--space-1`, `--space-1-5`, `--space-2`, `--space-3`, `--space-4`, `--space-5`, `--space-6`, `--space-8`, `--space-10`, `--space-12`
- Type: `--font-mono`, `--tracking-label`

**Removed:** `--shadow-glow`, `--accent-glow`, and the `glowPulse` keyframe. Stale references to the undefined `--r-md`, `--warning`, `--radius` and `--accent-rgb` were repointed to defined tokens.

**Changed values:**
- `--border`, `--border-active`: amber tint (0.09/0.22) → neutral warm white (0.085/0.16).
- `--border-focus`: 0.38 → 0.55 amber.
- `--r-xs/sm/r/lg`: 6/10/16/22px → 4/6/10/12px.
- `--fs-mega`, `--fs-display`, `--fs-h1`, `--fs-h2`: each about 15–25% smaller.
- `--ease-bounce`: 1.56 → 1.12 overshoot.
- `--dur`: 200 → 180ms. `--dur-slow`: 400 → 260ms.
- `--shadow-sm/md/lg`: retuned for floating layers only.

Text colors (`--text*`) are unchanged, so 99-readability.css still holds. Contrast on `--panel`:
- `--text-tertiary`: 5.1. On `--panel-elevated` it is 4.8.
- `--negative-text`: 6.5. It replaces `--negative` as text, which was 4.2.
- `--info`: 8.1.
- `--on-accent` on `--accent`: 7.9.
- The old Home label color was 2.9.

## 4. Manual checklist (running client, http://localhost:5174)

Check each screen at **~1440px** (desktop sidebar) and **~390px** (mobile bottom nav), then once with
OS "reduce motion" on.

**All five screens**
- [ ] Background is a flat warm near-black. There are no amber or green light spots behind content and no glows around buttons, dots or cards.
- [ ] Panels are flat with a 1px hairline. Only menus, popovers, the Inbox inspector and drag ghosts float with a shadow.
- [ ] Tabbing shows a 2px amber ring on every button, link, tab, checkbox and row. Inputs show an amber border plus a soft ring. Nothing gets focus invisibly.
- [ ] Hovering controls never moves them. Pressing buttons gives a slight shrink. Disabled buttons look dim and show a not-allowed cursor.
- [ ] Fraunces (serif) appears only on page titles and score numerals.
- [ ] Scores, money, counts and times line up in columns (tabular numerals).
- [ ] With reduce motion on, nothing animates: no entrance fades, no spinners rotating past one turn, no skeleton pulse.
- [ ] At 390px:
  - Bottom nav and capture button work.
  - "More" opens `MobileMoreSheet` with a dimmed backdrop.
  - Focusing an input does not zoom the page (iOS 16px rule).
  - No horizontal scroll.

**/home**
- [ ] The first glance reads: status instrument (score ring + bars), then the focus stage headline, then the amber CTA. No other amber fills compete.
- [ ] Score ring and bars draw in quickly (under 0.7s). Tier colors match: off-track red, recovering/solid amber, strong green.
- [ ] History ribbon:
  - Hovering a day shows the tooltip.
  - Today's mark has a thin ring.
  - The toggle opens and closes the history panel.
  - Keyboard focus on the toggle is visible.
- [ ] Focus stage:
  - Setup and empty states read correctly.
  - Task-picker choices, browse search and options highlight neutrally; the active choice is amber-washed.
  - Goal dots stay distinct: career blue, health teal, growth violet, finance gold.
- [ ] Launch cards: hover raises only the border and background. Titles are sans-serif.
- [ ] Rail: link hover underlines the title. Completed priorities are struck in green; dropped ones are struck in gray.
- [ ] At 390px the focus stage has padding on all sides and the headline wraps without touching the card edge.

**/today**
- [ ] Command bar is a flat strip with the score numeral in serif. The mode toggle shows the active mode as a lighter segment, and the badge count is amber.
- [ ] Must-win: sans-serif title. The primary button is solid amber with no glow; the others are outlined or ghost. A disabled button looks clearly disabled.
- [ ] Stream:
  - Selecting a task shows a 2px amber left bar on a faint wash.
  - During a focus session, the focus task has a 3px bar and the other rows are muted.
  - Quick actions and check boxes hover neutrally.
- [ ] Workbench:
  - Drag the resize handle.
  - Tab to it: its divider line turns bright amber.
  - Daily-essentials rows show an inset focus ring.
- [ ] Inspector, launch and drift sheets and the capture sheet open without blur artifacts and stay readable.
- [ ] At 390px the command bar wraps cleanly, and the stream and rail stack.

**/planner**
- [ ] The now-line and gutter dot are steady (no pulsing). The current block has an amber wash and left bar.
- [ ] Dragging a task over a block highlights it without scaling, and the drop label shows.
- [ ] Block overflow menu, target picker, focus picker and calendar popover are opaque and readable over the timeline.
- [ ] Opening the block form shows a flat panel with an amber left edge.
- [ ] Upcoming view:
  - While loading, skeletons pulse softly (no sweeping shine).
  - The calendar month title is sans-serif.
  - Today's cell is faintly amber.
  - Reminder dots are blue-gray.
- [ ] Blocks fade in once on load and do not re-animate on every interaction.
- [ ] At 390px the timeline, unplanned lane and rail stack, and the view switch stays tappable.

**/inbox**
- [ ] Page title is serif; queue items and the inspector are sans-serif. Kind dots: task amber, note blue, reminder red.
- [ ] Inspector:
  - Click the title and the notes.
  - Each input appears with a neutral border and shows the amber ring once focused.
  - Saving on blur still works.
- [ ] Bulk bar slides up and is readable.
- [ ] The templates modal opens with a scrim.
- [ ] With an empty inbox, "All clear." shows in the shared dashed empty-state box, centered.
- [ ] At 390px the inspector opens full-screen over a scrim.

**/habits**
- [ ] Score strip is flat. Score value and current sparkline point are amber; the other points are muted.
- [ ] Groups:
  - Habits have an amber edge; routines have a blue edge; completed routines have a green edge.
  - Count chips match their group color.
- [ ] Check boxes:
  - Hover neutrally.
  - Checking turns them green with only a slight settle, no big bounce.
  - Routine boxes are round and blue-tinted.
- [ ] Manage section: the collapsible opens. Pause pills and tags are readable, and the archived status dot is gray.
- [ ] Recurrence editor (habit form): frequency and day buttons show hover, the selected state is amber-washed, and focus rings are visible.
- [ ] Routine item editor: the inputs show the focus border and ring. Reordering arrows hover neutrally and are disabled at the ends.
- [ ] At 390px the score strip stacks and check rows stay at least 44px tall.

## 5. Left undone / follow-ups

- **Other screens** (health, meals, finance, goals, reviews, notifications, settings, login) did not get the codemod. They inherit the new borders, radii and shadow tokens but keep their own literal colors, gradients and `transition: all`. The radius change (16→10px etc.) is the most visible inherited change there; review those screens too.
- **`--danger`** is still undefined. `14-review-and-domain.css:655` and an inline style in `features/auth/LoginPage.tsx:55` rely on the `#e88f8f` fallback. Map both to `--negative-text`.
- **Categorical colors** remain literals: health `#5db8b0`, growth `#b07cd8` and discipline `#b48ead`. A small `--cat-*` set would make them themeable.
- **Unreferenced CSS** (no matching `className` in TSX, e.g. `.today-hero*`, `.today-stage-empty*`, `.daily-launch*`, `.guidance-rail*`) was restyled but not deleted, because dynamic class names make removal risky without a coverage run.
- **Keyboard access:** the Inbox inspector title and notes are click-to-edit `<h2>`/`<p>` elements with no keyboard entry point. That needs a behavior change (button role or tabindex), so it is out of scope for a visual pass.
- **Focus-mode dimming** on Today (`stream-task--focus-muted` at 0.44 opacity, workbench support at 0.46) is intentionally kept. The muted rows fall below AA contrast while a session runs.
- **Always-on rings:** the goal combobox input and the Inbox inspector inputs only exist while editing, so their rings are effectively always on while visible.
- **Theme:** no light theme was added. The app stays dark-only.
- **Not verified visually:** no browser was opened. Everything above was validated by typecheck, production build, both test suites and code review; the checklist in §4 covers what still needs eyes.
