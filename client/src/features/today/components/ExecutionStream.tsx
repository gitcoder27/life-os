import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { isRecurring } from "../../../shared/lib/recurrence";
import { RecurrenceInfo } from "../../../shared/ui/RecurrenceBadge";
import { formatTimeLabel, type FocusSessionItem, type TaskItem, type LinkedGoal, type DayPlannerBlockItem } from "../../../shared/lib/api";
import { CheckIcon, MoreIcon } from "../helpers/icons";
import type { PlannerExecutionModel } from "../helpers/planner-execution";
import type { useTaskActions } from "../hooks/useTaskActions";
import type { DayPhase } from "../helpers/day-phase";
import { FocusSessionLauncher } from "./FocusSessionLauncher";
import { StartProtocolSheet } from "./StartProtocolSheet";
import { StuckFlowSheet } from "./StuckFlowSheet";

type TaskActions = ReturnType<typeof useTaskActions>;

type StreamSection = {
  key: string;
  label: string;
  tasks: TaskItem[];
};

export function ExecutionStream({
  date,
  executionTasks,
  execution,
  taskActions,
  plannerBlocks,
  phase,
  onSwitchToPlanner,
  activeFocusSession,
}: {
  date: string;
  executionTasks: TaskItem[];
  execution: PlannerExecutionModel;
  taskActions: TaskActions;
  plannerBlocks: DayPlannerBlockItem[];
  phase: DayPhase;
  onSwitchToPlanner: () => void;
  activeFocusSession: FocusSessionItem | null;
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

  for (const task of executionTasks) {
    if (task.status === "completed" || task.status === "dropped") {
      completedTasks.push(task);
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
  if (laterTasks.length > 0) sections.push({ key: "later", label: "Later today", tasks: laterTasks });
  if (unplannedTasks.length > 0) sections.push({ key: "unplanned", label: "Unplanned", tasks: unplannedTasks });

  const totalPending = nowTasks.length + laterTasks.length + unplannedTasks.length;
  const totalAll = executionTasks.length;

  return (
    <section className="execution-stream">
      <div className="execution-stream__header">
        <h2 className="execution-stream__title">Tasks</h2>
        {totalAll > 0 ? (
          <div className="execution-stream__stats">
            <span className="execution-stream__counter">
              {completedTasks.length}/{totalAll} done
            </span>
            <MiniProgressRing percent={totalAll > 0 ? (completedTasks.length / totalAll) * 100 : 0} />
          </div>
        ) : null}
      </div>

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
}: {
  section: StreamSection;
  date: string;
  taskActions: TaskActions;
  taskBlockMap: Map<string, DayPlannerBlockItem>;
  onSwitchToPlanner: () => void;
  activeFocusSession: FocusSessionItem | null;
}) {
  const isNow = section.key === "now";
  const isUnplanned = section.key === "unplanned";

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
      <div className="execution-stream__task-list">
        {section.tasks.map((task) => {
          const block = taskBlockMap.get(task.id) ?? null;
          return (
            <StreamTaskRow
              key={task.id}
              date={date}
              task={task}
              taskActions={taskActions}
              blockInfo={block}
              highlight={isNow}
              activeFocusSession={activeFocusSession}
            />
          );
        })}
      </div>
    </div>
  );
}

function StreamTaskRow({
  date,
  task,
  taskActions,
  blockInfo,
  highlight = false,
  activeFocusSession,
}: {
  date: string;
  task: TaskItem;
  taskActions: TaskActions;
  blockInfo: DayPlannerBlockItem | null;
  highlight?: boolean;
  activeFocusSession: FocusSessionItem | null;
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

  return (
    <div
      className={
        "stream-task" +
        (isDone ? " stream-task--done" : "") +
        (isDropped ? " stream-task--dropped" : "") +
        (highlight ? " stream-task--highlight" : "")
      }
    >
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
        disabled={taskActions.isPending}
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
            disabled={taskActions.isPending}
            title="Move to tomorrow"
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
          aria-label="Task actions"
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

function MiniProgressRing({ percent }: { percent: number }) {
  const size = 24;
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const color = percent >= 100 ? "var(--positive)" : "var(--accent)";

  return (
    <svg className="execution-stream__ring" viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.5s var(--ease)" }}
      />
    </svg>
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
