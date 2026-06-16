// Checklist por rol — lista los pendientes y completados del usuario actual.
// Lectura pura. NUVIA dark.

import { CheckCircle2, Circle, ListChecks } from "lucide-react";
import { NCard, SectionHeader } from "@/components/nuvia";
import { useUserRole } from "@/hooks/useUserRole";
import { getChecklistRol, type TabId } from "@/lib/expedienteGuiado";
import type { Expediente } from "@/lib/expedientes";

interface Props {
  exp: Expediente;
  onIrATab?: (tab: TabId) => void;
}

export function ChecklistRolPanel({ exp, onIrATab }: Props) {
  const { roles, loading } = useUserRole();
  if (loading) return null;
  const items = getChecklistRol(exp, roles);
  if (items.length === 0) return null;
  const hechos = items.filter((i) => i.completado).length;
  const pct = Math.round((hechos / items.length) * 100);

  return (
    <NCard>
      <SectionHeader
        title={`${hechos} de ${items.length} pasos completados`}
        description="Tu checklist según el rol activo"
        icon={<ListChecks size={16} />}
        action={
          <div className="flex flex-col items-end gap-1">
            <div
              className="text-[11px] font-bold tabular-nums"
              style={{ color: "var(--nuvia-text-primary)" }}
            >
              {pct}%
            </div>
            <div
              className="h-1.5 w-24 overflow-hidden rounded-full"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: "linear-gradient(90deg, var(--nuvia-accent-blue), var(--nuvia-accent-green))",
                }}
              />
            </div>
          </div>
        }
      />

      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex min-w-0 items-start gap-2.5">
            {it.completado ? (
              <CheckCircle2 size={16} className="flex-shrink-0" style={{ color: "var(--nuvia-accent-green)" }} />
            ) : (
              <Circle size={16} className="flex-shrink-0" style={{ color: "var(--nuvia-text-secondary)", opacity: 0.5 }} />
            )}
            <span
              className="min-w-0 flex-1 break-words text-sm leading-snug"
              style={{
                color: it.completado ? "var(--nuvia-text-secondary)" : "var(--nuvia-text-primary)",
                textDecoration: it.completado ? "line-through" : undefined,
                opacity: it.completado ? 0.65 : 1,
              }}
            >
              {it.label}
            </span>
            {!it.completado && it.tab && (
              <button
                type="button"
                onClick={() => {
                  if (it.tab && onIrATab) onIrATab(it.tab);
                  if (it.scrollToId) {
                    setTimeout(() => {
                      const el = document.getElementById(it.scrollToId!);
                      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 80);
                  }
                }}
                className="shrink-0 text-[11px] font-semibold hover:underline"
                style={{ color: "var(--nuvia-accent-blue)" }}
              >
                Ir →
              </button>
            )}
          </li>
        ))}
      </ul>
    </NCard>
  );
}
