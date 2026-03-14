# Product Requirements Document

Status: Draft v0.3  
Product: Life OS  
Source: [`../myRequirement.md`](../myRequirement.md)

Related docs:

- [`product-vision.md`](./product-vision.md)
- [`technical-architecture.md`](./technical-architecture.md)
- [`api-contracts.md`](./api-contracts.md)
- [`data-model.md`](./data-model.md)
- [`scoring-system.md`](./scoring-system.md)
- [`review-templates.md`](./review-templates.md)
- [`authentication-and-security.md`](./authentication-and-security.md)
- [`success-metrics.md`](./success-metrics.md)
- [`frontend-architecture.md`](./frontend-architecture.md)
- [`screen-specs.md`](./screen-specs.md)
- [`frontend-workstream.md`](./frontend-workstream.md)
- [`backend-architecture.md`](./backend-architecture.md)
- [`backend-workstream.md`](./backend-workstream.md)
- [`parallel-workstreams.md`](./parallel-workstreams.md)
- [`features-by-module.md`](./features-by-module.md)
- [`screen-breakdown.md`](./screen-breakdown.md)
- [`roadmap.md`](./roadmap.md)
- [`open-questions.md`](./open-questions.md)

## 1. Executive summary

Life OS is a personal life-management product for independent adults who want one trusted system for daily priorities, habits, health basics, finances, and personal planning. The first release should not attempt to build every possible life module. It should deliver a tight daily operating loop that helps the user plan the day, log key actions quickly, review progress, build discipline through transparent gamified feedback, and stay consistent.

## 2. Problem statement

Users currently manage life across memory, notes, calendar tools, habit trackers, spreadsheets, finance apps, and mental overhead. This creates fragmentation, inconsistency, weak follow-through, and poor visibility into what matters today.

Life OS solves for:

- fragmented personal systems
- cognitive overload
- inconsistent routines and habits
- poor linkage between goals and daily execution
- lack of a useful feedback loop across life domains

## 3. Target user

### Primary user

An independent professional who likes structure, manages most of life alone, and wants a unified system for planning, execution, and reflection.

### User needs

- Fast daily clarity
- A trusted place for important personal inputs
- Low-friction tracking
- Simple reflection and trend awareness
- Clear next actions tied to larger goals

## 4. Product goals

### User goals

- Reduce mental load
- Improve daily consistency
- Increase visibility into habits, health basics, and spending
- Connect weekly and daily action to longer-term goals

### Product goals

- Become a daily-use home screen for personal life management
- Create a repeatable morning-to-evening product loop
- Provide enough insight to drive action without creating dashboard fatigue
- Reinforce discipline and momentum through clear, transparent scoring

### Success metrics for MVP

- App used on at least `20 of 28` days after setup
- At least one meaningful log on `85%` of active days
- Daily review completed on `60%` or more of active days
- Weekly review completed in `3 of first 4` weeks
- Monthly review completed by day `3` of the next month
- Habit, water, and workout logging actions completed in `10 seconds` median or less
- Expense logging completed in `20 seconds` median or less
- Weekly self-rating of clarity, mental-load reduction, discipline support, and score fairness averages `4.0/5` or higher

See [`success-metrics.md`](./success-metrics.md) for the full evaluation model.

## 5. MVP definition

### Included pillars

1. Home and Today dashboard with daily score
2. Habit and routine tracking
3. Health basics: water, meals, workout status, weight
4. Expense tracking basics
5. Goal planning plus daily, weekly, and monthly reviews
6. Quick capture flow and rule-based attention engine

### Explicitly out of scope for MVP

- Full Life Admin depth
- Deep Insights analytics workspace
- Subscription intelligence beyond basic recurring expense support
- Household collaboration
- External provider integrations
- Advanced AI recommendations
- Complex budgeting rules

## 6. Key assumptions

- MVP is a responsive web app.
- The product is designed for one user account and one primary life profile.
- MVP includes a single owner account with no public sign-up.
- Data entry is mostly manual, assisted by templates and defaults.
- Initial deployment is private and self-hosted, but the codebase should support later security hardening for public exposure.
- External calendar, bank, or wearable sync is deferred.
- Notifications are in-app only for MVP.
- The first scoring model should be simple, transparent, and rule-based rather than adaptive or opaque.
- Tasks remain a lightweight construct inside Home, Today, and Quick Capture, not a standalone module in MVP.

## 7. Core user journeys

### Onboarding

The user enters:

- life priorities
- top goals
- current habits and routines
- preferred daily schedule blocks
- health targets
- expense categories

The system then creates:

- a starter dashboard
- initial routines
- starter habits
- default review prompts
- quick-add templates

See [`screen-specs.md`](./screen-specs.md) for the wireframe-level screen responsibilities and [`api-contracts.md`](./api-contracts.md) for frontend/backend integration boundaries.

### Daily morning flow

- Open Home or Today view
- See the daily score and attention items
- Review the top priorities
- Confirm or adjust the day's plan
- See routine, health, and expense snapshots
- Start execution with the next recommended action

### In-day flow

- Mark habits complete
- Log water, meals, workout status, weight, expense, note, or task
- Check what still needs attention

