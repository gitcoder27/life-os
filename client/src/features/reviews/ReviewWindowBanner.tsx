import type { ReviewWindowPresentation } from "./reviewWindowModel";

type ReviewWindowBannerProps = {
  presentation: ReviewWindowPresentation;
  cadence: "daily" | "weekly" | "monthly";
  onNavigateToAllowed?: () => void;
};

export function ReviewWindowBanner({
  presentation,
  cadence,
  onNavigateToAllowed,
}: ReviewWindowBannerProps) {
  const statusModifier = presentation.status.replace(/_/g, "-");
  const showNavigate =
    !presentation.isOpen &&
    presentation.allowedDate &&
    presentation.status === "wrong_period" &&
    onNavigateToAllowed;

  return (
    <div
      className={`review-window review-window--${statusModifier}`}
      role="status"
      aria-live="polite"
    >
      <div className="review-window__rail">
        <div className="review-window__indicator" />
      </div>

      <div className="review-window__body">
        <div className="review-window__top-row">
          <span className={`tag tag--${presentation.tagVariant}`}>
            {presentation.tagLabel}
          </span>
          <span className="review-window__tz">{presentation.timezone}</span>
        </div>

        <h3 className="review-window__headline">{presentation.headline}</h3>
        <p className="review-window__description">{presentation.description}</p>

        {(presentation.opensAtLocal || presentation.closesAtLocal) && (
          <div className="review-window__timestamps">
            {presentation.opensAtLocal && !presentation.isOpen && (
              <span className="review-window__ts">
                <span className="review-window__ts-label">Opens</span>
                <span className="review-window__ts-value">{presentation.opensAtLocal}</span>
              </span>
            )}
            {presentation.closesAtLocal && presentation.isOpen && (
              <span className="review-window__ts">
                <span className="review-window__ts-label">Closes</span>
                <span className="review-window__ts-value">{presentation.closesAtLocal}</span>
              </span>
            )}
          </div>
        )}

        {showNavigate && (
          <button
            className="button button--ghost button--small review-window__navigate"
            type="button"
            onClick={onNavigateToAllowed}
          >
            Go to current {cadence} review →
          </button>
        )}
      </div>
    </div>
  );
}
