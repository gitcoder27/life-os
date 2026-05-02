import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useUpsertDayLaunchMutation,
  type DailyLaunchItem,
  type LinkedGoal,
  type TaskItem,
} from "../../shared/lib/api";
import { taskTextAutocompleteProps } from "../../shared/ui/task-autocomplete";
import { StartProtocolSheet } from "../today/components/StartProtocolSheet";
import { StuckFlowSheet } from "../today/components/StuckFlowSheet";

type TimePhase = "morning" | "midday" | "evening";

type FocusStageProps = {
  date: string;
  phase: TimePhase;
  mustWinTask: TaskItem | null;
  launch: DailyLaunchItem | null;
  topPriority: {
    slot: number;
    title: string;
    goal: LinkedGoal | null;
  } | null;
  openTaskCount: number;
  nextTimedTask: { title: string; timeLabel: string } | null;
  executionTasks: Array<Pick<TaskItem, "id" | "title" | "status">>;
};

const ENERGY_LEVELS = [
  { value: "1", short: "1", label: "Very low" },
  { value: "2", short: "2", label: "Low" },
  { value: "3", short: "3", label: "Steady" },
  { value: "4", short: "4", label: "Good" },
  { value: "5", short: "5", label: "Strong" },
] as const;

const DERAILMENTS = [
  { value: "", label: "None" },
  { value: "unclear", label: "Unclear" },
  { value: "too_big", label: "Too big" },
  { value: "avoidance", label: "Avoidance" },
  { value: "low_energy", label: "Low energy" },
  { value: "interrupted", label: "Interrupted" },
  { value: "overloaded", label: "Overloaded" },
] as const;

function eyebrowFor(phase: TimePhase, hasMustWin: boolean, setupDone: boolean, rescueActive: boolean) {
  if (rescueActive) return "Reduced day";
  if (!setupDone) {
    if (phase === "morning") return "Morning";
    if (phase === "midday") return "Afternoon setup";
    return "Evening";
  }
  if (!hasMustWin) {
    if (phase === "evening") return "Close the day";
    return "Today";
  }
  if (phase === "evening") return "Close this out";
  if (phase === "midday") return "Stay the course";
  return "Your focus";
}

export function FocusStage({
  date,
  phase,
  mustWinTask,
  launch,
  topPriority,
  openTaskCount,
  nextTimedTask,
  executionTasks,
}: FocusStageProps) {
  const setupDone = Boolean(launch?.completedAt);
  const rescueActive = launch?.dayMode === "rescue" || launch?.dayMode === "recovery";
  const eyebrow = eyebrowFor(phase, Boolean(mustWinTask), setupDone, rescueActive);

  if (!setupDone) {
    return (
      <FocusStageSetup
        date={date}
        phase={phase}
        eyebrow={eyebrow}
        launch={launch}
        mustWinTask={mustWinTask}
        executionTasks={executionTasks}
      />
    );
  }

  if (mustWinTask) {
    return (
      <FocusStageActive
        date={date}
        eyebrow={eyebrow}
        mustWinTask={mustWinTask}
      />
    );
  }

  return (
    <FocusStageEmpty
      eyebrow={eyebrow}
      phase={phase}
      topPriority={topPriority}
      openTaskCount={openTaskCount}
      nextTimedTask={nextTimedTask}
    />
  );
}

/* ─────────────────────────────────────────────────────
   Variant: must-win is set and setup complete
   ───────────────────────────────────────────────────── */

