import { useCallback, useState } from "react";
import { toast } from "sonner";
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
      toast.success("Estado del caso actualizado");
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
