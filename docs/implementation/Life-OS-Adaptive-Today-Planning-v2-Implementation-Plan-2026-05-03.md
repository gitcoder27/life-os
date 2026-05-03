# Life OS Adaptive Today Planning v2 Implementation Plan

Date: May 3, 2026

## Purpose

This document defines the next major Life OS product upgrade: **Adaptive Today Planning v2**.

The goal is to make Life OS answer the most important daily question with less negotiation:

> What should I do now, and how should the day reshape when reality changes?

This should not become another top-level feature area. It should upgrade the existing Home, Today, Planner, and Review loop so the product feels more like a calm operating system and less like a collection of useful screens.

## Executive Outcome

After this phase, Life OS should be able to:

- Pick one deterministic next move for the user.
- Explain the choice in one short line, not a coaching essay.
- Detect when the day is overloaded, unsized, or drifting.
- Offer a previewable "shape my day" plan before changing blocks.
- Recover slipped work inline from Today without forcing the user into heavy planning mode.
- Feed review learnings back into future planning signals.

The product should feel more decisive, not more crowded.

## Why This Now

The current app already has strong pieces:

- Today has execute and plan modes.
- Planner blocks, unplanned tasks, overdue tasks, and current-block health are modeled in `client/src/features/today/helpers/planner-execution.ts`.
- Focus sessions exist through `server/src/modules/focus` and Today/Home UI.
- Daily launch, must-win, rescue/recovery day modes, start protocol fields, stuck flow, goal nudges, and weekly capacity exist.
- Home already gathers a cross-domain overview.

The missing product leap is orchestration. The app knows many useful facts, but the user still has to interpret too much of them manually.

## Product Philosophy

Build deterministic guidance before AI guidance.

Prefer:

- One visible recommendation.
- One primary action.
- Preview before applying multi-step changes.
- Quiet status indicators over large explanatory panels.
- Existing task, planner, focus, review, and goal concepts over a new "coach" module.

Avoid:

- Chatbot-style coaching blocks.
- Long text explanations on the main screens.
- Another dashboard full of cards.
- Hidden automatic replanning.
- Magical planning that the user cannot inspect or undo.
- Over-optimizing around perfect schedules when a believable next action is enough.

## UX And Design Direction

The frontend implementation must protect the current improved visual direction. This feature should add taste and clarity, not visual noise.

### Design Principles

- **Minimal text:** main surfaces should use short labels, one-line reasons, and concrete verbs.
- **One recommendation at a time:** never show competing "smart" suggestions in the same visual tier.
- **Task queue remains primary:** Today Execute mode should still be about the work queue, selected task, and current focus.
- **Use hierarchy, not more boxes:** prefer spacing, dividers, inline chips, and subtle background bands over stacking new cards.
- **Preview complex changes:** shaping or recovery should show a compact before/after summary before applying.
- **Respect repeated daily use:** the interface should feel calm after the hundredth visit, not just impressive in screenshots.
- **Motion should be restrained:** use subtle transform/opacity transitions only for state changes, preview rows, and applied changes.

### Visual Treatment

The new adaptive layer should use:

- A thin top-of-workbench guidance strip, not a giant hero.
- Compact status chips for capacity and drift.
- Inline task-row treatments for "recommended", "slipped", and "needs size".
- A focused preview sheet for "Shape my day" and drift recovery.
- Existing button, chip, and task row styles where possible.
- Neutral surfaces with one restrained accent for the active recommendation.

Avoid:

- Large gradient panels.
- Multiple new cards inside the first viewport.
- Long helper copy.
- Decorative illustrations.
- Permanent right-rail coaching panels.
- Dense tables for daily decisions.

### Recommended UI Copy Rules

Use short labels:

- "Start this"
- "Shape day"
- "Recover drift"
- "Move slipped work"
- "Size tasks"
- "Keep plan"
- "Apply plan"

Use one-line reasons:

- "Must-win is ready and still untouched."
- "Current block is ending with 2 tasks left."
- "Today is over capacity by 45 minutes."
- "Three tasks need estimates before planning."

Avoid copy like:

- "Here are personalized insights to optimize your productivity."
- "Your day has many opportunities for improvement."
- "AI recommends a comprehensive replanning strategy."

## Primary User Workflows

### 1. Morning Start

