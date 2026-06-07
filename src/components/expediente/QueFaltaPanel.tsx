// Panel "Qué falta para continuar" — lista de bloqueos del expediente.
// Lectura pura. Cada bloqueo apunta a la sección/pestaña donde se resuelve.

import { AlertCircle, ChevronRight } from "lucide-react";
import { Card } from "@/components/nuvex/ui";
import { getBloqueos, type TabId } from "@/lib/expedienteGuiado";
import { roleLabel } from "@/lib/roleLabels";
import type { Expediente } from "@/lib/expedientes";

interface Props {
  exp: Expediente;
  onIrATab?: (tab: TabId) => void;
}

export function QueFaltaPanel({ exp, onIrATab }: Props) {
  const bloqueos = getBloqueos(exp);
  if (bloqueos.length === 0) {
    return (
      <Card>
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#EAF7EE] text-[#1F7A45]">
            <AlertCircle size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#1F7A45]">
              Qué falta para continuar
            </div>
            <p className="text-sm leading-snug text-[#0A1226]">Sin bloqueos detectados en la etapa actual.</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#991B1B]">
          Qué falta para continuar
        </div>
        <h3 className="text-base font-semibold text-[#0A1226]">
          {bloqueos.length} {bloqueos.length === 1 ? "bloqueo activo" : "bloqueos activos"}
        </h3>
      </div>
      <ul className="space-y-2">
        {bloqueos.map((b, i) => {
          const color = b.prioridad === "alta" ? "#991B1B" : b.prioridad === "media" ? "#8A5A00" : "#445DA3";
          const bg = b.prioridad === "alta" ? "#FEE2E2" : b.prioridad === "media" ? "#FFF7E6" : "#EEF1FA";
          return (
            <li
              key={i}
              className="flex min-w-0 flex-col items-start gap-2 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:gap-3"
              style={{ borderColor: bg, background: "white" }}
            >
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                style={{ background: bg, color }}
              >
                {b.prioridad}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-[#0A1226]">{b.que_falta}</div>
                <div className="text-[11px] text-[#242424]/60">
                  Responsable: <b>{roleLabel(b.responsable_rol, true)}</b>
                </div>
              </div>
              {b.tab && (
                <button
                  type="button"
                  onClick={() => {
                    if (b.tab && onIrATab) onIrATab(b.tab);
                    if (b.scrollToId) {
                      setTimeout(() => {
                        const el = document.getElementById(b.scrollToId!);
                        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                      }, 80);
                    }
                  }}
                  className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-[#E3E7EE] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#445DA3] hover:bg-[#EEF1FA] sm:w-auto"
                >
                  Resolver
                  <ChevronRight size={12} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
