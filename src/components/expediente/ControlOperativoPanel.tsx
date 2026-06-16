// Panel Control Operativo — vista especial para Gerencia Administrativa.

import { useState } from "react";
import { AlertTriangle, UserCog, MessageSquare, ArrowUpCircle, Activity } from "lucide-react";
import { NCard, SectionHeader } from "@/components/nuvia";
import {
  etapaActualGuiada,
  ETAPAS_GUIADAS,
  getBloqueos,
  diasDesde,
} from "@/lib/expedienteGuiado";
import { roleLabels } from "@/lib/roleLabels";
import type { Expediente } from "@/lib/expedientes";

interface Props { exp: Expediente }

export function ControlOperativoPanel({ exp }: Props) {
  const [msg, setMsg] = useState<string | null>(null);
  const etapaId = etapaActualGuiada(exp);
  const etapa = ETAPAS_GUIADAS.find((e) => e.id === etapaId)!;
  const bloqueos = getBloqueos(exp);
  const dias = diasDesde(exp.updated_at);
  const alerta = dias >= 3;

  function flash(t: string) {
    setMsg(t);
    setTimeout(() => setMsg(null), 2500);
  }

  return (
    <NCard variant="elevated">
      <SectionHeader
        icon={<Activity size={16} />}
        title="Estado del caso en operación"
        description="Control operativo · Gerencia"
        action={
          alerta ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold"
              style={{
                background: "rgba(255,107,107,0.18)",
                color: "#FFB4B4",
                border: "1px solid rgba(255,107,107,0.32)",
              }}
            >
              <AlertTriangle size={12} /> Estancado
            </span>
          ) : undefined
        }
      />

      <div className="grid gap-3 min-[420px]:grid-cols-2 md:grid-cols-4">
        <Metric label="Días en etapa" value={`${dias}`} tone={alerta ? "rojo" : "ok"} />
        <Metric label="Etapa actual" value={`${etapa.numero}. ${etapa.titulo}`} />
        <Metric label="Responsable" value={roleLabels(etapa.responsables, true)} />
        <Metric label="Bloqueos" value={`${bloqueos.length}`} tone={bloqueos.length > 0 ? "rojo" : "ok"} />
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={() => flash("Escalamiento registrado — se notificará al responsable y gerencia.")}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-colors"
          style={{
            background: "rgba(255,107,107,0.22)",
            border: "1px solid rgba(255,107,107,0.4)",
            color: "#FFB4B4",
          }}
        >
          <ArrowUpCircle size={14} /> Escalar caso
        </button>
        <button
          type="button"
          onClick={() => flash("Acción de reasignación pendiente — usa Gestión de usuarios para reasignar formalmente.")}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--nuvia-border)",
            color: "var(--nuvia-text-primary)",
          }}
        >
          <UserCog size={14} /> Reasignar
        </button>
        <button
          type="button"
          onClick={() => flash("Solicitud de actualización enviada al responsable actual.")}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--nuvia-border)",
            color: "var(--nuvia-text-primary)",
          }}
        >
          <MessageSquare size={14} /> Solicitar actualización
        </button>
      </div>

      {msg && (
        <div
          className="mt-3 rounded-lg px-3 py-2 text-[11px]"
          style={{
            background: "rgba(68,93,163,0.14)",
            border: "1px solid rgba(68,93,163,0.32)",
            color: "var(--nuvia-text-primary)",
          }}
        >
          {msg}
        </div>
      )}
    </NCard>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "ok" | "rojo" }) {
  const color =
    tone === "rojo"
      ? "#FFB4B4"
      : tone === "ok"
        ? "#7DE8B0"
        : "var(--nuvia-text-primary)";
  return (
    <div
      className="min-w-0 rounded-lg px-3 py-2"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid var(--nuvia-border)",
      }}
    >
      <div
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--nuvia-text-secondary)" }}
      >
        {label}
      </div>
      <div className="break-words text-sm font-semibold leading-snug mt-0.5" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