function FocusStageActive({
  date,
  eyebrow,
  mustWinTask,
}: {
  date: string;
  eyebrow: string;
  mustWinTask: TaskItem;
}) {
  const updateTaskMutation = useUpdateTaskMutation(date);
  const [protocolOpen, setProtocolOpen] = useState(false);
  const [stuckOpen, setStuckOpen] = useState(false);

  const isCompleted = mustWinTask.status === "completed";
  const isStarted =
    mustWinTask.progressState === "started" ||
    mustWinTask.progressState === "advanced" ||
    isCompleted;
  const isAdvanced = mustWinTask.progressState === "advanced" || isCompleted;

  const stateLabel = isCompleted
    ? "Complete"
    : mustWinTask.progressState === "advanced"
      ? "In progress"
      : mustWinTask.progressState === "started"
        ? "Started"
        : "Ready";

  return (
    <>
      <div className="focus-stage focus-stage--active">
        <div className="focus-stage__lede">
          <span className="focus-stage__eyebrow">{eyebrow}</span>
          <h2 className="focus-stage__headline">{mustWinTask.title}</h2>
          {mustWinTask.goal ? (
            <span className="focus-stage__goal">
              <span className={`focus-stage__goal-dot focus-stage__goal-dot--${mustWinTask.goal.domain}`} />
              {mustWinTask.goal.title}
            </span>
          ) : null}
        </div>

        <div className="focus-stage__next">
          <span className="focus-stage__next-label">Next action</span>
          <p className="focus-stage__next-text">
            {mustWinTask.nextAction ?? "Define the first visible step."}
          </p>
          <span className={`focus-stage__pill focus-stage__pill--${isCompleted ? "completed" : mustWinTask.progressState}`}>
            {stateLabel}
          </span>
        </div>

        <div className="focus-stage__actions">
          {!isStarted ? (
            <button
              className="focus-stage__cta"
              type="button"
              disabled={updateTaskMutation.isPending}
              onClick={() =>
                updateTaskMutation.mutate({
                  taskId: mustWinTask.id,
                  progressState: "started",
                  startedAt: mustWinTask.startedAt ?? new Date().toISOString(),
                })
              }
            >
              Start
            </button>
          ) : null}

          {isStarted && !isAdvanced && !isCompleted ? (
            <button
              className="focus-stage__cta"
              type="button"
              disabled={updateTaskMutation.isPending}
              onClick={() =>
                updateTaskMutation.mutate({
                  taskId: mustWinTask.id,
                  progressState: "advanced",
                  startedAt: mustWinTask.startedAt ?? new Date().toISOString(),
                })
              }
            >
              Mark progress
            </button>
          ) : null}

          {!isCompleted ? (
            <button
              className="focus-stage__action"
              type="button"
              disabled={updateTaskMutation.isPending}
              onClick={() =>
                updateTaskMutation.mutate({
                  taskId: mustWinTask.id,
                  status: "completed",
                  progressState: "advanced",
                  startedAt: mustWinTask.startedAt ?? new Date().toISOString(),
                })
              }
            >
              Complete
            </button>
          ) : null}

          <button
            className="focus-stage__action focus-stage__action--subtle"
            type="button"
            onClick={() => setProtocolOpen(true)}
          >
            Protocol
          </button>

          {!isCompleted ? (
            <button
              className="focus-stage__action focus-stage__action--subtle"
              type="button"
              onClick={() => setStuckOpen(true)}
            >
              I&apos;m stuck
            </button>
          ) : null}
        </div>
      </div>

      <StartProtocolSheet
        open={protocolOpen}
        date={date}
        task={mustWinTask}
        onClose={() => setProtocolOpen(false)}
      />
      <StuckFlowSheet
        open={stuckOpen}
        date={date}
        task={mustWinTask}
        onClose={() => setStuckOpen(false)}
      />
    </>
  );
}

/* ─────────────────────────────────────────────────────
   Variant: setup not complete — progressive disclosure
   ───────────────────────────────────────────────────── */

