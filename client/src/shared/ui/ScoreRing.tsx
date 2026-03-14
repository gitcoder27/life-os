type ScoreRingProps = {
  value: number;
  label: string;
  size?: number;
};

export function ScoreRing({ value, label, size = 140 }: ScoreRingProps) {
  const strokeWidth = 5;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
      >
        <defs>
          <linearGradient
            id="scoreGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#d9993a" />
            <stop offset="100%" stopColor="#f0c060" />
          </linearGradient>
        </defs>
        <circle
          className="score-ring__track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
        />
        <circle
          className="score-ring__progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={
            {
              "--circumference": circumference,
              "--target-offset": offset,
            } as React.CSSProperties
          }
        />
      </svg>
      <div className="score-ring__inner">
        <span className="score-ring__value">{value}</span>
        <span className="score-ring__label-text">{label}</span>
      </div>
    </div>
  );
}
