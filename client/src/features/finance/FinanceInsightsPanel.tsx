import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  formatMinorCurrency,
  formatMonthLabel,
  formatShortDate,
  parseAmountToMinor,
  type FinanceGoalInsightItem,
  type FinanceGoalType,
  type FinanceInsightsItem,
  type UpdateFinanceGoalRequest,
} from "../../shared/lib/api";
import { InlineErrorState } from "../../shared/ui/PageState";

type FinanceInsightsPanelProps = {
  insights: FinanceInsightsItem | null;
  currencyCode: string;
  errorMessage: string | null;
  savingGoalId: string | null;
  onRetry: () => void;
  onSaveGoal: (goalId: string, payload: UpdateFinanceGoalRequest) => Promise<unknown>;
};

type GoalDraft = {
  goalType: FinanceGoalType | "";
  targetAmount: string;
  currentAmount: string;
  monthlyContribution: string;
};

const financeGoalTypeLabels: Record<FinanceGoalType, string> = {
  emergency_fund: "Emergency fund",
  debt_payoff: "Debt payoff",
  travel: "Travel",
  large_purchase: "Large purchase",
  other: "Other",
};

const toAmountInput = (amountMinor: number | null) => {
  if (amountMinor == null) {
    return "";
  }

  return (amountMinor / 100).toFixed(2).replace(/\.00$/, "");
};

const buildDraft = (goal: FinanceGoalInsightItem): GoalDraft => ({
  goalType: goal.goalType ?? "",
  targetAmount: toAmountInput(goal.targetAmountMinor),
  currentAmount: toAmountInput(goal.currentAmountMinor),
  monthlyContribution: toAmountInput(goal.monthlyContributionTargetMinor),
});

const getFitClassName = (fit: FinanceGoalInsightItem["contributionFit"]) => {
  switch (fit) {
    case "on_track":
      return "finance-goal__fit finance-goal__fit--positive";
    case "tight":
      return "finance-goal__fit finance-goal__fit--warning";
    default:
      return "finance-goal__fit";
  }
};

