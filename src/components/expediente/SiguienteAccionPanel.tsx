// Panel "Tu siguiente acción" — bloque dinámico por rol y estado del expediente.
// Lectura pura. El botón hace scroll a la sección correspondiente o cambia de pestaña.

import { ArrowRight, Sparkles } from "lucide-react";
import { Card } from "@/components/nuvex/ui";
import { useUserRole } from "@/hooks/useUserRole";
import { getSiguienteAccion, type TabId } from "@/lib/expedienteGuiado";
import { roleLabel } from "@/lib/roleLabels";
import type { Expediente } from "@/lib/expedientes";

interface Props {
  exp: Expediente;
  onIrATab?: (tab: TabId) => void;
}

export function SiguienteAccionPanel({ exp, onIrATab }: Props) {
  const { roles, loading } = useUserRole();
  if (loading) return null;
  const accion = getSiguienteAccion(exp, roles);
  if (!accion) return null;

  const color =
    accion.prioridad === "alta" ? "#445DA3" : accion.prioridad === "media" ? "#8A5A00" : "#6B7280";
  const bg =
    accion.prioridad === "alta" ? "#EEF1FA" : accion.prioridad === "media" ? "#FFF7E6" : "#F2F4F8";

  function handleClick() {
    if (accion?.tab && onIrATab) onIrATab(accion.tab);
    if (accion?.scrollToId) {
      setTimeout(() => {
        const el = document.getElementById(accion.scrollToId!);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  }

  return (
    <Card>
      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl text-white shadow-sm"
            style={{ background: color }}
          >
            <Sparkles size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color }}>
              Tu siguiente acción {accion.rol !== "todos" && <span className="ml-1 rounded-full px-1.5 py-0.5 text-[9px]" style={{ background: bg }}>{roleLabel(accion.rol, true)}</span>}
            </div>
            <h3 className="break-words text-lg font-semibold leading-snug text-[#0A1226]">{accion.titulo}</h3>
            <p className="mt-0.5 text-xs text-[#242424]/70">{accion.descripcion}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex w-full items-center justify-center gap-1.5 self-start rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 sm:w-auto md:self-auto"
          style={{ background: color }}
        >
          {accion.botonLabel}
          <ArrowRight size={14} />
        </button>
      </div>
    </Card>
  );
}
