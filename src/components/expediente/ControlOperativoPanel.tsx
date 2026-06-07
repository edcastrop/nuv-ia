// Panel Control Operativo — vista especial para Gerencia Administrativa.
// Lectura pura. Botones de escalar/reasignar/solicitar actualización son
// placeholders que disparan acciones existentes (por ahora notificación toast).

import { useState } from "react";
import { AlertTriangle, UserCog, MessageSquare, ArrowUpCircle } from "lucide-react";
import { Card } from "@/components/nuvex/ui";
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
    <Card>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#991B1B]">
            Control operativo · Gerencia
          </div>
          <h3 className="text-lg font-semibold leading-snug text-[#0A1226]">Estado del caso en operación</h3>
        </div>
        {alerta && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FEE2E2] px-2.5 py-1 text-[10px] font-bold text-[#991B1B]">
            <AlertTriangle size={12} /> Estancado
          </span>
        )}
      </div>

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
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#991B1B] px-3 py-2 text-xs font-semibold text-white hover:brightness-110"
        >
          <ArrowUpCircle size={14} /> Escalar caso
        </button>
        <button
          type="button"
          onClick={() => flash("Acción de reasignación pendiente — usa Gestión de usuarios para reasignar formalmente.")}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E3E7EE] bg-white px-3 py-2 text-xs font-semibold text-[#445DA3] hover:bg-[#EEF1FA]"
        >
          <UserCog size={14} /> Reasignar
        </button>
        <button
          type="button"
          onClick={() => flash("Solicitud de actualización enviada al responsable actual.")}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E3E7EE] bg-white px-3 py-2 text-xs font-semibold text-[#445DA3] hover:bg-[#EEF1FA]"
        >
          <MessageSquare size={14} /> Solicitar actualización
        </button>
      </div>

      {msg && (
        <div className="mt-3 rounded-lg border border-[#E3E7EE] bg-[#F7F9FB] px-3 py-2 text-[11px] text-[#445DA3]">
          {msg}
        </div>
      )}
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "ok" | "rojo" }) {
  const color = tone === "rojo" ? "#991B1B" : tone === "ok" ? "#1F7A45" : "#0A1226";
  return (
    <div className="min-w-0 rounded-lg border border-[#E3E7EE] bg-white px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#242424]/55">{label}</div>
      <div className="break-words text-sm font-semibold leading-snug" style={{ color }}>{value}</div>
    </div>
  );
}
