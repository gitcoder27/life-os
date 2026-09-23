# Life OS — Mobile Browser Support Review

- **Date:** 2026-09-05
- **Scope:** `client/` (shell, styles, all feature areas), `client/index.html`, `client/public/`, `deploy/nginx/`, built bundle in `client/dist/`
- **Method:** Static review of shell/markup/CSS/components plus built-artifact inspection. No live device testing was performed; device-verification items are flagged in Appendix D.
- **Overall verdict:** The app renders and works well on phones — mobile support is deliberate, not accidental. One design gap (navigation reaches only half the app), one platform-level annoyance (iOS input zoom), and several polish/performance misses (no PWA install story, no safe-area handling, uncompressed assets on a heavy bundle). Nothing is fundamentally broken.

---

## 1. Executive Summary

| Area | State |
|---|---|
| Rendering / layout on phones | Good — responsive breakpoints throughout, bottom sheet patterns |
| Touch interaction | Good — dnd-kit pointer sensors, `(hover: none)` fallbacks on core surfaces |
| Forms & keyboards | Good — native date/time inputs, `inputMode`, autofill attributes |
| Navigation on phones | **Gaps** — bottom tab bar exposes 5 of 11 destinations; Finance effectively unreachable |
| Platform plumbing | **Missing** — no PWA manifest, no `theme-color`, no safe-area insets, iOS input zoom |
| Performance on mobile networks | Mixed — route-level code splitting, but heavy payload with no server compression |

Top five actions, in priority order:

1. **Complete mobile navigation** (More tab / drawer) — every page reachable by a predictable, always-present control.
2. **Fix iOS focus zoom** — form controls must compute to ≥16px.
3. **Add mobile platform plumbing** — web manifest, `theme-color`, `apple-touch-icon`, safe-area insets.
4. **Enable gzip/brotli at nginx** — ~1.3MB of JS/CSS currently travels uncompressed.
5. **Close remaining hover-only action gaps** (goals cards, today task cards, home tooltips).

---

## 2. What Already Works Well

Evidence that mobile support was designed for, not bolted on:

### 2.1 Mobile shell chrome
- Below 960px the sidebar is hidden and replaced by a fixed bottom tab bar (`repeat(5, 1fr)`) plus a circular capture FAB — `client/src/styles/16-responsive.css:3-178`.
- The header capture button is hidden on mobile; the FAB takes over — `16-responsive.css:147-149`.
- Quick capture becomes a full-width bottom sheet (`max-height: 85vh`, rounded top corners, scrollable) — `16-responsive.css:151-159`.
- The notification center converts to a bottom sheet on mobile with `max(1rem, env(safe-area-inset-bottom))` padding — `client/src/styles/80-notifications.css:826-855`.
- The inbox inspector overlays as a centered card at ≤960px and goes full-screen at ≤640px — `client/src/styles/15-inbox.css:831-861`.

### 2.2 Touch fallbacks for hover-revealed actions
Core task surfaces reveal row actions on `:hover` on desktop and unconditionally on touch via `@media (hover: none)`:

| File | Line | Covers |
|---|---|---|
| `client/src/styles/40-today-workspace.css` | 614 | `.priority-card__actions`, `.task-card__actions` |
| `client/src/styles/20-controls-and-settings.css` | 1005 | `.log-row__actions` |
| `client/src/styles/15-inbox.css` | 871 | `.inbox-queue__hover-actions` |
| `client/src/features/today/styles/execute-v2.css` | 1102, 1180, 1656 | stream task quick actions / more menu / recovery rows |
| `client/src/features/today/styles/planner/responsive.css` | 447 | planner block, task, rhythm, unplanned actions |
| `client/src/styles/36-meal-planner.css` | 1613, 1920 | meal slot add/remove, prep, grocery, recipe list removes |

Two more surfaces use width-based fallbacks instead (covers phones in portrait, not tablets/landscape): daily review tasks (`14a-daily-review.css:822-830`) and health timeline actions (`35-health-page.css:1323-1325`).

