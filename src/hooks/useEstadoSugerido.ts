import { useCallback, useState } from "react";
import { ACCION_A_ESTADO, cambiarEstadoCaso, type AccionOrigen, type CasoEstado } from "@/lib/casoEstados";

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

  const confirmar = useCallback(async (observacion: string) => {
    if (!expedienteId || !pendiente) return;
    try {
      await cambiarEstadoCaso(expedienteId, pendiente.estado, pendiente.accion, observacion || undefined);
      onChanged?.();
    } finally {
      setPendiente(null);
    }
  }, [expedienteId, pendiente, onChanged]);

  const cancelar = useCallback(() => setPendiente(null), []);

  return { pendiente, sugerir, sugerirManual, confirmar, cancelar };
}
