import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ACCION_A_ESTADO, type AccionOrigen, type CasoEstado } from "@/lib/casoEstados";
import { cambiarEstadoConValidacion, TransicionInvalidaError } from "@/lib/pipelineTransiciones";
import { supabase } from "@/integrations/supabase/client";
import { programarEntregaDesdeBanco } from "@/lib/entregaDocumental";

export interface ConfirmExtras {
  radicadoIdBanco?: string;
}

export function useEstadoSugerido(expedienteId: string | undefined | null, onChanged?: () => void) {
  const [pendiente, setPendiente] = useState<{ estado: CasoEstado; accion: AccionOrigen } | null>(null);

  const sugerir = useCallback((accion: Exclude<AccionOrigen, "manual">) => {
    if (!expedienteId) return;
    const estado = ACCION_A_ESTADO[accion];
    if (!estado) return;
    setPendiente({ estado, accion });
  }, [expedienteId]);

  const sugerirManual = useCallback((estado: CasoEstado) => {
    if (!expedienteId) return;
    setPendiente({ estado, accion: "manual" });
  }, [expedienteId]);

  const confirmar = useCallback(async (observacion: string, submotivo?: string, extras?: ConfirmExtras) => {
    if (!expedienteId || !pendiente) return;
    try {
      // Si se está marcando radicado en banco, persistir el ID y la fecha
      // antes del cambio de estado para que quede registrado atómicamente.
      if (pendiente.estado === "radicado_banco" && extras?.radicadoIdBanco) {
        const { error: errRad } = await supabase
          .from("expedientes")
          .update({
            radicado_id_banco: extras.radicadoIdBanco,
            radicado_fecha: new Date().toISOString(),
          } as never)
          .eq("id", expedienteId);
        if (errRad) throw errRad;
      }

      await cambiarEstadoConValidacion(expedienteId, pendiente.estado, pendiente.accion, observacion || undefined, submotivo);
      toast.success("Estado del caso actualizado");

      // Cuando se confirma la radicación, programar la entrega documental
      // según las reglas del banco (Davivienda → correo; Bogotá → ya entregada;
      // Davibank → T+4 hábiles; AV Villas → T+8 hábiles).
      if (pendiente.estado === "radicado_banco") {
        try {
          const { data: expRow } = await supabase
            .from("expedientes")
            .select("banco")
            .eq("id", expedienteId)
            .maybeSingle();
          const banco = (expRow as { banco?: string | null } | null)?.banco ?? null;
          await programarEntregaDesdeBanco({ expedienteId, banco });
        } catch (e) {
          console.warn("[entregaDocumental] no se pudo programar", e);
        }
      }

      // Auto-avance: si se acaba de marcar contrato_firmado o poder_firmado
      // y AMBOS ya están firmados, avanzar a "documentación completa" para
      // cerrar visualmente la etapa de Contratación y abrir Documentación Bancaria.
      if (pendiente.accion === "contrato_firmado" || pendiente.accion === "poder_firmado") {
        try {
          const { data: hist } = await supabase
            .from("expediente_historial")
            .select("accion_origen,estado_caso_nuevo")
            .eq("expediente_id", expedienteId);
          const rows = (hist as unknown as { accion_origen: string; estado_caso_nuevo: string }[] | null) ?? [];
          const tieneContrato = rows.some(
            (r) => r.accion_origen === "contrato_firmado" || r.estado_caso_nuevo === "contrato_firmado",
          );
          const tienePoder = rows.some(
            (r) => r.accion_origen === "poder_firmado" || r.estado_caso_nuevo === "poder_firmado",
          );
          if (tieneContrato && tienePoder) {
            await cambiarEstadoConValidacion(
              expedienteId,
              "documentacion_completa",
              "documentacion_completa",
              "Contrato y poder firmados — avance automático",
            );
            toast.success("Contratación completada — pasa a Documentación Bancaria");
          }
        } catch (e) {
          // No romper el flujo principal si el auto-avance falla
          console.warn("[pipeline] auto-avance documentacion_completa", e);
        }
      }

      onChanged?.();
    } catch (err) {
      if (err instanceof TransicionInvalidaError) {
        console.warn("[pipeline] transición bloqueada:", err.message);
        toast.error("Transición no permitida", { description: err.message, duration: 6000 });
      } else {
        const msg = err instanceof Error ? err.message : "No se pudo cambiar el estado del caso";
        console.error("[pipeline] error cambiando estado:", err);
        toast.error("Error al cambiar el estado", { description: msg, duration: 7000 });
      }
    } finally {
      setPendiente(null);
    }
  }, [expedienteId, pendiente, onChanged]);

  const cancelar = useCallback(() => setPendiente(null), []);

  return { pendiente, sugerir, sugerirManual, confirmar, cancelar };
}
