# Home Screen Review

Date: 2026-03-31

Scope: `Home` screen only

Primary question: if Life OS is opened every day from morning to night, what should the Home screen show, what should it stop showing, and how should it guide the user without becoming a wall of cards?

---

## Executive Summary

The current Home screen has strong ingredients, but the overall experience is still too card-heavy and too score-heavy.

Right now, the page behaves like a dashboard mosaic:

- one large score hero
- several secondary cards
- several more tertiary cards
- a long right rail of snapshots

That gives the user a lot to look at, but not enough help deciding what matters first.

The biggest redesign move should be this:

- stop treating Home like a collection of equal cards
- make Home a calm decision surface
- let `Today` remain the deeper execution workspace
- shrink score from a dominant hero into a compact progress layer
- merge related secondary panels instead of stacking them
- make one clear `Now / Next` block and one clear `At Risk` block the center of the page

If this product is meant to be opened many times a day, the Home screen should feel less like "here is everything in your system" and more like "here is how to stay in control right now."

---

## Final Verdict

The Home screen is not missing capability.

It is missing restraint.

The app already has the data needed for a much stronger Home experience:

- top priorities
- open tasks
- score and score reasons
- weekly momentum and streak
- overdue and stale inbox signals
- habits and routines summary
- health summary
- finance summary
- notifications
- daily review availability
- weekly challenge guidance

The problem is that these signals are currently arranged as too many separate panels, with the wrong thing made visually dominant.

The score hero is the loudest element on the page, but the user's first question is usually not:

"What is my number?"

It is:

"What should I do now?"

That mismatch is the core design problem.

---

## Review Basis

This review was grounded in the shipped Home screen structure and the active product docs.

Reviewed frontend files:

- `client/src/features/home/HomePage.tsx`
- `client/src/features/home/ScoreCard.tsx`
- `client/src/features/home/GuidanceRail.tsx`
- `client/src/features/home/AttentionSection.tsx`
- `client/src/features/home/PrioritiesList.tsx`
- `client/src/features/home/FocusBlock.tsx`
- `client/src/features/home/PulseCard.tsx`
- `client/src/features/home/LedgerCard.tsx`
- `client/src/features/home/RoutinesCard.tsx`
- `client/src/features/home/InboxCard.tsx`
- `client/src/features/home/MotivationalQuoteCard.tsx`
- `client/src/styles/90-home-dashboard.css`
- `client/src/app/shell/AppShell.tsx`

Reviewed backend and product references:

- `server/src/modules/home/routes.ts`
- `server/src/modules/home/guidance.ts`
- `docs/prd/PRD.md`
- `docs/prd/product-vision.md`
- `docs/prd/screen-specs.md`
- `docs/prd/scoring-system.md`
- `docs/prd/success-metrics.md`
- `docs/archive/review/life-os-user-experience-gap-review.md`
- `docs/archive/review/life-os-top5-findings-for-daily-use.md`
- `docs/implementation/today-execute-screen-review-2026-03-30.md`

---

## What The Current Home Screen Actually Is

As shipped, Home is a two-column dashboard.

Main column:

- `ScoreCard`
- `GuidanceRail`
- `PrioritiesList`
- `AttentionSection`

Right rail:

- `FocusBlock`
- `MotivationalQuoteCard`
- `PulseCard`
- `LedgerCard`
- `RoutinesCard`
- `InboxCard`

That means the user can face up to 10 separate Home modules before leaving the page.

There is also a shell header above the page with:

- greeting
- date
- notifications button
- capture button

So the actual experience is:

1. global shell header
2. large score hero
3. stacked support strips
4. stacked summary cards
5. long secondary rail

This is why the page feels busy even when the app is conceptually strong.

---

## First-Principles Bar For A Great Home Screen

If this is a true daily-use productivity product, the Home screen should meet these standards.

### 1. Fast orientation

The user should know what matters in 3 to 5 seconds.

### 2. Immediate next-step clarity

The screen should make the next meaningful action obvious.

### 3. Risk visibility

Anything overdue, stale, slipping, or review-related should be visible without hunting.

### 4. Low cognitive load

The screen should reduce scanning, not require the user to assemble meaning from many isolated widgets.

### 5. Progressive depth

The first viewport should be enough for orientation. Extra detail should appear only when needed.

### 6. Healthy gamification

Score should reinforce useful behavior, not dominate attention or create guilt-heavy noise.

### 7. Morning-to-night usefulness

The screen should help differently in the morning, midday, and evening. It should not feel static all day.

### 8. Whole-life awareness without fragmentation

