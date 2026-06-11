/**
 * Mini chart widgets (sparkline / aging / funnel) — presentacionales y livianos.
 * Construidos sobre SVG puro para mantener bundle pequeño y respetar tokens NUVIA.
 */

export function Sparkline({
  values,
  height = 36,
  tone = "blue",
}: {
  values: number[];
  height?: number;
  tone?: "blue" | "green" | "warning";
}) {
  if (!values.length) return null;
  const color =
    tone === "green"
      ? "var(--nuvia-accent-green)"
      : tone === "warning"
      ? "var(--nuvia-warning)"
      : "var(--nuvia-accent-blue)";
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 120;
  const step = w / Math.max(values.length - 1, 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(2)},${(height - ((v - min) / range) * (height - 4) - 2).toFixed(2)}`)
    .join(" ");
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MiniFunnelChart({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-1.5">
      {data.map((d) => {
        const pct = Math.round((d.value / max) * 100);
        return (
          <div key={d.label}>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span style={{ color: "var(--nuvia-text-secondary)" }}>{d.label}</span>
              <span style={{ color: "var(--nuvia-text-primary)" }}>{d.value}</span>
            </div>
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  background: "var(--nuvia-gradient-primary)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AgingChart({
  buckets,
}: {
  buckets: { label: string; value: number; tone?: "green" | "warning" | "danger" }[];
}) {
  const total = buckets.reduce((s, b) => s + b.value, 0) || 1;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
      {buckets.map((b) => {
        const color =
          b.tone === "danger"
            ? "var(--nuvia-danger)"
            : b.tone === "warning"
            ? "var(--nuvia-warning)"
            : "var(--nuvia-accent-green)";
        const pct = (b.value / total) * 100;
        return (
          <div
            key={b.label}
            title={`${b.label}: ${b.value}`}
            style={{ width: `${pct}%`, background: color }}
          />
        );
      })}
    </div>
  );
}
