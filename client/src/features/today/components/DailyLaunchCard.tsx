import { useEffect, useMemo, useState } from "react";
import {
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useUpsertDayLaunchMutation,
  type DailyLaunchItem,
  type TaskItem,
} from "../../../shared/lib/api";

const DERAILMENT_OPTIONS = [
  { value: "", label: "No likely derailment" },
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

  return (
    <section className="daily-launch-card">
      <div className="daily-launch-card__header">
        <div>
          <p className="daily-launch-card__eyebrow">Daily Launch</p>
          <h2 className="daily-launch-card__title">Set up the day before it drifts.</h2>
        </div>
      </div>

      <div className="daily-launch-card__grid">
        <label className="field">
          <span>Choose today's must-win</span>
          <select value={selectedTaskId} onChange={(event) => setSelectedTaskId(event.target.value)}>
            <option value="">Create a new must-win below</option>
            {selectableTasks.map((task) => (
              <option key={task.id} value={task.id}>{task.title}</option>
            ))}
          </select>
        </label>

        {!selectedTaskId ? (
          <label className="field">
            <span>New must-win</span>
            <input value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} placeholder="Finish the proposal intro" />
          </label>
        ) : null}

        <label className="field">
          <span>First visible step</span>
          <input value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="Open the proposal and write the opening paragraph" />
        </label>

        <label className="field">
          <span>Energy</span>
          <select value={energyRating} onChange={(event) => setEnergyRating(event.target.value)}>
            <option value="1">1 - Very low</option>
            <option value="2">2 - Low</option>
            <option value="3">3 - Steady</option>
            <option value="4">4 - Good</option>
            <option value="5">5 - Strong</option>
          </select>
        </label>

        <label className="field">
          <span>Likely derailment</span>
          <select value={likelyDerailmentReason} onChange={(event) => setLikelyDerailmentReason(event.target.value)}>
            {DERAILMENT_OPTIONS.map((option) => (
              <option key={option.value || "none"} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Note</span>
          <input value={likelyDerailmentNote} onChange={(event) => setLikelyDerailmentNote(event.target.value)} placeholder="Meetings will cut the morning in half" />
        </label>
      </div>

      <div className="daily-launch-card__actions">
        <button
          className="button button--primary"
          type="button"
          disabled={isBusy || !nextAction.trim() || (!selectedTaskId && !newTaskTitle.trim())}
          onClick={() => void handleSave()}
        >
          {isBusy ? "Saving..." : "Complete launch"}
        </button>
      </div>
    </section>
  );
}