```text
Open Home or Today
-> see one next move
-> confirm must-win or shape day
-> start first task or focus session
```

### 2. Midday Return

```text
Open Today
-> see current block health
-> start recommended task
-> or recover slipped work inline
```

### 3. Overloaded Day

```text
Capacity chip turns tight/overloaded
-> Shape day
-> preview task placement and deferrals
-> apply or keep plan
```

### 4. End Of Day

```text
Today detects unfinished or slipped tasks
-> close-day recovery
-> complete, carry forward, shrink, or send back to Inbox
-> review captures what should change next time
```

## V2 Feature Set

### Feature A: Single Next Move

#### Objective

Give the user one recommended action based on the current day state.

#### Product Behavior

The next move engine should choose one of these states:

| State | Meaning | Primary action |
| --- | --- | --- |
| `continue_focus` | A focus session is active. | Open focus session |
| `start_must_win` | Must-win is pending and ready enough. | Start task |
| `clarify_must_win` | Must-win is vague or missing a next action. | Clarify |
| `work_current_block` | A planner block is active and has pending tasks. | Start first task |
| `recover_drift` | Slipped blocks or overdue work need action. | Recover drift |
| `shape_day` | The day has work but no useful structure. | Shape day |
| `size_tasks` | Too many tasks lack estimates. | Size tasks |
| `reduce_day` | Rescue/recovery mode or overload suggests a smaller plan. | Reduce today |
| `close_day` | The planned day has ended with pending work. | Close day |
| `review_ready` | No urgent work, review window is more important. | Review |
| `empty` | There is no scheduled work. | Add task |

#### Decision Priority

Use a deterministic priority order:

1. Active focus session.
2. Rescue/recovery active state.
3. Current block is off track or ending soon with pending tasks.
4. Must-win pending and actionable.
5. Must-win pending but unclear.
6. Current planner block pending task.
7. Time-bound task due soon.
8. Day capacity overloaded or unsized.
9. Unplanned scheduled tasks need placement.
10. End-of-day unfinished work.
11. Review window action.
12. Empty-day setup.

#### Backend Shape

Add planning-domain logic instead of embedding the decision tree in React.

Suggested files:

- `server/src/modules/planning/adaptive-today-guidance.ts`
- `server/src/modules/planning/adaptive-today-routes.ts`
- `server/src/modules/planning/adaptive-today-schemas.ts`
- `server/test/modules/planning/adaptive-today-guidance.test.ts`
- `server/test/modules/planning/adaptive-today-routes.test.ts`

Suggested route:

```text
GET /api/planning/days/:date/adaptive-guidance
```

Suggested contracts in `packages/contracts/src/planning.ts`:

```ts
export type AdaptiveNextMoveState =
  | "continue_focus"
  | "start_must_win"
  | "clarify_must_win"
  | "work_current_block"
  | "recover_drift"
  | "shape_day"
  | "size_tasks"
  | "reduce_day"
  | "close_day"
  | "review_ready"
  | "empty";

export interface AdaptiveNextMoveAction {
  type:
    | "open_focus"
    | "start_task"
    | "clarify_task"
    | "shape_day"
    | "recover_drift"
    | "reduce_day"
    | "close_day"
    | "open_review"
    | "add_task";
  label: string;
  targetId?: EntityId | null;
}

export interface AdaptiveNextMove {
  state: AdaptiveNextMoveState;
  title: string;
  reason: string;
  primaryAction: AdaptiveNextMoveAction;
  secondaryAction?: AdaptiveNextMoveAction | null;
  taskId?: EntityId | null;
  plannerBlockId?: EntityId | null;
  severity: "neutral" | "helpful" | "attention" | "urgent";
}
```

Keep the actual contract names flexible during implementation, but keep the output compact and UI-ready.

#### Frontend Shape

Suggested files:

- `client/src/features/today/components/NextMoveStrip.tsx`
- `client/src/features/today/hooks/useAdaptiveToday.ts`
- `client/src/features/today/styles/adaptive-v2.css`
- `client/src/shared/lib/api/planning.ts`

Placement:

- Today Execute: directly above `ExecutionStream`, visually thin.
- Today Plan: in `CommandBar` or above planner timeline as a compact prompt.
- Home: fold into `FocusStage` or `WorkspaceLaunchStrip`, not as another large module.

Design:

