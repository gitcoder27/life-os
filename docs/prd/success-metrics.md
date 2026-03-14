# Success Metrics

This document defines how MVP success should be judged for Life OS. Because this is initially a single-user personal product, success is not only about usage counts. It is also about trust, speed, and whether the system genuinely reduces mental load.

## Success philosophy

MVP is successful if the product becomes a trusted daily operating system, not just a demo with many screens.

That means four things must be true:

- the app is used consistently
- logging is fast enough to fit real life
- reviews actually happen
- the product feels helpful, not like another burden

## Evaluation window

Use the first `30 days` of real personal usage as the primary evaluation window.

## Launch-readiness metrics

These should be true before the MVP is considered stable enough for serious daily reliance.

| Metric | Target |
| --- | --- |
| Onboarding completion time | `15 minutes` or less |
| Time to first useful dashboard | `10 minutes` or less from first login |
| Common one-tap action time | `10 seconds` median or less |
| Expense log time | `20 seconds` median or less |
| Meal log time | `25 seconds` median or less |
| Daily review time | `5 minutes` median or less |
| Weekly review time | `15 minutes` median or less |
| Monthly review time | `30 minutes` median or less |

## 30-day usage thresholds

| Metric | Target | Why it matters |
| --- | --- | --- |
| Active days | App used on at least `20 of 28` days after setup | Confirms real habit formation |
| Meaningful logging rate | At least one meaningful log on `85%` of active days | Confirms the product is operational, not decorative |
| Home-first usage | Home or Today is the first screen on `75%` of active days | Confirms the dashboard is central to the workflow |
| Daily review completion | Daily review completed on `60%` or more of active days | Confirms the reflection loop is sustainable |
| Weekly review completion | Weekly review completed in `3 of first 4` weeks | Confirms weekly planning value |
| Monthly review completion | Monthly review completed by day `3` of the next month | Confirms larger planning works |

## Trust and quality thresholds

| Metric | Target | Why it matters |
| --- | --- | --- |
| Data loss incidents | `0` | Personal trust is non-negotiable |
| Failed save rate | Less than `1%` of tracked write actions | Reliability matters more than feature count |
| Score explainability | User can explain the score change on `80%` of reviewed days | Gamification only works when it feels fair |
| Edit and correction success | All core records can be corrected without developer help | Personal systems need recoverability |

## Outcome and felt-value thresholds

Review these once per week during the first month using a simple `1-5` self-rating.

| Question | Success target |
| --- | --- |
| Did Life OS reduce my mental load this week? | Average `4.0` or higher |
| Did Life OS help me decide what matters today? | Average `4.0` or higher |
| Did Life OS help me stay disciplined this week? | Average `4.0` or higher |
| Did the score feel fair and useful? | Average `4.0` or higher |

## Hard-stop failure conditions

MVP should not be considered successful if any of these happen during the first 30 days:

- repeated data loss
- core logging actions consistently taking too long
- reviews becoming so long that they are regularly skipped
- scoring feeling arbitrary or easy to exploit
- Home failing to answer “what do I need to do next?”

## Overall success rule

Treat MVP as successful when:

- all hard-stop failure conditions are avoided
- at least `80%` of the measurable thresholds above are met
- the weekly self-ratings stay at `4.0` or above on average

## What to do if thresholds are missed

- If usage is weak, improve Home and Today clarity before adding more features.
- If logging is slow, simplify quick capture and templates before adding analytics.
- If reviews are skipped, cut prompt count before adding deeper reflection.
- If scoring is mistrusted, simplify the formula before adding more gamification.
