import { InlineErrorState } from "../../../shared/ui/PageState";

import type { WeeklyChallenge } from "../types";
import { Tally } from "./Tally";

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
  if (!weeklyChallenge && !isMomentumError) return null;

  return (
    <div className="hb-signals">
      {weeklyChallenge ? (
        <WeeklyCommitment
          weeklyChallenge={weeklyChallenge}
          highlight={highlightWeeklyChallenge}
        />
      ) : null}

      {isMomentumError ? (
        <InlineErrorState
          message={momentumErrorMessage ?? "Consistency data didn't load."}
          onRetry={onRetry}
        />
      ) : null}
    </div>
  );
}

function statusText(weeklyChallenge: NonNullable<WeeklyChallenge>) {
  if (weeklyChallenge.completedToday) return "Done today";
  if (weeklyChallenge.status === "due_today") return "Due today";
  if (weeklyChallenge.status === "behind") return "Still time this week";
  return "On track";
}

function WeeklyCommitment({
  weeklyChallenge,
  highlight = false,
}: {
  weeklyChallenge: NonNullable<WeeklyChallenge>;
  highlight?: boolean;
}) {
  const isDueAndOpen = weeklyChallenge.status === "due_today" && !weeklyChallenge.completedToday;

  return (
    <div
      id="habits-weekly-challenge"
      className={`hb-commitment${isDueAndOpen ? " is-due" : ""}${highlight ? " is-highlighted" : ""}`}
      title={weeklyChallenge.message}
    >
      <div className="hb-commitment__body">
        <span className="hb-commitment__label" title="Set during your weekly review">
          This week's commitment
        </span>
        <span className="hb-commitment__title">{weeklyChallenge.title}</span>
      </div>
      <div className="hb-commitment__progress">
        <span className="hb-commitment__count">
          {weeklyChallenge.weekCompletions} of {weeklyChallenge.weekTarget}
          {weeklyChallenge.streakCount > 0 ? (
            <span className="hb-commitment__streak">{weeklyChallenge.streakCount} in a row</span>
          ) : null}
        </span>
        <Tally
          total={weeklyChallenge.weekTarget}
          filled={weeklyChallenge.weekCompletions}
          label={`${weeklyChallenge.weekCompletions} of ${weeklyChallenge.weekTarget} this week`}
        />
        <span className="hb-commitment__status">{statusText(weeklyChallenge)}</span>
      </div>
    </div>
  );
}