Health, habits, money, inbox, and reviews should feel like one system, not six mini dashboards.

---

## What Is Already Strong

Several important things are already right.

### 1. The product intent is good

The active docs consistently define Home as the place that should answer:

- what is going on today
- what needs attention
- what should I do next

That is the correct job for this screen.

### 2. The app already has meaningful signals

This is not a fake dashboard. Home is backed by real state:

- real score
- real momentum
- real attention logic
- real overdue logic
- real inbox staleness
- real review availability
- real health, routine, and finance summaries

### 3. Attention and guidance are directionally right

The product is already trying to do more than passive reporting. It tries to tell the user what to recover, protect, or open next.

That is good.

### 4. The page spans the whole life system

A productivity product that only shows tasks is too narrow. It is good that Home reflects habits, health, finance, planning, and review state.

### 5. The app already separates Home and Today

This is valuable. Home can become the decision-support surface while Today remains the execution surface.

---

## Main Problems

### 1. The biggest thing on the page is not the most useful thing

The score hero is designed like the page's centerpiece:

- large ring
- oversized number
- score label
- bucket bars
- metric row
- decorative gradient and glow

This makes the screen feel gamified, but the score card is mostly passive. It tells the user how they are doing, but not strongly enough what to do next.

For a daily operating surface, the dominant area should be the current focus and the next decision, not the most decorative feedback object.

### 2. The page answers the same question in multiple places

Several modules are all trying to answer some version of "what matters now?":

- `FocusBlock`
- `GuidanceRail`
- `PrioritiesList`
- `AttentionSection`

This creates overlap instead of hierarchy.

The user has to mentally combine:

- top priority
- guidance recommendation
- attention items
- open task count
- next timed task

That makes the page harder to read than it needs to be.

### 3. Too many cards flatten the information hierarchy

Cards are being used as the default layout device.

That is the biggest visual source of clutter.

Many of these panels are summaries, not deep interactions. They do not need full standalone card treatment.

When every section is boxed, bordered, padded, and titled, everything starts to feel equally important, even when it is not.

### 4. Important data exists, but Home does not surface it well

The backend already provides more useful state than the screen currently uses well.

Examples:

- `tasks` are fetched, but there is no real lightweight task mini-list on Home
- `accountabilityRadar` includes counts and overflow, but the UI mostly shows item rows
- `notifications` are available, but Home itself does not make them a real part of the page
- `habitSummary.streakHighlights` are available, but not surfaced
- score reasons exist, but the current score presentation still feels more numeric than actionable

This matters because the redesign can be much stronger without needing major backend expansion.

### 5. The page is too static for a screen used all day

A morning Home screen should help the user start.

A midday Home screen should help the user recover drift.

An evening Home screen should help the user close loops and seed tomorrow.

The current design does not shift emphasis strongly enough across the day. The same score-forward structure stays on top regardless of context.

### 6. Secondary content is taking prime space

The motivational quote is not useless, but it does not deserve prime right-rail placement on a control surface that is meant to reduce mental load.

The same applies to several small snapshot cards that could be combined into a more compact essentials section.

Prime space should go to:

- next action
- open risks
- review state
- today's control summary

Not to decorative or optional context.

### 7. The screen still behaves more like a dashboard than an operating surface

The user can learn about the day from Home, but cannot fully feel that Home is the place where the system is under control.

A true operating surface should let the user answer:

- what is my next move
- what is slipping
- what must be closed today
- what basic life areas need a quick touch

Without scanning a long column of separate blocks.

### 8. Some labels are stylish, but not maximally clear

For a daily-use product UI, utility copy usually beats poetic naming.

Examples:

- `Pulse`
- `Ledger`
- `Momentum` for a quote card

These are not wrong, but more direct labels would scan faster for repeated daily use.

Operational products benefit from plainness in headings:

- `Health`
- `Money`
- `At Risk`
- `Today`
- `Close the Day`

---

## What Home Should Be Responsible For

Home should do five jobs well.

### 1. Re-orient the user

Give a fast answer to:

- where the day stands
- whether the user is on track
- whether anything is slipping

### 2. Point to the next useful move

Home should have one obvious handoff into action.

### 3. Surface the risks

Overdue tasks, stale inbox items, missed habits, review deadlines, and admin items should be visible and count-based.

### 4. Keep the whole system visible in compact form

The user should feel that health, routines, money, and inbox are under watch without opening four pages.

### 5. Help the user close the day cleanly

When the review window opens, Home should become more closure-oriented.

---

## What Home Should Not Be

Home should not try to be:

