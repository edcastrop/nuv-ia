// Panel "Tu siguiente acción" — bloque dinámico por rol y estado del expediente.
// Lectura pura. El botón hace scroll a la sección correspondiente o cambia de pestaña. NUVIA dark.

import { ArrowRight, Sparkles } from "lucide-react";
import { NCard } from "@/components/nuvia";
import { useUserRole } from "@/hooks/useUserRole";
import { getSiguienteAccion, type TabId } from "@/lib/expedienteGuiado";
import { roleLabel } from "@/lib/roleLabels";
import type { Expediente } from "@/lib/expedientes";

interface Props {
  exp: Expediente;
  onIrATab?: (tab: TabId) => void;
}

const PRIO_TONE: Record<string, { fg: string; bg: string; border: string; btnBg: string }> = {
  alta:  { fg: "#A5B5E0", bg: "rgba(68,93,163,0.18)",  border: "rgba(68,93,163,0.50)",  btnBg: "linear-gradient(135deg, #445DA3, #3a4f8c)" },
  media: { fg: "#F6C453", bg: "rgba(246,196,83,0.18)", border: "rgba(246,196,83,0.45)", btnBg: "linear-gradient(135deg, #C28A1A, #A07410)" },
  baja:  { fg: "var(--nuvia-text-secondary)", bg: "rgba(255,255,255,0.05)", border: "var(--nuvia-border)", btnBg: "linear-gradient(135deg, #4a5366, #3a4252)" },
};

export function SiguienteAccionPanel({ exp, onIrATab }: Props) {
  const { roles, loading } = useUserRole();
  if (loading) return null;
  const accion = getSiguienteAccion(exp, roles);
  if (!accion) return null;

  const tone = PRIO_TONE[accion.prioridad] ?? PRIO_TONE.baja;

  function handleClick() {
    const scrollToTarget = (attempt = 0) => {
      const directTarget = accion?.scrollToId ? document.getElementById(accion.scrollToId) : null;
      const activeTab = document.querySelector<HTMLElement>('[role="tabpanel"][data-state="active"]');
      const el = directTarget ?? (attempt >= 2 ? activeTab : null);

      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      if (attempt < 12) window.setTimeout(() => scrollToTarget(attempt + 1), 80);
    };

    if (accion?.tab && onIrATab) onIrATab(accion.tab);
    scrollToTarget();
  }

  return (
    <NCard variant="elevated">
      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl shadow-sm"
            style={{ background: tone.btnBg, color: "var(--nuvia-text-primary)" }}
          >
            <Sparkles size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase"
              style={{ letterSpacing: "0.18em", color: tone.fg }}
            >
              <span>Tu siguiente acción</span>
              {accion.rol !== "todos" && (
                <span
                  className="rounded-full border px-1.5 py-0.5 text-[9px]"
                  style={{ background: tone.bg, borderColor: tone.border, color: tone.fg }}
                >
                  {roleLabel(accion.rol, true)}
                </span>
              )}
            </div>
            <h3
              className="mt-0.5 break-words text-lg font-semibold leading-snug"
              style={{ color: "var(--nuvia-text-primary)" }}
            >
              {accion.titulo}
            </h3>
            <p className="mt-0.5 text-xs" style={{ color: "var(--nuvia-text-secondary)" }}>
              {accion.descripcion}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex w-full items-center justify-center gap-1.5 self-start rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition hover:brightness-110 sm:w-auto md:self-auto"
          style={{ background: tone.btnBg, color: "var(--nuvia-text-primary)" }}
        >
          {accion.botonLabel}
          <ArrowRight size={14} />
        </button>
      </div>
    </NCard>
  );
}
