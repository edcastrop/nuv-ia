// Stepper visual de las 13 etapas del Expediente Guiado NUVEX.
// Lectura pura. Pinta semáforo: completado/en_proceso/pendiente/bloqueado/requiere_accion.
// Fase redseño NUVIA dark.

import { Check, AlertTriangle, Clock, Lock } from "lucide-react";
import {
  ETAPAS_GUIADAS,
  etapaActualGuiada,
  estadoDeEtapa,
  type EtapaGuiadaId,
} from "@/lib/expedienteGuiado";
import type { Expediente } from "@/lib/expedientes";

interface Props {
  exp: Expediente;
  onSelectEtapa?: (id: EtapaGuiadaId) => void;
}

type EtapaEstado = "completado" | "en_proceso" | "pendiente" | "bloqueado" | "requiere_accion";

// Paleta dark NUVIA para el stepper — backgrounds translúcidos sobre canvas oscuro.
const ESTADO_DARK: Record<EtapaEstado, { bg: string; fg: string; border: string; label: string; chipBg: string }> = {
  completado: {
    bg: "rgba(132,185,143,0.16)",
    fg: "#9BCB9F",
    border: "rgba(132,185,143,0.42)",
    chipBg: "rgba(132,185,143,0.28)",
    label: "Completado",
  },
  en_proceso: {
    bg: "rgba(68,93,163,0.20)",
    fg: "#A5B5E0",
    border: "rgba(68,93,163,0.55)",
    chipBg: "rgba(68,93,163,0.40)",
    label: "En proceso",
  },
  pendiente: {
    bg: "rgba(255,255,255,0.04)",
    fg: "var(--nuvia-text-secondary)",
    border: "var(--nuvia-border)",
    chipBg: "rgba(255,255,255,0.08)",
    label: "Pendiente",
  },
  bloqueado: {
    bg: "rgba(255,107,107,0.16)",
    fg: "#FF8585",
    border: "rgba(255,107,107,0.45)",
    chipBg: "rgba(255,107,107,0.30)",
    label: "Bloqueado",
  },
  requiere_accion: {
    bg: "rgba(246,196,83,0.16)",
    fg: "#F6C453",
    border: "rgba(246,196,83,0.45)",
    chipBg: "rgba(246,196,83,0.30)",
    label: "Requiere acción",
  },
};

export function ExpedienteStepper13({ exp, onSelectEtapa }: Props) {
  const actual = etapaActualGuiada(exp);
  const idxActual = ETAPAS_GUIADAS.findIndex((e) => e.id === actual);
  const estadoActual = estadoDeEtapa(exp, actual);
  const pct = Math.round(((idxActual + 1) / ETAPAS_GUIADAS.length) * 100);

  return (
    <div
      className="min-w-0 glass-card"
      style={{ padding: "var(--nuvia-space-4)" }}
    >
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <div
            className="text-[10px] font-bold uppercase"
            style={{ letterSpacing: "0.16em", color: "var(--nuvia-accent-green)" }}
          >
            Expediente Guiado NUVEX
          </div>
          <div
            className="text-sm font-semibold leading-snug"
            style={{ color: "var(--nuvia-text-primary)" }}
          >
            Etapa {idxActual + 1} de {ETAPAS_GUIADAS.length} ·{" "}
            <span style={{ color: ESTADO_DARK[estadoActual].fg }}>
              {ETAPAS_GUIADAS[idxActual].titulo}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:flex-col sm:items-end">
          <div
            className="text-[11px] font-bold tabular-nums"
            style={{ color: "var(--nuvia-text-primary)" }}
          >
            {pct}%
          </div>
          <div
            className="h-1.5 w-32 overflow-hidden rounded-full"
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
      </div>

      <div className="-mx-1 overflow-x-auto overscroll-x-contain">
        <ol className="flex min-w-max items-stretch gap-1.5 px-1">
          {ETAPAS_GUIADAS.map((e) => {
            const st = estadoDeEtapa(exp, e.id) as EtapaEstado;
            const c = ESTADO_DARK[st];
            const completado = st === "completado";
            const Icon = completado ? Check : st === "bloqueado" ? Lock : st === "requiere_accion" ? AlertTriangle : Clock;
            const isActive = e.id === actual;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onSelectEtapa?.(e.id)}
                  disabled={!onSelectEtapa}
                  title={`${e.numero}. ${e.titulo} · ${c.label} — ${e.descripcion}`}
                  className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition disabled:cursor-default hover:brightness-125"
                  style={{
                    background: c.bg,
                    color: c.fg,
                    borderColor: c.border,
                    boxShadow: isActive ? `0 0 0 1px ${c.border}` : undefined,
                  }}
                >
                  <span
                    className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-full text-[10px] font-bold"
                    style={{ background: c.chipBg, color: c.fg }}
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

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px]">
        {(Object.keys(ESTADO_DARK) as EtapaEstado[]).map((k) => (
          <span
            key={k}
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold"
            style={{ background: ESTADO_DARK[k].bg, color: ESTADO_DARK[k].fg, borderColor: ESTADO_DARK[k].border }}
          >
            {ESTADO_DARK[k].label}
          </span>
        ))}
      </div>
    </div>
  );
}
