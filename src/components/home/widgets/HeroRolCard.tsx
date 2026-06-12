import type { ReactNode } from "react";
import { Activity, ChevronDown } from "lucide-react";
import type { AppRole } from "@/hooks/useUserRole";

export interface HeroRolCardProps {
  saludo: string;
  rolLabel: string;
  subtitle: string;
  metricaEstrella?: {
    label: string;
    value: ReactNode;
    tone?: "blue" | "green" | "warning" | "danger";
  };
  roles?: AppRole[];
  activeRole?: AppRole;
  onChangeRole?: (r: AppRole) => void;
  roleLabelFor?: (r: AppRole) => string;
  ctaLabel?: string;
  ctaIcon?: ReactNode;
  onCta?: () => void;
}

export function HeroRolCard({
  saludo,
  rolLabel,
  subtitle,
  metricaEstrella,
  roles = [],
  activeRole,
  onChangeRole,
  roleLabelFor,
  ctaLabel,
  ctaIcon,
  onCta,
}: HeroRolCardProps) {
  const multiRol = roles.length > 1;


  return (
    <section
      className="relative overflow-hidden rounded-[var(--nuvia-radius-xl)] p-7 md:p-9"
      style={{
        background:
          "linear-gradient(135deg, rgba(20,28,52,0.55) 0%, rgba(28,42,78,0.42) 60%, rgba(68,93,163,0.28) 100%)",
        border: "1px solid rgba(238,245,255,0.12)",
        backdropFilter: "blur(34px) saturate(155%)",
        WebkitBackdropFilter: "blur(34px) saturate(155%)",
        boxShadow: "0 24px 60px -28px rgba(0,0,0,0.65), inset 0 1px 0 rgba(238,245,255,0.06)",
        color: "var(--nuvia-text-primary)",
      }}
    >
      {/* Gloss superior */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(238,245,255,0.45), transparent)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl"
        style={{ background: "rgba(132,185,143,0.20)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-10 bottom-0 h-44 w-44 rounded-full blur-3xl"
        style={{ background: "rgba(68,93,163,0.26)" }}
      />


      <div className="relative flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{
                background: "rgba(132,185,143,0.14)",
                color: "var(--nuvia-accent-green)",
                border: "1px solid color-mix(in oklab, var(--nuvia-accent-green) 28%, transparent)",
              }}
            >
              <Activity size={11} />
              {rolLabel}
            </span>

            {multiRol && onChangeRole && (
              <label
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] cursor-pointer"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid var(--nuvia-border)",
                  color: "var(--nuvia-text-secondary)",
                }}
                title="Cambiar vista de Home (no afecta tus permisos)"
              >
                Vista
                <select
                  value={activeRole}
                  onChange={(e) => onChangeRole(e.target.value as AppRole)}
                  className="bg-transparent border-0 outline-none text-[11px] font-semibold pr-3"
                  style={{ color: "var(--nuvia-text-primary)" }}
                >
                  {roles.map((r) => (
                    <option key={r} value={r} style={{ background: "var(--nuvia-bg-tertiary)" }}>
                      {roleLabelFor ? roleLabelFor(r) : r}
                    </option>
                  ))}
                </select>
                <ChevronDown size={11} />
              </label>
            )}
          </div>

          <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">{saludo}</h1>
          <p
            className="mt-2 max-w-2xl text-[14.5px] leading-relaxed"
            style={{ color: "var(--nuvia-text-secondary)" }}
          >
            {subtitle}
          </p>
          <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">{saludo}</h1>
          <p
            className="mt-2 max-w-2xl text-[14.5px] leading-relaxed"
            style={{ color: "var(--nuvia-text-secondary)" }}
          >
            {subtitle}
          </p>

          {ctaLabel && onCta && (
            <button
              onClick={onCta}
              className="group relative mt-5 inline-flex items-center gap-2.5 rounded-xl px-5 py-3 text-[12.5px] font-bold uppercase tracking-[0.16em] transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] overflow-hidden"
              style={{
                background:
                  "linear-gradient(135deg, var(--nuvia-accent-blue) 0%, var(--nuvia-accent-green) 100%)",
                color: "#0a0f1f",
                border: "1px solid rgba(238,245,255,0.22)",
                boxShadow:
                  "0 14px 36px -12px rgba(68,93,163,0.7), inset 0 1px 0 rgba(255,255,255,0.18)",
              }}
            >
              <span
                aria-hidden
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.22) 0%, transparent 60%)",
                }}
              />
              {ctaIcon && <span className="relative">{ctaIcon}</span>}
              <span className="relative">{ctaLabel}</span>
              <span aria-hidden className="relative transition-transform group-hover:translate-x-1">→</span>
            </button>
          )}
        </div>

        {metricaEstrella && (
          <div
            className="shrink-0 rounded-2xl px-5 py-4 text-right"
            style={{
              background: "rgba(8,12,28,0.55)",

              border: "1px solid rgba(238,245,255,0.14)",
              backdropFilter: "blur(20px) saturate(150%)",
              WebkitBackdropFilter: "blur(20px) saturate(150%)",
              boxShadow: "inset 0 1px 0 rgba(238,245,255,0.08)",
            }}
          >

            <div
              className="text-[10px] font-bold uppercase tracking-[0.22em]"
              style={{ color: "var(--nuvia-text-muted)" }}
            >
              {metricaEstrella.label}
            </div>
            <div
              className="mt-1 text-[28px] font-bold leading-none"
              style={{
                color:
                  metricaEstrella.tone === "green"
                    ? "var(--nuvia-accent-green)"
                    : metricaEstrella.tone === "warning"
                    ? "var(--nuvia-warning)"
                    : metricaEstrella.tone === "danger"
                    ? "var(--nuvia-danger)"
                    : "var(--nuvia-text-primary)",
              }}
            >
              {metricaEstrella.value}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
