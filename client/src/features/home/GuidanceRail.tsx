import { Link, useNavigate } from "react-router-dom";
import type {
  HomeAction,
  HomeGuidanceRecommendation,
} from "../../shared/lib/api";
import {
  resolveHomeActionTarget,
  resolveHomeDestinationTarget,
} from "../../shared/lib/homeNavigation";

type Recovery = {
  tone: "steady" | "recovery";
  title: string;
  detail: string;
};

type WeeklyChallenge = {
  habitId: string;
  title: string;
  streakCount: number;
  weekCompletions: number;
  weekTarget: number;
  status: "on_track" | "due_today" | "behind";
};

type Recommendation = {
  id: HomeGuidanceRecommendation["id"];
  kind: HomeGuidanceRecommendation["kind"];
  title: HomeGuidanceRecommendation["title"];
  detail: HomeGuidanceRecommendation["detail"];
  impactLabel: HomeGuidanceRecommendation["impactLabel"];
  action: HomeAction;
};

type GuidanceRailProps = {
  recovery: Recovery | null;
  weeklyChallenge: WeeklyChallenge | null;
  recommendations: Recommendation[];
};

function ChallengeRing({
  completions,
  target,
}: {
  completions: number;
  target: number;
}) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const progress = target > 0 ? Math.min(completions / target, 1) : 0;

  return (
    <svg className="challenge-ring" viewBox="0 0 40 40" width="36" height="36">
      <circle
        cx="20" cy="20" r={r}
        fill="none" strokeWidth="3"
        stroke="rgba(255,255,255,0.06)"
      />
      <circle
        cx="20" cy="20" r={r}
        fill="none" strokeWidth="3"
        strokeLinecap="round"
        stroke="var(--positive)"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - progress)}
        transform="rotate(-90 20 20)"
      />
    </svg>
  );
}

export function GuidanceRail({
  recovery,
  weeklyChallenge,
  recommendations,
}: GuidanceRailProps) {
  const navigate = useNavigate();
  const hasContent = recovery || weeklyChallenge || recommendations.length > 0;
  if (!hasContent) return null;
  const weeklyChallengeTarget = weeklyChallenge
    ? resolveHomeDestinationTarget({
        kind: "habit_focus",
        habitId: weeklyChallenge.habitId,
        surface: "weekly_challenge",
      })
    : null;

  return (
    <div className="guidance-section">
      {recovery ? (
        <div
          className={`guidance-strip${recovery.tone === "recovery" ? " guidance-strip--recovery" : ""}`}
        >
          <span className="guidance-strip__dot" />
          <span className="guidance-strip__text">
            <strong>{recovery.title}</strong>
            {" \u2014 "}
            {recovery.detail}
          </span>
        </div>
      ) : null}

      {weeklyChallenge && weeklyChallengeTarget ? (
        <Link
          to={weeklyChallengeTarget.to}
          state={weeklyChallengeTarget.state}
          className="guidance-challenge"
        >
          <ChallengeRing
            completions={weeklyChallenge.weekCompletions}
            target={weeklyChallenge.weekTarget}
          />
          <div className="guidance-challenge__body">
            <span className="guidance-challenge__label">Weekly focus</span>
            <span className="guidance-challenge__title">{weeklyChallenge.title}</span>
            <span className="guidance-challenge__meta">
              {weeklyChallenge.weekCompletions}/{weeklyChallenge.weekTarget} this week
              {weeklyChallenge.streakCount > 0
                ? ` · ${weeklyChallenge.streakCount}d streak`
                : ""}
            </span>
          </div>
          <span
            className={`guidance-challenge__tag guidance-challenge__tag--${weeklyChallenge.status}`}
          >
            {weeklyChallenge.status.replace(/_/g, " ")}
          </span>
        </Link>
      ) : null}

      {recommendations.length > 0 ? (
        <div className="guidance-recs">
          {recommendations.map((rec, index) => {
            const target = resolveHomeActionTarget(rec.action);
            const isPrimary = index === 0;

            return (
            <button
              key={rec.id}
              className={`guidance-rec${isPrimary ? " guidance-rec--primary" : ""}`}
              type="button"
              onClick={() => navigate(target.to, target.state ? { state: target.state } : undefined)}
            >
              <span className={`guidance-rec__dot guidance-rec__dot--${rec.kind}`} />
              <span className="guidance-rec__title">
                {isPrimary ? (
                  <span className="guidance-rec__eyebrow">Next best move</span>
                ) : null}
                {rec.title}
              </span>
              <span className="guidance-rec__tag">{rec.impactLabel}</span>
            </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
