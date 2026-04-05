import { useEffect, useRef, useState } from "react";

import type {
  GoalDomainItem,
  GoalHorizonItem,
  GoalOverviewItem,
} from "../../shared/lib/api";

export type GoalFormData = {
  title: string;
  domainId: string;
  horizonId: string;
  parentGoalId: string;
  why: string;
  targetDate: string;
  notes: string;
};

export function emptyGoalForm(defaults?: Partial<GoalFormData>): GoalFormData {
  return {
    title: "",
    domainId: defaults?.domainId ?? "",
    horizonId: defaults?.horizonId ?? "",
    parentGoalId: defaults?.parentGoalId ?? "",
    why: "",
    targetDate: "",
    notes: "",
    ...defaults,
  };
}

export function goalToFormData(goal: GoalOverviewItem): GoalFormData {
  return {
    title: goal.title,
    domainId: goal.domainId ?? "",
    horizonId: goal.horizonId ?? "",
    parentGoalId: goal.parentGoalId ?? "",
    why: goal.why ?? "",
    targetDate: goal.targetDate ?? "",
    notes: goal.notes ?? "",
  };
}

function hasAdvancedDetails(form: GoalFormData) {
  return Boolean(form.horizonId || form.why.trim() || form.targetDate || form.notes.trim());
}

export function GoalFormDialog({
  form,
  editing,
  isPending,
  domains,
  horizons,
  parentGoal,
  onChangeForm,
  onSubmit,
  onCancel,
}: {
  form: GoalFormData;
  editing: boolean;
  isPending: boolean;
  domains: GoalDomainItem[];
  horizons: GoalHorizonItem[];
  parentGoal?: GoalOverviewItem | null;
  onChangeForm: (updater: (prev: GoalFormData) => GoalFormData) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const formRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    titleRef.current?.focus();
  }, []);

  const activeDomains = domains.filter((d) => !d.isArchived);
  const activeHorizons = horizons.filter((h) => !h.isArchived);
  const fallbackDomain = activeDomains.find((domain) => domain.id === form.domainId) ?? activeDomains[0] ?? null;
  const effectiveDomainId = form.domainId || fallbackDomain?.id || "";
  const [advancedOpen, setAdvancedOpen] = useState(
    editing || !fallbackDomain || hasAdvancedDetails(form),
  );
  const canSubmit = Boolean(form.title.trim() && effectiveDomainId);

  return (
    <div className="ghq-form" ref={formRef}>
      {parentGoal && (
        <div className="ghq-form__parent-context">
          <span className="ghq-form__parent-label">Child of</span>
          <span className="ghq-form__parent-title">{parentGoal.title}</span>
        </div>
      )}

      <label className="field">
        <span>Title</span>
        <input
          ref={titleRef}
          type="text"
          value={form.title}
          placeholder="What do you want to achieve?"
          onChange={(e) => onChangeForm((p) => ({ ...p, title: e.target.value }))}
        />
      </label>

      {!editing && (
        <div className="ghq-form__quick-note">
          <p>
            Capture the goal first. You can add planning structure and context now or refine it later.
          </p>
          {fallbackDomain ? (
            <span className="tag tag--neutral">Default domain: {fallbackDomain.name}</span>
          ) : (
            <span className="tag tag--warning">Create a domain in Settings before saving goals.</span>
          )}
        </div>
      )}

      {!editing && (
        <button
          className="button button--ghost button--small ghq-form__details-toggle"
          type="button"
          onClick={() => setAdvancedOpen((current) => !current)}
        >
          {advancedOpen ? "Hide details" : "Add details"}
        </button>
      )}

      {(editing || advancedOpen) && (
        <div className="ghq-form__advanced">
          <div className="ghq-form__row">
            <label className="field">
              <span>Domain</span>
              <select
                value={form.domainId}
                onChange={(e) => onChangeForm((p) => ({ ...p, domainId: e.target.value }))}
              >
                <option value="">Select domain</option>
                {activeDomains.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Horizon</span>
              <select
                value={form.horizonId}
                onChange={(e) => onChangeForm((p) => ({ ...p, horizonId: e.target.value }))}
              >
                <option value="">No horizon</option>
                {activeHorizons.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span>Why this goal matters (optional)</span>
            <textarea
              rows={2}
              value={form.why}
              placeholder="What is the deeper motivation?"
              onChange={(e) => onChangeForm((p) => ({ ...p, why: e.target.value }))}
            />
          </label>

          <label className="field">
            <span>Target date (optional)</span>
            <input
              type="date"
              value={form.targetDate}
              onChange={(e) => onChangeForm((p) => ({ ...p, targetDate: e.target.value }))}
            />
          </label>

          <label className="field">
            <span>Notes (optional)</span>
            <textarea
              rows={2}
              value={form.notes}
              placeholder="Context or reference links"
              onChange={(e) => onChangeForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </label>
        </div>
      )}

      <div className="button-row">
        <button
          className="button button--primary button--small"
          type="button"
          onClick={onSubmit}
          disabled={isPending || !canSubmit}
        >
          {editing ? "Update goal" : "Create goal"}
        </button>
        <button
          className="button button--ghost button--small"
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ── Suggested horizon for child goals ── */

export function suggestChildHorizon(
  parentHorizonId: string | null,
  horizons: GoalHorizonItem[],
): string {
  if (!parentHorizonId) return "";

  const active = horizons.filter((h) => !h.isArchived);
  const parentIdx = active.findIndex((h) => h.id === parentHorizonId);
  if (parentIdx < 0 || parentIdx >= active.length - 1) return "";

  return active[parentIdx + 1].id;
}
