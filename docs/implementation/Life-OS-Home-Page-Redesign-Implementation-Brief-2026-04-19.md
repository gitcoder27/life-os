# Life OS Home Page Redesign Implementation Brief

Date: 2026-04-19  
Audience: Frontend implementation engineer  
Scope: Home page visual/system redesign only  
Status: Approved product and UX direction for the next redesign pass

## 1. Purpose

This document defines the new design direction for the Life OS home page.

The current home page has improved structure compared with the older version, but it still lacks taste, restraint, and coherence. It feels assembled rather than composed. The redesign should move the home page away from:

- dashboard card soup
- form-heavy first impressions
- too many equal-priority sections
- overly explanatory text
- mismatched visual languages across columns

The home page should instead feel like a calm, premium command desk:

- useful
- sleek
- modern
- warm
- minimal
- slightly editorial
- visually alive without becoming noisy

This is not a request for a generic SaaS dashboard. This page should feel like a personal operating surface with strong judgment and clear hierarchy.

## 2. Core Product Role Of The Home Page

The home page is not the full planning workspace.

The home page is the place where the product interprets the day for the user and helps them orient quickly.

On first load, the home page should answer only three questions:

1. What state is my day in?
2. What is the one thing I should do next?
3. Is anything quietly asking for attention?

If the screen tries to do more than that above the fold, it becomes cluttered and loses authority.

## 3. Problems In The Current Design

### 3.1 Too many competing “important” areas

The current page often has multiple blocks that all try to behave like primary content:

- status strip
- main hero/focus block
- setup form or secondary intervention block
- right rail sections
- recovery/reduce-day block

This dilutes focus.

### 3.2 Card overuse

The current visual system relies too heavily on bordered and framed containers. This creates:

- nested card-on-card composition
- visual heaviness
- generic “AI generated dashboard” energy
- too much repetition in surface treatment

### 3.3 Mixed design language across columns

The left column has been treated as dramatic, large-scale, surface-heavy UI.  
The right column has often read as flatter editorial text or lightweight utility sections.

These two aesthetics currently do not belong to the same system.

### 3.4 Too much explanatory text

The page narrates too much.  
Many modules explain themselves instead of presenting a clear, confident state.

The result feels like:

- a newspaper
- a system manual
- a set of sections stacked together

It does not feel like a refined homepage.

### 3.5 Mode confusion

The home page has mixed:

- launch/setup
- close/review
- rescue/recovery
- risk monitoring

These are distinct mental states and should not all shout at once.

## 4. Non-Negotiable Design Direction

These are the guiding constraints for the redesign.

### 4.1 Keep the top status strip

The top strip is worth keeping. It adds identity, rhythm, and a feeling of system intelligence. The page needs one cool, modern object so it does not collapse into a plain text-and-button screen.

However, it should be refined:

- more elegant
- slightly slimmer
- less boxy internally
- more minimal in how supporting stats are presented

It should feel like an instrument panel, not a row of tiny cards.

### 4.2 The page needs one hero, not multiple heroes

Above the fold there should be only one dominant action area.

The current main focus block is the correct place for this.

Anything else that behaves like a second hero must be demoted.

### 4.3 The right side must become a quiet companion rail

The right column should not compete with the hero.

It should feel like:

- a support rail
- calm
- concise
- lighter in chrome
- lighter in emphasis

### 4.4 Use typography and spacing, not borders, to create hierarchy

The next pass should remove most of the “importance” currently being created by:

- rounded framed boxes
- repeated borders
- nested surfaces

Hierarchy should mostly come from:

- scale
- spacing
- alignment
- tone
- weight

### 4.5 Make the page feel mode-aware

The home page should clearly adapt to the user’s current phase.

Examples:

- morning: setup/start mode
- evening: close/review mode
- rescue state: reduce and protect mode

The product can still expose secondary information, but one mode should clearly lead.

## 5. Recommended Information Architecture

## 5.1 Above the fold

The new top section should have three parts only:

1. header
2. status strip
3. main content split into:
   - focus stage
   - quiet rail

### Header

Keep:

- greeting
- date
- capture button
- notifications

This should remain stable and light.

### Status strip

Purpose:

- express day state
- add modern visual identity
- provide a compact system summary

Keep:

- score ring
- segmented progress
- momentum
- review state
- phase label

Refine:

- reduce internal box treatment
- make secondary stats feel integrated rather than independently framed
- preserve visual fun without clutter

### Focus stage

Purpose:

- give the user one dominant next move
- create the emotional center of the page

This should be the homepage hero.

It should contain:

- small mode label
- main task or current focus title
- one short supporting line
- next action
- one primary CTA
- at most two secondary actions in view

Examples of things that belong here:

- current must-win
- next visible step
- start
- complete
- continue

Examples of things that do not belong here:

- long form fields
- multiple stacked advisory sections
- repeated contextual explanations
- too many secondary controls

### Quiet rail

Purpose:

- present non-primary but still important context

This should include:

- At risk
- Today
- Inbox

Optional:

- quote, if treated tastefully and with very low visual weight

The right rail should be:

- concise
- text-led
- lightly structured
- visibly part of the same system

It should not be:

- a second design system
- a second hero
- a stack of mini dashboards

## 5.2 Below the fold

The following can still exist, but should be quieter:

- Reduce today / rescue suggestion
- One move to reset / guidance
- Essentials band

These should not compete with the hero.

## 6. Specific Module Guidance

## 6.1 Status strip

### Keep

- circular score
- short progress matrix
- quick day metadata

### Change

- reduce chrome around momentum/review/evening
- avoid making each stat look like its own card
- use cleaner separators or inline grouping
- visually tighten the strip
- make it read as one polished object

### Desired feeling