### 2.3 Touch-capable drag and drop
- All sortable lists use dnd-kit `PointerSensor` (works for touch) with a 5px activation constraint plus keyboard sensor — e.g. `client/src/features/goals/SortablePlanningEditor.tsx:174-177`, `client/src/features/today/components/PlannerBlock.tsx:479-482`.
- `touch-action: pan-y` / `none` is set appropriately on draggable/rubber-band surfaces (`daily-rhythm.css:35`, `unplanned.css:194`, `today-desk.css:354`, `shared.css:465`, etc.), and overlay scrollers use `overscroll-behavior: contain` (`planner/base.css:352`, `execute-v2.css:372`).
- The goals graph uses ReactFlow with `panOnScroll`, `zoomOnScroll={false}`, `minZoom={0.22}` — pannable and pinch-zoomable on touch (`client/src/features/goals/GoalsPlanGraphView.tsx:1138-1148`).

### 2.4 Forms and keyboards
- Native pickers used for dates/times: `type="date"` / `type="time"` across Quick Capture, Task Edit, Habits, Settings, Goal detail (`QuickCaptureSheet.tsx:378`, `TaskEditSheet.tsx:326-401`, `SettingsPage.tsx:316-349`).
- Numeric entry declares `inputMode="decimal"` / `"numeric"` (`QuickCaptureSheet.tsx:322`, `FocusSessionLauncher.tsx:177`).
- Login uses `type="email"` / `type="password"` with `autoComplete` — password managers work (`client/src/features/auth/LoginPage.tsx:34-51`).

### 2.5 Dialogs
- `DialogSurface` locks body scroll while open, traps Tab focus, handles Escape, and restores focus — `client/src/shared/ui/DialogSurface.tsx:40-111`. The task-edit sheet sizes against `100dvh` (`12-auth-and-capture.css:161`).

### 2.6 Performance foundations
- Every route is lazy-loaded with Suspense (`client/src/app/router.tsx:13-25,114`).
- nginx caches hashed `/assets/` immutably (`max-age=31536000, immutable`) and serves HTML `no-store` (`deploy/nginx/personal.daycommand.online.conf:25-47`).
- A `release.json` + `useReleaseRefresh` mechanism reloads stale clients after deploys.

---

## 3. Findings

Severity scale: **P0** breaks core usability on phones · **P1** noticeably degrades the experience · **P2** polish/platform gap users will perceive · **P3** minor.

### M1 · P0 — Mobile navigation reaches only half the app

**Evidence**
- Bottom bar renders `shellNavItems.slice(0, 5)` → Home, Inbox, Today, Planner, Habits — `client/src/app/shell/AppShell.tsx:463-488`.
- The sidebar holding the remaining items and Settings is `display: none` on mobile — `client/src/styles/16-responsive.css:8-10`.
- No "More" tab, drawer, or horizontal scroller exists (`mobile-nav`/`mobile-capture` are the only mobile shell components; grep confirms no other usage).

**Impact.** Health, Meals, Goals, Reviews, and Settings have no always-present navigation path on a phone. They are reachable only via scattered secondary links:

| Page | Only mobile entry points |
|---|---|
| Settings | Home footer identity link (`client/src/features/home/HomeFooter.tsx:22`) |
| Health | Home pulse card / essentials band (`PulseCard.tsx:23`, `EssentialsBand.tsx:74`) |
| Meals | Home workspace launch strip (`WorkspaceLaunchStrip.tsx:238`) |
| Goals | Goal chips inside Today cards (`TaskCard.tsx:11`, `GoalNudges.tsx:7`, …) |
| Reviews | A control inside Today (`TodayPage.tsx:696`), review-history nav |
| **Finance** | **Only a conditional "Open Finance" attention card on Home** (`client/src/features/home/AttentionSection.tsx:48`) |

Finance is effectively unreachable unless the app decides something needs attention. Direct URL entry works, but that is not a navigation system.

**Recommended fix.** Pick one model and apply it to the shell:
- Convert the 5th tab into a **"More"** sheet listing the remaining destinations + Settings; or
- Make the tab bar **horizontally scrollable** with all 11 items; or
- Add a **hamburger drawer** mirroring the sidebar.

