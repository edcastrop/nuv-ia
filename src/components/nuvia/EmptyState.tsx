import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

/**
 * NUVIA · EmptyState (Fase 7.6.1B)
 * Estado vacío uniforme. Icono + título + descripción + CTA opcional.
 */
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Reduce padding cuando se usa dentro de cards pequeñas. */
  compact?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{
        padding: compact ? "var(--nuvia-space-5)" : "var(--nuvia-space-7) var(--nuvia-space-5)",
        gap: "var(--nuvia-space-3)",
      }}
    >
      <div
        className="grid place-items-center rounded-full"
        style={{
          width: compact ? 40 : 56,
          height: compact ? 40 : 56,
          background: "rgba(68,93,163,0.10)",
          color: "var(--nuvia-accent-blue)",
        }}
      >
        {icon ?? <Inbox size={compact ? 18 : 24} />}
      </div>
      <div
        className="font-semibold"
        style={{
          fontSize: "var(--nuvia-text-h3)",
          lineHeight: "var(--nuvia-leading-h3)",
          color: "var(--nuvia-text-primary)",
        }}
      >
        {title}
      </div>
      {description && (
        <p
          className="max-w-md"
          style={{
            fontSize: "var(--nuvia-text-caption)",
            lineHeight: "var(--nuvia-leading-caption)",
            color: "var(--nuvia-text-secondary)",
          }}
        >
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: "var(--nuvia-space-2)" }}>{action}</div>}
    </div>
  );
}
