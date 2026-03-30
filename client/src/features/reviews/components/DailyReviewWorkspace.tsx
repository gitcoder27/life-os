import type { Dispatch, SetStateAction } from "react";

import type {
  DailyReviewMutationResponse,
  DailyReviewResponse,
  TaskItem,
} from "../../../shared/lib/api";
import { getQuickCaptureDisplayText } from "../../../shared/lib/quickCapture";
import { isRecurring } from "../../../shared/lib/recurrence";
import { EmptyState } from "../../../shared/ui/PageState";
import { RecurrenceBadge } from "../../../shared/ui/RecurrenceBadge";
import { SectionCard } from "../../../shared/ui/SectionCard";
import {
  formatClosedWindowStatus,
  type DailyInputs,
  type DailyPriorityDraft,
  type DailyTaskDecision,
} from "../reviewDraftModel";
import { isOutOfWindowError, type ReviewWindowPresentation } from "../reviewWindowModel";
import { ReviewSummaryPanel } from "./ReviewSummaryPanel";

type DailyReviewWorkspaceProps = {
  review: DailyReviewResponse;
  summaryItems: string[];
  dailyPendingTasks: TaskItem[];
  dailyInputs: DailyInputs;
  setDailyInputs: Dispatch<SetStateAction<DailyInputs>>;
  dailyTaskDecisions: Record<string, DailyTaskDecision>;
  setDailyTaskDecisions: Dispatch<SetStateAction<Record<string, DailyTaskDecision>>>;
  dailyTomorrowPriorities: DailyPriorityDraft[];
  setDailyTomorrowPriorities: Dispatch<SetStateAction<DailyPriorityDraft[]>>;
  tomorrow: string;
  isSubmitting: boolean;
  canSubmitDaily: boolean;
  isWindowOpen: boolean;
  dailySubmitBlockers: string[];
  draftStatusText: string;
  submitError: unknown;
  submitErrorText: string | null;
  submitResult: DailyReviewMutationResponse | null;
  windowPresentation: ReviewWindowPresentation | null;
  onSubmit: () => void;
};

