import { InlineErrorState } from "../../../shared/ui/PageState";

import type { WeeklyChallenge } from "../types";
import { ChallengeProgressRing } from "./ChallengeProgressRing";

type SignalsSectionProps = {
  weeklyChallenge: WeeklyChallenge;
  highlightWeeklyChallenge?: boolean;
  isMomentumError: boolean;
  momentumErrorMessage?: string;
  onRetry: () => void;
};

export function SignalsSection({
  weeklyChallenge,
  highlightWeeklyChallenge = false,
  isMomentumError,
  momentumErrorMessage,
  onRetry,
}: SignalsSectionProps) {
  return (
    <div className="habits-signals">
      {weeklyChallenge ? (
        <WeeklyChallengeCard
          weeklyChallenge={weeklyChallenge}
          highlight={highlightWeeklyChallenge}
        />
      ) : null}

      {isMomentumError ? (
        <InlineErrorState
          message={momentumErrorMessage ?? "Consistency data could not load."}
          onRetry={onRetry}
        />
      ) : null}
    </div>
  );
}

function WeeklyChallengeCard({
  weeklyChallenge,
  highlight = false,
}: {
  weeklyChallenge: NonNullable<WeeklyChallenge>;
  highlight?: boolean;
}) {
  const isDueAndIncomplete =
    weeklyChallenge.status === "due_today" && !weeklyChallenge.completedToday;

  return (
    <div
      id="habits-weekly-challenge"
      className={`challenge-card${weeklyChallenge.status === "behind" ? " challenge-card--behind" : ""}`}
      style={{
        cursor: "default",
        ...(highlight
          ? {
              borderColor: "rgba(217, 153, 58, 0.4)",
              boxShadow: "0 0 0 1px rgba(217, 153, 58, 0.25)",
              background: "rgba(217, 153, 58, 0.06)",
            }
          : {}),
      }}
    >
      <ChallengeProgressRing
        completions={weeklyChallenge.weekCompletions}
        target={weeklyChallenge.weekTarget}
      />
      <div className="challenge-card__body">
        <div className="challenge-card__label">This week's commitment</div>
        <div className="challenge-card__title">{weeklyChallenge.title}</div>
        <div className="challenge-card__meta">
          {weeklyChallenge.weekCompletions}/{weeklyChallenge.weekTarget} this week
          {weeklyChallenge.streakCount > 0
            ? ` \u00b7 ${weeklyChallenge.streakCount} day streak`
            : ""}
          {isDueAndIncomplete ? " \u00b7 due today" : ""}
        </div>
        {weeklyChallenge.message ? (
          <div
            className="challenge-card__meta"
            style={{ marginTop: "0.15rem", fontStyle: "italic" }}
          >
            {weeklyChallenge.message}
          </div>
        ) : null}
        <div className="challenge-card__hint">Set during your weekly review</div>
      </div>
      <span className="challenge-card__status">
        {weeklyChallenge.completedToday ? (
          <span className="tag tag--positive">done today</span>
        ) : (
          <span
            className={`tag ${weeklyChallenge.status === "on_track" ? "tag--positive" : weeklyChallenge.status === "due_today" ? "tag--warning" : "tag--negative"}`}
          >
            {weeklyChallenge.status === "on_track"
              ? "on track"
              : weeklyChallenge.status === "due_today"
                ? "due today"
                : "behind"}
          </span>
        )}
      </span>
    </div>
  );
}
