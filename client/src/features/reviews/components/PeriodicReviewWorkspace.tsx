import type { Dispatch, SetStateAction } from "react";

import type {
  MonthlyReviewResponse,
  WeeklyReviewResponse,
} from "../../../shared/lib/api";
import { EmptyState } from "../../../shared/ui/PageState";
import { SectionCard } from "../../../shared/ui/SectionCard";
import { reviewCadences } from "../reviewCadenceConfig";
import { ReviewSummaryPanel } from "./ReviewSummaryPanel";

type ActiveHabitOption = {
  id: string;
  title: string;
  category: string | null;
};

type PeriodicReviewWorkspaceProps =
  | {
      cadenceKey: "weekly";
      review: WeeklyReviewResponse;
      summaryItems: string[];
      summaryRetryMessage: string | null;
      onRetrySummary: () => void;
      responses: string[];
      setResponses: Dispatch<SetStateAction<string[]>>;
      focusHabitId: string | null;
      setFocusHabitId: Dispatch<SetStateAction<string | null>>;
      activeHabits: ActiveHabitOption[];
      habitsLoading: boolean;
      requiredCount: number;
      completedCount: number;
      activeStep: number;
      isSubmitting: boolean;
      isWindowOpen: boolean;
      draftStatusText: string;
      submitErrorClassName: string | null;
      submitErrorText: string | null;
      submitSuccessMessage: string | null;
      onSubmit: () => void;
    }
  | {
      cadenceKey: "monthly";
      review: MonthlyReviewResponse;
      summaryItems: string[];
      summaryRetryMessage: string | null;
      onRetrySummary: () => void;
      responses: string[];
      setResponses: Dispatch<SetStateAction<string[]>>;
      requiredCount: number;
      completedCount: number;
      activeStep: number;
      isSubmitting: boolean;
      isWindowOpen: boolean;
      draftStatusText: string;
      submitErrorClassName: string | null;
      submitErrorText: string | null;
      submitSuccessMessage: string | null;
      onSubmit: () => void;
    };

const LockedReviewBanner = ({ completedAt, label }: { completedAt: string; label: string }) => (
  <div className="locked-review-banner" role="status">
    <span className="tag tag--positive">Submitted</span>
    <span className="locked-review-banner__text">
      This {label} review was finalized on{" "}
      {new Date(completedAt).toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}
    </span>
  </div>
);

const ReviewProgress = ({
  requiredCount,
  completedCount,
  activeStep,
}: {
  requiredCount: number;
  completedCount: number;
  activeStep: number;
}) => (
  <>
    <div className="review-progress">
      {Array.from({ length: requiredCount }, (_, index) => (
        <div
          key={index}
          className={`review-progress__step${
            index < completedCount ? " review-progress__step--complete" : ""
          }${
            index === (activeStep === -1 ? completedCount - 1 : activeStep)
              ? " review-progress__step--active"
              : ""
          }`}
        />
      ))}
    </div>
    <p className="support-copy" style={{ marginTop: "0.75rem" }}>
      {completedCount} of {requiredCount} prompts currently answered.
    </p>
  </>
);

const PromptComposer = ({
  prompts,
  responses,
  setResponses,
  subtitle,
}: {
  prompts: readonly string[];
  responses: string[];
  setResponses: Dispatch<SetStateAction<string[]>>;
  subtitle: string;
}) => (
  <SectionCard title="Required prompts" subtitle={subtitle}>
    <div className="stack-form">
      {prompts.map((prompt, index) => (
        <label key={prompt} className="field">
          <span>{prompt}</span>
          <textarea
            placeholder="Type your response..."
            rows={2}
            value={responses[index] ?? ""}
            onChange={(event) =>
              setResponses((current) =>
                current.map((value, currentIndex) =>
                  currentIndex === index ? event.target.value : value,
                ),
              )
            }
          />
        </label>
      ))}
    </div>
  </SectionCard>
);

