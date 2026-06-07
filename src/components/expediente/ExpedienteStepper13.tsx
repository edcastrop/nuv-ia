// Stepper visual de las 13 etapas del Expediente Guiado NUVEX.
// Lectura pura. Pinta semáforo: completado/en_proceso/pendiente/bloqueado/requiere_accion.

import { Check, AlertTriangle, Clock, Lock } from "lucide-react";
import {
  ETAPAS_GUIADAS,
  ESTADO_COLOR,
  etapaActualGuiada,
  estadoDeEtapa,
  type EtapaGuiadaId,
} from "@/lib/expedienteGuiado";
import type { Expediente } from "@/lib/expedientes";

interface Props {
  exp: Expediente;
  onSelectEtapa?: (id: EtapaGuiadaId) => void;
}

export function ExpedienteStepper13({ exp, onSelectEtapa }: Props) {
  const actual = etapaActualGuiada(exp);
  const idxActual = ETAPAS_GUIADAS.findIndex((e) => e.id === actual);

  return (
    <div className="rounded-2xl border border-[#E3E7EE] bg-white p-3 md:p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#242424]/55">
            Expediente Guiado NUVEX
          </div>
          <div className="text-sm font-semibold text-[#0A1226]">
            Etapa {idxActual + 1} de {ETAPAS_GUIADAS.length} ·{" "}
            <span style={{ color: ESTADO_COLOR[estadoDeEtapa(exp, actual)].fg }}>
              {ETAPAS_GUIADAS[idxActual].titulo}
            </span>
          </div>
        </div>
        <div className="text-[11px] font-semibold text-[#242424]/55">
          {Math.round(((idxActual + 1) / ETAPAS_GUIADAS.length) * 100)}%
        </div>
      </div>

      <div className="overflow-x-auto -mx-1">
        <ol className="flex min-w-max items-stretch gap-1 px-1">
          {ETAPAS_GUIADAS.map((e) => {
            const st = estadoDeEtapa(exp, e.id);
            const c = ESTADO_COLOR[st];
            const completado = st === "completado";
            const Icon = completado ? Check : st === "bloqueado" ? Lock : st === "requiere_accion" ? AlertTriangle : Clock;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onSelectEtapa?.(e.id)}
                  disabled={!onSelectEtapa}
                  title={`${e.numero}. ${e.titulo} · ${c.label} — ${e.descripcion}`}
                  className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition disabled:cursor-default hover:brightness-95"
                  style={{ background: c.bg, color: c.fg, borderColor: c.border }}
                >
                  <span
                    className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-full text-[10px] font-bold"
                    style={{ background: "rgba(255,255,255,0.55)", color: c.fg }}
                  >
                    {completado ? <Check size={11} /> : e.numero}
                  </span>
                  <span className="text-[11px] font-semibold whitespace-nowrap">{e.titulo}</span>
                  {(st === "requiere_accion" || st === "bloqueado") && (
                    <Icon size={11} className="opacity-80" />
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
        {(Object.keys(ESTADO_COLOR) as Array<keyof typeof ESTADO_COLOR>).map((k) => (
          <span
            key={k}
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold"
            style={{ background: ESTADO_COLOR[k].bg, color: ESTADO_COLOR[k].fg, borderColor: ESTADO_COLOR[k].border }}
          >
            {ESTADO_COLOR[k].label}
          </span>
        ))}
      </div>
    </div>
  );
}
