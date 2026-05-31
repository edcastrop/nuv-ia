import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/nuvex/ui";
import { CASO_ESTADOS, CASO_ESTADO_BY_KEY, labelEstado, type AccionOrigen, type CasoEstado } from "@/lib/casoEstados";
import { useEstadoSugerido } from "@/hooks/useEstadoSugerido";
import { ConfirmEstadoModal } from "./ConfirmEstadoModal";

interface Props {
  expedienteId: string;
  onChanged?: () => void;
}

export function EstadoCasoBlock({ expedienteId, onChanged }: Props) {
  const [actual, setActual] = useState<CasoEstado | null>(null);
  const [loading, setLoading] = useState(true);
  const [alerta, setAlerta] = useState<{ dias: number; tipo: string } | null>(null);
  const { pendiente, sugerirManual, sugerir, confirmar, cancelar } = useEstadoSugerido(expedienteId, () => {
    reload();
    onChanged?.();
  });

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase.from("expedientes").select("estado_caso" as never).eq("id", expedienteId).single();
    setActual((data as unknown as { estado_caso?: CasoEstado })?.estado_caso ?? "lead_creado");
    // Alerta de estancamiento sin leer
    const { data: alertas } = await supabase
      .from("caso_alertas" as never)
      .select("dias_estancado,tipo")
      .eq("expediente_id", expedienteId)
      .eq("leida", false)
      .order("created_at", { ascending: false })
      .limit(1);
    const a = (alertas as unknown as { dias_estancado: number; tipo: string }[] | null)?.[0];
    setAlerta(a ? { dias: a.dias_estancado, tipo: a.tipo } : null);
    setLoading(false);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [expedienteId]);

  const def = actual ? CASO_ESTADO_BY_KEY[actual] : null;

  const acciones: { label: string; accion: Exclude<AccionOrigen, "manual"> }[] = [
    { label: "Marcar contrato firmado", accion: "contrato_firmado" },
    { label: "Marcar poder firmado", accion: "poder_firmado" },
    { label: "Marcar radicado en banco", accion: "radicado_confirmado" },
    { label: "Marcar aprobación banco", accion: "aprobacion_registrada" },
    { label: "Marcar documentos banco firmados", accion: "documentos_banco_firmados" },
    { label: "Marcar condiciones aplicadas", accion: "condiciones_aplicadas" },
    { label: "Marcar cuenta de cobro generada", accion: "cuenta_cobro_generada" },
    { label: "Marcar cuenta de cobro enviada", accion: "cuenta_cobro_enviada" },
    { label: "Marcar honorarios pagados", accion: "honorarios_pagados" },
    { label: "Marcar paz y salvo generado", accion: "paz_y_salvo_generado" },
  ];

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#242424]/60">Estado del caso</div>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span className="rounded-full px-3 py-1 text-xs font-semibold"
                style={def ? { background: def.bg, color: def.color } : { background: "#F1F2F4", color: "#242424" }}>
                {loading ? "Cargando…" : labelEstado(actual)}
              </span>
              {alerta && (
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ background: "#FEE2E2", color: "#991B1B" }}
                  title={alerta.tipo}
                >
                  ⚠ Estancado {alerta.dias} días
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-[#242424]/60">Cambiar a:</label>
            <select
              value=""
              onChange={(e) => { if (e.target.value) sugerirManual(e.target.value as CasoEstado); }}
              className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-1.5 text-xs font-medium"
            >
              <option value="">Seleccionar estado…</option>
              {CASO_ESTADOS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {acciones.map((a) => (
            <button
              key={a.accion}
              onClick={() => sugerir(a.accion)}
              className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-1.5 text-[11px] font-medium hover:border-[#445DA3]/40"
            >{a.label}</button>
          ))}
        </div>
      </Card>

      <ConfirmEstadoModal
        open={!!pendiente}
        nuevoEstado={pendiente?.estado ?? null}
        onConfirm={async (obs, submotivo, extras) => { await confirmar(obs, submotivo, extras); }}
        onCancel={cancelar}
      />

    </>
  );
}