A "More" sheet is the smallest change consistent with the existing bottom-sheet pattern (capture and notifications already use it).

---

### M2 · P1 — iOS zooms into every text field

**Evidence**
- Root font-size is 15px — `client/src/styles/00-foundations.css:76`; body text is `0.94rem` (≈14.1px).
- `.field input/textarea/select` set no font-size and inherit the root — `client/src/styles/11-page-and-primitives.css:838-849`. Meal planner controls use `--fs-small` (≈12.6px) — `36-meal-planner.css:1014,1031`.
- iOS Safari auto-zooms the viewport when focusing any input whose computed font-size is <16px, and does not reliably zoom back out.

**Impact.** On an iPhone, every text field in the app — including the quick-capture sheet, which autofocuses its first input (`QuickCaptureSheet.tsx:103-113`) — triggers a page zoom. Repeated captures leave the UI zoomed in and require pinch-out.

**Recommended fix.** Either bump `--fs-body` usage on controls or add a single rule:

```css
/* iOS: prevent focus zoom — inputs must compute to >= 16px */
input, textarea, select { font-size: 16px; }
```

---

### M3 · P1 — No PWA / install story, and no `theme-color`

**Evidence** (`client/index.html`)
- No `<link rel="manifest">`, no `apple-touch-icon`, no `<meta name="theme-color">`, no `apple-mobile-web-app-*` metas, no service worker registration. Only charset/viewport/description/favicon exist.
- No PWA plugin in `client/package.json`; nothing in `client/public/` beyond favicon/logo.
- App is dark-only (`color-scheme: dark`, `00-foundations.css:7`; zero `prefers-color-scheme` or `theme-color` references repo-wide), so mobile browser chrome renders default light around the dark UI.

**Impact.** For a personal daily-driver app: no add-to-home-screen, no standalone window, no offline shell, and a visually jarring light browser frame. This is the difference between "a website I visit" and "the app I open."

**Recommended fix.**
1. Add a minimal manifest (name, icons, `display: standalone`, `theme_color: #0c0a07`, `background_color: #0c0a07`).
2. Add `<meta name="theme-color" content="#0c0a07">` and an `apple-touch-icon` (the 796KB `public/favicon.png` should be resized — see M7).
3. Optionally register a minimal service worker for app-shell caching.

---

### M4 · P2 — Safe-area insets ignored where they matter most

**Evidence**
- Viewport meta lacks `viewport-fit=cover` — `client/index.html:5-8`.
- The fixed bottom nav has `padding: 0.4rem 0.5rem 0.6rem` and the capture FAB sits at `bottom: 5rem` with no `env(safe-area-inset-*)` — `16-responsive.css:67-145`.
- Only two files in the codebase use safe-area insets at all (`80-notifications.css:855`, `36-meal-planner.css:1496`).

**Impact.** In iOS Safari when the bottom toolbar collapses on scroll — and always once the app runs standalone after M3 — the tab bar and FAB sit directly on the home indicator, and page content can run under the notch in landscape.

**Recommended fix.**

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

```css
.mobile-nav {
  padding-bottom: calc(0.6rem + env(safe-area-inset-bottom));
}
.mobile-capture {
  bottom: calc(5rem + env(safe-area-inset-bottom));
}
.shell-content {
  padding-bottom: calc(6rem + env(safe-area-inset-bottom));
}
```

---

### M5 · P2 — Assets ship uncompressed; payload is heavy for mobile

**Evidence**
- Built sizes (`client/dist/assets/`, uncompressed): main JS 345.6KB + main CSS 383.7KB; TodayPage 398.1KB JS + **214.7KB CSS**; GoalsPage 281.3KB (includes ReactFlow). Initial Today-page load is roughly 1.3MB of JS+CSS.
- `deploy/nginx/personal.daycommand.online.conf` contains **no `gzip`/`brotli` directives**. Ubuntu nginx defaults compress only `text/html`, so JS/CSS almost certainly travel uncompressed to phones. (Verify the host's global `nginx.conf`; the site conf alone won't compress.)
- Google Fonts stylesheet is render-blocking on first load (`client/index.html:15-17`) — mitigated by `display=swap` but still a serial request chain to `fonts.googleapis.com`/`fonts.gstatic.com`.

