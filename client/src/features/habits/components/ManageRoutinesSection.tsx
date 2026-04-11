import { useEffect, useState } from "react";

import type {
  Routine,
  RoutineFormValues,
} from "../types";
import { CollapsibleSection } from "./CollapsibleSection";
import {
  buildRoutineFormItems,
  RoutineForm,
} from "./RoutineForm";
import { formatMinutesToTimeInput } from "../timing";

type ManageRoutinesSectionProps = {
  routines: Routine[];
  activeRoutineCount: number;
  nonArchivedRoutines: Routine[];
  archivedRoutines: Routine[];
  showAddRoutine: boolean;
  editingRoutineId: string | null;
  confirmArchiveRoutineId: string | null;
  createPending: boolean;
  updatePending: boolean;
  createError: Error | null;
  updateError: Error | null;
  onOpenAddRoutine: () => void;
  onCloseAddRoutine: () => void;
  onEditRoutine: (routineId: string) => void;
  onCancelEditRoutine: () => void;
  onCreateRoutine: (values: RoutineFormValues) => void;
  onUpdateRoutine: (routineId: string, values: RoutineFormValues) => void;
  onMoveRoutine: (routineId: string, sortOrder: number) => void;
  onRequestArchiveRoutine: (routineId: string) => void;
  onCancelArchiveRoutine: () => void;
  onConfirmArchiveRoutine: (routineId: string) => void;
  onRestoreRoutine: (routineId: string) => void;
};

export function ManageRoutinesSection({
  routines,
  activeRoutineCount,
  nonArchivedRoutines,
  archivedRoutines,
  showAddRoutine,
  editingRoutineId,
  confirmArchiveRoutineId,
  createPending,
  updatePending,
  createError,
  updateError,
  onOpenAddRoutine,
  onCloseAddRoutine,
  onEditRoutine,
  onCancelEditRoutine,
  onCreateRoutine,
  onUpdateRoutine,
  onMoveRoutine,
  onRequestArchiveRoutine,
  onCancelArchiveRoutine,
  onConfirmArchiveRoutine,
  onRestoreRoutine,
}: ManageRoutinesSectionProps) {
  const [isOpen, setIsOpen] = useState(routines.length === 0);
  const hasOpenForm = showAddRoutine || editingRoutineId !== null;

  useEffect(() => {
    if (hasOpenForm) {
      setIsOpen(true);
    }
  }, [hasOpenForm]);

  return (
    <CollapsibleSection
      title="Manage routines"
      subtitle={`${activeRoutineCount} active`}
      defaultOpen={routines.length === 0}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      trailing={
        !showAddRoutine ? (
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsOpen(true);
              onOpenAddRoutine();
            }}
          >
            + Add routine
          </button>
        ) : null
      }
    >
      {showAddRoutine ? (
        <RoutineForm
          submitLabel="Create routine"
          isPending={createPending}
          onSubmit={onCreateRoutine}
          onCancel={() => {
            onCloseAddRoutine();
            if (routines.length === 0) {
              setIsOpen(true);
            }
          }}
        />
      ) : null}

      {createError ? (
        <InlineError message={createError.message || "Could not create routine."} />
      ) : null}

      {nonArchivedRoutines.length > 0 ? (
        <div className="manage-list">
          {nonArchivedRoutines.map((routine) => (
            <div key={routine.id} className="manage-list__item">
              {editingRoutineId === routine.id ? (
                <RoutineForm
                  initial={{
                    name: routine.name,
                    windowStartTime: formatMinutesToTimeInput(routine.windowStartMinutes),
                    windowEndTime: formatMinutesToTimeInput(routine.windowEndMinutes),
                    items: buildRoutineFormItems(routine.items),
                  }}
                  submitLabel="Save changes"
                  isPending={updatePending}
                  onSubmit={(values) => onUpdateRoutine(routine.id, values)}
                  onCancel={onCancelEditRoutine}
                />
              ) : (
                <div className="manage-list__row">
                  <div className="manage-list__info">
                    <div className="manage-list__name">
                      <span className={`status-dot status-dot--${routine.status}`} />
                      {routine.name}
                    </div>
                    <div className="manage-list__meta">
                      {routine.items.length} step{routine.items.length !== 1 ? "s" : ""}
                      {" · "}
                      {routine.completedItems}/{routine.totalItems} today
                      {routine.timingLabel ? ` · ${routine.timingLabel}` : ""}
                    </div>
                  </div>
                  <div className="habits-manage-actions">
                    <button
                      className="button button--ghost button--small"
                      type="button"
                      onClick={() => onEditRoutine(routine.id)}
                    >
                      Edit
                    </button>
                    <button
                      className="button button--ghost button--small"
                      type="button"
                      onClick={() => onMoveRoutine(routine.id, Math.max(0, routine.sortOrder - 1))}
                      disabled={updatePending || routine.sortOrder === 0}
                    >
                      Move up
                    </button>
                    <button
                      className="button button--ghost button--small"
                      type="button"
                      onClick={() =>
                        onMoveRoutine(
                          routine.id,
                          Math.min(routines.length - 1, routine.sortOrder + 1),
                        )
                      }
                      disabled={updatePending || routine.sortOrder === routines.length - 1}
                    >
                      Move down
                    </button>
                    {routine.status !== "archived" ? (
                      confirmArchiveRoutineId === routine.id ? (
                        <span className="confirm-archive">
                          <span className="confirm-archive__label">Archive?</span>
                          <button
                            className="button button--ghost button--small"
                            type="button"
                            style={{ color: "var(--negative)" }}
                            onClick={() => onConfirmArchiveRoutine(routine.id)}
                            disabled={updatePending}
                          >
                            Yes
                          </button>
                          <button
                            className="button button--ghost button--small"
                            type="button"
                            onClick={onCancelArchiveRoutine}
                          >
                            No
                          </button>
                        </span>
                      ) : (
                        <button
                          className="button button--ghost button--small"
                          type="button"
                          style={{ color: "var(--negative)" }}
                          onClick={() => onRequestArchiveRoutine(routine.id)}
                          disabled={updatePending}
                        >
                          Archive
                        </button>
                      )
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : !showAddRoutine ? (
        <div className="habits-group__empty">
          <span className="habits-group__empty-text">
            No routines yet. Add your first routine to build structure.
          </span>
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={onOpenAddRoutine}
          >
            + Add your first routine
          </button>
        </div>
      ) : null}

      {archivedRoutines.length > 0 ? (
        <CollapsibleSection
          title="Archived routines"
          subtitle={`${archivedRoutines.length} archived`}
        >
          <div className="manage-list manage-list--archived">
            {archivedRoutines.map((routine) => (
              <div key={routine.id} className="manage-list__item">
                <div className="manage-list__row">
                  <div className="manage-list__info">
                    <div className="manage-list__name">
                      <span className="status-dot status-dot--archived" />
                      {routine.name}
                    </div>
                    <div className="manage-list__meta">
                      {routine.items.length} step{routine.items.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="habits-manage-actions">
                    <button
                      className="button button--ghost button--small"
                      type="button"
                      onClick={() => onRestoreRoutine(routine.id)}
                      disabled={updatePending}
                    >
                      Restore
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      ) : null}

      {updateError ? (
        <InlineError message={updateError.message || "Could not update routine."} />
      ) : null}
    </CollapsibleSection>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="inline-state inline-state--error" style={{ marginTop: "0.5rem" }}>
      {message}
    </div>
  );
}
