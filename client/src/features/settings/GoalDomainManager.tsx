import { useEffect, useState } from "react";

import {
  useGoalsConfigQuery,
  useUpdateGoalDomainsMutation,
  type GoalDomainInput,
  type GoalDomainItem,
} from "../../shared/lib/api";
import { InlineErrorState } from "../../shared/ui/PageState";
import { SectionCard } from "../../shared/ui/SectionCard";

type DomainDraft = GoalDomainInput & { _key: string };

let keyCounter = 0;
function nextKey() {
  keyCounter += 1;
  return `domain-draft-${keyCounter}`;
}

function toDrafts(items: GoalDomainItem[]): DomainDraft[] {
  return items.map((d) => ({
    _key: d.id,
    id: d.id,
    systemKey: d.systemKey,
    name: d.name,
    isArchived: d.isArchived,
  }));
}

export function GoalDomainManager() {
  const configQuery = useGoalsConfigQuery();
  const mutation = useUpdateGoalDomainsMutation();
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<DomainDraft[]>([]);

  const domains = configQuery.data?.domains ?? [];

  useEffect(() => {
    if (!editing) setDrafts(toDrafts(domains));
  }, [domains, editing]);

  function openEditor() {
    setDrafts(toDrafts(domains));
    setEditing(true);
  }

  function addDraft() {
    setDrafts((prev) => [...prev, { _key: nextKey(), name: "", isArchived: false }]);
  }

  function updateDraft(index: number, partial: Partial<DomainDraft>) {
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
        isArchived: d.isArchived,
      }));
    await mutation.mutateAsync({ domains: payload });
    setEditing(false);
  }

  if (configQuery.isLoading) {
    return (
      <SectionCard title="Goal domains" subtitle="Loading...">
        <p className="support-copy">Loading domain configuration...</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Goal domains" subtitle="Manage how goals are organized by life area">
      <p className="support-copy" style={{ marginBottom: "0.75rem" }}>
        Domains categorize your goals by life area. Changes here affect the Goals page only.
      </p>

      {editing ? (
        <div className="settings-config-editor" id="goal-domains">
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
                placeholder="Domain name"
                onChange={(e) => updateDraft(index, { name: e.target.value })}
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
                  aria-label="Remove domain"
                >
                  ×
                </button>
              )}
            </div>
          ))}

          {drafts.length < 20 && (
            <button className="button button--ghost button--small" type="button" onClick={addDraft}>
              + Add domain
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
              {mutation.isPending ? "Saving..." : "Save domains"}
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
          <div className="settings-config-list" id="goal-domains">
            {domains.map((d) => (
              <div key={d.id} className={`settings-config-item${d.isArchived ? " settings-config-item--archived" : ""}`}>
                <span className="settings-config-item__name">{d.name}</span>
                {d.systemKey && <span className="tag tag--neutral">built-in</span>}
                {d.isArchived && <span className="tag tag--warning">archived</span>}
              </div>
            ))}
          </div>
          <button className="button button--ghost button--small" type="button" onClick={openEditor} style={{ marginTop: "0.5rem" }}>
            Edit domains
          </button>
        </>
      )}
    </SectionCard>
  );
}
