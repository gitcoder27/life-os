import type { Dispatch, MouseEvent, SetStateAction } from "react";

import type {
  DailyReviewMutationResponse,
  DailyReviewResponse,
  TaskItem,
} from "../../../shared/lib/api";
import { isRecurring } from "../../../shared/lib/recurrence";
import { RecurrenceBadge } from "../../../shared/ui/RecurrenceBadge";
import {
  type DailyInputs,
  type DailyPriorityDraft,
  type DailyTaskDecision,
} from "../reviewDraftModel";
import type { ReviewWindowPresentation } from "../reviewWindowModel";
import { ReviewTextarea } from "./ReviewTextarea";

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

/* ── Helpers ── */

const formatShortDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const shortWindowStatus = (wp: ReviewWindowPresentation | null): string => {
  if (!wp) return "Window unavailable";
  if (wp.opensAtLocal) return `Opens ${wp.opensAtLocal}`;
  return "Window closed";
};

/* ── Progress Bar ── */

const WorkflowProgress = ({ steps }: { steps: boolean[] }) => (
  <div className="dr-progress">
    {steps.map((done, i) => (
      <div key={i} className={`dr-progress__step${done ? " dr-progress__step--done" : ""}`} />
    ))}
  </div>
);

/* ── Summary Strip — score LEFT, metrics RIGHT ── */

const SummaryStrip = ({ review }: { review: DailyReviewResponse }) => {
  const s = review.summary;
  return (
    <div className="dr-summary">
      <div className="dr-summary__score">
        <span className="dr-summary__score-value">{review.score.value}</span>
        <span className="dr-summary__score-label">{review.score.label}</span>
      </div>
      <div className="dr-summary__metrics">
        <span className="dr-summary__item">
          <span className="dr-summary__value">
            {s.prioritiesCompleted}/{s.prioritiesTotal}
          </span>{" "}
          pri
        </span>
        <span className="dr-summary__item">
          <span className="dr-summary__value">
            {s.tasksCompleted}/{s.tasksScheduled}
          </span>{" "}
          tasks
        </span>
        <span className="dr-summary__item">
          <span className="dr-summary__value">
            {s.habitsCompleted}/{s.habitsDue}
          </span>{" "}
          habits
        </span>
        <span className="dr-summary__item">
          <span className="dr-summary__value">{s.waterMl}</span>/{s.waterTargetMl} ml
        </span>
        <span className="dr-summary__item">
          {s.workoutStatus === "none" ? "No workout" : s.workoutStatus.replace(/_/g, " ")}
        </span>
      </div>
    </div>
  );
};

/* ── Task Row — actions on hover, decided tag at rest ── */

