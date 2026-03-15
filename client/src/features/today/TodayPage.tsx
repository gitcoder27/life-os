import { useEffect, useMemo, useState } from "react";

import {
  formatTimeLabel,
  formatWorkoutStatus,
  getTodayDate,
  toIsoDate,
  useCarryForwardTaskMutation,
  useDayPlanQuery,
  useHealthDataQuery,
  useTaskStatusMutation,
  useUpdateDayPrioritiesMutation,
  useUpdatePriorityMutation,
} from "../../shared/lib/api";
import { PageHeader } from "../../shared/ui/PageHeader";
import {
  EmptyState,
  InlineErrorState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import { SectionCard } from "../../shared/ui/SectionCard";

type EditablePriority = {
  id?: string;
  title: string;
  goalId?: string | null;
  status: "pending" | "completed" | "dropped";
};

const prioritySlots: Array<1 | 2 | 3> = [1, 2, 3];

function getTomorrowDate(fromDate: string) {
  const tomorrow = new Date(`${fromDate}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toIsoDate(tomorrow);
}

export function TodayPage() {
  const today = getTodayDate();
  const tomorrow = getTomorrowDate(today);
  const dayPlanQuery = useDayPlanQuery(today);
  const healthQuery = useHealthDataQuery(today);
  const updateTaskMutation = useTaskStatusMutation(today);
  const carryForwardTaskMutation = useCarryForwardTaskMutation(today);
  const updatePriorityMutation = useUpdatePriorityMutation(today);
  const updateDayPrioritiesMutation = useUpdateDayPrioritiesMutation(today);
  const [priorityDraft, setPriorityDraft] = useState<EditablePriority[]>([]);
  const [rescheduleDates, setRescheduleDates] = useState<Record<string, string>>({});

  const retryAll = () => {
    void dayPlanQuery.refetch();
    void healthQuery.refetch();
  };

  const priorities = dayPlanQuery.data?.priorities ?? [];
  const tasks = dayPlanQuery.data?.tasks ?? [];
  const timedTasks = tasks.filter((task) => task.dueAt);
  const currentDay = healthQuery.data?.summary.currentDay;

  useEffect(() => {
    if (!dayPlanQuery.data) {
      return;
    }

    const nextDraft = [...priorities]
      .sort((left, right) => left.slot - right.slot)
      .map((priority) => ({
        id: priority.id,
        title: priority.title,
        goalId: priority.goalId,
        status: priority.status,
      }));

    setPriorityDraft(nextDraft);
  }, [dayPlanQuery.data, priorities]);

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

  const planBits = [
    `Water progress: ${((currentDay?.waterMl ?? 0) / 1000).toFixed(1)}L / ${((currentDay?.waterTargetMl ?? 0) / 1000).toFixed(1)}L`,
    `Meals logged: ${currentDay?.mealCount ?? 0}`,
    `Workout: ${formatWorkoutStatus(currentDay?.workoutDay?.actualStatus)}`,
  ];

  function updateDraftPriority(index: number, title: string) {
    setPriorityDraft((current) =>
      current.map((item, currentIndex) =>
        currentIndex === index
          ? {
              ...item,
              title,
            }
          : item,
      ),
    );
  }

  function addDraftPriority() {
    setPriorityDraft((current) => {
      if (current.length >= 3) {
        return current;
      }

      return [...current, { title: "", goalId: null, status: "pending" }];
    });
  }

  function removeDraftPriority(index: number) {
    setPriorityDraft((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function moveDraftPriority(index: number, direction: -1 | 1) {
    setPriorityDraft((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(nextIndex, 0, moved);
      return next;
    });
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
        title="Loading execution lane"
        description="Pulling in priorities, today-only tasks, and immediate health context."
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
        eyebrow="Execution view"
        title="Today"
        description="Priorities, today-only tasks, and the immediate plan. Focus on what moves the day forward."
      />

      {mutationError ? (
        <InlineErrorState message={mutationError} onRetry={retryAll} />
      ) : null}

      <div className="two-column-grid stagger">
        <SectionCard
          title="Priority stack"
          subtitle="Keep the top three clear and actionable."
        >
          {priorityDraft.length > 0 ? (
            <ol className="priority-list priority-list--editable">
              {priorityDraft.map((item, index) => (
                <li
                  key={item.id ?? `draft-priority-${index}`}
                  className={
                    item.status === "completed"
                      ? "priority-list__item priority-list__item--done"
                      : item.status === "dropped"
                        ? "priority-list__item priority-list__item--dropped"
                        : "priority-list__item"
                  }
                >
                  <div className="priority-edit-row">
                    <span className="tag tag--neutral">P{index + 1}</span>
                    <input
                      className="priority-inline-input"
                      type="text"
                      value={item.title}
                      placeholder="Priority title"
                      onChange={(event) => updateDraftPriority(index, event.target.value)}
                      aria-label={`Priority ${index + 1}`}
                    />
                  </div>
                  <div className="button-row button-row--tight button-row--wrap">
                    <button
                      className="button button--ghost button--small"
                      type="button"
                      onClick={() => moveDraftPriority(index, -1)}
                      disabled={index === 0 || updateDayPrioritiesMutation.isPending}
                    >
                      Up
                    </button>
                    <button
                      className="button button--ghost button--small"
                      type="button"
                      onClick={() => moveDraftPriority(index, 1)}
                      disabled={index === priorityDraft.length - 1 || updateDayPrioritiesMutation.isPending}
                    >
                      Down
                    </button>
                    <button
                      className="button button--ghost button--small"
                      type="button"
                      onClick={() => removeDraftPriority(index)}
                      disabled={updateDayPrioritiesMutation.isPending}
                    >
                      Remove
                    </button>
                    {item.id ? (
                      <>
                        <button
                          className="button button--ghost button--small"
                          type="button"
                          onClick={() =>
                            updatePriorityMutation.mutate({
                              priorityId: item.id!,
                              status: "completed",
                            })
                          }
                          disabled={item.status === "completed" || updatePriorityMutation.isPending}
                        >
                          Done
                        </button>
                        <button
                          className="button button--ghost button--small"
                          type="button"
                          onClick={() =>
                            updatePriorityMutation.mutate({
                              priorityId: item.id!,
                              status: "dropped",
                            })
                          }
                          disabled={item.status === "dropped" || updatePriorityMutation.isPending}
                        >
                          Drop
                        </button>
                        <button
                          className="button button--ghost button--small"
                          type="button"
                          onClick={() =>
                            updatePriorityMutation.mutate({
                              priorityId: item.id!,
                              status: "pending",
                            })
                          }
                          disabled={item.status === "pending" || updatePriorityMutation.isPending}
                        >
                          Reopen
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState
              title="No ranked priorities"
              description="Add up to three priorities to define today's focus."
            />
          )}

          <div className="button-row button-row--wrap" style={{ marginTop: "0.75rem" }}>
            <button
              className="button button--ghost button--small"
              type="button"
              onClick={addDraftPriority}
              disabled={priorityDraft.length >= 3 || updateDayPrioritiesMutation.isPending}
            >
              Add priority
            </button>
            <button
              className="button button--primary button--small"
              type="button"
              onClick={savePriorityDraft}
              disabled={!isPriorityDraftDirty || prioritiesHaveBlankTitle || updateDayPrioritiesMutation.isPending}
            >
              {updateDayPrioritiesMutation.isPending ? "Saving..." : "Save priorities"}
            </button>
          </div>
          {prioritiesHaveBlankTitle ? (
            <p className="support-copy" style={{ marginTop: "0.5rem" }}>
              Fill every priority title before saving.
            </p>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Task lane"
          subtitle="Resolve or move every open task"
        >
          {tasks.length > 0 ? (
            <ul className="list task-list">
              {tasks.map((item) => (
                <li key={item.id} className="task-list__item">
                  <div className="task-list__main">
                    <strong>{item.title}</strong>
                    <div className="list__subtle">{item.notes ?? item.originType}</div>
                    <div className="button-row button-row--tight button-row--wrap" style={{ marginTop: "0.45rem" }}>
                      <button
                        className="button button--ghost button--small"
                        type="button"
                        disabled={item.status === "completed" || isTaskMutationPending}
                        onClick={() =>
                          updateTaskMutation.mutate({
                            taskId: item.id,
                            status: "completed",
                          })
                        }
                      >
                        Done
                      </button>
                      <button
                        className="button button--ghost button--small"
                        type="button"
                        disabled={item.status === "dropped" || isTaskMutationPending}
                        onClick={() =>
                          updateTaskMutation.mutate({
                            taskId: item.id,
                            status: "dropped",
                          })
                        }
                      >
                        Drop
                      </button>
                      <button
                        className="button button--ghost button--small"
                        type="button"
                        disabled={item.status === "pending" || isTaskMutationPending}
                        onClick={() =>
                          updateTaskMutation.mutate({
                            taskId: item.id,
                            status: "pending",
                          })
                        }
                      >
                        Reopen
                      </button>
                      <button
                        className="button button--ghost button--small"
                        type="button"
                        disabled={item.status !== "pending" || isTaskMutationPending}
                        onClick={() =>
                          carryForwardTaskMutation.mutate({
                            taskId: item.id,
                            targetDate: tomorrow,
                          })
                        }
                      >
                        Carry to tomorrow
                      </button>
                    </div>
                    <div className="task-reschedule-row">
                      <label className="field" style={{ margin: 0 }}>
                        <span>Reschedule date</span>
                        <input
                          type="date"
                          value={getRescheduleDate(item.id)}
                          onChange={(event) =>
                            setRescheduleDates((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <button
                        className="button button--ghost button--small"
                        type="button"
                        disabled={item.status !== "pending" || isTaskMutationPending}
                        onClick={() =>
                          carryForwardTaskMutation.mutate({
                            taskId: item.id,
                            targetDate: getRescheduleDate(item.id),
                          })
                        }
                      >
                        Reschedule
                      </button>
                    </div>
                  </div>
                  <span
                    className={
                      item.status === "completed"
                        ? "tag tag--positive"
                        : item.status === "dropped"
                          ? "tag tag--negative"
                          : "tag tag--warning"
                    }
                  >
                    {item.status === "completed"
                      ? "done"
                      : item.status === "dropped"
                        ? "dropped"
                        : "open"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No tasks scheduled"
              description="This lane is empty until something is assigned to today."
            />
          )}
        </SectionCard>

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