- One line title.
- One short reason.
- One primary icon/button.
- Optional secondary text button only when truly useful.
- No paragraph body.

### Feature B: Shape My Day

#### Objective

Let the user create a realistic day plan from existing work without manual drag/drop for every task.

#### Product Behavior

"Shape my day" should:

- Preserve existing manually created planner blocks by default.
- Use open windows around existing blocks.
- Prefer must-win and current-block tasks.
- Respect task estimates, focus length, due times, and goal priority.
- Surface unsized tasks instead of pretending they fit perfectly.
- Suggest deferrals when the day is over capacity.
- Show a preview before making changes.

#### Planning Inputs

Use:

- `DayPlanResponse.tasks`
- `DayPlanResponse.mustWinTask`
- `DayPlanResponse.priorities`
- `DayPlanResponse.plannerBlocks`
- Daily launch day mode and energy rating
- Existing weekly capacity model when available
- Task fields:
  - `nextAction`
  - `fiveMinuteVersion`
  - `estimatedDurationMinutes`
  - `focusLengthMinutes`
  - `dueAt`
  - `goal`
  - `progressState`

#### Algorithm V1

Use a simple deterministic planner:

1. Build reserved windows from existing planner blocks.
2. Build candidate open windows for the selected date.
3. Score pending tasks:
   - must-win boost
   - current priority boost
   - active goal boost
   - due soon boost
   - started task boost
   - overdue penalty requiring explicit recovery
4. Estimate task size:
   - `estimatedDurationMinutes`
   - else `focusLengthMinutes`
   - else default to 25 minutes and mark as assumed
5. Place tasks into open windows using earliest-fit.
6. Keep small buffers between generated blocks.
7. Return unplaced tasks with a reason.
8. Return a preview, not direct writes.

#### Backend Shape

Suggested files:

- `server/src/modules/planning/day-shaping-service.ts`
- `server/src/modules/planning/day-capacity.ts`
- `server/src/modules/planning/adaptive-today-routes.ts`
- `server/test/modules/planning/day-shaping-service.test.ts`

Suggested routes:

```text
POST /api/planning/days/:date/shape-preview
POST /api/planning/days/:date/shape-apply
```

Preview response should include:

- Proposed blocks to create.
- Proposed task assignments.
- Tasks that need estimates.
- Tasks that cannot fit.
- Existing blocks that remain untouched.
- A concise summary: "Adds 3 blocks, places 5 tasks, leaves 2 unsized."

Apply response should return updated `plannerBlocks` and updated capacity assessment.

#### Frontend Shape

Suggested files:

- `client/src/features/today/components/ShapeDaySheet.tsx`
- `client/src/features/today/components/ShapeDayPreview.tsx`
- `client/src/features/today/components/CapacityStatusChip.tsx`
- `client/src/features/today/hooks/useShapeDay.ts`

Placement:

- Plan mode command area.
- Next Move primary action when no useful plan exists.
- Capacity chip dropdown/sheet when overloaded.

Design:

- Use a compact modal or sheet.
- Show preview as grouped rows, not a big table.
- Use plain labels: "Create", "Place", "Leave", "Defer".
- Keep the final apply button visible.
- Include "Keep current plan" as a calm exit.

### Feature C: Capacity Guardrails

#### Objective

Make overload visible before the user overcommits.

#### Product Behavior

Capacity should be assessed at two levels:

- Day capacity.
- Planner block capacity.

Signals:

- Too many pending tasks.
- Estimated task minutes exceed available planned minutes.
- Too many unsized tasks.
- Current block is at risk.
- Slipped work exists.
- Must-win has no next action.
- Rescue/recovery mode is active.

Assessment statuses:

| Status | Meaning |
| --- | --- |
| `clear` | Plan is believable. |
| `tight` | Plan can work, but needs attention. |
| `overloaded` | The day likely needs reduction or deferral. |
| `unclear` | Too much work lacks estimates. |
| `drifting` | Time has moved past planned work. |

#### Backend Shape

The same `day-capacity.ts` helper should be used by:

- Adaptive next move.
- Shape day preview.
- Planner response augmentation.
- Tests.

Avoid duplicating capacity math in the client.

#### Frontend Shape

Design treatment:

- A single status chip in `CommandBar` or planner summary.
- Inline block-level warnings only when a block is tight or overloaded.
- No permanent "capacity dashboard".

