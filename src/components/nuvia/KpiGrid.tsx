import type { ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

/**
 * NUVIA · KpiGrid + KpiCard (Fase 7.6.1B)
 * Grid uniforme 1/2/3/4 columnas. Misma altura, misma tipografía, misma jerarquía.
 */
interface KpiGridProps {
  children: ReactNode;
  /** Columnas máximas en desktop. 2 | 3 | 4. Default 4. */
  cols?: 2 | 3 | 4;
}

export function KpiGrid({ children, cols = 4 }: KpiGridProps) {
  const lg =
    cols === 2 ? "lg:grid-cols-2" : cols === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4";
  return (
    <section
      className={`grid gap-4 sm:grid-cols-2 ${lg}`}
      style={{ gap: "var(--nuvia-space-4)" }}
    >
      {children}
    </section>
  );
}

interface KpiCardProps {
  label: string;
  value: ReactNode;
  /** Delta numérico en %. Positivo verde, negativo rojo, 0 gris. */
  delta?: number;
  deltaLabel?: string;
  hint?: string;
  icon?: ReactNode;
  /** Color de acento (icono y borde superior). Default azul. */
  tone?: "blue" | "green" | "warning" | "danger" | "neutral";
  /** Mini-sparkline opcional (array de números 0..1 o crudos). */
  sparkline?: number[];
}

const TONE_COLOR: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  blue:    "var(--nuvia-accent-blue)",
  green:   "var(--nuvia-accent-green)",
  warning: "var(--nuvia-warning)",
  danger:  "var(--nuvia-danger)",
  neutral: "var(--nuvia-text-secondary)",
};

export function KpiCard({
  label,
  value,
  delta,
  deltaLabel,
  hint,
  icon,
  tone = "blue",
  sparkline,
}: KpiCardProps) {
  const accent = TONE_COLOR[tone];
  const deltaColor =
    delta === undefined || delta === 0
      ? "var(--nuvia-text-secondary)"
      : delta > 0
        ? "var(--nuvia-success)"
        : "var(--nuvia-danger)";
  const DeltaIcon = delta === undefined || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;

  return (
    <div
      className="glass-card relative overflow-hidden"
      style={{
        padding: "var(--nuvia-space-5)",
        minHeight: 132,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: "var(--nuvia-space-3)",
      }}
    >
      {/* Borde superior con tono */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: accent, opacity: 0.55 }}
      />

      <div className="flex items-start justify-between gap-3">
        <div
          className="uppercase font-semibold"
          style={{
            color: "var(--nuvia-text-secondary)",
            fontSize: "var(--nuvia-text-badge)",
            letterSpacing: "0.14em",
            lineHeight: "var(--nuvia-leading-badge)",
          }}
        >
          {label}
        </div>
        {icon && (
          <div
            className="grid place-items-center rounded-lg shrink-0"
            style={{
              width: 32,
              height: 32,
              background: `${accent}1F`,
              color: accent,
            }}
          >
            {icon}
          </div>
        )}
      </div>

      <div
        className="font-bold tabular-nums"
        style={{
          fontSize: "var(--nuvia-text-h1)",
          lineHeight: "var(--nuvia-leading-h1)",
          color: "var(--nuvia-text-primary)",
        }}
      >
        {value}
      </div>

      <div className="flex items-center justify-between gap-3 min-h-[20px]">
        <div className="flex items-center gap-3 min-w-0">
          {delta !== undefined && (
            <span
              className="inline-flex items-center gap-1 font-semibold tabular-nums"
              style={{ color: deltaColor, fontSize: "var(--nuvia-text-caption)" }}
            >
              <DeltaIcon size={12} />
              {Math.abs(delta).toFixed(1)}%
              {deltaLabel && (
                <span className="font-normal" style={{ color: "var(--nuvia-text-secondary)" }}>
                  · {deltaLabel}
                </span>
              )}
            </span>
          )}
          {hint && delta === undefined && (
            <span
              className="truncate"
              style={{
                color: "var(--nuvia-text-secondary)",
                fontSize: "var(--nuvia-text-caption)",
              }}
            >
              {hint}
            </span>
          )}
        </div>
        {sparkline && sparkline.length > 1 && (
          <MiniSpark values={sparkline} color={accent} />
        )}
      </div>
    </div>
  );
}

function MiniSpark({ values, color }: { values: number[]; color: string }) {
  const w = 56, h = 18;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
