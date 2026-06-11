import type { ReactNode } from "react";
import { Inbox, Sparkles } from "lucide-react";

/**
 * NUVIA · EmptyState Premium (Fase 7.6.1B+)
 * Vacío con visual NUVIA: halo radial, anillo, micro-pista IA opcional.
 */
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Pista de NUVIA IA (texto corto, sugerencia accionable). */
  hint?: string;
  /** Reduce padding cuando se usa dentro de cards pequeñas. */
  compact?: boolean;
  /** Tono del halo. Default azul NUVIA. */
  tone?: "blue" | "green" | "warning" | "neutral";
}

const TONE: Record<NonNullable<EmptyStateProps["tone"]>, { halo: string; ring: string; fg: string }> = {
  blue:    { halo: "rgba(68,93,163,0.18)",   ring: "rgba(68,93,163,0.45)",   fg: "#A5B5E0" },
  green:   { halo: "rgba(132,185,143,0.18)", ring: "rgba(132,185,143,0.45)", fg: "#9BCB9F" },
  warning: { halo: "rgba(246,196,83,0.18)",  ring: "rgba(246,196,83,0.45)",  fg: "#F6C453" },
  neutral: { halo: "rgba(255,255,255,0.08)", ring: "rgba(255,255,255,0.20)", fg: "var(--nuvia-text-secondary)" },
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  hint,
  compact = false,
  tone = "blue",
}: EmptyStateProps) {
  const t = TONE[tone];
  const size = compact ? 56 : 84;
  return (
    <div
      className="relative flex flex-col items-center justify-center text-center overflow-hidden"
      style={{
        padding: compact ? "20px 16px" : "40px 24px",
        gap: "10px",
      }}
    >
      {/* Halo radial detrás del icono */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: compact ? -20 : -40,
          width: compact ? 220 : 360,
          height: compact ? 220 : 360,
          background: `radial-gradient(circle at center, ${t.halo} 0%, transparent 65%)`,
          filter: "blur(2px)",
        }}
      />

      {/* Anillo con icono */}
      <div
        className="relative grid place-items-center rounded-full"
        style={{
          width: size,
          height: size,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
          border: `1px solid ${t.ring}`,
          boxShadow: `0 0 0 6px rgba(255,255,255,0.02), inset 0 0 0 1px rgba(255,255,255,0.04)`,
          color: t.fg,
        }}
      >
        <div
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(from 90deg, ${t.ring}, transparent 35%, ${t.ring} 70%, transparent)`,
            opacity: 0.25,
            mask: "radial-gradient(circle, transparent 55%, black 56%)",
            WebkitMask: "radial-gradient(circle, transparent 55%, black 56%)",
          }}
        />
        {icon ?? <Inbox size={compact ? 22 : 30} />}
      </div>

      <div
        className="font-semibold relative"
        style={{
          fontSize: compact ? "14px" : "16px",
          lineHeight: 1.25,
          color: "var(--nuvia-text-primary)",
        }}
      >
        {title}
      </div>
      {description && (
        <p
          className="max-w-md relative"
          style={{
            fontSize: "12.5px",
            lineHeight: 1.5,
            color: "var(--nuvia-text-secondary)",
          }}
        >
          {description}
        </p>
      )}

      {hint && (
        <div
          className="relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
          style={{
            background: "rgba(167,139,250,0.10)",
            border: "1px solid rgba(167,139,250,0.35)",
            color: "#C4B5FD",
            fontSize: "11px",
          }}
        >
          <Sparkles size={11} />
          <span>{hint}</span>
        </div>
      )}

      {action && <div className="relative" style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}
