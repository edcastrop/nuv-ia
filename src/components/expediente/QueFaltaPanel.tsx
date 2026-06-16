// Panel "Qué falta para continuar" — lista de bloqueos del expediente.
// Lectura pura. Cada bloqueo apunta a la sección/pestaña donde se resuelve. NUVIA dark.

import { AlertCircle, ChevronRight } from "lucide-react";
import { NCard, SectionHeader } from "@/components/nuvia";
import { getBloqueos, type TabId } from "@/lib/expedienteGuiado";
import { roleLabel } from "@/lib/roleLabels";
import type { Expediente } from "@/lib/expedientes";

interface Props {
  exp: Expediente;
  onIrATab?: (tab: TabId) => void;
}

const PRIO_TONE: Record<string, { bg: string; fg: string; border: string }> = {
  alta:  { bg: "rgba(255,107,107,0.18)", fg: "#FF8585", border: "rgba(255,107,107,0.45)" },
  media: { bg: "rgba(246,196,83,0.18)",  fg: "#F6C453", border: "rgba(246,196,83,0.45)" },
  baja:  { bg: "rgba(68,93,163,0.20)",   fg: "#A5B5E0", border: "rgba(68,93,163,0.50)" },
};

export function QueFaltaPanel({ exp, onIrATab }: Props) {
  const bloqueos = getBloqueos(exp);

  if (bloqueos.length === 0) {
    return (
      <NCard>
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="grid h-9 w-9 place-items-center rounded-xl"
            style={{ background: "rgba(132,185,143,0.18)", color: "#9BCB9F" }}
          >
            <AlertCircle size={16} />
          </div>
          <div className="min-w-0">
            <div
              className="text-[10px] font-bold uppercase"
              style={{ letterSpacing: "0.18em", color: "var(--nuvia-accent-green)" }}
            >
              Qué falta para continuar
            </div>
            <p className="text-sm leading-snug" style={{ color: "var(--nuvia-text-primary)" }}>
              Sin bloqueos detectados en la etapa actual.
            </p>
          </div>
        </div>
      </NCard>
    );
  }

  return (
    <NCard>
      <SectionHeader
        title={`${bloqueos.length} ${bloqueos.length === 1 ? "bloqueo activo" : "bloqueos activos"}`}
        description="Qué falta para continuar con esta etapa"
        icon={<AlertCircle size={16} />}
      />
      <ul className="space-y-2">
        {bloqueos.map((b, i) => {
          const tone = PRIO_TONE[b.prioridad] ?? PRIO_TONE.baja;
          return (
            <li
              key={i}
              className="flex min-w-0 flex-col items-start gap-2 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:gap-3"
              style={{
                background: "rgba(255,255,255,0.03)",
                borderColor: "var(--nuvia-border)",
              }}
            >
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border"
                style={{ background: tone.bg, color: tone.fg, borderColor: tone.border }}
              >
                {b.prioridad}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium" style={{ color: "var(--nuvia-text-primary)" }}>
                  {b.que_falta}
                </div>
                <div className="text-[11px]" style={{ color: "var(--nuvia-text-secondary)" }}>
                  Responsable:{" "}
                  <b style={{ color: "var(--nuvia-text-primary)" }}>{roleLabel(b.responsable_rol, true)}</b>
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
                  className="inline-flex w-full items-center justify-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition hover:brightness-125 sm:w-auto"
                  style={{
                    background: "rgba(68,93,163,0.20)",
                    borderColor: "rgba(68,93,163,0.50)",
                    color: "#A5B5E0",
                  }}
                >
                  Resolver
                  <ChevronRight size={12} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </NCard>
  );
}