**Impact.** On cellular connections, first load is several times larger than necessary and renders later than it should. Repeat visits are fine due to immutable asset caching.

**Recommended fix.** Enable compression in the nginx vhost (or confirm it globally):

```nginx
gzip on;
gzip_comp_level 5;
gzip_min_length 1024;
gzip_types text/css application/javascript application/json image/svg+xml;
# or brotli_static/gzip_static if assets are precompressed at build time
```

Longer term: consider self-hosting the two font families as `woff2` with `font-display: swap` (removes two third-party connections), and investigating the 214KB Today CSS bundle for dead rules.

---

### M6 · P2 — Hover-only actions still inaccessible on touch in several places

The `(hover: none)` sweep covered core surfaces (§2.2) but missed:

| Pattern | File:line | Behavior on touch |
|---|---|---|
| `.ap-goal-card__actions` reveal | `60-goals-planning.css:493-520` | Buttons render `opacity: 0` with no touch/width fallback — invisible but tappable |
| `.today-task-card__actions` | `features/today/styles/shared.css:935-944` | No fallback in the 600px block; invisible until hover/focus-within |
| `.graph-goal-node__quick-add` / `__menu-trigger` | `60-goals-planning.css` (hover selectors) | Graph node controls hover-only |
| `.status-history-ribbon__tooltip` | `90-home-dashboard.css` (hover) | Day-history tooltips unreachable by touch |
| `.ap-goal-card__domain-icon` swap | `50-active-pursuits.css` (hover) | Cosmetic only |

Width-based fallbacks in `14a-daily-review.css` (~822) and `35-health-page.css` (1323) cover portrait phones but not landscape phones (~844px) or touch tablets.

