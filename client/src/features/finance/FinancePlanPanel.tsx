import { useEffect, useMemo, useState } from "react";

import {
  formatDueLabel,
  formatMinorCurrency,
  formatShortDate,
  parseAmountToMinor,
  type FinanceMonthPlanItem,
  type UpdateFinanceMonthPlanRequest,
} from "../../shared/lib/api";
import { InlineErrorState } from "../../shared/ui/PageState";

type CategoryOption = {
  id: string;
  name: string;
  color: string | null;
};

type BillItem = FinanceMonthPlanItem["billTimeline"]["today"][number];

type PlanDraft = {
  plannedSpend: string;
  fixedObligations: string;
  flexibleTarget: string;
  plannedIncome: string;
  expectedLargeExpenses: string;
  categoryWatches: Array<{
    expenseCategoryId: string;
    watchLimit: string;
  }>;
};

type FinancePlanPanelProps = {
  monthPlan: FinanceMonthPlanItem | null;
  monthTotalSpentMinor: number;
  previousMonthTotalSpentMinor: number;
  currencyCode: string;
  categories: CategoryOption[];
  isCurrentMonth: boolean;
  errorMessage: string | null;
  isSaving: boolean;
  onRetry: () => void;
  onSave: (payload: UpdateFinanceMonthPlanRequest) => Promise<unknown>;
};

const emptyDraft: PlanDraft = {
  plannedSpend: "",
  fixedObligations: "",
  flexibleTarget: "",
  plannedIncome: "",
  expectedLargeExpenses: "",
  categoryWatches: [],
};

const toInputValue = (amountMinor: number | null) => {
  if (amountMinor == null) {
    return "";
  }

  return (amountMinor / 100).toFixed(2).replace(/\.00$/, "");
};

const buildDraft = (monthPlan: FinanceMonthPlanItem | null): PlanDraft => {
  if (!monthPlan) {
    return emptyDraft;
  }

  return {
    plannedSpend: toInputValue(monthPlan.plannedSpendMinor),
    fixedObligations: toInputValue(monthPlan.fixedObligationsMinor),
    flexibleTarget: toInputValue(monthPlan.flexibleSpendTargetMinor),
    plannedIncome: toInputValue(monthPlan.plannedIncomeMinor),
    expectedLargeExpenses: toInputValue(monthPlan.expectedLargeExpensesMinor),
    categoryWatches: monthPlan.categoryWatches.map((watch) => ({
      expenseCategoryId: watch.expenseCategoryId,
      watchLimit: toInputValue(watch.watchLimitMinor),
    })),
  };
};

const getPaceTone = (paceStatus: FinanceMonthPlanItem["paceStatus"]) => {
  switch (paceStatus) {
    case "on_pace":
      return "plan-panel__status--positive";
    case "slightly_heavy":
      return "plan-panel__status--warning";
    case "off_track":
      return "plan-panel__status--negative";
    default:
      return "";
  }
};

const getWatchTone = (status: FinanceMonthPlanItem["categoryWatches"][number]["status"]) => {
  switch (status) {
    case "over_limit":
      return "watch-row__status--negative";
    case "near_limit":
      return "watch-row__status--warning";
    default:
      return "watch-row__status--positive";
  }
};

const getBillGroups = (monthPlan: FinanceMonthPlanItem | null) => {
  if (!monthPlan) {
    return [];
  }

  return [
    { key: "today", label: "Today and overdue", items: monthPlan.billTimeline.today },
    { key: "thisWeek", label: "This week", items: monthPlan.billTimeline.thisWeek },
    { key: "laterThisMonth", label: "Later this month", items: monthPlan.billTimeline.laterThisMonth },
  ].filter((group) => group.items.length > 0);
};