export const FinanceInsightsPanel = ({
  insights,
  currencyCode,
  errorMessage,
  savingGoalId,
  onRetry,
  onSaveGoal,
}: FinanceInsightsPanelProps) => {
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [draft, setDraft] = useState<GoalDraft | null>(null);

  useEffect(() => {
    setEditingGoalId(null);
    setDraft(null);
  }, [insights?.month]);

  const openGoalEditor = (goal: FinanceGoalInsightItem) => {
    setEditingGoalId(goal.goalId);
    setDraft(buildDraft(goal));
  };

  const handleSaveGoal = async (goalId: string) => {
    if (!draft) {
      return;
    }

    await onSaveGoal(goalId, {
      goalType: draft.goalType || null,
      targetAmountMinor: draft.targetAmount ? parseAmountToMinor(draft.targetAmount) : null,
      currentAmountMinor: draft.currentAmount ? parseAmountToMinor(draft.currentAmount) : null,
      monthlyContributionTargetMinor: draft.monthlyContribution ? parseAmountToMinor(draft.monthlyContribution) : null,
    });

    setEditingGoalId(null);
    setDraft(null);
  };

  return (
    <section className="finance-insights">
      <div className="finance-insights__header">
        <div>
          <span className="mp__eyebrow">Finance compass</span>
          <h3 className="finance-insights__title">Goals and review context</h3>
        </div>
        <Link to="/goals" className="button button--ghost button--small">
          Open goals
        </Link>
      </div>

      {errorMessage ? (
        <InlineErrorState message={errorMessage} onRetry={onRetry} />
      ) : null}

      {insights?.currentFocus ? (
        <div className="finance-focus">
          <div className="finance-focus__header">
            <span className="mp__eyebrow">Live focus</span>
            <Link to={insights.currentFocus.route} className="button button--ghost button--small">
              Weekly review
            </Link>
          </div>
          <div className="finance-focus__name">
            <span
              className="watch-row__dot"
              style={{ background: insights.currentFocus.color ?? "var(--text-tertiary)" }}
            />
            {insights.currentFocus.name}
          </div>
          <p className="finance-focus__copy">{insights.currentFocus.guidance}</p>
          <div className="finance-focus__meta">
            <span>{formatMinorCurrency(insights.currentFocus.monthSpentMinor, currencyCode)} spent this month</span>
            <span>Watch this category first</span>
          </div>
        </div>
      ) : null}

      <div className="finance-insights__section">
        <div className="finance-insights__section-header">
          <span className="mp__eyebrow">Money goals</span>
          <span className="finance-insights__meta">
            {insights?.moneyGoals.length ?? 0} active
          </span>
        </div>

        {insights?.moneyGoals.length ? (
          <div className="finance-goals">
            {insights.moneyGoals.map((goal) => (
              <div key={goal.goalId} className="finance-goal">
                <div className="finance-goal__header">
                  <div>
                    <div className="finance-goal__title-row">
                      <span className="finance-goal__title">{goal.title}</span>
                      {goal.goalType ? (
                        <span className="finance-goal__type">{financeGoalTypeLabels[goal.goalType]}</span>
                      ) : null}
                    </div>
                    <div className="finance-goal__meta">
                      <span>{goal.progressPercent}% progress</span>
                      {goal.nextMilestoneTitle ? (
                        <span>
                          Next: {goal.nextMilestoneTitle}
                          {goal.nextMilestoneDate ? ` by ${formatShortDate(goal.nextMilestoneDate)}` : ""}
                        </span>
                      ) : goal.targetDate ? (
                        <span>Target date {formatShortDate(goal.targetDate)}</span>
                      ) : (
                        <span>No next milestone set</span>
                      )}
                    </div>
                  </div>
                  <div className="finance-goal__header-actions">
                    <Link to={goal.route} className="button button--ghost button--small">
                      Open
                    </Link>
                    <button
                      className="button button--ghost button--small"
                      type="button"
                      onClick={() => openGoalEditor(goal)}
                    >
                      {goal.targetAmountMinor != null || goal.currentAmountMinor != null ? "Edit" : "Set numbers"}
                    </button>
                  </div>
                </div>

                <div className="finance-goal__amounts">
                  <div className="finance-goal__amount-block">
                    <span className="finance-goal__amount-label">Saved / paid down</span>
                    <span className="finance-goal__amount-value">
                      {goal.currentAmountMinor != null
                        ? formatMinorCurrency(goal.currentAmountMinor, currencyCode)
                        : "Not set"}
                    </span>
                  </div>
                  <div className="finance-goal__amount-block">
                    <span className="finance-goal__amount-label">Goal target</span>
                    <span className="finance-goal__amount-value">
                      {goal.targetAmountMinor != null
                        ? formatMinorCurrency(goal.targetAmountMinor, currencyCode)
                        : "Not set"}
                    </span>
                  </div>
                  <div className="finance-goal__amount-block">
                    <span className="finance-goal__amount-label">Monthly contribution plan</span>
                    <span className="finance-goal__amount-value">
                      {goal.monthlyContributionTargetMinor != null
                        ? formatMinorCurrency(goal.monthlyContributionTargetMinor, currencyCode)
                        : "Not set"}
                    </span>
                  </div>
                </div>

                <div className="finance-goal__track">
                  <div
                    className="finance-goal__fill"
                    style={{ width: `${Math.min(goal.progressPercent, 100)}%` }}
                  />
                </div>

                <div className="finance-goal__footer">
                  <span className={getFitClassName(goal.contributionFit)}>
                    {goal.contributionFit === "on_track"
                      ? "Fits this month"
                      : goal.contributionFit === "tight"
                        ? "Tight this month"
                        : "Needs contribution plan"}
                  </span>
                  <span className="finance-goal__summary">{goal.contributionSummary}</span>
                </div>

                {editingGoalId === goal.goalId && draft ? (
                  <div className="finance-goal__editor">
                    <div className="mp__editor-grid">
                      <label className="field">
                        <span>Goal type</span>
                        <select
                          value={draft.goalType}
                          onChange={(event) => setDraft((current) =>
                            current
                              ? { ...current, goalType: event.target.value as GoalDraft["goalType"] }
                              : current
                          )}
                        >
                          <option value="">Select type</option>
                          {Object.entries(financeGoalTypeLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>Target amount</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={draft.targetAmount}
                          onChange={(event) => setDraft((current) =>
                            current ? { ...current, targetAmount: event.target.value } : current
                          )}
                        />
                      </label>
                      <label className="field">
                        <span>Current progress</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={draft.currentAmount}
                          onChange={(event) => setDraft((current) =>
                            current ? { ...current, currentAmount: event.target.value } : current
                          )}
                        />
                      </label>
                      <label className="field">
                        <span>Monthly contribution</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={draft.monthlyContribution}
                          onChange={(event) => setDraft((current) =>
                            current ? { ...current, monthlyContribution: event.target.value } : current
                          )}
                        />
                      </label>
                    </div>
                    <div className="button-row">
                      <button
                        className="button button--primary button--small"
                        type="button"
                        disabled={savingGoalId === goal.goalId}
                        onClick={() => void handleSaveGoal(goal.goalId)}
                      >
                        {savingGoalId === goal.goalId ? "Saving..." : "Save goal finance"}
                      </button>
                      <button
                        className="button button--ghost button--small"
                        type="button"
                        onClick={() => {
                          setEditingGoalId(null);
                          setDraft(null);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="finance-empty">
            <p>No money goals yet. Add one in Goals, then connect the amounts here.</p>
            <Link to="/goals" className="button button--ghost button--small">
              Go to goals
            </Link>
          </div>
        )}
      </div>

      <div className="finance-insights__section">
        <div className="finance-insights__section-header">
          <span className="mp__eyebrow">Review blocks</span>
          <span className="finance-insights__meta">
            {insights?.month ? formatMonthLabel(insights.month) : "Selected month"}
          </span>
        </div>
        <div className="review-cards">
          {insights?.weeklyReview ? (
            <div className="review-card">
              <div className="review-card__header">
                <div>
                  <span className="mp__eyebrow">Weekly finance review</span>
                  <h4 className="review-card__title">
                    {formatMinorCurrency(insights.weeklyReview.spendingTotalMinor, currencyCode)} spent
                  </h4>
                </div>
                <Link to={insights.weeklyReview.route} className="button button--ghost button--small">
                  Open weekly review
                </Link>
              </div>
              <div className="review-card__meta">
                <span>{formatShortDate(insights.weeklyReview.startDate)} to {formatShortDate(insights.weeklyReview.endDate)}</span>
                <span>{insights.weeklyReview.topSpendCategory ?? "No spend category yet"}</span>
              </div>
              <div className="review-card__body">
                <p>
                  <strong>Keep:</strong> {insights.weeklyReview.keepText ?? "No weekly review submitted yet."}
                </p>
                <p>
                  <strong>Adjust:</strong> {insights.weeklyReview.improveText ?? "Open the weekly review to decide the money category to watch next."}
                </p>
                {insights.weeklyReview.spendWatchCategoryName ? (
                  <p>
                    <strong>Spend watch:</strong> {insights.weeklyReview.spendWatchCategoryName}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {insights?.monthlyReview ? (
            <div className="review-card">
              <div className="review-card__header">
                <div>
                  <span className="mp__eyebrow">Monthly finance review</span>
                  <h4 className="review-card__title">
                    {insights.monthlyReview.monthVerdict ?? "Monthly summary ready"}
                  </h4>
                </div>
                <Link to={insights.monthlyReview.route} className="button button--ghost button--small">
                  Open monthly review
                </Link>
              </div>
              <div className="review-card__meta">
                <span>{formatShortDate(insights.monthlyReview.startDate)} to {formatShortDate(insights.monthlyReview.endDate)}</span>
                <span>{insights.monthlyReview.topSpendingCategories[0]?.category ?? "No top category yet"}</span>
              </div>
              <div className="review-card__body">
                <p>
                  <strong>What improved:</strong> {insights.monthlyReview.biggestWin ?? "No monthly review submitted yet."}
                </p>
                <p>
                  <strong>Leak to fix:</strong> {insights.monthlyReview.biggestLeak ?? "Use the monthly review to capture the main money leak."}
                </p>
                <p>
                  <strong>Next theme:</strong> {insights.monthlyReview.nextMonthTheme ?? "No next-month theme set yet."}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};
