import type { CSSProperties } from "react";

const MAX_MARKS = 16;

type TallyProps = {
  total: number;
  filled: number;
  label: string;
  size?: "lg" | "sm";
  celebrate?: boolean;
};

/** A row of marks, one per check-in; long rows fall back to a single bar. */
export function Tally({ total, filled, label, size = "sm", celebrate = false }: TallyProps) {
  if (total <= 0) return null;

  const clamped = Math.max(0, Math.min(filled, total));
  const className = `hb-tally hb-tally--${size}${celebrate ? " is-celebrating" : ""}`;

  if (total > MAX_MARKS) {
    return (
      <span className={`${className} hb-tally--bar`} role="img" aria-label={label}>
        <span className="hb-tally__fill" style={{ transform: `scaleX(${clamped / total})` }} />
      </span>
    );
  }

  return (
    <span className={className} role="img" aria-label={label}>
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={`hb-tally__mark${index < clamped ? " is-filled" : ""}`}
          style={{ "--hb-index": index } as CSSProperties}
        />
      ))}
    </span>
  );
}
