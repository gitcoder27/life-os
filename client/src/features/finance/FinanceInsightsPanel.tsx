import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  formatMinorCurrency,
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

  const hasGoals = (insights?.moneyGoals.length ?? 0) > 0;
  const hasReviews = insights?.weeklyReview || insights?.monthlyReview;

  if (!hasGoals && !hasReviews && !errorMessage) {
    return null;
  }

  return (
    <section className="finance-insights">
      {errorMessage ? (
        <InlineErrorState message={errorMessage} onRetry={onRetry} />
      ) : null}

      {/* ── Goals (compact) ── */}
      {hasGoals && (
        <div className="rail__section">
          <div className="rail__section-header">
            <span className="mp__eyebrow">Goals</span>
            <Link to="/goals" className="button button--ghost button--small">
              Open goals
            </Link>
          </div>

          <div className="finance-goals-compact">
            {insights!.moneyGoals.map((goal) => (
              <div key={goal.goalId} className="goal-compact">
                <div className="goal-compact__header">
                  <div className="goal-compact__title-row">
                    <span className="goal-compact__title">{goal.title}</span>
                    {goal.goalType ? (
                      <span className="finance-goal__type">{financeGoalTypeLabels[goal.goalType]}</span>
                    ) : null}
                  </div>
                  <div className="goal-compact__actions">
                    <Link to={goal.route} className="button button--ghost button--small">Open</Link>
                    <button
                      className="button button--ghost button--small"
                      type="button"
                      onClick={() => openGoalEditor(goal)}
                    >
                      Edit
                    </button>
                  </div>
                </div>
                <div className="goal-compact__bar-row">
                  <div className="finance-goal__track">
                    <div
                      className="finance-goal__fill"
                      style={{ width: `${Math.min(goal.progressPercent, 100)}%` }}
                    />
                  </div>
                  <span className="goal-compact__percent">{goal.progressPercent}%</span>
                </div>
                <div className="goal-compact__amounts">
                  {goal.currentAmountMinor != null && (
                    <span>{formatMinorCurrency(goal.currentAmountMinor, currencyCode)}</span>
                  )}
                  {goal.targetAmountMinor != null && (
                    <span className="goal-compact__target">of {formatMinorCurrency(goal.targetAmountMinor, currencyCode)}</span>
                  )}
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
                        {savingGoalId === goal.goalId ? "Saving..." : "Save"}
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
        </div>
      )}

      {!hasGoals && !errorMessage && (
        <div className="rail__section">
          <div className="rail__section-header">
            <span className="mp__eyebrow">Goals</span>
          </div>
          <div className="finance-empty">
            <p>No money goals yet.</p>
            <Link to="/goals" className="button button--ghost button--small">
              Go to goals
            </Link>
          </div>
        </div>
      )}

      {/* ── Reviews (compact links) ── */}
      {hasReviews && (
        <div className="rail__section">
          <span className="mp__eyebrow">Reviews</span>
          <div className="review-links">
            {insights?.weeklyReview && (
              <Link to={insights.weeklyReview.route} className="review-link">
                <span className="review-link__label">Weekly review</span>
                <span className="review-link__value">
                  {formatMinorCurrency(insights.weeklyReview.spendingTotalMinor, currencyCode)} spent
                </span>
                <span className="review-link__meta">
                  {formatShortDate(insights.weeklyReview.startDate)} – {formatShortDate(insights.weeklyReview.endDate)}
                </span>
              </Link>
            )}
            {insights?.monthlyReview && (
              <Link to={insights.monthlyReview.route} className="review-link">
                <span className="review-link__label">Monthly review</span>
                <span className="review-link__value">
                  {insights.monthlyReview.monthVerdict ?? "Summary ready"}
                </span>
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
