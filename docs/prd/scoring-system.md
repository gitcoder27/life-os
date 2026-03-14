# Scoring System

This document defines the MVP scoring model for Life OS. The system should reinforce discipline and clarity without turning life into meaningless point farming.

## Purpose

The scoring system exists to do four things:

- make daily progress visible
- reward consistency across life domains, not just task completion
- surface drift early
- keep the user engaged through understandable gamification

## Design principles

- Transparent: the user should always know why the score changed.
- Opportunity-based: only relevant items for the day should count.
- Balanced: work, routines, health, money, and reflection should all matter.
- Hard to game: extra low-value logging should not create fake progress.
- Supportive: the score should coach, not shame.

## MVP outputs

### 1. Daily Score

Primary score shown on Home and Today. Range: `0-100`.

### 2. Weekly Momentum

A simple rollup of the last 7 finalized daily scores, with a small weekly review bonus. This shows trend, not just one good or bad day.

### 3. Streaks

Tracked separately from the Daily Score:

- habit streaks
- routine streaks
- strong day streaks for days scoring `70+`

## Daily Score model

The Daily Score is based on weighted buckets. Some buckets are always relevant. Others are only counted when they actually apply to that day.

### Bucket weights

| Bucket | Weight | What it measures |
| --- | --- | --- |
| Plan and Priorities | 30 | Whether the user completed the most important work for the day |
| Routines and Habits | 25 | Whether the user followed their structure |
| Health Basics | 25 | Whether the user handled core physical care |
| Finance and Admin | 10 | Whether money and important admin items were handled on time |
| Review and Reset | 10 | Whether the user closed the day cleanly and prepared for tomorrow |

### Score formula

1. Calculate earned points from each applicable bucket.
2. Calculate the total applicable points for that day.
3. Final score = `round((earned_points / applicable_points) * 100)`.

If a bucket is not relevant on a given day, its weight is removed from the denominator instead of counting as zero.

Example:

- no workout planned
- no expense or bill due

In that case, the workout and finance/admin portions do not drag down the score.

## Detailed scoring rules

### A. Plan and Priorities: 30 points

| Item | Points | Rule |
| --- | --- | --- |
| Top priority 1 | 10 | Earned only when marked complete |
| Top priority 2 | 8 | Earned only when marked complete |
| Top priority 3 | 6 | Earned only when marked complete |
| Daily tasks and reminders | 6 | Based on completion ratio across up to 5 items scheduled for today |

Rules:

- Only tasks explicitly scheduled for today count.
- Backlog items do not affect the score.
- Only the first 5 scheduled tasks count toward points so the user cannot inflate the score with a huge task list.

### B. Routines and Habits: 25 points

| Item | Points | Rule |
| --- | --- | --- |
| Morning routine | 5 | Earned by completion ratio of the morning checklist |
| Evening routine | 5 | Earned by completion ratio of the evening checklist |
| Due habits | 15 | Based on completion ratio across habits due that day |

Rules:

- Only habits due today count.
- Extra off-schedule completions do not add bonus points.
- Habits should remain meaningful, not tiny artificial taps.

### C. Health Basics: 25 points

| Item | Points | Rule |
| --- | --- | --- |
| Water target | 8 | Scales with percentage of target completed, capped at 100 percent |
| Meal consistency | 7 | Earned by logging planned meals or meaningful food entries for the day |
| Workout or recovery adherence | 10 | Full points for completing the planned workout or respecting a planned recovery day |

Meal consistency rules:

- `7` points if all planned meals are logged or the intended meal target is met
- `4` points if the day is partially logged but still useful
- `0` points if no meaningful meal logging exists

Workout rules:

- `10` points for planned workout completed
- `10` points for planned recovery day respected
- `5` points for a fallback action such as mobility or walk when a full workout was missed but the day was not abandoned
- `0` points if the workout plan was missed entirely

If no workout or recovery plan exists for the day, this sub-item becomes non-applicable.

Body weight is important for tracking but does not contribute to the Daily Score because it is not a daily discipline behavior.

### D. Finance and Admin: 10 points

| Item | Points | Rule |
| --- | --- | --- |
| Same-day expense logging | 5 | Earned if all known spend for the day is logged by review time |
| Due bills or admin items | 5 | Earned if due items are completed, rescheduled intentionally, or cleared |

Rules:

- If there was no spending and no due admin or bill item, this bucket becomes non-applicable.
- This bucket rewards staying current, not perfect financial outcomes.

### E. Review and Reset: 10 points

| Item | Points | Rule |
| --- | --- | --- |
| Daily review complete | 6 | Earned when the required daily review fields are submitted |
| Tomorrow prepared | 4 | Earned when carry-forward is processed and tomorrow's top 3 priorities are set |

This bucket makes planning and closure part of discipline, not an optional afterthought.

## Score bands

| Score | Label | Meaning |
| --- | --- | --- |
| 85-100 | Strong Day | The day was aligned and well executed |
| 70-84 | Solid Day | Good consistency with some slippage |
| 55-69 | Recovering Day | The user stayed engaged but drift is visible |
| Below 55 | Off-Track Day | The system should respond with simpler next steps and recovery prompts |

These labels should be supportive, not punitive.

## Weekly Momentum

Weekly Momentum is meant to show trend, not perfection.

### Formula

`weekly_momentum = min(100, round(average_of_last_7_finalized_daily_scores + weekly_review_bonus))`

### Weekly review bonus

- `+5` if the weekly review is completed inside the review window
- `+0` if not completed

This keeps the math simple while still rewarding reflection.

## Strong day streak

A Strong Day streak increases when the finalized Daily Score is `70` or above.

Why `70`:

- it is hard enough to require discipline
- it is realistic enough to sustain
- it avoids an all-or-nothing perfection trap

## Anti-gaming rules

- Only due or scheduled items count.
- Only the first 5 daily tasks count toward task points.
- Extra taps on the same action do not generate extra score beyond the configured target.
- Closed-day scores should not change after the daily review window, except for explicit admin correction flows.
- Backfilled data should improve records, but it should not freely recover missed discipline points after the day is closed.

## UX requirements for scoring

- Show the score ring and current label on Home.
- Show bucket breakdown on Home and Review.
- Show the top reasons the score is lower than potential.
- Never show a score without explanation.
- Use neutral or encouraging language when the score is low.

## Worked example

Example day:

- top priorities completed: 2 of 3
- tasks completed: 4 of 5
- morning routine: fully done
- evening routine: half done
- due habits: 4 of 5
- water target: hit
- meals: partially logged
- workout: completed
- no expense or bill due
- daily review: complete
- tomorrow plan: complete

Earned points:

- Plan and Priorities: `10 + 8 + 0 + 5 = 23`
- Routines and Habits: `5 + 2.5 + 12 = 19.5`
- Health Basics: `8 + 4 + 10 = 22`
- Finance and Admin: non-applicable
- Review and Reset: `6 + 4 = 10`

Applicable points: `90`  
Earned points: `74.5`  
Final score: `83`

Result: `Solid Day`

## Future expansion

Later versions can add:

- readiness score
- balance meter
- monthly momentum
- adaptive weighting based on long-term goals
- streak protection or recovery tokens

None of those are required for MVP.
