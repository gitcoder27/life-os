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

type CategoryTotal = {
  expenseCategoryId: string | null;
  name: string;
  color: string | null;
  totalAmountMinor: number;
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
  categoryTotals: CategoryTotal[];
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

const getPaceLabel = (paceStatus: FinanceMonthPlanItem["paceStatus"]) => {
  switch (paceStatus) {
    case "on_pace": return "On pace";
    case "slightly_heavy": return "Slightly heavy";
    case "off_track": return "Off track";
    default: return "No plan";
  }
};

const getPaceTone = (paceStatus: FinanceMonthPlanItem["paceStatus"]) => {
  switch (paceStatus) {
    case "on_pace": return "positive";
    case "slightly_heavy": return "warning";
    case "off_track": return "negative";
    default: return "neutral";
  }
};

const getWatchTone = (status: FinanceMonthPlanItem["categoryWatches"][number]["status"]) => {
  switch (status) {
    case "over_limit": return "negative";
    case "near_limit": return "warning";
    default: return "positive";
  }
};

const getWatchLabel = (status: FinanceMonthPlanItem["categoryWatches"][number]["status"]) => {
  switch (status) {
    case "over_limit": return "Over";
    case "near_limit": return "Near";
    default: return "OK";
  }
};

const getBillGroups = (monthPlan: FinanceMonthPlanItem | null) => {
  if (!monthPlan) {
    return [];
  }

  return [
    { key: "today", label: "Due now", items: monthPlan.billTimeline.today },
    { key: "thisWeek", label: "This week", items: monthPlan.billTimeline.thisWeek },
    { key: "laterThisMonth", label: "Later", items: monthPlan.billTimeline.laterThisMonth },
  ].filter((group) => group.items.length > 0);
};

export const FinancePlanPanel = ({
  monthPlan,
  monthTotalSpentMinor,
  previousMonthTotalSpentMinor,
  currencyCode,
  categories,
  categoryTotals,
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
  const paceTone = monthPlan ? getPaceTone(monthPlan.paceStatus) : "neutral";
  const monthDelta =
    previousMonthTotalSpentMinor > 0
      ? Math.round(((monthTotalSpentMinor - previousMonthTotalSpentMinor) / previousMonthTotalSpentMinor) * 100)
      : null;
  const pacePercent = (() => {
    if (monthPlan?.plannedSpendMinor && monthPlan.plannedSpendMinor > 0) {
      return Math.min((monthTotalSpentMinor / monthPlan.plannedSpendMinor) * 100, 100);
    }
    if (previousMonthTotalSpentMinor > 0) {
      return Math.min((monthTotalSpentMinor / previousMonthTotalSpentMinor) * 100, 100);
    }
    return 0;
  })();

  const totalBillCount = billGroups.reduce((sum, group) => sum + group.items.length, 0);

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

  const hasPlan = monthPlan?.plannedSpendMinor != null;

  return (
    <aside className="mp">
      {/* ── Header row ── */}
      <div className="mp__head">
        <span className="mp__eyebrow">Monthly plan</span>
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
          {isEditing ? "Cancel" : hasPlan ? "Edit" : "Set plan"}
        </button>
      </div>

      {/* ── Hero: target amount + pace badge ── */}
      <div className="mp__hero">
        <span className="mp__target">
          {hasPlan
            ? formatMinorCurrency(monthPlan!.plannedSpendMinor!, currencyCode)
            : "No target set"}
        </span>
        {hasPlan && (
          <span className={`mp__pace-badge mp__pace-badge--${paceTone}`}>
            {getPaceLabel(monthPlan!.paceStatus)}
          </span>
        )}
      </div>

      {/* ── Pace bar ── */}
      <div className="mp__bar">
        <div className="mp__bar-track">
          <div className={`mp__bar-fill mp__bar-fill--${paceTone}`} style={{ width: `${pacePercent}%` }} />
        </div>
        <div className="mp__bar-labels">
          <span>{formatMinorCurrency(monthTotalSpentMinor, currencyCode)} spent</span>
          <span>
            {monthPlan?.remainingPlannedSpendMinor != null
              ? `${formatMinorCurrency(monthPlan.remainingPlannedSpendMinor, currencyCode)} left`
              : hasPlan ? "Calculating..." : "—"}
          </span>
        </div>
      </div>

      {errorMessage ? (
        <InlineErrorState message={errorMessage} onRetry={onRetry} />
      ) : null}

      {isEditing ? (
        /* ── EDIT MODE ── */
        <div className="mp__editor">
          <div className="mp__editor-grid">
            <label className="field">
              <span>Monthly target</span>
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
              <span>Planned income</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={draft.plannedIncome}
                onChange={(event) => updateDraftValue("plannedIncome", event.target.value)}
              />
            </label>
            <label className="field">
              <span>Large one-offs</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={draft.expectedLargeExpenses}
                onChange={(event) => updateDraftValue("expectedLargeExpenses", event.target.value)}
              />
            </label>
          </div>

          <div className="mp__editor-section">
            <div className="mp__editor-section-head">
              <span className="mp__sub-label">Watched categories</span>
              <button
                className="button button--ghost button--small"
                type="button"
                onClick={addWatch}
                disabled={availableCategoryOptions.length === 0}
              >
                + Add
              </button>
            </div>

            {draft.categoryWatches.length > 0 ? (
              <div className="mp__editor-watches">
                {draft.categoryWatches.map((watch, index) => (
                  <div key={`${watch.expenseCategoryId}-${index}`} className="mp__editor-watch-row">
                    <select
                      className="mp__editor-select"
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
                    <input
                      className="mp__editor-input"
                      type="text"
                      inputMode="decimal"
                      placeholder="Limit"
                      value={watch.watchLimit}
                      onChange={(event) => updateWatch(index, { watchLimit: event.target.value })}
                    />
                    <button
                      className="mp__editor-remove"
                      type="button"
                      onClick={() => removeWatch(index)}
                      aria-label="Remove watch"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mp__hint">No watches yet — add categories to track limits.</p>
            )}
          </div>

          <button
            className="button button--primary button--small"
            type="button"
            disabled={isSaving}
            onClick={() => void handleSave()}
            style={{ alignSelf: "flex-start" }}
          >
            {isSaving ? "Saving..." : "Save plan"}
          </button>
        </div>
      ) : (
        /* ── VIEW MODE ── */
        <>
          {/* ── Key figures row ── */}
          <div className="mp__figures">
            <div className="mp__fig">
              <span className="mp__fig-value">{formatMinorCurrency(monthTotalSpentMinor, currencyCode)}</span>
              <span className="mp__fig-label">
                Spent
                {monthDelta != null && (
                  <span className={monthDelta > 0 ? "mp__delta--negative" : "mp__delta--positive"}>
                    {" "}{monthDelta > 0 ? "+" : ""}{monthDelta}%
                  </span>
                )}
              </span>
            </div>
            <div className="mp__fig">
              <span className="mp__fig-value">
                {monthPlan?.expectedSpendToDateMinor != null
                  ? formatMinorCurrency(monthPlan.expectedSpendToDateMinor, currencyCode)
                  : "—"}
              </span>
              <span className="mp__fig-label">{isCurrentMonth ? "Expected" : "Full month"}</span>
            </div>
            <div className="mp__fig">
              <span className="mp__fig-value">
                {monthPlan?.remainingFlexibleSpendMinor != null
                  ? formatMinorCurrency(monthPlan.remainingFlexibleSpendMinor, currencyCode)
                  : "—"}
              </span>
              <span className="mp__fig-label">Flexible</span>
            </div>
          </div>

          {/* ── Top categories ── */}
          {categoryTotals.length > 0 && (
            <div className="mp__categories">
              <span className="mp__sub-label">Top categories</span>
              <div className="mp__cat-list">
                {categoryTotals.slice(0, 5).map((ct) => (
                  <div key={ct.expenseCategoryId ?? "uncategorized"} className="mp__cat-row">
                    <span className="mp__cat-name">
                      <span
                        className="mp__watch-dot"
                        style={{ background: ct.color ?? "var(--text-tertiary)" }}
                      />
                      {ct.name}
                    </span>
                    <span className="mp__cat-amount">
                      {formatMinorCurrency(ct.totalAmountMinor, currencyCode)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Category watches ── */}
          {(monthPlan?.categoryWatches.length ?? 0) > 0 && (
            <div className="mp__watches">
              <span className="mp__sub-label">Watched</span>
              {monthPlan!.categoryWatches.map((watch) => {
                const ratio = watch.watchLimitMinor > 0
                  ? Math.min((watch.actualSpentMinor / watch.watchLimitMinor) * 100, 100)
                  : 0;
                const tone = getWatchTone(watch.status);

                return (
                  <div key={watch.expenseCategoryId} className="mp__watch">
                    <div className="mp__watch-head">
                      <span className="mp__watch-name">
                        <span className="mp__watch-dot" style={{ background: watch.color ?? "var(--text-tertiary)" }} />
                        {watch.name}
                      </span>
                      <span className={`mp__watch-badge mp__watch-badge--${tone}`}>
                        {getWatchLabel(watch.status)}
                      </span>
                    </div>
                    <div className="mp__watch-bar">
                      <div className={`mp__watch-bar-fill mp__watch-bar-fill--${tone}`} style={{ width: `${ratio}%` }} />
                    </div>
                    <div className="mp__watch-nums">
                      <span>{formatMinorCurrency(watch.actualSpentMinor, currencyCode)}</span>
                      <span>of {formatMinorCurrency(watch.watchLimitMinor, currencyCode)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Bill timeline ── */}
          {totalBillCount > 0 && (
            <div className="mp__bills">
              <div className="mp__bills-head">
                <span className="mp__sub-label">Upcoming bills</span>
                <span className="mp__sub-count">{totalBillCount}</span>
              </div>
              {billGroups.map((group) => (
                <div key={group.key} className="mp__bill-group">
                  <span className="mp__bill-group-label">{group.label}</span>
                  {group.items.map((bill: BillItem) => (
                    <div key={bill.id} className="mp__bill-row">
                      <span className="mp__bill-title">{bill.title}</span>
                      <span className="mp__bill-meta">
                        {bill.amountMinor != null
                          ? formatMinorCurrency(bill.amountMinor, currencyCode)
                          : "Open"}
                        {" · "}
                        {group.key === "today" ? formatDueLabel(bill.dueOn) : formatShortDate(bill.dueOn)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </aside>
  );
};
