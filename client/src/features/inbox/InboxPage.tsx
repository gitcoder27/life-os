import { useEffect, useMemo, useRef, useState } from "react";

import { useAppFeedback } from "../../app/providers";
import {
  getTodayDate,
  useBulkUpdateTasksMutation,
  useGoalsListQuery,
  useInboxQuery,
  useUpdateTaskMutation,
  type BulkUpdateTasksInput,
  type TaskItem,
  type TaskListCounts,
} from "../../shared/lib/api";
import { getQuickCaptureText } from "../../shared/lib/quickCapture";
import {
  InlineErrorState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import { InboxBulkBar } from "./InboxBulkBar";
import { InboxEmptyState } from "./InboxEmptyState";
import { InboxInspector } from "./InboxInspector";
import { InboxQueueItem } from "./InboxQueueItem";
import { InboxTemplatesModal } from "./InboxTemplatesModal";

type InboxFilter = "all" | "task" | "note" | "reminder";

const filterOptions: Array<{ id: InboxFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "task", label: "Tasks" },
  { id: "note", label: "Notes" },
  { id: "reminder", label: "Reminders" },
];
const INBOX_PAGE_SIZE = 50;
const EMPTY_COUNTS: TaskListCounts = { all: 0, task: 0, note: 0, reminder: 0 };
const STALE_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000;

function isItemStale(item: TaskItem) {
  return Date.now() - new Date(item.createdAt).getTime() > STALE_THRESHOLD_MS;
}

function getBulkSuccessMessage(
  action: BulkUpdateTasksInput["action"],
  taskCount: number,
) {
  if (action.type === "schedule") {
    const label = action.scheduledForDate === getTodayDate() ? "Moved" : "Scheduled";
    return `${label} ${taskCount} inbox item${taskCount === 1 ? "" : "s"}.`;
  }
  return `Archived ${taskCount} inbox item${taskCount === 1 ? "" : "s"}.`;
}

