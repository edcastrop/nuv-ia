// Stepper visual de las 14 etapas del Pipeline Maestro NUVEX.
// 100% presentacional: recibe la etapa actual y resalta el progreso.
// Responsivo: scroll horizontal en móvil; grid compacto en desktop.

import { Check } from "lucide-react";
import {
  ETAPAS_PIPELINE,
  indexOfEtapa,
  type EtapaPipelineId,
} from "@/lib/pipelineEtapas";
import { roleLabels } from "@/lib/roleLabels";

interface Props {
  etapaActual: EtapaPipelineId;
  /** Compacto: oculta la descripción/responsables. */
  compact?: boolean;
  onSelect?: (id: EtapaPipelineId) => void;
}

const AZUL = "#445DA3";
const VERDE = "#1F7A45";
const GRIS = "#CBD3E0";

export function PipelineStepper14({ etapaActual, compact = false, onSelect }: Props) {
  const idxActual = indexOfEtapa(etapaActual);

  return (
    <div className="w-full rounded-2xl border border-[#E3E7EE] bg-white p-3 md:p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#242424]/55">
            Pipeline Maestro NUVEX
          </div>
          <div className="text-sm font-semibold text-[#0A1226]">
            Etapa {idxActual + 1} de {ETAPAS_PIPELINE.length} ·{" "}
            <span style={{ color: AZUL }}>{ETAPAS_PIPELINE[idxActual].titulo}</span>
          </div>
        </div>
        <div className="text-[11px] text-[#242424]/55">
          {Math.round(((idxActual + 1) / ETAPAS_PIPELINE.length) * 100)}%
        </div>
      </div>

      <div className="overflow-x-auto -mx-1">
        <ol className="flex min-w-max items-stretch gap-1 px-1">
          {ETAPAS_PIPELINE.map((e, i) => {
            const done = i < idxActual;
            const current = i === idxActual;
            const bg = done ? VERDE : current ? AZUL : "#fff";
            const fg = done || current ? "#fff" : "#242424";
            const border = done ? VERDE : current ? AZUL : GRIS;
            return (
              <li key={e.id} className="flex flex-col items-stretch">
                <button
                  type="button"
                  onClick={() => onSelect?.(e.id)}
                  disabled={!onSelect}
                  className="group flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition disabled:cursor-default"
                  style={{ background: bg, color: fg, borderColor: border }}
                  title={`${e.numero}. ${e.titulo} — ${e.descripcion}`}
                >
                  <span
                    className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-full text-[10px] font-bold"
                    style={{
                      background: done || current ? "rgba(255,255,255,0.18)" : "#F2F4F8",
                      color: fg,
                    }}
                  >
                    {done ? <Check size={11} /> : e.numero}
                  </span>
                  <span className="text-[11px] font-semibold whitespace-nowrap">
                    {e.titulo}
                  </span>
                </button>
                {i < ETAPAS_PIPELINE.length - 1 && (
                  <div className="mx-auto mt-0.5 h-0.5 w-4" style={{ background: done ? VERDE : GRIS }} />
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {!compact && (
        <div className="mt-3 rounded-lg bg-[#F7F9FB] border border-[#E3E7EE] p-3">
          <div className="text-[11px] text-[#242424]/70">
            <b className="text-[#0A1226]">{ETAPAS_PIPELINE[idxActual].titulo}:</b>{" "}
            {ETAPAS_PIPELINE[idxActual].descripcion}
          </div>
          <div className="mt-1 text-[10.5px] uppercase tracking-wider text-[#242424]/55">
            Responsables: <span className="text-[#242424]/80 normal-case tracking-normal">{roleLabels(ETAPAS_PIPELINE[idxActual].responsables, true)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
