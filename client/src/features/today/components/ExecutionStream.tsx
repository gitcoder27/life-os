import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link } from "react-router-dom";
import { isRecurring } from "../../../shared/lib/recurrence";
import { RecurrenceInfo } from "../../../shared/ui/RecurrenceBadge";
import { formatTimeLabel, type FocusSessionItem, type TaskItem, type LinkedGoal, type DayPlannerBlockItem } from "../../../shared/lib/api";
import { CheckIcon, GripIcon, MoreIcon } from "../helpers/icons";
import type { PlannerExecutionModel } from "../helpers/planner-execution";
import type { useTaskActions } from "../hooks/useTaskActions";
import { FocusSessionLauncher } from "./FocusSessionLauncher";
import { StartProtocolSheet } from "./StartProtocolSheet";
import { StuckFlowSheet } from "./StuckFlowSheet";

type TaskActions = ReturnType<typeof useTaskActions>;

type StreamSection = {
  key: string;
  label: string;
  tasks: TaskItem[];
  note?: string;
};

type DragHandleProps = {
  attributes: React.ButtonHTMLAttributes<HTMLButtonElement>;
  listeners?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  setActivatorNodeRef: (node: HTMLButtonElement | null) => void;
  disabled: boolean;
};

export function ExecutionStream({
  date,
  executionTasks,
  overdueTasks = [],
  execution,
  taskActions,
  plannerBlocks,
  onSwitchToPlanner,
  activeFocusSession,
  mustWinTaskId,
  selectedTaskId,
  onSelectTask,
}: {
  date: string;
  executionTasks: TaskItem[];
  overdueTasks?: TaskItem[];
  execution: PlannerExecutionModel;
  taskActions: TaskActions;
  plannerBlocks: DayPlannerBlockItem[];
  onSwitchToPlanner: () => void;
  activeFocusSession: FocusSessionItem | null;
  mustWinTaskId?: string | null;
  selectedTaskId?: string | null;
  onSelectTask?: (task: TaskItem) => void;
}) {
  const [showCompleted, setShowCompleted] = useState(false);

  // Build a planned task ID → block map for metadata display
  const taskBlockMap = new Map<string, DayPlannerBlockItem>();
  for (const block of plannerBlocks) {
    for (const bt of block.tasks) {
      taskBlockMap.set(bt.taskId, block);
    }
  }

  // Build current-block task IDs for the "Now" section
  const currentBlockTaskIds = new Set(
    execution.currentBlock?.pendingTasks.map((t) => t.taskId) ?? [],
  );

  // Categorize tasks by decision value
  const nowTasks: TaskItem[] = [];
  const laterTasks: TaskItem[] = [];
  const unplannedTasks: TaskItem[] = [];
  const completedTasks: TaskItem[] = [];
  const pendingOverdueTasks = overdueTasks.filter((task) => task.status === "pending");

  for (const task of executionTasks) {
    if (task.status === "completed" || task.status === "dropped") {
      completedTasks.push(task);
    } else if (task.id === mustWinTaskId) {
      nowTasks.push(task);
    } else if (currentBlockTaskIds.has(task.id)) {
      nowTasks.push(task);
    } else if (taskBlockMap.has(task.id)) {
      laterTasks.push(task);
    } else {
      unplannedTasks.push(task);
    }
  }

  // If no planner blocks, move some unplanned tasks to "Now" based on natural ordering
  if (plannerBlocks.length === 0 && nowTasks.length === 0 && unplannedTasks.length > 0) {
    const movedToNow = unplannedTasks.splice(0, Math.min(3, unplannedTasks.length));
    nowTasks.push(...movedToNow);
  }

  const sections: StreamSection[] = [];
  if (nowTasks.length > 0) sections.push({ key: "now", label: "Now", tasks: nowTasks });
  if (pendingOverdueTasks.length > 0) {
    sections.push({
      key: "overdue",
      label: "Overdue",
      tasks: pendingOverdueTasks,
      note: "Review what still matters, then move or complete it.",
    });
  }
  if (laterTasks.length > 0) sections.push({ key: "later", label: "Later today", tasks: laterTasks });
  if (unplannedTasks.length > 0) sections.push({ key: "unplanned", label: "Unplanned", tasks: unplannedTasks });

  const totalAll = executionTasks.length + pendingOverdueTasks.length;
  const donePercent = totalAll > 0 ? Math.round((completedTasks.length / totalAll) * 100) : 0;

  return (
    <section className={`execution-stream${activeFocusSession ? " execution-stream--focus-active" : ""}`}>
      <header className="execution-stream__header" aria-label="Task queue summary">
        <div className="execution-stream__queue-bar">
          <div className="execution-stream__summary">
            <h2 className="execution-stream__title">Queue</h2>
            {totalAll > 0 ? (
              <span className="execution-stream__counter">{completedTasks.length}/{totalAll} done</span>
            ) : (
              <span className="execution-stream__counter">No tasks</span>
            )}
            {nowTasks.length > 0 ? (
              <span className="execution-stream__pill execution-stream__pill--now">{nowTasks.length} now</span>
            ) : null}
            {pendingOverdueTasks.length > 0 ? (
              <span className="execution-stream__pill execution-stream__pill--overdue">
                {pendingOverdueTasks.length} overdue
              </span>
            ) : null}
            {unplannedTasks.length > 0 ? (
              <button
                className="execution-stream__plan-link"
                type="button"
                onClick={onSwitchToPlanner}
              >
                {unplannedTasks.length} unplanned
              </button>
            ) : null}
          </div>

          {totalAll > 0 ? (
            <div
              className="execution-stream__progress"
              style={{ "--execution-progress": `${donePercent}%` } as CSSProperties}
              aria-hidden="true"
            >
              <span />
            </div>
          ) : null}
        </div>
      </header>

      {activeFocusSession ? (
        <div className="execution-stream__focus-banner" aria-live="polite">
          <div className="execution-stream__focus-copy">
            <span>{activeFocusSession.depth === "deep" ? "Deep focus active" : "Focus active"}</span>
            <strong>{activeFocusSession.task.title}</strong>
          </div>
          {activeFocusSession.task.nextAction?.trim() ? (
            <p>{activeFocusSession.task.nextAction}</p>
          ) : null}
        </div>
      ) : null}

      {sections.length === 0 && completedTasks.length === 0 ? (
        <div className="execution-stream__empty">
          <p className="execution-stream__empty-text">No tasks scheduled for today.</p>
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={onSwitchToPlanner}
          >
            Plan day
          </button>
        </div>
      ) : (
        <div className="execution-stream__sections">
          {sections.map((section) => (
            <StreamSectionGroup
              key={section.key}
              date={date}
              section={section}
              taskActions={taskActions}
              taskBlockMap={taskBlockMap}
              onSwitchToPlanner={onSwitchToPlanner}
              activeFocusSession={activeFocusSession}
              selectedTaskId={selectedTaskId}
              onSelectTask={onSelectTask}
            />
          ))}

          {/* Completed — collapsed by default */}
          {completedTasks.length > 0 ? (
            <div className="execution-stream__completed">
              <button
                className="execution-stream__completed-toggle"
                type="button"
                onClick={() => setShowCompleted((v) => !v)}
              >
                <span className={`execution-stream__chevron${showCompleted ? " execution-stream__chevron--open" : ""}`}>
                  ▸
                </span>
                <span className="execution-stream__completed-label">
                  Completed ({completedTasks.length})
                </span>
              </button>
              {showCompleted ? (
                <div className="execution-stream__completed-list">
                  {completedTasks.map((task) => (
                    <StreamTaskRow
                      key={task.id}
                      date={date}
                      task={task}
                      taskActions={taskActions}
                      blockInfo={null}
                      activeFocusSession={activeFocusSession}
                      selected={selectedTaskId === task.id}
                      onSelectTask={onSelectTask}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function StreamSectionGroup({
  section,
  date,
  taskActions,
  taskBlockMap,
  onSwitchToPlanner,
  activeFocusSession,
  selectedTaskId,
  onSelectTask,
}: {
  section: StreamSection;
  date: string;
  taskActions: TaskActions;
  taskBlockMap: Map<string, DayPlannerBlockItem>;
  onSwitchToPlanner: () => void;
  activeFocusSession: FocusSessionItem | null;
  selectedTaskId?: string | null;
  onSelectTask?: (task: TaskItem) => void;
}) {
  const isNow = section.key === "now";
  const isUnplanned = section.key === "unplanned";
  const isOverdue = section.key === "overdue";
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  );
  const isSortable = section.tasks.length > 1;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = section.tasks.findIndex((task) => task.id === active.id);
    const newIndex = section.tasks.findIndex((task) => task.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const reorderedTasks = arrayMove(section.tasks, oldIndex, newIndex);
    taskActions.reorderTasks(reorderedTasks.map((task) => task.id));
  }

  return (
    <div className={`execution-stream__section execution-stream__section--${section.key}`}>
      <div className="execution-stream__section-header">
        <span className={`execution-stream__section-dot execution-stream__section-dot--${section.key}`} />
        <span className="execution-stream__section-label">{section.label}</span>
        <span className="execution-stream__section-count">{section.tasks.length}</span>
        {isUnplanned ? (
          <button
            className="execution-stream__section-action"
            type="button"
            onClick={onSwitchToPlanner}
          >
            Plan these
          </button>
        ) : null}
      </div>
      {section.note ? (
        <p className="execution-stream__section-note">{section.note}</p>
      ) : null}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={section.tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          <div className="execution-stream__task-list">
            {section.tasks.map((task) => {
              const block = taskBlockMap.get(task.id) ?? null;
              return (
                <SortableStreamTaskRow
                  key={task.id}
                  date={date}
                  task={task}
                  taskActions={taskActions}
                  blockInfo={block}
                  highlight={isNow}
                  activeFocusSession={activeFocusSession}
                  selected={selectedTaskId === task.id}
                  isOverdue={isOverdue}
                  onSelectTask={onSelectTask}
                  sortableDisabled={!isSortable || taskActions.isPending || Boolean(activeFocusSession)}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableStreamTaskRow({
  sortableDisabled,
  ...props
}: Parameters<typeof StreamTaskRow>[0] & {
  sortableDisabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: props.task.id,
    disabled: sortableDisabled,
  });

  return (
    <StreamTaskRow
      {...props}
      dragHandleProps={{
        attributes: attributes as React.ButtonHTMLAttributes<HTMLButtonElement>,
        listeners: listeners as React.ButtonHTMLAttributes<HTMLButtonElement> | undefined,
        setActivatorNodeRef,
        disabled: sortableDisabled,
      }}
      isDragging={isDragging}
      rowRef={setNodeRef}
      rowStyle={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    />
  );
}

function StreamTaskRow({
  date,
  task,
  taskActions,
  blockInfo,
  highlight = false,
  activeFocusSession,
  selected = false,
  isOverdue = false,
  onSelectTask,
  dragHandleProps,
  isDragging = false,
  rowRef,
  rowStyle,
}: {
  date: string;
  task: TaskItem;
  taskActions: TaskActions;
  blockInfo: DayPlannerBlockItem | null;
  highlight?: boolean;
  activeFocusSession: FocusSessionItem | null;
  selected?: boolean;
  isOverdue?: boolean;
  onSelectTask?: (task: TaskItem) => void;
  dragHandleProps?: DragHandleProps;
  isDragging?: boolean;
  rowRef?: (node: HTMLDivElement | null) => void;
  rowStyle?: React.CSSProperties;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [protocolOpen, setProtocolOpen] = useState(false);
  const [stuckOpen, setStuckOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, menuOpen, () => setMenuOpen(false));

  const isDone = task.status === "completed";
  const isDropped = task.status === "dropped";
  const isPending = task.status === "pending";
  const isFocusedTask = activeFocusSession?.taskId === task.id;
  const isFocusLocked = Boolean(activeFocusSession && !isFocusedTask);

  return (
    <div
      ref={rowRef}
      className={
        "stream-task" +
        (isDone ? " stream-task--done" : "") +
        (isDropped ? " stream-task--dropped" : "") +
        (highlight ? " stream-task--highlight" : "") +
        (selected ? " stream-task--selected" : "") +
        (isFocusedTask ? " stream-task--focus-task" : "") +
        (isFocusLocked ? " stream-task--focus-muted" : "") +
        (isOverdue ? " stream-task--overdue" : "") +
        (isDragging ? " stream-task--dragging" : "")
      }
      style={rowStyle}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("button,a,input,select,textarea")) {
          return;
        }
        onSelectTask?.(task);
      }}
      onKeyDown={(event) => {
        if (!onSelectTask || (event.key !== "Enter" && event.key !== " ")) {
          return;
        }

        event.preventDefault();
        onSelectTask(task);
      }}
      tabIndex={onSelectTask ? 0 : undefined}
      aria-current={selected ? "true" : undefined}
    >
      <button
        className="stream-task__drag-handle"
        type="button"
        ref={dragHandleProps?.setActivatorNodeRef}
        disabled={!dragHandleProps || dragHandleProps.disabled}
        aria-label={`Reorder ${task.title}`}
        {...dragHandleProps?.attributes}
        {...dragHandleProps?.listeners}
      >
        <GripIcon />
      </button>

      {/* Checkbox — the primary "Done" action */}
      <button
        className={
          "stream-task__check" +
          (isDone ? " stream-task__check--done" : "") +
          (isDropped ? " stream-task__check--dropped" : "")
        }
        type="button"
        onClick={() =>
          taskActions.changeStatus(task.id, isDone || isDropped ? "pending" : "completed")
        }
        disabled={taskActions.isPending || isFocusLocked}
        aria-label={isDone || isDropped ? "Reopen task" : "Complete task"}
      >
        {isDone ? <CheckIcon /> : null}
        {isDropped ? <span className="stream-task__x">×</span> : null}
      </button>

      {/* Content */}
      <div className="stream-task__content">
        <div className="stream-task__title">
          {task.title}
          {isRecurring(task.recurrence) ? (
            <RecurrenceInfo recurrence={task.recurrence} showCarryPolicy />
          ) : null}
        </div>
        <div className="stream-task__meta">
          {blockInfo ? (
            <span className="stream-task__block-badge">
              {formatTimeLabel(blockInfo.startsAt)} · {blockInfo.title || "Block"}
            </span>
          ) : null}
          {task.goal ? <GoalChip goal={task.goal} /> : null}
        </div>
      </div>

      {/* Quick actions — visible, not hidden behind hover */}
      {isPending ? (
        <div className="stream-task__quick-actions">
          <FocusSessionLauncher
            date={date}
            task={task}
            activeSession={activeFocusSession}
            buttonLabel="Focus"
            activeLabel="In focus"
            disabledLabel="Locked"
            buttonClassName="stream-task__quick-btn stream-task__quick-btn--focus"
            activeChipClassName="stream-task__quick-pill"
          />
          <button
            className="stream-task__quick-btn"
            type="button"
            onClick={() => taskActions.moveToTomorrow(task.id)}
            disabled={taskActions.isPending || isFocusLocked}
            title={isFocusLocked ? "Finish or stop the active focus before changing another task." : "Move to tomorrow"}
            aria-label="Move to tomorrow"
          >
            →
          </button>
        </div>
      ) : null}

      {/* Overflow menu */}
      <div className="stream-task__menu-wrap" ref={menuRef}>
        <button
          className="stream-task__more"
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          disabled={isFocusLocked}
          aria-label="Task actions"
          title={isFocusLocked ? "Finish or stop the active focus before changing another task." : undefined}
        >
          <MoreIcon />
        </button>
        {menuOpen ? (
          <div className="action-menu">
            {isPending ? (
              <>
                <button className="action-menu__item" type="button"
                  onClick={() => { setProtocolOpen(true); setMenuOpen(false); }}>
                  Start protocol
                </button>
                <button className="action-menu__item" type="button"
                  onClick={() => { setStuckOpen(true); setMenuOpen(false); }}>
                  I'm stuck
                </button>
                <div className="action-menu__divider" />
                <button className="action-menu__item" type="button"
                  onClick={() => { taskActions.changeStatus(task.id, "dropped"); setMenuOpen(false); }}>
                  ✗ Drop
                </button>
                <div className="action-menu__divider" />
                <button className="action-menu__item" type="button"
                  onClick={() => { taskActions.moveToTomorrow(task.id); setMenuOpen(false); }}>
                  {isRecurring(task.recurrence) ? "↷ Skip to next" : "→ Tomorrow"}
                </button>
                <button className="action-menu__item" type="button"
                  onClick={() => { setShowReschedule(true); setMenuOpen(false); }}>
                  📅 Reschedule…
                </button>
              </>
            ) : (
              <button className="action-menu__item" type="button"
                onClick={() => { taskActions.changeStatus(task.id, "pending"); setMenuOpen(false); }}>
                ↶ Reopen
              </button>
            )}
          </div>
        ) : null}
      </div>

      {/* Reschedule date picker */}
      {showReschedule ? (
        <div className="stream-task__reschedule">
          <input
            type="date"
            className="stream-task__date-input"
            value={taskActions.getRescheduleDate(task.id)}
            onChange={(e) => taskActions.setRescheduleDate(task.id, e.target.value)}
          />
          <button
            className="button button--primary button--small"
            type="button"
            disabled={taskActions.isPending}
            onClick={() => { taskActions.reschedule(task.id); setShowReschedule(false); }}
          >
            Move
          </button>
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={() => setShowReschedule(false)}
          >
            Cancel
          </button>
        </div>
      ) : null}

      <StartProtocolSheet open={protocolOpen} date={date} task={task} onClose={() => setProtocolOpen(false)} />
      <StuckFlowSheet open={stuckOpen} date={date} task={task} onClose={() => setStuckOpen(false)} />
    </div>
  );
}

function GoalChip({ goal }: { goal: LinkedGoal }) {
  return (
    <Link to="/goals" className="goal-chip">
      <span className={`goal-chip__dot goal-chip__dot--${goal.domain}`} />
      <span>{goal.title}</span>
    </Link>
  );
}

function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  active: boolean,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!active) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onCloseRef.current();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [active, ref]);
}
