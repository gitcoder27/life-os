# Scoring and Gamification Fix List

## Purpose

This document is the short action list for fixing scoring and gamification gaps that are already present in the product.

Use this as the working checklist for the next implementation passes.

## Fix Order

### 1. Fix multi-per-day habits

Problem:
The product allows habits to have a `target per day`, but the system still treats habits as simple once-per-day yes/no completion.

Why this matters:
- Daily score is not fair for multi-per-day habits.
- Habit streaks are not accurate for multi-per-day habits.
- Weekly challenge progress is not accurate for multi-per-day habits.
- Weekly and monthly habit summaries are not accurate for multi-per-day habits.

Done when:
- A habit with `2/day` or more can be tracked correctly.
- Score, streaks, weekly challenge, and summaries all use the same completion rule.
- The product no longer shows a target that the backend logic cannot truly support.

### 2. Fix weekly routine completion math

Problem:
The weekly review routine completion percentage is using the wrong denominator, so it can be inflated and does not represent true weekly consistency.

Why this matters:
- Weekly routine completion is not trustworthy.
- Users can see misleading percentages.

Done when:
- Weekly routine completion cannot exceed 100%.
- The percentage reflects real weekly routine opportunities, not raw check-in count divided by total items.

### 3. Bring the score up to date with the Today planner

Problem:
The Today page now tracks planned blocks, unplanned work, execution slippage, and cleanup state, but the score still ignores that entire execution layer.

Why this matters:
- The product encourages planned execution, but the score does not reward it.
- The score reflects an older version of the product.

Done when:
- There is a clear decision on whether planner adherence should affect the score.
- If yes, the scoring rules are defined and implemented.
- If no, the product is explicit that planner execution is guidance only and not part of scoring.

### 4. Update task scoring to use more meaningful task selection

Problem:
Task scoring only uses the first 5 scheduled tasks in creation order.

Why this matters:
- Important tasks added later may not count.
- Older low-value tasks may count when they should not.
- Planner order and execution order do not influence score fairness.

Done when:
- Task scoring uses a rule that matches the current product model.
- The rule is understandable to the user and stable enough to trust.

### 5. Decide how goals should relate to scoring

Problem:
Goals now have richer progress and health tracking, but goal progress is still mostly outside the scoring system.

Why this matters:
- Goal work can improve without clearly affecting score.
- The product is becoming more goal-driven than the scoring model reflects.

Done when:
- There is an explicit product decision:
- Either goals stay outside the score by design,
- Or goal progress/goal alignment becomes a scored input.

### 6. Fix stale score and momentum refresh after review submission

Problem:
Submitting a review for a past day or past week can leave current score-related views stale until reload or later navigation.

Why this matters:
- The math may be correct but the user sees old data.
- This weakens trust in the scoring system.

Done when:
- Daily, weekly, and monthly review submission refresh all affected current views immediately.
- Home, Today, score, and momentum surfaces stay in sync after submission.

### 7. Fix the habits page “this week” wording mismatch

Problem:
The habits page says “this week” for numbers that are actually based on the last 7 days.

Why this matters:
- The user can feel the numbers are wrong near week boundaries.
- This is a clarity problem that reduces trust.

Done when:
- The wording matches the real calculation,
- Or the calculation is changed to match the wording.

### 8. Tighten meal and expense scoring

Problem:
Meal scoring and expense scoring are both generous enough to over-credit partial behavior.

Why this matters:
- One meaningful meal log can unlock full meal points.
- One expense entry can unlock full expense points.

Done when:
- The rules match the intended behavior more closely,
- Or the UI wording is changed so the current lighter rule is explicit.

### 9. Clarify the “strong day streak” naming

Problem:
The streak uses a lower threshold than the visible “Strong Day” label.

Why this matters:
- The naming is confusing even if the underlying logic is intentional.

Done when:
- The streak name matches what it really tracks,
- Or the threshold is aligned with the visible label.

### 10. Respect optional routine items in scoring

Problem:
Routine items support optional/required status, but scoring currently treats routine completion as if all items matter equally.

Why this matters:
- Optional routine items can still affect fairness.
- The data model and score model are not fully aligned.

Done when:
- Optional routine items are either excluded from score math,
- Or the product removes the optional concept from places where it is not supported.

## Recommended Implementation Sequence

1. Multi-per-day habits
2. Weekly routine completion math
3. Review refresh consistency
4. Task scoring update
5. Today planner scoring decision
6. Goals scoring decision
7. Wording and naming cleanup
8. Meal, expense, and optional-routine fairness adjustments

## Rule For Future Changes

Whenever a new productivity feature is added, check this before shipping:

1. Does it affect score?
2. Does it affect streaks?
3. Does it affect weekly or monthly summaries?
4. Does the UI wording match the real calculation?
5. Does the data refresh correctly after mutation?
