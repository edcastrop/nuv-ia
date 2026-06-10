// Bus de eventos para feedback visual al cambiar de etapa del pipeline.
// Cualquier componente puede emitir un éxito o un error de transición;
// el <EtapaTransicionDialog /> montado en _authenticated lo escucha y muestra
// el diálogo correspondiente.

import {
  getEtapaById,
  indexOfEtapa,
  ETAPAS_PIPELINE,
  type EtapaPipelineId,
} from "@/lib/pipelineEtapas";
import { roleLabel } from "@/lib/roleLabels";

export type EtapaFeedbackEventDetail =
  | {
      kind: "success";
      etapaAnteriorId: EtapaPipelineId;
      etapaNuevaId: EtapaPipelineId;
    }
  | {
      kind: "error";
      etapaActualId: EtapaPipelineId;
      etapaDestinoId?: EtapaPipelineId;
      razon: string;
      faltantes?: string[];
    };

export const ETAPA_FEEDBACK_EVENT = "nuvex:etapa-transicion";

function emit(detail: EtapaFeedbackEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ETAPA_FEEDBACK_EVENT, { detail }));
}

export function notifyEtapaExito(
  etapaAnteriorId: EtapaPipelineId,
  etapaNuevaId: EtapaPipelineId,
) {
  // Sólo notificamos avances reales o transiciones laterales con cambio de etapa.
  if (etapaAnteriorId === etapaNuevaId) return;
  emit({ kind: "success", etapaAnteriorId, etapaNuevaId });
}

export function notifyEtapaError(input: {
  etapaActualId: EtapaPipelineId;
  etapaDestinoId?: EtapaPipelineId;
  razon: string;
  faltantes?: string[];
}) {
  emit({ kind: "error", ...input });
}

/**
 * Devuelve la siguiente etapa real del pipeline (saltando "comision" que está deprecada).
 */
export function getEtapaSiguiente(actualId: EtapaPipelineId) {
  const idx = indexOfEtapa(actualId);
  for (let i = idx + 1; i < ETAPAS_PIPELINE.length; i++) {
    const e = ETAPAS_PIPELINE[i];
    if (e.id === "comision") continue;
    return e;
  }
  return null;
}

export function getResponsablesLegibles(etapaId: EtapaPipelineId): string {
  const e = getEtapaById(etapaId);
  if (!e.responsables.length) return "—";
  return e.responsables.map((r) => roleLabel(r)).join(" · ");
}

/**
 * Mini-checklist sugerido por etapa para mostrar en el modal de éxito como
 * "qué te toca ahora". Texto plano, orientado al usuario final.
 */
export const ACCIONES_POR_ETAPA: Partial<Record<EtapaPipelineId, string[]>> = {
  lead: ["Captura los datos del cliente", "Marca el lead como prospecto válido"],
  extracto: [
    "Sube el extracto bancario del cliente",
    "Verifica que la lectura automática esté correcta",
  ],
  proyeccion: [
    "Construye la proyección financiera",
    "Envía la proyección a QA para aprobación",
  ],
  presentacion: [
    "Presenta la propuesta al cliente",
    "Registra observaciones y comentarios del cliente",
  ],
  cierre: [
    "Negocia y cierra la propuesta con el cliente",
    "Registra la aceptación comercial",
  ],
  contratacion: [
    "Genera contrato y poder",
    "Envía documentos para firma del cliente",
    "Marca el checklist documental como completo",
  ],
  radicacion: [
    "Prepara el expediente para radicación",
    "Radica el expediente ante el banco",
  ],
  banco: [
    "Haz seguimiento al estudio del banco",
    "Adjunta documentos complementarios si el banco los solicita",
  ],
  resultado_banco: [
    "Registra la respuesta del banco",
    "Reajusta honorarios según el resultado real",
  ],
  aceptacion_cliente: [
    "Solicita aceptación expresa al cliente (correo, WhatsApp o carta)",
    "Registra la aceptación dentro del caso",
  ],
  informe: [
    "Genera el informe final del caso",
    "Envía el informe al cliente",
  ],
  cuenta: [
    "Genera la cuenta de cobro",
    "Envía la cuenta de cobro al cliente",
  ],
  pago: [
    "Registra el pago de honorarios del cliente",
    "Confirma la liquidación de comisión al analista",
  ],
  paz_salvo: [
    "Genera el paz y salvo del cliente",
    "Envíalo al cliente y archívalo en el expediente",
  ],
  finalizado: [
    "Verifica los indicadores finales del caso",
    "El caso queda cerrado oficialmente",
  ],
};