export const FinancePlanPanel = ({
  monthPlan,
  monthTotalSpentMinor,
  previousMonthTotalSpentMinor,
  currencyCode,
  categories,
  isCurrentMonth,
  errorMessage,
  isSaving,
  onRetry,
  onSave,
}: FinancePlanPanelProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<PlanDraft>(() => buildDraft(monthPlan));

  useEffect(() => {
    setDraft(buildDraft(monthPlan));
    setIsEditing(false);
  }, [monthPlan?.id, monthPlan?.month]);

  const billGroups = useMemo(() => getBillGroups(monthPlan), [monthPlan]);
  const paceTone = monthPlan ? getPaceTone(monthPlan.paceStatus) : "";
  const monthDelta =
    previousMonthTotalSpentMinor > 0
      ? Math.round(((monthTotalSpentMinor - previousMonthTotalSpentMinor) / previousMonthTotalSpentMinor) * 100)
      : null;
  const paceBarWidth = (() => {
    if (!monthPlan?.expectedSpendToDateMinor || monthPlan.expectedSpendToDateMinor <= 0) {
      return Math.min((monthTotalSpentMinor / Math.max(previousMonthTotalSpentMinor, 1)) * 100, 100);
    }

    return Math.min((monthTotalSpentMinor / monthPlan.expectedSpendToDateMinor) * 100, 100);
  })();

  const availableCategoryOptions = categories.filter((category) =>
    !draft.categoryWatches.some((watch) => watch.expenseCategoryId === category.id),
  );

  const updateDraftValue = (key: keyof Omit<PlanDraft, "categoryWatches">, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const updateWatch = (index: number, patch: Partial<PlanDraft["categoryWatches"][number]>) => {
    setDraft((current) => ({
      ...current,
      categoryWatches: current.categoryWatches.map((watch, watchIndex) =>
        watchIndex === index ? { ...watch, ...patch } : watch,
      ),
    }));
  };

  const removeWatch = (index: number) => {
    setDraft((current) => ({
      ...current,
      categoryWatches: current.categoryWatches.filter((_, watchIndex) => watchIndex !== index),
    }));
  };

  const addWatch = () => {
    const nextCategory = availableCategoryOptions[0];
    if (!nextCategory) {
      return;
    }

    setDraft((current) => ({
      ...current,
      categoryWatches: [
        ...current.categoryWatches,
        {
          expenseCategoryId: nextCategory.id,
          watchLimit: "",
        },
      ],
    }));
  };

  const handleSave = async () => {
    const payload: UpdateFinanceMonthPlanRequest = {
      plannedSpendMinor: draft.plannedSpend ? parseAmountToMinor(draft.plannedSpend) : null,
      fixedObligationsMinor: draft.fixedObligations ? parseAmountToMinor(draft.fixedObligations) : null,
      flexibleSpendTargetMinor: draft.flexibleTarget ? parseAmountToMinor(draft.flexibleTarget) : null,
      plannedIncomeMinor: draft.plannedIncome ? parseAmountToMinor(draft.plannedIncome) : null,
      expectedLargeExpensesMinor: draft.expectedLargeExpenses ? parseAmountToMinor(draft.expectedLargeExpenses) : null,
      categoryWatches: draft.categoryWatches
        .map((watch) => ({
          expenseCategoryId: watch.expenseCategoryId,
          watchLimitMinor: parseAmountToMinor(watch.watchLimit) ?? 0,
        }))
        .filter((watch) => Boolean(watch.expenseCategoryId) && watch.watchLimitMinor > 0),
    };

    await onSave(payload);
    setIsEditing(false);
  };

  return (
    <aside className="plan-panel">
      <div className="plan-panel__hero">
        <div>
          <span className="plan-panel__eyebrow">Monthly plan</span>
          <h2 className="plan-panel__title">
            {monthPlan?.plannedSpendMinor != null
              ? formatMinorCurrency(monthPlan.plannedSpendMinor, currencyCode)
              : "Set a target"}
          </h2>
          <p className="plan-panel__copy">
            {monthPlan?.paceSummary ?? "Add a monthly target and a few watch limits so this page can tell you when spending is drifting."}
          </p>
        </div>
        <div className="plan-panel__hero-actions">
          {monthPlan ? (
            <span className={`plan-panel__status ${paceTone}`}>
              {monthPlan.paceStatus === "no_plan"
                ? "No plan"
                : monthPlan.paceStatus === "on_pace"
                  ? "On pace"
                  : monthPlan.paceStatus === "slightly_heavy"
                    ? "Slightly heavy"
                    : "Off track"}
            </span>
          ) : null}
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={() => {
              if (isEditing) {
                setDraft(buildDraft(monthPlan));
              }
              setIsEditing((value) => !value);
            }}
          >
            {isEditing ? "Cancel" : monthPlan ? "Edit plan" : "Set plan"}
          </button>
        </div>
      </div>

      <div className="plan-panel__metrics">
        <div className="plan-metric">
          <span className="plan-metric__label">Actual spend</span>
          <span className="plan-metric__value">{formatMinorCurrency(monthTotalSpentMinor, currencyCode)}</span>
          {monthDelta != null ? (
            <span className={`plan-metric__detail${monthDelta > 0 ? " plan-metric__detail--negative" : " plan-metric__detail--positive"}`}>
              {monthDelta > 0 ? "+" : ""}{monthDelta}% vs last month
            </span>
          ) : (
            <span className="plan-metric__detail">First tracked comparison month</span>
          )}
        </div>
        <div className="plan-metric">
          <span className="plan-metric__label">Expected by now</span>
          <span className="plan-metric__value">
            {monthPlan?.expectedSpendToDateMinor != null
              ? formatMinorCurrency(monthPlan.expectedSpendToDateMinor, currencyCode)
              : "No plan"}
          </span>
          <span className="plan-metric__detail">
            {isCurrentMonth ? "Current month pace target" : "Full month view"}
          </span>
        </div>
        <div className="plan-metric">
          <span className="plan-metric__label">Flexible left</span>
          <span className="plan-metric__value">
            {monthPlan?.remainingFlexibleSpendMinor != null
              ? formatMinorCurrency(monthPlan.remainingFlexibleSpendMinor, currencyCode)
              : "No target"}
          </span>
          <span className="plan-metric__detail">After fixed obligations</span>
        </div>
      </div>

      <div className="plan-panel__pace">
        <div className="plan-panel__pace-track">
          <div className={`plan-panel__pace-fill ${paceTone}`} style={{ width: `${paceBarWidth}%` }} />
        </div>
        <div className="plan-panel__pace-legend">
          <span>Actual</span>
          <span>
            {monthPlan?.remainingPlannedSpendMinor != null
              ? `${formatMinorCurrency(monthPlan.remainingPlannedSpendMinor, currencyCode)} left to target`
              : "Plan not set"}
          </span>
        </div>
      </div>

      {errorMessage ? (
        <InlineErrorState message={errorMessage} onRetry={onRetry} />
      ) : null}

      {isEditing ? (
        <div className="plan-editor">
          <div className="plan-editor__grid">
            <label className="field">
              <span>Planned monthly spend</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={draft.plannedSpend}
                onChange={(event) => updateDraftValue("plannedSpend", event.target.value)}
              />
            </label>
            <label className="field">
              <span>Fixed obligations</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={draft.fixedObligations}
                onChange={(event) => updateDraftValue("fixedObligations", event.target.value)}
              />
            </label>
            <label className="field">
              <span>Flexible target</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={draft.flexibleTarget}
                onChange={(event) => updateDraftValue("flexibleTarget", event.target.value)}
              />
            </label>
            <label className="field">
              <span>Planned income / paydays</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={draft.plannedIncome}
                onChange={(event) => updateDraftValue("plannedIncome", event.target.value)}
              />
            </label>
            <label className="field">
              <span>Large one-off costs</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={draft.expectedLargeExpenses}
                onChange={(event) => updateDraftValue("expectedLargeExpenses", event.target.value)}
              />
            </label>
          </div>

          <div className="plan-editor__section">
            <div className="plan-editor__section-header">
              <div>
                <span className="plan-panel__eyebrow">Watched categories</span>
                <p className="plan-editor__hint">Use watch limits for categories that tend to drift first.</p>
              </div>
              <button
                className="button button--ghost button--small"
                type="button"
                onClick={addWatch}
                disabled={availableCategoryOptions.length === 0}
              >
                Add watch
              </button>
            </div>

            {draft.categoryWatches.length > 0 ? (
              <div className="plan-editor__watches">
                {draft.categoryWatches.map((watch, index) => (
                  <div key={`${watch.expenseCategoryId}-${index}`} className="plan-editor__watch-row">
                    <label className="field">
                      <span>Category</span>
                      <select
                        value={watch.expenseCategoryId}
                        onChange={(event) => updateWatch(index, { expenseCategoryId: event.target.value })}
                      >
                        {categories
                          .filter((category) =>
                            category.id === watch.expenseCategoryId
                            || !draft.categoryWatches.some((item) => item.expenseCategoryId === category.id),
                          )
                          .map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Watch limit</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={watch.watchLimit}
                        onChange={(event) => updateWatch(index, { watchLimit: event.target.value })}
                      />
                    </label>
                    <button
                      className="button button--ghost button--small"
                      type="button"
                      onClick={() => removeWatch(index)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="plan-editor__hint">No watched categories yet.</p>
            )}
          </div>

          <div className="button-row">
            <button
              className="button button--primary button--small"
              type="button"
              disabled={isSaving}
              onClick={() => void handleSave()}
            >
              {isSaving ? "Saving..." : "Save monthly plan"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="plan-panel__support-grid">
            <div className="plan-support">
              <span className="plan-support__label">Planned income</span>
              <span className="plan-support__value">
                {monthPlan?.plannedIncomeMinor != null
                  ? formatMinorCurrency(monthPlan.plannedIncomeMinor, currencyCode)
                  : "Not set"}
              </span>
            </div>
            <div className="plan-support">
              <span className="plan-support__label">Fixed obligations</span>
              <span className="plan-support__value">
                {monthPlan?.fixedObligationsMinor != null
                  ? formatMinorCurrency(monthPlan.fixedObligationsMinor, currencyCode)
                  : "Not set"}
              </span>
            </div>
            <div className="plan-support">
              <span className="plan-support__label">Large one-offs</span>
              <span className="plan-support__value">
                {monthPlan?.expectedLargeExpensesMinor != null
                  ? formatMinorCurrency(monthPlan.expectedLargeExpensesMinor, currencyCode)
                  : "Not set"}
              </span>
            </div>
          </div>

          <div className="plan-section">
            <div className="plan-section__header">
              <span className="plan-panel__eyebrow">Bill timeline</span>
              <span className="plan-section__meta">
                {billGroups.reduce((sum, group) => sum + group.items.length, 0)} upcoming
              </span>
            </div>
            {billGroups.length > 0 ? (
              <div className="timeline-list">
                {billGroups.map((group) => (
                  <div key={group.key} className="timeline-group">
                    <div className="timeline-group__label">{group.label}</div>
                    <div className="timeline-group__items">
                      {group.items.map((bill: BillItem) => (
                        <div key={bill.id} className="timeline-item">
                          <div>
                            <div className="timeline-item__title">{bill.title}</div>
                            <div className="timeline-item__meta">
                              {group.key === "today" ? formatDueLabel(bill.dueOn) : formatShortDate(bill.dueOn)}
                            </div>
                          </div>
                          <span className="timeline-item__amount">
                            {bill.amountMinor != null
                              ? formatMinorCurrency(bill.amountMinor, currencyCode)
                              : "Amount open"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="plan-editor__hint">No pending bills for this month.</p>
            )}
          </div>

          <div className="plan-section">
            <div className="plan-section__header">
              <span className="plan-panel__eyebrow">Category watch</span>
              <span className="plan-section__meta">{monthPlan?.categoryWatches.length ?? 0} active</span>
            </div>
            {monthPlan?.categoryWatches.length ? (
              <div className="watch-list">
                {monthPlan.categoryWatches.map((watch) => {
                  const ratio = watch.watchLimitMinor > 0
                    ? Math.min((watch.actualSpentMinor / watch.watchLimitMinor) * 100, 100)
                    : 0;

                  return (
                    <div key={watch.expenseCategoryId} className="watch-row">
                      <div className="watch-row__header">
                        <span className="watch-row__name">
                          <span className="watch-row__dot" style={{ background: watch.color ?? "var(--text-tertiary)" }} />
                          {watch.name}
                        </span>
                        <span className={`watch-row__status ${getWatchTone(watch.status)}`}>
                          {watch.status === "within_limit"
                            ? "Within limit"
                            : watch.status === "near_limit"
                              ? "Near limit"
                              : "Over limit"}
                        </span>
                      </div>
                      <div className="watch-row__meta">
                        <span>{formatMinorCurrency(watch.actualSpentMinor, currencyCode)} spent</span>
                        <span>{formatMinorCurrency(watch.watchLimitMinor, currencyCode)} limit</span>
                      </div>
                      <div className="watch-row__track">
                        <div className={`watch-row__fill ${getWatchTone(watch.status)}`} style={{ width: `${ratio}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="plan-editor__hint">No category watches yet. Add a few categories you want to keep tight.</p>
            )}
          </div>
        </>
      )}
    </aside>
  );
};