const DailyPendingTasksPanel = ({
  dailyPendingTasks,
  dailyTaskDecisions,
  setDailyTaskDecisions,
  isDailyCompleted,
  tomorrow,
}: {
  dailyPendingTasks: TaskItem[];
  dailyTaskDecisions: Record<string, DailyTaskDecision>;
  setDailyTaskDecisions: Dispatch<SetStateAction<Record<string, DailyTaskDecision>>>;
  isDailyCompleted: boolean;
  tomorrow: string;
}) => (
  <SectionCard
    title="Pending tasks"
    subtitle={isDailyCompleted ? "Review closed" : "Choose one decision per task"}
  >
    {dailyPendingTasks.length > 0 ? (
      <div className="review-decision-list">
        {dailyPendingTasks.map((task) => {
          const decision = dailyTaskDecisions[task.id];
          const isCarry = decision?.type === "carry_forward";
          const isDrop = decision?.type === "drop";
          const isReschedule = decision?.type === "reschedule";

          return (
            <div key={task.id} className="review-decision-item">
              <div>
                <strong>
                  {task.title}
                  {isRecurring(task.recurrence) && <RecurrenceBadge recurrence={task.recurrence} compact />}
                </strong>
                <div className="list__subtle">
                  {isRecurring(task.recurrence)
                    ? "Recurring - your decision updates the series"
                    : getQuickCaptureDisplayText(task, task.title)}
                </div>
              </div>

              {isDailyCompleted ? (
                <span className="tag tag--neutral">closed</span>
              ) : (
                <>
                  <div className="button-row button-row--tight button-row--wrap">
                    <button
                      className={`button ${isCarry ? "button--primary" : "button--ghost"} button--small`}
                      type="button"
                      onClick={() =>
                        setDailyTaskDecisions((current) => ({
                          ...current,
                          [task.id]: {
                            type: "carry_forward",
                          },
                        }))
                      }
                    >
                      Carry forward
                    </button>
                    <button
                      className={`button ${isDrop ? "button--primary" : "button--ghost"} button--small`}
                      type="button"
                      onClick={() =>
                        setDailyTaskDecisions((current) => ({
                          ...current,
                          [task.id]: {
                            type: "drop",
                          },
                        }))
                      }
                    >
                      Drop
                    </button>
                    <button
                      className={`button ${isReschedule ? "button--primary" : "button--ghost"} button--small`}
                      type="button"
                      onClick={() =>
                        setDailyTaskDecisions((current) => ({
                          ...current,
                          [task.id]: {
                            type: "reschedule",
                            targetDate: current[task.id]?.targetDate ?? tomorrow,
                          },
                        }))
                      }
                    >
                      Reschedule
                    </button>
                  </div>

                  {isReschedule ? (
                    <label className="field" style={{ marginTop: "0.5rem" }}>
                      <span>Target date</span>
                      <input
                        type="date"
                        value={decision.targetDate ?? tomorrow}
                        onChange={(event) =>
                          setDailyTaskDecisions((current) => ({
                            ...current,
                            [task.id]: {
                              type: "reschedule",
                              targetDate: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                  ) : null}
                </>
              )}
            </div>
          );
        })}
      </div>
    ) : (
      <EmptyState title="No pending tasks" description="All day tasks are already resolved." />
    )}
  </SectionCard>
);

const DailyReflectionPanel = ({
  dailyInputs,
  setDailyInputs,
}: {
  dailyInputs: DailyInputs;
  setDailyInputs: Dispatch<SetStateAction<DailyInputs>>;
}) => (
  <SectionCard title="Daily reflection" subtitle="Short and practical">
    <div className="stack-form">
      <label className="field">
        <span>Biggest win</span>
        <textarea
          rows={2}
          placeholder="What moved the day forward?"
          value={dailyInputs.biggestWin}
          onChange={(event) =>
            setDailyInputs((current) => ({
              ...current,
              biggestWin: event.target.value,
            }))
          }
        />
      </label>
      <label className="field">
        <span>Main friction note</span>
        <textarea
          rows={2}
          placeholder="What created the most friction?"
          value={dailyInputs.frictionNote}
          onChange={(event) =>
            setDailyInputs((current) => ({
              ...current,
              frictionNote: event.target.value,
            }))
          }
        />
      </label>
      <label className="field">
        <span>Energy rating (1-5)</span>
        <input
          type="number"
          min={1}
          max={5}
          value={dailyInputs.energyRating}
          onChange={(event) =>
            setDailyInputs((current) => ({
              ...current,
              energyRating: event.target.value,
            }))
          }
        />
      </label>
      <label className="field">
        <span>Optional note</span>
        <textarea
          rows={2}
          placeholder="Anything else worth capturing?"
          value={dailyInputs.optionalNote}
          onChange={(event) =>
            setDailyInputs((current) => ({
              ...current,
              optionalNote: event.target.value,
            }))
          }
        />
      </label>
    </div>
  </SectionCard>
);

const TomorrowPrioritiesPanel = ({
  dailyTomorrowPriorities,
  setDailyTomorrowPriorities,
}: {
  dailyTomorrowPriorities: DailyPriorityDraft[];
  setDailyTomorrowPriorities: Dispatch<SetStateAction<DailyPriorityDraft[]>>;
}) => (
  <SectionCard title="Tomorrow priorities" subtitle="Exactly 3 priorities required">
    <div className="stack-form">
      {dailyTomorrowPriorities.map((priority, index) => (
        <label key={`tomorrow-priority-${index}`} className="field">
          <span>Priority {index + 1}</span>
          <input
            type="text"
            value={priority.title}
            placeholder="Enter tomorrow's priority"
            onChange={(event) =>
              setDailyTomorrowPriorities((current) =>
                current.map((entry, entryIndex) =>
                  entryIndex === index
                    ? {
                        ...entry,
                        title: event.target.value,
                      }
                    : entry,
                ),
              )
            }
          />
        </label>
      ))}
    </div>
  </SectionCard>
);

const SubmittedDailyReflectionPanel = ({ review }: { review: DailyReviewResponse }) => (
  <SectionCard title="Submitted daily reflection" subtitle="Read-only closed state">
    {review.existingReview ? (
      <ul className="list">
        <li>
          <strong>Biggest win</strong>
          <span className="list__subtle">{review.existingReview.biggestWin}</span>
        </li>
        <li>
          <strong>Friction tag</strong>
          <span className="list__subtle">{review.existingReview.frictionTag}</span>
        </li>
        <li>
          <strong>Friction note</strong>
          <span className="list__subtle">{review.existingReview.frictionNote ?? "None"}</span>
        </li>
        <li>
          <strong>Energy</strong>
          <span className="list__subtle">{review.existingReview.energyRating}/5</span>
        </li>
        <li>
          <strong>Optional note</strong>
          <span className="list__subtle">{review.existingReview.optionalNote ?? "None"}</span>
        </li>
      </ul>
    ) : (
      <EmptyState
        title="No reflection captured"
        description="The review is closed but no reflection details were returned."
      />
    )}
  </SectionCard>
);

const SeededTomorrowPrioritiesPanel = ({ review }: { review: DailyReviewResponse }) => (
  <SectionCard title="Seeded tomorrow priorities" subtitle="Submitted output">
    {review.seededTomorrowPriorities.length > 0 ? (
      <ol className="priority-list">
        {[...review.seededTomorrowPriorities]
          .sort((left, right) => left.slot - right.slot)
          .map((priority, index) => (
            <li key={priority.id} className="priority-list__item">
              <span>
                <span className="tag tag--neutral" style={{ marginRight: "0.5rem" }}>
                  P{index + 1}
                </span>
                {priority.title}
              </span>
            </li>
          ))}
      </ol>
    ) : (
      <EmptyState
        title="No priorities seeded"
        description="No tomorrow priorities were returned with this closed review."
      />
    )}
  </SectionCard>
);

export const DailyReviewWorkspace = ({
  review,
  summaryItems,
  dailyPendingTasks,
  dailyInputs,
  setDailyInputs,
  dailyTaskDecisions,
  setDailyTaskDecisions,
  dailyTomorrowPriorities,
  setDailyTomorrowPriorities,
  tomorrow,
  isSubmitting,
  canSubmitDaily,
  isWindowOpen,
  dailySubmitBlockers,
  draftStatusText,
  submitError,
  submitErrorText,
  submitResult,
  windowPresentation,
  onSubmit,
}: DailyReviewWorkspaceProps) => {
  const statusText = canSubmitDaily
    ? "Everything required is filled in. You can submit the daily review now."
    : isWindowOpen
      ? "The review window is open, but the form is still incomplete."
      : formatClosedWindowStatus(windowPresentation);

  if (review.isCompleted) {
    return (
      <>
        <div className="two-column-grid stagger">
          <ReviewSummaryPanel
            title="Generated summary"
            subtitle="System-generated overview"
            items={summaryItems}
            footer={
              <p className="support-copy" style={{ marginTop: "0.7rem" }}>
                Score band: {review.score.label} ({review.score.value})
              </p>
            }
          />

          <DailyPendingTasksPanel
            dailyPendingTasks={dailyPendingTasks}
            dailyTaskDecisions={dailyTaskDecisions}
            setDailyTaskDecisions={setDailyTaskDecisions}
            isDailyCompleted
            tomorrow={tomorrow}
          />

          <SubmittedDailyReflectionPanel review={review} />
          <SeededTomorrowPrioritiesPanel review={review} />
        </div>

        <div className="inline-state inline-state--success" style={{ marginTop: "0.75rem" }}>
          Daily review is already closed for {review.date}.
        </div>
      </>
    );
  }

  return (
    <>
      <div className="two-column-grid stagger">
        <ReviewSummaryPanel
          title="Generated summary"
          subtitle="System-generated overview"
          items={summaryItems}
          footer={
            <p className="support-copy" style={{ marginTop: "0.7rem" }}>
              Score band: {review.score.label} ({review.score.value})
            </p>
          }
        />

        <DailyPendingTasksPanel
          dailyPendingTasks={dailyPendingTasks}
          dailyTaskDecisions={dailyTaskDecisions}
          setDailyTaskDecisions={setDailyTaskDecisions}
          isDailyCompleted={false}
          tomorrow={tomorrow}
        />

        <DailyReflectionPanel dailyInputs={dailyInputs} setDailyInputs={setDailyInputs} />
        <TomorrowPrioritiesPanel
          dailyTomorrowPriorities={dailyTomorrowPriorities}
          setDailyTomorrowPriorities={setDailyTomorrowPriorities}
        />
      </div>

      <div className="button-row" style={{ paddingTop: "0.5rem" }}>
        <span className="support-copy">{statusText}</span>
        <button
          className="button button--primary"
          type="button"
          onClick={onSubmit}
          disabled={!canSubmitDaily}
        >
          {isSubmitting ? "Submitting..." : "Submit daily review"}
        </button>
      </div>

      {!canSubmitDaily && dailySubmitBlockers.length > 0 ? (
        <div className="inline-state inline-state--out-of-window" style={{ marginTop: "0.75rem" }}>
          {dailySubmitBlockers.map((blocker) => (
            <div key={blocker}>{blocker}</div>
          ))}
        </div>
      ) : null}

      <p className="support-copy" style={{ marginTop: "0.5rem" }}>
        {draftStatusText}
      </p>

      {submitErrorText ? (
        <div
          className={`inline-state ${isOutOfWindowError(submitError) ? "inline-state--out-of-window" : "inline-state--error"}`}
          style={{ marginTop: "0.75rem" }}
        >
          {submitErrorText}
        </div>
      ) : null}

      {submitResult ? (
        <div className="inline-state inline-state--success" style={{ marginTop: "0.75rem" }}>
          Daily review closed. {submitResult.tomorrowPriorities.length} priorities seeded for tomorrow.
        </div>
      ) : null}
    </>
  );
};
