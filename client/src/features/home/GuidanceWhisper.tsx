import { Link } from "react-router-dom";
import type { HomeOverviewResponse } from "../../shared/lib/api";
import {
  resolveHomeActionTarget,
  resolveHomeDestinationTarget,
  type HomeNavigationTarget,
} from "../../shared/lib/homeNavigation";

type Guidance = HomeOverviewResponse["guidance"];

type GuidanceWhisperProps = {
  guidance: Guidance;
};

type WhisperContent = {
  label: string;
  text: string;
  link?: { target: HomeNavigationTarget; label: string } | null;
};

function pickContent(guidance: Guidance): WhisperContent | null {
  if (guidance.recovery) {
    return {
      label: guidance.recovery.tone === "recovery" ? "Recovery note" : "Steady note",
      text: guidance.recovery.detail || guidance.recovery.title,
      link: null,
    };
  }

  const recommendation = guidance.recommendations[0];
  if (recommendation) {
    return {
      label: "One move to reset",
      text: recommendation.title,
      link: {
        target: resolveHomeActionTarget(recommendation.action),
        label: recommendation.impactLabel || "Open",
      },
    };
  }

  const challenge = guidance.weeklyChallenge;
  if (challenge) {
    const target = resolveHomeDestinationTarget({
      kind: "habit_focus",
      habitId: challenge.habitId,
      surface: "weekly_challenge",
    });
    const progress = `${challenge.weekCompletions}/${challenge.weekTarget} this week`;
    return {
      label: "Weekly focus",
      text: `${challenge.title} · ${progress}`,
      link: {
        target,
        label: "Open",
      },
    };
  }

  return null;
}

export function GuidanceWhisper({ guidance }: GuidanceWhisperProps) {
  const content = pickContent(guidance);
  if (!content) return null;

  return (
    <p className="guidance-whisper">
      <span className="guidance-whisper__label">{content.label}</span>
      <span className="guidance-whisper__sep" aria-hidden="true">·</span>
      <span className="guidance-whisper__text">{content.text}</span>
      {content.link ? (
        <>
          <span className="guidance-whisper__sep" aria-hidden="true">·</span>
          <Link
            to={content.link.target.to}
            state={content.link.target.state}
            className="guidance-whisper__link"
          >
            {content.link.label}
          </Link>
        </>
      ) : null}
    </p>
  );
}
