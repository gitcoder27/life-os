import { useEffect, useMemo, useState } from "react";

import {
  getTodayDate,
  toIsoDate,
  useGoalsListQuery,
  useInboxQuery,
  useUpdateTaskMutation,
  type LinkedGoal,
  type TaskItem,
} from "../../shared/lib/api";
import {
  getQuickCaptureDisplayText,
  getQuickCaptureText,
  parseQuickCaptureNotes,
  stringifyQuickCaptureNotes,
  syncQuickCaptureReminderDate,
} from "../../shared/lib/quickCapture";
import { PageHeader } from "../../shared/ui/PageHeader";
import {
  EmptyState,
  InlineErrorState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import { SectionCard } from "../../shared/ui/SectionCard";

type InboxFilter = "all" | "task" | "note" | "reminder";

const filterOptions: Array<{ id: InboxFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "task", label: "Tasks" },
  { id: "note", label: "Notes" },
  { id: "reminder", label: "Reminders" },
];

function getTomorrowDate(isoDate: string) {
  const tomorrow = new Date(`${isoDate}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toIsoDate(tomorrow);
}

function getInboxItemKind(task: TaskItem): Exclude<InboxFilter, "all"> {
  const parsed = parseQuickCaptureNotes(task.notes);
  return parsed?.kind ?? "task";
}

function formatCreatedAt(isoDateTime: string) {
  const date = new Date(isoDateTime);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getKindLabel(kind: Exclude<InboxFilter, "all">) {
  switch (kind) {
    case "note":
      return "Note";
    case "reminder":
      return "Reminder";
    default:
      return "Task";
  }
}

function getKindTagClass(kind: Exclude<InboxFilter, "all">) {
  switch (kind) {
    case "note":
      return "tag tag--neutral";
    case "reminder":
      return "tag tag--warning";
    default:
      return "tag tag--positive";
  }
}

function GoalChip({ goal }: { goal: LinkedGoal }) {
  return (
    <span className="goal-chip">
      <span className={`goal-chip__dot goal-chip__dot--${goal.domain}`} />
      <span>{goal.title}</span>
    </span>
  );
}

export function InboxPage() {
  const today = getTodayDate();
  const tomorrow = getTomorrowDate(today);
  const inboxQuery = useInboxQuery();
  const goalsListQuery = useGoalsListQuery();
  const updateTaskMutation = useUpdateTaskMutation(today);
  const [activeFilter, setActiveFilter] = useState<InboxFilter>("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState(tomorrow);
  const [selectedGoalId, setSelectedGoalId] = useState("");

  const activeGoals = useMemo(
    () => (goalsListQuery.data?.goals ?? []).filter((goal) => goal.status === "active"),
    [goalsListQuery.data],
  );

  const inboxItems = useMemo(
    () =>
      [...(inboxQuery.data?.tasks ?? [])].sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      ),
    [inboxQuery.data?.tasks],
  );

  const filteredItems = useMemo(
    () =>
      inboxItems.filter((item) => {
        if (activeFilter === "all") {
          return true;
        }

        return getInboxItemKind(item) === activeFilter;
      }),
    [activeFilter, inboxItems],
  );

  const selectedTask = filteredItems.find((item) => item.id === selectedTaskId) ?? filteredItems[0] ?? null;
  const selectedTaskKind = selectedTask ? getInboxItemKind(selectedTask) : null;
  const selectedTaskMeta = selectedTask ? parseQuickCaptureNotes(selectedTask.notes) : null;
  const selectedTaskText = selectedTask
    ? getQuickCaptureText(selectedTask.notes, selectedTask.notes?.trim() || selectedTask.title)
    : "";

  useEffect(() => {
    const nextId = filteredItems[0]?.id ?? null;

    if (!selectedTaskId || !filteredItems.some((item) => item.id === selectedTaskId)) {
      setSelectedTaskId(nextId);
    }
  }, [filteredItems, selectedTaskId]);

  useEffect(() => {
    if (!selectedTask) {
      setScheduleDate(tomorrow);
      setSelectedGoalId("");
      return;
    }

    setScheduleDate(selectedTaskMeta?.reminderDate ?? selectedTask.scheduledForDate ?? tomorrow);
    setSelectedGoalId(selectedTask.goalId ?? "");
  }, [selectedTask, selectedTaskMeta?.reminderDate, tomorrow]);

  const counts = useMemo(
    () => ({
      all: inboxItems.length,
      task: inboxItems.filter((item) => getInboxItemKind(item) === "task").length,
      note: inboxItems.filter((item) => getInboxItemKind(item) === "note").length,
      reminder: inboxItems.filter((item) => getInboxItemKind(item) === "reminder").length,
    }),
    [inboxItems],
  );

  const mutationError = updateTaskMutation.error instanceof Error ? updateTaskMutation.error.message : null;
  const retryAll = () => {
    void inboxQuery.refetch();
    void goalsListQuery.refetch();
  };

  function buildScheduledNotes(task: TaskItem, targetDate: string) {
    return getInboxItemKind(task) === "reminder"
      ? syncQuickCaptureReminderDate(task.notes, targetDate)
      : task.notes;
  }

  function handleDoToday() {
    if (!selectedTask) {
      return;
    }

    updateTaskMutation.mutate({
      taskId: selectedTask.id,
      scheduledForDate: today,
      notes: buildScheduledNotes(selectedTask, today),
    });
  }

  function handleSchedule() {
    if (!selectedTask || !scheduleDate) {
      return;
    }

    updateTaskMutation.mutate({
      taskId: selectedTask.id,
      scheduledForDate: scheduleDate,
      notes: buildScheduledNotes(selectedTask, scheduleDate),
    });
  }

  function handleLinkGoal() {
    if (!selectedTask) {
      return;
    }

    updateTaskMutation.mutate({
      taskId: selectedTask.id,
      goalId: selectedGoalId || null,
    });
  }

  function handleConvertToNote() {
    if (!selectedTask) {
      return;
    }

    updateTaskMutation.mutate({
      taskId: selectedTask.id,
      notes: stringifyQuickCaptureNotes({
        kind: "note",
        text: selectedTaskText || selectedTask.title,
      }),
    });
  }

  function handleArchive() {
    if (!selectedTask) {
      return;
    }

    updateTaskMutation.mutate({
      taskId: selectedTask.id,
      status: "dropped",
    });
  }

  if (inboxQuery.isLoading && !inboxQuery.data) {
    return (
      <PageLoadingState
        title="Loading inbox"
        description="Collecting captured tasks, notes, and reminders so you can triage them calmly."
      />
    );
  }

  if (inboxQuery.isError || !inboxQuery.data) {
    return (
      <PageErrorState
        title="Inbox unavailable"
        message={inboxQuery.error instanceof Error ? inboxQuery.error.message : undefined}
        onRetry={retryAll}
      />
    );
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Capture triage"
        title="Inbox"
        description="Everything captured lands here first. Decide what belongs on Today, what should be scheduled later, and what should stay as reference."
      />

      {mutationError ? <InlineErrorState message={mutationError} onRetry={retryAll} /> : null}

      <section className="inbox-summary">
        <div className="inbox-summary__headline">
          <span className="inbox-summary__count">{counts.all}</span>
          <div>
            <p className="inbox-summary__label">Pending capture items</p>
            <p className="inbox-summary__copy">Keep capture friction low. Add structure only when you triage.</p>
          </div>
        </div>
        <div className="inbox-summary__stats">
          <span>Tasks {counts.task}</span>
          <span>Notes {counts.note}</span>
          <span>Reminders {counts.reminder}</span>
        </div>
      </section>

      <div className="two-column-grid inbox-grid">
        <SectionCard
          className="inbox-panel inbox-panel--queue"
          title={`Queue (${filteredItems.length})`}
          subtitle="Newest captures first. Filter the lane, then open one item at a time."
        >
          <div className="inbox-filter-bar" role="tablist" aria-label="Inbox filters">
            {filterOptions.map((option) => (
              <button
                key={option.id}
                className={`inbox-filter${activeFilter === option.id ? " inbox-filter--active" : ""}`}
                type="button"
                onClick={() => setActiveFilter(option.id)}
              >
                <span>{option.label}</span>
                <strong>{counts[option.id]}</strong>
              </button>
            ))}
          </div>

          {filteredItems.length > 0 ? (
            <ul className="inbox-list">
              {filteredItems.map((item) => {
                const itemKind = getInboxItemKind(item);
                const itemMeta = parseQuickCaptureNotes(item.notes);
                const isSelected = item.id === selectedTask?.id;
                const preview = getQuickCaptureDisplayText(item.notes, item.title);

                return (
                  <li key={item.id}>
                    <button
                      className={`inbox-item${isSelected ? " inbox-item--active" : ""}`}
                      type="button"
                      onClick={() => setSelectedTaskId(item.id)}
                    >
                      <div className="inbox-item__topline">
                        <span className={getKindTagClass(itemKind)}>{getKindLabel(itemKind)}</span>
                        <span className="inbox-item__time">{formatCreatedAt(item.createdAt)}</span>
                      </div>
                      <strong className="inbox-item__title">{preview}</strong>
                      <div className="inbox-item__meta">
                        {itemMeta?.reminderDate ? <span>Reminder date {itemMeta.reminderDate}</span> : null}
                        {item.goal ? <GoalChip goal={item.goal} /> : <span>Unlinked</span>}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              title="Inbox is clear"
              description="Nothing is waiting for triage right now. Use Quick Capture to drop something in."
            />
          )}
        </SectionCard>

        <SectionCard
          className="inbox-panel inbox-panel--detail"
          title={selectedTask ? "Inspector" : "Triage"}
          subtitle={
            selectedTask
              ? "Promote, schedule, link, convert, or archive without leaving the queue."
              : "Select an item to decide where it belongs."
          }
        >
          {selectedTask ? (
            <div className="inbox-detail">
              <div className="inbox-detail__hero">
                <div className="inbox-detail__hero-main">
                  <span className={getKindTagClass(selectedTaskKind ?? "task")}>
                    {getKindLabel(selectedTaskKind ?? "task")}
                  </span>
                  {selectedTask.goal ? <GoalChip goal={selectedTask.goal} /> : null}
                </div>
                <span className="inbox-detail__time">Captured {formatCreatedAt(selectedTask.createdAt)}</span>
              </div>

              <div className="inbox-detail__content">
                <h2 className="inbox-detail__title">{getQuickCaptureDisplayText(selectedTask.notes, selectedTask.title)}</h2>
                <p className="inbox-detail__body">{selectedTaskText || "No detail saved for this capture."}</p>
              </div>

              <div className="inbox-detail__meta-grid">
                <div>
                  <span className="inbox-detail__meta-label">Status</span>
                  <strong>Pending triage</strong>
                </div>
                <div>
                  <span className="inbox-detail__meta-label">Reminder date</span>
                  <strong>{selectedTaskMeta?.reminderDate ?? "None"}</strong>
                </div>
                <div>
                  <span className="inbox-detail__meta-label">Goal link</span>
                  <strong>{selectedTask.goal?.title ?? "None"}</strong>
                </div>
                <div>
                  <span className="inbox-detail__meta-label">Execution date</span>
                  <strong>{selectedTask.scheduledForDate ?? "Not scheduled"}</strong>
                </div>
              </div>

              <div className="inbox-detail__actions">
                <div className="inbox-action-block">
                  <div className="inbox-action-block__header">
                    <h3>Promote</h3>
                    <p>Move only the captures that deserve execution space.</p>
                  </div>
                  <div className="button-row button-row--wrap inbox-action-row">
                    <button
                      className="button button--primary"
                      type="button"
                      onClick={handleDoToday}
                      disabled={updateTaskMutation.isPending}
                    >
                      Do today
                    </button>
                    <label className="field inbox-schedule-field">
                      <span>Schedule date</span>
                      <input
                        type="date"
                        min={today}
                        value={scheduleDate}
                        onChange={(event) => setScheduleDate(event.target.value)}
                      />
                    </label>
                    <button
                      className="button button--ghost"
                      type="button"
                      onClick={handleSchedule}
                      disabled={updateTaskMutation.isPending || !scheduleDate}
                    >
                      Schedule
                    </button>
                  </div>
                </div>

                <div className="inbox-action-block">
                  <div className="inbox-action-block__header">
                    <h3>Organize</h3>
                    <p>Attach context before this item leaves the queue.</p>
                  </div>
                  <div className="button-row button-row--wrap inbox-action-row">
                    <label className="field inbox-goal-field">
                      <span>Linked goal</span>
                      <select
                        value={selectedGoalId}
                        onChange={(event) => setSelectedGoalId(event.target.value)}
                        disabled={goalsListQuery.isLoading}
                      >
                        <option value="">No goal</option>
                        {activeGoals.map((goal) => (
                          <option key={goal.id} value={goal.id}>
                            {goal.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="button button--ghost"
                      type="button"
                      onClick={handleLinkGoal}
                      disabled={updateTaskMutation.isPending}
                    >
                      Link to goal
                    </button>
                    {selectedTaskKind === "task" ? (
                      <button
                        className="button button--ghost"
                        type="button"
                        onClick={handleConvertToNote}
                        disabled={updateTaskMutation.isPending}
                      >
                        Convert to note
                      </button>
                    ) : null}
                    <button
                      className="button button--ghost"
                      type="button"
                      onClick={handleArchive}
                      disabled={updateTaskMutation.isPending}
                    >
                      Archive
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              title="Select an item"
              description="Choose a captured task, note, or reminder from the queue to triage it."
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