### Evening flow

- Review completion status
- Complete a short daily review
- Carry forward unfinished tasks if needed
- Add short reflection
- Prepare the next day

### Weekly flow

- Review habits, health basics, and spending
- Capture wins and misses
- Adjust goals and next-week focus
- Confirm weekly targets

### Monthly flow

- Review progress across habits, health basics, and spending
- Capture the biggest wins, misses, and lessons for the month
- Adjust monthly focus and larger goals

## 8. Functional requirements

### Epic A: Home and Today

Purpose: give the user one reliable daily operating surface.

Requirements:

- Show current date, greeting, and daily summary.
- Show the current daily score or momentum score.
- Surface top 3 priorities for the day.
- Show lightweight tasks and reminders without requiring a standalone task module.
- Show routine progress and incomplete items.
- Show health basics snapshot: water, meals, workout status.
- Show expense snapshot or recent spend indicator.
- Display alerts or items needing attention.
- Offer one-tap access to quick capture.
- Support carry-forward of unfinished tasks or reminders.

### Epic B: Habits and routines

Purpose: help the user build consistency with minimal friction.

Requirements:

- Create, edit, archive, and categorize habits.
- Support daily habits and simple routines.
- Mark completion in one tap.
- Show streaks and completion rate.
- Highlight habits at risk of breaking.
- Allow morning and evening routine grouping.

### Epic C: Health basics

Purpose: track a small set of meaningful physical health signals without heavy complexity.

Requirements:

- Log water intake quickly.
- Log meals using templates or short entries.
- Track workout planned, completed, missed, or recovery day status.
- Track body weight over time.
- Show daily and weekly summaries for the above.
- Surface simple prompts when patterns slip, such as missed workouts or low water intake.

### Epic D: Expense tracking basics

Purpose: give lightweight visibility into spending without becoming an accounting tool.

Requirements:

- Add an expense with amount, category, date, and optional note.
- Support recurring expense templates.
- Show current period spending summary.
- Highlight upcoming bills or recurring payments if configured.
- Show simple category-level spend visibility.

### Epic E: Reviews and goal planning

Purpose: create a feedback loop between past performance and next actions.

Requirements:

- Provide a daily review workflow.
- Provide a weekly review workflow.
- Provide a monthly review workflow.
- Show simple summaries for habits, health basics, and spending.
- Capture wins, misses, and lessons learned.
- Allow the user to set or adjust weekly priorities.
- Allow the user to set or adjust monthly focus.
- Link weekly goals to daily priorities conceptually, even if full project hierarchy comes later.

### Epic F: Quick capture

Purpose: make the product usable in real life by reducing input friction.

Requirements:

- Open a single quick-capture surface from anywhere.
- Support adding a task, expense, water log, meal, workout status, weight, note, or reminder.
- Pre-fill common templates and defaults.
- Preserve speed on mobile layouts.

### Epic G: Attention and scoring engine, MVP version

Purpose: summarize what needs attention and reinforce discipline without heavy automation.

Requirements:

- Generate rule-based alerts for incomplete routines, habit streak risk, missed workouts, low water progress, and upcoming bills.
- Compute a transparent daily score from simple rule-based inputs.
- Compute Weekly Momentum from recent daily scores plus timely weekly review completion.
- Show enough score context that the user can understand what increased or reduced it.
- Show alerts in Home and relevant module views.
- Keep alerts short, transparent, and dismissible.

## 9. Non-functional requirements

- Mobile-responsive layouts are required.
- MVP requires simple authenticated access.
- MVP auth uses a single owner account with email-plus-password login and server-managed sessions.
- Common actions should be completable in a few taps.
- The home view should load quickly and present a calm information hierarchy.
- Personal data should be handled as private by default.
- Architecture should support stronger security controls before later public exposure.
- Notifications are in-app only for MVP.
- Users should be able to edit mistakes easily.
- Data model and UI should support future module expansion without major rewrites.

## 10. Release criteria for MVP

- A new user can complete onboarding and reach a useful dashboard state.
- A user can complete a full daily loop: plan, log, score-aware review, and carry-forward.
- A user can complete a weekly review and set next-week priorities.
- A user can complete a monthly review and update monthly focus.
- Quick capture supports the core event types.
- Home view clearly reflects unfinished or at-risk items and shows an understandable score.
- The score model is explainable from the UI without hidden logic.
- Core data persists reliably across sessions.

## 11. Risks and mitigations

### Scope creep

Mitigation: freeze MVP around six pillars and push deep module expansion into later phases.

### Logging fatigue

Mitigation: build templates, defaults, recurring items, and one-tap actions first.

### Over-gamification

Mitigation: keep scoring transparent, helpful, and secondary to real-life progress rather than meaningless point farming.

### Weak retention

Mitigation: make Home immediately useful every morning and every evening.

### Distrust in scores or alerts

Mitigation: use simple transparent rules first and avoid opaque scoring.

## 12. Future opportunities

- Life Admin expansion
- Deeper goals and project hierarchy
- Richer insights and correlation analysis
- Integrations with calendar, finance, and health providers
- More adaptive recommendations and review prompts