The strip should feel like a high-end dashboard control rail, not enterprise reporting UI.

## 6.2 Focus stage

This is the main redesign priority.

### Keep

- strong serif display headline for the main task
- warm dark background language
- one clear CTA
- task-driven orientation

### Change

- reduce the amount of supporting copy
- remove the feeling of a giant card with nested boxes
- make “next action” simpler and more direct
- reduce the number of visible buttons
- make the space feel intentional instead of merely large

### Content model

Recommended structure:

- eyebrow
- task title
- one-sentence support line
- inline next action row
- action row

Not recommended:

- many small labels
- multiple internal panels
- status badge shouting inside a large framed box

## 6.3 Daily setup

The current full daily setup form should not dominate the homepage.

### Preferred behavior

Show setup in a staged or collapsed form when it is needed.

Recommended homepage presentation:

- task summary or empty state
- setup status
- one CTA such as `Start setup` or `Continue setup`

The full field set can appear:

- on demand
- in an expandable panel
- in the Today page
- in a compact progressive-disclosure treatment

### Why

The homepage should feel interpretive and elegant, not like a planning form.

## 6.4 At risk

At risk is useful, but it should be quiet and concise.

### Keep

- all-clear state
- risk count
- key action links

### Change

- remove unnecessary framing
- reduce button duplication
- keep copy brief
- present it as a calm monitor, not an alert widget

## 6.5 Today

The Today summary is useful, but it should read more like a support note than a section with too much ceremony.

### Keep

- whether priorities are set
- open task count

### Change

- reduce labeling
- keep it to one or two lines
- remove redundant explanation

## 6.6 Inbox

Inbox belongs in the right rail, but it must be concise.

### Keep

- waiting count
- one preview item
- open inbox link

### Change

- reduce copy
- reduce tags and sectioning if they feel noisy
- avoid making a single capture preview look like its own major content block

## 6.7 Reduce today

This should be demoted from a large framed block into a compact advisory module.

### Recommended treatment

- slim advisory strip
- compact note beneath the hero
- small collapsible suggestion

### Not recommended

- second hero card
- second large surface with strong accent treatment

## 6.8 Essentials

Essentials should be present, but quieter.

### Recommended treatment

- a band
- a row
- lightly divided summaries

### Not recommended

- a large parent frame containing multiple child cards

## 7. Unified Visual Taste Direction

The page should use one coherent taste language.

### Desired taste

- warm dark editorial interface
- premium but not flashy
- modern but not generic
- sleek but human
- minimal but not empty

### Visual characteristics

- one expressive object: the status strip
- one dominant hero
- one quiet rail
- minimal use of framed containers
- careful negative space
- strong typography-led hierarchy
- reduced labeling
- consistent rhythm across both columns

### Things to avoid

- too many boxed modules
- too many pills and badges
- too many explanatory subtitles
- overly symmetrical dashboard composition
- generic SaaS card grids
- visual mismatch between columns

## 8. Content And Copy Rules

The UI should use fewer words.

### Copy principles

- short
- direct
- confident
- active voice
- sentence case where possible

### Avoid

- repeated section intros
- filler explanation
- overly instructional phrasing
- “system explaining itself” language

### Good homepage copy feels like

- “Here is your state.”
- “Here is your move.”
- “The rest can wait.”

## 9. Interaction Rules

### Primary action

There should be one obvious primary action above the fold.

### Secondary actions

Secondary actions should be:

- fewer
- quieter
- not all equally styled

### Setup interactions

If setup must exist on the homepage, use progressive disclosure rather than exposing all fields at once.

### Motion

Motion should be subtle and premium:

- light hover shifts
- elegant button feedback
- restrained transitions

Do not add decorative motion that competes with focus.

## 10. Behavioral Modes

The homepage should feel clearly mode-aware.

### Morning mode

Lead with:

- setup
- choose today’s focus
- clarify the first step

### Evening mode

Lead with:

- close out current task
- review the day
- reduce carryover confusion

### Rescue mode

Lead with:

- protect one believable action
- simplify the day
- reduce pressure

The implementation does not need three entirely different pages, but the hero and support rail must clearly reflect the active mode.

## 11. Recommended Wireframe

```text
[ Greeting / Date .............................................. Capture ]

[ Status strip: score | matrix | momentum | review | phase ]

[ Focus stage ........................................ Quiet rail ]
  Close this out                                      At risk
  Finish Life OS dev                                  All clear
  One supporting line                                 Today
  Next action: Analyze what is missing                1 open task
  [Start] [Complete] [Protocol]                       Inbox
                                                       1 item waiting

[ Advisory strip: Reduce today if needed ]

[ Essentials band ]
```

## 12. Acceptance Criteria

The redesign should be considered successful if:

1. The user can understand the page in under five seconds.
2. The page clearly communicates one primary next move.
3. The top strip remains visually interesting and modern.
4. The page no longer feels like stacked dashboard cards.
5. The left and right columns feel like one coordinated design system.
6. The homepage no longer feels like a newspaper or form-first workflow.
7. Secondary modules feel quieter than the hero.
8. The page feels premium and intentional rather than AI-generated.

## 13. Explicit Implementation Guidance For The Frontend Engineer

Please treat this redesign as a composition and restraint exercise, not a styling pass.

Priorities:

1. Preserve the top strip and improve it.
2. Rebuild the hero into a single premium focus stage.
3. Rebuild the right rail into a lighter editorial support system.
4. Demote setup and rescue surfaces that currently compete with the hero.
5. Remove unnecessary containers before adding any new visual treatment.

If there is a tradeoff between “showing more information” and “preserving clarity and taste,” prefer clarity and taste.

The home page should feel like a product with judgment, not a collection of useful components.

