import { useEffect, useMemo, useRef, useState } from "react";

import { useAppFeedback } from "../../app/providers";
import {
  getTodayDate,
  toIsoDate,
  useBulkUpdateTasksMutation,
  useGoalsListQuery,
  useInboxQuery,
  useUpdateTaskMutation,
  type BulkUpdateTasksInput,
  type LinkedGoal,
  type TaskItem,
} from "../../shared/lib/api";
import {
  getQuickCaptureDisplayText,
  getQuickCaptureText,
} from "../../shared/lib/quickCapture";
import { PageHeader } from "../../shared/ui/PageHeader";
import {
  EmptyState,
  InlineErrorState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import { SectionCard } from "../../shared/ui/SectionCard";
import { WorkflowTemplatesSection } from "./WorkflowTemplatesSection";

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
  return task.kind;
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

function getBulkSuccessMessage(
  action: BulkUpdateTasksInput["action"],
  taskCount: number,
  goalTitle?: string,
) {
  if (action.type === "schedule") {
    const label = action.scheduledForDate === getTodayDate() ? "Moved" : "Scheduled";
    return `${label} ${taskCount} inbox item${taskCount === 1 ? "" : "s"}.`;
  }

  if (action.type === "link_goal") {
    if (!action.goalId) {
      return `Removed the goal link from ${taskCount} inbox item${taskCount === 1 ? "" : "s"}.`;
    }

    return `Linked ${taskCount} inbox item${taskCount === 1 ? "" : "s"} to ${goalTitle ?? "the selected goal"}.`;
  }

  return `Archived ${taskCount} inbox item${taskCount === 1 ? "" : "s"}.`;
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
  const { pushFeedback } = useAppFeedback();
  const inboxQuery = useInboxQuery();
  const goalsListQuery = useGoalsListQuery();
  const updateTaskMutation = useUpdateTaskMutation(today);
  const bulkSuccessMessageRef = useRef("Inbox updated.");
  const bulkUpdateTasksMutation = useBulkUpdateTasksMutation(today, {
    onSuccess: () => {
      setSelectedTaskIds([]);
      pushFeedback(bulkSuccessMessageRef.current, "success");
    },
  });
  const [activeFilter, setActiveFilter] = useState<InboxFilter>("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState(tomorrow);
  const [selectedGoalId, setSelectedGoalId] = useState("");
  const [bulkScheduleDate, setBulkScheduleDate] = useState(tomorrow);
  const [bulkGoalId, setBulkGoalId] = useState("");

  const activeGoals = useMemo(
    () => (goalsListQuery.data?.goals ?? []).filter((goal) => goal.status === "active"),
    [goalsListQuery.data],
  );

  const goalTitleById = useMemo(
    () => new Map(activeGoals.map((goal) => [goal.id, goal.title])),
    [activeGoals],
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
  const selectedTaskText = selectedTask ? getQuickCaptureText(selectedTask, selectedTask.title) : "";
  const selectedTaskIdsSet = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds]);
  const bulkSelectedItems = filteredItems.filter((item) => selectedTaskIdsSet.has(item.id));
  const hasBulkSelection = bulkSelectedItems.length > 0;
  const allFilteredItemsSelected =
    filteredItems.length > 0 && filteredItems.every((item) => selectedTaskIdsSet.has(item.id));

  useEffect(() => {
    const nextId = filteredItems[0]?.id ?? null;

    if (!selectedTaskId || !filteredItems.some((item) => item.id === selectedTaskId)) {
      setSelectedTaskId(nextId);
    }
  }, [filteredItems, selectedTaskId]);

  useEffect(() => {
    const visibleIds = new Set(filteredItems.map((item) => item.id));

    setSelectedTaskIds((current) => current.filter((taskId) => visibleIds.has(taskId)));
  }, [filteredItems]);

  useEffect(() => {
    if (!selectedTask) {
      setScheduleDate(tomorrow);
      setSelectedGoalId("");
      return;
    }

    setScheduleDate(selectedTask.reminderDate ?? selectedTask.scheduledForDate ?? tomorrow);
    setSelectedGoalId(selectedTask.goalId ?? "");
  }, [selectedTask, tomorrow]);

  const counts = useMemo(
    () => ({
      all: inboxItems.length,
      task: inboxItems.filter((item) => getInboxItemKind(item) === "task").length,
      note: inboxItems.filter((item) => getInboxItemKind(item) === "note").length,
      reminder: inboxItems.filter((item) => getInboxItemKind(item) === "reminder").length,
    }),
    [inboxItems],
  );

  const mutationError =
    updateTaskMutation.error instanceof Error
      ? updateTaskMutation.error.message
      : bulkUpdateTasksMutation.error instanceof Error
        ? bulkUpdateTasksMutation.error.message
        : null;
  const isMutating = updateTaskMutation.isPending || bulkUpdateTasksMutation.isPending;
  const retryAll = () => {
    void inboxQuery.refetch();
    void goalsListQuery.refetch();
  };

  function toggleTaskSelection(taskId: string) {
    setSelectedTaskIds((current) =>
      current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId],
    );
  }

  function selectAllVisibleItems() {
    setSelectedTaskIds(filteredItems.map((item) => item.id));
  }

  function clearSelection() {
    setSelectedTaskIds([]);
  }

  function runBulkAction(action: BulkUpdateTasksInput["action"]) {
    if (bulkSelectedItems.length === 0) {
      return;
    }

    bulkSuccessMessageRef.current = getBulkSuccessMessage(
      action,
      bulkSelectedItems.length,
      action.type === "link_goal" ? goalTitleById.get(action.goalId ?? "") : undefined,
    );
    const payload = {
      taskIds: bulkSelectedItems.map((task) => task.id),
      action,
    } as BulkUpdateTasksInput;

    bulkUpdateTasksMutation.mutate(payload);
  }

  function handleDoToday() {
    if (!selectedTask) {
      return;
    }

    updateTaskMutation.mutate({
      taskId: selectedTask.id,
      scheduledForDate: today,
      reminderDate: selectedTask.kind === "reminder" ? today : undefined,
    });
  }

  function handleSchedule() {
    if (!selectedTask || !scheduleDate) {
      return;
    }

    updateTaskMutation.mutate({
      taskId: selectedTask.id,
      scheduledForDate: scheduleDate,
      reminderDate: selectedTask.kind === "reminder" ? scheduleDate : undefined,
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
      kind: "note",
      notes: selectedTaskText || selectedTask.title,
      reminderDate: null,
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

  function handleBulkDoToday() {
    runBulkAction({
      type: "schedule",
      scheduledForDate: today,
    });
  }

  function handleBulkSchedule() {
    if (!bulkScheduleDate) {
      return;
    }

    runBulkAction({
      type: "schedule",
      scheduledForDate: bulkScheduleDate,
    });
  }

  function handleBulkLinkGoal() {
    runBulkAction({
      type: "link_goal",
      goalId: bulkGoalId || null,
    });
  }

  function handleBulkArchive() {
    runBulkAction({
      type: "archive",
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
        description="Everything unscheduled lands here first. Decide what belongs on Today, what should be scheduled later, and what should stay as reference."
      />

      {mutationError ? <InlineErrorState message={mutationError} onRetry={retryAll} /> : null}

      <WorkflowTemplatesSection />

      <section className="inbox-summary">
        <div className="inbox-summary__headline">
          <span className="inbox-summary__count">{counts.all}</span>
          <div>
            <p className="inbox-summary__label">Pending inbox items</p>
            <p className="inbox-summary__copy">Keep intake friction low. Add structure only when you are ready to schedule or organize.</p>
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
          subtitle="Newest inbox items first. Open one item to inspect it, or use checkboxes to triage a batch."
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
            <>
              <div className="inbox-selection-bar">
                <div className="inbox-selection-bar__summary">
                  <strong>{bulkSelectedItems.length}</strong>
                  <span>{bulkSelectedItems.length === 1 ? "item selected" : "items selected"}</span>
                </div>
                <div className="button-row button-row--wrap">
                  <button
                    className="button button--ghost"
                    type="button"
                    onClick={allFilteredItemsSelected ? clearSelection : selectAllVisibleItems}
                    disabled={isMutating}
                  >
                    {allFilteredItemsSelected ? "Clear visible" : "Select all visible"}
                  </button>
                  {hasBulkSelection ? (
                    <button
                      className="button button--ghost"
                      type="button"
                      onClick={clearSelection}
                      disabled={isMutating}
                    >
                      Clear selection
                    </button>
                  ) : null}
                </div>
              </div>

              <ul className="inbox-list">
                {filteredItems.map((item) => {
                  const itemKind = getInboxItemKind(item);
                  const isSelected = item.id === selectedTask?.id;
                  const isChecked = selectedTaskIdsSet.has(item.id);
                  const preview = getQuickCaptureDisplayText(item, item.title);

                  return (
                    <li key={item.id} className={`inbox-row${isChecked ? " inbox-row--checked" : ""}`}>
                      <label className="inbox-row__checkbox">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleTaskSelection(item.id)}
                          disabled={isMutating}
                          aria-label={`Select ${preview}`}
                        />
                        <span>Select</span>
                      </label>
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
                          {item.reminderDate ? <span>Reminder date {item.reminderDate}</span> : null}
                          {item.goal ? <GoalChip goal={item.goal} /> : <span>Unlinked</span>}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <EmptyState
              title="Inbox is clear"
              description="Nothing is waiting for triage right now. Use Quick Capture to drop something in."
            />
          )}
        </SectionCard>

        <SectionCard
          className="inbox-panel inbox-panel--detail"
          title={hasBulkSelection ? "Bulk actions" : selectedTask ? "Inspector" : "Triage"}
          subtitle={
            hasBulkSelection
              ? "Apply one decision across the checked items. Clear selection to return to single-item triage."
              : selectedTask
                ? "Promote, schedule, link, convert, or archive without leaving the queue."
                : "Select an item to decide where it belongs."
          }
        >
          {hasBulkSelection ? (
            <div className="inbox-detail">
              <div className="inbox-detail__hero">
                <div className="inbox-detail__hero-main">
                  <span className="tag tag--neutral">Batch mode</span>
                  <strong>{bulkSelectedItems.length} selected</strong>
                </div>
                <span className="inbox-detail__time">Visible selection only</span>
              </div>

              <div className="inbox-detail__content">
                <h2 className="inbox-detail__title">Process this group together</h2>
                <p className="inbox-detail__body">
                  Use one action when these captures belong on the same day, under the same goal, or should all leave the queue together.
                </p>
              </div>

              <div className="inbox-detail__meta-grid">
                <div>
                  <span className="inbox-detail__meta-label">Selection</span>
                  <strong>{bulkSelectedItems.length} items</strong>
                </div>
                <div>
                  <span className="inbox-detail__meta-label">Tasks</span>
                  <strong>{bulkSelectedItems.filter((item) => getInboxItemKind(item) === "task").length}</strong>
                </div>
                <div>
                  <span className="inbox-detail__meta-label">Notes</span>
                  <strong>{bulkSelectedItems.filter((item) => getInboxItemKind(item) === "note").length}</strong>
                </div>
                <div>
                  <span className="inbox-detail__meta-label">Reminders</span>
                  <strong>{bulkSelectedItems.filter((item) => getInboxItemKind(item) === "reminder").length}</strong>
                </div>
              </div>

              <div className="inbox-detail__actions">
                <div className="inbox-action-block">
                  <div className="inbox-action-block__header">
                    <h3>Promote</h3>
                    <p>Move the whole selection onto today or another date in one step.</p>
                  </div>
                  <div className="button-row button-row--wrap inbox-action-row">
                    <button
                      className="button button--primary"
                      type="button"
                      onClick={handleBulkDoToday}
                      disabled={isMutating}
                    >
                      Do today
                    </button>
                    <label className="field inbox-schedule-field">
                      <span>Schedule date</span>
                      <input
                        type="date"
                        min={today}
                        value={bulkScheduleDate}
                        onChange={(event) => setBulkScheduleDate(event.target.value)}
                      />
                    </label>
                    <button
                      className="button button--ghost"
                      type="button"
                      onClick={handleBulkSchedule}
                      disabled={isMutating || !bulkScheduleDate}
                    >
                      Schedule
                    </button>
                  </div>
                </div>

                <div className="inbox-action-block">
                  <div className="inbox-action-block__header">
                    <h3>Organize</h3>
                    <p>Apply the same context or archive decision across the selected group.</p>
                  </div>
                  <div className="button-row button-row--wrap inbox-action-row">
                    <label className="field inbox-goal-field">
                      <span>Linked goal</span>
                      <select
                        value={bulkGoalId}
                        onChange={(event) => setBulkGoalId(event.target.value)}
                        disabled={goalsListQuery.isLoading || isMutating}
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
                      onClick={handleBulkLinkGoal}
                      disabled={isMutating}
                    >
                      {bulkGoalId ? "Link to goal" : "Remove goal"}
                    </button>
                    <button
                      className="button button--ghost"
                      type="button"
                      onClick={handleBulkArchive}
                      disabled={isMutating}
                    >
                      Archive
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : selectedTask ? (
            <div className="inbox-detail">
              <div className="inbox-detail__hero">
                <div className="inbox-detail__hero-main">
                  <span className={getKindTagClass(selectedTaskKind ?? "task")}>
                    {getKindLabel(selectedTaskKind ?? "task")}
                  </span>
                  {selectedTask.goal ? <GoalChip goal={selectedTask.goal} /> : null}
                </div>
                <span className="inbox-detail__time">Created {formatCreatedAt(selectedTask.createdAt)}</span>
              </div>

              <div className="inbox-detail__content">
                <h2 className="inbox-detail__title">{getQuickCaptureDisplayText(selectedTask, selectedTask.title)}</h2>
                <p className="inbox-detail__body">{selectedTaskText || "No detail saved for this capture."}</p>
              </div>

              <div className="inbox-detail__meta-grid">
                <div>
                  <span className="inbox-detail__meta-label">Status</span>
                  <strong>Pending triage</strong>
                </div>
                <div>
                  <span className="inbox-detail__meta-label">Reminder date</span>
                  <strong>{selectedTask.reminderDate ?? "None"}</strong>
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
                      disabled={isMutating}
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
                      disabled={isMutating || !scheduleDate}
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
                        disabled={goalsListQuery.isLoading || isMutating}
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
                      disabled={isMutating}
                    >
                      Link to goal
                    </button>
                    {selectedTaskKind === "task" ? (
                      <button
                        className="button button--ghost"
                        type="button"
                        onClick={handleConvertToNote}
                        disabled={isMutating}
                      >
                        Convert to note
                      </button>
                    ) : null}
                    <button
                      className="button button--ghost"
                      type="button"
                      onClick={handleArchive}
                      disabled={isMutating}
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
