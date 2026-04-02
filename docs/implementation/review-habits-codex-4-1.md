# Habits Page Review

Date: 2026-04-01

Scope: habits and routines experience, with focus on routine setup clarity, page flow, design polish, and functional gaps.

## Short Answer

You are not getting confused for no reason. The current habits page really does have a design and product gap around routines.

Right now, routines are not truly open-ended. The system only understands two routine buckets:

- `morning`
- `evening`

So if you want a "night routine," the current product expects you to create it as an `evening` routine and optionally name it `Night routine`.

The "Items (one per line)" field is also exactly what it looks like under the hood: a plain text box that gets split into separate checklist items when you save. That works technically, but it feels rough and unclear in the UI.

## How It Works Today

If you want to set up a night routine in the current version:

1. Go to `Habits`.
2. Open `Manage routines`.
3. Click `Add routine`.
4. Choose `Evening`.
5. Name it something like `Night routine`.
6. Put each checklist item on its own line.

Example:

```text
Brush teeth
Prepare clothes
Review tomorrow
Put phone away
```

Important limitation:

- This is still treated by the system as an `evening` routine, not as a separate custom routine type.
- If you already have an evening routine, adding another one can create ambiguity because the main daily habits view only clearly presents one routine per period.

## Top Five Findings

### 1. Routine setup is hard-coded around morning and evening

This is the main reason the feature feels rigid.

The product model, contracts, validation, and docs all define routines as only:

- `morning`
- `evening`

That means the app is not really offering "custom routines" yet. It is offering two fixed daypart checklists.

Why this matters:

- A user looking for "night routine," "shutdown routine," "gym routine," or "Sunday reset" will expect a flexible routine system.
- The UI does not explain that the real system rule is "pick one of two dayparts."
- The user feels like they are naming something custom, but the behavior is still tied to a fixed bucket.

Why your experience feels confusing:

- The form looks like it is asking you to create a routine.
- The actual product logic is asking you to classify something into one of two hard-coded slots.

### 2. The routine creation flow feels unfinished and too raw

The current add-routine form is basically:

- routine name
- period dropdown
- one large text box for items

That is not a polished setup flow for a core productivity feature.

Why this matters:

- "Items (one per line)" is functional, but it feels like a developer shortcut, not a designed checklist builder.
- There is no add-item button, no per-item rows, no drag-to-reorder setup, no preview, and no explanation of what counts as a good routine item.
- The user has to guess whether they are writing notes, tasks, or checklist steps.

Why your experience feels confusing:

- The field visually looks like a plain notes box.
- The UI does not reassure the user that each line becomes one checklist item after save.
- The screen gives very little support for first-time setup.

### 3. The page mixes daily use and admin use too heavily

The habits page is trying to do too many jobs at once:

- daily check-off surface
- streak and risk surface
- weekly challenge surface
- habits setup
- routines setup
- pause, vacation, and archive management

That makes the page harder to scan and harder to trust.

Why this matters:

- A daily productivity screen should make the next action obvious.
- This screen makes the user switch between "do today's habits" and "configure the whole system."
- The lower half reads like an admin console, while the upper half reads like a daily checklist.

Why your experience feels confusing:

- It is not obvious whether this page is mainly for execution or mainly for setup.
- The app already has a `Today` page for action, so `Habits` ends up feeling partially duplicated and partially overloaded.

### 4. The data model and the main habits screen do not fully agree

This is an important product gap.

The backend can store more than one routine for the same period. But the main daily habits view only really surfaces one active morning routine and one active evening routine.

Why this matters:

- A user can create multiple evening routines.
- The manage section will list them.
- The main daily section still acts like there is just one evening routine.

This can lead to:

- hidden routines
- the wrong routine being shown at the top
- uncertainty about whether adding a second routine was the right thing to do

Why this matters for your "night routine" example:

- If you already have an evening routine and create a second one called `Night routine`, the product does not clearly tell you how those two routines should coexist.
- In practice, editing the existing evening routine is safer than adding another one.

### 5. Several trust and polish gaps make the screen feel unfinished

There are a few problems that, taken together, make the page feel rough.

#### A. Routine edits are destructive under the hood

When a routine is edited, the system replaces all of its items rather than updating them carefully. That creates risk around preserving past completion history.

Why this matters:

- Users should be able to improve a routine without feeling like they are damaging the system.

#### B. Some settings promise more than the app can really do

Habits allow `Target / day`, but the current habit check-in model only supports one check-in per day per habit.

Why this matters:

- A field like `2 per day` suggests counted progress.
- The current system behaves more like simple done/not done tracking.

#### C. The page uses internal-feeling language and rough status labels

Examples include:

- `active`
- `archived`
- `paused today`
- `rest day`
- `vacation`

These are not wrong, but the screen presents them in a blunt, system-heavy way instead of a polished product voice.

Why this matters:

- The page feels more like tooling than a motivating daily consistency surface.
- This likely explains the "weird text" feeling you noticed in the manage area.

## Bottom Line

The current habits page is not just unclear in wording. The confusion comes from real product decisions:

- routines are effectively hard-coded into two dayparts
- routine setup is too text-heavy and under-designed
- daily execution and system management are blended together
- the page allows situations the main view does not explain well
- several polish and trust gaps make the feature feel incomplete

## What I Would Prioritize Next

If this page is going to feel strong in a productivity app, the highest-value improvements would be:

1. Decide whether routines are truly custom, or intentionally only `morning` and `evening`.
2. Replace the plain multiline item box with a real checklist builder.
3. Make the page choose one role clearly: daily consistency surface first, management second.
4. Enforce one routine per period if that is the intended product rule.
5. Preserve history safely when routines are edited and add a clearer undo/correction flow.
