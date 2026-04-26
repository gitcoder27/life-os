# Today Rescue Mode Workflow Brief

## Why
The previous “Reduce today” widget was confusing because activating it did not meaningfully simplify the Today page. A future version should be a clear rescue workflow, not a passive right-column note.

## Product Goal
Help the user recover an overloaded or low-energy day by protecting one believable action and deliberately deferring the rest.

## Trigger
Show Rescue Mode only when there is a strong signal:
- Too many pending tasks for today.
- Multiple overdue tasks.
- Low energy during daily launch.
- A stuck/derailed must-win task.
- User manually chooses “Reduce today.”

## Workflow
1. Ask the user to choose one protected task for today.
2. Move that task into the primary `Now` position.
3. Suggest deferring all non-essential pending tasks to tomorrow or later.
4. Hide optional prompts such as goal nudges while Rescue Mode is active.
5. Show a clear active state: `Reduced day active: 1 protected task, X deferred`.
6. Provide one obvious undo: `Return to full plan`.

## UX Principles
- Do not make the user interpret what changed.
- Do not silently hide important tasks.
- Keep the main task queue as the source of truth.
- Treat Rescue Mode as a temporary state for today, not a permanent planning mode.

## Acceptance Criteria
- Activating Rescue Mode visibly changes the task queue.
- The protected task is clear and actionable.
- Deferred tasks are explicit before the user confirms.
- The user can undo the reduced plan.
- The right column stays quiet and supportive, not crowded.
