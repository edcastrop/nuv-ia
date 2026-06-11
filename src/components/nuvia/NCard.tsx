import type { HTMLAttributes, ReactNode } from "react";

/**
 * NUVIA · NCard (Fase 7.6.1B)
 * Card oficial del sistema. Reemplaza shadcn Card, GlassCard, nuvex Panel.
 *
 * Variantes:
 *   - "default"  Glass blando, uso general.
 *   - "elevated" Glass + sombra fuerte, para secciones principales.
 *   - "flat"     Fondo plano, sin blur (tablas dentro de card).
 *   - "outline"  Solo borde, fondo transparente.
 */
interface NCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "flat" | "outline";
  /** Padding interno. Default "md" (24px). */
  padding?: "none" | "sm" | "md" | "lg";
  children: ReactNode;
}

const PADDING: Record<NonNullable<NCardProps["padding"]>, string> = {
  none: "0",
  sm: "var(--nuvia-space-4)",
  md: "var(--nuvia-space-5)",
  lg: "var(--nuvia-space-6)",
};

export function NCard({
  variant = "default",
  padding = "md",
  className = "",
  style,
  children,
  ...rest
}: NCardProps) {
  const variantClass =
    variant === "elevated"
      ? "glass-panel"
      : variant === "flat"
        ? ""
        : variant === "outline"
          ? ""
          : "glass-card";

  const variantStyle: React.CSSProperties =
    variant === "flat"
      ? {
          background: "var(--nuvia-bg-tertiary)",
          border: "1px solid var(--nuvia-border)",
          borderRadius: "var(--nuvia-radius-md)",
        }
      : variant === "outline"
        ? {
            background: "transparent",
            border: "1px solid var(--nuvia-border)",
            borderRadius: "var(--nuvia-radius-md)",
          }
        : {};

  return (
    <div
      className={`${variantClass} ${className}`}
      style={{ padding: PADDING[padding], ...variantStyle, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