const WeeklyLockedReviewPanels = ({
  review,
  summaryItems,
  summaryRetryMessage,
  onRetrySummary,
  activeHabits,
}: {
  review: WeeklyReviewResponse;
  summaryItems: string[];
  summaryRetryMessage: string | null;
  onRetrySummary: () => void;
  activeHabits: ActiveHabitOption[];
}) => {
  const existingReview = review.existingReview;
  if (!existingReview) {
    return null;
  }

  const seededNextWeekPriorities = Array.isArray(review.seededNextWeekPriorities)
    ? review.seededNextWeekPriorities
    : [];

  return (
    <>
      <LockedReviewBanner completedAt={existingReview.completedAt} label="weekly" />

      <div className="two-column-grid stagger">
        <ReviewSummaryPanel
          title="Generated summary"
          subtitle="System-generated overview"
          items={summaryItems}
          retryMessage={summaryRetryMessage}
          onRetry={onRetrySummary}
        />

        <SectionCard title="Submitted weekly reflection" subtitle="Read-only locked after submission">
          <dl className="snapshot-list">
            <div className="snapshot-list__row">
              <dt>Biggest win</dt>
              <dd>{existingReview.biggestWin}</dd>
            </div>
            <div className="snapshot-list__row">
              <dt>Biggest miss</dt>
              <dd>{existingReview.biggestMiss}</dd>
            </div>
            <div className="snapshot-list__row">
              <dt>Main lesson</dt>
              <dd>{existingReview.mainLesson}</dd>
            </div>
            <div className="snapshot-list__row">
              <dt>Keep doing</dt>
              <dd>{existingReview.keepText}</dd>
            </div>
            <div className="snapshot-list__row">
              <dt>Improve</dt>
              <dd>{existingReview.improveText}</dd>
            </div>
            {existingReview.focusHabitId ? (
              <div className="snapshot-list__row">
                <dt>Focus habit</dt>
                <dd>
                  {activeHabits.find((habit) => habit.id === existingReview.focusHabitId)?.title ??
                    existingReview.focusHabitId}
                </dd>
              </div>
            ) : null}
            {existingReview.notes ? (
              <div className="snapshot-list__row">
                <dt>Notes</dt>
                <dd>{existingReview.notes}</dd>
              </div>
            ) : null}
          </dl>
        </SectionCard>

        <SectionCard title="Seeded next-week priorities" subtitle="Planning outputs from this review">
          {seededNextWeekPriorities.length > 0 ? (
            <ol className="priority-list">
              {[...seededNextWeekPriorities]
                .sort((left, right) => left.slot - right.slot)
                .map((priority, index) => (
                  <li key={priority.id} className="priority-list__item">
                    <span>
                      <span className="tag tag--neutral" style={{ marginRight: "0.5rem" }}>
                        P{index + 1}
                      </span>
                      {priority.title}
                    </span>
                    <span
                      className={`tag tag--${
                        priority.status === "completed"
                          ? "positive"
                          : priority.status === "dropped"
                            ? "negative"
                            : "neutral"
                      }`}
                    >
                      {priority.status}
                    </span>
                  </li>
                ))}
            </ol>
          ) : (
            <EmptyState
              title="No priorities seeded"
              description="This review did not produce next-week priorities."
            />
          )}
        </SectionCard>
      </div>
    </>
  );
};

const MonthlyLockedReviewPanels = ({
  review,
  summaryItems,
}: {
  review: MonthlyReviewResponse;
  summaryItems: string[];
}) => {
  const existingReview = review.existingReview;
  if (!existingReview) {
    return null;
  }

  const monthlyThreeOutcomes = Array.isArray(existingReview.threeOutcomes)
    ? existingReview.threeOutcomes
    : [];
  const monthlyHabitChanges = Array.isArray(existingReview.habitChanges)
    ? existingReview.habitChanges
    : [];
  const seededNextMonthTheme = review.seededNextMonthTheme ?? null;
  const seededNextMonthOutcomes = Array.isArray(review.seededNextMonthOutcomes)
    ? review.seededNextMonthOutcomes
    : [];

  return (
    <>
      <LockedReviewBanner completedAt={existingReview.completedAt} label="monthly" />

      <div className="two-column-grid stagger">
        <ReviewSummaryPanel
          title="Generated summary"
          subtitle="System-generated overview"
          items={summaryItems}
          retryMessage={null}
          onRetry={null}
        />

        <SectionCard title="Submitted monthly reflection" subtitle="Read-only locked after submission">
          <dl className="snapshot-list">
            <div className="snapshot-list__row">
              <dt>Month verdict</dt>
              <dd>{existingReview.monthVerdict}</dd>
            </div>
            <div className="snapshot-list__row">
              <dt>Biggest win</dt>
              <dd>{existingReview.biggestWin}</dd>
            </div>
            <div className="snapshot-list__row">
              <dt>Biggest leak</dt>
              <dd>{existingReview.biggestLeak}</dd>
            </div>
            <div className="snapshot-list__row">
              <dt>Next month theme</dt>
              <dd>{existingReview.nextMonthTheme}</dd>
            </div>
            <div className="snapshot-list__row">
              <dt>Three outcomes</dt>
              <dd>
                {monthlyThreeOutcomes.length > 0 ? (
                  <ol className="snapshot-outcomes">
                    {monthlyThreeOutcomes.map((outcome, index) => (
                      <li key={index}>{outcome}</li>
                    ))}
                  </ol>
                ) : (
                  "None specified"
                )}
              </dd>
            </div>
            {monthlyHabitChanges.length > 0 ? (
              <div className="snapshot-list__row">
                <dt>Habit changes</dt>
                <dd>{monthlyHabitChanges.join(", ")}</dd>
              </div>
            ) : null}
            <div className="snapshot-list__row">
              <dt>Simplify</dt>
              <dd>{existingReview.simplifyText}</dd>
            </div>
            {existingReview.notes ? (
              <div className="snapshot-list__row">
                <dt>Notes</dt>
                <dd>{existingReview.notes}</dd>
              </div>
            ) : null}
          </dl>
        </SectionCard>

        <SectionCard title="Seeded next-month planning" subtitle="Planning outputs from this review">
          <dl className="snapshot-list">
            <div className="snapshot-list__row">
              <dt>Next month theme</dt>
              <dd>{seededNextMonthTheme ?? "No theme set"}</dd>
            </div>
          </dl>
          {seededNextMonthOutcomes.length > 0 ? (
            <ol className="priority-list" style={{ marginTop: "0.5rem" }}>
              {[...seededNextMonthOutcomes]
                .sort((left, right) => left.slot - right.slot)
                .map((outcome, index) => (
                  <li key={outcome.id} className="priority-list__item">
                    <span>
                      <span className="tag tag--neutral" style={{ marginRight: "0.5rem" }}>
                        O{index + 1}
                      </span>
                      {outcome.title}
                    </span>
                    <span
                      className={`tag tag--${
                        outcome.status === "completed"
                          ? "positive"
                          : outcome.status === "dropped"
                            ? "negative"
                            : "neutral"
                      }`}
                    >
                      {outcome.status}
                    </span>
                  </li>
                ))}
            </ol>
          ) : (
            <EmptyState
              title="No outcomes seeded"
              description="This review did not produce next-month outcomes."
            />
          )}
        </SectionCard>
      </div>
    </>
  );
};

