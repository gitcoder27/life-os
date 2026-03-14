# Review Templates

This document defines the exact MVP review flows for daily, weekly, and monthly reflection. The goal is to make reflection useful enough to improve life, but short enough that it actually happens.

## Review principles

- Short by default
- Mostly prefilled by the system
- Focused on decisions, not journaling volume
- Consistent across cadences
- Directly connected to tomorrow, next week, and next month

## Cadence overview

| Review | Purpose | Time target | Output |
| --- | --- | --- | --- |
| Daily | Close the day, learn quickly, seed tomorrow | 3-5 minutes | Finalized day, carry-forward decisions, tomorrow priorities |
| Weekly | Spot patterns, reset priorities, tune systems | 10-15 minutes | Next-week priorities, focus habit, watch areas |
| Monthly | Reassess direction, adjust goals, simplify life | 20-30 minutes | Monthly theme, 3 key outcomes, habit changes |

## 1. Daily Review

### When it happens

- Triggered in the evening
- Can also be completed the next morning before the new day is finalized
- Best default window: `8:00 PM` to `10:00 AM` next day

### Prefilled summary

- Daily Score breakdown
- top priorities completed
- tasks completed versus scheduled
- routines and habits completed
- water progress
- meals logged
- workout or recovery status
- expenses logged

### Required fields

| Section | Prompt | Input type |
| --- | --- | --- |
| Biggest win | What went well today? | Short text |
| Main friction | What got in the way most? | Single-select tag plus optional note |
| Energy | How was your energy today? | 1-5 scale |
| Carry-forward | What should be moved, dropped, or rescheduled? | Select incomplete items |
| Tomorrow top 3 | What matters most tomorrow? | Three priority entries |

### Friction tags

Use one primary tag so patterns remain analyzable:

- low energy
- poor planning
- distraction
- interruptions
- overcommitment
- avoidance
- unclear task
- travel or schedule disruption

### Optional fields

- short journal note
- gratitude or positive note
- one sentence on what to improve tomorrow

### Completion rule

The daily review is considered complete only when:

- the win is filled
- one friction tag is chosen
- energy is rated
- carry-forward decisions are made
- tomorrow's top 3 are saved

### Output

- final Daily Score is locked
- incomplete items are carried, dropped, or rescheduled
- tomorrow is seeded with priorities
- friction patterns feed weekly review

## 2. Weekly Review

### When it happens

- Once per week
- Best default window: Sunday evening through Monday morning

### Prefilled summary

- weekly average Daily Score
- Strong Day count
- habit completion rates
- routine consistency
- workouts completed versus planned
- water target hit count
- meals logged count
- spending total and top spend category
- top friction tags from daily reviews

### Required fields

| Section | Prompt | Input type |
| --- | --- | --- |
| Biggest win | What was the best thing you did this week? | Short text |
| Biggest miss | What hurt progress most this week? | Short text |
| Main lesson | What did this week teach you? | Short text |
| Keep | What should continue next week? | Short text |
| Improve | What needs to change next week? | Short text |
| Next-week top 3 | What are the top priorities for next week? | Three entries |
| Focus habit | Which one habit matters most next week? | Single-select habit |
| Health target | What one health target will you protect next week? | Short text or single-select |
| Spending watch | Which category needs attention next week? | Single-select category or none |

### Optional fields

- weekly notes
- one person or relationship to pay attention to next week
- one admin task to clear

### Completion rule

The weekly review is considered complete only when:

- biggest win, biggest miss, and main lesson are filled
- keep and improve actions are filled
- next-week top 3 are saved
- focus habit is selected

### Output

- weekly review bonus applied to Weekly Momentum
- next-week priorities are created
- one focus habit is highlighted across the week
- a health target and spending watch item are carried into Home summaries

## 3. Monthly Review

### When it happens

- Once per month
- Best default window: last 2 days of the month through day 3 of the next month

### Prefilled summary

- average Weekly Momentum
- Daily Score trend across the month
- best and worst weeks
- top habits by consistency
- workout count
- water success rate
- spending by category
- goal and priority completion summary
- most common weekly friction themes

### Required fields

| Section | Prompt | Input type |
| --- | --- | --- |
| Month verdict | In one sentence, how did this month go? | Short text |
| Biggest win | What mattered most this month? | Short text |
| Biggest leak | What drained time, money, energy, or focus most? | Short text |
| Life-area ratings | How did this month feel across key areas? | 1-5 for each area |
| Next-month theme | What is the theme for next month? | Short text |
| Three outcomes | What 3 outcomes matter most next month? | Three entries |
| Habit changes | What habit should be added, removed, or simplified? | Structured choice |
| Simplify decision | What will you make simpler next month? | Short text |

### Life areas for monthly rating

- health
- discipline
- money
- work or growth
- home or life admin

### Optional fields

- freeform monthly reflection
- something to celebrate
- something to let go of

### Completion rule

The monthly review is considered complete only when:

- month verdict, biggest win, and biggest leak are filled
- life-area ratings are submitted
- next-month theme is set
- the three monthly outcomes are saved
- at least one habit-change decision is made

### Output

- next-month theme is pinned on Home
- the three monthly outcomes are linked into weekly planning
- habits are updated or flagged for change
- recurring friction themes feed later product insight logic

## Review order and dependency

- Daily review closes the day and seeds tomorrow.
- Weekly review summarizes the last 7 days and seeds next week.
- Monthly review summarizes the last 4-5 weeks and seeds the next month.

Each layer should inherit context from the smaller cadence below it.

## What should stay out of MVP reviews

- long journaling prompts
- too many rating scales
- freeform narrative everywhere
- AI-generated reflections
- complicated emotional diagnostics

The system should stay practical and repeatable.
