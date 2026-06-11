import type { ComponentType, ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export type KpiTone = "blue" | "green" | "warning" | "danger" | "neutral";

const toneToColor: Record<KpiTone, string> = {
  blue: "var(--nuvia-accent-blue)",
  green: "var(--nuvia-accent-green)",
  warning: "var(--nuvia-warning)",
  danger: "var(--nuvia-danger)",
  neutral: "var(--nuvia-text-secondary)",
};

export interface KpiCardProps {
  icon?: ComponentType<{ size?: number }>;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  delta?: number;          // % change
  deltaSuffix?: string;    // "vs mes anterior"
  tone?: KpiTone;
  loading?: boolean;
}

export function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  delta,
  deltaSuffix,
  tone = "blue",
  loading,
}: KpiCardProps) {
  const color = toneToColor[tone];
  const positive = typeof delta === "number" && delta > 0;
  const negative = typeof delta === "number" && delta < 0;
  const DeltaIcon = positive ? TrendingUp : negative ? TrendingDown : Minus;
  const deltaColor = positive
    ? "var(--nuvia-accent-green)"
    : negative
    ? "var(--nuvia-danger)"
    : "var(--nuvia-text-muted)";

  return (
    <div
      className="glass-card p-5 transition-transform duration-200 hover:-translate-y-0.5"
      style={{ color: "var(--nuvia-text-primary)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className="text-[10.5px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--nuvia-text-muted)" }}
          >
            {label}
          </div>
          <div className="mt-2 text-[26px] font-bold leading-none">
            {loading ? <span style={{ color: "var(--nuvia-text-muted)" }}>—</span> : value}
          </div>
          {hint && (
            <div className="mt-1 text-[12px]" style={{ color: "var(--nuvia-text-secondary)" }}>
              {hint}
            </div>
          )}
        </div>
        {Icon && (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
            style={{
              background: `color-mix(in oklab, ${color} 14%, transparent)`,
              border: "1px solid var(--nuvia-border)",
              color,
            }}
          >
            <Icon size={18} />
          </div>
        )}
      </div>
      {typeof delta === "number" && (
        <div className="mt-3 flex items-center gap-1.5 text-[11.5px]" style={{ color: deltaColor }}>
          <DeltaIcon size={13} />
          <span className="font-semibold">{positive ? "+" : ""}{delta.toFixed(1)}%</span>
          {deltaSuffix && (
            <span style={{ color: "var(--nuvia-text-muted)" }}> {deltaSuffix}</span>
          )}
        </div>
      )}
    </div>
  );
}
