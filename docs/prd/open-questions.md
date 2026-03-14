# Open Questions And Decisions

The original planning gaps for MVP are now resolved at the PRD level. This document now acts as a decision summary and reference map.

## Confirmed decisions

| Area | Decision | Notes | Why it matters |
| --- | --- | --- | --- |
| Platform | Responsive web MVP | Web only for the first release | Keeps delivery focused and matches the current usage model |
| User model | Single-user product | Designed for one personal life profile | Avoids premature sharing and collaboration complexity |
| Authentication | Simple login required in MVP | Keep auth lightweight at first | Personal data still needs basic access control |
| Privacy and hosting | Private self-hosted deployment first | Intended to run on a private VPS initially; code should still be structured for stronger security hardening before any public internet exposure | Affects architecture, auth, and future deployment work |
| Integrations | No external integrations in MVP | No calendar, bank, wearable, or health-provider sync initially | Reduces scope and dependency risk |
| Notifications | In-app notifications in MVP | Telegram can be added later | Keeps reminders useful without expanding platform complexity |
| Scoring | Include a scoring system in MVP | It should reinforce discipline and gamify consistency, not just passively track life | Makes motivation and feedback part of the core product loop |
| Goal linkage | Simple weekly-to-daily linkage | Keep it lightweight in MVP | Preserves the differentiator without building a full project manager |
| Tasks | Supporting construct inside Today | Tasks should remain lightweight in Home, Today, and Quick Capture for MVP, not a separate first-class module | Protects the daily operating loop from unnecessary navigation complexity |
| Meals | Lightweight logging with templates | Fast entry is more important than nutrition depth in MVP | Helps avoid abandonment from logging fatigue |
| Expenses | Basic details first, advanced logic later | Capture the core spending details and category visibility first | Avoids turning MVP into accounting software |
| Reviews | Daily, weekly, and monthly reviews are all part of MVP | Review depth can vary by cadence, but all three should exist | Makes reflection a core habit, not a later add-on |
| Recommendations | Rule-based in MVP | Avoid generated recommendations for now | Improves transparency and implementation reliability |
| Authentication detail | Single owner account, no public sign-up, email-and-password login, server-side sessions | Full definition lives in `authentication-and-security.md` | Keeps access simple and appropriate for a private self-hosted MVP |
| Scoring model | Weighted Daily Score, Weekly Momentum, and streaks | Full definition lives in `scoring-system.md` | Makes gamification concrete and fair |
| Review templates | Daily, weekly, and monthly templates with strict time budgets and required outputs | Full definition lives in `review-templates.md` | Makes reflection actionable and repeatable |
| Success thresholds | 30-day dogfooding thresholds with hard-stop quality gates | Full definition lives in `success-metrics.md` | Makes MVP evaluation concrete |

## Reference docs

| Topic | Source document |
| --- | --- |
| Scoring and gamification | [`scoring-system.md`](./scoring-system.md) |
| Reviews and cadence design | [`review-templates.md`](./review-templates.md) |
| Login and security baseline | [`authentication-and-security.md`](./authentication-and-security.md) |
| MVP evaluation thresholds | [`success-metrics.md`](./success-metrics.md) |

## Blocking open questions

None at the product-definition level.

Implementation details will still need technical design, but the product decisions are now clear enough to move into wireframes, data modeling, and system architecture.