- a full execution workspace
- a giant score poster
- a mini version of every page in the app
- a fixed widget board
- a long stack of unrelated summaries

That is how productivity apps start to feel like maintenance overhead instead of relief.

---

## Recommended Information Hierarchy

This is the most important design recommendation in this document.

### Tier 1: Always visible and always important

- current next step
- top priority
- at-risk items and counts
- review state
- compact score state

### Tier 2: Usually visible

- top 3 priorities
- today's open work summary
- inbox status
- routine and health basics
- finance/admin basics

### Tier 3: Conditional or lower priority

- weekly challenge
- habit streak highlight
- detailed score bucket breakdown
- notifications detail

### Tier 4: Optional or collapsible

- motivational quote
- deeper snapshots
- extra analytics

This means the score breakdown, quote, and most module previews should move down in priority.

---

## Recommended Home Screen Shape

### Recommended Option: Operator Home

This is the best direction for Life OS.

It keeps gamification, but puts action and control first.

#### Above the fold

##### 1. Utility status strip

A compact full-width strip near the top should hold:

- date and current phase of day
- score chip
- weekly momentum chip
- streak chip
- unread notifications count
- capture action

This keeps score visible without giving it hero-level dominance.

##### 2. Main command block

This should be the visual centerpiece of the page.

It should answer:

- what is the most important thing today
- what should I do next
- where do I jump to act

Suggested contents:

- top priority title
- linked goal
- next timed block if it exists
- open task count
- one primary action such as `Open Today`
- one secondary action such as `Start with next step` or `Review open work`

This block should replace the current split attention between `ScoreCard`, `FocusBlock`, and part of `PrioritiesList`.

##### 3. At Risk lane

Place a clear, compact risk panel beside or directly below the command block.

This should combine:

- overdue tasks
- stale inbox
- missed habits
- admin items due
- daily review availability

This should merge the intent of `GuidanceRail` and `AttentionSection`.

Make it count-based and action-based.

The user should immediately understand:

- how many things need recovery
- what is most urgent
- where to go fix them

#### Below the fold, but still high value

##### 4. Today control section

This should contain:

- top 3 priorities
- a compact today task summary
- carry-over or open-work summary if relevant

This is where the user reassures themselves that the day is under control.

Important: this should be compact and list-based, not another oversized hero.

##### 5. Life essentials band

Merge routine, health, and finance into one section instead of three separate cards.

Suggested sub-areas:

- `Routines`
- `Health`
- `Money`

Each sub-area should show only the minimum useful status:

- routines complete / due
- water, meals, workout
- spend and upcoming bills

This section should feel like one connected life-maintenance band, not three isolated mini dashboards.

##### 6. Maintenance and inbox section

Use a compact lower section for:

- inbox preview
- weekly challenge
- notifications preview

These are important, but not all of them deserve top-page prominence every time.

##### 7. Optional inspiration footer

If you keep the quote, move it low on the page or make it collapsible.

It should never outrank operational context.

---

## Morning, Midday, And Evening Behavior

The Home screen should not feel identical all day.

### Morning

Promote:

- today's main focus
- routine start state
- first work block
- quick orientation

Keep quiet:

- end-of-day review prompts

### Midday

Promote:

- drift recovery
- open tasks
- missed habit or water warning
- inbox or overdue items

This is where Home should feel like a correction surface.

### Evening

Promote:

- close the day
- unresolved work
- daily review
- tomorrow preparation

This is where Home should help the user land the day cleanly.

The same layout can support all three phases, but the promoted block and supporting copy should shift.

---

## Gamification Guidance

The gamified layer should stay, but it should be redesigned.

#### What to keep

- daily score
- score label
- weekly momentum
- strong-day streak
- score reasons

#### What to change

### 1. Make score compact by default

The score should be visible, but not take over most of the first viewport.

### 2. Emphasize actionable deltas, not just the number

Better:

- `+6 if you close daily review`
- `Priority 1 is still the biggest swing`
- `2 moves away from Strong Day`

Worse:

- big static number with passive bars

### 3. Keep score supportive, not punitive

Low-score states should suggest recovery, not failure.

### 4. Avoid repeated gamification in multiple places

Do not show score, streak, challenge, quote, and motivational language all fighting for attention in the same viewport.

### 5. Let score explain the day, not become the day

The user should feel guided by score, not managed by it.

---

## What To Merge, Shrink, Or Demote

