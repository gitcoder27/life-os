import { useEffect, useState } from "react";

import type {
  Routine,
  RoutineFormValues,
} from "../types";
import { routineMetaItems } from "../libraryFormat";
import { formatMinutesToTimeInput } from "../timing";
import { ActionMenu } from "./ActionMenu";
import { CollapsibleSection } from "./CollapsibleSection";
import { ArchiveConfirm, ArchivedList, FormPanel, InlineError } from "./LibraryParts";
import {
  buildRoutineFormItems,
  RoutineForm,
} from "./RoutineForm";

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
      id="habits-manage-routines"
      title="All routines"
      subtitle={`${activeRoutineCount} active`}
      defaultOpen={routines.length === 0}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      trailing={
        !showAddRoutine ? (
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={() => {
              setIsOpen(true);
              onOpenAddRoutine();
            }}
          >
            New routine
          </button>
        ) : null
      }
    >
      {showAddRoutine ? (
        <FormPanel title="New routine">
          <RoutineForm
            submitLabel="Create routine"
            isPending={createPending}
            onSubmit={onCreateRoutine}
            onCancel={onCloseAddRoutine}
          />
        </FormPanel>
      ) : null}

      {createError ? (
        <InlineError message={createError.message || "Couldn't create the routine."} />
      ) : null}

      {nonArchivedRoutines.length > 0 ? (
        <ul className="hb-items">
          {nonArchivedRoutines.map((routine) => (
            <li key={routine.id} className="hb-item" id={`habits-manage-routine-${routine.id}`}>
              {editingRoutineId === routine.id ? (
                <FormPanel title={`Edit ${routine.name}`}>
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
                </FormPanel>
              ) : (
                <>
                  <div className="hb-item__row">
                    <span className={`hb-item__dot hb-item__dot--${routine.status}`} aria-hidden="true" />
                    <div className="hb-item__body">
                      <span className="hb-item__name">{routine.name}</span>
                      <span className="hb-item__meta">
                        {routineMetaItems(routine).map((item, index) => (
                          <span key={index}>{item}</span>
                        ))}
                      </span>
                    </div>
                    <div className="hb-item__actions">
                      <button
                        className="hb-item__edit"
                        type="button"
                        onClick={() => onEditRoutine(routine.id)}
                        aria-label={`Edit ${routine.name}`}
                      >
                        Edit
                      </button>
                      <ActionMenu
                        label={`More actions for ${routine.name}`}
                        items={[
                          {
                            label: "Move up",
                            onSelect: () => onMoveRoutine(routine.id, Math.max(0, routine.sortOrder - 1)),
                            disabled: updatePending || routine.sortOrder === 0,
                          },
                          {
                            label: "Move down",
                            onSelect: () =>
                              onMoveRoutine(routine.id, Math.min(routines.length - 1, routine.sortOrder + 1)),
                            disabled: updatePending || routine.sortOrder === routines.length - 1,
                          },
                          {
                            label: "Archive",
                            tone: "danger",
                            onSelect: () => onRequestArchiveRoutine(routine.id),
                            disabled: updatePending,
                          },
                        ]}
                      />
                    </div>
                  </div>

                  {confirmArchiveRoutineId === routine.id ? (
                    <ArchiveConfirm
                      name={routine.name}
                      detail="It leaves today's list. You can restore it later."
                      isPending={updatePending}
                      onConfirm={() => onConfirmArchiveRoutine(routine.id)}
                      onCancel={onCancelArchiveRoutine}
                    />
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
      ) : !showAddRoutine ? (
        <div className="hb-library__empty">
          <span>No routines yet. A routine is a short checklist you run in a set window.</span>
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={onOpenAddRoutine}
          >
            Add your first routine
          </button>
        </div>
      ) : null}

      {archivedRoutines.length > 0 ? (
        <ArchivedList
          noun="routine"
          items={archivedRoutines.map((routine) => ({
            id: routine.id,
            name: routine.name,
            meta: `${routine.items.length} ${routine.items.length === 1 ? "step" : "steps"}`,
          }))}
          isPending={updatePending}
          onRestore={onRestoreRoutine}
        />
      ) : null}

      {updateError ? (
        <InlineError message={updateError.message || "Couldn't update the routine."} />
      ) : null}
    </CollapsibleSection>
  );
}
