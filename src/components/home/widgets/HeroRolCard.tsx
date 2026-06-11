import type { ReactNode } from "react";
import { Activity, ChevronDown } from "lucide-react";
import type { AppRole } from "@/hooks/useUserRole";

export interface HeroRolCardProps {
  saludo: string;            // "Buenos días, Juan"
  rolLabel: string;          // "Gerencia General"
  subtitle: string;          // descripción contextual
  metricaEstrella?: {
    label: string;
    value: ReactNode;
    tone?: "blue" | "green" | "warning" | "danger";
  };
  roles?: AppRole[];                       // todos los roles del usuario
  activeRole?: AppRole;                    // rol actualmente seleccionado
  onChangeRole?: (r: AppRole) => void;     // setter del selector
  roleLabelFor?: (r: AppRole) => string;
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
}: HeroRolCardProps) {
  const multiRol = roles.length > 1;

  return (
    <section
      className="relative overflow-hidden rounded-[var(--nuvia-radius-xl)] p-7 md:p-9"
      style={{
        background:
          "linear-gradient(135deg, var(--nuvia-bg-secondary) 0%, var(--nuvia-bg-tertiary) 60%, rgba(68,93,163,0.18) 100%)",
        border: "1px solid var(--nuvia-border)",
        boxShadow: "var(--nuvia-shadow-md)",
        color: "var(--nuvia-text-primary)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl"
        style={{ background: "rgba(132,185,143,0.18)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-10 bottom-0 h-44 w-44 rounded-full blur-3xl"
        style={{ background: "rgba(68,93,163,0.22)" }}
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
        </div>

        {metricaEstrella && (
          <div
            className="shrink-0 rounded-2xl px-5 py-4 text-right"
            style={{
              background: "rgba(5,8,22,0.45)",
              border: "1px solid var(--nuvia-border)",
              backdropFilter: "blur(8px)",
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
