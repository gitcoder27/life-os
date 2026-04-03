# History and Archive Audit

Date: 2026-04-02

## Decision rule

- Use `history` for time-based records where past state matters: day plans, reviews, health logs, spending, notifications.
- Use `archive` for long-lived records that become inactive but should stay recoverable: habits, routines, templates, categories, goal config.
- Avoid dedicated history or archive on one-off setup and entry screens.

## Route-level audit

| Screen | Should have | Current state | Assessment |
| --- | --- | --- | --- |
| `Login` | Neither | No history or archive surface | Correct as-is |
| `Onboarding` | Neither | No history or archive surface | Correct as-is |
| `Home` | No dedicated history page; only lightweight trend context | Weekly momentum and score trend signals exist; backend also has `/api/home/overview/history/:date`, but there is no client screen for it | Optional only; not a priority |
| `Inbox` | Archive, not full history | Single-item and bulk archive are implemented, but archived inbox items are not viewable or restorable | Partial |
| `Today` | History, not archive | Planner mode can open other dates, and past dates become read-only history snapshots | Partial, but good baseline |
| `Habits` | Archive plus lightweight history | Archived habits and routines are shown and restorable; streaks and weekly momentum give limited history | Partial |
| `Health` | History, plus archive for templates | Today timeline, 7-day patterns, and weight trend/history exist; meal templates can be archived but archived templates disappear | Partial |
| `Finance` | Both | Month navigation gives real spending history; category and recurring archive actions exist | Partial |
| `Goals` | Archive, not a dedicated history page | The UI can filter paused/completed/archived goals and reactivate them; settings also supports archived domains and horizons | Partial |
| `Reviews` | History | Dedicated review history page is shipped, with filters, search, trends, and pagination | Implemented |
| `Settings` | Archive only for goal config | Goal domains and planning layers already support archived state | Implemented for current scope |
| `Notifications` | History or archive | Only an in-shell notification panel exists; it shows active non-dismissed notifications only | Missing as a proper screen |
| `Quick Capture` | Neither | No history or archive surface | Correct as-is |

## Supporting sections

| Section | Should have | Current state | Assessment |
| --- | --- | --- | --- |
| `Inbox -> Workflow templates` | Archive | Templates can be archived, but archived templates are filtered out and cannot be viewed or restored | Partial |
| `Health -> Meal templates` | Archive | Templates can be archived, but archived templates are filtered out and cannot be viewed or restored | Partial |
| `Finance -> Categories` | Archive | Categories can be archived, but archived categories disappear entirely from the UI | Partial |
| `Finance -> Recurring bills` | Archive | Archived recurring bills still come back from the API, but there is no clear archived section or restore flow | Partial |
| `Settings -> Goal domains / planning layers` | Archive | Archived items are visible and editable in settings | Implemented |

## What is already implemented well

- `Reviews` already has the clearest full history model in the product.
- `Today` already has a usable day-history foundation through date-based planner loading.
- `Finance` already has real month-to-month history through month navigation.
- `Habits` already has usable archive handling for habits and routines.
- `Settings` already has usable archive handling for goal domains and planning layers.

## Main pending gaps

- `Inbox archive view`: archive exists as an action, but not as a recoverable place.
- `Health history screen`: current health history is only partial and short-range.
- `Notifications page`: planned in docs, but not actually routed or shipped.
- `Goal lifecycle controls`: archived and completed filters exist, but active goals still lack visible pause/complete/archive actions.
- `Template and finance archive restore`: workflow templates, meal templates, finance categories, and recurring bills need clearer archived-state browse and restore flows.

## Recommendation

- Do not build a dedicated history page for `Home`, `Goals`, `Login`, `Onboarding`, or `Quick Capture`.
- Keep `Goals` focused on archive and inactive-state browsing, not timeline history.
- If you extend the review-history pattern elsewhere, the best next candidates are `Health history` and an `Inbox archive`.
- For `Finance`, improve archive clarity before creating another separate history surface.
