import { useEffect, useState } from "react";

import {
  useGoalsConfigQuery,
  useUpdateGoalHorizonsMutation,
  type GoalHorizonInput,
  type GoalHorizonItem,
} from "../../shared/lib/api";
import { InlineErrorState } from "../../shared/ui/PageState";
import { SectionCard } from "../../shared/ui/SectionCard";

type HorizonDraft = GoalHorizonInput & { _key: string };

let keyCounter = 0;
function nextKey() {
  keyCounter += 1;
  return `horizon-draft-${keyCounter}`;
}

function toDrafts(items: GoalHorizonItem[]): HorizonDraft[] {
  return items.map((h) => ({
    _key: h.id,
    id: h.id,
    systemKey: h.systemKey,
    name: h.name,
    spanMonths: h.spanMonths,
    isArchived: h.isArchived,
  }));
}

export function GoalHorizonManager() {
  const configQuery = useGoalsConfigQuery();
  const mutation = useUpdateGoalHorizonsMutation();
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<HorizonDraft[]>([]);

  const horizons = configQuery.data?.horizons ?? [];

  useEffect(() => {
    if (!editing) setDrafts(toDrafts(horizons));
  }, [horizons, editing]);

  function openEditor() {
    setDrafts(toDrafts(horizons));
    setEditing(true);
  }

  function addDraft() {
    setDrafts((prev) => [...prev, { _key: nextKey(), name: "", spanMonths: null, isArchived: false }]);
  }

  function updateDraft(index: number, partial: Partial<HorizonDraft>) {
    setDrafts((prev) =>
      prev.map((d, i) => (i === index ? { ...d, ...partial } : d)),
    );
  }

  function removeDraft(index: number) {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  function moveDraft(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= drafts.length) return;
    setDrafts((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSave() {
    const payload = drafts
      .filter((d) => d.name.trim())
      .map((d) => ({
        id: d.id,
        systemKey: d.systemKey,
        name: d.name.trim(),
        spanMonths: d.spanMonths,
        isArchived: d.isArchived,
      }));
    await mutation.mutateAsync({ horizons: payload });
    setEditing(false);
  }

  if (configQuery.isLoading) {
    return (
      <SectionCard title="Planning layers" subtitle="Loading...">
        <p className="support-copy">Loading horizon configuration...</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Planning layers" subtitle="Define the goal hierarchy structure">
      <p className="support-copy" style={{ marginBottom: "0.75rem" }}>
        Planning layers shape your goal hierarchy from long-range vision to monthly focus.
        The order here determines the top-down planning structure. Weekly and monthly planning cycles are always available regardless of these settings.
      </p>

      {editing ? (
        <div className="settings-config-editor" id="planning-layers">
          {drafts.map((draft, index) => (
            <div key={draft._key} className="settings-config-row">
              <div className="settings-config-row__reorder">
                <button
                  className="settings-config-row__move"
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveDraft(index, -1)}
                  aria-label="Move up"
                >
                  ▲
                </button>
                <button
                  className="settings-config-row__move"
                  type="button"
                  disabled={index === drafts.length - 1}
                  onClick={() => moveDraft(index, 1)}
                  aria-label="Move down"
                >
                  ▼
                </button>
              </div>
              <input
                className="settings-config-row__input"
                type="text"
                value={draft.name}
                placeholder="Layer name"
                onChange={(e) => updateDraft(index, { name: e.target.value })}
              />
              <input
                className="settings-config-row__span"
                type="number"
                min={0}
                value={draft.spanMonths ?? ""}
                placeholder="Months"
                title="Time span in months (leave empty for open-ended)"
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  updateDraft(index, { spanMonths: val });
                }}
              />
              <label className="settings-config-row__archive">
                <input
                  type="checkbox"
                  checked={draft.isArchived ?? false}
                  onChange={(e) => updateDraft(index, { isArchived: e.target.checked })}
                />
                <span>Archived</span>
              </label>
              {!draft.systemKey && (
                <button
                  className="settings-config-row__remove"
                  type="button"
                  onClick={() => removeDraft(index)}
                  aria-label="Remove layer"
                >
                  ×
                </button>
              )}
            </div>
          ))}

          {drafts.length < 10 && (
            <button className="button button--ghost button--small" type="button" onClick={addDraft}>
              + Add layer
            </button>
          )}

          {mutation.error instanceof Error && (
            <InlineErrorState message={mutation.error.message} onRetry={() => void handleSave()} />
          )}

          <div className="button-row" style={{ marginTop: "0.75rem" }}>
            <button
              className="button button--primary button--small"
              type="button"
              onClick={() => void handleSave()}
              disabled={mutation.isPending || drafts.some((d) => !d.name.trim())}
            >
              {mutation.isPending ? "Saving..." : "Save layers"}
            </button>
            <button
              className="button button--ghost button--small"
              type="button"
              onClick={() => setEditing(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="settings-config-list" id="planning-layers">
            {horizons.map((h, index) => (
              <div key={h.id} className={`settings-config-item${h.isArchived ? " settings-config-item--archived" : ""}`}>
                <span className="settings-config-item__order">{index + 1}</span>
                <span className="settings-config-item__name">{h.name}</span>
                {h.spanMonths && <span className="tag tag--neutral">{h.spanMonths}mo</span>}
                {h.systemKey && <span className="tag tag--neutral">built-in</span>}
                {h.isArchived && <span className="tag tag--warning">archived</span>}
              </div>
            ))}
          </div>
          <button className="button button--ghost button--small" type="button" onClick={openEditor} style={{ marginTop: "0.5rem" }}>
            Edit planning layers
          </button>
        </>
      )}
    </SectionCard>
  );
}
