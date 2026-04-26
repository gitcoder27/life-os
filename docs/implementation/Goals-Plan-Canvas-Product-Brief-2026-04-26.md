# Goals Plan Canvas Product Brief

Date: 2026-04-26

## Current Finding

The Goals Plan graph is a promising structured planning surface, but today it behaves more like a visual report of existing goals than a full life-planning canvas. It already supports selecting goals, adding sub-goals, expanding and collapsing branches, focusing a branch, re-parenting goals by drag and drop, and sending goals into Month or Week focus.

The main issue is discoverability and workflow depth. Key actions are hidden behind selection, hover states, or the inspector. Users can create sub-goals, but creating a new top-level goal from the graph is not obvious. The graph also does not yet fully support the bottom-up planning workflow where users break large goals into smaller goals, then turn those lowest-level goals into milestones, tasks, habits, week priorities, or today actions.

## Product Direction

The canvas should become a structured life-planning canvas, not a rigid diagram and not a chaotic whiteboard.

The best direction is to keep the goal tree structured and auto-laid-out so planning remains clean, but make creation, editing, movement, zooming, focus, and planning actions feel direct and obvious. Users should be able to map long-term, mid-term, and short-term goals visually, break them down repeatedly into sub-goals, then work from the bottom up toward the main goal.

## Key Gaps

- The graph needs a visible `+ New Goal` action for creating top-level goals directly from the canvas.
- The empty canvas state should include a clear create action.
- Node actions such as `Add sub-goal` are hidden until a goal is selected.
- The graph toolbar is hidden until hover or focus, which makes important controls easy to miss.
- Zoom, fit-to-view, minimap, and center-selected controls are missing.
- Drag-and-drop re-parenting exists, but the affordance is too subtle.
- There is no clear action to detach a goal from its parent and make it top-level.
- There is no context menu for common node actions such as add child, edit, plan, duplicate, archive, or detach.
- Keyboard-driven planning is not well supported yet.
- Month and Week planning are handled in a separate dock, but users cannot plan by dragging goals into visible Month or Week slots on the canvas.
- The graph does not strongly visualize long-term, mid-term, short-term, and execution-level planning layers.
- Leaf goals do not yet naturally convert into milestones, tasks, habits, week priorities, or today actions.
- Accessibility needs improvement because some controls depend on hover, selection, or drag interactions.
- Scale tools are missing, including search, filters, collapse all, expand all, isolate branch, and show active path.
- Recovery and confidence tools are missing, including undo, redo, clearer save feedback, and clearer hierarchy update feedback.

## Next Phase Checklist

- [ ] Add a persistent `+ New Goal` action to the graph toolbar for top-level goal creation.
- [ ] Add a create action to the empty graph state.
- [ ] Keep the graph toolbar visible enough that users can discover primary actions without hovering.
- [ ] Add graph controls for zoom in, zoom out, fit view, and center selected.
- [ ] Add a lightweight search or command affordance for finding goals on larger canvases.
- [ ] Add a visible plus affordance on each goal node for creating sub-goals.
- [ ] Keep inline sub-goal creation on the graph and make the save/cancel flow clearer.
- [ ] Add a context menu or node action menu with add sub-goal, edit, plan, duplicate, archive, and detach actions.
- [ ] Add a `Make top-level` or `Detach from parent` action for hierarchy editing.
- [ ] Improve drag-and-drop re-parenting feedback with stronger target highlighting and success/error messages.
- [ ] Add keyboard alternatives for creating goals, adding sub-goals, opening planning, moving selection, and re-parenting.
- [ ] Add collapse all, expand all, focus branch, and show full tree controls.
- [ ] Add filters for domain, horizon, health, active status, Month focus, and Week focus.
- [ ] Strengthen visual hierarchy for long-term, mid-term, short-term, and execution-level goals.
- [ ] Show clearer status signals on nodes, including health, progress, overdue milestones, and Month or Week focus.
- [ ] Allow users to drag or assign selected goals into Month and Week focus slots from the canvas experience.
- [ ] Add bottom-up planning actions for leaf goals: create milestone, create task, create habit, add to week, and add to today.
- [ ] Add undo and redo for hierarchy changes.
- [ ] Add clear save, loading, and error feedback for create, edit, and re-parent actions.
- [ ] Review the canvas for accessibility: visible focus states, screen-reader labels, keyboard paths, and non-drag alternatives.

