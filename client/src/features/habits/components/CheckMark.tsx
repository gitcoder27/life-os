const RADIUS = 13;
const MAX_SEGMENTS = 12;

type CheckMarkProps = {
  done: boolean;
  count?: number;
  target?: number;
  size?: "lg" | "sm";
};

/**
 * The check target's visual: an open ring that draws closed, fills amber and
 * draws a tick when done. Habits logged several times a day split the ring into
 * one arc per check-in. Purely decorative; the parent control carries the label.
 */
export function CheckMark({ done, count = 0, target = 1, size = "lg" }: CheckMarkProps) {
  const segments = Math.max(1, Math.min(target, MAX_SEGMENTS));
  const segmentLength = 100 / segments;
  const gap = segments > 1 ? 6 : 0;

  return (
    <span className={`hb-check hb-check--${size}${done ? " is-done" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 32 32" focusable="false">
        <g transform="rotate(-90 16 16)">
          {segments === 1 ? (
            <>
              <circle className="hb-check__track" cx="16" cy="16" r={RADIUS} />
              <circle className="hb-check__ring" cx="16" cy="16" r={RADIUS} pathLength={100} />
            </>
          ) : (
            Array.from({ length: segments }, (_, index) => (
              <circle
                key={index}
                className={`hb-check__segment${index < count ? " is-filled" : ""}`}
                cx="16"
                cy="16"
                r={RADIUS}
                pathLength={100}
                strokeDasharray={`${segmentLength - gap} ${100 - segmentLength + gap}`}
                strokeDashoffset={-(index * segmentLength + gap / 2)}
              />
            ))
          )}
        </g>
        <circle className="hb-check__fill" cx="16" cy="16" r={RADIUS + 1} />
        <path className="hb-check__tick" d="M10.5 16.4 14.3 20.2 21.6 12.4" pathLength={100} />
      </svg>
    </span>
  );
}