Example UI:

```text
Tight - 35 min over
```

Clicking opens a small breakdown:

```text
5 planned tasks
2 unsized
35 min over
```

Actions:

- Shape day
- Size tasks
- Reduce today

### Feature D: Inline Drift Recovery

#### Objective

When the day slips, recovery should happen where the user is already working.

#### Product Behavior

When `buildPlannerExecutionModel` detects slipped blocks or off-track state:

- Show a slim recovery row above the relevant queue section.
- Identify how many tasks slipped.
- Offer one primary recovery action.
- Let the user preview task movement before applying.

Recovery actions:

- Move slipped tasks to current block.
- Move slipped tasks to next block.
- Unplan slipped tasks.
- Carry slipped tasks to tomorrow.
- Shrink one task to its five-minute version.
- Activate reduced day.

#### Backend Shape

For simple single-task actions, reuse existing task and planner endpoints.

For multi-task recovery, add one transactional endpoint:

```text
POST /api/planning/days/:date/drift-recovery
```

This avoids partial client-side failure when moving several tasks between blocks or dates.

Suggested files:

- `server/src/modules/planning/drift-recovery-service.ts`
- `server/test/modules/planning/drift-recovery-service.test.ts`

#### Frontend Shape

Suggested files:

- `client/src/features/today/components/DriftRecoveryBar.tsx`
- `client/src/features/today/components/DriftRecoverySheet.tsx`

Placement:

- Execute mode: directly above the affected `ExecutionStream` section.
- Plan mode: inside planner timeline near slipped blocks.

Design:

- Slim band, not a card.
- One sentence max.
- One primary action.
- Secondary actions inside the sheet.

### Feature E: Review Feedback Loop

#### Objective

Make reviews change the system, not only create notes or tasks.

#### Product Behavior

Reviews should be able to seed planning signals:

- recurring derailment reason
- overloaded day pattern
- focus length mismatch
- task estimate mismatch
- repeated carry-forward task
- goal that needs more or less weekly capacity

V2 should start small:

- Add structured "planning adjustment" outputs from daily and weekly reviews.
- Let the user accept adjustments before they affect future planning.
- Use accepted adjustments as signals for next move, shape day, and capacity.

Examples:

- "Use 25 minute focus blocks this week."
- "Keep mornings lighter after low-energy launches."
- "Limit Today to 1 must-win and 2 support tasks."
- "Ask for estimates before scheduling vague inbox tasks."

Suggested files:

- `packages/contracts/src/reviews.ts`
- `server/src/modules/reviews/service.ts`
- `server/src/modules/planning/planning-preferences.ts` or a focused planning settings service
- `client/src/features/reviews/*`
- `client/src/features/settings/*` if accepted adjustments become editable preferences

Keep this as the final phase after next move, shaping, capacity, and drift recovery are stable.

## Architecture Plan

### Contracts

Update `packages/contracts/src/planning.ts` with:

- `AdaptiveNextMove`
- `DayCapacityAssessment`
- `ShapeDayPreviewRequest`
- `ShapeDayPreviewResponse`
- `ApplyShapeDayRequest`
- `DriftRecoveryRequest`
- `DriftRecoveryResponse`

Export all new types from `packages/contracts/src/index.ts` if needed.

Keep contract payloads UI-ready and compact. Avoid returning raw internal scoring details unless tests or debugging need them.

### Server

Prefer new focused planning files over expanding `server/src/modules/planning/plan-routes.ts`, which is already large.

Recommended structure:

```text
server/src/modules/planning/
  adaptive-today-guidance.ts
  adaptive-today-routes.ts
  adaptive-today-schemas.ts
  day-capacity.ts
  day-shaping-service.ts
  drift-recovery-service.ts
```

Route handlers should:

1. Require authenticated user.
2. Parse params/body with Zod.
3. Load the day context.
4. Call a focused service.
5. Return typed contract responses.

Do not put scoring, capacity math, or task placement logic inside Fastify route handlers.

### Client

Recommended structure:

```text
client/src/features/today/
  components/
    NextMoveStrip.tsx
    CapacityStatusChip.tsx
    ShapeDaySheet.tsx
    ShapeDayPreview.tsx
    DriftRecoveryBar.tsx
    DriftRecoverySheet.tsx
  hooks/
    useAdaptiveToday.ts
    useShapeDay.ts
  styles/
    adaptive-v2.css
```

