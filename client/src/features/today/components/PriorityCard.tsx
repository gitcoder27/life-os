import { useEffect, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripIcon, CheckIcon, MoreIcon } from "../helpers/icons";
import type { EditablePriority, PriorityTaskFill } from "../hooks/usePriorityDraft";

const POINT_VALUES = [10, 8, 6];

export type PriorityTaskOption = PriorityTaskFill & {
  id: string;
  group: "planned" | "unplanned";
};

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

export function PriorityCard({
  item,
  index,
  isMutating,
  activeGoals,
  onTitleChange,
  onTitleBlur,
  onGoalChange,
  taskOptions,
  onTaskFill,
  onRemove,
  onStatusChange,
}: {
  item: EditablePriority;
  index: number;
  isMutating: boolean;
  activeGoals: Array<{ id: string; title: string; status: string }>;
  onTitleChange: (title: string) => void;
  onTitleBlur: () => void;
  onGoalChange: (goalId: string) => void;
  taskOptions: PriorityTaskOption[];
  onTaskFill: (taskFill: PriorityTaskFill) => void;
  onRemove: () => void;
  onStatusChange: (status: "pending" | "completed" | "dropped") => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [taskPickerValue, setTaskPickerValue] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, menuOpen, () => setMenuOpen(false));

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.sortKey });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const isDone = item.status === "completed";
  const isDropped = item.status === "dropped";
  const isSaved = Boolean(item.id);
  const points = POINT_VALUES[index] ?? 0;
  const plannedTaskOptions = taskOptions.filter((task) => task.group === "planned");
  const unplannedTaskOptions = taskOptions.filter((task) => task.group === "unplanned");

  function handleTaskFill(taskId: string) {
    if (!taskId) {
      setTaskPickerValue("");
      return;
    }

    const selectedTask = taskOptions.find((task) => task.id === taskId);
    if (!selectedTask) {
      return;
    }

    onTaskFill({
      title: selectedTask.title,
      goalId: selectedTask.goalId ?? null,
    });
    setTaskPickerValue("");
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={
        "today-priority-card" +
        (menuOpen ? " today-priority-card--menu-open" : "") +
        (isDragging ? " today-priority-card--dragging" : "") +
        (isDone ? " today-priority-card--done" : "") +
        (isDropped ? " today-priority-card--dropped" : "")
      }
    >
      <button
        className="today-priority-card__handle"
        type="button"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripIcon />
      </button>

      <div className="today-priority-card__slot">
        <span className="today-priority-card__slot-label">P{index + 1}</span>
        <span className="today-priority-card__slot-pts">{points}pt</span>
      </div>

      {isSaved ? (
        <button
          className={
            "today-priority-card__check" +
            (isDone ? " today-priority-card__check--done" : "") +
            (isDropped ? " today-priority-card__check--dropped" : "")
          }
          type="button"
          onClick={() => onStatusChange(isDone || isDropped ? "pending" : "completed")}
          disabled={isMutating}
          aria-label={isDone || isDropped ? "Reopen priority" : "Complete priority"}
        >
          {isDone ? <CheckIcon /> : null}
          {isDropped ? <span className="today-priority-card__x">×</span> : null}
        </button>
      ) : (
        <span className="today-priority-card__check today-priority-card__check--new" />
      )}

      <div className="today-priority-card__content">
        <input
          className="today-priority-card__input"
          type="text"
          value={item.title}
          placeholder="What's the focus?"
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={onTitleBlur}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
            e.preventDefault();
            onTitleBlur();
          }}
          aria-label={`Priority ${index + 1} title`}
        />

        {taskOptions.length > 0 ? (
          <select
            className="today-priority-card__task-fill"
            value={taskPickerValue}
            onChange={(e) => handleTaskFill(e.target.value)}
            aria-label={`Fill priority ${index + 1} from today's tasks`}
          >
            <option value="">Use today task…</option>
            {plannedTaskOptions.length > 0 ? (
              <optgroup label="Planned">
                {plannedTaskOptions.map((task) => (
                  <option key={task.id} value={task.id}>{task.title}</option>
                ))}
              </optgroup>
            ) : null}
            {unplannedTaskOptions.length > 0 ? (
              <optgroup label="Unplanned">
                {unplannedTaskOptions.map((task) => (
                  <option key={task.id} value={task.id}>{task.title}</option>
                ))}
              </optgroup>
            ) : null}
          </select>
        ) : null}
      </div>

      {activeGoals.length > 0 ? (
        <select
          className="today-priority-card__goal"
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

      <div className="today-priority-card__actions" ref={menuRef}>
        <button
          className="today-priority-card__more"
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="More actions"
        >
          <MoreIcon />
        </button>
        {menuOpen ? (
          <div className="action-menu">
            {isSaved && item.status === "pending" ? (
              <button className="action-menu__item" type="button"
                onClick={() => { onStatusChange("dropped"); setMenuOpen(false); }}>
                ✗ Drop
              </button>
            ) : null}
            {isSaved && (isDone || isDropped) ? (
              <button className="action-menu__item" type="button"
                onClick={() => { onStatusChange("pending"); setMenuOpen(false); }}>
                ↶ Reopen
              </button>
            ) : null}
            <button className="action-menu__item action-menu__item--danger" type="button"
              onClick={() => { onRemove(); setMenuOpen(false); }}>
              Remove
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
}
