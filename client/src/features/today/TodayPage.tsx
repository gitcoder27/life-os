import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  daysUntil,
  formatTimeLabel,
  formatWorkoutStatus,
  getTodayDate,
  toIsoDate,
  useCarryForwardTaskMutation,
  useDayPlanQuery,
  useGoalsListQuery,
  useHealthDataQuery,
  useTasksQuery,
  useTaskStatusMutation,
  useUpdateDayPrioritiesMutation,
  useUpdatePriorityMutation,
  type GoalNudgeItem,
  type LinkedGoal,
  type TaskItem,
} from "../../shared/lib/api";
import { isRecurring } from "../../shared/lib/recurrence";
import { getQuickCaptureDisplayText, isQuickCaptureReferenceTask } from "../../shared/lib/quickCapture";
import { PageHeader } from "../../shared/ui/PageHeader";
import {
  EmptyState,
  InlineErrorState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import { RecurrenceInfo } from "../../shared/ui/RecurrenceBadge";
import { SectionCard } from "../../shared/ui/SectionCard";
import { GoalProgressBar, HealthBadge } from "../goals/GoalDetailPanel";

/* ── Inline icons ─────────────────────────────── */

function GripIcon() {
  return (
    <svg width="10" height="18" viewBox="0 0 10 18" fill="currentColor" aria-hidden="true">
      <circle cx="2.5" cy="2.5" r="1.2" />
      <circle cx="7.5" cy="2.5" r="1.2" />
      <circle cx="2.5" cy="9" r="1.2" />
      <circle cx="7.5" cy="9" r="1.2" />
      <circle cx="2.5" cy="15.5" r="1.2" />
      <circle cx="7.5" cy="15.5" r="1.2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 5.5l2 2L8 3" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <circle cx="3" cy="7" r="1.3" />
      <circle cx="7" cy="7" r="1.3" />
      <circle cx="11" cy="7" r="1.3" />
    </svg>
  );
}

/* ── Types ────────────────────────────────────── */

type EditablePriority = {
  id?: string;
  sortKey: string;
  title: string;
  goalId?: string | null;
  status: "pending" | "completed" | "dropped";
};

const prioritySlots: Array<1 | 2 | 3> = [1, 2, 3];

/* ── Helpers ──────────────────────────────────── */

function getTomorrowDate(fromDate: string) {
  const tomorrow = new Date(`${fromDate}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toIsoDate(tomorrow);
}

function getOffsetDate(fromDate: string, offsetDays: number) {
  const nextDate = new Date(`${fromDate}T12:00:00`);
  nextDate.setDate(nextDate.getDate() + offsetDays);
  return toIsoDate(nextDate);
}

function formatRecoveryDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function getRecoveryTaskDetail(isoDate: string) {
  const difference = daysUntil(isoDate);
  const overdueDays = Math.max(Math.abs(difference), 1);

  return `Scheduled ${formatRecoveryDate(isoDate)} · overdue by ${overdueDays} day${overdueDays === 1 ? "" : "s"}`;
}

type DayPlanTaskLike = {
  originType: string;
  kind: "task" | "note" | "reminder";
  notes: string | null;
  reminderDate: string | null;
};

function isQuickCaptureMetadataTask(task: DayPlanTaskLike) {
  return isQuickCaptureReferenceTask(task);
}

function getTaskDayMetaText(task: Pick<DayPlanTaskLike, "kind" | "notes" | "reminderDate">, fallback: string) {
  return getQuickCaptureDisplayText(task, fallback);
}

let draftKeyCounter = 0;
function nextDraftKey() {
  return `draft-${++draftKeyCounter}`;
}

/* ── Click-outside hook ──────────────────────── */

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
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [active, ref]);
}

/* ── GoalChip ─────────────────────────────────── */

function GoalChip({ goal }: { goal: LinkedGoal }) {
  return (
    <Link to="/goals" className="goal-chip">
      <span className={`goal-chip__dot goal-chip__dot--${goal.domain}`} />
      <span>{goal.title}</span>
    </Link>
  );
}

function GoalNudgeCard({
  nudge,
  canAdd,
  onAdd,
}: {
  nudge: GoalNudgeItem;
  canAdd: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="goal-nudge-card">
      <div className="goal-nudge-card__top">
        <GoalChip goal={nudge.goal} />
        <HealthBadge health={nudge.health} />
      </div>
      <GoalProgressBar percent={nudge.progressPercent} achieved={nudge.health === "achieved"} />
      <div className="goal-nba">
        <span className="goal-nba__icon">→</span>
        <span>{nudge.nextBestAction}</span>
      </div>
      <div className="goal-nudge-card__actions">
        <button
          className="button button--primary button--small"
          type="button"
          onClick={onAdd}
          disabled={!canAdd}
        >
          {canAdd ? "Add to priorities" : "Top three full"}
        </button>
        <Link className="button button--ghost button--small" to="/goals">
          Open goals
        </Link>
      </div>
    </div>
  );
}

/* ── Sortable Priority Card ──────────────────── */

function SortablePriorityCard({
  item,
  index,
  isMutating,
  activeGoals,
  onTitleChange,
  onGoalChange,
  onRemove,
  onStatusChange,
}: {
  item: EditablePriority;
  index: number;
  isMutating: boolean;
  activeGoals: Array<{ id: string; title: string; status: string }>;
  onTitleChange: (title: string) => void;
  onGoalChange: (goalId: string) => void;
  onRemove: () => void;
  onStatusChange: (status: "pending" | "completed" | "dropped") => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, menuOpen, () => setMenuOpen(false));

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.sortKey });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isDone = item.status === "completed";
  const isDropped = item.status === "dropped";
  const isSaved = Boolean(item.id);

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={
        "priority-card"
        + (isDragging ? " priority-card--dragging" : "")
        + (isDone ? " priority-card--done" : "")
        + (isDropped ? " priority-card--dropped" : "")
      }
    >
      <button
        className="priority-card__handle"
        type="button"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripIcon />
      </button>

      <span className="priority-card__slot">P{index + 1}</span>

      {isSaved ? (
        <button
          className={
            "priority-card__check"
            + (isDone ? " priority-card__check--done" : "")
            + (isDropped ? " priority-card__check--dropped" : "")
          }
          type="button"
          onClick={() => {
            if (isDone || isDropped) onStatusChange("pending");
            else onStatusChange("completed");
          }}
          disabled={isMutating}
          aria-label={isDone || isDropped ? "Reopen priority" : "Complete priority"}
        >
          {isDone ? <CheckIcon /> : null}
          {isDropped ? <span className="priority-card__check-x">×</span> : null}
        </button>
      ) : (
        <span className="priority-card__check priority-card__check--new" />
      )}

      <input
        className="priority-card__input"
        type="text"
        value={item.title}
        placeholder="What's the focus?"
        onChange={(e) => onTitleChange(e.target.value)}
        aria-label={`Priority ${index + 1} title`}
      />

      {activeGoals.length > 0 ? (
        <select
          className="priority-card__goal"
          value={item.goalId ?? ""}
          onChange={(e) => onGoalChange(e.target.value)}
          aria-label={`Goal for priority ${index + 1}`}
        >
          <option value="">No goal</option>
          {activeGoals.map((g) => (
            <option key={g.id} value={g.id}>{g.title}</option>
          ))}
        </select>
      ) : null}

      <div className="priority-card__actions" ref={menuRef}>
        <button
          className="priority-card__more"
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="More actions"
        >
          <MoreIcon />
        </button>
        {menuOpen ? (
          <div className="action-menu">
            {isSaved && item.status === "pending" ? (
              <button
                className="action-menu__item"
                type="button"
                onClick={() => { onStatusChange("dropped"); setMenuOpen(false); }}
              >
                ✗ Drop
              </button>
            ) : null}
            {isSaved && (isDone || isDropped) ? (
              <button
                className="action-menu__item"
                type="button"
                onClick={() => { onStatusChange("pending"); setMenuOpen(false); }}
              >
                ↶ Reopen
              </button>
            ) : null}
            <button
              className="action-menu__item action-menu__item--danger"
              type="button"
              onClick={() => { onRemove(); setMenuOpen(false); }}
            >
              Remove
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

/* ── Task Card ───────────────────────────────── */

function TaskCard({
  task,
  isTaskMutationPending,
  rescheduleDate,
  onRescheduleDateChange,
  onStatusChange,
  onCarryForward,
  onReschedule,
}: {
  task: TaskItem;
  isTaskMutationPending: boolean;
  rescheduleDate: string;
  onRescheduleDateChange: (date: string) => void;
  onStatusChange: (status: "pending" | "completed" | "dropped") => void;
  onCarryForward: () => void;
  onReschedule: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, menuOpen, () => setMenuOpen(false));

  const isDone = task.status === "completed";
  const isDropped = task.status === "dropped";
  const isPending = task.status === "pending";

  return (
    <div
      className={
        "task-card"
        + (isDone ? " task-card--done" : "")
        + (isDropped ? " task-card--dropped" : "")
      }
    >
      <button
        className={
          "task-card__check"
          + (isDone ? " task-card__check--done" : "")
          + (isDropped ? " task-card__check--dropped" : "")
        }
        type="button"
        onClick={() => {
          if (isDone || isDropped) onStatusChange("pending");
          else onStatusChange("completed");
        }}
        disabled={isTaskMutationPending}
        aria-label={isDone || isDropped ? "Reopen task" : "Complete task"}
      >
        {isDone ? <CheckIcon /> : null}
        {isDropped ? <span className="task-card__check-x">×</span> : null}
      </button>

      <div className="task-card__content">
        <div className="task-card__title">
          {task.title}
          {isRecurring(task.recurrence) ? (
            <RecurrenceInfo recurrence={task.recurrence} showCarryPolicy />
          ) : null}
        </div>
        <div className="task-card__meta">
          <span>{getTaskDayMetaText(task, task.scheduledForDate ?? "Scheduled today")}</span>
          {task.goal ? <GoalChip goal={task.goal} /> : null}
        </div>

        {showReschedule ? (
          <div className="task-card__reschedule">
            <input
              type="date"
              className="task-card__date-input"
              value={rescheduleDate}
              onChange={(e) => onRescheduleDateChange(e.target.value)}
            />
            <button
              className="button button--primary button--small"
              type="button"
              disabled={!isPending || isTaskMutationPending}
              onClick={() => { onReschedule(); setShowReschedule(false); }}
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
      </div>

      <div className="task-card__actions" ref={menuRef}>
        <button
          className="task-card__more"
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
                <button
                  className="action-menu__item"
                  type="button"
                  onClick={() => { onStatusChange("completed"); setMenuOpen(false); }}
                >
                  ✓ Complete
                </button>
                <button
                  className="action-menu__item"
                  type="button"
                  onClick={() => { onStatusChange("dropped"); setMenuOpen(false); }}
                >
                  ✗ Drop
                </button>
              </>
            ) : (
              <button
                className="action-menu__item"
                type="button"
                onClick={() => { onStatusChange("pending"); setMenuOpen(false); }}
              >
                ↶ Reopen
              </button>
            )}
            {isPending ? (
              <>
                <div className="action-menu__divider" />
                <button
                  className="action-menu__item"
                  type="button"
                  onClick={() => { onCarryForward(); setMenuOpen(false); }}
                >
                  {isRecurring(task.recurrence) ? "↷ Skip to next" : "→ Tomorrow"}
                </button>
                <button
                  className="action-menu__item"
                  type="button"
                  onClick={() => { setShowReschedule(true); setMenuOpen(false); }}
                >
                  📅 Reschedule…
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RecoveryTaskCard({
  task,
  isSelected,
  isTaskMutationPending,
  rescheduleDate,
  onRescheduleDateChange,
  onSelect,
  onStatusChange,
  onMoveToToday,
  onCarryForward,
  onReschedule,
}: {
  task: TaskItem;
  isSelected: boolean;
  isTaskMutationPending: boolean;
  rescheduleDate: string;
  onRescheduleDateChange: (date: string) => void;
  onSelect: () => void;
  onStatusChange: (status: "pending" | "completed" | "dropped") => void;
  onMoveToToday: () => void;
  onCarryForward: () => void;
  onReschedule: () => void;
}) {
  const [showReschedule, setShowReschedule] = useState(false);

  return (
    <div
      id={`recovery-task-${task.id}`}
      className={`recovery-task${isSelected ? " recovery-task--selected" : ""}`}
    >
      <div className="recovery-task__main">
        <button
          className="recovery-task__focus"
          type="button"
          onClick={onSelect}
          aria-label="Focus overdue task"
        />
        <div className="recovery-task__content">
          <div className="recovery-task__title-row">
            <div className="recovery-task__title">
              {task.title}
              {isRecurring(task.recurrence) ? (
                <RecurrenceInfo recurrence={task.recurrence} showCarryPolicy />
              ) : null}
            </div>
            {task.goal ? <GoalChip goal={task.goal} /> : null}
          </div>
          <div className="recovery-task__meta">
            <span>{getRecoveryTaskDetail(task.scheduledForDate ?? getTodayDate())}</span>
          </div>
          {showReschedule ? (
            <div className="task-card__reschedule">
              <input
                type="date"
                className="task-card__date-input"
                value={rescheduleDate}
                onChange={(event) => onRescheduleDateChange(event.target.value)}
              />
              <button
                className="button button--primary button--small"
                type="button"
                disabled={isTaskMutationPending}
                onClick={() => {
                  onReschedule();
                  setShowReschedule(false);
                }}
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
        </div>
      </div>
      <div className="recovery-task__actions">
        <button
          className="button button--ghost button--small"
          type="button"
          disabled={isTaskMutationPending}
          onClick={onMoveToToday}
        >
          Move to today
        </button>
        <button
          className="button button--ghost button--small"
          type="button"
          disabled={isTaskMutationPending}
          onClick={onCarryForward}
        >
          Tomorrow
        </button>
        <button
          className="button button--ghost button--small"
          type="button"
          disabled={isTaskMutationPending}
          onClick={() => setShowReschedule((current) => !current)}
        >
          Pick date
        </button>
        <button
          className="button button--ghost button--small"
          type="button"
          disabled={isTaskMutationPending}
          onClick={() => onStatusChange("completed")}
        >
          Complete
        </button>
        <button
          className="button button--ghost button--small"
          type="button"
          disabled={isTaskMutationPending}
          onClick={() => onStatusChange("dropped")}
        >
          Drop
        </button>
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────── */

export function TodayPage() {
  const today = getTodayDate();
  const tomorrow = getTomorrowDate(today);
  const overdueLookbackStart = getOffsetDate(today, -30);
  const yesterday = getOffsetDate(today, -1);
  const [searchParams, setSearchParams] = useSearchParams();
  const dayPlanQuery = useDayPlanQuery(today);
  const overdueTasksQuery = useTasksQuery({
    from: overdueLookbackStart,
    to: yesterday,
    status: "pending",
  });
  const healthQuery = useHealthDataQuery(today);
  const goalsListQuery = useGoalsListQuery();
  const updateTaskMutation = useTaskStatusMutation(today);
  const carryForwardTaskMutation = useCarryForwardTaskMutation(today);
  const updatePriorityMutation = useUpdatePriorityMutation(today);
  const updateDayPrioritiesMutation = useUpdateDayPrioritiesMutation(today);
  const [priorityDraft, setPriorityDraft] = useState<EditablePriority[]>([]);
  const [rescheduleDates, setRescheduleDates] = useState<Record<string, string>>({});
  const recoveryView = searchParams.get("view") === "overdue";
  const selectedOverdueTaskId = searchParams.get("taskId");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeGoals = useMemo(
    () => (goalsListQuery.data?.goals ?? []).filter((g) => g.status === "active"),
    [goalsListQuery.data],
  );

  const retryAll = () => {
    void dayPlanQuery.refetch();
    void overdueTasksQuery.refetch();
    void healthQuery.refetch();
  };

  const priorities = dayPlanQuery.data?.priorities ?? [];
  const tasks = dayPlanQuery.data?.tasks ?? [];
  const goalNudges = dayPlanQuery.data?.goalNudges ?? [];
  const overdueTasks = overdueTasksQuery.data?.tasks ?? [];
  const timedTasks = tasks
    .filter((task) => !isQuickCaptureMetadataTask(task))
    .filter((task) => task.dueAt);
  const executionTasks = tasks.filter((task) => !isQuickCaptureMetadataTask(task));
  const quickCaptureTasks = tasks.filter(isQuickCaptureMetadataTask);
  const currentDay = healthQuery.data?.summary.currentDay;
  const selectedOverdueTask =
    overdueTasks.find((task) => task.id === selectedOverdueTaskId) ?? null;
  const visibleGoalNudges = useMemo(() => {
    const linkedDraftGoalIds = new Set(
      priorityDraft.flatMap((priority) => (priority.goalId ? [priority.goalId] : [])),
    );

    return goalNudges.filter((nudge) => !linkedDraftGoalIds.has(nudge.goal.id));
  }, [goalNudges, priorityDraft]);

  useEffect(() => {
    if (!dayPlanQuery.data) {
      return;
    }

    const nextDraft = [...priorities]
      .sort((left, right) => left.slot - right.slot)
      .map((priority) => ({
        id: priority.id,
        sortKey: priority.id,
        title: priority.title,
        goalId: priority.goalId,
        status: priority.status,
      }));

    setPriorityDraft(nextDraft);
  }, [dayPlanQuery.data, priorities]);

  useEffect(() => {
    if (!recoveryView || !selectedOverdueTaskId || overdueTasksQuery.isLoading) {
      return;
    }

    const taskElement = document.getElementById(`recovery-task-${selectedOverdueTaskId}`);
    if (!taskElement) {
      return;
    }

    taskElement.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [overdueTasksQuery.isLoading, recoveryView, selectedOverdueTaskId]);

  const serverPrioritySnapshot = useMemo(
    () =>
      [...priorities]
        .sort((left, right) => left.slot - right.slot)
        .map((priority) => ({
          id: priority.id,
          title: priority.title,
          goalId: priority.goalId,
        })),
    [priorities],
  );

  const draftPrioritySnapshot = useMemo(
    () =>
      priorityDraft.map((priority) => ({
        id: priority.id,
        title: priority.title.trim(),
        goalId: priority.goalId ?? null,
      })),
    [priorityDraft],
  );

  const prioritiesHaveBlankTitle = priorityDraft.some((priority) => !priority.title.trim());
  const isPriorityDraftDirty =
    JSON.stringify(draftPrioritySnapshot) !== JSON.stringify(serverPrioritySnapshot);
  const isTaskMutationPending =
    updateTaskMutation.isPending || carryForwardTaskMutation.isPending;
  const canAddGoalNudge =
    priorityDraft.length < 3 || priorityDraft.some((priority) => !priority.title.trim());
  const isLightPlanningDay = priorityDraft.length === 0 && executionTasks.length === 0;

  const mutationError =
    updateTaskMutation.error instanceof Error
      ? updateTaskMutation.error.message
      : carryForwardTaskMutation.error instanceof Error
        ? carryForwardTaskMutation.error.message
        : updatePriorityMutation.error instanceof Error
          ? updatePriorityMutation.error.message
          : updateDayPrioritiesMutation.error instanceof Error
          ? updateDayPrioritiesMutation.error.message
          : null;

  function updateRecoverySearchParams(nextTaskId?: string | null) {
    const nextParams = new URLSearchParams(searchParams);

    if (nextTaskId) {
      nextParams.set("view", "overdue");
      nextParams.set("taskId", nextTaskId);
    } else {
      nextParams.delete("taskId");
      if (overdueTasks.length === 0) {
        nextParams.delete("view");
      }
    }

    setSearchParams(nextParams);
  }

  const planBits = [
    `Water progress: ${((currentDay?.waterMl ?? 0) / 1000).toFixed(1)}L / ${((currentDay?.waterTargetMl ?? 0) / 1000).toFixed(1)}L`,
    `Meals logged: ${currentDay?.mealCount ?? 0}`,
    `Workout: ${formatWorkoutStatus(currentDay?.workoutDay?.actualStatus)}`,
  ];

  function updateDraftPriority(index: number, title: string) {
    setPriorityDraft((current) =>
      current.map((item, currentIndex) =>
        currentIndex === index ? { ...item, title } : item,
      ),
    );
  }

  function updateDraftPriorityGoal(index: number, goalId: string) {
    setPriorityDraft((current) =>
      current.map((item, currentIndex) =>
        currentIndex === index ? { ...item, goalId: goalId || null } : item,
      ),
    );
  }

  function addDraftPriority() {
    setPriorityDraft((current) => {
      if (current.length >= 3) {
        return current;
      }
      return [...current, { title: "", goalId: null, status: "pending", sortKey: nextDraftKey() }];
    });
  }

  function addGoalNudgeToDraft(nudge: GoalNudgeItem) {
    setPriorityDraft((current) => {
      if (current.some((priority) => priority.goalId === nudge.goal.id)) {
        return current;
      }

      const emptyPriorityIndex = current.findIndex((priority) => !priority.title.trim());
      if (emptyPriorityIndex >= 0) {
        return current.map((priority, index) =>
          index === emptyPriorityIndex
            ? {
                ...priority,
                title: nudge.suggestedPriorityTitle,
                goalId: nudge.goal.id,
              }
            : priority,
        );
      }

      if (current.length >= 3) {
        return current;
      }

      return [
        ...current,
        {
          title: nudge.suggestedPriorityTitle,
          goalId: nudge.goal.id,
          status: "pending",
          sortKey: nextDraftKey(),
        },
      ];
    });
  }

  function removeDraftPriority(index: number) {
    setPriorityDraft((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPriorityDraft((current) => {
        const oldIndex = current.findIndex((p) => p.sortKey === active.id);
        const newIndex = current.findIndex((p) => p.sortKey === over.id);
        return arrayMove(current, oldIndex, newIndex);
      });
    }
  }

  function savePriorityDraft() {
    const payload = priorityDraft
      .map((priority, index) => ({
        id: priority.id,
        slot: prioritySlots[index],
        title: priority.title.trim(),
        goalId: priority.goalId ?? null,
      }))
      .filter((priority) => priority.title.length > 0);

    updateDayPrioritiesMutation.mutate({ priorities: payload });
  }

  function getRescheduleDate(taskId: string) {
    return rescheduleDates[taskId] ?? tomorrow;
  }

  if (dayPlanQuery.isLoading && !dayPlanQuery.data) {
    return (
      <PageLoadingState
        title="Loading execution workspace"
        description="Pulling in priorities, scheduled tasks, and the immediate context needed to work the day."
      />
    );
  }

  if (dayPlanQuery.isError || !dayPlanQuery.data) {
    return (
      <PageErrorState
        title="Today could not load"
        message={dayPlanQuery.error instanceof Error ? dayPlanQuery.error.message : undefined}
        onRetry={retryAll}
      />
    );
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Execution workspace"
        title="Today"
        description="Work the day here. Set the top three, clear scheduled tasks, and move anything that no longer belongs today."
      />

      {mutationError ? (
        <InlineErrorState message={mutationError} onRetry={retryAll} />
      ) : null}

      <div className="two-column-grid stagger">
        {overdueTasks.length > 0 || recoveryView ? (
          <SectionCard
            title="Recovery lane"
            subtitle="Recover overdue work before it disappears into the background again."
            className="recovery-lane-card"
          >
            <div className="recovery-lane__header">
              <div>
                <div className="recovery-lane__count">{overdueTasks.length}</div>
                <p className="recovery-lane__copy">
                  {overdueTasks.length === 0
                    ? "No overdue tasks are left to recover."
                    : `${overdueTasks.length} overdue task${overdueTasks.length === 1 ? "" : "s"} waiting for a clear decision.`}
                </p>
              </div>
              {recoveryView ? (
                <button
                  className="button button--ghost button--small"
                  type="button"
                  onClick={() => {
                    const nextParams = new URLSearchParams(searchParams);
                    nextParams.delete("view");
                    nextParams.delete("taskId");
                    setSearchParams(nextParams);
                  }}
                >
                  Return to today
                </button>
              ) : null}
            </div>

            {selectedOverdueTask ? (
              <p className="support-copy">
                Focused task: <strong>{selectedOverdueTask.title}</strong>
              </p>
            ) : null}

            {overdueTasksQuery.isError ? (
              <InlineErrorState
                message={overdueTasksQuery.error instanceof Error ? overdueTasksQuery.error.message : "Overdue tasks could not load."}
                onRetry={() => void overdueTasksQuery.refetch()}
              />
            ) : null}

            {overdueTasksQuery.isLoading && !overdueTasksQuery.data ? (
              <p className="support-copy">Loading overdue tasks…</p>
            ) : overdueTasks.length > 0 ? (
              <div className="recovery-lane">
                {overdueTasks.map((task) => (
                  <RecoveryTaskCard
                    key={task.id}
                    task={task}
                    isSelected={selectedOverdueTaskId === task.id}
                    isTaskMutationPending={isTaskMutationPending}
                    rescheduleDate={getRescheduleDate(task.id)}
                    onRescheduleDateChange={(date) =>
                      setRescheduleDates((current) => ({
                        ...current,
                        [task.id]: date,
                      }))
                    }
                    onSelect={() => updateRecoverySearchParams(task.id)}
                    onStatusChange={(status) =>
                      updateTaskMutation.mutate(
                        {
                          taskId: task.id,
                          status,
                        },
                        {
                          onSuccess: () => {
                            if (selectedOverdueTaskId === task.id) {
                              updateRecoverySearchParams(null);
                            }
                          },
                        },
                      )
                    }
                    onMoveToToday={() =>
                      carryForwardTaskMutation.mutate(
                        {
                          taskId: task.id,
                          targetDate: today,
                        },
                        {
                          onSuccess: () => {
                            if (selectedOverdueTaskId === task.id) {
                              updateRecoverySearchParams(null);
                            }
                          },
                        },
                      )
                    }
                    onCarryForward={() =>
                      carryForwardTaskMutation.mutate(
                        {
                          taskId: task.id,
                          targetDate: tomorrow,
                        },
                        {
                          onSuccess: () => {
                            if (selectedOverdueTaskId === task.id) {
                              updateRecoverySearchParams(null);
                            }
                          },
                        },
                      )
                    }
                    onReschedule={() =>
                      carryForwardTaskMutation.mutate(
                        {
                          taskId: task.id,
                          targetDate: getRescheduleDate(task.id),
                        },
                        {
                          onSuccess: () => {
                            if (selectedOverdueTaskId === task.id) {
                              updateRecoverySearchParams(null);
                            }
                          },
                        },
                      )
                    }
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Recovery lane is clear"
                description="Nothing overdue needs rescuing right now."
              />
            )}
          </SectionCard>
        ) : null}

        {/* ── Priority Stack ── */}
        <SectionCard
          title="Priority stack"
          subtitle="Top three for today. Reorder before you start."
        >
          {priorityDraft.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={priorityDraft.map((p) => p.sortKey)}
                strategy={verticalListSortingStrategy}
              >
                <ol className="priority-stack">
                  {priorityDraft.map((item, index) => (
                    <SortablePriorityCard
                      key={item.sortKey}
                      item={item}
                      index={index}
                      isMutating={
                        updatePriorityMutation.isPending ||
                        updateDayPrioritiesMutation.isPending
                      }
                      activeGoals={activeGoals}
                      onTitleChange={(title) => updateDraftPriority(index, title)}
                      onGoalChange={(goalId) => updateDraftPriorityGoal(index, goalId)}
                      onRemove={() => removeDraftPriority(index)}
                      onStatusChange={(status) => {
                        if (item.id) {
                          updatePriorityMutation.mutate({
                            priorityId: item.id,
                            status,
                          });
                        }
                      }}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
          ) : (
            <EmptyState
              title="No ranked priorities"
              description="Add up to three priorities to define today's focus."
            />
          )}

          {priorityDraft.length < 3 ? (
            <button
              className="priority-stack__add"
              type="button"
              onClick={addDraftPriority}
              disabled={updateDayPrioritiesMutation.isPending}
            >
              + Add priority
            </button>
          ) : null}

          {isPriorityDraftDirty ? (
            <div className="priority-stack__save-bar">
              <span className="priority-stack__save-hint">
                {prioritiesHaveBlankTitle
                  ? "Fill every title before saving"
                  : "Unsaved changes"}
              </span>
              <button
                className="button button--primary button--small"
                type="button"
                onClick={savePriorityDraft}
                disabled={
                  !isPriorityDraftDirty ||
                  prioritiesHaveBlankTitle ||
                  updateDayPrioritiesMutation.isPending
                }
              >
                {updateDayPrioritiesMutation.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Suggested from goals"
          subtitle={
            isLightPlanningDay
              ? "Today is light. Pull one active goal into the top three before busywork fills the gap."
              : "Keep active goals visible while you plan the day."
          }
        >
          {visibleGoalNudges.length > 0 ? (
            <div className="goal-nudges">
              {visibleGoalNudges.map((nudge) => (
                <GoalNudgeCard
                  key={nudge.goal.id}
                  nudge={nudge}
                  canAdd={canAddGoalNudge}
                  onAdd={() => addGoalNudgeToDraft(nudge)}
                />
              ))}
            </div>
          ) : activeGoals.length === 0 && !goalsListQuery.isLoading ? (
            <EmptyState
              title="No active goals yet"
              description="Set an active goal first and Today will start nudging useful work into view."
            />
          ) : (
            <EmptyState
              title="Goal work is already represented"
              description="Today already reflects your active goals, so there is nothing extra to nudge right now."
            />
          )}
        </SectionCard>

        {/* ── Task Lane ── */}
        <SectionCard
          title="Task lane"
          subtitle="Complete, move, or drop every task scheduled for today"
        >
          {executionTasks.length > 0 ? (
            <div className="task-lane">
              {executionTasks.map((item) => (
                <TaskCard
                  key={item.id}
                  task={item}
                  isTaskMutationPending={isTaskMutationPending}
                  rescheduleDate={getRescheduleDate(item.id)}
                  onRescheduleDateChange={(date) =>
                    setRescheduleDates((current) => ({
                      ...current,
                      [item.id]: date,
                    }))
                  }
                  onStatusChange={(status) =>
                    updateTaskMutation.mutate({
                      taskId: item.id,
                      status,
                    })
                  }
                  onCarryForward={() =>
                    carryForwardTaskMutation.mutate({
                      taskId: item.id,
                      targetDate: tomorrow,
                    })
                  }
                  onReschedule={() =>
                    carryForwardTaskMutation.mutate({
                      taskId: item.id,
                      targetDate: getRescheduleDate(item.id),
                    })
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No tasks scheduled"
              description="This lane is empty until something is assigned to today."
            />
          )}
        </SectionCard>

        {quickCaptureTasks.length > 0 ? (
          <SectionCard
            title="Day notes"
            subtitle="Quick capture notes and reminders for today"
          >
            <ul className="list">
              {quickCaptureTasks.map((noteTask) => (
                <li key={noteTask.id}>
                  <div>
                    <strong>{getTaskDayMetaText(noteTask, noteTask.title)}</strong>
                    <span className="list__subtle">
                      {noteTask.status === "completed" ? "Completed" : "Open"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        ) : null}

        <SectionCard
          title="Time blocks"
          subtitle="Day structure"
        >
          {timedTasks.length > 0 ? (
            <div>
              {timedTasks.map((task) => (
                <div key={task.id} className="time-block">
                  <span className="time-block__time">{formatTimeLabel(task.dueAt)}</span>
                  <span className="time-block__label">{task.title}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No timed blocks"
              description="Nothing on today's lane has a due time yet."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Meals and training"
          subtitle="Keep the day realistic"
        >
          {healthQuery.isError ? (
            <InlineErrorState
              message={healthQuery.error instanceof Error ? healthQuery.error.message : "Health context could not load."}
              onRetry={() => void healthQuery.refetch()}
            />
          ) : (
            <ul className="list">
              {planBits.map((item) => (
                <li key={item}>
                  <span>{item}</span>
                  <span
                    className={
                      item.includes("complete")
                        ? "tag tag--positive"
                        : item.includes("unplanned")
                          ? "tag tag--warning"
                          : "tag tag--neutral"
                    }
                  >
                    {item.includes("complete")
                      ? "done"
                      : item.includes("unplanned")
                        ? "open"
                        : "queued"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