const WeeklyFocusHabitPanel = ({
  activeHabits,
  habitsLoading,
  focusHabitId,
  setFocusHabitId,
}: {
  activeHabits: ActiveHabitOption[];
  habitsLoading: boolean;
  focusHabitId: string | null;
  setFocusHabitId: Dispatch<SetStateAction<string | null>>;
}) => (
  <SectionCard
    title="Focus habit for next week"
    subtitle="Choose one habit to commit to - this seeds the weekly challenge"
  >
    {habitsLoading ? (
      <p className="support-copy">Loading habits...</p>
    ) : activeHabits.length > 0 ? (
      <div className="focus-habit-field">
        <select value={focusHabitId ?? ""} onChange={(event) => setFocusHabitId(event.target.value || null)}>
          <option value="">No focus habit</option>
          {activeHabits.map((habit) => (
            <option key={habit.id} value={habit.id}>
              {habit.title}
              {habit.category ? ` (${habit.category})` : ""}
            </option>
          ))}
        </select>
      </div>
    ) : (
      <EmptyState
        title="No active habits"
        description="Create an active habit first to set a weekly focus."
      />
    )}
  </SectionCard>
);

export const PeriodicReviewWorkspace = (props: PeriodicReviewWorkspaceProps) => {
  const prompts =
    props.cadenceKey === "weekly"
      ? reviewCadences.weekly.prompts
      : reviewCadences.monthly.prompts;
  const isLocked = Boolean(props.review.existingReview);

  if (props.cadenceKey === "weekly" && isLocked) {
    return (
      <WeeklyLockedReviewPanels
        review={props.review}
        summaryItems={props.summaryItems}
        summaryRetryMessage={props.summaryRetryMessage}
        onRetrySummary={props.onRetrySummary}
        activeHabits={props.activeHabits}
      />
    );
  }

  if (props.cadenceKey === "monthly" && isLocked) {
    return <MonthlyLockedReviewPanels review={props.review} summaryItems={props.summaryItems} />;
  }

  return (
    <>
      <ReviewProgress
        requiredCount={props.requiredCount}
        completedCount={props.completedCount}
        activeStep={props.activeStep}
      />

      <div className="two-column-grid stagger">
        <ReviewSummaryPanel
          title="Prefilled summary"
          subtitle="System-generated overview"
          items={props.summaryItems}
          retryMessage={props.summaryRetryMessage}
          onRetry={props.onRetrySummary}
        />

        <PromptComposer
          prompts={prompts}
          responses={props.responses}
          setResponses={props.setResponses}
          subtitle={`${props.requiredCount} sections to complete`}
        />

        {props.cadenceKey === "weekly" ? (
          <WeeklyFocusHabitPanel
            activeHabits={props.activeHabits}
            habitsLoading={props.habitsLoading}
            focusHabitId={props.focusHabitId}
            setFocusHabitId={props.setFocusHabitId}
          />
        ) : null}
      </div>

      <div className="button-row" style={{ paddingTop: "0.5rem" }}>
        <span className="support-copy">
          {!props.isWindowOpen
            ? "Submission is currently disabled - the review window is not open."
            : "Submit when the reflection is ready."}
        </span>
        <button
          className="button button--primary"
          type="button"
          onClick={props.onSubmit}
          disabled={props.isSubmitting || !props.isWindowOpen}
        >
          {props.isSubmitting ? "Submitting..." : "Submit review"}
        </button>
      </div>

      <p className="support-copy" style={{ marginTop: "0.5rem" }}>
        {props.draftStatusText}
      </p>

      {props.submitErrorClassName && props.submitErrorText ? (
        <div className={`inline-state ${props.submitErrorClassName}`} style={{ marginTop: "0.75rem" }}>
          {props.submitErrorText}
        </div>
      ) : null}

      {props.submitSuccessMessage ? (
        <div className="inline-state inline-state--success" style={{ marginTop: "0.75rem" }}>
          {props.submitSuccessMessage}
        </div>
      ) : null}
    </>
  );
};
