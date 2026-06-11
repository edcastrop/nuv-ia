import type { ReactNode } from "react";

/**
 * NUVIA · ActionBar (Fase 7.6.1B)
 * Contenedor para botones de acción primaria/secundaria (se usa dentro de ExecutiveHero.actions
 * o como bloque suelto). Mantiene gap y alineación uniformes.
 */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex items-center flex-wrap"
      style={{ gap: "var(--nuvia-space-2)" }}
    >
      {children}
    </div>
  );
}