function FocusStageSetup({
  date,
  phase,
  eyebrow,
  launch,
  mustWinTask,
  executionTasks,
}: {
  date: string;
  phase: TimePhase;
  eyebrow: string;
  launch: DailyLaunchItem | null;
  mustWinTask: TaskItem | null;
  executionTasks: Array<Pick<TaskItem, "id" | "title" | "status">>;
}) {
  const [expanded, setExpanded] = useState(false);

  const createTaskMutation = useCreateTaskMutation(date, {
    successMessage: "Focus set.",
    errorMessage: "Could not save focus.",
  });
  const updateTaskMutation = useUpdateTaskMutation(date);
  const upsertDayLaunchMutation = useUpsertDayLaunchMutation(date);

  const selectableTasks = useMemo(
    () => executionTasks.filter((task) => task.status === "pending"),
    [executionTasks],
  );

  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [energyRating, setEnergyRating] = useState("3");
  const [nextAction, setNextAction] = useState("");
  const [derailReason, setDerailReason] = useState("");

  useEffect(() => {
    setSelectedTaskId(mustWinTask?.id ?? launch?.mustWinTaskId ?? "");
    setEnergyRating(launch?.energyRating ? String(launch.energyRating) : "3");
    setNextAction(mustWinTask?.nextAction ?? "");
    setDerailReason(launch?.likelyDerailmentReason ?? "");
    setNewTaskTitle("");
  }, [launch, mustWinTask]);

  const isBusy =
    createTaskMutation.isPending ||
    updateTaskMutation.isPending ||
    upsertDayLaunchMutation.isPending;

  const canSubmit = nextAction.trim() && (selectedTaskId || newTaskTitle.trim());

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

    if (!mustWinTaskId) return;

    await updateTaskMutation.mutateAsync({
      taskId: mustWinTaskId,
      nextAction: nextAction.trim() || null,
    });

    await upsertDayLaunchMutation.mutateAsync({
      mustWinTaskId,
      energyRating: Number(energyRating),
      likelyDerailmentReason: derailReason
        ? (derailReason as NonNullable<DailyLaunchItem["likelyDerailmentReason"]>)
        : null,
    });
  }

  const headline =
    phase === "evening"
      ? "Ready to close the day."
      : phase === "midday"
        ? "Set a focus for the afternoon."
        : "Pick the one thing worth protecting.";

  const subline =
    phase === "evening"
      ? "A light setup keeps tomorrow coherent."
      : "Choose one task, the first visible step, and what might get in the way.";

  return (
    <div className={`focus-stage focus-stage--setup${expanded ? " focus-stage--expanded" : ""}`}>
      <div className="focus-stage__lede">
        <span className="focus-stage__eyebrow">{eyebrow}</span>
        <h2 className="focus-stage__headline">{headline}</h2>
        <p className="focus-stage__subline">{subline}</p>
      </div>

      {!expanded ? (
        <div className="focus-stage__actions">
          <button
            type="button"
            className="focus-stage__cta"
            onClick={() => setExpanded(true)}
          >
            {launch ? "Continue setup" : "Begin setup"}
          </button>
          <Link to="/today" className="focus-stage__action focus-stage__action--subtle">
            Open Today
          </Link>
        </div>
      ) : (
        <div className="focus-stage__setup">
          <div className="focus-stage__field">
            <label className="focus-stage__field-label" htmlFor="fs-task">Focus</label>
            <select
              id="fs-task"
              className="focus-stage__select"
              value={selectedTaskId}
              onChange={(event) => setSelectedTaskId(event.target.value)}
            >
              <option value="">Create something new…</option>
              {selectableTasks.map((task) => (
                <option key={task.id} value={task.id}>{task.title}</option>
              ))}
            </select>
          </div>

          {!selectedTaskId ? (
            <div className="focus-stage__field">
              <label className="focus-stage__field-label" htmlFor="fs-new">New task</label>
              <input
                id="fs-new"
                className="focus-stage__input"
                {...taskTextAutocompleteProps}
                placeholder="Finish the proposal intro"
                value={newTaskTitle}
                onChange={(event) => setNewTaskTitle(event.target.value)}
              />
            </div>
          ) : null}

          <div className="focus-stage__field">
            <label className="focus-stage__field-label" htmlFor="fs-next">First step</label>
            <input
              id="fs-next"
              className="focus-stage__input"
              {...taskTextAutocompleteProps}
              placeholder="Open the doc and draft the opening line"
              value={nextAction}
              onChange={(event) => setNextAction(event.target.value)}
            />
          </div>

          <div className="focus-stage__row">
            <div className="focus-stage__field">
              <span className="focus-stage__field-label">Energy</span>
              <div className="focus-stage__pills" role="radiogroup" aria-label="Energy">
                {ENERGY_LEVELS.map((level) => (
                  <button
                    key={level.value}
                    type="button"
                    title={level.label}
                    aria-label={`${level.label} energy`}
                    aria-pressed={energyRating === level.value}
                    className={`focus-stage__pill-btn${energyRating === level.value ? " focus-stage__pill-btn--active" : ""}`}
                    onClick={() => setEnergyRating(level.value)}
                  >
                    {level.short}
                  </button>
                ))}
              </div>
            </div>

            <div className="focus-stage__field">
              <span className="focus-stage__field-label">Likely snag</span>
              <div className="focus-stage__chips">
                {DERAILMENTS.map((opt) => (
                  <button
                    key={opt.value || "none"}
                    type="button"
                    className={`focus-stage__chip${derailReason === opt.value ? " focus-stage__chip--active" : ""}`}
                    onClick={() => setDerailReason(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="focus-stage__actions">
            <button
              className="focus-stage__cta"
              type="button"
              disabled={isBusy || !canSubmit}
              onClick={() => void handleSave()}
            >
              {isBusy ? "Saving…" : "Set focus"}
            </button>
            <button
              type="button"
              className="focus-stage__action focus-stage__action--subtle"
              onClick={() => setExpanded(false)}
            >
              Later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   Variant: setup done but no must-win (rare)
   ───────────────────────────────────────────────────── */

function FocusStageEmpty({
  eyebrow,
  phase,
  topPriority,
  openTaskCount,
  nextTimedTask,
}: {
  eyebrow: string;
  phase: TimePhase;
  topPriority: FocusStageProps["topPriority"];
  openTaskCount: number;
  nextTimedTask: FocusStageProps["nextTimedTask"];
}) {
  const headline = topPriority
    ? topPriority.title
    : openTaskCount > 0
      ? `${openTaskCount} task${openTaskCount > 1 ? "s" : ""} on the table`
      : phase === "evening"
        ? "Ready to close the day."
        : "All clear.";

  const subline = topPriority
    ? "Your first block of attention goes here."
    : openTaskCount > 0
      ? "Pick one believable move and let the rest wait."
      : phase === "evening"
        ? "Nothing urgent. Use the quiet to close cleanly."
        : "You have room. Set a direction before the day fills itself.";

  const cta = phase === "evening" ? "Close the day" : "Open Today";

  return (
    <div className="focus-stage focus-stage--empty">
      <div className="focus-stage__lede">
        <span className="focus-stage__eyebrow">{eyebrow}</span>
        <h2 className="focus-stage__headline">{headline}</h2>
        <p className="focus-stage__subline">{subline}</p>

        {topPriority?.goal ? (
          <span className="focus-stage__goal">
            <span className={`focus-stage__goal-dot focus-stage__goal-dot--${topPriority.goal.domain}`} />
            {topPriority.goal.title}
          </span>
        ) : null}
      </div>

      {nextTimedTask ? (
        <div className="focus-stage__next focus-stage__next--soft">
          <span className="focus-stage__next-label">Next up</span>
          <p className="focus-stage__next-text">
            {nextTimedTask.timeLabel} · {nextTimedTask.title}
          </p>
        </div>
      ) : null}

      <div className="focus-stage__actions">
        <Link to="/today" className="focus-stage__cta">
          {cta}
        </Link>
      </div>
    </div>
  );
}