export function InboxPage() {
  const today = getTodayDate();
  const { pushFeedback } = useAppFeedback();
  const goalsListQuery = useGoalsListQuery();
  const updateTaskMutation = useUpdateTaskMutation(today);
  const bulkSuccessMessageRef = useRef("Inbox updated.");
  const bulkUpdateTasksMutation = useBulkUpdateTasksMutation(today, {
    onSuccess: () => {
      setCheckedIds(new Set());
      pushFeedback(bulkSuccessMessageRef.current, "success");
    },
  });

  const [activeFilter, setActiveFilter] = useState<InboxFilter>("all");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [loadedItems, setLoadedItems] = useState<TaskItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const activeKind = activeFilter === "all" ? undefined : activeFilter;
  const inboxQuery = useInboxQuery({
    kind: activeKind,
    limit: INBOX_PAGE_SIZE,
    includeSummary: true,
  });
  const loadMoreQuery = useInboxQuery(
    { kind: activeKind, cursor: nextCursor ?? undefined, limit: INBOX_PAGE_SIZE },
    { enabled: false },
  );

  const activeGoals = useMemo(
    () => (goalsListQuery.data?.goals ?? []).filter((goal) => goal.status === "active"),
    [goalsListQuery.data],
  );

  const filteredItems = loadedItems;
  const selectedItem = filteredItems.find((item) => item.id === selectedItemId) ?? null;
  const hasBulkSelection = checkedIds.size > 0;
  const isMutating = updateTaskMutation.isPending || bulkUpdateTasksMutation.isPending;

  // Reset on filter change
  useEffect(() => {
    setLoadedItems([]);
    setNextCursor(null);
    setSelectedItemId(null);
    setCheckedIds(new Set());
    setIsLoadingMore(false);
  }, [activeKind]);

  // Sync loaded items from query
  useEffect(() => {
    if (!inboxQuery.data) return;
    setLoadedItems(inboxQuery.data.tasks);
    setNextCursor(inboxQuery.data.nextCursor);
    setIsLoadingMore(false);
  }, [inboxQuery.data]);

  // Clean up stale selected/checked IDs
  useEffect(() => {
    const visibleIds = new Set(filteredItems.map((item) => item.id));
    if (selectedItemId && !visibleIds.has(selectedItemId)) {
      setSelectedItemId(null);
    }
    setCheckedIds((current) => {
      const cleaned = new Set([...current].filter((id) => visibleIds.has(id)));
      return cleaned.size === current.size ? current : cleaned;
    });
  }, [filteredItems, selectedItemId]);

  // Close inspector when entering bulk mode
  useEffect(() => {
    if (hasBulkSelection) {
      setSelectedItemId(null);
    }
  }, [hasBulkSelection]);

  const counts = inboxQuery.data?.counts ?? EMPTY_COUNTS;
  const mutationError =
    updateTaskMutation.error instanceof Error
      ? updateTaskMutation.error.message
      : bulkUpdateTasksMutation.error instanceof Error
        ? bulkUpdateTasksMutation.error.message
        : null;

  const retryAll = () => {
    void inboxQuery.refetch();
    void goalsListQuery.refetch();
  };

  async function handleLoadMore() {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const result = await loadMoreQuery.refetch();
      if (!result.data) return;
      setLoadedItems((current) => [...current, ...result.data.tasks]);
      setNextCursor(result.data.nextCursor);
    } finally {
      setIsLoadingMore(false);
    }
  }

  function toggleCheck(taskId: string) {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }

  function selectAll() {
    setCheckedIds(new Set(filteredItems.map((item) => item.id)));
  }

  function clearSelection() {
    setCheckedIds(new Set());
  }

  // Single-item actions
  function handleDoToday(taskId: string) {
    const item = filteredItems.find((i) => i.id === taskId);
    updateTaskMutation.mutate({
      taskId,
      scheduledForDate: today,
      reminderAt: item?.kind === "reminder" ? today : undefined,
    });
  }

  function handleSchedule(taskId: string, date: string) {
    const item = filteredItems.find((i) => i.id === taskId);
    updateTaskMutation.mutate({
      taskId,
      scheduledForDate: date,
      reminderAt: item?.kind === "reminder" ? date : undefined,
    });
  }

  function handleArchive(taskId: string) {
    updateTaskMutation.mutate({ taskId, status: "dropped" });
  }

  function handleConvertToNote(taskId: string) {
    const item = filteredItems.find((i) => i.id === taskId);
    if (!item) return;
    const text = getQuickCaptureText(item, item.title);
    updateTaskMutation.mutate({
      taskId,
      kind: "note",
      notes: text || item.title,
      reminderAt: null,
    });
  }

  function handleConvertToReminder(taskId: string) {
    const item = filteredItems.find((i) => i.id === taskId);
    if (!item) return;
    updateTaskMutation.mutate({
      taskId,
      kind: "reminder",
    });
  }

  function handleLinkGoal(taskId: string, goalId: string | null) {
    updateTaskMutation.mutate({ taskId, goalId });
  }

  function handleUpdateTitle(taskId: string, title: string) {
    updateTaskMutation.mutate({ taskId, title });
  }

  function handleUpdateNotes(taskId: string, notes: string | null) {
    updateTaskMutation.mutate({ taskId, notes });
  }

  // Bulk actions
  function runBulkAction(action: BulkUpdateTasksInput["action"]) {
    const taskIds = [...checkedIds];
    if (taskIds.length === 0) return;
    bulkSuccessMessageRef.current = getBulkSuccessMessage(action, taskIds.length);
    bulkUpdateTasksMutation.mutate({ taskIds, action } as BulkUpdateTasksInput);
  }

  function handleBulkDoToday() {
    runBulkAction({ type: "schedule", scheduledForDate: today });
  }

  function handleBulkSchedule(date: string) {
    runBulkAction({ type: "schedule", scheduledForDate: date });
  }

  function handleBulkArchive() {
    runBulkAction({ type: "archive" });
  }

  // Loading / error states
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
      <div className="inbox-header">
        <h1 className="inbox-header__title">
          Inbox
          {counts.all > 0 && <span className="inbox-header__count">{counts.all}</span>}
        </h1>
        <button
          className="button button--ghost button--small"
          type="button"
          onClick={() => setIsTemplatesOpen(true)}
        >
          Templates
        </button>
      </div>

      <div className="inbox-filters" role="tablist" aria-label="Inbox filters">
        {filterOptions.map((option) => {
          const count = counts[option.id];
          const isActive = activeFilter === option.id;
          const isZero = count === 0 && option.id !== "all";
          return (
            <button
              key={option.id}
              className={[
                "inbox-filters__item",
                isActive && "inbox-filters__item--active",
                isZero && "inbox-filters__item--zero",
              ]
                .filter(Boolean)
                .join(" ")}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveFilter(option.id)}
            >
              {option.label} <span className="inbox-filters__count">{count}</span>
            </button>
          );
        })}
      </div>

      {mutationError && <InlineErrorState message={mutationError} onRetry={retryAll} />}

      <div className="inbox-workspace">
        <div className="inbox-workspace__list">
          {filteredItems.length > 0 ? (
            <div className="inbox-queue">
              {filteredItems.map((item, index) => (
                <InboxQueueItem
                  key={item.id}
                  item={item}
                  index={index}
                  isActive={item.id === selectedItemId}
                  isChecked={checkedIds.has(item.id)}
                  isStale={isItemStale(item)}
                  isMutating={isMutating}
                  today={today}
                  onSelect={() => {
                    setSelectedItemId(item.id);
                    setCheckedIds(new Set());
                  }}
                  onToggleCheck={() => toggleCheck(item.id)}
                  onDoToday={() => handleDoToday(item.id)}
                  onSchedule={(date) => handleSchedule(item.id, date)}
                  onArchive={() => handleArchive(item.id)}
                  onConvertToNote={() => handleConvertToNote(item.id)}
                  onLinkGoal={() => {
                    setSelectedItemId(item.id);
                    setCheckedIds(new Set());
                  }}
                />
              ))}

              {loadMoreQuery.isError && (
                <InlineErrorState
                  message={
                    loadMoreQuery.error instanceof Error
                      ? loadMoreQuery.error.message
                      : "More inbox items could not load."
                  }
                  onRetry={() => void handleLoadMore()}
                />
              )}

              {nextCursor && (
                <div className="inbox-queue__load-more">
                  <button
                    className="button button--ghost button--small"
                    type="button"
                    onClick={() => void handleLoadMore()}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? "Loading more..." : "Load more"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <InboxEmptyState />
          )}
        </div>

        {selectedItem && !hasBulkSelection && (
          <>
            <div
              className="inbox-inspector-backdrop"
              onClick={() => setSelectedItemId(null)}
            />
            <div className="inbox-workspace__inspector">
              <InboxInspector
                item={selectedItem}
                activeGoals={activeGoals}
                goalsLoading={goalsListQuery.isLoading}
                isMutating={isMutating}
                onClose={() => setSelectedItemId(null)}
                onDoToday={() => handleDoToday(selectedItem.id)}
                onSchedule={(date) => handleSchedule(selectedItem.id, date)}
                onLinkGoal={(goalId) => handleLinkGoal(selectedItem.id, goalId)}
                onConvertToNote={() => handleConvertToNote(selectedItem.id)}
                onConvertToReminder={() => handleConvertToReminder(selectedItem.id)}
                onArchive={() => handleArchive(selectedItem.id)}
                onUpdateTitle={(title) => handleUpdateTitle(selectedItem.id, title)}
                onUpdateNotes={(notes) => handleUpdateNotes(selectedItem.id, notes)}
              />
            </div>
          </>
        )}
      </div>

      {hasBulkSelection && (
        <InboxBulkBar
          selectedCount={checkedIds.size}
          totalCount={filteredItems.length}
          today={today}
          isMutating={isMutating}
          onDoToday={handleBulkDoToday}
          onSchedule={handleBulkSchedule}
          onArchive={handleBulkArchive}
          onSelectAll={selectAll}
          onClear={clearSelection}
        />
      )}

      {isTemplatesOpen && (
        <InboxTemplatesModal onClose={() => setIsTemplatesOpen(false)} />
      )}
    </div>
  );
}