const TaskRow = ({
  task,
  decision,
  tomorrow,
  onDecide,
}: {
  task: TaskItem;
  decision: DailyTaskDecision | undefined;
  tomorrow: string;
  onDecide: (decision: DailyTaskDecision) => void;
}) => {
  const isCarry = decision?.type === "carry_forward";
  const isDrop = decision?.type === "drop";
  const isDefer = decision?.type === "reschedule";

  const handleTitleHover = (e: MouseEvent<HTMLSpanElement>) => {
    const el = e.currentTarget;
    if (el.scrollWidth > el.clientWidth) {
      el.title = task.title;
    } else {
      el.removeAttribute("title");
    }
  };

  return (
    <div className="dr-task">
      <div className="dr-task__info">
        <span className="dr-task__title" onMouseEnter={handleTitleHover}>
          {task.title}
        </span>
        {isRecurring(task.recurrence) && <RecurrenceBadge recurrence={task.recurrence} compact />}
      </div>
      <div className="dr-task__toggle">
        {/* Decided tag — visible at rest, fades on hover */}
        {decision && (
          <span
            className={`dr-task__decided-tag dr-task__decided-tag--${
              isCarry ? "carry" : isDrop ? "drop" : "defer"
            }`}
          >
            {isCarry && "Carry"}
            {isDrop && "Drop"}
            {isDefer && decision.targetDate && formatShortDate(decision.targetDate)}
            {isDefer && !decision?.targetDate && "Deferred"}
          </span>
        )}
        {/* Action pills — hidden at rest, shown on hover/focus */}
        <div className="dr-task__actions">
          <button
            type="button"
            className={`dr-task__pill dr-task__pill--carry${isCarry ? " dr-task__pill--active" : ""}`}
            onClick={() => onDecide({ type: "carry_forward" })}
          >
            Carry
          </button>
          <button
            type="button"
            className={`dr-task__pill dr-task__pill--drop${isDrop ? " dr-task__pill--active" : ""}`}
            onClick={() => onDecide({ type: "drop" })}
          >
            Drop
          </button>
          <button
            type="button"
            className={`dr-task__pill dr-task__pill--defer${isDefer ? " dr-task__pill--active" : ""}`}
            onClick={() =>
              onDecide({
                type: "reschedule",
                targetDate: decision?.targetDate ?? tomorrow,
              })
            }
          >
            Defer
          </button>
          {isDefer && decision && (
            <input
              type="date"
              className="dr-task__date"
              value={decision.targetDate ?? tomorrow}
              onChange={(e) => onDecide({ type: "reschedule", targetDate: e.target.value })}
            />
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Energy Dots ── */

const EnergyDots = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => {
  const rating = parseInt(value) || 3;
  return (
    <div className="dr-field">
      <span className="dr-field__label">Energy</span>
      <div className="dr-energy__dots" data-rating={rating}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`Set energy to ${n} out of 5`}
            className={`dr-energy__dot dr-energy__dot--level-${n}${
              rating >= n ? " dr-energy__dot--active" : ""
            }`}
            onClick={() => onChange(String(n))}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
};

/* ── Completed View ── */

const CompletedView = ({ review }: { review: DailyReviewResponse }) => (
  <div className="dr-completed">
    <div className="dr-completed__banner">Daily review closed for {review.date}</div>

    <SummaryStrip review={review} />

    <div className="dr-completed__grid">
      <div className="dr-completed__section">
        <span className="dr-section__title">Reflection</span>
        {review.existingReview ? (
          <>
            <div className="dr-completed__row">
              <span className="dr-completed__label">Win</span>
              <span className="dr-completed__value">{review.existingReview.biggestWin}</span>
            </div>
            <div className="dr-completed__row">
              <span className="dr-completed__label">Friction</span>
              <span className="dr-completed__value">
                {review.existingReview.frictionTag}
                {review.existingReview.frictionNote
                  ? ` — ${review.existingReview.frictionNote}`
                  : ""}
              </span>
            </div>
            <div className="dr-completed__row">
              <span className="dr-completed__label">Energy</span>
              <span className="dr-completed__value">
                {review.existingReview.energyRating}/5
              </span>
            </div>
            {review.existingReview.optionalNote && (
              <div className="dr-completed__row">
                <span className="dr-completed__label">Note</span>
                <span className="dr-completed__value">
                  {review.existingReview.optionalNote}
                </span>
              </div>
            )}
          </>
        ) : (
          <span className="dr-completed__value--muted">No reflection captured</span>
        )}
      </div>

      <div className="dr-completed__section">
        <span className="dr-section__title">Tomorrow priorities</span>
        {review.seededTomorrowPriorities.length > 0 ? (
          <div className="dr-completed__priorities">
            {[...review.seededTomorrowPriorities]
              .sort((a, b) => a.slot - b.slot)
              .map((p, i) => (
                <div key={p.id} className="dr-completed__priority">
                  <span className="dr-priority__number">{i + 1}</span>
                  <span>{p.title}</span>
                </div>
              ))}
          </div>
        ) : (
          <span className="dr-completed__value--muted">No priorities seeded</span>
        )}
      </div>
    </div>
  </div>
);

/* ── Main Workspace ── */

export const DailyReviewWorkspace = ({
  review,
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
  submitErrorText,
  submitResult,
  windowPresentation,
  onSubmit,
}: DailyReviewWorkspaceProps) => {
  if (review.isCompleted) {
    return <CompletedView review={review} />;
  }

  const tasksComplete =
    dailyPendingTasks.length === 0 ||
    dailyPendingTasks.every((task) => {
      const d = dailyTaskDecisions[task.id];
      return d && (d.type !== "reschedule" || d.targetDate);
    });
  const reflectStarted = dailyInputs.biggestWin.trim().length > 0;
  const planComplete =
    dailyTomorrowPriorities.length === 3 &&
    dailyTomorrowPriorities.every((p) => p.title.trim().length > 0);

  const decidedCount = dailyPendingTasks.filter((t) => {
    const d = dailyTaskDecisions[t.id];
    return d && (d.type !== "reschedule" || d.targetDate);
  }).length;

  return (
    <div className="dr-layout">
      <WorkflowProgress steps={[reflectStarted, planComplete, tasksComplete]} />

      <SummaryStrip review={review} />

      {/* ── Two-column: Reflect (left) | Plan + Tasks (right) ── */}
      <div className="dr-columns">
        {/* Column 1 — Reflect */}
        <div className="dr-col">
          <div className="dr-section">
            <div className="dr-section__header">
              <span className="dr-section__title">Reflect</span>
            </div>
            <div className="dr-reflect">
              <div className="dr-field">
                <span className="dr-field__label">Biggest win</span>
                <ReviewTextarea
                  className="dr-field__input"
                  placeholder="What moved the day forward?"
                  value={dailyInputs.biggestWin}
                  onChange={(e) =>
                    setDailyInputs((c) => ({ ...c, biggestWin: e.target.value }))
                  }
                />
              </div>
              <div className="dr-field">
                <span className="dr-field__label">Main friction</span>
                <ReviewTextarea
                  className="dr-field__input"
                  placeholder="What created the most friction?"
                  value={dailyInputs.frictionNote}
                  onChange={(e) =>
                    setDailyInputs((c) => ({ ...c, frictionNote: e.target.value }))
                  }
                />
              </div>
              <EnergyDots
                value={dailyInputs.energyRating}
                onChange={(v) => setDailyInputs((c) => ({ ...c, energyRating: v }))}
              />
              <div className="dr-field">
                <span className="dr-field__label">Note</span>
                <ReviewTextarea
                  className="dr-field__input"
                  placeholder="Anything else worth capturing?"
                  value={dailyInputs.optionalNote}
                  onChange={(e) =>
                    setDailyInputs((c) => ({ ...c, optionalNote: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* Column 2 — Plan tomorrow + Task triage */}
        <div className="dr-col">
          <div className="dr-section">
            <div className="dr-section__header">
              <span className="dr-section__title">Plan tomorrow</span>
              <span className="dr-section__badge">
                {dailyTomorrowPriorities.filter((p) => p.title.trim().length > 0).length}/3
              </span>
            </div>
            <div className="dr-tomorrow">
              {dailyTomorrowPriorities.map((priority, index) => (
                <div key={`priority-${index}`} className="dr-priority">
                  <span className="dr-priority__number">{index + 1}</span>
                  <input
                    type="text"
                    className="dr-priority__input"
                    placeholder="Tomorrow's priority"
                    value={priority.title}
                    onChange={(e) =>
                      setDailyTomorrowPriorities((current) =>
                        current.map((entry, i) =>
                          i === index ? { ...entry, title: e.target.value } : entry,
                        ),
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="dr-section">
            <div className="dr-section__header">
              <span className="dr-section__title">
                {dailyPendingTasks.length > 0 ? "Pending tasks" : "Tasks"}
              </span>
              {dailyPendingTasks.length > 0 && (
                <span
                  className={`dr-section__badge${tasksComplete ? " dr-section__badge--done" : ""}`}
                >
                  {tasksComplete
                    ? "All resolved"
                    : `${decidedCount}/${dailyPendingTasks.length}`}
                </span>
              )}
            </div>
            {dailyPendingTasks.length > 0 ? (
              <div
                className={`dr-tasks${dailyPendingTasks.length > 10 ? " dr-tasks--scroll" : ""}`}
              >
                {dailyPendingTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    decision={dailyTaskDecisions[task.id]}
                    tomorrow={tomorrow}
                    onDecide={(decision) =>
                      setDailyTaskDecisions((current) => ({
                        ...current,
                        [task.id]: decision,
                      }))
                    }
                  />
                ))}
              </div>
            ) : (
              <span className="dr-empty">All tasks resolved.</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Sticky Submit ── */}
      <div className="dr-submit">
        <div className="dr-submit__left">
          {submitResult ? (
            <span className="dr-submit__success">
              Closed — {submitResult.tomorrowPriorities.length} priorities seeded.
            </span>
          ) : submitErrorText ? (
            <span className="dr-submit__error">{submitErrorText}</span>
          ) : (
            <span
              className={`dr-submit__status${canSubmitDaily ? " dr-submit__status--ready" : ""}`}
            >
              {canSubmitDaily
                ? "Ready to submit"
                : isWindowOpen
                  ? "Complete all sections"
                  : shortWindowStatus(windowPresentation)}
            </span>
          )}
          {!submitResult &&
            !submitErrorText &&
            !canSubmitDaily &&
            isWindowOpen &&
            dailySubmitBlockers.length > 0 && (
              <span className="dr-submit__blockers">{dailySubmitBlockers.join(" · ")}</span>
            )}
        </div>
        <button
          className="button button--primary"
          type="button"
          onClick={onSubmit}
          disabled={!canSubmitDaily}
        >
          {isSubmitting ? "Submitting..." : "Submit review"}
        </button>
      </div>
    </div>
  );
};
