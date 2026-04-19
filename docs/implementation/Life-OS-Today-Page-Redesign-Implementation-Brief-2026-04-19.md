# Life OS Today Page Redesign Implementation Brief

Date: 2026-04-19  
Audience: Frontend implementation engineer  
Scope: Redesign the `Today` page only  
Status: Approved product and design direction for the next redesign pass

## 1. Purpose

This document defines the redesign direction for the `Today` page.

The home page has recently moved toward a much better visual and product direction:

- one expressive top object
- one dominant focus area
- one quiet support rail
- quieter secondary information
- minimal card usage
- typography-led hierarchy

The `Today` page has not caught up yet.

Right now, `Today` still feels like the older product:

- too many boxed modules
- weak hierarchy
- too many medium-priority sections
- too many labels
- left and right side using different visual languages
- too much “dashboard assembly” and not enough “execution workspace”

The goal of this redesign is to make `Today` the best daily-use screen in the product:

- sleek
- modern
- fast to read
- operationally useful
- visually calm
- premium in taste
- designed for everyday repeated use

This is the page users will open and work in daily. It must feel better than Home, not worse.

## 2. Product Role Of Today

`Today` is not just a detailed dashboard.

`Today` is the execution workspace.

Home answers:

- what state is my day in?
- what should I do next?

Today should answer:

- what am I working on right now?
- what is the next executable move?
- what needs to stay visible while I execute?

That means `Today` should feel more focused and operational than Home.

It should not feel like a page of status cards.

## 3. Core Problems In The Current Today Design

## 3.1 Card overload is back

The current page uses many boxed surfaces:

- command/top rail
- week deep work strip
- must-win card
- reduce today card
- support priorities panel
- daily essentials panel
- task group sections

This causes the same problem the old Home page had:

- card soup
- too many independent modules
- everything looks locally important
- the page does not have one strong center of gravity

## 3.2 The page lacks a single dominant purpose above the fold

At the moment, the user sees multiple competing areas:

- execution mode controls
- deep work weekly status
- must-win
- reduce today
- support priorities
- essentials

This creates ambiguity about the actual primary task.

## 3.3 Right rail mismatch

The right side currently looks like utility panels.

The left side looks like a productivity dashboard.

These do not feel like one system.

## 3.4 Too much labeling and sectioning

The screen reads like a document with many headings:

- week deep work
- must-win
- reduce today
- support priorities
- daily essentials
- tasks

That weakens the execution feeling. The user should feel guided into work, not guided through sections.

## 3.5 Empty states are visually awkward

When certain sections are sparse, the page develops:

- too much dead dark space
- modules floating without rhythm
- empty boxes with too much ceremony

This makes the page feel unfinished rather than minimal.

## 3.6 Reduce Today is too prominent

This module is useful, but it should not visually compete with the main execution area.

It should be supportive, not co-equal.

## 4. Non-Negotiable Design Direction

These principles must shape the redesign.

## 4.1 Today must feel like the same product as Home

The redesigned Home page should be the taste benchmark.

Today must share:

- the same warm dark editorial tone
- the same reduced chrome
- the same hierarchy-by-typography approach
- the same discipline around surfaces

Do not preserve old dashboard conventions just because they already exist on Today.

## 4.2 One top strip, one execution stage, one quiet rail

This should become the core architecture of `Today`.

Recommended top-level structure:

1. top execution strip
2. execution stage
3. quiet operational rail
4. secondary content below

## 4.3 Execution must dominate

The page should make it obvious what the user is supposed to do next.

The current must-win / active task area should become the main execution stage.

This stage should feel like the functional equivalent of Home’s hero, but more operational and action-ready.

## 4.4 Demote supportive systems

The following are useful but should not dominate:

- deep work weekly tracking
- reduce today
- support priorities
- daily essentials
- notes
- recovery tray

These should become supporting elements, not hero competitors.

## 4.5 Reduce labels and repeated explanation

The new page should use fewer words and fewer headings.

The user should quickly understand:

- current mode
- current focus
- current available action
- current risk/support context

## 5. Recommended Information Architecture

## 5.1 Top strip

The top strip should remain, but it needs to feel more intentional and less crowded.

Purpose:

- orient the user in execution mode
- show state at a glance
- expose mode switch and main action affordances

Recommended contents:

- day state / score
- compact execution state
- mode switch (`Execute` / `Plan`)
- add task / capture action
- one compact contextual summary

Avoid:

- too many pills
- too many competing status chips
- too many labels in one row

This should feel like a control bar, not a compressed dashboard.

## 5.2 Main execution stage

This is the most important redesign area.

It should replace the current feeling of “must-win card inside a dashboard.”

Purpose:

- hold the current must-win or active task
- make the next step obvious
- make execution actions obvious

Recommended contents:

- eyebrow
- current task title
- one short support line
- next visible action
- compact state badge
- primary and secondary actions

This stage must become cleaner, less boxed, and more premium.

Avoid:

- nested inner cards
- repeated “Completed” states in multiple places
- too many control buttons at equal weight

## 5.3 Quiet rail

The right side should become a calm support rail similar in philosophy to Home.

Recommended rail contents:

- support priorities
- essentials summary
- maybe notes / lightweight context

The rail should be:

- lighter
- flatter
- text-led
- clearly secondary

