import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";

import { useAppFeedback } from "../../app/providers";
import {
  ApiClientError,
  getTodayDate,
  useBulkUpdateTasksMutation,
  useCommitTaskMutation,
  useGoalsListQuery,
  useInboxQuery,
  useUpdateTaskMutation,
  type BulkUpdateTasksInput,
  type TaskItem,
  type TaskListCounts,
} from "../../shared/lib/api";
import type { ClarificationProtocol } from "./InboxInspector";
import { readHomeDestinationState } from "../../shared/lib/homeNavigation";
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
  const location = useLocation();
  const today = getTodayDate();
  const { pushFeedback } = useAppFeedback();
  const goalsListQuery = useGoalsListQuery();
  const updateTaskMutation = useUpdateTaskMutation(today);
  const commitTaskMutation = useCommitTaskMutation(today);
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
  const [promptClarification, setPromptClarification] = useState(false);
  const [pendingCommitDate, setPendingCommitDate] = useState<string | null>(null);
  const [ignoreStaleTriageIntent, setIgnoreStaleTriageIntent] = useState(false);

  const activeKind = activeFilter === "all" ? undefined : activeFilter;
  const homeDestination = readHomeDestinationState(location.state);
  const isStaleTriageIntent =
    homeDestination?.kind === "inbox_triage" &&
    homeDestination.focus === "stale" &&
    !ignoreStaleTriageIntent;
  const inboxQuery = useInboxQuery({
    kind: activeKind,
    limit: INBOX_PAGE_SIZE,
    includeSummary: true,
    sort: isStaleTriageIntent ? "oldest" : "newest",
  });
  const loadMoreQuery = useInboxQuery(
    {
      kind: activeKind,
      cursor: nextCursor ?? undefined,
      limit: INBOX_PAGE_SIZE,
      sort: isStaleTriageIntent ? "oldest" : "newest",
    },
    { enabled: false },
  );

  const activeGoals = useMemo(
    () => (goalsListQuery.data?.goals ?? []).filter((goal) => goal.status === "active"),
    [goalsListQuery.data],
  );

  const filteredItems = loadedItems;
  const selectedItem = filteredItems.find((item) => item.id === selectedItemId) ?? null;
  const hasBulkSelection = checkedIds.size > 0;
  const isMutating = updateTaskMutation.isPending || bulkUpdateTasksMutation.isPending || commitTaskMutation.isPending;

  // Reset on filter change
  useEffect(() => {
    setIgnoreStaleTriageIntent(false);
  }, [location.key]);

  // Reset on filter or sort-intent change
  useEffect(() => {
    setLoadedItems([]);
    setNextCursor(null);
    setSelectedItemId(null);
    setCheckedIds(new Set());
    setIsLoadingMore(false);
    setPromptClarification(false);
    setPendingCommitDate(null);
  }, [activeKind, isStaleTriageIntent]);

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
      setPromptClarification(false);
      setPendingCommitDate(null);
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
      setPromptClarification(false);
      setPendingCommitDate(null);
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
    if (!item) return;
    // Notes and reminders bypass commitment
    if (item.kind !== "task") {
      updateTaskMutation.mutate({
        taskId,
        scheduledForDate: today,
        reminderAt: item.kind === "reminder" ? today : undefined,
      });
      return;
    }
    commitTaskMutation.mutate({
      taskId,
      scheduledForDate: today,
    });
  }

  function handleSchedule(taskId: string, date: string) {
    const item = filteredItems.find((i) => i.id === taskId);
    if (!item) return;
    if (item.kind !== "task") {
      updateTaskMutation.mutate({
        taskId,
        scheduledForDate: date,
        reminderAt: item.kind === "reminder" ? date : undefined,
      });
      return;
    }
    commitTaskMutation.mutate({ taskId, scheduledForDate: date });
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

  function handleCommit(taskId: string, date: string, protocol: ClarificationProtocol) {
    commitTaskMutation.mutate(
      {
        taskId,
        scheduledForDate: date,
        nextAction: protocol.nextAction,
        fiveMinuteVersion: protocol.fiveMinuteVersion,
        estimatedDurationMinutes: protocol.estimatedDurationMinutes,
        likelyObstacle: protocol.likelyObstacle,
        focusLengthMinutes: protocol.focusLengthMinutes,
      },
      {
        onSuccess: () => {
          setPromptClarification(false);
          setPendingCommitDate(null);
        },
        onError: (error) => {
          // If commit failed due to missing clarification, guide user
          if (error instanceof ApiClientError && error.code === "VALIDATION_ERROR") {
            setPendingCommitDate(date);
            setPromptClarification(true);
          }
        },
      },
    );
  }

  const handleClarificationHandled = useCallback(() => {
    setPromptClarification(false);
  }, []);

  const closeInspector = useCallback(() => {
    setSelectedItemId(null);
    setPromptClarification(false);
    setPendingCommitDate(null);
  }, []);

  useEffect(() => {
    if (!selectedItem || hasBulkSelection) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeInspector();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeInspector, hasBulkSelection, selectedItem]);

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

      {isStaleTriageIntent ? (
        <div className="inbox-triage-banner" role="status">
          <div>
            <span className="inbox-triage-banner__label">Stale triage</span>
            <p className="inbox-triage-banner__copy">
              Oldest captures are shown first so the aging items Home flagged are easy to clear.
            </p>
          </div>
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={() => setIgnoreStaleTriageIntent(true)}
          >
            View newest first
          </button>
        </div>
      ) : null}

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
                    setPromptClarification(false);
                    setPendingCommitDate(null);
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
      </div>

      {selectedItem && !hasBulkSelection
        ? createPortal(
            <>
              <div
                className="inbox-inspector-backdrop"
                onClick={closeInspector}
              />
              <div className="inbox-workspace__inspector">
                <InboxInspector
                  item={selectedItem}
                  activeGoals={activeGoals}
                  goalsLoading={goalsListQuery.isLoading}
                  isMutating={isMutating}
                  onClose={closeInspector}
                  onCommit={(date, protocol) => handleCommit(selectedItem.id, date, protocol)}
                  onDoToday={() => handleDoToday(selectedItem.id)}
                  onSchedule={(date) => handleSchedule(selectedItem.id, date)}
                  onLinkGoal={(goalId) => handleLinkGoal(selectedItem.id, goalId)}
                  onConvertToNote={() => handleConvertToNote(selectedItem.id)}
                  onConvertToReminder={() => handleConvertToReminder(selectedItem.id)}
                  onArchive={() => handleArchive(selectedItem.id)}
                  onUpdateTitle={(title) => handleUpdateTitle(selectedItem.id, title)}
                  onUpdateNotes={(notes) => handleUpdateNotes(selectedItem.id, notes)}
                  promptClarification={promptClarification}
                  pendingCommitDate={pendingCommitDate}
                  onClarificationHandled={handleClarificationHandled}
                />
              </div>
            </>,
            document.body,
          )
        : null}

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
