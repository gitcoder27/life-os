type MetricPillProps = {
  label: string;
  value: string;
};

export function MetricPill({
  label,
  value,
}: MetricPillProps) {
  return (
    <div className="metric-pill">
      <span className="metric-pill__label">{label}</span>
      <strong className="metric-pill__value">{value}</strong>
    </div>
  );
}
