import { useEffect, useMemo, useState } from "react";
import {
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useUpsertDayLaunchMutation,
  type DailyLaunchItem,
  type TaskItem,
} from "../../../shared/lib/api";

const ENERGY_LEVELS = [
  { value: "1", label: "Very low", short: "1" },
  { value: "2", label: "Low", short: "2" },
  { value: "3", label: "Steady", short: "3" },
  { value: "4", label: "Good", short: "4" },
  { value: "5", label: "Strong", short: "5" },
] as const;

const DERAILMENT_OPTIONS = [
  { value: "", label: "None" },
  { value: "unclear", label: "Unclear task" },
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
  tasks: Array<Pick<TaskItem, "id" | "title" | "status">>;
  launch: DailyLaunchItem | null;
  mustWinTask: TaskItem | null;
}) {
  const createTaskMutation = useCreateTaskMutation(date, {
    successMessage: "Must-win created.",
    errorMessage: "Could not create must-win.",
  });
  const updateTaskMutation = useUpdateTaskMutation(date);
  const upsertDayLaunchMutation = useUpsertDayLaunchMutation(date);

  const selectableTasks = useMemo(
    () => tasks.filter((task) => task.status === "pending"),
    [tasks],
  );
  const hasSelectableTasks = selectableTasks.length > 0;
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

  async function handleSave() {
    let mustWinTaskId = selectedTaskId || null;

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

    await updateTaskMutation.mutateAsync({
      taskId: mustWinTaskId,
      nextAction: nextAction.trim() || null,
    });

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

  const canSubmit = Boolean(selectedTaskId || newTaskTitle.trim());

  return (
    <section className="daily-launch" aria-labelledby="daily-launch-title">
      <div className="daily-launch__header">
        <div className="daily-launch__heading">
          <span className="daily-launch__eyebrow">Daily setup</span>
          <h2 className="daily-launch__title" id="daily-launch-title">Choose today's anchor.</h2>
        </div>
        <p className="daily-launch__intro">
          Keep the queue visible. Mark the one task that deserves protection, then continue working.
        </p>
      </div>

      <div className="daily-launch__fields">
        <div className="daily-launch__primary-fields">
          {hasSelectableTasks ? (
            <div className="daily-launch__field">
              <label className="daily-launch__label" htmlFor="dl-must-win">Anchor task</label>
              <select
                id="dl-must-win"
                className="daily-launch__select"
                value={selectedTaskId}
                onChange={(event) => setSelectedTaskId(event.target.value)}
              >
                <option value="">Create a new task below</option>
                {selectableTasks.map((task) => (
                  <option key={task.id} value={task.id}>{task.title}</option>
                ))}
              </select>
            </div>
          ) : null}

          {!selectedTaskId ? (
            <div className="daily-launch__field">
              <label className="daily-launch__label" htmlFor="dl-new-task">
                {hasSelectableTasks ? "New anchor" : "Anchor task"}
              </label>
              <input
                id="dl-new-task"
                className="daily-launch__input"
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
              value={likelyDerailmentNote}
              onChange={(event) => setLikelyDerailmentNote(event.target.value)}
              placeholder="Meetings will cut the morning in half"
            />
          </div>
        ) : null}
      </div>

      <div className="daily-launch__footer">
        <p className="daily-launch__hint">
          Optional, but useful when the day is noisy.
        </p>
        <button
          className="button button--primary"
          type="button"
          disabled={isBusy || !canSubmit}
          onClick={() => void handleSave()}
        >
          {isBusy ? "Saving..." : "Set today's anchor"}
        </button>
      </div>
    </section>
  );
}