**Recommended fix.** Extend the existing pattern — add the missing selectors to `@media (hover: none)` blocks (and to the goals page's narrow-screen block):

```css
@media (hover: none) {
  .ap-goal-card__actions,
  .today-task-card__actions,
  .graph-goal-node__quick-add,
  .graph-goal-node__menu-trigger {
    opacity: 1;
  }
}
```

---

### M7 · P3 — Touch polish: tap targets, tap highlight, favicon weight

- **Bottom-nav tap targets ≈34px tall** (labels at `--fs-micro` ≈11.25px, `padding: 0.5rem 0.35rem` — `16-responsive.css:83-104`). Below Apple HIG's 44px. Bump vertical padding or `min-height: 2.75rem` per link.
- **No `-webkit-tap-highlight-color`** anywhere — iOS shows the default gray flash on every tap. `transparent` plus existing `:active` states (the FAB already scales) is cleaner.
- **`public/favicon.png` is 796KB** (also copied as `life-os-logo.png`). Some browsers fetch favicons eagerly; ship a ≤10KB resized PNG plus the existing SVG.
- **Small text:** bottom-nav labels and various metas sit at 11.25px (`--fs-micro`); acceptable for labels, but avoid it for actionable text.

---

### M8 · P3 — Viewport-height and keyboard interplay (verify on device)

- Most overlays still size against `100vh` (~30 occurrences); only the task-edit sheet uses `100dvh` (`12-auth-and-capture.css:161`) and one planner panel uses `dvh` (`planner/base.css:340`). `100vh` on iOS Safari refers to the largest viewport, so `max-height: 100vh` panels can be taller than the visible area when toolbars/keyboard are up. Low severity since content scrolls, but sheet-style overlays (capture sheet `85vh`, notification sheet `85vh`) should be spot-checked with the keyboard open.
- The capture sheet autofocuses its first input on open — on iOS this raises the keyboard immediately; combined with a fixed bottom panel this is the classic "keyboard covers the sheet" scenario that needs a real-device check (Appendix D).
- dnd-kit's `distance: 5` touch activation is aggressive; vertical scroll gestures starting on a draggable row can capture into a drag. `touch-action: pan-y` is set in the places reviewed, but task-list scrolling inside drag containers deserves a device check.

---

## 4. Surface-by-Surface Assessment

| Surface | Rendering | Usability | Notes |
|---|---|---|---|
| `/home` | Good | Good | Responsive at 1100/860/560px; hover-only history tooltips (M6) |
| `/inbox` | Good | Good | Overlay inspector → full screen ≤640px; touch actions revealed |
| `/today` | Good | Good | Desk reflows at 860px; hover fallbacks present; heaviest payload (M5) |
| `/planner` | Good | Good | Calendar day-grid works on touch with custom toolbar; dnd tuned |
| `/habits` | Good | Good | Shares pursuit styles (640/1100px blocks) |
| `/health` | Functional | Orphaned | No nav path; width-only hover fallbacks |
| `/meals` | Functional | Orphaned | No nav path; meal-planner touch fallbacks are good once reached |
| `/finance` | Good | **Weakest** | Conditional entry point only (M1); tables scroll horizontally |
| `/goals` | Functional | Orphaned | Graph pans/pinch-zooms; invisible hover actions (M6); 281KB payload |
| `/reviews/*` | Good | Orphaned | Reachable only via Today control or deep link |
| `/settings` | Functional | Orphaned | Home footer link only |
| `/login`, `/onboarding` | Good | Good | Centered card layout, autofill attributes, step grid collapses |

---

## 5. Remediation Plan (prioritized)

| # | Item | Findings | Effort | Files touched |
|---|---|---|---|---|
| 1 | Mobile "More" sheet / scrollable tab bar / drawer | M1 | M | `AppShell.tsx`, `16-responsive.css` |
| 2 | `font-size: 16px` on form controls | M2 | S | `00-foundations.css` |
| 3 | Manifest + `theme-color` + `apple-touch-icon` (+ optional SW) | M3 | S–M | `index.html`, `public/` |
| 4 | `viewport-fit=cover` + safe-area padding on nav/FAB/content | M4 | S | `index.html`, `16-responsive.css` |
| 5 | gzip/brotli in nginx (and precompression optional) | M5 | S | `deploy/nginx/*.conf` |
| 6 | `@media (hover: none)` for goals/today-card/graph actions | M6 | S | `60-goals-planning.css`, `shared.css`, `90-home-dashboard.css` |
| 7 | Tap-target height, tap-highlight, favicon resize | M7 | S | `16-responsive.css`, `00-foundations.css`, `public/` |
| 8 | Device verification pass (Appendix D); `dvh` migration where needed | M8 | M | verify first |

S = hours, M = 1–2 days. Items 2, 4, 5, 6 are close to one-line fixes with outsized impact.

---

## 6. Appendix

### A. Breakpoint inventory (as found)

Shell: 960px (16-responsive.css). Feature stylesheets use: 1440, 1180, 1120, 1100, 980, 960, 900, 860, 800, 760, 720, 640, 600, 560, 520, 480. Values are inconsistent across files but coverage is broad; the notable dead zone for hover fallbacks is the 641–960px touch band (landscape phones, small tablets).

### B. `(hover: none)` blocks found

`40-today-workspace.css:614` · `20-controls-and-settings.css:1005` · `15-inbox.css:871` · `36-meal-planner.css:1613,1920` · `execute-v2.css:1102,1180,1656` · `planner/responsive.css:447`. Gaps listed in M6.

### C. Bundle inventory (`client/dist/assets/`, May 19 build)

| Asset | Size |
|---|---|
| `index-*.js` | 345.6KB |
| `index-*.css` | 383.7KB |
| `TodayPage-*.js` | 398.1KB |
| `TodayPage-*.css` | 214.7KB |
| `GoalsPage-*.js` | 281.3KB |
| `FinancePage-*.js` | 73.6KB |
| `favicon.png` | 796KB |

Total for the Today page ≈ 1.34MB uncompressed (≈300–350KB gzipped).

### D. Real-device verification checklist

- [ ] iPhone Safari: focus any field → page must not zoom (M2)
- [ ] iPhone Safari: scroll Today → bottom nav clears the home indicator (M4)
- [ ] Capture FAB → sheet opens → keyboard raises → first input visible (M8)
- [ ] Drag a task in Today stream on touch: drag starts without hijacking scroll (M8)
- [ ] Landscape phone: goals card actions visible without hover (M6)
- [ ] Android Chrome: date/time pickers, decimal keyboard in capture amounts
- [ ] Lighthouse mobile run before/after gzip (M5)
- [ ] Add-to-home-screen after M3: standalone window, dark status bar via `theme-color`

---

## 7. Resolution Log (2026-09-05)

Same-day remediation pass. Verification: `npm run typecheck` clean, `npm run test -w client` 86/86 passing, `npm run build` succeeds. Real-device items in Appendix D remain open.

| Finding | Status | Change |
|---|---|---|
| M1 · Mobile nav reachability | **Fixed** | Mobile tab bar is now 4 destinations + a "More" tab (`AppShell.tsx`, `shell-navigation.tsx` adds `mobilePrimaryNavItems`/`mobileMoreNavItems`/`MoreIcon`). New `MobileMoreSheet.tsx` (built on `DialogSurface`: scroll lock, focus trap, Escape) bottom-sheet lists Habits, Health, Meals, Finance, Goals, Reviews, and Settings. The More tab shows the active state while any of those sections is open. Styles in `16-responsive.css` (`.more-sheet*`), safe-area-aware. |
| M2 · iOS input zoom | **Fixed** | `00-foundations.css`: `input, textarea, select { font-size: max(16px, 1em) !important; }` inside `@media (max-width: 960px), (pointer: coarse)`. `max(16px, 1em)` preserves intentionally larger controls (1em resolves against the parent for `font-size`). |
| M3 · PWA plumbing | **Fixed** | `index.html`: `theme-color`, `mobile-web-app-capable`, `apple-mobile-web-app-*` metas, manifest link, `apple-touch-icon`. New `public/manifest.webmanifest` (standalone display, dark `theme_color`/`background_color`). Icons generated from the brand mark at 192/512. No service worker yet — deliberately deferred to avoid interfering with the `release.json` refresh flow. |
| M4 · Safe areas | **Fixed** | `index.html` viewport now `viewport-fit=cover`. `16-responsive.css`: bottom nav, capture FAB, shell content padding, and capture-sheet panel all pad with `env(safe-area-inset-bottom)`. Status bar style is `black` (not translucent), so no top inset handling is needed. |
| M5 · Compression / payload | **Fixed (config)** | `deploy/nginx/personal.daycommand.online.conf` now enables gzip (level 5, `gzip_vary`, JSON/CSS/JS/SVG/manifest types, `gzip_proxied any` so API JSON compresses too). Takes effect on next deploy (the deploy script installs this conf). Measured: main CSS 386KB → 61KB, Today CSS 215KB → 32KB gzipped. Also shipped: `public/favicon.png` 796KB → 4.8KB (64px), `life-os-logo.png` 796KB → 46KB (256px; rendered ≤48px eager on every page). |
| M6 · Hover-only actions | **Fixed** | `(hover: none)` fallbacks added for `.today-priority-card__actions` / `.today-task-card__actions` (`today/styles/shared.css`) and `.ap-goal-card__actions` / `.inactive-goal-row__actions` / `.graph-goal-node__quick-add` / `.graph-goal-node__menu-trigger` (`60-goals-planning.css`). The home status-history ribbon tooltip was left as-is (cosmetic; no touch affordance intended). |
| M7 · Touch polish | **Fixed** | Bottom-nav links get `min-height: 2.75rem` (44px targets); `-webkit-tap-highlight-color: transparent` applied globally in `00-foundations.css` (the FAB and sheet links already have `:active` states). |
| M8 · Viewport-height / keyboard | **Open** | Needs the on-device checklist (Appendix D). No code change yet. |

Follow-ups not in this pass: self-hosting the Google Fonts `woff2` files, auditing the 215KB Today CSS bundle for dead rules, and a service worker once the release-refresh interaction is designed.