| Current element | Keep? | Recommended change |
| --- | --- | --- |
| `ScoreCard` | Keep concept, redesign heavily | Shrink into a compact status strip or secondary score panel |
| `FocusBlock` | Keep concept, merge | Fold into the main `Now / Next` command block |
| `GuidanceRail` | Keep concept, merge | Combine with attention into one `At Risk` lane |
| `AttentionSection` | Keep concept, merge | Combine with guidance into one risk-and-recovery surface |
| `PrioritiesList` | Keep | Turn into a compact control list, not a standalone card |
| `PulseCard` | Keep data, rename or clarify | Merge into `Life essentials` |
| `LedgerCard` | Keep data, rename or clarify | Merge into `Life essentials` |
| `RoutinesCard` | Keep | Merge into `Life essentials` |
| `InboxCard` | Keep | Show stronger status and triage urgency, not just three preview rows |
| `MotivationalQuoteCard` | Optional | Demote to footer, collapse, or remove from default Home |

---

## Design Options

### Option 1: Operator Home

This is the recommended option.

What it feels like:

- calm
- decisive
- dense but readable
- action-first

Best for:

- a product that is opened repeatedly during the day
- users who want quick clarity
- reducing card fatigue

Main structure:

- status strip
- now/next block
- at-risk block
- today control section
- life essentials band
- lower secondary context

### Option 2: Score-Centric Home

This keeps gamification at the center.

What it feels like:

- motivational
- performance-oriented
- visibly streak-driven

Risk:

- the product can start to feel like a scoreboard instead of a life operating surface
- it will likely reproduce the same problem you already feel with the current hero

I do not recommend this as the primary direction.

### Option 3: Personalized Widget Home

This would allow the user to choose which modules appear and in what order.

What it feels like:

- flexible
- customizable
- personal

Risk:

- personalization can hide weak core information architecture
- it solves "which cards do I want" before solving "what should Home fundamentally be"

This is useful later, but it should not be the first redesign move.

---

## Visual Direction For The Redesign

These principles matter as much as the information architecture.

### 1. Fewer containers

Use fewer full card boundaries.

Prefer:

- bands
- rows
- lists
- dividers
- grouped sections

### 2. One dominant block only

Home should have one primary visual anchor.

That should be the action block, not the score block.

### 3. Calmer operational styling

Reduce ornamental glow, heavy hero treatment, and decorative drama on the main productivity surface.

This is a page the user will see every day. Comfort matters.

### 4. More direct labels

Prefer operational headings over abstract ones.

### 5. Compact scan lines

The best Home screen here will probably rely more on clean rows and section rhythm than on big illustrated tiles.

### 6. Motion should clarify, not decorate

Useful motion examples:

- subtle status change when score improves
- lane reveal when risk appears
- section promotion when the review window opens

Not useful:

- ornamental animation on every card

---

## What The Frontend Already Has Available

This is important for the redesign handoff.

A stronger Home screen does not require a complete backend rebuild first.

The frontend already has access to:

- greeting
- daily score summary
- detailed score buckets and top reasons
- weekly momentum
- strong day streak
- top priorities
- today's tasks
- next timed task
- routine summary
- habit summary
- health summary
- finance summary
- overdue tasks and stale inbox signals
- review availability
- weekly challenge
- guidance recommendations
- notifications
- inbox preview items

That means the first redesign pass can mostly be a layout, hierarchy, and interaction rethink.

---

## Recommended Success Criteria For The Redesign

The redesign should be considered successful if these things become true.

### 1. The first screen answers four questions fast

- what matters most
- what is at risk
- how the day is going
- where to go next

### 2. The score is visible without dominating the page

### 3. The user no longer feels they are scrolling through a pile of cards

### 4. The page has one unmistakable main action area

### 5. Routine, health, and finance feel connected instead of fragmented

### 6. Inbox and overdue status are explicit, not buried

### 7. The page helps differently in the morning, midday, and evening

### 8. On mobile, the first screen still contains:

- now / next
- at risk
- compact score state
- quick capture

---

## Recommended Direction In One Sentence

Redesign Home as a calm operator dashboard where the main visual focus is the user's next best action, the score becomes a compact supporting layer, and the rest of life status is grouped into a small number of meaningful sections instead of a stack of cards.

---

## Suggested Handoff Instruction For The Frontend Design Pass

If you want a clean instruction for the frontend agent, use this:

"Redesign Home into an action-first daily command surface. Keep score, momentum, attention, priorities, inbox, health, routines, finance, and review state, but remove the dashboard-card feel. Make one dominant `Now / Next` block, one clear `At Risk` block, compress score into a compact progress layer, merge life snapshots into one essentials section, and demote optional motivation content. The page should feel calm, decisive, and useful at morning, midday, and evening."
