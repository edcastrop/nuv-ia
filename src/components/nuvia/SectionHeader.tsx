import type { ReactNode } from "react";

/**
 * NUVIA · SectionHeader (Fase 7.6.1B)
 * Encabezado uniforme para bloques internos (no confundir con ExecutiveHero).
 */
interface SectionHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}

export function SectionHeader({ title, description, action, icon }: SectionHeaderProps) {
  return (
    <div
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4"
      style={{ marginBottom: "var(--nuvia-space-4)" }}
    >
      <div className="min-w-0 flex items-start gap-3">
        {icon && (
          <div
            className="grid place-items-center rounded-lg shrink-0"
            style={{
              width: 32,
              height: 32,
              background: "rgba(68,93,163,0.14)",
              color: "var(--nuvia-accent-blue)",
            }}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h2
            className="font-semibold truncate"
            style={{
              fontSize: "var(--nuvia-text-h2)",
              lineHeight: "var(--nuvia-leading-h2)",
              color: "var(--nuvia-text-primary)",
            }}
          >
            {title}
          </h2>
          {description && (
            <p
              className="mt-1"
              style={{
                fontSize: "var(--nuvia-text-caption)",
                lineHeight: "var(--nuvia-leading-caption)",
                color: "var(--nuvia-text-secondary)",
              }}
            >
              {description}
            </p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
