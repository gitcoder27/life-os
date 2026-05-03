import { useEffect, useMemo, useState } from "react";
import {
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useUpsertDayLaunchMutation,
  type DailyLaunchItem,
  type TaskItem,
} from "../../../shared/lib/api";
import { FocusTaskPicker } from "../../../shared/ui/FocusTaskPicker";
import { taskTextAutocompleteProps } from "../../../shared/ui/task-autocomplete";

const ENERGY_LEVELS = [
  { value: "1", label: "Very low", short: "1" },
  { value: "2", label: "Low", short: "2" },
  { value: "3", label: "Steady", short: "3" },
  { value: "4", label: "Good", short: "4" },
  { value: "5", label: "Strong", short: "5" },
] as const;

const DERAILMENT_OPTIONS = [
  { value: "", label: "None" },
  { value: "unclear", label: "Unclear" },
  { value: "too_big", label: "Too big" },
  { value: "avoidance", label: "Avoidance" },
  { value: "low_energy", label: "Low energy" },
  { value: "interrupted", label: "Interrupted" },
  { value: "overloaded", label: "Overloaded" },
] as const;

export function DailyLaunchCard({
  date,
  tasks,
  launch,
  mustWinTask,
}: {
  date: string;
  tasks: Array<Pick<TaskItem, "id" | "title" | "status" | "scheduledForDate">>;
  launch: DailyLaunchItem | null;
  mustWinTask: TaskItem | null;
}) {
  const createTaskMutation = useCreateTaskMutation(date, {
    successMessage: "Daily focus set.",
    errorMessage: "Could not save daily focus.",
  });
  const updateTaskMutation = useUpdateTaskMutation(date);
  const upsertDayLaunchMutation = useUpsertDayLaunchMutation(date);
  const focusTasks = useMemo(() => {
    if (
      !mustWinTask ||
      mustWinTask.status !== "pending" ||
      tasks.some((task) => task.id === mustWinTask.id)
    ) {
      return tasks;
    }

    return [mustWinTask, ...tasks];
  }, [mustWinTask, tasks]);

  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [energyRating, setEnergyRating] = useState("3");
  const [nextAction, setNextAction] = useState("");
  const [likelyDerailmentReason, setLikelyDerailmentReason] = useState("");
  const [likelyDerailmentNote, setLikelyDerailmentNote] = useState("");

  useEffect(() => {
    setSelectedTaskId(mustWinTask?.id ?? launch?.mustWinTaskId ?? "");
    setEnergyRating(launch?.energyRating ? String(launch.energyRating) : "3");
    setNextAction(mustWinTask?.nextAction ?? "");
    setLikelyDerailmentReason(launch?.likelyDerailmentReason ?? "");
    setLikelyDerailmentNote(launch?.likelyDerailmentNote ?? "");
    setNewTaskTitle("");
  }, [launch, mustWinTask]);

  useEffect(() => {
    if (selectedTaskId && !focusTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId("");
    }
  }, [focusTasks, selectedTaskId]);

  async function handleSave() {
    let mustWinTaskId = selectedTaskId || null;
    const selectedTask = mustWinTaskId
      ? focusTasks.find((task) => task.id === mustWinTaskId)
      : null;

    if (!mustWinTaskId && newTaskTitle.trim()) {
      const response = await createTaskMutation.mutateAsync({
        title: newTaskTitle.trim(),
        scheduledForDate: date,
        kind: "task",
        originType: "manual",
        nextAction: nextAction.trim() || null,
      });
      mustWinTaskId = response.task.id;
    }

    if (!mustWinTaskId) {
      return;
    }

    if (selectedTask?.scheduledForDate && selectedTask.scheduledForDate < date) {
      await updateTaskMutation.mutateAsync({
        taskId: mustWinTaskId,
        scheduledForDate: date,
        nextAction: nextAction.trim() || null,
      });
    } else {
      await updateTaskMutation.mutateAsync({
        taskId: mustWinTaskId,
        nextAction: nextAction.trim() || null,
      });
    }

    await upsertDayLaunchMutation.mutateAsync({
      mustWinTaskId,
      energyRating: Number(energyRating),
      likelyDerailmentReason: likelyDerailmentReason ? (likelyDerailmentReason as NonNullable<DailyLaunchItem["likelyDerailmentReason"]>) : null,
      likelyDerailmentNote: likelyDerailmentNote.trim() || null,
    });
  }

  const isBusy =
    createTaskMutation.isPending ||
    updateTaskMutation.isPending ||
    upsertDayLaunchMutation.isPending;

  const canSubmit = Boolean(nextAction.trim() && (selectedTaskId || newTaskTitle.trim()));

  return (
    <section className="daily-launch" aria-labelledby="daily-launch-title">
      <div className="daily-launch__header">
        <div className="daily-launch__heading">
          <span className="daily-launch__eyebrow">Daily focus</span>
          <h2 className="daily-launch__title" id="daily-launch-title">Pick one task to protect.</h2>
        </div>
        <p className="daily-launch__intro">
          Choose the work, name the first step, then start with less noise.
        </p>
      </div>

      <div className="daily-launch__fields">
        <FocusTaskPicker
          id="daily-focus-task"
          label="Task"
          tasks={focusTasks}
          selectedTaskId={selectedTaskId}
          onSelectTaskId={setSelectedTaskId}
          referenceDate={date}
        />

        <div className="daily-launch__primary-fields">
          {!selectedTaskId ? (
            <div className="daily-launch__field">
              <label className="daily-launch__label" htmlFor="dl-new-task">
                New task
              </label>
              <input
                id="dl-new-task"
                className="daily-launch__input"
                {...taskTextAutocompleteProps}
                value={newTaskTitle}
                onChange={(event) => setNewTaskTitle(event.target.value)}
                placeholder="Finish the proposal intro"
              />
            </div>
          ) : null}

          <div className="daily-launch__field">
            <label className="daily-launch__label" htmlFor="dl-next-action">First step</label>
            <input
              id="dl-next-action"
              className="daily-launch__input"
              {...taskTextAutocompleteProps}
              value={nextAction}
              onChange={(event) => setNextAction(event.target.value)}
              placeholder="Open the proposal and write the opening paragraph"
            />
          </div>
        </div>

        <div className="daily-launch__row">
          <div className="daily-launch__field daily-launch__field--compact">
            <span className="daily-launch__label">Energy</span>
            <div className="daily-launch__pills" role="radiogroup" aria-label="Energy rating">
              {ENERGY_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  className={`daily-launch__pill${energyRating === level.value ? " daily-launch__pill--active" : ""}`}
                  onClick={() => setEnergyRating(level.value)}
                  title={level.label}
                  aria-label={`${level.label} energy`}
                  aria-pressed={energyRating === level.value}
                >
                  {level.short}
                </button>
              ))}
            </div>
          </div>

          <div className="daily-launch__field daily-launch__field--compact">
            <span className="daily-launch__label">Likely snag</span>
            <div className="daily-launch__chips">
              {DERAILMENT_OPTIONS.map((option) => (
                <button
                  key={option.value || "none"}
                  type="button"
                  className={`daily-launch__chip${likelyDerailmentReason === option.value ? " daily-launch__chip--active" : ""}`}
                  onClick={() => setLikelyDerailmentReason(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {likelyDerailmentReason ? (
          <div className="daily-launch__field">
            <label className="daily-launch__label" htmlFor="dl-note">Note</label>
            <input
              id="dl-note"
              className="daily-launch__input"
              {...taskTextAutocompleteProps}
              value={likelyDerailmentNote}
              onChange={(event) => setLikelyDerailmentNote(event.target.value)}
              placeholder="Meetings will cut the morning in half"
            />
          </div>
        ) : null}
      </div>

      <div className="daily-launch__footer">
        <button
          className="button button--primary"
          type="button"
          disabled={isBusy || !canSubmit}
          onClick={() => void handleSave()}
        >
          {isBusy ? "Saving..." : "Set daily focus"}
        </button>
      </div>
    </section>
  );
}
