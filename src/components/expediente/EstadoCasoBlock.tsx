import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NCard, SectionHeader, NSelect } from "@/components/nuvia";
import { Activity, AlertTriangle } from "lucide-react";
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
      <NCard variant="elevated">
        <SectionHeader
          icon={<Activity size={16} />}
          title="Estado del caso"
          description="Estado vigente, alertas de estancamiento y transiciones rápidas."
          action={
            <div className="w-[260px]">
              <NSelect
                value=""
                onValueChange={(v) => { if (v) sugerirManual(v as CasoEstado); }}
                options={[
                  { value: "", label: "Cambiar estado…" },
                  ...CASO_ESTADOS.map((s) => ({ value: s.key, label: s.label })),
                ]}
                placeholder="Cambiar estado…"
              />
            </div>
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={
              def
                ? {
                    background: "rgba(68,93,163,0.18)",
                    color: "var(--nuvia-text-primary)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }
                : {
                    background: "rgba(255,255,255,0.06)",
                    color: "var(--nuvia-text-secondary)",
                  }
            }
          >
            {loading ? "Cargando…" : labelEstado(actual)}
          </span>
          {alerta && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                background: "rgba(255,107,107,0.18)",
                color: "#FFB4B4",
                border: "1px solid rgba(255,107,107,0.32)",
              }}
              title={alerta.tipo}
            >
              <AlertTriangle size={12} /> Estancado {alerta.dias} días
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {acciones.map((a) => (
            <button
              key={a.accion}
              onClick={() => sugerir(a.accion)}
              className="rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--nuvia-border)",
                color: "var(--nuvia-text-secondary)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(68,93,163,0.18)";
                e.currentTarget.style.color = "var(--nuvia-text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                e.currentTarget.style.color = "var(--nuvia-text-secondary)";
              }}
            >{a.label}</button>
          ))}
        </div>
      </NCard>

      <ConfirmEstadoModal
        open={!!pendiente}
        nuevoEstado={pendiente?.estado ?? null}
        onConfirm={async (obs, submotivo, extras) => { await confirmar(obs, submotivo, extras); }}
        onCancel={cancelar}
      />
    </>
  );
}