API hooks should live in `client/src/shared/lib/api/planning.ts`, using types imported from `@life-os/contracts`.

Avoid placing significant new orchestration directly into `TodayPage.tsx`. The page should wire data, mode, and layout. New decision behavior belongs in hooks and focused components.

## Frontend Composition

### Today Execute Mode

Target hierarchy:

```text
Command bar
Next move strip
Task queue
Selected task inspector
Contextual recovery/capacity hints
```

Rules:

- The task queue must remain visible in the first viewport.
- The next move strip should not push the queue far down.
- Recovery appears only when relevant.
- Capacity detail appears on demand.
- The selected task inspector keeps depth for one task.

### Today Plan Mode

Target hierarchy:

```text
Planner command row
Capacity chip
Timeline
Unplanned/recovery sidebar
Shape day sheet on demand
```

Rules:

- "Shape day" belongs near existing planning controls.
- Preview changes before applying.
- Keep drag/drop fully usable for manual correction.
- Never hide manually created blocks during generated previews.

### Home

Home should reuse adaptive guidance lightly.

Rules:

- Do not add a new Home card.
- Fold the next move into `FocusStage` or `WorkspaceLaunchStrip`.
- If a focus session is active, that remains the dominant Home action.
- If Today needs shaping or drift recovery, show one launch action.

### Reviews

Reviews should not become a settings form.

Rules:

- Surface only accepted planning adjustments.
- Show them after review submission or in a compact confirmation step.
- Keep future-planning changes explicit.

## Detailed Implementation Phases

### Phase 0: Baseline Safety

Goal: protect current behavior before adding adaptive behavior.

Tasks:

- Run focused tests for planning, focus, reviews, and home guidance.
- Review current `TodayPage.tsx`, `ExecutionStream.tsx`, `DayPlanner.tsx`, `usePlannerActions.ts`, and `planner-execution.ts`.
- Confirm current build/typecheck baseline.
- Avoid broad refactors before feature work.

Verification:

- `npm run typecheck`
- `npm run test -w server`

### Phase 1: Capacity And Guidance Foundation

Goal: introduce shared backend assessment logic.

Backend:

- Add `day-capacity.ts`.
- Add `adaptive-today-guidance.ts`.
- Add focused unit tests for:
  - active focus wins
  - rescue mode wins
  - slipped work triggers drift recovery
  - pending must-win triggers start
  - vague must-win triggers clarify
  - unsized overload triggers size tasks
  - empty day triggers add task

Contracts:

- Add `AdaptiveNextMove`.
- Add `DayCapacityAssessment`.

Frontend:

- Add API hook for adaptive guidance.
- Add non-invasive `NextMoveStrip` behind the existing Today layout.

Design acceptance:

- Strip is visually smaller than the task queue header.
- One title, one reason, one primary action.
- No more than one secondary action.

### Phase 2: Shape My Day Preview

Goal: generate a preview without changing the user's plan.

Backend:

- Add `day-shaping-service.ts`.
- Add preview endpoint.
- Add tests for:
  - preserves existing blocks
  - places must-win first
  - respects due tasks
  - handles unsized tasks
  - returns unplaced tasks
  - does not overlap blocks

Frontend:

- Add `ShapeDaySheet`.
- Add preview loading, empty, error, and success states.
- Add "Keep current plan" and "Apply plan".

Design acceptance:

- Preview uses grouped rows, not a dense table.
- Changes are visually scannable in under 10 seconds.
- Apply action is clear, but not aggressive.

### Phase 3: Shape My Day Apply

Goal: apply previewed changes transactionally.

Backend:

- Add apply endpoint.
- Apply creates/updates blocks and assignments in a transaction.
- Return updated planner blocks and capacity assessment.
- Avoid deleting or rewriting existing user blocks unless the request explicitly includes that action.

Frontend:

- Wire apply mutation.
- Update React Query cache for the day plan.
- Show a subtle applied state.
- Keep manual planner controls available immediately afterward.

Verification:

- Server tests for preview/apply.
- Typecheck.
- Manual planner verification by user.

### Phase 4: Inline Drift Recovery

Goal: make slipped-work recovery visible and actionable.

Backend:

- Add `drift-recovery-service.ts` only for multi-task recovery.
- Reuse existing endpoints for single-task actions where safe.
- Add transactional tests.

