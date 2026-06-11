import type { ReactNode } from "react";

/**
 * NUVIA · ExecutiveHero (Fase 7.6.1B)
 * Reemplaza todos los headers ad-hoc del ERP.
 *
 *  <ExecutiveHero
 *    badge={{ icon: <Sparkles size={12}/>, label: "Gestión de Casos", tone: "blue" }}
 *    title="Expedientes NUVEX"
 *    description="Administra, consulta y realiza seguimiento a cada simulación."
 *    actions={<><Button>Exportar</Button><Button>Nuevo</Button></>}
 *  />
 */
interface BadgeProps {
  icon?: ReactNode;
  label: string;
  tone?: "blue" | "green" | "warning" | "danger" | "neutral";
}

interface ExecutiveHeroProps {
  badge?: BadgeProps;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode; // chip pequeño superior derecho (e.g. "Datos en tiempo real")
}

const TONE: Record<NonNullable<BadgeProps["tone"]>, { bg: string; fg: string; bd: string }> = {
  blue:    { bg: "rgba(68,93,163,0.14)",  fg: "#A5B5E0", bd: "rgba(68,93,163,0.40)" },
  green:   { bg: "rgba(132,185,143,0.14)", fg: "#9BCB9F", bd: "rgba(132,185,143,0.40)" },
  warning: { bg: "rgba(246,196,83,0.14)",  fg: "#F6C453", bd: "rgba(246,196,83,0.40)" },
  danger:  { bg: "rgba(255,107,107,0.14)", fg: "#FF8585", bd: "rgba(255,107,107,0.40)" },
  neutral: { bg: "rgba(255,255,255,0.05)", fg: "var(--nuvia-text-secondary)", bd: "var(--nuvia-border)" },
};

export function ExecutiveHero({
  badge,
  title,
  description,
  actions,
  meta,
}: ExecutiveHeroProps) {
  const toneColors = TONE[badge?.tone ?? "blue"];

  return (
    <section
      className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4"
      style={{ paddingBlock: "var(--nuvia-space-1)" }}
    >
      <div className="min-w-0 space-y-1.5">
        {badge && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-bold uppercase"
            style={{
              background: toneColors.bg,
              color: toneColors.fg,
              border: `1px solid ${toneColors.bd}`,
              fontSize: "10px",
              letterSpacing: "0.14em",
            }}
          >
            {badge.icon}
            {badge.label}
          </span>
        )}
        <h1
          className="font-bold tracking-tight truncate"
          style={{
            fontSize: "clamp(20px, 2.2vw, 26px)",
            lineHeight: 1.15,
            color: "var(--nuvia-text-primary)",
          }}
        >
          {title}
        </h1>
        {description && (
          <p
            className="max-w-2xl"
            style={{
              fontSize: "13px",
              lineHeight: 1.4,
              color: "var(--nuvia-text-secondary)",
            }}
          >
            {description}
          </p>
        )}
      </div>

      <div className="flex flex-col items-end gap-2 shrink-0">
        {meta}
        {actions && <div className="flex items-center gap-2 flex-wrap justify-end">{actions}</div>}
      </div>
    </section>
  );
}
