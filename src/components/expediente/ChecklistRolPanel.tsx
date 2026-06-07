// Checklist por rol — lista los pendientes y completados del usuario actual.
// Lectura pura.

import { CheckCircle2, Circle } from "lucide-react";
import { Card } from "@/components/nuvex/ui";
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

  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#445DA3]">
            Tu checklist
          </div>
          <h3 className="text-base font-semibold leading-snug text-[#0A1226]">
            {hechos} de {items.length} pasos completados
          </h3>
        </div>
        <div className="text-[11px] font-semibold text-[#242424]/55">
          {Math.round((hechos / items.length) * 100)}%
        </div>
      </div>

      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex min-w-0 items-start gap-2.5">
            {it.completado ? (
              <CheckCircle2 size={16} className="flex-shrink-0 text-[#1F7A45]" />
            ) : (
              <Circle size={16} className="flex-shrink-0 text-[#CBD3E0]" />
            )}
            <span
              className={`min-w-0 flex-1 break-words text-sm leading-snug ${it.completado ? "text-[#242424]/55 line-through" : "text-[#0A1226]"}`}
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
                className="shrink-0 text-[11px] font-semibold text-[#445DA3] hover:underline"
              >
                Ir →
              </button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