Frontend:

- Add `DriftRecoveryBar` in execute mode.
- Add `DriftRecoverySheet` for preview/apply.
- Add planner timeline treatment for slipped blocks if needed.

Design acceptance:

- Recovery row appears only when there is drift.
- It uses one short sentence.
- The task queue remains primary.

### Phase 5: Home Integration

Goal: make Home launch the right workflow without becoming crowded.

Frontend:

- Feed adaptive next move into `FocusStage` or `WorkspaceLaunchStrip`.
- Keep focus-session banner priority.
- Avoid new Home cards.

Backend:

- Optionally reuse adaptive guidance in `server/src/modules/home/guidance.ts` if Home needs server-side composition.

Design acceptance:

- First viewport remains calm.
- Only one primary Home action is visually dominant.

### Phase 6: Review Feedback Signals

Goal: close the adaptation loop.

Backend:

- Add structured planning adjustment output to review submission.
- Store accepted adjustments in the smallest suitable model.
- Use accepted signals in next move and day shaping.

Frontend:

- Add compact post-review confirmation.
- Avoid showing planning settings during the main reflective writing flow.

Verification:

- Review service tests.
- Planning guidance tests that consume accepted adjustments.

## Data Model Considerations

Prefer no schema change for Phases 1 to 5 if possible.

Potential future schema additions for Phase 6:

- `PlanningPreference`
- `PlanningAdjustment`
- `ReviewPlanningAdjustment`

Only add these when accepted review adjustments need persistence beyond existing settings and review records.

Do not add a generic "AI insight" table.

## Error Handling

User-safe messages:

- "Could not shape this day. Try again after saving current changes."
- "Some tasks could not be placed."
- "This plan changed in another tab. Refresh and try again."
- "Recovery could not be applied. Your current plan was not changed."

Technical details should go to logs/tests, not UI copy.

## Testing Plan

### Server Tests

Add focused tests under `server/test/modules/planning/`:

- `adaptive-today-guidance.test.ts`
- `day-capacity.test.ts`
- `day-shaping-service.test.ts`
- `drift-recovery-service.test.ts`
- route tests for preview/apply/recovery

Important cases:

- Empty day.
- Must-win without next action.
- Active focus session.
- Current block at risk.
- Slipped block with pending tasks.
- Overloaded day with unsized tasks.
- Existing blocks preserved.
- Preview creates no writes.
- Apply is transactional.
- User cannot shape/recover another user's tasks or blocks.

### Client Verification

There is currently no committed client test runner. For UI work, document manual checks:

- Desktop and mobile Today Execute.
- Desktop and mobile Today Plan.
- Home first viewport.
- Shape day preview empty/loading/error/success.
- Apply preview and check planner blocks update.
- Drift recovery from execute mode.
- Focus session active state remains dominant.
- Rescue mode remains clear.

## Success Criteria

Product:

- User can identify the next action in under 3 seconds.
- Today still shows the task queue in the first viewport.
- Shape Day can produce a useful preview without overwriting manual blocks.
- Capacity issues are visible without adding a dashboard.
- Drift recovery can be completed without leaving Today.
- Review learnings can affect future planning only after user acceptance.

Design:

- No new screen feels like a stack of cards.
- Main UI copy stays short and action-oriented.
- The adaptive layer feels calm, not chatty.
- The visual language matches the current Life OS workbench direction.

Engineering:

- Decision logic lives in focused backend services.
- Contracts remain shared between client and server.
- Route handlers remain thin.
- Existing planner and focus behavior keeps working.
- New behavior is covered by focused backend tests.

## Out Of Scope

- General AI chat.
- Full calendar integration.
- Multi-user collaboration.
- Notification automation changes.
- A new top-level "Coach" page.
- Rebuilding Today from scratch.
- Rewriting planner drag/drop.
- Replacing deterministic rules with LLM planning.

## Recommended Build Order

1. Capacity assessment and next-move contract.
2. Backend guidance service and tests.
3. Today `NextMoveStrip`.
4. Shape-day preview service.
5. Shape-day sheet and apply endpoint.
6. Drift recovery service and inline UI.
7. Home integration.
8. Review feedback signals.

This order gives visible user value early while keeping the riskiest multi-step writes behind preview and transaction boundaries.
