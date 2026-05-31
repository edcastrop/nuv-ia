import { useCallback, useState } from "react";
import { ACCION_A_ESTADO, type AccionOrigen, type CasoEstado } from "@/lib/casoEstados";
import { cambiarEstadoConValidacion, TransicionInvalidaError } from "@/lib/pipelineTransiciones";

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

  const confirmar = useCallback(async (observacion: string, submotivo?: string) => {
    if (!expedienteId || !pendiente) return;
    try {
      await cambiarEstadoConValidacion(expedienteId, pendiente.estado, pendiente.accion, observacion || undefined, submotivo);
      onChanged?.();
    } catch (err) {
      if (err instanceof TransicionInvalidaError) {
        console.warn("[pipeline] transición bloqueada:", err.message);
        if (typeof window !== "undefined") window.alert(err.message);
      } else {
        throw err;
      }
    } finally {
      setPendiente(null);
    }
  }, [expedienteId, pendiente, onChanged]);

  const cancelar = useCallback(() => setPendiente(null), []);

  return { pendiente, sugerir, sugerirManual, confirmar, cancelar };
}
