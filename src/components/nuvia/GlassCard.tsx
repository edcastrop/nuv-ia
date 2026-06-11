import type { HTMLAttributes, ReactNode } from "react";

/**
 * NUVIA · GlassCard
 * Card glassmorphism canónica del sistema (fuente: Login/Registro).
 * Aplica borde superior con gradiente azul→verde automáticamente.
 */
interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Padding interno (default p-8 sm:p-10). Pasa "" para deshabilitar. */
  padding?: string;
}

export function GlassCard({
  children,
  padding = "p-6 sm:p-8",
  className = "",
  ...rest
}: GlassCardProps) {
  return (
    <div className={`nuvia-glass-card ${padding} ${className}`} {...rest}>
      {children}
    </div>
  );
}