Do not make the right rail another stack of modules with equal visual weight to the main stage.

## 5.4 Secondary support row below the stage

These belong below the main execution area:

- reduce today
- deep work weekly signal
- recovery or overload note if relevant

These should become slim, integrated support elements.

The current large “Reduce Today” block should be demoted substantially.

## 5.5 Task stream below the fold

Below the main stage, the task stream should feel like the operational continuation of the page.

The transition from hero to tasks should feel natural.

Today should not feel like “modules above, random list below.”

The task stream should read as:

- current focus
- then execution queue

## 6. Specific Module Guidance

## 6.1 CommandBar / top rail

### Keep

- execute / plan switch
- add task
- execution status

### Change

- reduce status clutter
- reduce chip density
- make it read as one refined strip
- remove unnecessary visual separators if they overcomplicate the line

### Desired feeling

An elegant operating rail, not a stuffed toolbar.

## 6.2 Must-win / execution hero

### Keep

- current task prominence
- next action
- action controls
- protocol access

### Change

- remove inner boxed sub-panels where possible
- reduce repeated labels
- reduce repeated status repetition
- allow more whitespace
- make the layout feel more like a stage than a card

### Important

This is the centerpiece of the page and should visually outrank all other content.

## 6.3 Reduce Today

### Keep

- rescue/recovery suggestion
- minimum viable action concept

### Change

- convert to a slim advisory form
- make it supportive, not dominant
- do not let it compete with the main execution hero

### Not recommended

- a second large feature card next to must-win

## 6.4 Week Deep Work

### Keep

- the signal is useful
- it supports pacing and weekly judgment

### Change

- treat it more like a compact strategic note
- integrate it into the upper page rhythm
- do not give it top-tier card prominence unless the data is truly critical

## 6.5 Support Priorities

### Keep

- support priorities are useful context around the must-win

### Change

- reduce module weight
- make empty state elegant
- make it feel like a sidecar list rather than its own panel

## 6.6 Daily Essentials

### Keep

- routines / habits
- health
- finance

### Change

- present these in a quieter rail or band treatment
- do not frame them like dashboard widgets
- keep them concise and glanceable

## 6.7 Notes

Notes are useful but should not overpower execution.

If notes remain in the rail, they should feel like a quiet supporting layer.

## 6.8 ExecutionStream

The execution stream should become the natural continuation of the hero.

It should feel integrated into the page’s flow, not bolted on after a dashboard region.

## 7. Behavioral Modes

Today must clearly express mode.

## 7.1 Execute mode

Execute mode should prioritize:

- must-win
- active focus session
- next action
- execution queue

Everything else becomes supporting context.

## 7.2 Plan mode

Plan mode can afford a more structured workbench feel, but it should still inherit the improved taste direction from Home and the redesigned Execute mode.

Do not keep old box-heavy styling just because Plan mode is more functional.

## 7.3 Rescue mode

Rescue mode should be visibly calmer and simpler.

When rescue mode is active:

- reduce visual intensity
- reduce the amount of visible work
- make the minimum viable action obvious

## 8. Visual Taste Rules

This redesign must follow these taste constraints.

### Use fewer true surfaces

Prefer:

- separators
- spacing
- columns
- typography

Over:

- boxes
- nested cards
- repeated panels

### Keep one expressive object

Allow one expressive top strip or hero treatment to give the page identity.

Everything else should become quieter.

### Make the page feel expensive

That means:

- restraint
- not too many borders
- not too many pills
- not too many labels
- strong rhythm
- deliberate whitespace

### Avoid

- enterprise dashboard energy
- every module being boxed
- too many equal-priority cards
- “section section section” reading experience

## 9. Copy Rules

Use short, direct, active copy.

Avoid:

- explaining obvious UI
- long section intros
- duplicated status language
- too much title case

The page should feel confident and operational.

## 10. Recommended Wireframe

```text
[ Top execution strip: state | mode | add task | key summary ]

[ Main execution stage ......................... Quiet rail ]
  Current focus / must-win                      Support priorities
  Next action                                  Essentials
  Primary action                               Notes / light context
  Secondary actions

[ Quiet advisory row: Reduce today / Deep work note ]

[ Execution stream / task queue ]

[ Recovery / overflow / lower-priority support ]
```

## 11. Acceptance Criteria

The redesign is successful if:

1. The user can identify the primary task within a few seconds.
2. The page clearly feels like an execution workspace, not a dashboard.
3. The page visually matches the improved Home page taste direction.
4. The right rail feels like part of the same system, not a different design language.
5. `Reduce Today` no longer competes with the main must-win area.
6. There is less card clutter and less visual noise.
7. The page is suitable for repeated daily use without feeling heavy or chaotic.
8. The task stream feels integrated with the rest of the page.

## 12. Implementation Guidance For The Frontend Engineer

This redesign should be treated as a composition and hierarchy redesign, not a cosmetic cleanup.

Priorities:

1. Rebuild the page around one dominant execution stage.
2. Simplify the top rail.
3. Quiet the right rail.
4. Demote `Reduce Today` and other strategic/support signals.
5. Preserve usability while upgrading taste and clarity.

If there is a tradeoff between “show every useful thing” and “keep the page focused and elegant,” choose focus and elegance.

Today should feel like the page the product was built around.

